// Replays one sequence against one subject and records every step.
import { missingPlugins, patternOf, type ErrorInfo, type Outcome, type Sequence, type StepRecord, type Trace } from './model.js';
import { describeError, type Subject } from './subject.js';

/**
 * Ends the current turn: setImmediate runs only after the microtask queue is
 * empty, so every microtask the step scheduled (and those they schedule) has
 * run. No timer, no clock.
 */
export const drain = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

let asyncSink: ErrorInfo[] | undefined;
const strayAsyncErrors: ErrorInfo[] = [];

/**
 * Records errors thrown asynchronously (an implementation rethrowing from a
 * microtask) against the step that was running. Without it such an error
 * crashes the process. Returns the uninstaller.
 */
export function installAsyncErrorCapture(): () => void {
  const record = (thrown: unknown) => {
    (asyncSink ?? strayAsyncErrors).push(describeError(thrown));
  };
  process.on('uncaughtException', record);
  process.on('unhandledRejection', record);
  return () => {
    process.off('uncaughtException', record);
    process.off('unhandledRejection', record);
  };
}

/** Async errors raised while no sequence was running; non-empty means the harness itself is unsound. */
export function takeStrayAsyncErrors(): ErrorInfo[] {
  return strayAsyncErrors.splice(0);
}

const isPromise = (value: unknown): value is Promise<Outcome> =>
  typeof (value as { then?: unknown } | null)?.then === 'function';

export async function runSequence(subject: Subject, sequence: Sequence): Promise<Trace> {
  const records: StepRecord[] = [];
  const buffer: ErrorInfo[] = [];
  asyncSink = buffer;
  const session = subject.open(sequence.config);
  try {
    for (const [index, step] of sequence.steps.entries()) {
      const missing = missingPlugins(step.op, sequence.config);
      let outcome: Outcome;
      if (missing.length) {
        outcome = { status: 'skipped', detail: `needs ${missing.join(', ')}` };
      } else {
        const applied = session.apply(step.op);
        outcome = isPromise(applied) ? await applied : applied;
      }
      if (!step.sameTick) await drain();
      records.push({
        index,
        label: patternOf(step.op),
        outcome,
        observation: session.observe(),
        asyncErrors: buffer.splice(0),
      });
    }
    await drain();
    records.push({
      index: sequence.steps.length,
      label: 'end',
      outcome: { status: 'ok' },
      observation: session.observe(),
      asyncErrors: buffer.splice(0),
    });
  } finally {
    session.close();
    await drain();
    asyncSink = undefined;
  }
  return records;
}
