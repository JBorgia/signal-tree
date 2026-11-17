#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { admitKernel, arms, expectedFaults, freshOutside, read, requireIsolatedSources, schedule, sha, verify, write } from './ledger-common.mjs';
import { describeError, runWorkload } from './ledger-workload.mjs';

const runner = fileURLToPath(import.meta.url), directory = dirname(runner);
const sourceNames = ['ledger-run.mjs', 'ledger-common.mjs', 'ledger-workload.mjs', 'ledger-analyze.mjs', 'ledger-protocol.md'];
const [mode, ...args] = process.argv.slice(2);
const nodeIdentity = () => ({ version: process.version, path: process.execPath, sha256: sha(process.execPath) });
const expectNode = expected => assert.deepEqual(nodeIdentity(), expected, 'Exact Node binary/version');
const expectedStageNames = ['factory', 'pendingSetup', 'ordinaryFlushes', 'settlementAndDrain', 'destroy'];

function admitChild(result, sample, packetPath, full) {
  const packet = read(packetPath);
  assert.ok(result, 'Missing child payload');
  assert.deepEqual(result.sample, sample);
  assert.equal(result.packetPath, packetPath); assert.equal(result.packetSha256, sha(packetPath));
  assert.equal(result.bundleSha256, packet.bundles[sample.arm].sha256);
  assert.deepEqual(result.node, packet.node);
  assert.equal(result.runnerSha256, packet.bindings[packet.runner]);
  assert.ok(Number.isInteger(result.pid) && result.pid > 0);
  if (!full) return;
  if (sample.kind === 'cpu') {
    assert.deepEqual(Object.keys(result.stages), expectedStageNames);
    assert.equal(result.operationSamples.length, sample.profile.N);
    for (const stage of [...Object.values(result.stages), ...result.operationSamples]) {
      for (const number of [stage.elapsedNs, stage.cpuMicroseconds.user, stage.cpuMicroseconds.system, stage.cpuMs])
        assert.ok(Number.isFinite(number) && number >= 0, 'Finite nonnegative timing');
      assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000);
    }
    for (const key of ['elapsedNs', 'cpuMs']) {
      const expected = result.operationSamples.reduce((n, item) => n + item[key], 0);
      assert.ok(Math.abs(result.stages.ordinaryFlushes[key] - expected) < 1e-8, 'Ordinary timing sum');
    }
  } else if (sample.kind !== 'overlap-control') assert.deepEqual(result.stages, {}, 'No CPU figures from heap/control children');
  if (sample.kind === 'heap' || sample.kind === 'heap-control') {
    const names = ['moduleReady', 'held', 'settled', 'destroyedHeld', 'helperReturned'];
    if (sample.control === 'pin-release') names.push('pinReleased');
    assert.deepEqual(Object.keys(result.checkpoints), names);
    for (const point of Object.values(result.checkpoints)) assert.ok(Number.isSafeInteger(point.heapUsed) && point.heapUsed > 0);
  }
  if (sample.kind !== 'overlap-control') {
    assert.ok(result.oracles.held && result.oracles.settled);
    for (const oracle of Object.values(result.oracles)) assert.match(oracle.digest, /^[a-f0-9]{64}$/);
  }
}

