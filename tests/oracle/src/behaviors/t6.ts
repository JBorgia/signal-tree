// T6 | A rekeyed row later deleted by another writer: rollback reverses the
// rest of the turn
//
// The transaction rekeyed a row (changeId from -> to: before it, `from` was
// listed and `to` was not; after it, the reverse). Later another writer
// removed the row under `to`. "Another writer" is read as a write inside
// external(), the vocabulary's only other author. When every later write to
// the transaction's locations is such a removal, the rollback succeeds,
// every other location the transaction changed returns to its value before
// it, and the deleted row is absent under both keys.
import { analyze, hasRow, rowLoc } from './analysis.js';
import { rollbackContexts, rollbackOutcome } from './rollback.js';
import { completedRest, supersededOnly } from './t5.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW = 'A rekeyed row later deleted by another writer: rollback reverses the rest of the turn';

export const T6 = instanceProperty({
  id: 'T6',
  row: ROW,
  reason: '"Another writer" is read as a write inside external(); the published packages have no writer identity.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      const removed = supersededOnly(ctx);
      if (!removed) continue;
      const opened = analysis.steps[ctx.tx.step];
      if (!opened) continue;
      const rekey = ctx.tx.body.find(
        (w) =>
          w.kind === 'changeId' &&
          w.from !== w.to &&
          hasRow(opened.before, w.from) === true &&
          hasRow(opened.before, w.to) === false &&
          hasRow(opened.after, w.from) === false &&
          hasRow(opened.after, w.to) === true &&
          removed.has(rowLoc(w.to))
      );
      if (!rekey || rekey.kind !== 'changeId') continue;
      const gone = new Set([...removed, rowLoc(rekey.from), rowLoc(rekey.to)]);
      const rest = completedRest(analysis, ctx, gone);
      if (!rest) continue;
      const observed = rollbackOutcome(ctx, analysis);
      const ok = observed.status === 'ok' && rest.ok;
      found.push(
        verdict(
          ok,
          ctx.step,
          observed.status === 'ok' ? 'rest-not-reversed' : 'rollback-refused',
          { status: 'ok', state: rest.expected },
          { ...observed, state: rest.observed },
          `rollback(tx${ctx.tx.index}) after the row it rekeyed ${rekey.from}->${rekey.to} was deleted by external()`
        )
      );
    }
    return found;
  },
});
