import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { before, test } from 'node:test';
import { buildAngularApp } from '../runner/app-build.ts';
import { TMP_DIR } from '../runner/paths.ts';
import type { RequestBase } from '../runner/harness.ts';
import { LONG_CHUNK_MS } from '../subjects/test-fake.ts';
import { assertEvaluated, assertFails, budgets, condition, runOnFake } from './helpers.ts';

// One build of the reference app against the fake subject (the "test-fake"
// angular.json configuration swaps src/app/subject.ts); every test reuses it.
before(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  buildAngularApp('test-fake');
});

test('S3 runs on chunked setAll and fails S3.task when a chunk blocks', async () => {
  assertEvaluated(await runOnFake('S3', []));
  const planted = await runOnFake('S3', ['longChunk']);
  assertEvaluated(planted);
  const raw = String(planted.runs![0]!.notes['longFrames']);
  const frames = JSON.parse(raw) as { startTime: number; duration: number; blockingDuration: number }[];
  // First that the observer saw the planted chunk at all, as a task: blocking time is what a frame's tasks spend past
  // 50 ms, so a frame that is merely long (a render after unseen work) does not count. Then its length, then the verdict.
  assert.ok(frames.length > 0, `the observer reported no long animation frame; frames: ${raw}`);
  const chunk = frames.reduce((a, b) => (b.blockingDuration > a.blockingDuration ? b : a));
  assert.ok(chunk.blockingDuration >= LONG_CHUNK_MS - 50, `no frame held the ${LONG_CHUNK_MS} ms chunk as a task; frames: ${raw}`);
  assert.ok(chunk.duration >= LONG_CHUNK_MS, `frames: ${raw}`);
  assert.ok(planted.median!['maxMainThreadTaskMs']! >= LONG_CHUNK_MS, `frames: ${raw}`);
  assertFails(planted, 'S3.task');
  assert.ok(planted.median!['totalMs']! >= LONG_CHUNK_MS);
});

test('S4a runs a transaction with inspect() and rollback, and each budget can fail', async () => {
  assertEvaluated(await runOnFake('S4a', []));
  const planted = await runOnFake('S4a', ['slowApply', 'slowInspect', 'slowRollback']);
  assertFails(planted, 'S4a.apply', 'S4a.inspect', 'S4a.rollback');
});

test('S4b undoes only the agent and keeps the user edit; slow undo fails S4b.undo', async () => {
  const clean = await runOnFake('S4b', []);
  assertEvaluated(clean);
  assert.equal(clean.median!['userEditKept'], 1);
  assertFails(await runOnFake('S4b', ['slowUndo']), 'S4b.undo');
});

test('S4c keeps the held value under a refusing hold; ignored holds and slow keystrokes fail', async () => {
  const clean = await runOnFake('S4c', []);
  assertEvaluated(clean);
  assert.equal(condition(clean, 'S4c.held').pass, true);
  assert.ok(clean.median!['agentRefusals']! > 0, 'the agent write to the held field was refused');
  assertFails(await runOnFake('S4c', ['ignoreHolds', 'slowKeystroke']), 'S4c.held', 'S4c.keystroke');
});

test('S5 soaks with every plugin and caps held; a leaking history fails both checks', async () => {
  const clean = await runOnFake('S5', []);
  assertEvaluated(clean);
  assert.equal(condition(clean, 'S5.caps').pass, true);
  assert.ok(clean.median!['writes']! >= 20_000);
  assertFails(await runOnFake('S5', ['leakHistory']), 'S5.heap', 'S5.caps');
});

test('S6(b) reruns M1, S1 and S2 with scoped plugins; cost outside the scopes fails S6b', async () => {
  const planted = await runOnFake('S6b', ['scopedCost']);
  assert.deepEqual(Object.keys(planted.compared!), ['M1', 'S1', 'S2']);
  assertEvaluated(planted);
  assertFails(planted, 'S6b.within:M1.writeRatioVsNative');
});

