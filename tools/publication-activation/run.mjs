#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { admitKernel, checkpointNames, describe, faults, fresh, inventory, makeSchedule, phaseNames, read, save, sha, validateConfig, verify } from './common.mjs';
import { runWorkload } from './workload.mjs';

const runner = fileURLToPath(import.meta.url), here = dirname(runner);
const [mode, ...args] = process.argv.slice(2);
const sourceNames = ['run.mjs', 'common.mjs', 'workload.mjs', 'README.md'];
const median = values => { const sorted = [...values].sort((a, b) => a - b), n = sorted.length; return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; };
const semanticOracles = result => { const oracles = { ...result.oracles }; delete oracles.release; return oracles; };
function admitTiming(stage, calls = true) {
  assert.deepEqual(Object.keys(stage).sort(), [...(calls ? ['calls'] : []), 'wallNs', 'userUs', 'systemUs', 'wallMs', 'cpuMs'].sort());
  for (const value of Object.values(stage)) assert(Number.isFinite(value) && value >= 0);
  if (calls) assert(Number.isInteger(stage.calls));
  assert.equal(stage.cpuMs, (stage.userUs + stage.systemUs) / 1000); assert.equal(stage.wallMs, stage.wallNs / 1e6);
}

function admitResult(result, sample, packet, complete) {
  assert(result); assert.deepEqual(result.sample, sample); assert.equal(result.executionSha256, packet.executionSha256);
  assert.equal(result.bundleSha256, packet.bundles[sample.arm][sample.profile.link === 'absent' ? 'no-link' : 'loaded'].sha256);
  assert.equal(result.node, packet.node.version); assert(Number.isSafeInteger(result.pid) && result.pid > 0);
  assert.equal(Object.hasOwn(result, 'cleanupError'), false, 'Cleanup error rejects result');
  if (!complete) return;
  assert.equal(result.passed, true); assert.equal(Object.hasOwn(result, 'error'), false);
  const o = result.oracles, p = sample.profile;
  assert.equal(o.destroyed, p.trees); assert.equal(o.history.length, p.history);
  assert.deepEqual(o.unrelated, p.link === 'absent' ? [] : [17]);
  assert.match(o.firstContext, /^[a-f0-9]{64}$/); assert.equal(o.contextSum, p.trees * 8 * 500000);
  for (const [index, item] of o.history.entries()) { assert.equal(item.cycle, index + 1); assert.equal(item.pending, 0); assert.equal(item.held, o.firstContext); assert.match(item.state, /^[a-f0-9]{64}$/); }
  assert.equal(o.deliveries.length, ['initial', 'late'].includes(p.link) ? p.trees : 0);
  const deliveryStages = ['initial-attach', 'population', 'literal-edits', 'late-attach', ...Array.from({ length: p.history }, (_, i) => `history-${i + 1}`), ...(['restoration', 'both'].includes(p.enhancer) ? ['restoration-edit', 'restoration-undo', 'restoration-redo'] : [])];
  assert.deepEqual(o.deliveryStages.map(value => value.stage), deliveryStages);
  const replay = Array.from({ length: o.deliveries.length }, () => []);
  for (const stage of o.deliveryStages) {
    const expectedSinks = p.link === 'initial' || p.link === 'late' && deliveryStages.indexOf(stage.stage) >= 3 ? p.trees : 0;
    assert.equal(stage.records.length, expectedSinks);
    for (const [index, record] of stage.records.entries()) {
      assert.equal(record.from, replay[index].length); assert(Number.isInteger(record.to) && record.to >= record.from); assert.match(record.expectedHash, /^[a-f0-9]{64}$/);
      for (let n = record.from; n < record.to; n++) replay[index].push(record.expectedHash);
    }
  }
  for (const [index, item] of o.deliveries.entries()) { assert(Number.isInteger(item.count) && item.count > 0); assert.equal(item.count, item.hashes.length); assert.match(item.last, /^[a-f0-9]{64}$/); assert.equal(item.last, item.hashes.at(-1)); assert.deepEqual(item.hashes, replay[index]); }
  if (p.enhancer === 'restoration' || p.enhancer === 'both') assert.equal(o.restoration, true);
  if (sample.kind === 'cpu') {
    admitTiming(result.moduleImport, false);
    admitTiming(result.episode, false);
    assert.deepEqual(Object.keys(result.stages), phaseNames);
    for (const [name, stage] of Object.entries(result.stages)) {
      admitTiming(stage);
      assert.equal(stage.calls, name.startsWith('history') ? p.history : name === 'restoreRoundtrip' && !['restoration', 'both'].includes(p.enhancer) ? 0 : 1);
    }
  } else { assert.deepEqual(result.stages, {}); assert.equal(Object.hasOwn(result, 'moduleImport'), false); assert.equal(Object.hasOwn(result, 'episode'), false); }
  if (sample.kind === 'heap' || sample.kind === 'heap-control') {
    assert.deepEqual(Object.keys(result.checkpoints), [...checkpointNames, ...(sample.control === 'pin-release' ? ['pinReleased'] : [])]);
    for (const point of Object.values(result.checkpoints)) assert(Number.isSafeInteger(point.heapBytes) && point.heapBytes > 0);
    for (const name of checkpointNames.slice(1, -1)) assert.equal(result.checkpoints[name].alive.tree, true, 'Deliberately held tree must remain live');
    for (const name of ['contextHeld', 'enrolled', 'historyHeld', 'linksDisposed', 'destroyedHeld']) assert.equal(result.checkpoints[name].alive.snapshot, true);
    if (sample.control === 'pin-release') assert.deepEqual(result.checkpoints.pinReleased.alive, { tree: false, snapshot: false });
  } else assert.deepEqual(result.checkpoints, {});
}

