/**
 * S8 (scaling): the subjects' collection operations, per-operation "not
 * applicable", and planted faults on the fake subject at the real sizes
 * (1,000 and 100,000 rows), so a planted walk is a walk over 100,000 rows.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateEntry } from '../runner/budgets.ts';
import { judgeConditions, verdict, type RequestBase, type ScenarioResult } from '../runner/harness.ts';
import type { RunContext } from '../runner/types.ts';
import { makeRows } from '../scenarios/data.ts';
import { S8, S8_OPERATIONS } from '../scenarios/s8-scaling.ts';
import type { ReadAllocations, ScalingArgs } from '../scenarios/scaling.ts';
import { collectionSeed } from '../subjects/seed.ts';
import { testFake } from '../subjects/test-fake.ts';
import type { StoreSubject } from '../subjects/types.ts';
import { v15Shim } from '../subjects/v15-shim.ts';
import { assertEvaluated, budgets, condition, runOnFake } from './helpers.ts';

const SIZES = [1000, 100000] as const;
const S8_CONDITIONS = gateEntry(budgets, 'S8').conditions ?? [];

/** Fewer counted calls: a planted copying all() copies 100,000 rows per call. */
const fewerCalls = (request: RequestBase): RequestBase => ({ ...request, params: { ...request.params, allocationCalls: 1000 } });

for (const subject of [v15Shim, testFake]) {
  test(`${subject.id} gives S8 addOne, removeOne, all(), byId and row field writes`, () => {
    const tree = subject.createTree({ rows: collectionSeed('id') });
    const rows = tree.collection<{ id: number; f1: number }, number>(['rows']);
    rows.setAll(makeRows(10, 2) as { id: number; f1: number }[]);
    rows.addOne!({ id: 10, f1: 1 });
    rows.removeOne!(3);
    rows.removeOne!(5);
    rows.addOne!({ id: 11, f1: 2 });
    assert.equal(rows.count(), 10);
    assert.deepEqual(new Set(rows.all!().map((row) => row.id)), new Set([0, 1, 2, 4, 6, 7, 8, 9, 10, 11]));
    assert.equal(rows.byId!(3), undefined);
    for (const id of [0, 9, 10, 11]) assert.notEqual(rows.byId!(id), undefined, `row ${id}`);
    const cell = rows.writableField!(9, 'f1');
    cell.set(42);
    assert.equal(rows.field(9, 'f1')(), 42);
    tree.destroy();
  });
}

/** A RunContext whose isolate returns the same time at both sizes and no allocations, recording what it was asked. */
function stubContext(subject: StoreSubject, asked: { exportName: string; args: unknown }[]): RunContext {
  return {
    subject,
    params: { rows: [...SIZES], fields: 20, allocationCalls: 1000 },
    scale: budgets.scale,
    variant: 'bare',
    runIndex: 1,
    cpuThrottlingRate: 1,
    appDir: undefined,
    s5Compressed: true,
    note: () => undefined,
    log: () => undefined,
    async isolate<T>(_url: string, exportName: string, args: unknown): Promise<T> {
      asked.push({ exportName, args });
      if (exportName === 'measureScaling') return Object.fromEntries((args as ScalingArgs).operations.map((op) => [op, 100])) as T;
      const perCall = { all: { allocations: 0, bytes: 0 }, byId: { allocations: 1, bytes: 32 } };
      return { perCall, probeAllocatingPerWrite: 1 } satisfies ReadAllocations as T;
    },
  };
}

test('S8 does not measure an operation the subject lacks and reports its condition not applicable', async () => {
  const asked: { exportName: string; args: unknown }[] = [];
  const metrics = await S8.run(stubContext(v15Shim, asked));
  const timed = asked.filter((a) => a.exportName === 'measureScaling').map((a) => a.args as ScalingArgs);
  assert.deepEqual(timed.map((a) => a.rows), [1000, 100000]);
  for (const args of timed) assert.deepEqual([...args.operations].sort(), S8_OPERATIONS.map((op) => op.id).filter((id) => id !== 'transactRollback' && id !== 'undo').sort());
  assert.equal(metrics['transactRollbackRatio'], undefined);
  assert.equal(metrics['undoRatio'], undefined);
  assert.equal(metrics['byIdRatio'], 1);
  assert.equal(metrics['byIdAllocatedBytesGrowth'], 0);

  const evidence = { median: metrics, runs: Array(5).fill(metrics), requiredRuns: 5 };
  const shim = judgeConditions(S8, v15Shim, S8_CONDITIONS, evidence);
  assert.deepEqual(shim.notApplicable.map((c) => [c.id, c.missingCapabilities]), [
    ['S8.transactRollback', ['transactions']],
    ['S8.undo', ['restoration']],
  ]);
  assert.equal(shim.conditions.length, S8_CONDITIONS.length - 2);
  assert.equal(verdict(shim.conditions), true, 'not-applicable conditions do not count toward pass');

  // The fake has every operation: the same evidence, missing the two metrics, fails those two.
  const fake = judgeConditions(S8, testFake, S8_CONDITIONS, evidence);
  assert.deepEqual(fake.notApplicable, []);
  assert.deepEqual(fake.conditions.filter((c) => !c.pass).map((c) => c.id), ['S8.transactRollback', 'S8.undo']);
});

function assertMeasuredEveryOperation(result: ScenarioResult): void {
  assertEvaluated(result);
  assert.equal(result.conditionsNotApplicable, undefined, 'the fake has every operation');
  for (const op of S8_OPERATIONS) {
    for (const rows of SIZES) assert.ok(result.median![`${op.id}Ns@${rows}`]! > 0, `${op.id} was timed at ${rows} rows`);
  }
  for (const op of ['all', 'byId']) {
    for (const rows of SIZES) assert.ok(Number.isFinite(result.median![`${op}AllocatedBytesPerCall@${rows}`]), `${op} allocations were counted at ${rows} rows`);
  }
  assert.ok(result.median!['probeAllocatingPerWrite']! >= 0.99, 'the allocation probe proved itself');
}

function assertOnlyFailing(result: ScenarioResult, failing: readonly string[]): void {
  const failed = result.conditions.filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(failed.sort(), [...failing].sort(), JSON.stringify(result.conditions.filter((c) => !c.pass || failing.includes(c.id))));
}

test('S8 catches an O(n) walk planted in byId, and every other criterion passes', async () => {
  const planted = await runOnFake('S8', ['scanById'], { tweak: fewerCalls });
  assertMeasuredEveryOperation(planted);
  const byId = condition(planted, 'S8.byId');
  assert.ok((byId.actual as number) > 10, `a walk over 100,000 rows against 1,000 reads ${byId.actual}x`);
  assertOnlyFailing(planted, ['S8.byId']);
});

test('S8 catches per-call allocation growth planted in all()', async () => {
  const planted = await runOnFake('S8', ['copyAll'], { tweak: fewerCalls });
  assertMeasuredEveryOperation(planted);
  const alloc = condition(planted, 'S8.allAlloc');
  assert.ok((alloc.actual as number) > 100_000, `all() allocates ${alloc.actual} more bytes per call at 100,000 rows`);
  // Copying the rows is O(n) time as well, so S8.all fails with it; byId's allocations do not grow.
  assertOnlyFailing(planted, ['S8.all', 'S8.allAlloc']);
});
