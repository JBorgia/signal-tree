import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Absent and present-with-undefined differ for Object.hasOwn, enumeration and
// patch operations. A reversal used to restore an entity field that had been
// absent as `key: undefined` (independent review, reproduced on 15.3.1).
type Row = {
  id: string;
  n: number;
  opt?: string;
  d?: { m?: number; sibling?: string };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const keysOf = (value: unknown) => Object.keys(value as object);
const hasOwn = (value: unknown, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)(
  'entity field presence across reversal (%s)',
  (_order, enhancers) => {
    const make = () =>
      signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhancers() }
      );
    type Tree = ReturnType<typeof make>;
    const row = (tree: Tree) => tree.$.rows.byIdOrFail('a')();

    it('undo of a write that added an optional field removes the key', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { opt: 'new' }));
        await flush();
        tree.undo();
        expect(keysOf(row(tree))).toEqual(['id', 'n']);
        expect(hasOwn(row(tree), 'opt')).toBe(false);
        tree.redo();
        expect(row(tree)).toEqual({ id: 'a', n: 1, opt: 'new' });
      } finally {
        tree.destroy();
      }
    });

    it('rollback of a write that added an optional field removes the key', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        tree
          .transact(() => tree.$.rows.updateOne('a', { opt: 'tx' }))
          .rollback();
        expect(keysOf(row(tree))).toEqual(['id', 'n']);
      } finally {
        tree.destroy();
      }
    });

    it('a replace that omitted a field undoes to present and redoes to absent', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1, opt: 'o' });
        await flush();
        undoable(() => tree.$.rows.replaceOne('a', { id: 'a', n: 1 }));
        await flush();
        expect(keysOf(row(tree))).toEqual(['id', 'n']);
        tree.undo();
        expect(row(tree)).toEqual({ id: 'a', n: 1, opt: 'o' });
        tree.redo();
        expect(keysOf(row(tree))).toEqual(['id', 'n']);
      } finally {
        tree.destroy();
      }
    });

    it('a nested optional field returns absent, leaving its siblings', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1, d: { sibling: 'keep' } });
        await flush();
        undoable(() =>
          tree.$.rows.updateOne('a', { d: { m: 3, sibling: 'keep' } })
        );
        await flush();
        tree.undo();
        expect(row(tree).d).toEqual({ sibling: 'keep' });
        expect(hasOwn(row(tree).d!, 'm')).toBe(false);
      } finally {
        tree.destroy();
      }
    });

    it('present-with-undefined stays present, and its reversal restores the old value', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { opt: undefined }));
        await flush();
        expect(hasOwn(row(tree), 'opt')).toBe(true);
        tree.undo();
        expect(hasOwn(row(tree), 'opt')).toBe(false);
        tree.redo();
        expect(hasOwn(row(tree), 'opt')).toBe(true);
        expect(row(tree).opt).toBeUndefined();

        undoable(() => tree.$.rows.updateOne('a', { opt: 'x' }));
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { opt: undefined }));
        await flush();
        tree.undo();
        expect(row(tree).opt).toBe('x');
      } finally {
        tree.destroy();
      }
    });
  }
);

it('transaction-only rollback also removes an added optional field', async () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  try {
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await flush();
    tree.transact(() => tree.$.rows.updateOne('a', { opt: 'tx' })).rollback();
    expect(keysOf(tree.$.rows.byIdOrFail('a')())).toEqual(['id', 'n']);
  } finally {
    tree.destroy();
  }
});
