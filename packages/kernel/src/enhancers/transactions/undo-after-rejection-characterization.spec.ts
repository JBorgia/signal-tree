import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * CHARACTERIZATION, 15.4.2 — a documented limitation, not an endorsement.
 *
 * Linear undo restores the state the undone write replaced. When that write
 * landed while a transaction was pending, the replaced state can hold the
 * transaction's speculative value, so undoing it after the transaction was
 * rejected brings the rejected value back with no owning turn.
 *
 * Scalars already behaved this way before 15.4.2. Rows join them because a
 * pending-created row removed by settled later work no longer blocks rollback
 * (`proposal-rejection-0.spec.ts` case 12); before that, the rollback and the
 * undo both refused. Changing this needs a decision about undo semantics over
 * speculative state, which is out of scope for a 15.x fix. Any change here must
 * be deliberate and update the transaction-failures guide.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const orders = {
  'transactions, restoration': () => [transactions(), restoration()],
  'restoration, transactions': () => [restoration(), transactions()],
} as const;

describe.each(Object.entries(orders))(
  'undo after a rejection (%s)',
  (_, enhancers) => {
    it('scalar: undoing a later write restores the rejected value', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      await flush();

      const proposal = tree.transaction(() => {
        tree.$.x(1);
        tree.$.y(1);
      });
      await flush();

      undoable(() => tree.$.x(2));
      await flush();

      proposal.rollback();
      await flush();
      expect(tree.$.x()).toBe(2); // superseded by the later write
      expect(tree.$.y()).toBe(0);

      tree.undo();
      await flush();
      expect(tree.$.x()).toBe(1); // the rejected turn's speculative value
      expect(tree.$.y()).toBe(0);
    });

    it('row: undoing a later remove restores the rejected row', async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
        { enhancers: enhancers() }
      );
      await flush();

      const proposal = tree.transaction(() => {
        tree.$.x(1);
        tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
      });
      await flush();

      undoable(() => tree.$.rows.removeOne('A'));
      await flush();

      proposal.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.ids()).toEqual([]);

      tree.undo();
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.byId('A')?.()?.name).toBe('Proposed');
    });
  }
);
