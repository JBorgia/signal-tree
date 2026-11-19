import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { before, test } from 'node:test';
import { buildAngularApp } from '../runner/app-build.ts';
import { TMP_DIR } from '../runner/paths.ts';
import { assertEvaluated, assertFails, condition, runOnFake } from './helpers.ts';

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
  assertFails(planted, 'S3.task');
  assert.ok(planted.median!['totalMs']! > 0);
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
