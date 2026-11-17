#!/usr/bin/env node
// Isolated neutral asMap experiment; never edits the runtime or runtime-screen.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runner = fileURLToPath(import.meta.url), protocol = join(dirname(runner), 'direct-map-protocol.md');
const [mode, ...args] = process.argv.slice(2);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const sha = path => hash(readFileSync(path));
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const describeError = error => { try { return typeof error?.stack === 'string' ? error.stack : String(error); } catch { return '<unprintable thrown value>'; } };
const errorOracle = error => { try { return error?.oracle; } catch { return undefined; } };
const successfulInvocation = (invocation, child, expected) => !owns(invocation, 'admissionError') && !owns(invocation, 'spawnError') && invocation.signal === null && child !== null && !owns(child, 'cleanupError') && (expected ? invocation.exitCode === 1 && child.passed === false && child.detectedOracle === expected : invocation.exitCode === 0 && child.passed === true);
const childCommand = (packet, resultPath, sample) => [process.execPath, '--expose-gc', runner, 'child', packet, resultPath, JSON.stringify(sample)];
function packetBindings(packetPaths) {
  const bindings = { ...source() };
  let buildToolchain;
  for (const directory of Object.values(packetPaths)) { const { path, packet } = packetAt(directory);
    if (buildToolchain) assert.deepEqual(packet.buildToolchain, buildToolchain, 'Shared exact build toolchain'); else buildToolchain = packet.buildToolchain; bindings[path] = sha(path); bindings[join(directory, 'execution.json')] = sha(join(directory, 'execution.json')); for (const [name, digest] of Object.entries(packet.bindings)) { if (owns(bindings, name)) assert.equal(bindings[name], digest, 'Conflicting packet input'); bindings[name] = digest; } }
  return bindings;
}
function requiredBindings(schedule, packetPaths, mode) {
  const bindings = packetBindings(packetPaths);
  if (mode === 'compare') { assert.equal(typeof schedule.controls, 'string'); bindings[schedule.controls] = sha(schedule.controls); }
  else assert.equal(schedule.controls, undefined);
  return bindings;
}
function admitInvocation(invocation, index, out, sample, packetPaths, child) {
  const resultPath = join(out, `child-${index}.json`), sidecar = join(out, `invocation-${index}.json`);
  assert.equal(invocation.resultPath, resultPath); assert.equal(invocation.log, resultPath + '.log');
  assert.equal(invocation.invocationPath, sidecar); assert.equal(sha(sidecar), invocation.invocationSha256);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Omit the sidecar location and its own hash from the exact sidecar payload.
  const { invocationPath, invocationSha256, ...record } = invocation; assert.deepEqual(read(sidecar), record, 'Invocation sidecar mismatch');
  assert.deepEqual(invocation.command, childCommand(packetPaths[sample.arm], resultPath, sample), 'Exact child command');
  assert(successfulInvocation(invocation, child, faults[sample.fault]), 'Invocation failed or contains an unrelated error');
}
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const fresh = path => { assert(!existsSync(path), `Preserve prior output: ${path}`); mkdirSync(path, { recursive: true }); };
const verify = bindings => { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
const source = () => ({ [runner]: sha(runner), [protocol]: sha(protocol) });
const inventory = root => {
  const files = {};
  const walk = (directory, prefix = '') => { for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name, path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected payload alias');
    if (entry.isDirectory()) walk(path, relative + '/'); else { assert(entry.isFile()); files[relative] = sha(path); }
  } };
  walk(root); return files;
};
const stages = ['emptyTree', 'population', 'firstMap', 'cachedMapReads', 'editsAndMap', 'destroy'];
const heaps = ['module', 'populated', 'firstHeld', 'editsHeld', 'initialReleased', 'semanticWork', 'destroyed'];
const faults = { 'missing-row': 'population-oracle', 'wrong-value': 'map-value-oracle', 'stale-map': 'map-value-oracle', 'snapshot-corruption': 'held-snapshot-oracle', 'rekey-skipped': 'rekey-oracle', 'omission-skipped': 'absence-oracle' };
const nextTurn = () => new Promise(yes => setImmediate(yes));
const stats = values => { const sorted = [...values].sort((a, b) => a - b); assert(sorted.length && sorted.every(Number.isFinite)); return { n: sorted.length, median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, min: sorted[0], max: sorted.at(-1) }; };

