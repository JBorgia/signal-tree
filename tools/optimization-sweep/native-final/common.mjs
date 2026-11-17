import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

export const arms = ['before', 'after'];
export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const expectedRows = (rows, cycle) => Array.from({ length: rows }, (_, index) => Object.fromEntries([
  ['id', `R-${cycle}-${index}`], ...Array.from({ length: 8 }, (_, field) => [`v${field}`, cycle * 1000000 + index * 10 + field]),
]));
export const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const errorInfo = error => ({ type: typeof error, message: String(error), stack: error instanceof Error ? error.stack : null });
export const nodeIdentity = () => ({ path: realpathSync(process.execPath), version: process.version, sha256: sha(process.execPath), platform: process.platform, arch: process.arch });
export function verify(bindings) { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Changed input: ${path}`); }
export function inventory(root) {
  const files = {};
  function walk(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), `Unexpected alias: ${directory}/${entry.name}`);
      const path = join(directory, entry.name), key = prefix + entry.name;
      if (entry.isDirectory()) walk(path, key + '/');
      else { assert(entry.isFile()); files[key] = sha(path); }
    }
  }
  walk(root); return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
export function fresh(pathArg, protectedPaths) {
  const path = resolve(pathArg); assert(!existsSync(path), `Preserve prior attempt: ${path}`);
  for (const input of protectedPaths) {
    const root = resolve(input);
    assert(path !== root && !path.startsWith(root + sep) && !root.startsWith(path + sep), `Output overlaps input: ${path} / ${root}`);
  }
  mkdirSync(path, { recursive: true }); return path;
}
export const sourceNames = ['common.mjs', 'prepare.mjs', 'run.mjs', 'child.mjs', 'functional-child.mjs', 'analyze.mjs', 'helper.mjs', 'native-execution.mjs', 'protocol.md'];
export function verifySlim(path) {
  const value = read(path);
  assert.equal(value.kind, 'native-final-execution-v1');
  assert.deepEqual(nodeIdentity(), value.node);
  assert(!process.env.NODE_OPTIONS, 'Unregistered Node options');
  verify(value.tools);
  // Identical order and complete two-arm work in EVERY child, before any runtime import.
  for (const arm of arms) {
    const item = value.arms[arm];
    assert.equal(sha(item.kernel.archive), item.kernel.archiveSha256);
    assert.equal('sha512-' + createHash('sha512').update(readFileSync(item.kernel.archive)).digest('base64'), item.kernel.integrity);
    assert.deepEqual(inventory(item.kernel.root), item.kernel.files);
    assert.equal(sha(item.bundle.path), item.bundle.sha256);
  }
  return value;
}
export function admitPacket(path) {
  const packet = read(path);
  assert.equal(packet.kind, 'native-final-packet-v1');
  verify(packet.bindings);
  assert.equal(sha(packet.execution.path), packet.execution.sha256);
  verifySlim(packet.execution.path);
  return packet;
}
export const faultOracles = { 'early-send': 'pending-delivery', 'wrong-value': 'populated-values', 'skip-settlement': 'settled-pending' };
export function schedule(kind) {
  const result = [];
  if (kind === 'functional') {
    for (const arm of arms) {
      result.push({ arm, suite: 'public' }, { arm, suite: 'http' });
      for (const fault of ['skip-native-settlement', 'ignore-instance']) result.push({ arm, suite: 'http', fault });
      result.push({ arm, suite: 'coordination', rows: 1000, episodes: 20 });
      result.push({ arm, suite: 'coordination', rows: 1000, episodes: 20, fault: 'early-send' });
    }
  } else if (kind === 'controls') {
    for (const arm of arms) {
      result.push({ arm, rows: 1000, settlement: 'confirm', cycles: 10, mode: 'cpu', control: 'positive' });
      for (const fault of Object.keys(faultOracles)) result.push({ arm, rows: 1000, settlement: 'rollback', cycles: 1, mode: 'cpu', fault });
      result.push({ arm, rows: 1000, settlement: 'rollback', cycles: 1, mode: 'heap', control: 'pin-release' });
    }
  } else {
    assert(['cpu', 'heap'].includes(kind));
    for (const rows of [1000, 10000]) for (const settlement of ['confirm', 'rollback']) {
      for (let round = 0; round < (kind === 'cpu' ? 3 : 1); round++) {
        for (const arm of round % 2 ? [...arms].reverse() : arms) result.push({ arm, rows, settlement, cycles: 10, mode: kind, round });
      }
      // CPU: two baseline repetitions per profile. Heap: one additional baseline
      // relative to that profile's registered primary baseline, not an extra pair.
      for (let member = 0; member < (kind === 'cpu' ? 2 : 1); member++) result.push({ arm: 'before', rows, settlement, cycles: 10, mode: kind, round: 0, aa: true, member });
    }
  }
  return result.map((sample, index) => ({ index, ...sample }));
}
export function validateChild(child, sample, executionSha256) {
  assert.equal(child.passed, true); assert.deepEqual(child.sample, sample);
  assert.equal(child.executionSha256, executionSha256); assert(Number.isInteger(child.pid) && child.pid > 0);
  assert.deepEqual(child.cleanupErrors, []);
  if (sample.fault) {
    assert.equal(child.detectedOracle, faultOracles[sample.fault]); assert.equal(child.expectedFault, true);
    assert.equal(child.failedOracle, faultOracles[sample.fault]); assert(child.error); assert.equal(child.destroyed, true);
  } else {
    for (const field of ['error', 'failedOracle', 'expectedFault', 'detectedOracle']) assert.equal(Object.hasOwn(child, field), false, `Unexpected normal-child ${field}`);
    assert.equal(child.cycles.length, sample.cycles);
    assert.equal(child.destroyed, true); assert.equal(child.finalPending, 0);
    for (const [index, cycle] of child.cycles.entries()) {
      assert.equal(cycle.cycle, index + 1); assert.equal(cycle.pending, 0);
      assert.equal(cycle.count, sample.settlement === 'confirm' ? sample.rows : 0);
      assert.equal(cycle.valuesVerified, true);
      assert.equal(cycle.valueDigest, digest(sample.settlement === 'confirm' ? expectedRows(sample.rows, index + 1) : []));
      validateStages(cycle.stages, ['population', 'settlementSync', 'settlementIncludingDrain']);
      if (sample.mode === 'heap') {
        validateHeap(cycle.heap, ['pending', 'settledHandleHeld', 'settledHandleDropped', 'helperReturned', ...(sample.control === 'pin-release' ? ['pinReleased'] : [])]);
        assert.deepEqual(Object.keys(cycle.resources).sort(), ['checkedRetired', 'retiredLifetimes', 'retiredValueBackings', 'currentSubjects', 'active', 'facades', 'reclamationCandidates'].sort());
        assert.equal(cycle.resources.checkedRetired, sample.settlement === 'confirm' && index === 0 ? 0 : sample.rows);
        assert.equal(cycle.resources.currentSubjects, sample.rows);
        assert.equal(cycle.resources.active, sample.settlement === 'confirm' ? sample.rows : 0);
        assert.equal(cycle.resources.retiredValueBackings, 0);
        assert.equal(cycle.resources.retiredLifetimes, 0);
        assert.equal(cycle.resources.facades, 0);
        assert(Number.isInteger(cycle.resources.reclamationCandidates) && cycle.resources.reclamationCandidates >= 0);
        assert.deepEqual(cycle.sampled, { payloadAlive: sample.settlement === 'confirm' || sample.control === 'pin-release', transactionAlive: false, previousPayloadAlive: false });
      } else assert.deepEqual(cycle.heap, {});
    }
    validateStages(child.stages, ['factory', 'attach', 'destroy']);
    if (sample.mode === 'heap') {
      validateHeap(child.heap, ['before', 'empty', 'linkDisposed', 'destroyedTreeHeld', 'ownerHelperReturned']);
      assert.equal(typeof child.treeCollectedAfterHelperReturn, 'boolean');
    } else assert.deepEqual(child.heap, {});
    assert(child.trace.length > 0, 'Sink must do useful work');
    assert.equal(child.trace.length, child.cycles.reduce((sum, cycle) => sum + cycle.deliveries, 0));
    for (const item of child.trace) {
      assert.equal(item.phase, 'settled'); assert(Number.isInteger(item.cycle) && item.cycle >= 1 && item.cycle <= sample.cycles);
      assert.equal(item.count, sample.settlement === 'confirm' ? sample.rows : 0);
      assert.equal(item.digest, digest(sample.settlement === 'confirm' ? expectedRows(sample.rows, item.cycle) : []));
    }
    assert.equal(child.cycles[0].deliveries, 1);
    if (sample.settlement === 'confirm') assert(child.cycles.every(cycle => cycle.deliveries === 1));
    if (sample.control === 'pin-release') {
      assert.deepEqual(child.pin, { payloadAliveWhilePinned: true, payloadCollectedAfterRelease: true, treeAliveWhileHeld: true, treeCollectedAfterRelease: true });
    }
  }
}
function validateStages(stages, names) {
  assert.deepEqual(Object.keys(stages).sort(), [...names].sort());
  for (const name of names) {
    const stage = stages[name]; assert.deepEqual(Object.keys(stage).sort(), ['cpuUs', 'elapsedNs']);
    assert(Number.isFinite(stage.elapsedNs) && stage.elapsedNs >= 0);
    assert.deepEqual(Object.keys(stage.cpuUs).sort(), ['system', 'user']);
    for (const key of ['user', 'system']) assert(Number.isFinite(stage.cpuUs[key]) && stage.cpuUs[key] >= 0);
  }
}
function validateHeap(heap, names) {
  assert.deepEqual(Object.keys(heap).sort(), [...names].sort());
  for (const name of names) assert(Number.isFinite(heap[name]) && heap[name] > 0);
}
export function loadRun(path) {
  const result = read(path), planPath = join(dirname(path), '..', 'plan.json'), plan = read(planPath);
  assert.equal(sha(planPath), result.planSha256); assert.equal(result.passed, true);
  assert.equal(result.kind, plan.kind); assert.equal(result.packetSha256, plan.packetSha256);
  assert.equal(resolve(plan.output), dirname(resolve(path)));
  assert.deepEqual(plan.schedule, schedule(plan.kind)); assert.equal(result.children.length, plan.schedule.length);
  const packet = admitPacket(plan.packetPath);
  assert.equal(sha(plan.packetPath), plan.packetSha256);
  assert.equal(plan.executionSha256, packet.execution.sha256);
  if (['cpu', 'heap'].includes(plan.kind)) {
    assert.equal(sha(plan.controls.path), plan.controls.sha256);
    const controls = loadRun(plan.controls.path);
    assert.equal(controls.plan.kind, 'controls'); assert.equal(controls.plan.packetPath, plan.packetPath);
  }
  const pids = new Set(), children = [];
  for (let i = 0; i < plan.schedule.length; i++) {
    const record = result.children[i], sample = plan.schedule[i];
    assert.equal(record.passed, true);
    assert.equal(record.index, i); assert.equal(sha(record.path), record.sha256);
    assert.equal(sha(record.invocation), record.invocationSha256);
    const invocation = read(record.invocation), child = read(record.path);
    assert.equal(invocation.status, 0); assert.equal(invocation.signal, null); assert.equal(invocation.error, null);
    assert.equal(invocation.resultSha256, record.sha256);
    assert.equal(sha(invocation.log), invocation.logSha256);
    assert.deepEqual(invocation.command, [packet.browserExecution.node.executable,
      ...(sample.mode === 'heap' ? ['--expose-gc'] : []), join(dirname(packet.runner), 'child.mjs'),
      packet.execution.path, record.path, JSON.stringify(sample)]);
    assert.equal(child.pid, invocation.pid); assert(!pids.has(child.pid)); pids.add(child.pid);
    validateChild(child, sample, packet.execution.sha256); children.push(child);
  }
  return { result, plan, packet, children };
}
