// Differential run: generate sequences, replay each against both subjects,
// group the first uncovered divergence of every sequence, then shrink one
// example per group to a minimal counterexample.
//
// Pass 1 runs fast-check with a property that always holds and records what
// each run index produced. Pass 2 replays, for each group, the first run that
// produced it (same seed, `path` = that run index) with a property that fails
// only for that group, so fast-check shrinks within the group.
import fc from 'fast-check';
import { compareTraces, type Comparison, type Divergence } from './compare.js';
import { generationKinds, sequenceArb, type PluginMode } from './generate.js';
import type { IntendedDifference } from './intended.js';
import { coverage } from './intended.js';
import type { Sequence, Trace } from './model.js';
import { runSequence } from './run.js';
import type { Subject } from './subject.js';

export interface OracleOptions {
  readonly a: Subject;
  readonly b: Subject;
  readonly runs: number;
  readonly seed: number;
  readonly plugins?: PluginMode;
  readonly maxSteps?: number;
  readonly intended?: readonly IntendedDifference[];
  /** Property evaluations allowed per group while shrinking. Deterministic, unlike a time limit. */
  readonly shrinkBudget?: number;
  readonly onProgress?: (done: number, total: number) => void;
}

export interface GroupExample {
  readonly seed: number;
  /** fast-check replay path of the shrunk counterexample. */
  readonly path: string;
  /** Whether shrinking reproduced the group (false: the example is the original run, unshrunk). */
  readonly shrunk: boolean;
  readonly shrinkRuns: number;
  /** Steps in the fast-check counterexample the path replays, before trimming. */
  readonly fastCheckSteps: number;
  /** The minimal sequence: the fast-check counterexample after trimming. */
  readonly sequence: Sequence;
  readonly divergence: Divergence;
}

export interface DifferenceGroup {
  readonly key: string;
  readonly pattern: string;
  readonly field: string;
  readonly count: number;
  /** Run index of the first sequence in this group. */
  readonly firstRun: number;
  readonly example: GroupExample;
}

export interface OracleResult {
  readonly a: string;
  readonly b: string;
  readonly runs: number;
  readonly seed: number;
  readonly plugins: PluginMode;
  readonly maxSteps: number;
  /** Sequences whose divergences were all covered by intended differences. */
  readonly coveredRuns: number;
  /** Intended-difference keys seen, with counts. */
  readonly coveredKeys: ReadonlyMap<string, number>;
  /** Uncovered difference groups, most frequent first. */
  readonly groups: readonly DifferenceGroup[];
  readonly compareMs: number;
  readonly shrinkMs: number;
}

export async function compareSubjects(
  a: Subject,
  b: Subject,
  sequence: Sequence,
  covers?: Parameters<typeof compareTraces>[2]
): Promise<{ comparison: Comparison; traces: [Trace, Trace] }> {
  const ta = await runSequence(a, sequence);
  const tb = await runSequence(b, sequence);
  return { comparison: compareTraces(ta, tb, covers), traces: [ta, tb] };
}

export function arbitraryFor(options: Pick<OracleOptions, 'a' | 'b' | 'plugins' | 'maxSteps'>) {
  return sequenceArb({
    kinds: generationKinds(options.a, options.b),
    plugins: options.plugins ?? 'any',
    maxSteps: options.maxSteps ?? 30,
  });
}

export async function runOracle(options: OracleOptions): Promise<OracleResult> {
  const { a, b, runs, seed } = options;
  const plugins = options.plugins ?? 'any';
  const maxSteps = options.maxSteps ?? 30;
  const covers = coverage(options.intended ?? [], a.name, b.name);
  const arb = arbitraryFor(options);

  const groups = new Map<string, { count: number; firstRun: number; sequence: Sequence; divergence: Divergence }>();
  const coveredKeys = new Map<string, number>();
  let coveredRuns = 0;
  let index = 0;

  const started = performance.now();
  const counted = await fc.check(
    fc.asyncProperty(arb, async (sequence) => {
      const run = index++;
      const { comparison } = await compareSubjects(a, b, sequence, covers);
      for (const d of comparison.covered) coveredKeys.set(d.key, (coveredKeys.get(d.key) ?? 0) + 1);
      if (comparison.uncovered) {
        const d = comparison.uncovered;
        const group = groups.get(d.key);
        if (group) group.count++;
        else groups.set(d.key, { count: 1, firstRun: run, sequence, divergence: d });
      } else if (comparison.covered.length) {
        coveredRuns++;
      }
      options.onProgress?.(run + 1, runs);
      return true;
    }),
    { seed, numRuns: runs }
  );
  if (counted.failed) throw new Error(`comparison pass failed unexpectedly: ${String(counted.errorInstance)}`);
  const compareMs = performance.now() - started;

  const shrinkStarted = performance.now();
  const results: DifferenceGroup[] = [];
  for (const [key, group] of groups) {
    const example = await shrinkGroup(options, arb, key, group, covers);
    const [pattern, field] = key.split(' | ') as [string, string];
    results.push({ key, pattern, field, count: group.count, firstRun: group.firstRun, example });
  }
  results.sort((x, y) => y.count - x.count || x.firstRun - y.firstRun);

  return {
    a: a.name,
    b: b.name,
    runs,
    seed,
    plugins,
    maxSteps,
    coveredRuns,
    coveredKeys,
    groups: results,
    compareMs,
    shrinkMs: performance.now() - shrinkStarted,
  };
}

