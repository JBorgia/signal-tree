// Determinism self-check: replaying one sequence twice on one subject must
// give identical traces. Otherwise a property verdict could flip between
// runs, and a case's provenance would not be reproducible.
import fc from 'fast-check';
import { generationKinds, sequenceArb, type PluginMode } from './generate.js';
import type { Sequence, StepRecord } from './model.js';
import { runSequence } from './run.js';
import type { Subject } from './subject.js';
import { firstMismatch } from './trace.js';

export interface DeterminismOptions {
  readonly subject: Subject;
  readonly runs: number;
  readonly seed: number;
  readonly plugins?: PluginMode;
  readonly maxSteps?: number;
  readonly onProgress?: (done: number, total: number) => void;
}

export interface DeterminismResult {
  readonly subject: string;
  readonly runs: number;
  readonly seed: number;
  readonly mismatches: number;
  /** The first sequence whose replays differed, and the first differing record. */
  readonly first?: {
    readonly run: number;
    readonly sequence: Sequence;
    readonly record: number;
    readonly a: StepRecord | null;
    readonly b: StepRecord | null;
  };
  readonly ms: number;
}

export async function checkDeterminism(options: DeterminismOptions): Promise<DeterminismResult> {
  const { subject, runs, seed } = options;
  const arb = sequenceArb({
    kinds: generationKinds([subject]),
    plugins: options.plugins ?? 'any',
    maxSteps: options.maxSteps ?? 30,
  });
  let index = 0;
  let mismatches = 0;
  let first: DeterminismResult['first'];
  const started = performance.now();
  const pass = await fc.check(
    fc.asyncProperty(arb, async (sequence) => {
      const run = index++;
      const a = await runSequence(subject, sequence);
      const b = await runSequence(subject, sequence);
      const at = firstMismatch(a, b);
      if (at >= 0) {
        mismatches++;
        first ??= { run, sequence, record: at, a: a[at] ?? null, b: b[at] ?? null };
      }
      options.onProgress?.(run + 1, runs);
      return true;
    }),
    // A failure here is a harness error, not a mismatch; report it as is, without shrinking.
    { seed, numRuns: runs, endOnFailure: true }
  );
  if (pass.failed) throw pass.errorInstance ?? new Error('determinism pass failed');
  return { subject: subject.name, runs, seed, mismatches, ...(first ? { first } : {}), ms: performance.now() - started };
}
