/**
 * Reads bench/budgets.json and evaluates its conditions against scenario
 * medians. The runner never carries a number of its own for a gate: every
 * threshold and parameter comes from budgets.json.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BUDGETS_PATH = fileURLToPath(new URL('../budgets.json', import.meta.url));

export interface Condition {
  readonly id: string;
  readonly text: string;
  readonly metric?: string;
  readonly op?: '<=' | '==' | '>=' | 'withinRelative' | 'ownerBound';
  readonly value?: number;
  readonly coefficientUs?: number;
  /**
   * A bound relative to references measured in the same runs, in place of
   * `value`: the metric's median must be `op` factor × the largest of the
   * medians named in largestOf (S8: 1.25 × the larger of the Map.set and
   * Map.get ratios). Judged on the median only.
   */
  readonly relativeTo?: { readonly factor: number; readonly largestOf: readonly string[] };
  /** 'every-run': must hold in every run (zero and never budgets); default: judged on the median. */
  readonly judge?: 'every-run';
}

export interface GateEntry {
  readonly scenario?: string;
  readonly text?: string;
  readonly owner?: string;
  readonly environment?: { readonly runtime: 'node' | 'browser'; readonly cpuThrottlingRate: number };
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly conditions?: readonly Condition[];
  readonly reported?: readonly { readonly text: string; readonly metric: string }[];
  readonly compare?: { readonly scenarios: readonly string[]; readonly variant: string; readonly against: string };
  readonly parts?: Readonly<Record<string, GateEntry>>;
  /** Run counts that replace the default for one mode (S5: { full: 1 }). */
  readonly runs?: Readonly<Record<string, unknown>>;
  /** The gate counts toward a run's verdict only on the dedicated gate runner; anywhere else it is recorded only (S8). */
  readonly gateRunnerOnly?: { readonly text: string };
}

export interface Budgets {
  readonly approved: boolean;
  /** Absolute noise floors keyed "<gate>.<metric>"; see budgets.json. */
  readonly noiseFloors: Readonly<Record<string, number>>;
  readonly scale: Readonly<Record<string, unknown>>;
  readonly defaultEnvironment: { readonly runtime: 'node' | 'browser'; readonly cpuThrottlingRate: number };
  readonly gates: Readonly<Record<string, GateEntry>>;
}

export interface LoadedBudgets {
  readonly budgets: Budgets;
  readonly sha256: string;
}

export function loadBudgets(path = BUDGETS_PATH): LoadedBudgets {
  const text = readFileSync(path, 'utf8');
  return { budgets: JSON.parse(text) as Budgets, sha256: createHash('sha256').update(text).digest('hex') };
}

/** The gate entry for `id`, looking inside multi-part gates (S6a, S6b, S6c). */
export function gateEntry(budgets: Budgets, id: string): GateEntry {
  const direct = budgets.gates[id];
  if (direct) return direct;
  for (const gate of Object.values(budgets.gates)) {
    const part = gate.parts?.[id];
    if (part) return part;
  }
  throw new Error(`budgets.json has no gate "${id}"`);
}

function lookup(root: unknown, dotted: string): unknown {
  let node = root;
  for (const key of dotted.split('.')) {
    if (typeof node !== 'object' || node === null || !(key in node)) throw new Error(`budgets.json: unresolved $ref "${dotted}"`);
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** Gate parameters with every { "$ref": "scale.x" } replaced by its value. */
export function gateParameters(budgets: Budgets, id: string): Record<string, unknown> {
  const params = gateEntry(budgets, id).parameters ?? {};
  const resolve = (value: unknown): unknown => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const ref = (value as Record<string, unknown>)['$ref'];
    if (typeof ref === 'string') return lookup(budgets, ref);
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, resolve(inner)]));
  };
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, resolve(value)]));
}

export function gateEnvironment(budgets: Budgets, id: string): { runtime: 'node' | 'browser'; cpuThrottlingRate: number } {
  const entry = gateEntry(budgets, id);
  return entry.environment ?? budgets.defaultEnvironment;
}

export interface ConditionResult {
  readonly id: string;
  readonly text: string;
  /** Never null for an evaluated condition: a missing or short metric fails. */
  readonly pass: boolean;
  readonly actual: number | Record<string, number> | null;
  /** A relative condition's bound: factor × the largest reference median. */
  readonly bound?: number;
  /** A relative condition's reference medians, the largest of which set the bound. */
  readonly reference?: Readonly<Record<string, number>>;
  readonly detail?: string;
}

/** What a condition is judged on: the medians, every run, and how many runs each gated metric needs. */
export interface Evidence {
  readonly median: Readonly<Record<string, number>>;
  readonly runs: readonly Readonly<Record<string, number>>[];
  readonly requiredRuns: number;
}

function holds(op: NonNullable<Condition['op']>, actual: number, value: number): boolean {
  if (op === '<=') return actual <= value;
  if (op === '>=') return actual >= value;
  if (op === '==') return actual === value;
  return Math.abs(actual) <= value;
}

function finiteRuns(evidence: Evidence, metric: string): number {
  return evidence.runs.filter((run) => Number.isFinite(run[metric])).length;
}

