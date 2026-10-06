import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * A row a rejected transaction removed is held out of the order while
 * records made WHILE the transaction was open reverse (fcdc4cfc): they never
 * knew it. Records made BEFORE it opened did know it, and held it too: undo
 * of the entry that added the row kept it in the order while removing it,
 * "Collection order does not match active SubjectIds", whenever any later
 * work had been recorded while the transaction was open (a plain add and
 * removal of another row was enough). Regression of fcdc4cfc, found while
 * checking the refusal-lifecycle gate's `replacement/resolve-retry` shape.
 */
type Row = { id: string; name: string };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const rows = (tree: Tree) =>
  tree.$.rows
    .all()
    .map((row) => `${row.id}:${row.name}`)
    .join(',');

const laterWork: Record<
  string,
  { write: (tree: Tree) => Promise<void>; undo: string[]; redo?: string[] }
> = {
  'a plain add and removal of another row': {
    write: async (tree) => {
      tree.$.rows.addOne({ id: 'B', name: 'b' });
      await flush();
      tree.$.rows.removeOne('B');
    },
    undo: ['Z:z,A:original', ''],
  },
  'a plain add of another row that stands': {
    write: async (tree) => tree.$.rows.addOne({ id: 'B', name: 'b' }),
    undo: ['Z:z,A:original,B:b', 'B:b'],
    // Pinned, not endorsed, and unchanged since d27e55c8: Z and A were added
    // to an empty collection, with no neighbour to anchor to, so their redo
    // appends them after the standing B.
    redo: ['B:b,Z:z,A:original', 'B:b,Z:z,A:edited'],
  },
  'an undoable add of another row': {
    write: async (tree) =>
      undoable(() => tree.$.rows.addOne({ id: 'B', name: 'b' })),
    undo: ['Z:z,A:edited', 'Z:z,A:original', ''],
  },
};

describe.each([
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'a rejected removal and records made before it opened (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(laterWork))(
      '%s: undo, redo and history across the rollback',
      async (name) => {
        const tree = signalTree(declaration(), {
          enhancers: enhancers() as never,
        }) as unknown as Tree;
        try {
          undoable(() => {
            tree.$.rows.addOne({ id: 'Z', name: 'z' });
            tree.$.rows.addOne({ id: 'A', name: 'original' });
          });
          await flush();
          undoable(() => tree.$.rows.updateOne('A', { name: 'edited' }));
          await flush();
          const pending = tree.transaction(() => {
            tree.$.x(1);
            tree.$.rows.removeOne('A');
          });
          await flush();
          await laterWork[name].write(tree);
          await flush();
          pending.rollback();
          await flush();
          const rolledBack = rows(tree);
          expect(tree.$.x()).toBe(0);
          const seen: string[] = [];
          while (tree.canUndo()) {
            tree.undo();
            await flush();
            expect(() => tree.getRestorationHistory()).not.toThrow();
            seen.push(rows(tree));
          }
          expect(seen).toStrictEqual(laterWork[name].undo);
          const redone: string[] = [];
          while (tree.canRedo()) {
            tree.redo();
            await flush();
            redone.push(rows(tree));
          }
          expect(redone).toStrictEqual(
            laterWork[name].redo ?? [
              ...laterWork[name].undo.slice(0, -1).reverse(),
              rolledBack,
            ]
          );
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
