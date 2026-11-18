#!/usr/bin/env node
import assert from 'node:assert/strict';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { digest, errorInfo, faultOracles, save, sha, verifySlim } from './common.mjs';

const [executionPath, outputPath, sampleText] = process.argv.slice(2);
assert(executionPath && outputPath && sampleText);
const sample = JSON.parse(sampleText);
const result = { sample, executionSha256: sha(executionPath), pid: process.pid, node: process.version, host: { cpu: os.cpus()[0]?.model, load: os.loadavg() }, cycles: [], trace: [], heap: {}, stages: {}, cleanupErrors: [], passed: false };
const flush = async () => { for (let i = 0; i < 160; i++) await Promise.resolve(); };
async function gcHeap() {
  for (let i = 0; i < 3; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); }
  return process.memoryUsage().heapUsed;
}
function check(name, callback) {
  try { callback(); } catch (error) { result.failedOracle = name; throw error; }
}
function timed(target, name, callback) {
  const cpu = process.cpuUsage(), start = process.hrtime.bigint();
  const value = callback();
  target[name] = { elapsedNs: Number(process.hrtime.bigint() - start), cpuUs: process.cpuUsage(cpu) };
  return value;
}
const rowsFor = cycle => Array.from({ length: sample.rows }, (_, index) => Object.fromEntries([
  ['id', `R-${cycle}-${index}`], ...Array.from({ length: 8 }, (_, field) => [`v${field}`, cycle * 1000000 + index * 10 + field]),
]));

