// T4 | Rolling back a transaction refuses with cause later-confirmed-dependency
// and changes nothing when any later confirmed write touched a location it
// changed, except a removal that T5 classifies as supersession. A location is a
// scalar leaf, a row field, or a row's existence (its key and presence). A
// write to a row field touches that field only. Adding, removing, replacing or
// rekeying a row, and setAll or clear, touch that row's existence, which every
// field of the row depends on. A write the seam skips as unchanged is not a
// write and never counts. Every such write counts, including one that did not
// read the value, wrote the same value, re-inserted a removed key, replaced the
// collection (setAll, clear), ran in the same turn as the rollback call, or
// came from a link; the rollback's own compensation never counts (T7)
//
// Applies at a rollback of a pending transaction when a later confirmed
// write touched one of its locations (rollback.ts reads the location rules):
// an ordinary or external write, a write through a held row handle, an
// inbound link value, or a newer transaction confirmed before the rollback.
// Every touch counts except a removal by newer truth (external() or an
// inbound link value), which T5 classifies as supersession; a primitive
// written equal to the value it replaces is skipped by the seam and is not a
// write. Where newer truth removed a row and other later writes also touched
// the transaction's locations, the removal is supersession and the other
// writes are judged as usual: any one of them that touched a location the
// transaction changed (in that row or elsewhere, before or after the removal)
// still requires the refusal. Expected: refused with cause
// later-confirmed-dependency. Skipped when a newer transaction on its
// locations is still pending (T3 names that cause) or rollback.ts finds the
// context ambiguous.
import { analyze } from './analysis.js';
import { dependents, rollbackContexts, rollbackOutcome } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "Rolling back a transaction refuses with cause later-confirmed-dependency and changes nothing when any later confirmed write touched a location it changed, except a removal that T5 classifies as supersession. A location is a scalar leaf, a row field, or a row's existence (its key and presence). A write to a row field touches that field only. Adding, removing, replacing or rekeying a row, and setAll or clear, touch that row's existence, which every field of the row depends on. A write the seam skips as unchanged is not a write and never counts. Every such write counts, including one that did not read the value, wrote the same value, re-inserted a removed key, replaced the collection (setAll, clear), ran in the same turn as the rollback call, or came from a link; the rollback's own compensation never counts (T7)";

export const T4 = instanceProperty({
  id: 'T4',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0) continue;
      const deps = dependents(ctx);
      if (deps.length === 0) continue;
      const observed = rollbackOutcome(ctx, analysis);
      const ok = observed.status === 'refused' && observed.cause === 'later-confirmed-dependency';
      found.push(
        verdict(
          ok,
          ctx.step,
          observed.status === 'refused' ? `cause-${observed.cause ?? 'none'}` : 'rollback-completed',
          { status: 'refused', cause: 'later-confirmed-dependency' },
          observed,
          `rollback(tx${ctx.tx.index}) after ${deps.map((d) => `${d.by} at step ${d.step}`).join(', ')} touched ${[
            ...new Set(deps.flatMap((d) => [...d.locs])),
          ].join(', ')}`
        )
      );
    }
    return found;
  },
});
