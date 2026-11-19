/**
 * Medians, A/A noise and baseline comparison (BRIEF 6.1).
 *
 * A/A noise of a metric: the scenario is run as two interleaved sets of
 * RUNS_PER_SCENARIO fresh-process runs on the same code (A, B, A, B, ...);
 * noise = |median(B) - median(A)| / |median(A)|. With several A/A pairs the
 * largest is kept.
 *
 * Regression: a median worse than the baseline by more than the larger of
 * REGRESSION_MIN_RELATIVE or the metric's A/A noise.
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

export function aaNoise(a: MetricValues, b: MetricValues): MetricValues {
  const out: MetricValues = {};
  for (const key of Object.keys(a)) {
    const left = a[key]!;
    const right = b[key];
    if (right === undefined) continue;
    if (left === 0) out[key] = right === 0 ? 0 : Number.POSITIVE_INFINITY;
    else out[key] = Math.abs(right - left) / Math.abs(left);
  }
  return out;
}

export interface Regression {
  readonly metric: string;
  readonly baseline: number;
  readonly current: number;
  readonly worseBy: number;
  readonly threshold: number;
  readonly regressed: boolean;
}

export function compareToBaseline(
  current: MetricValues,
  baseline: MetricValues,
  specs: Readonly<Record<string, MetricSpec>>,
  noise: MetricValues,
): Regression[] {
  const out: Regression[] = [];
  for (const [metric, spec] of Object.entries(specs)) {
    if (spec.better === 'none') continue;
    const now = current[metric];
    const before = baseline[metric];
    if (now === undefined || before === undefined) continue;
    const delta = spec.better === 'lower' ? now - before : before - now;
    const worseBy = before === 0 ? (delta > 0 ? Number.POSITIVE_INFINITY : 0) : delta / Math.abs(before);
    const threshold = Math.max(REGRESSION_MIN_RELATIVE, noise[metric] ?? 0);
    out.push({ metric, baseline: before, current: now, worseBy, threshold, regressed: worseBy > threshold });
  }
  return out;
}
