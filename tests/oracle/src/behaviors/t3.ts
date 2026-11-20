// T3 | Rolling back an older transaction while a newer pending transaction has
// written a location the older one changed (as defined in T4) refuses with
// cause later-pending-dependency and changes nothing; rolling back the newer
// one first, then the older, succeeds
//
// Overlapping: both transactions changed a common location. Three checks:
// (a) rollback of the older while the newer is pending refuses with cause
//     later-pending-dependency;
// (b) rollback of the newer while the older is pending succeeds, when nothing
//     but the newer transaction touched the older one's locations;
// (c) rollback of the older after the newer was rolled back succeeds.
// Each applies only when no later confirmed write and nothing else the rows
// leave open touched the rolled-back transaction's locations, so T4 (a later
// confirmed write) never names a different cause for the same rollback.
import { analyze, intersects, txStatus } from './analysis.js';
import { contextAt, involvesRekey, rollbackContexts, rollbackOutcome, writesWholeCollection } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'Rolling back an older transaction while a newer pending transaction has written a location the older one changed (as defined in T4) refuses with cause later-pending-dependency and changes nothing; rolling back the newer one first, then the older, succeeds';

export const T3 = instanceProperty({
  id: 'T3',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      if (ctx.later.length > 0 || ctx.ambiguous.length > 0) continue;
      const observed = rollbackOutcome(ctx, analysis);
      const rekey = involvesRekey(analysis, ctx) ? '-rekey' : '';
      const tx = `tx${ctx.tx.index}`;
      if (ctx.pendingNewer.length > 0) {
        const ok = observed.status === 'refused' && observed.cause === 'later-pending-dependency';
        found.push(
          verdict(
            ok,
            ctx.step,
            (observed.status === 'refused' ? `cause-${observed.cause ?? 'none'}` : 'rollback-completed') + rekey,
            { status: 'refused', cause: 'later-pending-dependency' },
            observed,
            `rollback(${tx}) while newer overlapping tx${ctx.pendingNewer.map((t) => t.index).join(', tx')} is pending`
          )
        );
        continue;
      }
      // The row's scenario: the older one's locations were touched by the newer one and nothing else.
      const olderPending = analysis.txs.some((older) => {
        if (older.step >= ctx.tx.step || txStatus(older, ctx.step) !== 'pending') return false;
        if (writesWholeCollection(older) || !intersects(older.changed, ctx.tx.changed)) return false;
        const its = contextAt(analysis, older, ctx.step);
        return (
          its.ambiguous.length === 0 &&
          its.later.length === 0 &&
          its.compensations.length === 0 &&
          its.rolledBackNewer.length === 0 &&
          its.pendingNewer.length === 1 &&
          its.pendingNewer[0] === ctx.tx
        );
      });
      if (olderPending) {
        found.push(
          verdict(
            observed.status === 'ok',
            ctx.step,
            `newer-rollback-refused${rekey}`,
            { status: 'ok' },
            observed,
            `rollback(${tx}), the newer of two overlapping pending transactions`
          )
        );
      } else if (ctx.rolledBackNewer.length > 0) {
        found.push(
          verdict(
            observed.status === 'ok',
            ctx.step,
            `older-rollback-refused${rekey}`,
            { status: 'ok' },
            observed,
            `rollback(${tx}) after the newer overlapping tx${ctx.rolledBackNewer.map((t) => t.index).join(', tx')} was rolled back`
          )
        );
      }
    }
    return found;
  },
});