export function scheduleFor(kind) {
  const schedule = [];
  if (kind === 'controls') {
    for (const arm of ['baseline', 'candidate']) for (const activation of ['bare', 'modules-loaded']) for (const fault of [null, ...Object.keys(faults)]) schedule.push({ arm, activation, rows: 100, width: 8, round: 0, kind: 'timing', fault });
    return schedule;
  }
  assert.equal(kind, 'compare'); let profile = 0;
  for (const width of [8, 32]) for (const activation of ['bare', 'modules-loaded']) {
    for (let round = 0; round < 3; round++) {
      for (const arm of (round + profile) % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
        for (const sampleKind of ['timing', 'memory']) schedule.push({ arm, activation, rows: 10000, width, round, kind: sampleKind });
      if (round !== 1) for (const repeat of [0, 1]) for (const sampleKind of ['timing', 'memory']) schedule.push({ arm: 'baseline', activation, rows: 10000, width, round, repeat, kind: sampleKind, control: 'AA' });
    }
    profile++;
  }
  return schedule;
}
function executionFor(packetPath, packet) {
  const bindings = { ...packet.toolSources, [packet.node.path]: packet.node.sha256 };
  for (const [name, value] of Object.entries(packet.packageFiles)) bindings[join(packet.packageRoot, name)] = value;
  for (const bundle of Object.values(packet.bundles)) bindings[bundle.path] = bundle.sha256;
  return { kind: 'direct-map-execution-v1', packetPath, packetSha256: sha(packetPath), packageRoot: packet.packageRoot, packageFiles: packet.packageFiles, node: packet.node, toolSources: packet.toolSources, bundles: packet.bundles, bindings };
}
function executionAt(directory) {
  const executionPath = join(resolve(directory), 'execution.json'), packet = read(executionPath);
  assert.equal(packet.kind, 'direct-map-execution-v1'); assert.deepEqual(packet.toolSources, source());
  assert.equal(packet.node.path, realpathSync(process.execPath)); assert.equal(packet.node.version, process.version); assert.equal(packet.node.sha256, sha(packet.node.path));
  verify(packet.bindings); assert.deepEqual(inventory(packet.packageRoot), packet.packageFiles);
  return { path: packet.packetPath, packet, executionPath, executionSha256: sha(executionPath) };
}
function packetAt(directory) {
  const path = join(resolve(directory), 'packet.json'), packet = read(path);
  assert.equal(packet.kind, 'direct-map-packet-v1'); assert.deepEqual(packet.toolSources, source());
  assert.equal(realpathSync(process.execPath), packet.node.path); assert.equal(process.version, packet.node.version);
  assert.equal(sha(packet.node.path), packet.node.sha256); verify(packet.bindings);
  assert.deepEqual(inventory(packet.packageRoot), packet.packageFiles);
  assert.equal(typeof packet.buildToolchain?.esbuildVersion, 'string');
  for (const role of ['esbuildJS', 'esbuildPackage', 'esbuildBinary', 'manifest']) assert(packet.buildInputs[role]);
  assert(Object.keys(packet.buildInputs).some(role => role.startsWith('lock:')));
  for (const [role, value] of Object.entries(packet.buildInputs)) { assert.equal(packet.bindings[value.path], value.sha256); assert.equal(packet.buildToolchain[role], value.sha256); }
  assert.deepEqual(read(join(resolve(directory), 'execution.json')), executionFor(path, packet), 'Compact execution derivation');
  return { path, packet };
}
function sampleMetrics(child) {
  const result = {};
  if (child.sample.kind === 'timing') {
    assert.deepEqual(Object.keys(child.stages), stages); assert.deepEqual(child.heap, []);
    for (const [name, value] of Object.entries(child.stages)) {
      for (const key of ['elapsedNs', 'cpuMs']) assert(Number.isFinite(value[key]) && value[key] >= 0, 'measurement-oracle');
      assert(Number.isFinite(value.cpuMicroseconds.user) && value.cpuMicroseconds.user >= 0);
      assert(Number.isFinite(value.cpuMicroseconds.system) && value.cpuMicroseconds.system >= 0);
      assert.equal(value.cpuMs, (value.cpuMicroseconds.user + value.cpuMicroseconds.system) / 1000);
      result[name + '.cpuMs'] = value.cpuMs; result[name + '.elapsedMs'] = value.elapsedNs / 1e6;
    }
  } else {
    assert.equal(child.sample.kind, 'memory'); assert.deepEqual(child.stages, {});
    assert.deepEqual(child.heap.map(value => value.name), heaps);
    const values = Object.fromEntries(child.heap.map(value => { assert(Number.isSafeInteger(value.heapUsed) && value.heapUsed >= 0); return [value.name, value.heapUsed]; }));
    for (const [name, value] of Object.entries(values)) result['heap.' + name] = value;
    for (const [name, after, before] of [['firstMapDelta', 'firstHeld', 'populated'], ['editedMapsDelta', 'editsHeld', 'populated'], ['releaseInitialDelta', 'initialReleased', 'editsHeld'], ['destroyedAboveModule', 'destroyed', 'module']]) result['heap.' + name] = values[after] - values[before];
  }
  assert.deepEqual(child.checks, ['population', 'first-map', 'cached-identity', 'forty-edits', 'held-snapshot', 'rekey', 'replacement', 'omission', 'reactivation']);
  for (const key of ['first', 'edited']) assert.match(child.digests[key], /^[a-f0-9]{64}$/);
  assert.equal(child.editCount, 40); assert.equal(child.cachedReadCount, 20);
  return result;
}
function admitChild(child, sample, packetPath, complete) {
  assert(child); assert.deepEqual(child.sample, sample);
  const packet = read(packetPath);
  assert.equal(child.packetPath, packetPath); assert.equal(child.packetSha256, sha(packetPath));
  assert.equal(child.executionPath, join(dirname(packetPath), 'execution.json')); assert.equal(child.executionSha256, sha(child.executionPath));
  assert.equal(child.bundleSha256, packet.bundles[sample.activation].sha256);
  assert.equal(child.node, process.version); assert.equal(child.nodeExecutableSha256, packet.node.sha256);
  assert(Number.isInteger(child.pid) && child.pid > 0);
  if (complete) sampleMetrics(child);
}
function admitRun(path, mode, packetPaths) {
  const result = read(path), schedule = read(result.schedulePath);
  assert.equal(result.mode, mode); assert.equal(result.passed, true); assert.equal(sha(result.schedulePath), result.scheduleSha256);
  assert.deepEqual(schedule.packets, packetPaths); assert.deepEqual(schedule.schedule, scheduleFor(mode));
  assert.deepEqual(result.bindings, schedule.bindings, 'Schedule input identity');
  assert.deepEqual(schedule.bindings, requiredBindings(schedule, packetPaths, mode), 'Complete mandatory packet input union');
  assert.deepEqual(schedule.toolSources, source()); verify(result.bindings);
  assert.deepEqual(schedule.command, [process.execPath, runner, mode, packetPaths.baseline, packetPaths.candidate, dirname(resolve(path)), ...(mode === 'compare' ? [schedule.controls] : [])], 'Exact cohort invocation');
  assert.equal(result.results.length, schedule.schedule.length);
  const pids = new Set(), children = [];
  for (const [index, invocation] of result.results.entries()) {
    const sample = schedule.schedule[index]; assert.deepEqual(invocation.sample, sample); assert(invocation.passed);
    assert.equal(sha(invocation.resultPath), invocation.resultSha256); assert.equal(sha(invocation.log), invocation.logSha256);
    const child = read(invocation.resultPath), expected = faults[sample.fault];
    admitChild(child, sample, join(packetPaths[sample.arm], 'packet.json'), !expected);
    assert(!pids.has(child.pid), 'Fresh process PID repeated'); pids.add(child.pid);
    admitInvocation(invocation, index, dirname(resolve(path)), sample, packetPaths, child);
    if (expected) { assert.equal(invocation.exitCode, 1); assert.equal(child.passed, false); assert.equal(child.detectedOracle, expected); }
    else { assert.equal(invocation.exitCode, 0); assert.equal(child.passed, true); }
    children.push(child);
  }
  return { result, schedule, children };
}

if (mode === 'prepare') {
  const [manifestArg, toolchainArg, outArg] = args; assert(manifestArg && toolchainArg && outArg);
  const manifestPath = resolve(manifestArg), manifest = read(manifestPath), toolchain = resolve(toolchainArg), out = resolve(outArg);
  assert(['verified-prior-canonical-kernel-v1', 'fresh-built-kernel-baseline', 'identified-built-kernel-v1'].includes(manifest.kind), 'Explicit identified package format required');
  assert.deepEqual(inventory(manifest.root), manifest.files, 'Complete exact package payload');
  const bindings = { ...source(), [manifestPath]: sha(manifestPath) };
  for (const [name, value] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = value;
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256); const built = read(manifest.buildReceipt); assert.equal(built.exitCode, 0);
  if (built.head) assert.equal(built.head, manifest.head);
  if (manifest.sourceSeal && built.sourceSeal) assert.equal(built.sourceSeal, manifest.sourceSeal);
  bindings[manifest.buildReceipt] = manifest.buildReceiptSha256;
  if (built.snapshots) { assert.equal(built.sourceUnchanged, true); verify(built.snapshots); Object.assign(bindings, built.snapshots); }
  if (manifest.canonicalReceipt) {
    assert.equal(sha(manifest.canonicalReceipt), manifest.canonicalReceiptSha256);
    const canonical = read(manifest.canonicalReceipt); assert.deepEqual(canonical.payloads.kernel, manifest.files);
    assert.equal(canonical.head, manifest.head); assert.equal(canonical.sourceSeal, manifest.sourceSeal);
    assert.equal(sha(manifest.archive), manifest.archiveSha256);
    bindings[manifest.canonicalReceipt] = manifest.canonicalReceiptSha256; bindings[manifest.archive] = manifest.archiveSha256;
  }
  const packageJson = read(join(manifest.root, 'package.json')); assert.equal(packageJson.name, '@signal-tree/kernel');
  const major = Number(packageJson.version.split('.')[0]); assert([15, 16].includes(major));
  const node = { path: realpathSync(process.execPath), version: process.version, sha256: sha(realpathSync(process.execPath)) };
  assert.equal(node.version, 'v24.15.0'); bindings[node.path] = node.sha256;
  const require = createRequire(join(toolchain, 'package.json')), esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
  const binary = createRequire(esbuildPath).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  const buildPaths = { esbuildJS: esbuildPath, esbuildPackage: resolve(dirname(esbuildPath), '../package.json'), esbuildBinary: binary, manifest: join(toolchain, 'package.json') };
  for (const path of Object.values(buildPaths)) bindings[path] = sha(path);
  const locks = ['pnpm-lock.yaml', 'package-lock.json'].map(name => join(toolchain, name)).filter(existsSync); assert(locks.length); for (const path of locks) { bindings[path] = sha(path); buildPaths['lock:' + path.split('/').at(-1)] = path; }
  const buildInputs = Object.fromEntries(Object.entries(buildPaths).map(([role, path]) => [role, { path, sha256: sha(path) }]));
  const buildToolchain = { esbuildVersion: esbuild.version, ...Object.fromEntries(Object.entries(buildInputs).map(([role, value]) => [role, value.sha256])) };
  verify(bindings); fresh(out);
  const entry = resolve(manifest.root, packageJson.exports['.'].import), bundles = {};
  for (const activation of ['bare', 'modules-loaded']) {
    const input = join(out, activation + '.entry.mjs'), output = join(out, activation + '.mjs');
    writeFileSync(input, `export { signalTree, entityMap${activation === 'modules-loaded' ? ', link, transactions, restoration' : ''} } from ${JSON.stringify(entry)};\n`, { flag: 'wx' });
    const built = await esbuild.build({ entryPoints: [input], outfile: output, bundle: true, format: 'esm', platform: 'node', target: 'node24', minify: true, metafile: true, define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' } });
    const meta = join(out, activation + '.meta.json'); save(meta, built.metafile);
    const emitted = Object.values(built.metafile.outputs).flatMap(value => Object.entries(value.inputs)).filter(([, value]) => value.bytesInOutput > 0).map(([path]) => path);
    const nativeEntity = emitted.some(path => path.endsWith('/experimental-publication/entity.js'));
    const transactionsEmitted = emitted.some(path => path.endsWith('/enhancers/transactions/transactions.js'));
    assert.equal(nativeEntity, major === 16 && activation === 'modules-loaded'); assert.equal(transactionsEmitted, activation === 'modules-loaded');
    for (const relative of Object.keys(built.metafile.inputs)) { const path = resolve(relative); assert(path === input || path.startsWith(resolve(manifest.root) + '/'), 'Unexpected external runtime authority'); bindings[path] = sha(path); }
    for (const path of [input, output, meta]) bindings[path] = sha(path);
    bundles[activation] = { path: output, sha256: sha(output), bytes: readFileSync(output).length, nativeEntity, transactionsEmitted };
  }
  verify(bindings);
  save(join(out, 'packet.json'), { kind: 'direct-map-packet-v1', manifestPath, manifestSha256: sha(manifestPath), sourceIdentity: { head: manifest.head, sourceSeal: manifest.sourceSeal, declaredSourceFiles: manifest.sourceFiles, buildReceipt: manifest.buildReceipt }, packageRoot: resolve(manifest.root), packageFiles: manifest.files, version: packageJson.version, major, node, buildInputs, buildToolchain, toolSources: source(), bindings, bundles, limits: 'Verified package payload/build receipts; source metadata preserved without relabelling later docs HEAD. Neutral production bundle. Module-loaded v15 is not v16 native guarantees. No recipient or optional enhancer is instantiated.' });
  const packetPath = join(out, 'packet.json'); save(join(out, 'execution.json'), executionFor(packetPath, read(packetPath)));
} else if (mode === 'child') {
  const [packetArg, outputArg, sampleArg] = args; assert(packetArg && outputArg && sampleArg);
  const { path: packetPath, packet, executionPath, executionSha256 } = executionAt(packetArg), sample = JSON.parse(sampleArg), bundle = packet.bundles[sample.activation]; assert(bundle);
  const { signalTree, entityMap } = await import(pathToFileURL(bundle.path).href);
  const result = { sample, pid: process.pid, node: process.version, nodeExecutableSha256: sha(process.execPath), packetPath, packetSha256: packet.packetSha256, executionPath, executionSha256, bundleSha256: bundle.sha256, host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, load: os.loadavg(), freeBytes: os.freemem() }, stages: {}, heap: [], checks: [], digests: {}, passed: false };
  let tree, rows, first, current;
  const check = (condition, oracle) => { if (!condition) { const error = new Error(oracle); error.oracle = oracle; throw error; } };
  const row = (id, value = id) => Object.fromEntries([['id', id], ['value', value], ...Array.from({ length: sample.width - 2 }, (_, index) => [`f${index}`, typeof id === 'number' ? id + index : index])]);
  const equal = (actual, expected, oracle) => { try { assert.deepEqual(actual, expected); } catch { check(false, oracle); } };
  const expectedValue = id => { let value = id; for (let i = 0; i < 40; i++) if ((i * 89) % sample.rows === id) value = sample.rows + 100 + i; return value; };
  const full = (map, edited, oracle) => { check(map.size === sample.rows, oracle); let index = 0; for (const [id, value] of map) { check(id === index, oracle); equal(value, row(index, edited ? expectedValue(index) : index), oracle); index++; } check(index === sample.rows, oracle); return hash(JSON.stringify([...map])); };
  const timed = (name, work) => { if (sample.kind === 'memory') return work(); const cpu = process.cpuUsage(), start = process.hrtime.bigint(); const value = work(); const elapsedNs = Number(process.hrtime.bigint() - start), consumed = process.cpuUsage(cpu); result.stages[name] = { elapsedNs, cpuMicroseconds: consumed, cpuMs: (consumed.user + consumed.system) / 1000 }; return value; };
  const heap = async name => { if (sample.kind !== 'memory') return; assert.equal(typeof global.gc, 'function'); for (let i = 0; i < 3; i++) { await nextTurn(); global.gc(); } await nextTurn(); result.heap.push({ name, ...process.memoryUsage() }); };
  try {
    await heap('module'); tree = timed('emptyTree', () => signalTree({ group: { rows: entityMap({ selectId: value => value.id }) } })); rows = tree.$.group.rows;
    let seed = Array.from({ length: sample.rows }, (_, id) => row(id));
    timed('population', () => rows.setAll(sample.fault === 'missing-row' ? seed.slice(1) : seed)); seed = undefined;
    check(rows.count() === sample.rows, 'population-oracle'); result.checks.push('population'); await heap('populated');
    first = timed('firstMap', () => rows.asMap()); result.digests.first = full(first, false, 'first-map-oracle'); result.checks.push('first-map'); await heap('firstHeld');
    timed('cachedMapReads', () => { for (let i = 0; i < 20; i++) check(rows.asMap() === first, 'cached-identity-oracle'); }); result.cachedReadCount = 20; result.checks.push('cached-identity');
    timed('editsAndMap', () => {
      let previous = first;
      for (let i = 0; i < 40; i++) {
        const id = (i * 89) % sample.rows, value = sample.rows + 100 + i;
        if (!(sample.fault === 'wrong-value' && i === 0)) rows.updateOne(id, { value });
        current = sample.fault === 'stale-map' ? first : rows.asMap();
        check(current.size === sample.rows && current.get(id)?.value === value, 'map-value-oracle');
        check(current !== previous, 'map-identity-oracle'); previous = current;
      }
    }); result.editCount = 40; result.digests.edited = full(current, true, 'edited-map-oracle'); result.checks.push('forty-edits');
    if (sample.fault === 'snapshot-corruption') first.set(0, row(0, -1));
    full(first, false, 'held-snapshot-oracle'); result.checks.push('held-snapshot'); await heap('editsHeld'); first = undefined; await heap('initialReleased');
    // Semantic probes follow measured work. They keep complete held snapshots
    // only within this short function and release them before the next heap.
    (() => {
      const held = current, oldZero = held.get(0), oldOne = held.get(1);
      if (sample.fault !== 'rekey-skipped') rows.changeId(0, 'moved');
      const rekeyed = rows.asMap();
      check(!rekeyed.has(0) && rekeyed.get('moved')?.id === 0 && rekeyed.get('moved')?.value === expectedValue(0), 'rekey-oracle');
      check(held.has(0) && held.get(0) === oldZero && !held.has('moved'), 'held-snapshot-oracle'); result.checks.push('rekey');
      rows.removeOne(1); rows.addOne(row(1, -1)); const replaced = rows.asMap();
      check(replaced.get(1)?.value === -1 && held.get(1) === oldOne && held.get(1)?.value === expectedValue(1), 'replacement-oracle');
      check([...replaced.keys()].at(-1) === 1, 'replacement-oracle'); result.checks.push('replacement');
      if (sample.fault !== 'omission-skipped') tree.$.group({});
      const absent = rows.asMap(); check(absent.size === 0, 'absence-oracle'); check(replaced.size === sample.rows, 'held-snapshot-oracle'); result.checks.push('omission');
      tree.$.group({ rows: { all: [row(7, 99)] } });
      equal([...rows.asMap()], [[7, row(7, 99)]], 'reactivation-oracle'); check(absent.size === 0, 'held-snapshot-oracle'); result.checks.push('reactivation');
    })(); current = undefined; await heap('semanticWork');
    timed('destroy', () => tree.destroy()); tree = undefined; rows = undefined; first = undefined; current = undefined; await heap('destroyed');
    verify(packet.bindings); result.passed = true; sampleMetrics(result);
  } catch (error) { result.passed = false; result.error = describeError(error); result.detectedOracle = errorOracle(error); }
  finally { try { tree?.destroy(); } catch (error) { result.cleanupError = describeError(error); result.passed = false; } save(resolve(outputArg), result); }
  if (!result.passed) process.exitCode = 1;
} else if (mode === 'controls' || mode === 'compare') {
  const [baseArg, candidateArg, outArg, controlsArg] = args; assert(baseArg && candidateArg && outArg);
  const packets = { baseline: resolve(baseArg), candidate: resolve(candidateArg) }, out = resolve(outArg), bindings = packetBindings(packets);
  const admitted = Object.fromEntries(Object.entries(packets).map(([arm, path]) => [arm, packetAt(path)]));
  assert.equal(admitted.baseline.packet.major, admitted.candidate.packet.major, 'Compare within one release line');
  assert.deepEqual(admitted.baseline.packet.node, admitted.candidate.packet.node);
  for (const { path, packet } of Object.values(admitted)) { bindings[path] = sha(path); Object.assign(bindings, packet.bindings); }
  let controls;
  if (mode === 'compare') { assert(controlsArg, 'Exact controls required'); controls = resolve(controlsArg); admitRun(controls, 'controls', packets); bindings[controls] = sha(controls); }
  verify(bindings); fresh(out); const schedule = scheduleFor(mode), schedulePath = join(out, 'schedule.json');
  save(schedulePath, { mode, command: [process.execPath, runner, mode, packets.baseline, packets.candidate, out, ...(controls ? [controls] : [])], packets, bindings, toolSources: source(), controls, schedule, scope: 'Three paired fresh-process main rounds and two same-build baseline A/A pairs per profile/kind. Descriptive neutral production CPU/elapsed and finite whole-process GC checkpoints; no native-recipient or release parity.' });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const resultPath = join(out, `child-${index}.json`), command = childCommand(packets[sample.arm], resultPath, sample);
    const child = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 120000, env: { ...process.env, NODE_ENV: 'production' } });
    const log = resultPath + '.log'; writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const result = existsSync(resultPath) ? read(resultPath) : null, expected = faults[sample.fault];
    const invocation = { sample, command, exitCode: child.status, signal: child.signal, resultPath, resultSha256: result ? sha(resultPath) : null, log, logSha256: sha(log) };
    if (child.error !== undefined) invocation.spawnError = describeError(child.error);
    try { admitChild(result, sample, admitted[sample.arm].path, !expected); } catch (error) { invocation.admissionError = describeError(error); }
    invocation.passed = successfulInvocation(invocation, result, expected);
    const invocationPath = join(out, `invocation-${index}.json`); save(invocationPath, invocation);
    results.push({ ...invocation, invocationPath, invocationSha256: sha(invocationPath) }); console.log(JSON.stringify({ index, ...sample, passed: invocation.passed })); if (!invocation.passed) break;
  }
  verify(bindings); const passed = results.length === schedule.length && results.every(value => value.passed);
  save(join(out, 'results.json'), { mode, passed, schedulePath, scheduleSha256: sha(schedulePath), bindings, results });
  if (!passed) process.exitCode = 1;
} else if (mode === 'analyze') {
  const [baseArg, candidateArg, resultArg, outArg] = args; assert(baseArg && candidateArg && resultArg && outArg);
  const packets = { baseline: resolve(baseArg), candidate: resolve(candidateArg) }, resultPath = resolve(resultArg), out = resolve(outArg);
  for (const path of Object.values(packets)) packetAt(path);
  const admitted = admitRun(resultPath, 'compare', packets); assert(admitted.schedule.controls);
  assert.equal(admitted.schedule.bindings[admitted.schedule.controls], sha(admitted.schedule.controls)); admitRun(admitted.schedule.controls, 'controls', packets);
  const groups = [], pairs = [], aa = [];
  for (const width of [8, 32]) for (const activation of ['bare', 'modules-loaded']) for (const kind of ['timing', 'memory']) {
    const select = arm => admitted.children.filter(child => child.sample.width === width && child.sample.activation === activation && child.sample.kind === kind && child.sample.arm === arm && !child.sample.control).sort((a, b) => a.sample.round - b.sample.round);
    const baseline = select('baseline'), candidate = select('candidate'); assert.deepEqual(baseline.map(value => value.sample.round), [0, 1, 2]); assert.deepEqual(candidate.map(value => value.sample.round), [0, 1, 2]);
    for (let i = 0; i < 3; i++) assert.deepEqual(candidate[i].digests, baseline[i].digests, 'Cross-arm complete output identity');
    const baseMetrics = baseline.map(sampleMetrics), candidateMetrics = candidate.map(sampleMetrics), keys = Object.keys(baseMetrics[0]);
    for (const [arm, values] of [['baseline', baseMetrics], ['candidate', candidateMetrics]]) groups.push({ width, activation, kind, arm, metrics: Object.fromEntries(keys.map(key => [key, stats(values.map(value => value[key]))])) });
    pairs.push({ width, activation, kind, differences: Object.fromEntries(keys.map(key => [key, { ...stats(candidateMetrics.map((value, index) => value[key] - baseMetrics[index][key])), values: candidateMetrics.map((value, index) => ({ baseline: baseMetrics[index][key], candidate: value[key] })) }])) });
    const controls = admitted.children.filter(child => child.sample.width === width && child.sample.activation === activation && child.sample.kind === kind && child.sample.control === 'AA'); assert.equal(controls.length, 4);
    const matched = [0, 2].map(round => [0, 1].map(repeat => { const found = controls.filter(child => child.sample.round === round && child.sample.repeat === repeat); assert.equal(found.length, 1); return sampleMetrics(found[0]); }));
    aa.push({ width, activation, kind, differences: Object.fromEntries(keys.map(key => [key, stats(matched.map(([a, b]) => b[key] - a[key]))])) });
  }
  fresh(out); save(join(out, 'summary.json'), { resultPath, resultSha256: sha(resultPath), schedulePath: admitted.result.schedulePath, scheduleSha256: admitted.result.scheduleSha256, toolSources: source(), groups, pairs, aa, limits: ['Three descriptive pairs per width/module/kind, two A/A pairs; no confidence interval.', 'FirstMap excludes the full oracle. EditsAndMap includes40 updates,40 projections and constant changed-row/cardinality/identity checks. Complete content/held/rekey/omission oracles run outside timers.', 'Memory is whole-process finite forced-GC observation, not allocation bytes/dominator attribution. Initial map is intentionally held through edits then released; initialReleased still includes the latest library map cache.', 'Module-loaded v15 has no v16 native publication factory. Neither line creates a recipient or activates optional enhancers.', 'No app/browser, publication, universal leak-free or release-readiness claim.'] });
  save(join(out, 'receipt.json'), { command: [process.execPath, ...process.argv.slice(1)], summarySha256: sha(join(out, 'summary.json')), resultSha256: sha(resultPath), bindings: admitted.result.bindings });
} else if (mode === 'selftest') {
  const [outArg] = args; assert(outArg); const out = resolve(outArg); fresh(out); const checks = [];
  const check = (name, work) => { work(); checks.push({ name, passed: true }); };
  check('complete schedule and exact distinct main/AA slots', () => {
    const schedule = scheduleFor('compare'); assert.equal(schedule.length, 80); assert.equal(scheduleFor('controls').length, 28);
    const main = schedule.filter(sample => !sample.control), aa = schedule.filter(sample => sample.control);
    assert.equal(main.length, 48); assert.equal(aa.length, 32);
    assert.equal(new Set(main.map(sample => [sample.arm, sample.activation, sample.width, sample.kind, sample.round].join(':'))).size, 48);
    for (const width of [8, 32]) for (const activation of ['bare', 'modules-loaded']) for (const kind of ['timing', 'memory']) {
      for (const arm of ['baseline', 'candidate']) assert.deepEqual(main.filter(sample => sample.arm === arm && sample.width === width && sample.activation === activation && sample.kind === kind).map(sample => sample.round), [0, 1, 2]);
      assert.equal(aa.filter(sample => sample.width === width && sample.activation === activation && sample.kind === kind).length, 4);
    }
  });
  const synthetic = kind => ({ sample: { kind }, stages: kind === 'timing' ? Object.fromEntries(stages.map(name => [name, { elapsedNs: 10, cpuMs: .01, cpuMicroseconds: { user: 8, system: 2 } }])) : {}, heap: kind === 'memory' ? heaps.map((name, index) => ({ name, heapUsed: 1000 - index })) : [], checks: ['population', 'first-map', 'cached-identity', 'forty-edits', 'held-snapshot', 'rekey', 'replacement', 'omission', 'reactivation'], digests: { first: '1'.repeat(64), edited: '2'.repeat(64) }, editCount: 40, cachedReadCount: 20 });
  check('complete metric shapes accepted and signed heap deltas preserved', () => { sampleMetrics(synthetic('timing')); assert.equal(sampleMetrics(synthetic('memory'))['heap.firstMapDelta'], -1); });
  for (const [name, kind, alter] of [
    ['missing CPU stage', 'timing', value => { delete value.stages.firstMap; }],
    ['nonfinite CPU', 'timing', value => { value.stages.firstMap.cpuMs = NaN; }],
    ['wrong CPU sum', 'timing', value => { value.stages.firstMap.cpuMs = 1; }],
    ['missing heap checkpoint', 'memory', value => { value.heap.pop(); }],
    ['missing semantic oracle', 'timing', value => { value.checks.pop(); }],
    ['wrong edit count', 'timing', value => { value.editCount = 0; }],
  ]) check('rejects ' + name, () => { const value = synthetic(kind); alter(value); assert.throws(() => sampleMetrics(value)); });
  check('falsey thrown values retain error description and cannot invent oracle', () => {
    for (const value of [undefined, null, '', 0, false]) { assert.equal(typeof describeError(value), 'string'); assert.equal(errorOracle(value), undefined); }
  });
  check('falsey cleanup/admission/spawn errors and signals refuse expected faults', () => {
    const invocation = { exitCode: 1, signal: null }, child = { passed: false, detectedOracle: 'expected' };
    assert(successfulInvocation(invocation, child, 'expected'));
    for (const value of ['', undefined, null, false, 0]) {
      assert(!successfulInvocation(invocation, { ...child, cleanupError: value }, 'expected'));
      for (const key of ['admissionError', 'spawnError']) assert(!successfulInvocation({ ...invocation, [key]: value }, child, 'expected'));
    }
    assert(!successfulInvocation({ ...invocation, signal: 'SIGTERM' }, child, 'expected'));
  });
  check('actual admission refuses packet omission, command drift and sidecar drift', () => {
    const root = join(out, 'admission-fixture'); fresh(root);
    const packageRoot = join(root, 'package'); fresh(packageRoot); writeFileSync(join(packageRoot, 'package.json'), '{}');
    const packetRoot = join(root, 'packet'); fresh(packetRoot);
    const node = { path: realpathSync(process.execPath), version: process.version, sha256: sha(realpathSync(process.execPath)) };
    const roles = ['esbuildJS', 'esbuildPackage', 'esbuildBinary', 'manifest', 'lock:synthetic'];
    const buildInputs = Object.fromEntries(roles.map(role => [role, { path: join(packageRoot, 'package.json'), sha256: sha(join(packageRoot, 'package.json')) }]));
    const buildToolchain = { esbuildVersion: 'synthetic-only', ...Object.fromEntries(roles.map(role => [role, buildInputs[role].sha256])) };
    const bindings = { ...source(), [node.path]: node.sha256, [join(packageRoot, 'package.json')]: sha(join(packageRoot, 'package.json')) };
    save(join(packetRoot, 'packet.json'), { kind: 'direct-map-packet-v1', toolSources: source(), node, bindings, buildInputs, buildToolchain, packageRoot, packageFiles: inventory(packageRoot), bundles: { bare: { path: join(packageRoot, 'package.json'), sha256: sha(join(packageRoot, 'package.json')) }, 'modules-loaded': { path: join(packageRoot, 'package.json'), sha256: sha(join(packageRoot, 'package.json')) } } });
    save(join(packetRoot, 'execution.json'), executionFor(join(packetRoot, 'packet.json'), read(join(packetRoot, 'packet.json'))));
    const packets = { baseline: packetRoot, candidate: packetRoot }, cohort = join(root, 'cohort'); fresh(cohort);
    const schedule = { mode: 'controls', packets, schedule: scheduleFor('controls'), bindings: packetBindings(packets), toolSources: source(), command: [process.execPath, runner, 'controls', packetRoot, packetRoot, cohort] };
    const results = [];
    for (const [index, sample] of schedule.schedule.entries()) {
      const expected = faults[sample.fault], child = { ...synthetic('timing'), sample, packetPath: join(packetRoot, 'packet.json'), packetSha256: sha(join(packetRoot, 'packet.json')), executionPath: join(packetRoot, 'execution.json'), executionSha256: sha(join(packetRoot, 'execution.json')), bundleSha256: sha(join(packageRoot, 'package.json')), node: process.version, nodeExecutableSha256: node.sha256, pid: index + 1, passed: !expected, ...(expected ? { detectedOracle: expected } : {}) };
      const resultPath = join(cohort, `child-${index}.json`), log = resultPath + '.log', invocationPath = join(cohort, `invocation-${index}.json`);
      save(resultPath, child); writeFileSync(log, 'synthetic helper fixture only');
      const invocation = { sample, command: childCommand(packetRoot, resultPath, sample), exitCode: expected ? 1 : 0, signal: null, resultPath, resultSha256: sha(resultPath), log, logSha256: sha(log), passed: true };
      save(invocationPath, invocation); results.push({ ...invocation, invocationPath, invocationSha256: sha(invocationPath) });
    }
    const schedulePath = join(cohort, 'schedule.json'), resultPath = join(cohort, 'results.json');
    save(schedulePath, schedule); const result = { mode: 'controls', passed: true, schedulePath, scheduleSha256: sha(schedulePath), bindings: schedule.bindings, results }; save(resultPath, result);
    admitRun(resultPath, 'controls', packets);
    const originalSchedule = readFileSync(schedulePath), originalResult = readFileSync(resultPath);
    const omitted = structuredClone(schedule); delete omitted.bindings[node.path]; writeFileSync(schedulePath, JSON.stringify(omitted));
    writeFileSync(resultPath, JSON.stringify({ ...result, scheduleSha256: sha(schedulePath), bindings: omitted.bindings }));
    assert.throws(() => admitRun(resultPath, 'controls', packets), /Complete mandatory packet input union/);
    writeFileSync(schedulePath, originalSchedule); writeFileSync(resultPath, originalResult);
    const changed = structuredClone(result); changed.results[0].command[0] = '/wrong-node';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Exclude the self-hash while rewriting the deliberately altered sidecar fixture.
    const { invocationPath, invocationSha256, ...record } = changed.results[0]; writeFileSync(invocationPath, JSON.stringify(record)); changed.results[0].invocationSha256 = sha(invocationPath); writeFileSync(resultPath, JSON.stringify(changed));
    assert.throws(() => admitRun(resultPath, 'controls', packets), /Exact child command/);
    writeFileSync(resultPath, originalResult);
    assert.throws(() => admitRun(resultPath, 'controls', packets));
  });
  save(join(out, 'receipt.json'), { passed: true, checks, toolSources: source(), command: [process.execPath, ...process.argv.slice(1)], scope: 'Offline synthetic helper checks only; no runtime or measured evidence.' });
} else if (mode) throw Error('prepare MANIFEST TOOLCHAIN OUT | controls BASE CANDIDATE OUT | compare BASE CANDIDATE OUT CONTROLS_RESULTS | analyze BASE CANDIDATE RESULTS OUT | selftest OUT');
