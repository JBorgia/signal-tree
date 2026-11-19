/**
 * Shared setup for the harness tests: the fake subject, a smaller scale so
 * every scenario runs in seconds, and planted faults. Timings do not matter
 * here; the tests prove each scenario runs end to end and that each budget
 * check can fail.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { loadBudgets, type Budgets, type ConditionResult } from '../runner/budgets.ts';
import { Harness, type RequestBase, type ScenarioResult } from '../runner/harness.ts';
import { TMP_DIR } from '../runner/paths.ts';
import { findDefinition } from '../scenarios/index.ts';
import { loadSubject } from '../subjects/index.ts';

export const { budgets } = loadBudgets();

/** budgets.json scale, shrunk so a browser scenario takes seconds. */
export const SMALL_SCALE = {
  ...budgets.scale,
  largestCollection: { rows: 3000, fields: 20 },
  rowsRenderedAtOnce: 100,
  agentBatch: { fieldEdits: 100, rows: 20 },
};

const SMALL_PARAMS: Record<string, Record<string, unknown>> = {
  M1: { allocationWrites: 100_000 },
  S1: { formBoundFields: 100 },
  S2: { rows: 3000, rendered: 100, durationSeconds: 2 },
  S3: { rows: 3000 },
  S4a: { fieldEdits: 100, rows: 20 },
  S4b: { fieldEdits: 100, rows: 20 },
  S4c: { fieldEdits: 100, rows: 20 },
};

export function smaller(request: RequestBase): RequestBase {
  const params = { ...request.params, ...SMALL_PARAMS[request.scenario] };
  if (request.scenario === 'S5') params['nightlyCompression'] = { minWrites: 20_000 };
  return { ...request, params, scale: SMALL_SCALE, cpuThrottlingRate: 1 };
}

export interface FakeRunOptions {
  /** Runs per measurement; default 1. `undefined` keeps the harness's own count (budgets.json). */
  readonly runs?: number | undefined;
  readonly aa?: boolean;
  readonly s5Mode?: 'compressed' | 'full';
  readonly budgets?: Budgets;
  /** Further changes to the request, after the smaller scale. */
  readonly tweak?: (request: RequestBase) => RequestBase;
  /** Planted harness defects (BENCH_HARNESS_FAULTS). */
  readonly harnessFaults?: readonly string[];
  /** The status the run must end in (default 'ran'). */
  readonly status?: ScenarioResult['status'];
}

/** Runs one gate on the fake subject with `faults` planted (a fault written name@n applies to run n only). */
export async function runOnFake(id: string, faults: readonly string[], options: FakeRunOptions = {}): Promise<ScenarioResult> {
  process.env['BENCH_FAKE_FAULTS'] = faults.join(',');
  process.env['BENCH_HARNESS_FAULTS'] = (options.harnessFaults ?? []).join(',');
  try {
    const harness = new Harness(options.budgets ?? budgets, await loadSubject('test-fake'), {
      aa: options.aa ?? false,
      aaPairs: 1,
      skipBuild: true,
      s5Mode: options.s5Mode ?? 'compressed',
      runs: 'runs' in options ? options.runs : 1,
      override: (request) => (options.tweak ?? ((r: RequestBase) => r))(smaller(request)),
      log: () => undefined,
    });
    const result = (await harness.run([findDefinition(id)]))[id]!;
    assert.equal(result.status, options.status ?? 'ran', result.error);
    return result;
  } finally {
    delete process.env['BENCH_FAKE_FAULTS'];
    delete process.env['BENCH_HARNESS_FAULTS'];
  }
}

export function condition(result: ScenarioResult, id: string): ConditionResult {
  const found = result.conditions?.find((c) => c.id === id);
  assert.ok(found, `${result.id} has no condition ${id}`);
  return found;
}

/** Every condition was evaluated (pass is true or false, never "metric missing"). */
export function assertEvaluated(result: ScenarioResult): void {
  assert.ok(result.conditions?.length, `${result.id} produced no conditions`);
  for (const c of result.conditions!) assert.notEqual(c.pass, null, `${c.id} was not evaluated: ${c.detail}`);
}

export function assertFails(result: ScenarioResult, ...ids: string[]): void {
  for (const id of ids) assert.equal(condition(result, id).pass, false, `${id} should fail with the planted fault: ${JSON.stringify(condition(result, id))}`);
}

export function tempOut(): string {
  mkdirSync(TMP_DIR, { recursive: true });
  return mkdtempSync(join(TMP_DIR, 'test-'));
}
