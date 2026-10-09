import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

type Row = { id: string; n: number };
const make = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof make>;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

// Intended location: packages/kernel/src/lib/entity-replay-tap-boundaries.spec.ts
// Replay payloads are partial or full; the final argument is the resulting row.
describe.each(['undo', 'rollback'] as const)(
  'replay tap boundaries: %s',
  (mode) => {
    const prepare = async (
      tree: Tree,
      act: () => void
    ): Promise<() => void> => {
      tree.$.rows.addMany([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      await flush();
      if (mode === 'rollback') {
        const pending = tree.transact(act);
        await flush();
        return () => pending.rollback();
      }
      undoable(act);
      await flush();
      return () => tree.undo();
    };

    it('per-field replay supplies partial changes and the resulting row', async () => {
      const tree = make();
      try {
        const replay = await prepare(tree, () =>
          tree.$.rows.updateOne('a', { n: 9 })
        );
        const seen: unknown[] = [];
        const stop = tree.$.rows.tap({
          onUpdate: (id, changes, row) => {
            seen.push([id, changes, row]);
          },
        });
        replay();
        await flush();
        expect(seen).toStrictEqual([['a', { n: 1 }, { id: 'a', n: 1 }]]);
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
        stop();
      } finally {
        tree.destroy();
      }
    });

    it('order-target replay supplies a full row and skips unchanged values', async () => {
      const tree = make();
      try {
        const replay = await prepare(tree, () =>
          tree.$.rows.setAll([
            { id: 'b', n: 2 },
            { id: 'a', n: 9 },
          ])
        );
        const seen: unknown[] = [];
        tree.$.rows.tap({
          onUpdate: (id, changes, row) => {
            seen.push([id, changes, row]);
          },
        });
        replay();
        await flush();
        expect(seen).toStrictEqual([
          ['a', { id: 'a', n: 1 }, { id: 'a', n: 1 }],
        ]);
      } finally {
        tree.destroy();
      }
    });

    it('an add tap sees the installed collection and its nested write is intercepted once', async () => {
      const tree = make();
      try {
        const replay = await prepare(tree, () =>
          tree.$.rows.removeMany(['a', 'b'])
        );
        let intercepted = 0;
        const snapshots: string[][] = [];
        tree.$.rows.intercept({
          onUpdate: (_id, changes, ctx) => {
            intercepted++;
            ctx.transform({ ...changes, n: (changes.n ?? 0) + 100 });
          },
        });
        tree.$.rows.tap({
          onAdd: (_row, id) => {
            snapshots.push(tree.$.rows.ids());
            if (id === 'a') tree.$.rows.updateOne('a', { n: 7 });
          },
        });
        replay();
        await flush();
        expect(snapshots).toStrictEqual([
          ['a', 'b'],
          ['a', 'b'],
        ]);
        expect(intercepted).toStrictEqual(1);
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({
          id: 'a',
          n: 107,
        });
      } finally {
        tree.destroy();
      }
    });

    it('self-unsubscribe stops later replay taps without interrupting installation', async () => {
      const tree = make();
      try {
        const replay = await prepare(tree, () =>
          tree.$.rows.removeMany(['a', 'b'])
        );
        const seen: string[] = [];
        const stop = tree.$.rows.tap({
          onAdd: (_row, id) => {
            seen.push(id);
            stop();
          },
        });
        replay();
        await flush();
        expect(seen.length).toStrictEqual(1);
        expect(tree.$.rows.all()).toStrictEqual([
          { id: 'a', n: 1 },
          { id: 'b', n: 2 },
        ]);
        tree.$.rows.addOne({ id: 'c', n: 3 });
        expect(seen.length).toStrictEqual(1);
        expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
      } finally {
        tree.destroy();
      }
    });
  }
);
