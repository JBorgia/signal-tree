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
}

export interface Budgets {
  readonly approved: boolean;
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
  readonly pass: boolean | null;
  readonly actual: number | Record<string, number> | null;
  readonly detail?: string;
}

/** Evaluates one metric condition on scenario medians. Returns pass = null when the metric is missing. */
export function evaluateCondition(condition: Condition, medians: Readonly<Record<string, number>>): ConditionResult {
  const base = { id: condition.id, text: condition.text };
  if (condition.op === 'ownerBound') {
    const prefix = `${condition.metric}@`;
    const points = Object.entries(medians)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [Number(key.slice(prefix.length)), value] as const);
    const one = points.find(([owners]) => owners === 1);
    if (!one || condition.coefficientUs === undefined) return { ...base, pass: null, actual: null, detail: 'no cost(1)' };
    const failures = points.filter(([owners, cost]) => !(cost <= one[1] + owners * condition.coefficientUs!));
    return {
      ...base,
      pass: failures.length === 0,
      actual: Object.fromEntries(points.map(([owners, cost]) => [`cost(${owners})`, cost])),
      detail: failures.length ? `over bound at n = ${failures.map(([owners]) => owners).join(', ')}` : undefined,
    };
  }
  if (!condition.metric || condition.op === undefined || condition.value === undefined) return { ...base, pass: null, actual: null, detail: 'not a metric condition' };
  const actual = medians[condition.metric];
  if (actual === undefined || !Number.isFinite(actual)) return { ...base, pass: null, actual: null, detail: `metric ${condition.metric} missing` };
  const value = condition.value;
  const pass =
    condition.op === '<=' ? actual <= value
    : condition.op === '>=' ? actual >= value
    : condition.op === '==' ? actual === value
    : Math.abs(actual) <= value;
  return { ...base, pass, actual };
}
