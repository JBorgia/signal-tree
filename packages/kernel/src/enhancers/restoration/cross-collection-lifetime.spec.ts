import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Subject lifetimes are allocated per collection, so `left` and `right` below
// both hold lifetime 1. Realization once keyed prepared subjects by the bare
// lifetime: two re-adds were refused as structural drift, and a restore in one
// collection silently absorbed a field reversal meant for the other.
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const make = () =>
  signalTree(
    { left: entityMap<Row, string>(), right: entityMap<Row, string>() },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof make>;
const seed = async (tree: Tree) => {
  tree.$.left.addOne({ id: 'a', n: 1 });
  tree.$.right.addOne({ id: 'b', n: 2 });
  await flush();
};
const rows = (tree: Tree) => ({
  left: tree.$.left.all(),
  right: tree.$.right.all(),
});
const seeded = { left: [{ id: 'a', n: 1 }], right: [{ id: 'b', n: 2 }] };

const cases: Record<string, { act: (tree: Tree) => void; after: unknown }> = {
  'both collections cleared': {
    act: (tree) => {
      tree.$.left.clear();
      tree.$.right.clear();
    },
    after: { left: [], right: [] },
  },
  'both collections added to': {
    act: (tree) => {
      tree.$.left.addOne({ id: 'c', n: 3 });
      tree.$.right.addOne({ id: 'd', n: 4 });
    },
    after: {
      left: [
        { id: 'a', n: 1 },
        { id: 'c', n: 3 },
      ],
      right: [
        { id: 'b', n: 2 },
        { id: 'd', n: 4 },
      ],
    },
  },
  'a removal in one and a field write in the other': {
    act: (tree) => {
      tree.$.left.removeOne('a');
      tree.$.right.updateOne('b', { n: 8 });
    },
    after: { left: [], right: [{ id: 'b', n: 8 }] },
  },
  'field writes in both': {
    act: (tree) => {
      tree.$.left.updateOne('a', { n: 9 });
      tree.$.right.updateOne('b', { n: 8 });
    },
    after: { left: [{ id: 'a', n: 9 }], right: [{ id: 'b', n: 8 }] },
  },
};

describe('identical lifetimes in two collections', () => {
  for (const [name, { act, after }] of Object.entries(cases)) {
    it(`undo and redo: ${name}`, async () => {
      const tree = make();
      try {
        await seed(tree);
        undoable(() => act(tree));
        await flush();
        expect(rows(tree)).toEqual(after);
        tree.undo();
        expect(rows(tree)).toEqual(seeded);
        tree.redo();
        expect(rows(tree)).toEqual(after);
      } finally {
        tree.destroy();
      }
    });

    it(`transaction rollback: ${name}`, async () => {
      const tree = make();
      try {
        await seed(tree);
        const pending = tree.transact(() => act(tree));
        expect(rows(tree)).toEqual(after);
        pending.rollback();
        expect(rows(tree)).toEqual(seeded);
      } finally {
        tree.destroy();
      }
    });
  }
});
