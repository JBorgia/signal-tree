// X1 | Every refusal and error the library throws is a typed error, never a
// plain Error, carrying an [ST####] code from the published code table and
// naming its cause; once released, a code keeps its meaning and its message
//
// Checks the second clause. A refusal is a rollback of a pending transaction
// that throws, or an undo() or redo() that throws. Expected: the error is of
// a library-specific class (not a built-in like Error or TypeError) and names
// its cause.
import { analyze, txStatus } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'Every refusal and error the library throws is a typed error, never a plain Error, carrying an [ST####] code from the published code table and naming its cause; once released, a code keeps its meaning and its message';

const BUILT_IN = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
  'non-error',
]);

export const X1 = instanceProperty({
  id: 'X1',
  row: ROW,
  reason: 'Code and message stability is not checked: the spec lists no codes or messages to hold them to.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const s of analysis.steps) {
      if (s.outcome.status !== 'error') continue;
      const refusal =
        s.op.kind === 'undo' ||
        s.op.kind === 'redo' ||
        (s.op.kind === 'rollback' &&
          s.tx !== undefined &&
          analysis.txs[s.tx] !== undefined &&
          txStatus(analysis.txs[s.tx]!, s.index) === 'pending');
      if (!refusal) continue;
      const e = s.outcome.error;
      const typed = !BUILT_IN.has(e.class);
      const named = !!e.causeKind;
      found.push(
        verdict(
          typed && named,
          s.index,
          !typed ? 'untyped-refusal' : 'unnamed-cause',
          { typed: true, cause: 'named' },
          { class: e.class, cause: e.causeKind ?? null, message: e.message },
          `${s.op.kind} refused at step ${s.index}`
        )
      );
    }
    return found;
  },
});
