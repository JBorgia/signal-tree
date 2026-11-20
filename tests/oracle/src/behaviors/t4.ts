// T4 | Rolling back a transaction refuses with cause later-confirmed-dependency
// and changes nothing when any later confirmed write touched a location it
// changed. A location is a scalar leaf, a row field, or a row's existence (its
// key and presence). A write to a row field touches that field only. Adding,
// removing, replacing or rekeying a row, and setAll or clear, touch that row's
// existence, which every field of the row depends on. A write the seam skips as
// unchanged is not a write and never counts. Every such write counts, including
// one that did not read the value, wrote the same value, re-inserted a removed
// key, replaced the collection (setAll, clear), ran in the same turn as the
// rollback call, or came from a link; the rollback's own compensation never
// counts (T7)
//
// A later confirmed write (an ordinary or external write, or a newer
// transaction confirmed before the rollback) depends on the change when it
// updated a row the transaction changed (T5: "updated it (depends)") or read
// and rewrote a leaf it changed (updateLeaf). Applies only when no newer
// overlapping transaction is pending (T3 names that cause) and no later write
// is one the rows leave unclassified (see rollback.ts).
import { analyze } from './analysis.js';
import { dependents, involvesRekey, rollbackContexts, rollbackOutcome, unclassified } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "Rolling back a transaction refuses with cause later-confirmed-dependency and changes nothing when any later confirmed write touched a location it changed. A location is a scalar leaf, a row field, or a row's existence (its key and presence). A write to a row field touches that field only. Adding, removing, replacing or rekeying a row, and setAll or clear, touch that row's existence, which every field of the row depends on. A write the seam skips as unchanged is not a write and never counts. Every such write counts, including one that did not read the value, wrote the same value, re-inserted a removed key, replaced the collection (setAll, clear), ran in the same turn as the rollback call, or came from a link; the rollback's own compensation never counts (T7)";

export const T4 = instanceProperty({
  id: 'T4',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0 || unclassified(ctx).length > 0) continue;
      const deps = dependents(ctx);
      if (deps.length === 0) continue;
      const observed = rollbackOutcome(ctx, analysis);
      const rekey = involvesRekey(analysis, ctx) ? '-rekey' : '';
      const ok = observed.status === 'refused' && observed.cause === 'later-confirmed-dependency';
      found.push(
        verdict(
          ok,
          ctx.step,
          (observed.status === 'refused' ? `cause-${observed.cause ?? 'none'}` : 'rollback-completed') + rekey,
          { status: 'refused', cause: 'later-confirmed-dependency' },
          observed,
          `rollback(tx${ctx.tx.index}) after confirmed writes at step ${deps.map((d) => d.step).join(', ')} that depend on ${[
            ...new Set(deps.flatMap((d) => [...d.depends])),
          ].join(', ')}`
        )
      );
    }
    return found;
  },
});