try {
  const execution = verifySlim(executionPath);
  assert(['cpu', 'heap'].includes(sample.mode)); assert([1000, 10000].includes(sample.rows));
  assert(['confirm', 'rollback'].includes(sample.settlement)); assert([1, 10].includes(sample.cycles));
  assert.equal(typeof global.gc, sample.mode === 'heap' ? 'function' : 'undefined', 'Separate GC and CPU children');
  const api = await import(pathToFileURL(execution.arms[sample.arm].bundle.path));
  if (sample.mode === 'heap') result.heap.before = await gcHeap();
  const pins = {};
  async function retainedStore() {
    let tree, connection, activeHandle, phase = 'empty', cycleNumber = 0, previousIds = [], previousPayload;
    let weakTree;
    const cleanup = async () => {
      if (activeHandle && tree && api.pending(tree)) {
        try { activeHandle.rollback(); } catch (error) { result.cleanupErrors.push(errorInfo(error)); }
      }
      activeHandle = undefined;
      if (connection) { try { connection.dispose(); } catch (error) { result.cleanupErrors.push(errorInfo(error)); } }
      connection = undefined;
      if (tree) { try { tree.destroy(); result.destroyed = true; } catch (error) { result.cleanupErrors.push(errorInfo(error)); } }
      tree = undefined;
      await flush();
    };
    try {
      tree = timed(result.stages, 'factory', () => api.create());
      weakTree = sample.mode === 'heap' ? new WeakRef(tree) : undefined;
      connection = timed(result.stages, 'attach', () => api.attach(tree, values => {
        result.trace.push({ cycle: cycleNumber, phase, count: values.length, digest: digest(values) });
      }));
      await flush(); assert.deepEqual(result.trace, []); assert.equal(api.pending(tree), 0);
      if (sample.mode === 'heap') {
        result.heap.empty = await gcHeap();
        for (const name of ['__acquireEntityHandleForTesting', '__inspectSubjectResources', '__listSubjectReclamationCandidates']) assert.equal(typeof tree.$.rows[name], 'function', name);
      }
      async function cycle(number) {
        cycleNumber = number; phase = 'pending';
        const expected = rowsFor(number), expectedDigest = digest(expected), deliveryBefore = result.trace.length;
        const current = { cycle: number, stages: {}, heap: {} };
        let ids = [], payloadRef, transactionRef;
        try {
          activeHandle = timed(current.stages, 'population', () => tree.transact(() => {
            const supplied = expected.map(row => ({ ...row }));
            if (sample.fault === 'wrong-value') supplied[0].v7++;
            api.populate(tree, supplied);
          }));
          check('populated-values', () => assert.deepEqual(api.read(tree), expected));
          check('pending-owner', () => assert.equal(api.pending(tree), 1));
          if (sample.mode === 'heap') {
            ids = expected.map(row => tree.$.rows.__acquireEntityHandleForTesting(row.id).subjectId);
            assert.equal(new Set(ids).size, sample.rows);
            const payload = api.read(tree)[0];
            payloadRef = new WeakRef(payload); transactionRef = new WeakRef(activeHandle);
            assert.equal(payloadRef.deref(), api.read(tree)[0], 'Watch actual stored payload, not detached input');
            if (sample.control === 'pin-release') pins.payload = payload;
          }
          await flush();
          if (sample.fault === 'early-send') result.trace.push({ cycle: number, phase, count: sample.rows, digest: expectedDigest });
          check('pending-delivery', () => assert.equal(result.trace.length, deliveryBefore, 'No outbound delivery before settlement'));
          if (sample.mode === 'heap') {
            current.heap.pending = await gcHeap();
            assert.equal(payloadRef.deref(), api.read(tree)[0], 'Actual payload remains tree-owned while pending');
            assert.equal(transactionRef.deref(), activeHandle);
            assert.equal(api.pending(tree), 1); assert.equal(result.trace.length, deliveryBefore);
          }
          phase = 'settled';
          const cpu = process.cpuUsage(), start = process.hrtime.bigint();
          timed(current.stages, 'settlementSync', () => { if (sample.fault !== 'skip-settlement') activeHandle[sample.settlement](); });
          await flush();
          if (sample.fault !== 'skip-settlement') await connection.settled();
          current.stages.settlementIncludingDrain = { elapsedNs: Number(process.hrtime.bigint() - start), cpuUs: process.cpuUsage(cpu) };
          check('settled-pending', () => assert.equal(api.pending(tree), 0));
          check('settled-values', () => assert.deepEqual(api.read(tree), sample.settlement === 'confirm' ? expected : []));
          const delivered = result.trace.slice(deliveryBefore);
          check('settled-delivery', () => {
            if (sample.settlement === 'confirm') assert.deepEqual(delivered, [{ cycle: number, phase: 'settled', count: sample.rows, digest: expectedDigest }]);
            else {
              assert(delivered.length <= 1, 'No duplicate rollback delivery');
              if (number === 1) assert.equal(delivered.length, 1, 'First rollback must exercise real Link sink');
              for (const entry of delivered) assert.deepEqual(entry, { cycle: number, phase: 'settled', count: 0, digest: digest([]) });
            }
          });
          if (sample.mode === 'heap') current.heap.settledHandleHeld = await gcHeap();
          activeHandle = undefined;
          if (sample.mode === 'heap') current.heap.settledHandleDropped = await gcHeap();
          Object.assign(current, { pending: 0, count: sample.settlement === 'confirm' ? sample.rows : 0, valuesVerified: true, valueDigest: digest(api.read(tree)), deliveries: delivered.length });
          return { current, ids, payloadRef, transactionRef };
        } finally {
          // On an oracle failure the enclosing owner performs rollback/dispose.
          // The successful path drops the handle before this helper returns.
        }
      }
      for (let number = 1; number <= sample.cycles; number++) {
        const completed = await cycle(number);
        if (sample.mode === 'heap') {
          completed.current.heap.helperReturned = await gcHeap();
          const retired = sample.settlement === 'confirm' ? previousIds : completed.ids;
          let retiredLifetimes = 0, retiredValueBackings = 0, active = 0, facades = 0;
          for (const id of retired) {
            const state = tree.$.rows.__inspectSubjectResources(id);
            if (state) { retiredLifetimes++; if (state.retainedValueBacking) retiredValueBackings++; }
          }
          for (const id of completed.ids) {
            const state = tree.$.rows.__inspectSubjectResources(id);
            if (state?.state === 'active') active++;
            if (state?.nodeFacadeMaterialized) facades++;
          }
          const resources = { checkedRetired: retired.length, retiredLifetimes, retiredValueBackings, currentSubjects: completed.ids.length, active, facades, reclamationCandidates: tree.$.rows.__listSubjectReclamationCandidates().length };
          assert.equal(retiredLifetimes, 0); assert.equal(retiredValueBackings, 0); assert.equal(facades, 0);
          assert.equal(active, sample.settlement === 'confirm' ? sample.rows : 0);
          completed.current.resources = resources;
          completed.current.sampled = { payloadAlive: completed.payloadRef.deref() !== undefined, transactionAlive: completed.transactionRef.deref() !== undefined, previousPayloadAlive: previousPayload?.deref() !== undefined };
          assert.equal(completed.current.sampled.transactionAlive, false, 'Settled dropped handle after helper return');
          if (sample.control !== 'pin-release') assert.equal(completed.current.sampled.payloadAlive, sample.settlement === 'confirm', 'Current payload lifetime follows actual store ownership');
          if (previousPayload) assert.equal(completed.current.sampled.previousPayloadAlive, false, 'Replaced payload can collect while store lives');
          if (sample.control === 'pin-release') {
            assert.equal(completed.payloadRef.deref(), pins.payload); assert.equal(weakTree.deref(), tree);
            result.pin = { payloadAliveWhilePinned: true, treeAliveWhileHeld: true };
            pins.payload = undefined;
            completed.current.heap.pinReleased = await gcHeap();
            assert.equal(completed.payloadRef.deref(), undefined, 'Positive pin must release actual rolled-back payload');
            result.pin.payloadCollectedAfterRelease = true;
          }
          // Only current IDs and one weak previous payload survive a cycle.
          previousIds = completed.ids; previousPayload = completed.payloadRef;
        }
        result.cycles.push(completed.current);
      }
      result.finalPending = api.pending(tree); assert.equal(result.finalPending, 0);
      connection.dispose(); connection = undefined; await flush();
      if (sample.mode === 'heap') result.heap.linkDisposed = await gcHeap();
      timed(result.stages, 'destroy', () => tree.destroy()); result.destroyed = true;
      await flush();
      if (sample.mode === 'heap') {
        result.heap.destroyedTreeHeld = await gcHeap();
        assert.equal(weakTree.deref(), tree, 'Destroyed-held checkpoint retains exactly its named tree');
      }
      tree = undefined; previousIds = []; previousPayload = undefined;
      return weakTree;
    } finally { await cleanup(); }
  }
  const weakTree = await retainedStore();
  if (sample.mode === 'heap') {
    result.heap.ownerHelperReturned = await gcHeap();
    result.treeCollectedAfterHelperReturn = weakTree.deref() === undefined;
    if (sample.control === 'pin-release') {
      assert.equal(result.treeCollectedAfterHelperReturn, true); result.pin.treeCollectedAfterRelease = true;
    }
  }
  assert.deepEqual(result.cleanupErrors, []);
  result.passed = true;
} catch (error) {
  result.error = errorInfo(error);
  if (sample.fault && result.failedOracle === faultOracles[sample.fault] && result.cleanupErrors.length === 0) {
    result.expectedFault = true; result.detectedOracle = result.failedOracle; result.passed = true;
  }
}
save(outputPath, result);
if (!result.passed) process.exitCode = 1;