if (mode === 'prepare') {
  const [configArg, toolchainArg, outArg] = args;
  assert.ok(configArg && toolchainArg && outArg);
  assert.equal(process.version, 'v24.15.0');
  const configPath = resolve(configArg), config = read(configPath), toolchain = resolve(toolchainArg);
  assert.deepEqual(Object.keys(config.arms).sort(), arms.slice().sort());
  const admitted = Object.fromEntries(arms.map(arm => [arm, admitKernel(config.arms[arm], arm)]));
  requireIsolatedSources(admitted);
  const inputs = [configPath, directory, toolchain, ...Object.values(admitted).flatMap(x => [x.manifest.root, dirname(x.manifestPath), dirname(x.manifest.buildReceipt)])];
  const out = freshOutside(outArg, inputs), sourceRoot = join(out, 'tools'); mkdirSync(sourceRoot);
  const bindings = { [configPath]: sha(configPath) }, sourceOriginals = {};
  for (const name of sourceNames) {
    const source = join(directory, name), copy = join(sourceRoot, name);
    sourceOriginals[source] = sha(source); copyFileSync(source, copy); bindings[copy] = sha(copy);
  }
  for (const item of Object.values(admitted)) Object.assign(bindings, item.bindings);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
  const require = createRequire(join(toolchain, 'package.json'));
  const esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath), esbuildRequire = createRequire(esbuildPath);
  const binary = esbuildRequire.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  for (const file of [esbuildPath, join(dirname(esbuildPath), '..', 'package.json'), binary, process.execPath, join(toolchain, 'pnpm-lock.yaml')]) bindings[file] = sha(file);
  const bundles = {};
  for (const arm of arms) {
    const root = admitted[arm].manifest.root, exports = read(join(root, 'package.json')).exports;
    const input = join(out, `${arm}.entry.mjs`), output = join(out, `${arm}.mjs`);
    writeFileSync(input, [
      `export { signalTree, transactions } from ${JSON.stringify(resolve(root, exports['.'].import))};`,
      `export { confirmedTurnReader } from ${JSON.stringify(resolve(root, exports['./internals'].import))};`,
      `export { peekInternalTransactionRuntime } from ${JSON.stringify(join(root, 'dist/enhancers/transactions/transactions.js'))};`,
      `export { getPathNotifier } from ${JSON.stringify(join(root, 'dist/lib/path-notifier.js'))};`, '',
    ].join('\n'), { flag: 'wx' });
    const build = await esbuild.build({ entryPoints: [input], outfile: output, bundle: true, format: 'esm', platform: 'node', target: 'node24', minify: true, metafile: true,
      define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' } });
    const nativeFactoryEmitted = Object.values(build.metafile.outputs).some(x => Object.entries(x.inputs).some(([name, info]) => name.endsWith('/experimental-publication/entity.js') && info.bytesInOutput > 0));
    assert.equal(nativeFactoryEmitted, false, 'This ledger screen omits the Link entity factory');
    const meta = join(out, `${arm}.meta.json`); write(meta, build.metafile);
    for (const name of Object.keys(build.metafile.inputs)) bindings[resolve(name)] = sha(resolve(name));
    for (const path of [input, output, meta]) bindings[path] = sha(path);
    bundles[arm] = { path: output, sha256: sha(output), bytes: readFileSync(output).length, nativeFactoryEmitted,
      kernelManifest: admitted[arm].manifestPath, kernelManifestSha256: sha(admitted[arm].manifestPath), transactionsSourceSha256: config.arms[arm].transactionsSourceSha256 };
  }
  verify(bindings);
  write(join(out, 'packet.json'), { kind: 'ledger-screen-packet-v1', createdUTC: new Date().toISOString(), command: [process.execPath, runner, ...process.argv.slice(2)],
    configPath, node: nodeIdentity(), runner: join(sourceRoot, 'ledger-run.mjs'), sourceOriginals, protectedRoots: inputs, bindings, bundles,
    limits: 'Isolated neutral production ledger mechanisms; no Angular, UI, Link entity factory or complete v16 coordination claim. All production/build inputs except transactions.ts are identical across arms.' });
  console.log(JSON.stringify({ prepared: out, packetSha256: sha(join(out, 'packet.json')), bundles }));
} else if (mode === 'plan') {
  const [packetArg, kind, outArg] = args;
  assert.ok(packetArg && kind && outArg);
  const packetPath = resolve(packetArg), packet = read(packetPath); assert.equal(packet.kind, 'ledger-screen-packet-v1');
  verify(packet.bindings); expectNode(packet.node);
  const out = freshOutside(outArg, [dirname(packetPath), ...packet.protectedRoots, ...Object.keys(packet.bindings)]);
  const plan = { kind: 'ledger-screen-plan-v1', createdUTC: new Date().toISOString(), command: [process.execPath, runner, ...process.argv.slice(2)],
    packetPath, packetSha256: sha(packetPath), bindings: { [packetPath]: sha(packetPath), ...packet.bindings }, node: packet.node,
    schedule: schedule(kind), cohort: kind, output: join(out, 'execution'),
    limits: 'Preregistered exploratory screen. CPU: 84 primary + 8 A/A, three balanced rounds. Heap: 16 primary + 2 A/A, separate GC children. No significance/constant-space claim.' };
  write(join(out, 'plan.json'), plan); console.log(JSON.stringify({ plan: join(out, 'plan.json'), count: plan.schedule.length }));
} else if (mode === 'run') {
  const [planArg] = args; assert.ok(planArg);
  const planPath = resolve(planArg), plan = read(planPath), packet = read(plan.packetPath);
  assert.equal(plan.kind, 'ledger-screen-plan-v1');
  assert.equal(sha(plan.packetPath), plan.packetSha256); verify(plan.bindings); expectNode(plan.node);
  assert.deepEqual(plan.schedule, schedule(plan.cohort), 'Exact registered schedule');
  const out = freshOutside(plan.output, [planPath, dirname(plan.packetPath), ...packet.protectedRoots, ...Object.keys(plan.bindings)]), results = [];
  for (const sample of plan.schedule) {
    verify(plan.bindings);
    const resultPath = join(out, `child-${String(sample.index).padStart(3, '0')}.json`);
    const heap = sample.kind === 'heap' || sample.kind === 'heap-control';
    const command = [...(heap ? ['--expose-gc'] : []), packet.runner, 'child', plan.packetPath, resultPath, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 120000,
      env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '' } });
    const logPath = resultPath + '.log'; writeFileSync(logPath, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const result = existsSync(resultPath) ? read(resultPath) : undefined, wanted = expectedFaults[sample.fault];
    let admissionError;
    try { admitChild(result, sample, plan.packetPath, !wanted); } catch (error) { admissionError = describeError(error); }
    const passed = !child.error && !child.signal && !admissionError && !!result && !Object.hasOwn(result, 'cleanupError') && (wanted
      ? child.status === 1 && result.passed === false && result.error?.includes(wanted) === true
      : child.status === 0 && result.passed === true);
    const receipt = { sample, command: [process.execPath, ...command], exitCode: child.status, signal: child.signal,
      ...(child.error ? { processError: describeError(child.error) } : {}), resultPath, resultSha256: result ? sha(resultPath) : undefined,
      logPath, logSha256: sha(logPath), admissionError, expectedFault: wanted, passed };
    write(join(out, `invocation-${String(sample.index).padStart(3, '0')}.json`), receipt); results.push(receipt);
    console.log(JSON.stringify({ index: sample.index, arm: sample.arm, profile: sample.profile.id, kind: sample.kind, fault: sample.fault, passed }));
    if (!passed) break;
  }
  verify(plan.bindings);
  const passed = results.length === plan.schedule.length && results.every(result => result.passed);
  write(join(out, 'results.json'), { passed, planPath, planSha256: sha(planPath), bindings: plan.bindings, results });
  if (!passed) process.exitCode = 1;
} else if (mode === 'child') {
  const [packetArg, outArg, sampleArg] = args;
  const packetPath = resolve(packetArg), packet = read(packetPath), sample = JSON.parse(sampleArg);
  const result = { sample, pid: process.pid, node: nodeIdentity(), packetPath, packetSha256: sha(packetPath),
    bundleSha256: packet.bundles[sample.arm].sha256, runnerSha256: sha(runner),
    host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, load: os.loadavg(), freeBytes: os.freemem() }, passed: false };
  try {
    expectNode(packet.node); verify(packet.bindings);
    assert.equal(runner, packet.runner, 'Run the frozen source copy');
    const bundle = packet.bundles[sample.arm]; assert.equal(sha(bundle.path), bundle.sha256);
    const api = await import(pathToFileURL(bundle.path).href);
    await runWorkload(api, sample, result);
    verify(packet.bindings); result.passed = true;
  } catch (error) { result.error = describeError(error); result.errorWasUndefined = error === undefined; }
  finally { write(resolve(outArg), result); }
  if (!result.passed) process.exitCode = 1;
} else throw new Error('prepare CONFIG TOOLCHAIN OUT | plan PACKET_JSON cpu|heap|controls OUT | run PLAN_JSON | child PACKET_JSON OUT SAMPLE');
