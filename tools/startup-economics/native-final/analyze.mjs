#!/usr/bin/env node
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { admitPacket, fresh, loadRun, read, save, schedule, sha } from './common.mjs';

const [cpuArg, heapArg, functionalArg, outArg] = process.argv.slice(2);
assert(cpuArg && heapArg && functionalArg && outArg, 'analyze.mjs CPU_RESULTS HEAP_RESULTS FUNCTIONAL_RESULTS NEW_OUTPUT');
const cpu = loadRun(resolve(cpuArg)), heap = loadRun(resolve(heapArg));
assert.equal(cpu.plan.kind, 'cpu'); assert.equal(heap.plan.kind, 'heap');
assert.equal(cpu.plan.packetSha256, heap.plan.packetSha256);
const functionalPath = resolve(functionalArg), functional = read(functionalPath);
const functionalPlanPath = join(dirname(functionalPath), '../plan.json'), functionalPlan = read(functionalPlanPath);
assert.equal(functional.passed, true); assert.equal(sha(functionalPlanPath), functional.planSha256);
assert.equal(functionalPlan.kind, 'functional'); assert.deepEqual(functionalPlan.schedule, schedule('functional'));
assert.equal(functional.kind, 'functional'); assert.equal(functional.packetSha256, functionalPlan.packetSha256);
assert.equal(resolve(functionalPlan.output), dirname(functionalPath));
assert.equal(functionalPlan.packetSha256, cpu.plan.packetSha256); assert.equal(functional.children.length, 12);
const packet = admitPacket(functionalPlan.packetPath), functionalPids = new Set();
assert.equal(sha(functionalPlan.packetPath), functionalPlan.packetSha256);
assert.equal(functionalPlan.executionSha256, packet.execution.sha256);
for (const [index, child] of functional.children.entries()) {
  assert.equal(child.index, index); assert.equal(child.passed, true);
  assert.equal(sha(child.path), child.sha256); assert.equal(sha(child.invocation), child.invocationSha256);
  const result = read(child.path), invocation = read(child.invocation), sample = functionalPlan.schedule[index];
  assert.equal(result.passed, true); assert.equal(invocation.status, 0); assert.equal(invocation.signal, null); assert.equal(invocation.error, null);
  assert.equal(Object.hasOwn(result, 'error'), false); assert.deepEqual(result.cleanupErrors, []);
  assert.equal(invocation.resultSha256, child.sha256); assert.equal(sha(invocation.log), invocation.logSha256);
  assert.deepEqual(result.sample, sample); assert.equal(result.pid, invocation.pid); assert(!functionalPids.has(result.pid)); functionalPids.add(result.pid);
  assert.deepEqual(invocation.command, [packet.browserExecution.node.executable,
    ...(sample.suite === 'coordination' ? ['--expose-gc'] : []), join(dirname(packet.runner), 'functional-child.mjs'),
    functionalPlan.packetPath, child.path, JSON.stringify(sample)]);
  assert.equal(result.executionSha256, packet.execution.sha256); assert.equal(sha(result.raw.path), result.raw.sha256);
  if (result.raw.browserPath) assert.equal(sha(result.raw.browserPath), result.raw.browserSha256);
}
const median = values => { const x = [...values].sort((a, b) => a - b); const mid = Math.floor(x.length / 2); return x.length % 2 ? x[mid] : (x[mid - 1] + x[mid]) / 2; };
const distribution = values => ({ values, median: median(values), min: Math.min(...values), max: Math.max(...values) });
const phase = (child, name, metric) => child.cycles.reduce((sum, cycle) => sum + (metric === 'elapsedMs' ? cycle.stages[name].elapsedNs / 1e6 : (cycle.stages[name].cpuUs.user + cycle.stages[name].cpuUs.system) / 1000), 0);
const comparisons = [];
for (const rows of [1000, 10000]) for (const settlement of ['confirm', 'rollback']) {
  const match = child => child.sample.rows === rows && child.sample.settlement === settlement;
  const cells = {}, pairDifferences = {}, aaDifferences = {};
  for (const arm of ['before', 'after']) {
    const children = cpu.children.filter(child => match(child) && !child.sample.aa && child.sample.arm === arm);
    assert.equal(children.length, 3);
    cells[arm] = {};
    for (const name of ['population', 'settlementSync', 'settlementIncludingDrain']) for (const metric of ['elapsedMs', 'cpuMs']) {
      const key = name + '.' + metric; cells[arm][key] = distribution(children.map(child => phase(child, name, metric)));
      if (arm === 'after') {
        pairDifferences[key] = children.map(child => {
          const before = cpu.children.find(other => match(other) && !other.sample.aa && other.sample.arm === 'before' && other.sample.round === child.sample.round);
          assert.deepEqual(child.trace, before.trace, 'Exact deterministic delivery trace across paired arms');
          return phase(child, name, metric) - phase(before, name, metric);
        });
        const aa = cpu.children.filter(child => match(child) && child.sample.aa);
        assert.equal(aa.length, 2); assert.deepEqual(aa[0].trace, aa[1].trace);
        aaDifferences[key] = phase(aa[1], name, metric) - phase(aa[0], name, metric);
      }
    }
  }
  const memory = {};
  for (const arm of ['before', 'after']) {
    const values = heap.children.filter(child => match(child) && child.sample.arm === arm);
    assert.equal(values.length, arm === 'before' ? 2 : 1);
    memory[arm] = values.map(child => ({ aa: !!child.sample.aa, before: child.heap.before, empty: child.heap.empty,
      cycles: child.cycles.map(cycle => ({ cycle: cycle.cycle, ...cycle.heap, resources: cycle.resources, sampled: cycle.sampled })),
      lifecycle: child.heap, treeCollectedAfterHelperReturn: child.treeCollectedAfterHelperReturn }));
  }
  const hb = heap.children.find(child => match(child) && !child.sample.aa && child.sample.arm === 'before');
  const ha = heap.children.find(child => match(child) && !child.sample.aa && child.sample.arm === 'after');
  assert.deepEqual(hb.trace, ha.trace, 'Heap run delivery trace equality');
  comparisons.push({ rows, settlement, cycles: 10, cpu: cells, pairedAfterMinusBefore: pairDifferences, baselineAASecondMinusFirst: aaDifferences, memory });
}
const out = fresh(outArg, [dirname(resolve(cpuArg)), dirname(resolve(heapArg)), dirname(functionalPath), dirname(cpu.plan.packetPath), ...packet.protected]);
save(join(out, 'summary.json'), { passed: true, packetSha256: cpu.plan.packetSha256, command: process.argv,
  inputs: Object.fromEntries([cpuArg, heapArg, functionalArg].map(path => [resolve(path), sha(resolve(path))])),
  counts: { cpu: cpu.children.length, heap: heap.children.length, functional: functional.children.length }, comparisons,
  limits: [
    'Three paired CPU rounds and one A/A pair per profile are exploratory; no significance or confidence-interval claim.',
    'CPU population is transact+row copying+population; settlementIncludingDrain includes native settlement, fixed microtask draining and useful sink hashing. It contains settlementSync: do not add them.',
    'No forced GC occurs in CPU children. Heap children run fixed three job-separated GCs per checkpoint; their timing is not compared.',
    'Held and post-helper whole-heap bytes are retained-process observations, not allocated bytes, peak heap or universal leak absence.',
    'Finite repeated fresh-lifetime history can legitimately retain exact terminal facts; physical payload reclamation does not authorize proof erasure.',
    'Public and HTTP suites prove tested functional cases; fixture authority is not production auth, durable recovery or throughput evidence.',
  ] });
console.log(join(out, 'summary.json'));
