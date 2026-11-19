import test from 'node:test';
import assert from 'node:assert/strict';
import { withCleanup } from './cleanup.mjs';
test('primary failure survives every cleanup and reporting failure', async () => {
  const primary = Object.freeze(new Error('first assertion'));
  const secondary = new Error('unresolved operation');
  const reports = [];
  let laterCleanup = false;
  await assert.rejects(withCleanup(() => { throw primary; }, [
    () => { throw secondary; }, () => { laterCleanup = true; },
  ], errors => { reports.push(...errors); throw new Error('reporting failed'); }), error => error === primary);
  assert.deepEqual(reports, [secondary]);
  assert.equal(laterCleanup, true);
});
test('cleanup failure after successful assertions remains a failed test', async () => {
  await assert.rejects(withCleanup(() => 1, [() => { throw new Error('cleanup'); }]), AggregateError);
});
