#!/usr/bin/env node
// Synthetic admission checks only. No installed runtime or benchmark execution.
import assert from 'node:assert/strict';
import { digest, save, schedule, validateChild } from './common.mjs';

const [out] = process.argv.slice(2); assert(out);
const stage = () => ({ elapsedNs: 1, cpuUs: { user: 1, system: 1 } });
function positive(mode) {
  const sample = { arm: 'before', rows: 1000, settlement: 'rollback', cycles: 1, mode };
  const cycle = { cycle: 1, pending: 0, count: 0, valuesVerified: true, valueDigest: digest([]), deliveries: 1,
    stages: Object.fromEntries(['population', 'settlementSync', 'settlementIncludingDrain'].map(name => [name, stage()])), heap: {} };
  const child = { sample, executionSha256: 'synthetic', pid: 1, cleanupErrors: [], passed: true, cycles: [cycle], finalPending: 0, destroyed: true,
    trace: [{ cycle: 1, phase: 'settled', count: 0, digest: digest([]) }], heap: {}, stages: Object.fromEntries(['factory', 'attach', 'destroy'].map(name => [name, stage()])) };
  if (mode === 'heap') {
    cycle.heap = Object.fromEntries(['pending', 'settledHandleHeld', 'settledHandleDropped', 'helperReturned'].map(name => [name, 1]));
    cycle.resources = { checkedRetired: 1000, currentSubjects: 1000, active: 0, facades: 0, retiredLifetimes: 0, retiredValueBackings: 0, reclamationCandidates: 0 };
    cycle.sampled = { payloadAlive: false, transactionAlive: false, previousPayloadAlive: false };
    child.heap = Object.fromEntries(['before', 'empty', 'linkDisposed', 'destroyedTreeHeld', 'ownerHelperReturned'].map(name => [name, 1]));
    child.treeCollectedAfterHelperReturn = true;
  }
  return child;
}
const cases = [];
for (const mode of ['cpu', 'heap']) {
  const value = positive(mode); validateChild(value, value.sample, 'synthetic'); cases.push({ id: mode + '-positive', passed: true });
}
const faults = [
  ['missing-stage', 'cpu', child => { delete child.cycles[0].stages.population; }],
  ['missing-cpu-component', 'cpu', child => { delete child.cycles[0].stages.settlementSync.cpuUs.user; }],
  ['nan-cpu', 'cpu', child => { child.cycles[0].stages.settlementIncludingDrain.cpuUs.system = NaN; }],
  ['missing-factory', 'cpu', child => { delete child.stages.factory; }],
  ['missing-global-heap', 'heap', child => { delete child.heap.empty; }],
  ['missing-cycle-heap', 'heap', child => { delete child.cycles[0].heap.helperReturned; }],
  ['wrong-active-count', 'heap', child => { child.cycles[0].resources.active = 1; }],
  ['wrong-payload-liveness', 'heap', child => { child.cycles[0].sampled.payloadAlive = true; }],
  ['wrong-sink-payload', 'cpu', child => { child.trace[0].digest = digest([{ id: 'wrong' }]); }],
  ['hidden-normal-error', 'cpu', child => { child.error = { message: 'unexpected' }; }],
];
for (const [id, mode, mutate] of faults) {
  const value = positive(mode); mutate(value); assert.throws(() => validateChild(value, value.sample, 'synthetic')); cases.push({ id, passed: true });
}
const counts = { functional: 12, controls: 10, cpu: 32, heap: 12 };
for (const [kind, count] of Object.entries(counts)) assert.equal(schedule(kind).length, count);
save(out, { passed: true, importsRuntime: false, cases, counts, command: process.argv });
