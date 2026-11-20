// T7 | A rollback's own compensation is never filed as a dependency, so
// out-of-order rollbacks still succeed
//
// Applies to a rollback of a pending transaction whose locations were
// touched afterwards (T4's locations, rollback.ts) only by rolling back newer
// transactions (their compensation), with nothing newer still pending on
// them. Expected: the rollback succeeds.
import { analyze } from './analysis.js';
import { rollbackContexts, rollbackOutcome } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "A rollback's own compensation is never filed as a dependency, so out-of-order rollbacks still succeed";

export const T7 = instanceProperty({
  id: 'T7',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      if (ctx.compensations.length === 0) continue;
      if (ctx.pendingNewer.length > 0 || ctx.later.length > 0 || ctx.ambiguous.length > 0) continue;
      const observed = rollbackOutcome(ctx, analysis);
      found.push(
        verdict(
          observed.status === 'ok',
          ctx.step,
          observed.status === 'refused' ? `cause-${observed.cause ?? 'none'}` : 'rollback-failed',
          { status: 'ok' },
          observed,
          `rollback(tx${ctx.tx.index}) after compensation at step ${ctx.compensations.join(', ')}`
        )
      );
    }
    return found;
  },
});
