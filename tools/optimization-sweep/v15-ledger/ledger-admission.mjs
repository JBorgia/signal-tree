import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { expectedFaults, phaseNames, read, schedule, sha, verify } from './ledger-common.mjs';
const ids = (start, count) => Array.from({ length: count }, (_, i) => start + i);
const keep = (xs, H) => H > 0 ? xs.slice(-H) : [];

export function admitChild(child, sample, packetPath, packet, full) {
  assert.ok(child, 'Missing child payload');
  assert.deepEqual(child.sample, sample);
  assert.equal(child.packetPath, packetPath); assert.equal(child.packetSha256, sha(packetPath));
  assert.equal(child.bundleSha256, packet.bundles[sample.arm].sha256);
  assert.deepEqual(child.node, packet.node);
  assert.equal(child.runnerSha256, packet.bindings[packet.runner]);
  assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0, 'Child PID');
  assert.equal(Object.hasOwn(child, 'cleanupError'), false, 'Cleanup failure');
  if (!full) return;
  assert.equal(child.passed, true); assert.equal(Object.hasOwn(child, 'error'), false);
  if (sample.kind === 'overlap-control') {
    assert.deepEqual(child.oracles, { overlapRefused: true, rollbackValues: [2, 1, 0], pending: 0 }); return;
  }
  const { P, H, E, N } = sample.profile, ordinary = ids(P + 1, N);
  const check = (oracle, expected, count) => {
    assert.deepEqual(oracle.ids, expected, 'Exact ledger IDs');
    assert.equal(oracle.effects, expected.reduce((n, id) => n + (id <= P ? 1 : E), 0));
    assert.equal(oracle.retention.firstAvailableTurnId, expected[0]);
    assert.equal(oracle.retention.truncated, expected.length < count);
    assert.match(oracle.digest, /^[a-f0-9]{64}$/);
  };
  check(child.oracles.initial, [], 0);
  check(child.oracles.held, P ? ordinary : keep(ordinary, H), N);
  check(child.oracles.settled, keep(sample.settlement === 'confirm' ? ids(1, P + N) : ordinary, H), N);
  assert.equal(child.oracles.nextId, P + N + 1);
  const boundaries = [...new Set([1, N, ...(H >= 1 ? [Math.trunc(H), Math.trunc(H) + 1] : [])])].filter(n => n <= N).sort((a,b) => a-b);
  assert.deepEqual(child.oracles.windows.map(row => row.step), boundaries);
  for (const row of child.oracles.windows) check(row, P ? ids(P + 1, row.step) : keep(ids(P + 1, row.step), H), row.step);
  if (sample.kind === 'cpu') {
    assert.deepEqual(Object.keys(child.stages), phaseNames);
    assert.equal(child.operationSamples.length, N);
    for (const stage of [...Object.values(child.stages), ...child.operationSamples]) {
      for (const n of [stage.elapsedNs, stage.cpuMs, stage.cpuMicroseconds.user, stage.cpuMicroseconds.system]) assert.ok(Number.isFinite(n) && n >= 0, 'Finite nonnegative timing');
      assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000);
    }
    for (const key of ['elapsedNs', 'user', 'system']) {
      const actual = key === 'elapsedNs' ? child.stages.ordinaryFlushes.elapsedNs : child.stages.ordinaryFlushes.cpuMicroseconds[key];
      const expected = child.operationSamples.reduce((n, x) => n + (key === 'elapsedNs' ? x.elapsedNs : x.cpuMicroseconds[key]), 0);
      assert.equal(actual, expected, 'Recomputed raw interval sum');
    }
  } else {
    assert.deepEqual(child.stages, {}); assert.deepEqual(child.operationSamples, []);
  }
}

export function admitResults(input) {
  const results = read(input), plan = read(results.planPath), packet = read(plan.packetPath);
  assert.equal(plan.kind, 'v15-ledger-screen-plan-v1'); assert.equal(packet.kind, 'v15-ledger-screen-packet-v1');
  assert.equal(sha(results.planPath), results.planSha256); assert.equal(sha(plan.packetPath), plan.packetSha256);
  verify(results.bindings); verify(plan.bindings); verify(packet.bindings);
  assert.deepEqual(results.bindings, plan.bindings);
  assert.deepEqual(plan.bindings, { [plan.packetPath]: plan.packetSha256, ...packet.bindings }, 'Mandatory complete packet bindings');
  assert.deepEqual(plan.node, packet.node); assert.deepEqual(plan.schedule, schedule(plan.cohort));
  assert.equal(results.passed, true); assert.equal(results.results.length, plan.schedule.length);
  const rows = [], children = [], pids = new Set();
  for (let i = 0; i < plan.schedule.length; i++) {
    const sample = plan.schedule[i], invocation = results.results[i], fault = expectedFaults[sample.fault];
    assert.deepEqual(invocation.sample, sample); assert.equal(invocation.passed, true);
    assert.equal(invocation.signal, null);
    for (const field of ['processError', 'admissionError']) assert.equal(Object.hasOwn(invocation, field), false, `Unexpected ${field}`);
    assert.deepEqual(read(join(dirname(input), `invocation-${String(sample.index).padStart(3, '0')}.json`)), invocation, 'Exact invocation sidecar');
    assert.deepEqual(invocation.command, [packet.node.path, packet.runner, 'child', plan.packetPath, invocation.resultPath, JSON.stringify(sample)], 'Exact command');
    assert.equal(sha(invocation.resultPath), invocation.resultSha256); assert.equal(sha(invocation.logPath), invocation.logSha256);
    const child = read(invocation.resultPath);
    admitChild(child, sample, plan.packetPath, packet, !fault);
    assert.ok(!pids.has(child.pid), 'Independent fresh child PIDs'); pids.add(child.pid);
    children.push({ path: invocation.resultPath, sha256: invocation.resultSha256 });
    if (fault) {
      assert.equal(invocation.exitCode, 1); assert.equal(child.passed, false); assert.equal(invocation.expectedFault, fault); assert.ok(child.error.includes(fault));
      rows.push({ sample, expectedFailure: fault }); continue;
    }
    assert.equal(invocation.exitCode, 0); assert.equal(invocation.expectedFault, undefined);
    const row = { sample, oracles: child.oracles };
    if (sample.kind === 'cpu') {
      row.stages = Object.fromEntries(phaseNames.map(name => [name, { elapsedMs: child.stages[name].elapsedNs / 1e6, cpuMs: child.stages[name].cpuMs }]));
      row.stages.measuredPhaseSum = { elapsedMs: Object.values(row.stages).reduce((n,x) => n+x.elapsedMs,0), cpuMs: Object.values(row.stages).reduce((n,x) => n+x.cpuMs,0) };
      row.operationSamples = child.operationSamples;
    }
    rows.push(row);
  }
  // Every paired and same-arm sample must have exactly the same primitive task
  // outcomes (including values/effects digest), apart from timing and PID.
  for (const row of rows.filter(row => !row.expectedFailure && row.sample.kind !== 'overlap-control')) {
    const peer = rows.find(peer => peer.sample.profile.id === row.sample.profile.id && peer.sample.settlement === row.sample.settlement && !peer.expectedFailure);
    assert.deepEqual(row.oracles, peer.oracles, 'Cross-arm and repeat observable task equality');
  }
  if (plan.cohort === 'cpu') {
    assert.equal(sha(plan.controls.path), plan.controls.sha256);
    const controls = admitResults(plan.controls.path);
    assert.equal(controls.plan.cohort, 'controls'); assert.equal(controls.plan.packetPath, plan.packetPath);
  }
  return { results, plan, packet, rows, children };
}
