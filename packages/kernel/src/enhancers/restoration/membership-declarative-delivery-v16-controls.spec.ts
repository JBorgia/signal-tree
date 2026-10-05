import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from '../../lib/internals/entity-membership-view';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * v16 control (v15 → v16 integration, slice 6). Reversals that carry an order
 * delta install through a DECLARATIVE target (restoration's and the
 * transaction rollback's), not through the realization adapter the donor
 * delivery fixture exercises. Membership listeners must still run only after
 * every collection of the reversal has installed, so a listener's reentrant
 * write is delivered after the reversal's deltas, in commit order.
 */
type Row = { id: string; n: number };
const row = (id: string): Row => ({ id, n: 0 });
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)('declarative reversal delivery (%s)', (_order, enhancers) => {
  for (const via of ['undo', 'rollback'] as const)
    it(`a listener's reentrant write queues after every collection's delta (${via})`, async () => {
      const tree = signalTree(
        { left: entityMap<Row, string>(), right: entityMap<Row, string>() },
        { enhancers: enhancers() }
      );
      try {
        tree.$.left.setAll([row('a'), row('b'), row('c')]);
        tree.$.right.setAll([row('x'), row('y')]);
        await flush();
        const reorder = () => {
          tree.$.left.setAll([row('c'), row('b'), row('a')]);
          tree.$.right.setAll([row('y'), row('x')]);
        };
        let pending: { rollback(): void } | undefined;
        if (via === 'undo') {
          undoable(reorder);
          await flush();
        } else pending = tree.transact(reorder);
        const reader = entityMembershipReader(tree)!;
        const seen: string[] = [];
        let armed = true;
        reader.subscribe((event: EntityMembershipEvent) => {
          seen.push(
            `${event.collection.path}:${event.changes
              .map((change) => change.kind)
              .join('+')}`
          );
          if (!armed) return;
          armed = false;
          tree.$.right.removeOne('x');
        });
        if (via === 'undo') tree.undo();
        else pending!.rollback();
        await flush();
        expect(seen).toEqual(['left:reorder', 'right:reorder', 'right:remove']);
        expect(tree.$.left.ids()).toEqual(['a', 'b', 'c']);
        expect(tree.$.right.ids()).toEqual(['y']);
      } finally {
        tree.destroy();
      }
    });
});
