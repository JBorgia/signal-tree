import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const read = p => JSON.parse(readFileSync(p, 'utf8'));
export const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const write = (p, value) => writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const verify = bindings => { for (const [p, hash] of Object.entries(bindings)) assert.equal(sha(p), hash, `Input drift: ${p}`); };
export const arms = ['C1', 'O16', 'K16', 'V15', 'K15'];
export const families = { v16: ['C1', 'O16', 'K16'], v15: ['V15', 'K15'] };
export const baselineFor = arm => arm === 'V15' || arm === 'K15' ? 'V15' : 'C1';
export const profiles = ['scalar', 'entity'].flatMap(shape => ['confirm', 'rollback'].map(settlement => ({ id: `${shape}-${settlement}`, shape, settlement, count: 128 })));
export const phaseNames = ['factory', 'openAll', 'openDrain', 'settlementCalls', 'settlementDrain', 'destroy'];
export const faultOracles = { 'wrong-value': 'value-oracle', 'wrong-order': 'order-oracle', 'skip-settlement': 'pending-oracle' };
export const ids = count => Array.from({ length: count }, (_, i) => i + 1);
export const row = i => ({ id: `r${i}`, value: i + 1, label: `value-${i}` });
export const scalar = i => [i + 1, i * 3];
export function expectedState(profile, remaining) {
  const count = profile.settlement === 'confirm' ? profile.count : remaining;
  return profile.shape === 'entity' ? Array.from({ length: count }, (_, i) => row(i)) :
    Object.fromEntries(Array.from({ length: profile.count }, (_, i) => [`s${i}`, i < count ? scalar(i) : []]));
}
export function inventory(root) {
  const result = {};
  const walk = p => { for (const name of readdirSync(p).sort()) {
    const next = join(p, name), stat = lstatSync(next);
    assert.ok(!stat.isSymbolicLink(), `No unbound symlink: ${next}`);
    if (stat.isDirectory()) walk(next);
    else { assert.ok(stat.isFile()); result[relative(root, next).split(sep).join('/')] = sha(next); }
  } };
  walk(root); return result;
}
export function freshOutside(path, protectedRoots) {
  path = resolve(path);
  for (const root of protectedRoots.map(p => resolve(p))) assert.ok(path !== root && !path.startsWith(root + sep) && !root.startsWith(path + sep), `Output overlaps input: ${path} / ${root}`);
  assert.ok(!existsSync(path), `Preserve earlier output: ${path}`); mkdirSync(path, { recursive: true }); return path;
}
export function admitKernel(item, arm) {
  const path = resolve(item.manifest), manifest = read(path);
  assert.match(item.manifestSha256, /^[a-f0-9]{64}$/); assert.equal(sha(path), item.manifestSha256);
  assert.deepEqual(inventory(manifest.root), manifest.files, `${arm} complete payload inventory`);
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256);
  const receipt = read(manifest.buildReceipt), sources = {}, bindings = { [path]: sha(path), [manifest.buildReceipt]: manifest.buildReceiptSha256 };
  assert.equal(receipt.exitCode, 0);
  for (const [name, hash] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = hash;
  if (manifest.kind === 'identified-built-kernel-v1') {
    assert.equal(receipt.sourceUnchanged, true); assert.equal(receipt.head, manifest.head);
    for (const [original, hash] of Object.entries(receipt.bindings)) {
      const name = relative(receipt.cwd, original);
      assert.ok(name && !name.startsWith('..') && !name.startsWith(sep));
      const snapshot = join(dirname(manifest.buildReceipt), 'source', name);
      assert.equal(receipt.snapshots[snapshot], hash); assert.equal(sha(snapshot), hash);
      bindings[snapshot] = hash; sources[name.split(sep).join('/')] = hash;
    }
    assert.equal(Object.keys(receipt.snapshots).length, Object.keys(sources).length);
    const patch = join(dirname(manifest.buildReceipt), 'source.patch'), log = join(dirname(manifest.buildReceipt), 'build.log');
    assert.equal(sha(patch), receipt.patchSha256); assert.equal(sha(log), receipt.logSha256);
    bindings[patch] = sha(patch); bindings[log] = sha(log);
    assert.equal(sources['packages/kernel/src/enhancers/transactions/transactions.ts'], item.transactionsSourceSha256);
  } else {
    assert.equal(arm, 'V15'); assert.equal(manifest.kind, 'verified-prior-canonical-kernel-v1');
    assert.equal(sha(manifest.canonicalReceipt), manifest.canonicalReceiptSha256);
    assert.equal(sha(manifest.archive), manifest.archiveSha256);
    const canonical = read(manifest.canonicalReceipt);
    assert.deepEqual(canonical.payloads.kernel, manifest.files); assert.equal(canonical.head, manifest.head);
    assert.equal(canonical.artifacts.kernel.sha256, manifest.archiveSha256);
    assert.equal(canonical.artifacts.kernel.sourceCommit, manifest.head);
    assert.equal(canonical.sourceSeal, manifest.sourceSeal); assert.equal(receipt.sourceSeal, manifest.sourceSeal);
    assert.equal(sha(receipt.log), receipt.logSha256);
    for (const p of [manifest.canonicalReceipt, manifest.archive, receipt.log]) bindings[p] = sha(p);
  }
  const pkg = read(join(manifest.root, 'package.json'));
  assert.equal(pkg.name, '@signal-tree/kernel');
  const major = Number(pkg.version.split('.')[0]); assert.equal(major, baselineFor(arm) === 'V15' ? 15 : 16);
  return { manifestPath: path, manifest, sources, bindings, major, transactionMethod: major === 15 ? 'transaction' : 'transact' };
}
export function requireIsolated(admitted) {
  const production = source => Object.fromEntries(Object.entries(source).filter(([name]) => !name.endsWith('.spec.ts') && !name.endsWith('.gc.ts') && !name.includes('/tests/') && name !== 'packages/kernel/src/enhancers/transactions/transactions.ts'));
  for (const arm of ['O16', 'K16']) assert.deepEqual(production(admitted[arm].sources), production(admitted.C1.sources), `${arm}: only transactions.ts and test-only source may differ`);
  const withoutTransaction = files => Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'dist/enhancers/transactions/transactions.js'));
  assert.deepEqual(withoutTransaction(admitted.K15.manifest.files), withoutTransaction(admitted.V15.manifest.files), 'Canonical v15 vs K15: every other package payload is byte-identical');
  assert.notEqual(admitted.K15.manifest.files['dist/enhancers/transactions/transactions.js'], admitted.V15.manifest.files['dist/enhancers/transactions/transactions.js']);
}
export function schedule(cohort) {
  const samples = [];
  if (cohort === 'cpu' || cohort === 'heap') {
    for (const [p, profile] of profiles.entries()) {
      for (let round = 0; round < (cohort === 'cpu' ? 3 : 1); round++) {
        const offset = (p + round) % arms.length;
        const order = [...arms.slice(offset), ...arms.slice(0, offset)]; if (round % 2) order.reverse();
        for (const arm of order) samples.push({ kind: cohort, arm, profile, round });
      }
    }
    for (const arm of ['C1', 'V15']) for (const shape of cohort === 'cpu' ? ['scalar', 'entity'] : ['entity'])
      for (let repeat = 0; repeat < 2; repeat++) samples.push({ kind: cohort, arm, profile: profiles.find(p => p.shape === shape && p.settlement === 'rollback'), round: 0, repeat, control: 'AA' });
    assert.equal(samples.length, cohort === 'cpu' ? 68 : 24);
  } else {
    assert.equal(cohort, 'controls');
    for (const arm of ['C1', 'V15']) {
      for (const id of ['scalar-confirm', 'entity-rollback']) samples.push({ kind: 'control', arm, profile: { ...profiles.find(p => p.id === id), count: 8 }, round: 0 });
      for (const [fault, id] of [['wrong-value', 'scalar-confirm'], ['wrong-order', 'entity-rollback'], ['skip-settlement', 'entity-rollback']])
        samples.push({ kind: 'control', arm, profile: { ...profiles.find(p => p.id === id), count: 8 }, round: 0, fault });
      samples.push({ kind: 'heap-control', arm, profile: { ...profiles.find(p => p.id === 'entity-rollback'), count: 8 }, round: 0, control: 'pin-release' });
    }
    assert.equal(samples.length, 12);
  }
  return samples.map((sample, index) => ({ index, ...sample }));
}
export function admitResult(result, sample, packetPath, packet, full = true) {
  assert.ok(result); assert.deepEqual(result.sample, sample);
  assert.equal(result.packetPath, packetPath); assert.equal(result.packetSha256, sha(packetPath));
  assert.equal(result.bundleSha256, packet.bundles[sample.arm].sha256); assert.deepEqual(result.node, packet.node);
  assert.equal(result.runnerSha256, packet.bindings[packet.runner]); assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0);
  assert.equal(Object.hasOwn(result, 'cleanupError'), false);
  if (!full) return;
  assert.equal(Object.hasOwn(result, 'error'), false);
  const { profile } = sample;
  assert.equal(result.oracles.empty.pending, 0); assert.equal(result.oracles.empty.confirmed, 0);
  assert.equal(result.oracles.empty.valuesSha256, digest(expectedState({ ...profile, settlement: 'rollback' }, 0)));
  assert.deepEqual(result.oracles.pending.ids, ids(profile.count));
  assert.equal(result.oracles.pending.valuesSha256, digest(expectedState(profile, profile.count)));
  assert.equal(result.oracles.pending.snapshotSha256, result.oracles.pending.valuesSha256);
  assert.equal(result.oracles.pending.pending, profile.count);
  assert.deepEqual(result.oracles.settled.ids, []); assert.equal(result.oracles.settled.pending, 0);
  assert.equal(result.oracles.settled.valuesSha256, digest(expectedState(profile, 0)));
  assert.equal(result.oracles.settled.confirmed, 0);
  assert.equal(result.oracles.settled.heldSnapshotSha256, result.oracles.pending.snapshotSha256);
  assert.equal(result.oracles.settled.pending, 0); assert.equal(result.destroyed, true);
  assert.equal(result.oracles.steps.length, profile.count);
  for (let step = 0; step < profile.count; step++) {
    const remaining = profile.count - step - 1, observed = result.oracles.steps[step];
    assert.deepEqual(observed.ids, ids(remaining));
    assert.equal(observed.turnId, remaining + 1);
    assert.equal(observed.valuesSha256, digest(expectedState(profile, remaining)));
    assert.equal(observed.heldSnapshotSha256, result.oracles.pending.snapshotSha256);
  }
  if (sample.kind === 'cpu') {
    assert.deepEqual(Object.keys(result.stages), phaseNames); assert.equal(result.settlementSamples.length, profile.count);
    for (const stage of [...Object.values(result.stages), ...result.settlementSamples]) {
      for (const n of [stage.elapsedNs, stage.cpuMs, stage.cpuMicroseconds.user, stage.cpuMicroseconds.system]) assert.ok(Number.isFinite(n) && n >= 0);
      assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000);
    }
    for (const key of ['elapsedNs', 'user', 'system']) {
      const observed = key === 'elapsedNs' ? result.stages.settlementCalls.elapsedNs : result.stages.settlementCalls.cpuMicroseconds[key];
      const expected = result.settlementSamples.reduce((n, s) => n + (key === 'elapsedNs' ? s.elapsedNs : s.cpuMicroseconds[key]), 0);
      assert.equal(observed, expected, 'Exact measured settlement interval sum');
    }
  } else { assert.deepEqual(result.stages, {}); assert.deepEqual(result.settlementSamples, []); }
  if (sample.kind === 'heap' || sample.kind === 'heap-control') {
    const names = ['moduleReady', 'empty', 'pending', 'settled', 'destroyedHeld', 'helperReturned'];
    if (sample.control === 'pin-release') names.push('pinReleased');
    assert.deepEqual(Object.keys(result.checkpoints), names);
    for (const point of Object.values(result.checkpoints)) assert.ok(Number.isSafeInteger(point.heapUsed) && point.heapUsed > 0);
    for (const name of ['empty', 'pending', 'settled', 'destroyedHeld']) assert.equal(result.checkpoints[name].alive.tree, true);
    assert.equal(result.checkpoints.pending.alive.payload, true);
    assert.equal(result.checkpoints.helperReturned.alive.tree, sample.control === 'pin-release');
    assert.equal(result.checkpoints.helperReturned.alive.payload, sample.control === 'pin-release');
    if (sample.control === 'pin-release') assert.deepEqual(result.checkpoints.pinReleased.alive, { tree: false, payload: false });
    // Settled/destroyed-held payload reachability is an observation, not a release deadline.
  }
}
export function childCommand(packet, packetPath, resultPath, sample) {
  return [packet.node.path, ...(['heap', 'heap-control'].includes(sample.kind) ? ['--expose-gc'] : []), packet.runner, 'child', packetPath, resultPath, JSON.stringify(sample)];
}
export function admitRun(resultPath) {
  const result = read(resultPath), plan = read(result.planPath), packet = read(plan.packetPath), closure = { [resultPath]: sha(resultPath), [result.planPath]: sha(result.planPath) }, children = [], pids = new Set();
  assert.equal(plan.kind, 'bucket-cost-plan-v1'); assert.equal(packet.kind, 'bucket-cost-packet-v1');
  assert.equal(sha(result.planPath), result.planSha256); assert.equal(sha(plan.packetPath), plan.packetSha256);
  verify(result.bindings); verify(plan.bindings); verify(packet.bindings);
  assert.deepEqual(result.bindings, plan.bindings); assert.deepEqual(plan.node, packet.node);
  assert.equal(plan.bindings[plan.packetPath], plan.packetSha256);
  for (const [p, hash] of Object.entries(packet.bindings)) assert.equal(plan.bindings[p], hash, 'Packet binding closure');
  Object.assign(closure, result.bindings);
  assert.deepEqual(plan.schedule, schedule(plan.cohort)); assert.equal(result.passed, true); assert.equal(result.results.length, plan.schedule.length);
  for (const [index, invocation] of result.results.entries()) {
    const sample = plan.schedule[index], sidecar = join(dirname(resultPath), `invocation-${String(index).padStart(3, '0')}.json`);
    assert.deepEqual(read(sidecar), invocation); assert.deepEqual(invocation.sample, sample); assert.equal(invocation.passed, true);
    assert.equal(invocation.signal, null); assert.equal(invocation.processError, undefined); assert.equal(invocation.admissionError, undefined);
    assert.equal(sha(invocation.resultPath), invocation.resultSha256); assert.equal(sha(invocation.logPath), invocation.logSha256);
    const child = read(invocation.resultPath), fault = faultOracles[sample.fault];
    assert.deepEqual(invocation.command, childCommand(packet, plan.packetPath, invocation.resultPath, sample));
    admitResult(child, sample, plan.packetPath, packet, !fault);
    assert.ok(!pids.has(child.pid), 'Fresh child PID'); pids.add(child.pid);
    assert.equal(invocation.exitCode, fault ? 1 : 0); assert.equal(child.passed, !fault);
    if (fault) { assert.equal(child.detectedOracle, fault); assert.ok(child.error.includes(fault)); }
    for (const p of [sidecar, invocation.resultPath, invocation.logPath]) closure[p] = sha(p);
    children.push(child);
  }
  return { result, plan, packet, children, closure };
}
