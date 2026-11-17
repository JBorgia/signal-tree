#!/usr/bin/env node
// Bounded G experiment. Reuse already-built runtime-screen production bundles.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runner = fileURLToPath(import.meta.url), protocol = join(dirname(runner), 'getter-demand-protocol.md');
const [mode, ...args] = process.argv.slice(2);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = path => hash(readFileSync(path));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const fresh = path => { assert(!existsSync(path), `Preserve prior output: ${path}`); mkdirSync(path, { recursive: true }); };
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const describe = value => { try { return value?.stack ?? String(value); } catch { return '<unprintable thrown value>'; } };
const verify = bindings => { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
const sources = () => ({ [runner]: sha(runner), [protocol]: sha(protocol) });
const add = (bindings, path, value = sha(path)) => { if (owns(bindings, path)) assert.equal(bindings[path], value, 'Conflicting input binding'); bindings[path] = value; };
const inventory = root => { const files = {}; const walk = (dir, prefix = '') => { for (const entry of readdirSync(dir, { withFileTypes: true })) { assert(!entry.isSymbolicLink()); const name = prefix + entry.name; if (entry.isDirectory()) walk(join(dir, entry.name), name + '/'); else { assert(entry.isFile()); files[name] = sha(join(dir, entry.name)); } } }; walk(root); return files; };
const stages = ['population', 'handles', 'wholeRead0', 'demandOne', 'getterOne', 'heldOne', 'demandAll', 'getterAll', 'heldAll', 'destroy'];
const checkpoints = ['module', 'populated', 'handles', 'whole0', 'one', 'all', 'afterSemantics', 'destroyed'];
const expectedChecks = ['population', 'descriptors', 'whole0', 'one-values', 'one-getter-identity', 'one-held-values', 'all-values', 'all-getter-identity', 'all-held-values', 'twelve-edits', 'rekey', 'retirement', 'new-lifetime'];
const faults = { 'field-value': 'field-value-oracle', 'wrong-getter-identity': 'getter-identity-oracle', 'retain-pin': 'released-carrier-oracle' };
const turns = () => new Promise(yes => setImmediate(yes));
const stats = values => { const sorted = [...values].sort((a, b) => a - b); assert(sorted.length && sorted.every(Number.isFinite)); return { n: sorted.length, median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, min: sorted[0], max: sorted.at(-1) }; };

export function scheduleFor(kind) {
  const schedule = [];
  if (kind === 'controls') {
    for (const arm of ['baseline', 'candidate']) for (const [sampleKind, fault] of [['timing', null], ['timing', 'field-value'], ['timing', 'wrong-getter-identity'], ['memory', null], ['memory', 'retain-pin']]) schedule.push({ arm, width: 8, kind: sampleKind, round: 0, fault, pinControl: sampleKind === 'memory' });
  } else {
    assert.equal(kind, 'compare');
    for (const [profile, width] of [8, 32, 128].entries()) for (let round = 0; round < 3; round++) {
      for (const arm of (profile + round) % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) for (const sampleKind of ['timing', 'memory']) schedule.push({ arm, width, kind: sampleKind, round });
      if (round === 1) for (const repeat of [0, 1]) for (const sampleKind of ['timing', 'memory']) schedule.push({ arm: 'baseline', width, kind: sampleKind, round, repeat, control: 'AA' });
    }
  }
  return schedule;
}
function executionFor(path, packet) {
  const bindings = { ...packet.toolSources, [packet.node.path]: packet.node.sha256, [packet.bundle.path]: packet.bundle.sha256 };
  for (const [name, value] of Object.entries(packet.packageFiles)) add(bindings, join(packet.packageRoot, name), value);
  return { kind: 'getter-demand-execution-v1', packetPath: path, packetSha256: sha(path), packageRoot: packet.packageRoot, packageFiles: packet.packageFiles, bundle: packet.bundle, node: packet.node, toolSources: packet.toolSources, bindings };
}
function executionAt(directory) {
  const executionPath = join(resolve(directory), 'execution.json'), packet = read(executionPath);
  assert.equal(packet.kind, 'getter-demand-execution-v1'); assert.deepEqual(packet.toolSources, sources());
  assert.equal(packet.node.path, realpathSync(process.execPath)); assert.equal(packet.node.version, process.version); assert.equal(packet.node.sha256, sha(packet.node.path));
  verify(packet.bindings); assert.deepEqual(inventory(packet.packageRoot), packet.packageFiles);
  return { path: packet.packetPath, packet, executionPath, executionSha256: sha(executionPath) };
}
function packetAt(directory) {
  const path = join(resolve(directory), 'packet.json'), packet = read(path);
  assert.equal(packet.kind, 'getter-demand-bound-packet-v1'); assert.deepEqual(packet.toolSources, sources());
  assert.equal(packet.node.path, realpathSync(process.execPath)); assert.equal(packet.node.version, process.version); assert.equal(packet.node.sha256, sha(packet.node.path));
  verify(packet.bindings); assert.deepEqual(inventory(packet.packageRoot), packet.packageFiles);
  assert.equal(packet.bundle.nativeModule, true); assert.equal(packet.bindings[packet.bundle.path], packet.bundle.sha256);
  assert.deepEqual(read(join(resolve(directory), 'execution.json')), executionFor(path, packet), 'Compact execution derivation');
  return { path, packet };
}
function inputsFor(packets) {
  const inputs = { ...sources() }; let common;
  for (const directory of Object.values(packets)) { const { path, packet } = packetAt(directory); add(inputs, path); add(inputs, join(directory, 'execution.json')); for (const [key, value] of Object.entries(packet.bindings)) add(inputs, key, value); if (common) assert.deepEqual(packet.sharedBuildInputs, common, 'Same exact build dependencies'); else common = packet.sharedBuildInputs; }
  return inputs;
}
function metrics(child) {
  assert.deepEqual(child.checks, expectedChecks); assert.equal(child.handles, 512); assert.equal(child.edits, 12);
  assert.equal(child.fieldsPerRow, child.sample.width); assert.equal(child.oneDemand, 512); assert.equal(child.allDemand, 512 * child.sample.width);
  assert.deepEqual(child.readCounts, { whole0: 512, getterOne: 512 * 16, heldOne: 512 * 16, getterAll: 512 * child.sample.width * 4, heldAll: 512 * child.sample.width * 4 });
  for (const name of ['initial', 'final']) assert.match(child.digests[name], /^[a-f0-9]{64}$/);
  const result = {};
  if (child.sample.kind === 'timing') {
    assert.deepEqual(Object.keys(child.stages), stages); assert.deepEqual(child.heap, []);
    for (const [name, stage] of Object.entries(child.stages)) { for (const value of [stage.elapsedNs, stage.cpuMs, stage.cpuMicroseconds?.user, stage.cpuMicroseconds?.system]) assert(Number.isFinite(value) && value >= 0); assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000); result[name + '.cpuMs'] = stage.cpuMs; result[name + '.elapsedMs'] = stage.elapsedNs / 1e6; }
  } else {
    assert.equal(child.sample.kind, 'memory'); assert.deepEqual(child.stages, {}); assert.deepEqual(child.heap.map(value => value.name), checkpoints);
    const values = {};
    for (const value of child.heap) { assert(Number.isSafeInteger(value.heapUsed) && value.heapUsed >= 0); values[value.name] = value.heapUsed; result['heap.' + value.name] = value.heapUsed; }
    for (const [name, after, before] of [['handlesDelta', 'handles', 'populated'], ['oneDemandDelta', 'one', 'whole0'], ['allDemandDelta', 'all', 'whole0'], ['destroyedAboveModule', 'destroyed', 'module']]) result['heap.' + name] = values[after] - values[before];
  }
  if (child.sample.pinControl) { assert.deepEqual(child.pinControl, { presentWhilePinned: true, absentAfterRelease: true, rowAlive: true }); }
  return result;
}
const commandFor = (packet, result, sample) => [process.execPath, ...(sample.kind === 'memory' ? ['--expose-gc'] : []), runner, 'child', packet, result, JSON.stringify(sample)];
function admitChild(child, sample, packetDirectory, complete) {
  assert(child); assert.deepEqual(child.sample, sample); const { path, packet } = packetAt(packetDirectory);
  assert.equal(child.packetPath, path); assert.equal(child.packetSha256, sha(path)); assert.equal(child.executionPath, join(packetDirectory, 'execution.json')); assert.equal(child.executionSha256, sha(child.executionPath)); assert.equal(child.bundleSha256, packet.bundle.sha256);
  assert.equal(child.node, packet.node.version); assert.equal(child.nodeExecutableSha256, packet.node.sha256); assert(Number.isInteger(child.pid) && child.pid > 0);
  if (complete) metrics(child);
}
function validOutcome(invocation, child, expected) {
  return !owns(invocation, 'admissionError') && !owns(invocation, 'spawnError') && invocation.signal === null && child !== null && !owns(child, 'cleanupError') && (expected ? invocation.exitCode === 1 && child.passed === false && child.detectedOracle === expected : invocation.exitCode === 0 && child.passed === true);
}
function admitRun(path, kind, packets) {
  const result = read(path), schedule = read(result.schedulePath), expectedInputs = inputsFor(packets), out = dirname(resolve(path));
  assert.equal(result.kind, kind); assert.equal(result.passed, true); assert.equal(result.scheduleSha256, sha(result.schedulePath)); assert.deepEqual(schedule.packets, packets); assert.deepEqual(schedule.schedule, scheduleFor(kind));
  if (kind === 'compare') { assert.equal(typeof schedule.controls, 'string'); add(expectedInputs, schedule.controls); } else assert.equal(schedule.controls, undefined);
  assert.deepEqual(result.bindings, expectedInputs); assert.deepEqual(schedule.bindings, expectedInputs); assert.deepEqual(schedule.toolSources, sources()); verify(expectedInputs);
  assert.deepEqual(schedule.command, [process.execPath, runner, kind, packets.baseline, packets.candidate, out, ...(kind === 'compare' ? [schedule.controls] : [])]);
  assert.equal(result.results.length, schedule.schedule.length); const children = [], pids = new Set();
  for (const [index, invocation] of result.results.entries()) {
    const sample = schedule.schedule[index], resultPath = join(out, `child-${index}.json`), sidecar = join(out, `invocation-${index}.json`);
    assert.deepEqual(invocation.sample, sample); assert.equal(invocation.resultPath, resultPath); assert.equal(invocation.log, resultPath + '.log'); assert.equal(invocation.invocationPath, sidecar); assert.equal(invocation.invocationSha256, sha(sidecar));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Omit the sidecar location and its own hash from the exact sidecar payload.
    const { invocationPath, invocationSha256, ...record } = invocation; assert.deepEqual(read(sidecar), record); assert.deepEqual(invocation.command, commandFor(packets[sample.arm], resultPath, sample));
    assert.equal(invocation.resultSha256, sha(resultPath)); assert.equal(invocation.logSha256, sha(invocation.log)); const child = read(resultPath);
    admitChild(child, sample, packets[sample.arm], !faults[sample.fault]); assert(invocation.passed); assert(validOutcome(invocation, child, faults[sample.fault])); assert(!pids.has(child.pid)); pids.add(child.pid); children.push(child);
  }
  return { result, schedule, children };
}

