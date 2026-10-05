// v16 controls for the 15.4.2 restoration carry (v16 integration, slice 5).
//
// The carried external-authored-baseline.spec.ts pins v15 5c22eac5: external
// truth is captured for historical reconstruction but never enters an
// authored turn's reversal. These cases cover where v16 differs from v15:
//
// - a refused automatic compensation keeps pending authority and a recovery
//   handle (contract 2), so "pending history" can outlive the callback; an
//   external gap while it is held must still reach the later boundary, and
//   must not leak into the recovered turn's reversal;
// - resetRestorationHistory() is not a settlement on v16 (slice 4): it now
//   also clears ordinary and historical capture, while an open transaction's
//   staged capture survives to its own settlement and external truth written
//   after the reset stays outside that turn's reversal.
//
// Two exclusions of 5c22eac5 that its own spec does not reach are pinned here
// as well: a rollback's compensation never enters historical reconstruction
// (it waits in the historical bucket for the next recorded flush), and
// external plain-branch membership never enters an authored turn.
import { afterEach, describe, expect, it } from 'vitest';

import { observeWrites } from '../../internals';
import { external } from '../../lib/external';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

type Recovery = {
  transaction: { confirm(): void; rollback(): void };
  callbackFailed: boolean;
};
const owned: Array<{ destroy(): void }> = [];
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const tree of owned.splice(0)) tree.destroy();
  await flush();
});
const ORDERS = [
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const;

describe.each(ORDERS)(
  '15.4.2 carry under v16 contracts (%s)',
  (_name, enhancers) => {
    const make = () => {
      const tree = signalTree(
        {
          y: 0,
          z: 0,
          rows: entityMap<{ id: string; value: number }, string>(),
        },
        { enhancers: enhancers() }
      );
      owned.push(tree);
      return tree;
    };

    it('an external gap while a recovery handle holds the turn stays external', async () => {
      const tree = make();
      tree.$.rows.addOne({ id: 'a', value: 0 });
      undoable(() => tree.$.z(1));
      await flush();
      const failure = new Error('callback failed');
      let armed = true;
      const off = observeWrites((frame) => {
        if (!armed || !frame.path.startsWith('rows')) return;
        armed = false;
        tree.$.rows.updateOne('a', { value: 2 });
      });
      let thrown: unknown;
      try {
        tree.transact(() =>
          undoable(() => {
            tree.$.rows.updateOne('a', { value: 1 });
            throw failure;
          })
        );
      } catch (error) {
        thrown = error;
      } finally {
        off();
      }
      await flush();
      const recovery = (thrown as { recovery?: Recovery }).recovery;
      expect(recovery?.callbackFailed).toBe(true);
      external(() => tree.$.y(5));
      await flush();
      recovery?.transaction.confirm();
      await flush();
      expect(tree.$.y()).toBe(5);
      // The earlier boundary is reconstructed without the later external gap.
      expect(tree.getRestorationHistory()[0].state).toMatchObject({
        y: 0,
        z: 1,
      });
      // Undo of the earlier authored turn never reverses external truth.
      while (tree.canUndo()) {
        try {
          tree.undo();
        } catch {
          break;
        }
      }
      expect(tree.$.y()).toBe(5);
    });

    it('reset keeps an open transaction capture for its own settlement', async () => {
      const tree = make();
      undoable(() => tree.$.z(1));
      await flush();
      let reset = false;
      const pending = tree.transact(() => {
        undoable(() => tree.$.y(1));
        tree.resetRestorationHistory();
        reset = true;
      });
      expect(reset).toBe(true);
      external(() => tree.$.z(9));
      await flush();
      pending.confirm();
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      tree.undo();
      expect([tree.$.y(), tree.$.z()]).toEqual([0, 9]);
    });

    it('a rolled-back compensation never enters a later boundary reconstruction', async () => {
      const tree = make();
      undoable(() => tree.$.z(1));
      await flush();
      const pending = tree.transact(() => undoable(() => tree.$.y(1)));
      await flush();
      pending.rollback();
      await flush();
      undoable(() => tree.$.z(2));
      await flush();
      expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
        expect.objectContaining({ y: 0, z: 1 }),
        expect.objectContaining({ y: 0, z: 2 }),
      ]);
      tree.jumpTo(0);
      expect([tree.$.y(), tree.$.z()]).toEqual([0, 1]);
    });

    it('external plain-branch membership stays outside an authored turn', async () => {
      const tree = signalTree(
        { x: 0, profile: { n: 1 } as { n?: number } },
        { enhancers: enhancers() }
      );
      owned.push(tree);
      external(() => tree.$.profile({}));
      undoable(() => tree.$.x(1));
      await flush();
      tree.undo();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.profile()).toEqual({});
      expect('n' in tree.$.profile()).toBe(false);
    });
  }
);
