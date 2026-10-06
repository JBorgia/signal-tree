import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Order-delta review of d27e55c8, item 4 (MAJOR, pre-existing): a turn with
 * `b.changeId(b, rx0); a.updateOne(a); b.clear()` across two collections
 * undid b to [b, c, d, a]. The field write to a row of the other collection
 * kept the heterogeneous frame from planning (no scalar slot runtime), and
 * the one-effect-at-a-time fallback restored rows in capture order, each by
 * its anchors against the rows already in. The fallback now puts a
 * collection's restores in placement order, as the frames do.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  a: entityMap<Row, string>({ selectId: (row) => row.id }),
  b: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const shapes: Array<[string, (tree: Tree) => void]> = [
  [
    'changeId, the other collection, clear',
    (tree) => {
      tree.$.b.changeId('b', 'rx0');
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.clear();
    },
  ],
  [
    'changeId, the other collection, removeMany of every row',
    (tree) => {
      tree.$.b.changeId('b', 'rx0');
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.removeMany(['a', 'rx0', 'c', 'd']);
    },
  ],
  [
    'the other collection, removeMany of the front rows',
    (tree) => {
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.removeMany(['b', 'a']);
    },
  ],
  [
    'the other collection, then removals one by one',
    (tree) => {
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.removeOne('c');
      tree.$.b.removeOne('a');
      tree.$.b.removeOne('d');
    },
  ],
  [
    'the other collection, removeMany, then a new row at a removed key',
    (tree) => {
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.removeMany(['a', 'c']);
      tree.$.b.addOne({ id: 'c', n: 5 });
    },
  ],
  [
    'the other collection, an add, a removal, then a new row at that key',
    (tree) => {
      tree.$.a.updateOne('a', { n: 9 });
      tree.$.b.addOne({ id: 'p', n: 1 });
      tree.$.b.removeOne('c');
      tree.$.b.addOne({ id: 'c', n: 5 });
    },
  ],
];

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  "restores beside another collection's edit (%s)",
  (_name, enhancers) => {
    it.each(shapes)('%s: undo, redo, undo', async (_case, act) => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        for (const key of ['a', 'b'] as const) {
          for (const id of 'abcd') tree.$[key].addOne({ id, n: 0 });
        }
        await flush();
        const state = () =>
          JSON.stringify([
            tree.$.a.ids(),
            tree.$.a.all(),
            tree.$.b.ids(),
            tree.$.b.all(),
          ]);
        const before = state();
        undoable(() => act(tree));
        await flush();
        const after = state();
        for (const [move, expected] of [
          [() => tree.undo(), before],
          [() => tree.redo(), after],
          [() => tree.undo(), before],
        ] as const) {
          move();
          await flush();
          expect(state()).toBe(expected);
        }
        expect(() => tree.getRestorationHistory()).not.toThrow();
      } finally {
        tree.destroy();
      }
    });
  }
);
