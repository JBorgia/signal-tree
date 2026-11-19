import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALLOCATION_NODE_FLAGS, type SelfTestResult } from '../runner/alloc-probe.ts';
import { runChild } from '../runner/process.ts';

const PROBE = new URL('../runner/alloc-probe.ts', import.meta.url).href;

test('the allocation probe detects an allocating write and passes a non-allocating one (1M writes)', async () => {
  const result = await runChild<SelfTestResult>('isolate', { moduleUrl: PROBE, exportName: 'allocationProbeSelfTest', args: 1_000_000 }, ALLOCATION_NODE_FLAGS);
  assert.ok(result.allocatingPerWrite >= 0.99, `allocating loop read ${result.allocatingPerWrite} allocations per write`);
  assert.equal(result.plainPerWrite, 0);
  assert.equal(result.ok, true);
});