test('a never budget fails when one run of three breaks it, though the median is clean', async () => {
  const result = await runOnFake('S4c', ['ignoreHolds@2'], { runs: 3 });
  assert.equal(result.median!['heldValueOverwrites'], 0, 'two clean runs of three: the median reads 0');
  const held = condition(result, 'S4c.held');
  assert.equal(held.pass, false);
  assert.ok((held.actual as number) > 0, 'actual is the worst run');
  assert.match(held.detail!, /run 2 of 3/);
});

test('a metric that reads 0 in an A/A set without a noise floor is an error that fails the run', async () => {
  const floors = { ...budgets.noiseFloors };
  delete (floors as Record<string, number>)['S1.longFramesDuringKeystroke'];
  const result = await runOnFake('S1', [], { aa: true, budgets: { ...budgets, noiseFloors: floors }, status: 'error' });
  assert.match(result.error!, /S1\.longFramesDuringKeystroke/);
  assert.equal(result.pass, false);
  assert.ok(result.aa!.noise.zero.includes('longFramesDuringKeystroke'));
  const clean = await runOnFake('S1', [], { aa: true });
  assert.ok(clean.aa!.noise.zero.includes('longFramesDuringKeystroke'), 'with its floor the same A/A run is fine');
});

test("S5's soak leaves the harness's heap flat and its mark buffer bounded; a harness that keeps marks is caught", async () => {
  const clean = await runOnFake('S5', [], { tweak: (r) => ({ ...r, params: { ...r.params, nightlyCompression: { minWrites: 60_000 } } }) });
  assert.ok(clean.median!['heapGrowthFinalHalf']! <= 0.02, `final-half heap growth ${clean.median!['heapGrowthFinalHalf']}`);
  assert.ok(clean.median!['markEntriesMax']! > 0 && clean.median!['markEntriesMax']! < 200, `mark entries per drain ${clean.median!['markEntriesMax']}`);
  const planted = await runOnFake('S5', [], { harnessFaults: ['keepMarks'], status: 'error' });
  assert.match(planted.error!, /stayed in the performance buffer/);
});

test('S2 heap overhead reads about 0 for a store that shares the rows and about 1 for one that also copies them', async () => {
  const big = (r: RequestBase) => ({ ...r, params: { ...r.params, rows: 20_000 } });
  const sharing = await runOnFake('S2', [], { tweak: big });
  const copying = await runOnFake('S2', ['copyRows'], { tweak: big });
  const shared = sharing.median!['storeHeapOverheadAfterLoadRatio']!;
  const copied = copying.median!['storeHeapOverheadAfterLoadRatio']!;
  assert.ok(Math.abs(shared) < 0.1, `sharing store read ${shared}`);
  // A copy cannot share V8's internalized strings the way the parsed rows do among themselves, so about 0.9 in Chromium.
  assert.ok(copied > 0.75 && copied < 1.25, `copying store read ${copied}`);
});

test('the weekly full-length S5 takes its run count from budgets.json (1); the nightly keeps 5', async () => {
  const { Harness } = await import('../runner/harness.ts');
  const { loadSubject } = await import('../subjects/index.ts');
  const subject = await loadSubject('test-fake');
  const options = { aa: false, aaPairs: 1, skipBuild: true, onGateRunner: false } as const;
  assert.equal(new Harness(budgets, subject, { ...options, s5Mode: 'full' }).runsFor('S5'), 1);
  assert.equal(new Harness(budgets, subject, { ...options, s5Mode: 'compressed' }).runsFor('S5'), 5);
  const full = await runOnFake('S5', [], {
    runs: undefined,
    s5Mode: 'full',
    tweak: (r) => ({ ...r, params: { ...r.params, sessionHours: 3 / 3600 } }),
  });
  assert.equal(full.runs!.length, 1);
  assert.equal(full.requiredRuns, 1);
  assertEvaluated(full);
});
