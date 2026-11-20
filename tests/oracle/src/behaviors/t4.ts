// T4 | A later confirmed write that depends on the change refuses with
// later-confirmed-dependency
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

export const ROW = 'A later confirmed write that depends on the change refuses with later-confirmed-dependency';

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
