// T6 | A row the transaction rekeyed and a later write by another writer
// context deleted is superseded: rollback reverses the rest of the turn
//
// The transaction rekeyed a row (changeId from -> to: before it, `from` was
// listed and `to` was not; after it, the reverse). Later another writer
// removed the row under `to`. "Another writer" is read as newer truth: a
// write inside external() or an inbound link value. When every later write on
// the transaction's locations is such a removal (rollback.ts reads which
// writes touch them; a rekey touches the existence of both keys), the
// rollback succeeds, every other location the transaction changed returns to
// its value before it, and the deleted row is absent under both keys.
import { analyze, hasRow } from './analysis.js';
import { rollbackContexts, rollbackOutcome, supersededOnly } from './rollback.js';
import { completedRest } from './t5.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'A row the transaction rekeyed and a later write by another writer context deleted is superseded: rollback reverses the rest of the turn';

export const T6 = instanceProperty({
  id: 'T6',
  row: ROW,
  reason:
    '"Another writer" is read as a write inside external() or an inbound link value; the published packages have no writer identity.',
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
          removed.has(w.to)
      );
      if (!rekey || rekey.kind !== 'changeId') continue;
      const gone = new Set<string>([...removed, rekey.from, rekey.to]);
      const rest = completedRest(analysis, ctx, gone, new Set());
      if (!rest) continue;
      const observed = rollbackOutcome(ctx, analysis);
      const ok = observed.status === 'ok' && rest.restored;
      found.push(
        verdict(
          ok,
          ctx.step,
          observed.status === 'ok' ? 'rest-not-reversed' : 'rollback-refused',
          { status: 'ok', state: rest.expected },
          { ...observed, state: rest.observed },
          `rollback(tx${ctx.tx.index}) after the row it rekeyed ${rekey.from}->${rekey.to} was deleted by newer truth`
        )
      );
    }
    return found;
  },
});
