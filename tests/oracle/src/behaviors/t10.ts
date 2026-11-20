// T10 | A throwing observer never strands transact(); observer errors reach
// onTreeError (at most 50 per tree per second) and [ST2034]
//
// The observer is the one observerOpen subscribes: it throws every time it is
// notified. At every step where it threw:
// (a) onTreeError received at least one event per throw, as long as the
//     sequence has seen no more than 50 throws in all (below the cap whatever
//     the timing; the cap itself needs a clock and is not tested);
// (b) [ST2034] is reported with them, on the onTreeError event or the console;
// (c) a transact() whose body only writes leaves and branches (writes that
//     cannot fail on their own) still returns its transaction, and a
//     confirm() of a pending one still succeeds.
import { analyze, outcomeSummary, txStatus } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'A throwing observer never strands transact(); observer errors reach onTreeError (at most 50 per tree per second) and [ST2034]';

const CAP = 50;
const SCALAR_WRITES = new Set(['setLeaf', 'updateLeaf', 'setBranch']);

export const T10 = instanceProperty({
  id: 'T10',
  row: ROW,
  reason: 'The per-second cap is not tested: a sequence makes fewer than 50 observer calls and has no clock.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    let total = 0;
    for (const s of analysis.steps) {
      const throws = s.observation.observerThrows;
      if (throws === 0) continue;
      total += throws;
      const { treeErrors, warnings } = s.observation;
      if (total <= CAP) {
        found.push(
          verdict(
            treeErrors.length >= throws,
            s.index,
            'not-reported',
            { onTreeErrorEvents: `at least ${throws}` },
            { onTreeErrorEvents: treeErrors.length },
            `the observer threw ${throws} time(s) at step ${s.index}`
          )
        );
      }
      const codes = [...treeErrors.map((e) => e.error.st), ...warnings.map((w) => w.st)].filter(Boolean);
      found.push(
        verdict(
          codes.includes('ST2034'),
          s.index,
          'no-ST2034',
          { code: 'ST2034' },
          { codes: codes as string[] },
          `observer error at step ${s.index} reported with [ST2034]`
        )
      );
      if (s.op.kind === 'transact' && s.op.body.every((w) => SCALAR_WRITES.has(w.kind))) {
        found.push(
          verdict(
            s.outcome.status === 'ok',
            s.index,
            'transact-stranded',
            { transact: 'ok' },
            { transact: outcomeSummary(s.outcome) },
            `transact() at step ${s.index} with a throwing observer`
          )
        );
      }
      if (s.op.kind === 'confirm' && s.tx !== undefined) {
        const tx = analysis.txs[s.tx];
        if (tx && txStatus(tx, s.index) === 'pending') {
          found.push(
            verdict(
              s.outcome.status === 'ok',
              s.index,
              'confirm-stranded',
              { confirm: 'ok' },
              { confirm: outcomeSummary(s.outcome) },
              `confirm(tx${tx.index}) at step ${s.index} with a throwing observer`
            )
          );
        }
      }
    }
    return found;
  },
});
