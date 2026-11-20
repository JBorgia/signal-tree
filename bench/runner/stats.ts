/**
 * Medians, A/A noise and baseline comparison (BRIEF 6.1).
 *
 * A/A noise of a metric: the scenario is run as two interleaved sets of runs
 * on the same code (A, B, A, B, ...). For a metric that never reads 0,
 * noise = |median(B) - median(A)| / |median(A)| (relative). For a metric that
 * reads 0 in either set, noise = |median(B) - median(A)| in the metric's own
 * unit (absolute), and comparisons use max(budgets.json noise floor, that).
 * With several A/A pairs the largest noise is kept.
 *
 * Regression: a median worse than the baseline by more than the larger of
 * REGRESSION_MIN_RELATIVE or the relative A/A noise; or, when the metric reads
 * 0 in the A/A sets or the baseline median is 0, an absolute worsening greater
 * than max(floor, absolute A/A noise). A metric in the baseline that is
 * missing now is a regression, and so is a needed floor that is missing.
 */
import type { MetricSpec, MetricValues } from './types.ts';

/** BRIEF 6.1: "Each scenario runs 5 times in fresh processes; the gate uses the median." */
export const RUNS_PER_SCENARIO = 5;
/** BRIEF 6.1: "worse than main by more than the larger of 3% or the A/A noise." */
export const REGRESSION_MIN_RELATIVE = 0.03;

export function median(values: readonly number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function medians(runs: readonly MetricValues[]): MetricValues {
  const keys = new Set(runs.flatMap((run) => Object.keys(run)));
  const out: MetricValues = {};
  for (const key of keys) {
    const value = median(runs.map((run) => run[key] ?? Number.NaN));
    if (Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export interface Noise {
  /** Relative noise of metrics that never read 0. */
  readonly relative: MetricValues;
  /** |median B - median A| of metrics that read 0 in either set, in their own unit. */
  readonly absolute: MetricValues;
  /** Metrics that read 0 in either set: compared in absolute terms. */
  readonly zero: readonly string[];
}

export const NO_NOISE: Noise = { relative: {}, absolute: {}, zero: [] };

export function aaNoise(aRuns: readonly MetricValues[], bRuns: readonly MetricValues[]): Noise {
  const a = medians(aRuns);
  const b = medians(bRuns);
  const relative: MetricValues = {};
  const absolute: MetricValues = {};
  const zero: string[] = [];
  for (const key of Object.keys(a)) {
    const right = b[key];
    if (right === undefined) continue;
    const readsZero = a[key] === 0 || right === 0 || [...aRuns, ...bRuns].some((run) => run[key] === 0);
    if (readsZero) {
      zero.push(key);
      absolute[key] = Math.abs(right - a[key]!);
    } else {
      relative[key] = Math.abs(right - a[key]!) / Math.abs(a[key]!);
    }
  }
  return { relative, absolute, zero };
}

/** The largest noise of several A/A pairs. */
export function mergeNoise(all: readonly Noise[]): Noise {
  const relative: MetricValues = {};
  const absolute: MetricValues = {};
  const zero = new Set<string>();
  for (const noise of all) {
    for (const [k, v] of Object.entries(noise.relative)) relative[k] = Math.max(relative[k] ?? 0, v);
    for (const [k, v] of Object.entries(noise.absolute)) absolute[k] = Math.max(absolute[k] ?? 0, v);
    for (const k of noise.zero) zero.add(k);
  }
  for (const k of zero) delete relative[k];
  return { relative, absolute, zero: [...zero] };
}

export interface Regression {
  readonly metric: string;
  readonly mode: 'relative' | 'absolute' | 'missing';
  readonly baseline: number;
  readonly current: number;
  /** Relative (mode 'relative') or absolute, in the metric's unit (mode 'absolute'). */
  readonly worseBy: number;
  readonly threshold: number;
  readonly regressed: boolean;
  readonly error?: string;
}

export function compareToBaseline(
  current: MetricValues,
  baseline: MetricValues,
  specs: Readonly<Record<string, MetricSpec>>,
  noise: Noise,
  floorOf: (metric: string) => number | undefined,
): Regression[] {
  const out: Regression[] = [];
  for (const [metric, spec] of Object.entries(specs)) {
    if (spec.better === 'none') continue;
    const before = baseline[metric];
    if (before === undefined) continue;
    const now = current[metric];
    if (now === undefined || !Number.isFinite(now)) {
      out.push({ metric, mode: 'missing', baseline: before, current: Number.NaN, worseBy: Number.NaN, threshold: 0, regressed: true, error: 'in the baseline but missing now' });
      continue;
    }
    const delta = spec.better === 'lower' ? now - before : before - now;
    if (before === 0 || noise.zero.includes(metric)) {
      const floor = floorOf(metric);
      if (floor === undefined) {
        out.push({ metric, mode: 'absolute', baseline: before, current: now, worseBy: delta, threshold: Number.NaN, regressed: true, error: 'reads 0 but budgets.json has no noise floor for it' });
        continue;
      }
      const threshold = Math.max(floor, noise.absolute[metric] ?? 0);
      out.push({ metric, mode: 'absolute', baseline: before, current: now, worseBy: delta, threshold, regressed: delta > threshold });
      continue;
    }
    const worseBy = delta / Math.abs(before);
    const threshold = Math.max(REGRESSION_MIN_RELATIVE, noise.relative[metric] ?? 0);
    out.push({ metric, mode: 'relative', baseline: before, current: now, worseBy, threshold, regressed: worseBy > threshold });
  }
  return out;
}
