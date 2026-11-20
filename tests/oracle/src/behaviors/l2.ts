// L2 | Conditional publication declarations: contributing pending owners,
// declared independence, or unknown completeness; PublicationReceipt.read();
// admission is not delivery; invalid declarations throw
// SignalTreePublicationError with stage and reason; a no-write receipt
// neither creates nor clears an obligation
//
// Checks the invalid-declaration clause: declaring with a kind the API does
// not define (`malformed`) throws SignalTreePublicationError carrying a stage
// and a reason.
import { analyze } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'Conditional publication declarations: contributing pending owners, declared independence, or unknown completeness; PublicationReceipt.read(); admission is not delivery; invalid declarations throw SignalTreePublicationError with stage and reason; a no-write receipt neither creates nor clears an obligation';

export const L2 = instanceProperty({
  id: 'L2',
  row: ROW,
  reason:
    'Only "invalid declarations throw SignalTreePublicationError with stage and reason" is checked; the spec defines no receipt or obligation fields for the other clauses.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const s of analysis.steps) {
      if (s.op.kind !== 'declare' || s.op.declaration !== 'malformed') continue;
      const { outcome } = s;
      if (outcome.status !== 'ok' && outcome.status !== 'error') continue;
      const expected = { status: 'error', class: 'SignalTreePublicationError', stage: 'present', reason: 'present' };
      if (outcome.status === 'ok') {
        found.push(verdict(false, s.index, 'accepted', expected, { status: 'ok' }, `invalid declaration at step ${s.index}`));
        continue;
      }
      const e = outcome.error;
      const observed = {
        status: 'error',
        class: e.class,
        stage: e.stage ? 'present' : 'missing',
        reason: e.reason ? 'present' : 'missing',
      };
      const ok = e.class === 'SignalTreePublicationError' && !!e.stage && !!e.reason;
      found.push(
        verdict(
          ok,
          s.index,
          e.class === 'SignalTreePublicationError' ? 'missing-stage-or-reason' : 'wrong-error',
          expected,
          observed,
          `invalid declaration at step ${s.index}`
        )
      );
    }
    return found;
  },
});
