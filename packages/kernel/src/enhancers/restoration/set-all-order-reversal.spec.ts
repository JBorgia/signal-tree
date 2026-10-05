import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Reproduced against npm 15.3.1: a setAll() that both changes membership and
// reorders the surviving rows was reversed to the wrong order, silently.
// [a,b,c] -> setAll([c,a]) -> undo or rollback gave [b,c,a].
//
// Carried from v15 012fd11d (v16 integration slice 5): `.transaction(` ->
// `.transact(`. The donor's rollback case also compared the 15.4.0
// `entityMembershipReader` snapshot with the physical order. That reader is
// slice 6; the unmodified donor is preserved as
// docs/audits/2026-10-01-v16-integration/preserved/set-all-order-reversal.spec.ts.txt
// and its membership assertion returns with the reader. The physical order,
// values and redo below are unchanged.
type Row = { id: string; n: number };
const row = (id: string, n = 0): Row => ({ id, n });
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const NEXT: Record<string, readonly string[]> = {
  'remove one, reorder survivors': ['c', 'a'],
  'remove one, swap survivors': ['b', 'a'],
  'add one, reorder survivors': ['c', 'q', 'a', 'b'],
  'add and remove, reorder survivors': ['q', 'c', 'a'],
  'replace, keep survivor order': ['q', 'a'],
  'remove all': [],
  'keep only the middle': ['b'],
  'replace all': ['x', 'y'],
  'pure reverse': ['c', 'b', 'a'],
};
const ORDERS = [
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const;

describe.each(ORDERS)(
  'setAll reversal restores order (%s)',
  (_order, enhancers) => {
    const make = () =>
      signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhancers() }
      );
    for (const [name, next] of Object.entries(NEXT)) {
      it(`undo and redo: ${name}`, async () => {
        const tree = make();
        try {
          tree.$.rows.setAll(['a', 'b', 'c'].map((id) => row(id)));
          await flush();
          undoable(() => tree.$.rows.setAll(next.map((id) => row(id, 1))));
          await flush();
          expect(tree.$.rows.ids()).toEqual(next);
          tree.undo();
          expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
          expect(tree.$.rows.all().map(({ n }) => n)).toEqual([0, 0, 0]);
          tree.redo();
          expect(tree.$.rows.ids()).toEqual(next);
        } finally {
          tree.destroy();
        }
      });

      it(`transaction rollback: ${name}`, async () => {
        const tree = make();
        try {
          tree.$.rows.setAll(['a', 'b', 'c'].map((id) => row(id)));
          await flush();
          const pending = tree.transact(() =>
            tree.$.rows.setAll(next.map((id) => row(id, 1)))
          );
          expect(tree.$.rows.ids()).toEqual(next);
          pending.rollback();
          expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
          expect(tree.$.rows.all().map(({ n }) => n)).toEqual([0, 0, 0]);
        } finally {
          tree.destroy();
        }
      });
    }
  }
);