/** The run that is furthest on the failing side of `op`. */
function worst(op: NonNullable<Condition['op']>, values: readonly number[], value: number): number {
  if (op === '>=') return Math.min(...values);
  if (op === '<=') return Math.max(...values);
  return values.reduce((a, b) => (Math.abs(b - (op === '==' ? value : 0)) > Math.abs(a - (op === '==' ? value : 0)) ? b : a));
}

/**
 * A relative condition: the metric's median against factor × the largest
 * reference median. The metric and every reference need a finite value in
 * each required run.
 */
function evaluateRelative(condition: Condition & { relativeTo: NonNullable<Condition['relativeTo']> }, evidence: Evidence): ConditionResult {
  const base = { id: condition.id, text: condition.text };
  const { metric, op } = condition;
  const { factor, largestOf } = condition.relativeTo;
  if (!metric || (op !== '<=' && op !== '>=') || condition.judge === 'every-run' || !largestOf.length || !(factor > 0)) {
    return { ...base, pass: false, actual: null, detail: 'not a relative condition: needs a metric, op <= or >=, a positive factor and references, judged on the median' };
  }
  const short = [metric, ...largestOf].filter((m) => finiteRuns(evidence, m) < evidence.requiredRuns || !Number.isFinite(evidence.median[m]));
  if (short.length) return { ...base, pass: false, actual: null, detail: `no finite value in each of the ${evidence.requiredRuns} required runs: ${short.join(', ')}` };
  const reference = Object.fromEntries(largestOf.map((m) => [m, evidence.median[m]!]));
  const [largestName, largest] = Object.entries(reference).reduce((a, b) => (b[1] > a[1] ? b : a));
  const bound = factor * largest;
  const actual = evidence.median[metric]!;
  return { ...base, pass: holds(op, actual, bound), actual, bound, reference, detail: `bound ${round(bound)} = ${factor} × ${largestName} ${round(largest)}` };
}

function round(value: number): string {
  return Number(value.toPrecision(3)).toString();
}

/**
 * Evaluates one condition. A gated metric that is missing, or has fewer
 * finite values than the required runs, fails. 'every-run' conditions fail
 * when any run fails (actual = the worst run, detail names the failing runs);
 * the others are judged on the median, relative ones against a bound set by
 * reference medians (evaluateRelative).
 */
export function evaluateCondition(condition: Condition, evidence: Evidence): ConditionResult {
  if (condition.relativeTo) return evaluateRelative({ ...condition, relativeTo: condition.relativeTo }, evidence);
  const base = { id: condition.id, text: condition.text };
  if (condition.op === 'ownerBound') {
    const prefix = `${condition.metric}@`;
    const points = Object.entries(evidence.median)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [Number(key.slice(prefix.length)), value] as const);
    const short = points.filter(([owners]) => finiteRuns(evidence, `${prefix}${owners}`) < evidence.requiredRuns);
    const one = points.find(([owners]) => owners === 1);
    if (!one || condition.coefficientUs === undefined || short.length) {
      return { ...base, pass: false, actual: null, detail: !one ? 'no cost(1)' : `fewer than ${evidence.requiredRuns} runs at n = ${short.map(([n]) => n).join(', ')}` };
    }
    const failures = points.filter(([owners, cost]) => !(cost <= one[1] + owners * condition.coefficientUs!));
    return {
      ...base,
      pass: failures.length === 0,
      actual: Object.fromEntries(points.map(([owners, cost]) => [`cost(${owners})`, cost])),
      detail: failures.length ? `over bound at n = ${failures.map(([owners]) => owners).join(', ')}` : undefined,
    };
  }
  if (!condition.metric || condition.op === undefined || condition.value === undefined) {
    return { ...base, pass: false, actual: null, detail: 'not a metric condition' };
  }
  const { metric, op, value } = condition;
  const finite = finiteRuns(evidence, metric);
  if (finite < evidence.requiredRuns) {
    return { ...base, pass: false, actual: null, detail: `${metric}: a finite value in ${finite} of the ${evidence.requiredRuns} required runs` };
  }
  if (condition.judge === 'every-run') {
    const values = evidence.runs.map((run) => run[metric] ?? Number.NaN);
    const failing = values.flatMap((v, i) => (Number.isFinite(v) && holds(op, v, value) ? [] : [i + 1]));
    return {
      ...base,
      pass: failing.length === 0,
      actual: worst(op, values.filter(Number.isFinite), value),
      detail: failing.length ? `failed in run${failing.length > 1 ? 's' : ''} ${failing.join(', ')} of ${values.length}` : undefined,
    };
  }
  const actual = evidence.median[metric];
  if (actual === undefined || !Number.isFinite(actual)) return { ...base, pass: false, actual: null, detail: `${metric} has no finite median` };
  return { ...base, pass: holds(op, actual, value), actual };
}

/** The absolute noise floor for `<gate>.<metric>`, if budgets.json defines one. */
export function noiseFloor(budgets: Budgets, gate: string, metric: string): number | undefined {
  const floor = budgets.noiseFloors?.[`${gate}.${metric}`];
  return typeof floor === 'number' ? floor : undefined;
}

/** Runs a gate needs: the gate's run count for `mode` (S5 full), else the default. */
export function requiredRuns(budgets: Budgets, id: string, mode: string | undefined, fallback: number): number {
  const runs = gateEntry(budgets, id).runs;
  const forMode = mode ? runs?.[mode] : undefined;
  return typeof forMode === 'number' ? forMode : fallback;
}