function loadRun(resultsPath) {
  const receipt = read(resultsPath), plan = read(receipt.planPath), packet = read(plan.packetPath);
  assert.equal(receipt.passed, true); assert.equal(sha(receipt.planPath), receipt.planSha256); assert.equal(sha(plan.packetPath), plan.packetSha256);
  assert.deepEqual(plan.samples, makeSchedule(packet.config, plan.kind));
  assert.equal(receipt.results.length, plan.samples.length); verify(packet.bindings);
  if (plan.kind !== 'controls') { assert(plan.controls); assert.equal(sha(plan.controls.path), plan.controls.sha256); const controls = loadRun(plan.controls.path); assert.equal(controls.plan.kind, 'controls'); assert.equal(controls.plan.packetPath, plan.packetPath); }
  for (const [index, invocation] of receipt.results.entries()) {
    const sample = plan.samples[index]; assert.deepEqual(invocation.sample, sample);
    assert.equal(sha(invocation.resultPath), invocation.resultSha256); assert.equal(sha(invocation.log), invocation.logSha256);
    assert.equal(invocation.passed, true); assert.equal(Object.hasOwn(invocation, 'admissionError'), false);
    assert.equal(invocation.signal, null); assert.equal(invocation.spawnError, null);
    const expected = commandFor(packet, sample, invocation.resultPath);
    assert.deepEqual(invocation.command, expected);
    const result = read(invocation.resultPath), wanted = faults[sample.fault];
    admitResult(result, sample, packet, !wanted);
    if (wanted) { assert.equal(invocation.exitCode, 1); assert.equal(result.passed, false); assert(result.error.includes(wanted)); }
    else assert.equal(invocation.exitCode, 0);
  }
  if (plan.kind !== 'controls') {
    for (const invocation of receipt.results.filter(value => value.sample.arm === 'baseline' && !value.sample.control)) {
      const peer = receipt.results.find(value => value.sample.arm === 'candidate' && !value.sample.control && value.sample.profile.id === invocation.sample.profile.id && value.sample.round === invocation.sample.round);
      assert(peer); assert.deepEqual(semanticOracles(read(invocation.resultPath)), semanticOracles(read(peer.resultPath)), 'Exact paired semantic observations');
    }
  }
  return { receipt, plan, packet };
}
function commandFor(packet, sample, resultPath) {
  return [packet.node.path, ...(sample.kind === 'heap' || sample.kind === 'heap-control' ? ['--expose-gc'] : []), packet.runner, 'child', packet.executionPath, resultPath, JSON.stringify(sample)];
}