async function shrinkGroup(
  options: OracleOptions,
  arb: fc.Arbitrary<Sequence>,
  key: string,
  group: { firstRun: number; sequence: Sequence; divergence: Divergence },
  covers: Parameters<typeof compareTraces>[2]
): Promise<GroupExample> {
  const budget = options.shrinkBudget ?? 400;
  let evaluations = 0;
  let best: { sequence: Sequence; divergence: Divergence } | undefined;
  const details = await fc.check(
    fc.asyncProperty(arb, async (sequence) => {
      // Past the budget every candidate "passes", which ends shrinking at the best found so far.
      if (evaluations++ >= budget) return true;
      const { comparison } = await compareSubjects(options.a, options.b, sequence, covers);
      if (comparison.uncovered?.key !== key) return true;
      best = { sequence, divergence: comparison.uncovered };
      return false;
    }),
    { seed: options.seed, path: String(group.firstRun), numRuns: 1, endOnFailure: false }
  );
  const shrunk = details.failed && best !== undefined && details.counterexamplePath !== null;
  const start = shrunk && best ? best : { sequence: group.sequence, divergence: group.divergence };
  const trimmed = await trim(options, key, start, covers, budget);
  return {
    seed: options.seed,
    path: shrunk ? (details.counterexamplePath as string) : String(group.firstRun),
    shrunk,
    shrinkRuns: shrunk ? details.numShrinks : 0,
    fastCheckSteps: start.sequence.steps.length,
    sequence: trimmed.sequence,
    divergence: trimmed.divergence,
  };
}

/**
 * fast-check shrinks arrays mostly by dropping leading items, so steps after
 * the divergence, or single steps in the middle, can survive. This removes
 * them, then turns off plugins and same-tick flags the difference does not
 * need, keeping each change only if the same group still reproduces.
 */
async function trim(
  options: OracleOptions,
  key: string,
  start: { sequence: Sequence; divergence: Divergence },
  covers: Parameters<typeof compareTraces>[2],
  budget: number
): Promise<{ sequence: Sequence; divergence: Divergence }> {
  let best = start;
  let evaluations = 0;
  const attempt = async (candidate: Sequence): Promise<boolean> => {
    if (candidate.steps.length === 0 || evaluations++ >= budget) return false;
    const { comparison } = await compareSubjects(options.a, options.b, candidate, covers);
    if (comparison.uncovered?.key !== key) return false;
    best = { sequence: candidate, divergence: comparison.uncovered };
    return true;
  };
  const { config } = best.sequence;
  await attempt({ config, steps: best.sequence.steps.slice(0, best.divergence.step + 1) });
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = best.sequence.steps.length - 1; i >= 0; i--) {
      const steps = best.sequence.steps.filter((_, j) => j !== i);
      if (await attempt({ config: best.sequence.config, steps })) changed = true;
    }
  }
  for (const plugin of ['transactions', 'restoration'] as const) {
    if (best.sequence.config[plugin]) {
      await attempt({ config: { ...best.sequence.config, [plugin]: false }, steps: best.sequence.steps });
    }
  }
  for (let i = 0; i < best.sequence.steps.length; i++) {
    const step = best.sequence.steps[i] as Sequence['steps'][number];
    if (!step.sameTick) continue;
    const steps = best.sequence.steps.map((s, j) => (j === i ? { ...s, sameTick: false } : s));
    await attempt({ config: best.sequence.config, steps });
  }
  return best;
}

/** Replays one sequence and returns both traces. */
export async function replaySequence(
  options: Pick<OracleOptions, 'a' | 'b' | 'intended'>,
  sequence: Sequence
): Promise<{ sequence: Sequence; comparison: Comparison; traces: [Trace, Trace] }> {
  const covers = coverage(options.intended ?? [], options.a.name, options.b.name);
  return { sequence, ...(await compareSubjects(options.a, options.b, sequence, covers)) };
}

/** Replays one fast-check path (as printed in a report) and returns both traces. */
export async function replay(
  options: Pick<OracleOptions, 'a' | 'b' | 'seed' | 'plugins' | 'maxSteps' | 'intended'>,
  path: string
): Promise<{ sequence: Sequence; comparison: Comparison; traces: [Trace, Trace] }> {
  const covers = coverage(options.intended ?? [], options.a.name, options.b.name);
  let captured: Sequence | undefined;
  await fc.check(
    fc.property(arbitraryFor(options), (sequence) => {
      captured = sequence;
      return true;
    }),
    { seed: options.seed, path, numRuns: 1 }
  );
  if (!captured) throw new Error(`path ${path} produced no sequence`);
  return { sequence: captured, ...(await compareSubjects(options.a, options.b, captured, covers)) };
}
