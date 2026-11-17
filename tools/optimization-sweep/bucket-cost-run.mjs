#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { admitKernel, admitResult, admitRun, arms, childCommand, faultOracles, freshOutside, read, requireIsolated, schedule, sha, verify, write } from './bucket-cost-common.mjs';
import { describeError, runWorkload } from './bucket-cost-workload.mjs';
const runner = fileURLToPath(import.meta.url), directory = dirname(runner), [mode, ...args] = process.argv.slice(2);
const sourceNames = ['bucket-cost-run.mjs', 'bucket-cost-common.mjs', 'bucket-cost-workload.mjs', 'bucket-cost-analyze.mjs', 'bucket-cost-protocol.md'];
const nodeIdentity = () => ({ version: process.version, path: process.execPath, sha256: sha(process.execPath) });
const expectNode = node => assert.deepEqual(nodeIdentity(), node, 'Exact Node executable/version');
if (mode === 'prepare') {
  const [configArg, toolchainArg, outArg] = args; assert.ok(configArg && toolchainArg && outArg);
  assert.equal(process.version, 'v24.15.0');
  const configPath = resolve(configArg), config = read(configPath), toolchain = resolve(toolchainArg);
  assert.deepEqual(Object.keys(config.arms).sort(), arms.slice().sort());
  const admitted = Object.fromEntries(arms.map(arm => [arm, admitKernel(config.arms[arm], arm)])); requireIsolated(admitted);
  const inputs = [configPath, directory, toolchain, ...Object.values(admitted).flatMap(value => [value.manifest.root, value.manifestPath, dirname(value.manifest.buildReceipt)])];
  const out = freshOutside(outArg, inputs), sourceRoot = join(out, 'tools'); mkdirSync(sourceRoot);
  const bindings = { [configPath]: sha(configPath) }, sourceOriginals = {};
  for (const name of sourceNames) {
    const from = join(directory, name), to = join(sourceRoot, name);
    sourceOriginals[from] = sha(from); copyFileSync(from, to); bindings[to] = sha(to);
  }
  for (const value of Object.values(admitted)) Object.assign(bindings, value.bindings);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
  const require = createRequire(join(toolchain, 'package.json')), esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath);
  const binary = createRequire(esbuildPath).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  for (const p of [esbuildPath, join(dirname(esbuildPath), '../package.json'), binary, process.execPath, join(toolchain, 'package.json'), join(toolchain, 'pnpm-lock.yaml')]) bindings[p] = sha(p);
  const bundles = {};
  for (const arm of arms) {
    const value = admitted[arm], root = value.manifest.root, exports = read(join(root, 'package.json')).exports;
    const entry = join(out, `${arm}.entry.mjs`), output = join(out, `${arm}.mjs`);
    writeFileSync(entry, [
      `export { signalTree, entityMap, transactions } from ${JSON.stringify(resolve(root, exports['.'].import))};`,
      `export { peekInternalTransactionRuntime } from ${JSON.stringify(join(root, 'dist/enhancers/transactions/transactions.js'))};`,
      `export { getPathNotifier } from ${JSON.stringify(join(root, 'dist/lib/path-notifier.js'))};`, '',
    ].join('\n'), { flag: 'wx' });
    const built = await esbuild.build({ entryPoints: [entry], outfile: output, bundle: true, format: 'esm', platform: 'node', target: 'node24', minify: true, metafile: true,
      define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' } });
    const emitted = Object.values(built.metafile.outputs).flatMap(item => Object.entries(item.inputs)).filter(([, item]) => item.bytesInOutput > 0).map(([name]) => name);
    const nativeFactoryEmitted = emitted.some(name => name.endsWith('/experimental-publication/entity.js'));
    assert.equal(nativeFactoryEmitted, false, 'No Link factory in this optional transaction bucket screen');
    assert.equal(emitted.some(name => name.endsWith('/enhancers/transactions/transactions.js')), true);
    const meta = join(out, `${arm}.meta.json`); write(meta, built.metafile);
    for (const name of Object.keys(built.metafile.inputs)) {
      const p = resolve(name); assert.ok(p === entry || p.startsWith(resolve(root) + '/'), 'Single exact kernel authority'); bindings[p] = sha(p);
    }
    for (const p of [entry, output, meta]) bindings[p] = sha(p);
    bundles[arm] = { path: output, sha256: sha(output), bytes: readFileSync(output).length, nativeFactoryEmitted, transactionMethod: value.transactionMethod,
      kernelManifest: value.manifestPath, kernelManifestSha256: sha(value.manifestPath), sourceIdentity: { head: value.manifest.head, sourceSeal: value.manifest.sourceSeal, transactionsSourceSha256: config.arms[arm].transactionsSourceSha256 }, major: value.major };
  }
  verify(bindings);
  write(join(out, 'packet.json'), { kind: 'bucket-cost-packet-v1', createdUTC: new Date().toISOString(), command: [process.execPath, runner, ...process.argv.slice(2)],
    configPath, node: nodeIdentity(), runner: join(sourceRoot, 'bucket-cost-run.mjs'), sourceOriginals, protectedRoots: inputs, bindings, bundles,
    limits: 'Neutral production transaction capture screen. Distinct leaf/key work, reverse settlement, no recipient/history retention. Link native factory omitted; no full v16 coordination or application timing claim. v15 canonical package equality outside transactions.js is enforced.' });
  console.log(JSON.stringify({ packet: join(out, 'packet.json'), sha256: sha(join(out, 'packet.json')) }));
} else if (mode === 'plan') {
  const [packetArg, cohort, outArg, controlsArg] = args; assert.ok(packetArg && cohort && outArg);
  const packetPath = resolve(packetArg), packet = read(packetPath); assert.equal(packet.kind, 'bucket-cost-packet-v1');
  assert.equal(runner, packet.runner, 'Use frozen runner'); verify(packet.bindings); expectNode(packet.node);
  let controls, controlsBindings = {};
  if (cohort !== 'controls') {
    assert.ok(controlsArg, 'Admit completed controls before comparison');
    const path = resolve(controlsArg), prior = admitRun(path);
    assert.equal(prior.plan.cohort, 'controls'); assert.equal(prior.plan.packetPath, packetPath); assert.equal(prior.plan.packetSha256, sha(packetPath));
    controls = { results: path, sha256: sha(path) }; controlsBindings = prior.closure;
  }
  const out = freshOutside(outArg, [packetPath, dirname(packetPath), ...packet.protectedRoots, ...Object.keys(packet.bindings), ...Object.keys(controlsBindings)]);
  write(join(out, 'plan.json'), { kind: 'bucket-cost-plan-v1', createdUTC: new Date().toISOString(), command: [process.execPath, runner, ...process.argv.slice(2)],
    packetPath, packetSha256: sha(packetPath), node: packet.node, controls, cohort, schedule: schedule(cohort), output: join(out, 'execution'),
    bindings: { [packetPath]: sha(packetPath), ...packet.bindings, ...controlsBindings },
    limits: 'CPU60 primary plus8 same-arm controls, 3 exploratory rounds. Heap20 primary plus4 same-arm controls, separate explicit-GC children. Settlement call sums and drain intervals exclude useful oracle gaps. No significance or universal retention bound.' });
  console.log(JSON.stringify({ plan: join(out, 'plan.json'), count: schedule(cohort).length }));
} else if (mode === 'run') {
  const [planArg] = args; assert.ok(planArg);
  const planPath = resolve(planArg), plan = read(planPath), packet = read(plan.packetPath);
  assert.equal(plan.kind, 'bucket-cost-plan-v1'); assert.equal(packet.kind, 'bucket-cost-packet-v1'); assert.equal(runner, packet.runner);
  assert.equal(sha(plan.packetPath), plan.packetSha256); verify(plan.bindings); expectNode(plan.node);
  assert.deepEqual(plan.schedule, schedule(plan.cohort));
  if (plan.cohort !== 'controls') {
    const prior = admitRun(plan.controls.results); assert.equal(sha(plan.controls.results), plan.controls.sha256);
    assert.equal(prior.plan.cohort, 'controls'); assert.equal(prior.plan.packetPath, plan.packetPath);
  }
  const out = freshOutside(plan.output, [planPath, dirname(plan.packetPath), ...packet.protectedRoots, ...Object.keys(plan.bindings)]), results = [], pids = new Set();
  for (const sample of plan.schedule) {
    verify(plan.bindings);
    const resultPath = join(out, `child-${String(sample.index).padStart(3, '0')}.json`), command = childCommand(packet, plan.packetPath, resultPath, sample);
    const child = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 120000, env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '' } });
    const logPath = resultPath + '.log'; writeFileSync(logPath, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const result = existsSync(resultPath) ? read(resultPath) : undefined, expectedFault = faultOracles[sample.fault];
    let admissionError;
    try { admitResult(result, sample, plan.packetPath, packet, !expectedFault); assert.ok(!pids.has(result.pid), 'Fresh child PID'); pids.add(result.pid); }
    catch (error) { admissionError = describeError(error); }
    const passed = !child.error && !child.signal && !admissionError && !!result && !Object.hasOwn(result, 'cleanupError') && (expectedFault ? child.status === 1 && result.passed === false && result.detectedOracle === expectedFault : child.status === 0 && result.passed === true);
    const invocation = { sample, command, exitCode: child.status, signal: child.signal, ...(child.error ? { processError: describeError(child.error) } : {}),
      resultPath, resultSha256: result ? sha(resultPath) : undefined, logPath, logSha256: sha(logPath), admissionError, expectedFault, passed };
    write(join(out, `invocation-${String(sample.index).padStart(3, '0')}.json`), invocation); results.push(invocation);
    console.log(JSON.stringify({ index: sample.index, arm: sample.arm, profile: sample.profile.id, kind: sample.kind, fault: sample.fault, passed }));
    if (!passed) break;
  }
  verify(plan.bindings);
  const passed = results.length === plan.schedule.length && results.every(value => value.passed);
  write(join(out, 'results.json'), { passed, planPath, planSha256: sha(planPath), bindings: plan.bindings, results }); if (!passed) process.exitCode = 1;
} else if (mode === 'child') {
  const [packetArg, outArg, sampleArg] = args; assert.ok(packetArg && outArg && sampleArg);
  const packetPath = resolve(packetArg), packet = read(packetPath), sample = JSON.parse(sampleArg);
  const result = { sample, pid: process.pid, node: nodeIdentity(), packetPath, packetSha256: sha(packetPath), bundleSha256: packet.bundles[sample.arm]?.sha256, runnerSha256: sha(runner),
    host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, load: os.loadavg(), freeBytes: os.freemem() }, passed: false };
  try {
    assert.equal(packet.kind, 'bucket-cost-packet-v1'); assert.equal(runner, packet.runner); verify(packet.bindings); expectNode(packet.node);
    assert.ok(['controls', 'cpu', 'heap'].some(cohort => schedule(cohort).some(expected => JSON.stringify(expected) === JSON.stringify(sample))), 'Registered sample only');
    const bundle = packet.bundles[sample.arm]; assert.equal(sha(bundle.path), bundle.sha256);
    const api = await import(pathToFileURL(bundle.path).href); await runWorkload(api, bundle.transactionMethod, sample, result);
    verify(packet.bindings); result.passed = true;
  } catch (error) {
    result.error = describeError(error); result.errorWasUndefined = error === undefined;
    if (error instanceof assert.AssertionError && Object.values(faultOracles).includes(error.message.split('\n')[0])) result.detectedOracle = error.message.split('\n')[0];
  } finally { write(resolve(outArg), result); }
  if (!result.passed) process.exitCode = 1;
} else throw new Error('prepare CONFIG TOOLCHAIN OUT | plan PACKET_JSON controls|cpu|heap OUT [CONTROLS_RESULTS_JSON] | run PLAN_JSON | child PACKET_JSON OUT SAMPLE');