if (mode === 'prepare') {
  const [inputArg, outArg] = args; assert(inputArg && outArg); const inputPath = join(resolve(inputArg), 'packet.json'), input = read(inputPath), out = resolve(outArg);
  assert.equal(input.kind, 'optimization-runtime-screen-packet-v1'); verify(input.bindings);
  const manifestPath = input.manifestPath, manifest = read(manifestPath), bundle = input.bundles['native-loaded']; assert(bundle?.nativeModule); assert.equal(input.bindings[manifestPath], sha(manifestPath));
  assert.deepEqual(inventory(manifest.root), manifest.files); assert.equal(Object.keys(manifest.files).length, 144); assert.equal(read(join(manifest.root, 'package.json')).name, '@signal-tree/kernel'); assert.match(read(join(manifest.root, 'package.json')).version, /^16\./);
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256); const build = read(manifest.buildReceipt); assert.equal(build.exitCode, 0); assert.equal(input.sourceHead, manifest.head); if (build.head) assert.equal(build.head, manifest.head);
  const bindings = { ...sources(), ...input.bindings, [inputPath]: sha(inputPath), [manifest.buildReceipt]: manifest.buildReceiptSha256 };
  for (const [name, value] of Object.entries(manifest.files)) { assert.equal(input.bindings[join(manifest.root, name)], value); add(bindings, join(manifest.root, name), value); }
  // A build's mutable checkout paths are historical claims. Bind preserved snapshots.
  if (build.snapshots) for (const [path, value] of Object.entries(build.snapshots)) add(bindings, path, value);
  const node = { path: realpathSync(process.execPath), version: process.version, sha256: sha(realpathSync(process.execPath)) }; assert.equal(node.version, 'v24.15.0'); add(bindings, node.path, node.sha256);
  const sharedBuildInputs = Object.fromEntries(Object.entries(input.bindings).filter(([path]) => /\/node_modules\/.*(?:esbuild|@esbuild)\//.test(path) || /\/pnpm-lock\.yaml$/.test(path)).map(([path, value]) => [path, value]));
  assert(Object.keys(sharedBuildInputs).some(path => /esbuild\/lib\/main\.js$/.test(path))); assert(Object.keys(sharedBuildInputs).some(path => /\/bin\/esbuild$/.test(path))); assert(Object.keys(sharedBuildInputs).some(path => path.endsWith('/pnpm-lock.yaml')));
  assert.equal(bindings[bundle.path], bundle.sha256); const metaPath = join(dirname(bundle.path), 'native-loaded.meta.json'), meta = read(metaPath); assert.equal(bindings[metaPath], sha(metaPath));
  assert(Object.values(meta.outputs).some(value => Object.entries(value.inputs).some(([path, contribution]) => path.endsWith('/experimental-publication/entity.js') && contribution.bytesInOutput > 0)));
  verify(bindings); fresh(out); save(join(out, 'packet.json'), { kind: 'getter-demand-bound-packet-v1', runtimePacket: inputPath, manifestPath, sourceIdentity: { head: manifest.head, sourceSeal: manifest.sourceSeal, buildReceipt: manifest.buildReceipt }, packageRoot: manifest.root, packageFiles: manifest.files, bundle, node, sharedBuildInputs, bindings, toolSources: sources(), limits: 'Existing exact production native-loaded neutral runtime-screen bundle. No recipient/enhancer instantiated. Source metadata and preserved build snapshots are claims distinct from package-byte verification.' });
  const packetPath = join(out, 'packet.json'); save(join(out, 'execution.json'), executionFor(packetPath, read(packetPath)));
} else if (mode === 'child') {
  const [packetArg, outputArg, sampleArg] = args; const { path: packetPath, packet, executionPath, executionSha256 } = executionAt(packetArg), sample = JSON.parse(sampleArg);
  assert([8, 32, 128].includes(sample.width)); assert(['timing', 'memory'].includes(sample.kind));
  const { signalTree, entityMap } = await import(pathToFileURL(packet.bundle.path).href);
  const result = { sample, packetPath, packetSha256: packet.packetSha256, executionPath, executionSha256, bundleSha256: packet.bundle.sha256, node: process.version, nodeExecutableSha256: sha(process.execPath), pid: process.pid, host: { cpu: os.cpus()[0]?.model, platform: process.platform, arch: process.arch, load: os.loadavg(), freeBytes: os.freemem() }, stages: {}, heap: [], checks: [], digests: {}, readCounts: {}, handles: 512, fieldsPerRow: sample.width, passed: false };
  const keys = ['id', ...Array.from({ length: sample.width - 1 }, (_, index) => 'f' + index)], fixtures = [];
  const row = id => Object.fromEntries(keys.map((key, index) => [key, index === 0 ? id : id * sample.width + index]));
  const check = (value, oracle) => { if (!value) { const error = new Error(oracle); error.oracle = oracle; throw error; } };
  const timed = (name, work) => { if (sample.kind === 'memory') return work(); const cpu = process.cpuUsage(), start = process.hrtime.bigint(), value = work(), elapsedNs = Number(process.hrtime.bigint() - start), used = process.cpuUsage(cpu); result.stages[name] = { elapsedNs, cpuMicroseconds: used, cpuMs: (used.user + used.system) / 1000 }; return value; };
  const gc = async () => { assert.equal(typeof global.gc, 'function'); for (let i = 0; i < 3; i++) { await turns(); global.gc(); } await turns(); };
  const heap = async name => { if (sample.kind === 'memory') { await gc(); result.heap.push({ name, ...process.memoryUsage() }); } };
  const digest = () => hash(JSON.stringify(fixtures.map(fixture => fixture.handles.map(handle => handle()))));
  const expectedSum = fields => { let value = 0; for (let t = 0; t < 2; t++) for (let id = 0; id < 256; id++) for (const key of fields) value += key === 'id' ? id : id * sample.width + Number(key.slice(1)) + 1; return value; };
  try {
    await heap('module');
    timed('population', () => { for (let t = 0; t < 2; t++) { const tree = signalTree({ rows: entityMap({ selectId: value => value.id }) }); fixtures.push({ tree, handles: [], one: [], all: [] }); tree.$.rows.setAll(Array.from({ length: 256 }, (_, id) => row(id))); } });
    check(fixtures.length === 2 && fixtures.every(fixture => fixture.tree.$.rows.count() === 256), 'population-oracle'); result.checks.push('population'); await heap('populated');
    timed('handles', () => { for (const fixture of fixtures) fixture.handles = Array.from({ length: 256 }, (_, id) => fixture.tree.$.rows.byIdOrFail(id)); });
    (() => { for (const fixture of fixtures) for (const handle of fixture.handles) for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(handle, key); check(typeof descriptor?.get === 'function' && descriptor.enumerable && descriptor.configurable && descriptor.set === undefined, 'descriptor-oracle'); } })(); result.checks.push('descriptors'); await heap('handles');
    const wholeSum = timed('wholeRead0', () => { let sum = 0; for (const fixture of fixtures) for (const handle of fixture.handles) { const value = handle(); for (const key of keys) sum += value[key]; } return sum; });
    check(wholeSum === expectedSum(keys), 'whole-value-oracle');
    (() => { for (const fixture of fixtures) for (let id = 0; id < 256; id++) { const value = fixture.handles[id](); check(Object.keys(value).length === keys.length, 'whole-value-oracle'); for (let k = 0; k < keys.length; k++) check(value[keys[k]] === (k === 0 ? id : id * sample.width + k), 'whole-value-oracle'); } })(); result.digests.initial = digest(); result.readCounts.whole0 = 512; result.checks.push('whole0'); await heap('whole0');
    timed('demandOne', () => { for (const fixture of fixtures) fixture.one = fixture.handles.map(handle => handle.f0); }); result.oneDemand = 512;
    if (sample.fault === 'field-value') fixtures[0].tree.$.rows.updateOne(0, { f0: -1 });
    (() => { for (const fixture of fixtures) for (let id = 0; id < 256; id++) check(fixture.one[id]() === id * sample.width + 1, 'field-value-oracle'); })(); result.checks.push('one-values');
    const oneIdentity = timed('getterOne', () => { let matches = 0; for (let repeat = 0; repeat < 16; repeat++) for (const fixture of fixtures) for (let id = 0; id < 256; id++) { const carrier = sample.fault === 'wrong-getter-identity' && repeat === 0 && id === 0 ? fixture.handles[1].f0 : fixture.handles[id].f0; matches += Number(carrier === fixture.one[id]); } return matches; });
    check(oneIdentity === 512 * 16, 'getter-identity-oracle'); result.readCounts.getterOne = oneIdentity; result.checks.push('one-getter-identity');
    const oneSum = timed('heldOne', () => { let sum = 0; for (let repeat = 0; repeat < 16; repeat++) for (const fixture of fixtures) for (const carrier of fixture.one) sum += carrier(); return sum; });
    check(oneSum === expectedSum(['f0']) * 16, 'field-value-oracle'); result.readCounts.heldOne = 512 * 16; result.checks.push('one-held-values'); await heap('one');
    timed('demandAll', () => { for (const fixture of fixtures) fixture.all = fixture.handles.map(handle => keys.map(key => handle[key])); }); result.allDemand = 512 * sample.width;
    (() => { for (const fixture of fixtures) for (let id = 0; id < 256; id++) for (let k = 0; k < keys.length; k++) { check(fixture.all[id][k]() === (k === 0 ? id : id * sample.width + k), 'field-value-oracle'); if (keys[k] === 'f0') check(fixture.all[id][k] === fixture.one[id], 'getter-identity-oracle'); } })(); result.checks.push('all-values');
    const allIdentity = timed('getterAll', () => { let matches = 0; for (let repeat = 0; repeat < 4; repeat++) for (const fixture of fixtures) for (let id = 0; id < 256; id++) for (let k = 0; k < keys.length; k++) matches += Number(fixture.handles[id][keys[k]] === fixture.all[id][k]); return matches; });
    check(allIdentity === 512 * sample.width * 4, 'getter-identity-oracle'); result.readCounts.getterAll = allIdentity; result.checks.push('all-getter-identity');
    const allSum = timed('heldAll', () => { let sum = 0; for (let repeat = 0; repeat < 4; repeat++) for (const fixture of fixtures) for (const fields of fixture.all) for (const carrier of fields) sum += carrier(); return sum; });
    check(allSum === expectedSum(keys) * 4, 'field-value-oracle'); result.readCounts.heldAll = 512 * sample.width * 4; result.checks.push('all-held-values'); await heap('all');
    // All lifecycle mutations/oracles follow the timed phases.
    for (let edit = 0; edit < 12; edit++) { const fixture = fixtures[edit % 2], id = (edit * 19) % 256, value = 100000 + edit; fixture.tree.$.rows.updateOne(id, { f0: value }); check(fixture.one[id]() === value && fixture.handles[id]().f0 === value && fixture.all[id][1]() === value, 'edited-field-oracle'); } result.edits = 12; result.checks.push('twelve-edits');
    (() => { for (const [t, fixture] of fixtures.entries()) { const moved = 'moved-' + t, old = fixture.handles[0], carrier = fixture.one[0]; fixture.tree.$.rows.changeId(0, moved); check(fixture.tree.$.rows.byIdOrFail(moved) === old && old.id() === 0 && old.f0 === carrier, 'rekey-oracle'); carrier(200000 + t); check(fixture.tree.$.rows.byIdOrFail(moved)().f0 === 200000 + t, 'rekey-oracle'); } })(); result.checks.push('rekey');
    (() => { for (const [t, fixture] of fixtures.entries()) { const moved = 'moved-' + t, old = fixture.handles[0], carrier = fixture.one[0]; fixture.tree.$.rows.removeOne(moved); check(old() === undefined && carrier() === undefined, 'retirement-oracle'); let refused = false; try { carrier(-1); } catch (error) { refused = String(error).includes('not found'); } check(refused, 'retirement-oracle'); fixture.tree.$.rows.addOne({ ...row(0), id: moved, f0: 300000 + t }); const replacement = fixture.tree.$.rows.byIdOrFail(moved); check(replacement !== old && replacement.f0 !== carrier && replacement.f0() === 300000 + t && carrier() === undefined, 'new-lifetime-oracle'); } })(); result.checks.push('retirement', 'new-lifetime'); result.digests.final = digest(); await heap('afterSemantics');
    if (sample.pinControl) {
      // Real carrier deletion, kept alive deliberately then released while row/tree live.
      let control;
      try {
        control = (() => { const tree = signalTree({ rows: entityMap({ selectId: value => value.id }) }); tree.$.rows.addOne({ id: 1, value: 7 }); const handle = tree.$.rows.byIdOrFail(1), pin = handle.value, weak = new WeakRef(pin); Reflect.deleteProperty(handle, 'value'); return { tree, handle, pin, weak }; })();
        await gc(); check(control.weak.deref() !== undefined, 'pinned-carrier-oracle');
        if (sample.fault !== 'retain-pin') control.pin = undefined;
        await gc(); check(control.weak.deref() === undefined, 'released-carrier-oracle'); check(control.handle().value === 7 && control.tree.$.rows.count() === 1, 'live-row-oracle');
        result.pinControl = { presentWhilePinned: true, absentAfterRelease: true, rowAlive: true };
      } finally { control?.tree.destroy(); control = undefined; }
    }
    timed('destroy', () => { for (const fixture of fixtures) fixture.tree.destroy(); fixtures.length = 0; }); await heap('destroyed');
    verify(packet.bindings); metrics(result); result.passed = true;
  } catch (error) { result.error = describe(error); try { result.detectedOracle = error?.oracle; } catch { /* A throwing oracle accessor must not replace the already recorded primary failure. */ } }
  finally { try { for (const fixture of fixtures) fixture.tree.destroy(); fixtures.length = 0; } catch (error) { result.cleanupError = describe(error); result.passed = false; } save(resolve(outputArg), result); }
  if (!result.passed) process.exitCode = 1;
} else if (mode === 'controls' || mode === 'compare') {
  const [baselineArg, candidateArg, outArg, controlsArg] = args; assert(baselineArg && candidateArg && outArg);
  const packets = { baseline: resolve(baselineArg), candidate: resolve(candidateArg) }, out = resolve(outArg), bindings = inputsFor(packets); let controls;
  if (mode === 'compare') { assert(controlsArg); controls = resolve(controlsArg); admitRun(controls, 'controls', packets); add(bindings, controls); }
  fresh(out); const schedule = scheduleFor(mode), schedulePath = join(out, 'schedule.json');
  save(schedulePath, { kind: mode, packets, toolSources: sources(), bindings, controls, command: [process.execPath, runner, mode, packets.baseline, packets.candidate, out, ...(controls ? [controls] : [])], schedule });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const resultPath = join(out, `child-${index}.json`), command = commandFor(packets[sample.arm], resultPath, sample), child = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 180000, env: { ...process.env, NODE_ENV: 'production' } });
    const log = resultPath + '.log'; writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const value = existsSync(resultPath) ? read(resultPath) : null, record = { sample, command, exitCode: child.status, signal: child.signal, resultPath, resultSha256: value ? sha(resultPath) : null, log, logSha256: sha(log) };
    if (child.error !== undefined) record.spawnError = describe(child.error);
    try { admitChild(value, sample, packets[sample.arm], !faults[sample.fault]); } catch (error) { record.admissionError = describe(error); }
    record.passed = validOutcome(record, value, faults[sample.fault]); const invocationPath = join(out, `invocation-${index}.json`); save(invocationPath, record); results.push({ ...record, invocationPath, invocationSha256: sha(invocationPath) });
    console.log(JSON.stringify({ index, ...sample, passed: record.passed })); if (!record.passed) break;
  }
  verify(bindings); const passed = results.length === schedule.length && results.every(value => value.passed); save(join(out, 'results.json'), { kind: mode, passed, schedulePath, scheduleSha256: sha(schedulePath), bindings, results }); if (!passed) process.exitCode = 1;
} else if (mode === 'analyze') {
  const [baselineArg, candidateArg, resultsArg, outArg] = args; const packets = { baseline: resolve(baselineArg), candidate: resolve(candidateArg) }, path = resolve(resultsArg), admitted = admitRun(path, 'compare', packets), out = resolve(outArg); admitRun(admitted.schedule.controls, 'controls', packets);
  const groups = [], pairs = [], aa = [];
  for (const width of [8, 32, 128]) for (const kind of ['timing', 'memory']) {
    const select = arm => admitted.children.filter(child => child.sample.width === width && child.sample.kind === kind && child.sample.arm === arm && !child.sample.control).sort((a, b) => a.sample.round - b.sample.round), baseline = select('baseline'), candidate = select('candidate');
    assert.deepEqual(baseline.map(value => value.sample.round), [0, 1, 2]); assert.deepEqual(candidate.map(value => value.sample.round), [0, 1, 2]); for (let i = 0; i < 3; i++) assert.deepEqual(baseline[i].digests, candidate[i].digests);
    const bm = baseline.map(metrics), cm = candidate.map(metrics), keys = Object.keys(bm[0]);
    for (const [arm, values] of [['baseline', bm], ['candidate', cm]]) groups.push({ width, kind, arm, metrics: Object.fromEntries(keys.map(key => [key, stats(values.map(value => value[key]))])) });
    pairs.push({ width, kind, differences: Object.fromEntries(keys.map(key => [key, { ...stats(cm.map((value, i) => value[key] - bm[i][key])), values: cm.map((value, i) => ({ baseline: bm[i][key], candidate: value[key] })) }])) });
    const controls = admitted.children.filter(child => child.sample.width === width && child.sample.kind === kind && child.sample.control === 'AA').sort((a, b) => a.sample.repeat - b.sample.repeat); assert.deepEqual(controls.map(value => value.sample.repeat), [0, 1]); const [a, b] = controls.map(metrics); assert.deepEqual(controls[0].digests, controls[1].digests);
    aa.push({ width, kind, differences: Object.fromEntries(keys.map(key => [key, b[key] - a[key]])) });
  }
  fresh(out); save(join(out, 'summary.json'), { source: sources(), resultPath: path, resultSha256: sha(path), groups, pairs, aa, limits: ['Three descriptive paired samples and one A/A pair per width/kind. Partial positional balance; no significance claim.', 'Zero/one/all field demand are successive states of the same512 live handles, not independent populations.', 'Getter stages include identity-match accumulation; held-carrier stages include value accumulation. Assertions run outside timers.', 'Memory is separate whole-process finite forced-GC observation, not allocation/retainer attribution or universal collection proof.', 'Native module loaded without recipients/enhancer instances. No Angular/application or full native coordination cost claim.'] });
  save(join(out, 'receipt.json'), { command: [process.execPath, ...process.argv.slice(1)], summarySha256: sha(join(out, 'summary.json')), resultsSha256: sha(path), bindings: admitted.result.bindings });
} else if (mode) throw Error('prepare RUNTIME_PACKET OUT | controls BASE CANDIDATE OUT | compare BASE CANDIDATE OUT CONTROLS_RESULTS | analyze BASE CANDIDATE RESULTS OUT');
