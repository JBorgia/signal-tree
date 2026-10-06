import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Found by the entity review: a transaction a tap opens while undo replays
 * (or while another transaction's rollback compensates) kept its write when
 * its callback threw. The same transaction outside a replay rolled back.
 *
 * Root cause: transaction() spread the surrounding write context into its
 * own, so its writes inherited the replay's provenance (`origin:
 * 'restoration'`, or `'transaction-rollback'` with `realized`); transactions
 * and restoration decline replay and compensation writes by that origin, so
 * nothing was captured for the transaction and its rollback had nothing to
 * undo. A transaction is authored work wherever it is opened: it no longer
 * inherits replay provenance.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  log: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

type Replay = [
  string,
  () => unknown[],
  (tree: Tree, replay: () => void) => Promise<void>
];
/** Each runs `replay` from a tap during a replay of a row update. */
const replays: Replay[] = [
  [
    'undo, transactions() then restoration()',
    () => [transactions(), restoration()],
    async (tree, inTap) => {
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      tapOnce(tree, inTap);
      tree.undo();
    },
  ],
  [
    'redo, restoration() then transactions()',
    () => [restoration(), transactions()],
    async (tree, inTap) => {
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      tree.undo();
      await flush();
      tapOnce(tree, inTap);
      tree.redo();
    },
  ],
  [
    "another transaction's rollback, transactions() alone",
    () => [transactions()],
    async (tree, inTap) => {
      const pending = tree.transaction(() =>
        tree.$.rows.updateOne('a', { n: 5 })
      );
      await flush();
      tapOnce(tree, inTap);
      pending.rollback();
    },
  ],
];
const tapOnce = (tree: Tree, inTap: () => void) => {
  let armed = true;
  tree.$.rows.tap({
    onUpdate: () => {
      if (!armed) return;
      armed = false;
      inTap();
    },
  });
};

describe.each(replays)(
  'a transaction opened during %s',
  (_name, enhancers, run) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      return tree;
    };

    it('throwing in its callback rolls its write back', async () => {
      const tree = await make();
      try {
        let error: unknown;
        await run(tree, () => {
          try {
            tree.transaction(() => {
              tree.$.log.addOne({ id: 't1', n: 1 });
              throw new Error('boom');
            });
          } catch (thrown) {
            error = thrown;
          }
        });
        await flush();
        expect((error as Error | undefined)?.message).toBe('boom');
        expect(tree.$.log.ids()).toStrictEqual([]);
      } finally {
        tree.destroy();
      }
    });

    it('an explicit rollback() rolls its write back', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        await run(tree, () => {
          pending = tree.transaction(() =>
            tree.$.log.addOne({ id: 't1', n: 1 })
          );
        });
        await flush();
        expect(tree.$.log.ids()).toStrictEqual(['t1']);
        pending?.rollback();
        await flush();
        expect(tree.$.log.ids()).toStrictEqual([]);
      } finally {
        tree.destroy();
      }
    });

    it('confirming it keeps its write', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        await run(tree, () => {
          pending = tree.transaction(() =>
            tree.$.log.addOne({ id: 't1', n: 1 })
          );
        });
        await flush();
        pending?.confirm();
        await flush();
        expect(tree.$.log.ids()).toStrictEqual(['t1']);
      } finally {
        tree.destroy();
      }
    });
  }
);