if (mode === 'prepare') {
  const [configArg, toolchainArg, outArg] = args;
  assert(configArg && toolchainArg && outArg, 'prepare CONFIG TOOLCHAIN NEW_PACKET');
  assert.equal(process.version, 'v24.15.0', 'Use repository Node');
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined, 'Use bound standard esbuild binary');
  const configPath = resolve(configArg), config = read(configPath), toolchain = realpathSync(resolve(toolchainArg)); validateConfig(config);
  const admitted = Object.fromEntries(['baseline', 'candidate'].map(arm => [arm, admitKernel(config[arm])]));
  const bindings = { [configPath]: sha(configPath), [process.execPath]: sha(process.execPath) };
  for (const item of Object.values(admitted)) Object.assign(bindings, item.bindings);
  for (const name of sourceNames) bindings[join(here, name)] = sha(join(here, name));
  const require = createRequire(join(toolchain, 'package.json')), esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath);
  const esbuildRequire = createRequire(esbuildPath), binary = esbuildRequire.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  const esbuildRoot = dirname(dirname(esbuildPath)), binaryRoot = dirname(dirname(binary));
  for (const root of [esbuildRoot, binaryRoot]) for (const [name, hash] of Object.entries(inventory(root))) bindings[join(root, name)] = hash;
  for (const path of [join(toolchain, 'package.json'), join(toolchain, 'pnpm-lock.yaml')]) bindings[path] = sha(path);
  verify(bindings);
  const out = fresh(outArg, [here, configPath, ...Object.values(admitted).map(item => item.manifest.root)]);
  for (const name of sourceNames) { const copy = join(out, name); copyFileSync(join(here, name), copy); bindings[copy] = sha(copy); }
  const bundles = {};
  for (const [arm, item] of Object.entries(admitted)) {
    bundles[arm] = {};
    const pkg = read(join(item.manifest.root, 'package.json'));
    for (const activation of ['no-link', 'loaded']) {
      const entry = join(out, `${arm}-${activation}.entry.mjs`), bundle = join(out, `${arm}-${activation}.production.mjs`);
      writeFileSync(entry, [
        `export {signalTree,entityMap${activation === 'loaded' ? ',transactions,restoration,undoable,link' : ''}} from ${JSON.stringify(resolve(item.manifest.root, pkg.exports['.'].import))};`,
        ...(activation === 'loaded' ? [`export {transactionLifecycleReader} from ${JSON.stringify(resolve(item.manifest.root, pkg.exports['./internals'].import))};`] : []),
        '',
      ].join('\n'), { flag: 'wx' });
      const built = await esbuild.build({ entryPoints: [entry], outfile: bundle, bundle: true, minify: true, treeShaking: true,
        format: 'esm', platform: 'node', target: 'node24', define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' }, metafile: true, logLevel: 'silent' });
      const meta = join(out, `${arm}-${activation}.metafile.json`); save(meta, built.metafile);
      const emitted = Object.values(built.metafile.outputs).flatMap(output => Object.entries(output.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([path, info]) => ({ path, bytes: info.bytesInOutput })));
      const includedLink = emitted.some(value => value.path.endsWith('/lib/link.js'));
      const entityFactory = emitted.some(value => value.path.endsWith('/experimental-publication/entity.js'));
      const ordinaryFactory = emitted.some(value => value.path.endsWith('/experimental-publication/private.js'));
      assert.equal(includedLink, activation === 'loaded'); assert.equal(entityFactory, activation === 'loaded'); assert.equal(ordinaryFactory, activation === 'loaded');
      for (const input of Object.keys(built.metafile.inputs)) { const path = resolve(input); assert(path === entry || path.startsWith(item.manifest.root + sep), `No mixed runtime or source alias: ${path}`); bindings[path] = sha(path); }
      for (const path of [entry, bundle, meta]) bindings[path] = sha(path);
      const bytes = readFileSync(bundle);
      bundles[arm][activation] = { path: bundle, sha256: sha(bundle), entry, entrySha256: sha(entry), meta, metaSha256: sha(meta), rawBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, includedLink, entityFactory, ordinaryFactory, emitted };
    }
  }
  const node = { path: process.execPath, sha256: sha(process.execPath), version: process.version };
  const executionPath = join(out, 'execution.json');
  save(executionPath, { kind: 'publication-activation-execution-v1', node, bundles: Object.fromEntries(Object.entries(bundles).map(([arm, modes]) => [arm, Object.fromEntries(Object.entries(modes).map(([activation, value]) => [activation, { path: value.path, sha256: value.sha256 }]))])) });
  bindings[executionPath] = sha(executionPath); verify(bindings);
  const packetPath = join(out, 'packet.json');
  save(packetPath, { kind: 'publication-activation-packet-v1', createdUTC: new Date().toISOString(), command: process.argv, configPath, config, node, toolchain, esbuildVersion: esbuild.version,
    artifacts: Object.fromEntries(Object.entries(admitted).map(([arm, item]) => [arm, { manifestPath: item.manifestPath, manifestSha256: sha(item.manifestPath), head: item.manifest.head, sourceRoot: item.sourceRoot, buildReceipt: item.manifest.buildReceipt, buildReceiptSha256: item.manifest.buildReceiptSha256 }])),
    bundles, runner: join(out, 'run.mjs'), bindings, executionPath, executionSha256: sha(executionPath),
    limits: 'Identified neutral-kernel prototype comparison; source/build snapshots, not canonical release packaging. Ordinary scalar sources remain full native participation. Complete semantic and original point-work qualification are separate. No public runtime option.' });
  console.log(packetPath);
} else if (mode === 'plan') {
  const [packetArg, kind, outArg, controlsArg] = args;
  assert(packetArg && kind && outArg, 'plan PACKET_JSON controls|cpu|heap NEW_PLAN [CONTROLS_RESULTS]');
  const packetPath = resolve(packetArg), packet = read(packetPath); verify(packet.bindings);
  assert.equal(sha(runner), packet.bindings[packet.runner], 'Run frozen runner');
  let controls;
  if (kind !== 'controls') {
    assert(controlsArg, 'Successful exact-packet controls required'); const loaded = loadRun(resolve(controlsArg));
    assert.equal(loaded.plan.kind, 'controls'); assert.equal(loaded.plan.packetPath, packetPath); controls = { path: resolve(controlsArg), sha256: sha(controlsArg) };
  }
  const out = fresh(outArg, [dirname(packetPath), here, ...(controls ? [dirname(controls.path)] : [])]);
  save(join(out, 'plan.json'), { kind, createdUTC: new Date().toISOString(), command: process.argv, packetPath, packetSha256: sha(packetPath), controls, samples: makeSchedule(packet.config, kind), output: join(out, 'execution') });
  console.log(join(out, 'plan.json'));
} else if (mode === 'run') {
  const [planArg] = args; assert(planArg, 'run PLAN_JSON');
  const planPath = resolve(planArg), plan = read(planPath), packet = read(plan.packetPath);
  assert.equal(sha(plan.packetPath), plan.packetSha256); assert.equal(sha(runner), packet.bindings[packet.runner]);
  assert.equal(process.execPath, packet.node.path); assert.equal(process.version, packet.node.version);
  assert.deepEqual(plan.samples, makeSchedule(packet.config, plan.kind));
  if (plan.kind !== 'controls') { assert(plan.controls); assert.equal(sha(plan.controls.path), plan.controls.sha256); const controls = loadRun(plan.controls.path); assert.equal(controls.plan.kind, 'controls'); assert.equal(controls.plan.packetPath, plan.packetPath); }
  verify(packet.bindings); const out = fresh(plan.output, [dirname(plan.packetPath)]), results = [];
  for (const [index, sample] of plan.samples.entries()) {
    // Symmetric full provenance admission is parent-only, before every child.
    const resultPath = join(out, `child-${String(index).padStart(3, '0')}.json`), command = commandFor(packet, sample, resultPath);
    try { verify(packet.bindings); }
    catch (error) {
      const failure = { sample, command, passed: false, childStarted: false, admissionError: describe(error) };
      save(join(out, `invocation-${index}.json`), failure); results.push(failure); break;
    }
    const child = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: packet.config.timeoutMs, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '' } });
    const log = resultPath + '.log'; writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const result = existsSync(resultPath) ? read(resultPath) : undefined, wanted = faults[sample.fault];
    let admissionError;
    try {
      admitResult(result, sample, packet, !wanted);
      assert.equal(child.signal, null); assert.equal(child.error, undefined);
      if (wanted) { assert.equal(child.status, 1); assert.equal(result.passed, false); assert(result.error.includes(wanted), `Expected only ${wanted}`); }
      else { assert.equal(child.status, 0); assert.equal(result.passed, true); }
      if (plan.kind !== 'controls' && !sample.control) {
        const peer = results.find(value => value.sample.arm !== sample.arm && !value.sample.control && value.sample.profile.id === sample.profile.id && value.sample.round === sample.round);
        if (peer) assert.deepEqual(semanticOracles(result), semanticOracles(read(peer.resultPath)), 'Exact paired semantic observations');
      }
      verify(packet.bindings);
    } catch (error) { admissionError = describe(error); }
    const invocation = { sample, command, exitCode: child.status, signal: child.signal, spawnError: child.error ? describe(child.error) : null, resultPath, resultSha256: result ? sha(resultPath) : null, log, logSha256: sha(log), ...(admissionError === undefined ? {} : { admissionError }), passed: admissionError === undefined };
    save(join(out, `invocation-${index}.json`), invocation); results.push(invocation);
    console.log(JSON.stringify({ index, arm: sample.arm, profile: sample.profile.id, kind: sample.kind, fault: sample.fault, passed: invocation.passed }));
    if (!invocation.passed) break;
  }
  const passed = results.length === plan.samples.length && results.every(value => value.passed);
  save(join(out, 'results.json'), { passed, planPath, planSha256: sha(planPath), results }); if (!passed) process.exitCode = 1;
} else if (mode === 'child') {
  const [executionArg, outputArg, sampleArg] = args, execution = read(executionArg), sample = JSON.parse(sampleArg);
  assert.equal(process.version, execution.node.version);
  const bundle = execution.bundles[sample.arm][sample.profile.link === 'absent' ? 'no-link' : 'loaded'];
  const result = { sample, pid: process.pid, node: process.version, executionSha256: sha(executionArg), bundleSha256: bundle.sha256,
    host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, load: os.loadavg(), freeBytes: os.freemem() }, passed: false };
  try {
    const at = sample.kind === 'cpu' ? process.hrtime.bigint() : undefined, usage = sample.kind === 'cpu' ? process.cpuUsage() : undefined;
    const api = await import(pathToFileURL(bundle.path));
    if (sample.kind === 'cpu') { const wallNs = Number(process.hrtime.bigint() - at), consumed = process.cpuUsage(usage); result.moduleImport = { wallNs, userUs: consumed.user, systemUs: consumed.system, wallMs: wallNs / 1e6, cpuMs: (consumed.user + consumed.system) / 1000 }; }
    const episodeAt = sample.kind === 'cpu' ? process.hrtime.bigint() : undefined, episodeUsage = sample.kind === 'cpu' ? process.cpuUsage() : undefined;
    await runWorkload(api, sample, result);
    if (sample.kind === 'cpu') { const wallNs = Number(process.hrtime.bigint() - episodeAt), consumed = process.cpuUsage(episodeUsage); result.episode = { wallNs, userUs: consumed.user, systemUs: consumed.system, wallMs: wallNs / 1e6, cpuMs: (consumed.user + consumed.system) / 1000 }; }
    result.passed = true;
  }
  catch (error) { result.error = describe(error); }
  finally { save(resolve(outputArg), result); }
  if (!result.passed) process.exitCode = 1;
} else if (mode === 'analyze') {
  const [cpuArg, heapArg, outputArg] = args; assert(cpuArg && heapArg && outputArg, 'analyze CPU_RESULTS HEAP_RESULTS NEW_JSON');
  assert(!existsSync(outputArg), 'Preserve earlier analysis');
  const cpu = loadRun(resolve(cpuArg)), heap = loadRun(resolve(heapArg)); assert.equal(cpu.plan.kind, 'cpu'); assert.equal(heap.plan.kind, 'heap'); assert.equal(cpu.plan.packetSha256, heap.plan.packetSha256);
  const summaries = [], comparisons = [];
  for (const cohort of [cpu, heap]) {
    const groups = new Map();
    for (const invocation of cohort.receipt.results) {
      const result = read(invocation.resultPath), sample = result.sample, key = `${sample.profile.id}/${sample.arm}/${sample.control ?? 'primary'}`;
      let group = groups.get(key); if (!group) groups.set(key, group = { profile: sample.profile.id, arm: sample.arm, control: sample.control ?? 'primary', kind: cohort.plan.kind, samples: [] });
      const metrics = {};
      if (cohort.plan.kind === 'cpu') {
        metrics.moduleImportCpuMs = result.moduleImport.cpuMs; metrics.moduleImportWallMs = result.moduleImport.wallMs;
        metrics.episodeCpuMs = result.episode.cpuMs; metrics.episodeWallMs = result.episode.wallMs;
        for (const [name, stage] of Object.entries(result.stages)) { metrics[name + '.cpuMs'] = stage.cpuMs; metrics[name + '.wallMs'] = stage.wallMs; }
        metrics.measuredPhaseSumCpuMs = Object.values(result.stages).reduce((n, stage) => n + stage.cpuMs, 0);
        metrics.measuredPhaseSumWallMs = Object.values(result.stages).reduce((n, stage) => n + stage.wallMs, 0);
      } else {
        const before = result.checkpoints.moduleReady.heapBytes;
        for (const [name, point] of Object.entries(result.checkpoints)) { metrics[name + '.heapBytes'] = point.heapBytes; metrics[name + '.deltaBytes'] = point.heapBytes - before; }
      }
      group.samples.push({ index: sample.index, round: sample.round, repeat: sample.repeat, resultPath: invocation.resultPath, metrics });
    }
    for (const group of groups.values()) {
      group.statistics = Object.fromEntries(Object.keys(group.samples[0].metrics).map(name => { const values = group.samples.map(sample => sample.metrics[name]); return [name, { values, median: median(values), min: Math.min(...values), max: Math.max(...values) }]; })); summaries.push(group);
    }
    for (const profile of cohort.packet.config.profiles) {
      const baseline = groups.get(`${profile.id}/baseline/primary`), candidate = groups.get(`${profile.id}/candidate/primary`); assert(baseline && candidate);
      for (const name of Object.keys(baseline.statistics)) {
        const paired = baseline.samples.map(sample => { const other = candidate.samples.find(value => value.round === sample.round); assert(other); return { round: sample.round, baseline: sample.metrics[name], candidate: other.metrics[name], candidateMinusBaseline: other.metrics[name] - sample.metrics[name] }; });
        comparisons.push({ kind: cohort.plan.kind, profile: profile.id, metric: name, paired, medianPairedDifference: median(paired.map(value => value.candidateMinusBaseline)) });
      }
    }
  }
  save(resolve(outputArg), { kind: 'publication-activation-analysis-v1', createdUTC: new Date().toISOString(), command: process.argv, packetSha256: cpu.plan.packetSha256,
    inputs: { [resolve(cpuArg)]: sha(cpuArg), [resolve(heapArg)]: sha(heapArg) }, bundles: cpu.packet.bundles, summaries, comparisons,
    limits: 'Signed whole-process retained-heap deltas, not allocated bytes or exact evidence attribution. Episode includes workload validation, all oracle reads, pending drains and cleanup; it is not app latency. Import is separate. Phase sums omit gaps/oracles/import and are not the episode. Restoration roundtrip includes its checks. A/A describes variation, not confidence intervals. Neutral fixture, no framework rendering or release sign-off.' });
  console.log(resolve(outputArg));
} else throw new Error('Use prepare | plan | run | analyze. See README.md.');
