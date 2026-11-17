#!/usr/bin/env node
// Neutral built-kernel screening. Final application/retention qualification is separate.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const runner = fileURLToPath(import.meta.url);
const [mode, ...args] = process.argv.slice(2);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const fresh = path => { assert.ok(!existsSync(path), `Preserve existing output: ${path}`); mkdirSync(path, { recursive: true }); };
const verify = bindings => { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
const describeError = error => error instanceof Error ? error.stack ?? error.message : inspect(error);
const stageNames = ['emptyTree', 'population', 'firstAll', 'sparseWrites', 'broadProjection', 'existingReplacementAndReorder', 'destroy'];

function admit(result, sample, packetPath, complete) {
  assert.ok(result, 'Missing child result');
  assert.deepEqual(result.sample, sample, 'Child sample identity');
  assert.equal(result.packetPath, packetPath, 'Child packet path');
  assert.equal(result.packetSha256, sha(packetPath), 'Child packet identity');
  assert.equal(result.bundleSha256, read(packetPath).bundles[sample.activation].sha256, 'Child bundle identity');
  assert.equal(result.node, process.version, 'Child Node version');
  assert.ok(Number.isInteger(result.pid) && result.pid > 0, 'Child PID');
  if (complete) assert.deepEqual(Object.keys(result.stages), stageNames, 'Complete exact stage set');
  for (const [name, stage] of Object.entries(result.stages)) {
    assert.ok(stageNames.includes(name), 'Unknown stage');
    for (const value of [stage.elapsedNs, stage.cpuMs, stage.cpuMicroseconds?.user, stage.cpuMicroseconds?.system])
      assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Finite nonnegative measurement required');
    assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000, 'CPU total');
  }
}

if (mode === 'prepare') {
  const [manifestArg, toolchainArg, outArg] = args;
  assert.ok(manifestArg && toolchainArg && outArg);
  const manifestPath = resolve(manifestArg), toolchain = resolve(toolchainArg), out = resolve(outArg);
  const manifest = read(manifestPath), bindings = { [manifestPath]: sha(manifestPath), [runner]: sha(runner) };
  for (const [name, digest] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = digest;
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256, 'Exact build receipt');
  assert.equal(read(manifest.buildReceipt).exitCode, 0, 'Successful build receipt');
  bindings[manifest.buildReceipt] = manifest.buildReceiptSha256;
  verify(bindings); fresh(out);
  const frozenRunner = join(out, 'runner.mjs');
  writeFileSync(frozenRunner, readFileSync(runner), { flag: 'wx' }); bindings[frozenRunner] = sha(frozenRunner);
  const require = createRequire(join(toolchain, 'package.json'));
  const esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined, 'Bind the standard native esbuild binary');
  const esbuildRequire = createRequire(esbuildPath);
  const esbuildBinary = esbuildRequire.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  for (const path of [esbuildPath, join(dirname(esbuildPath), '..', 'package.json'), esbuildBinary, process.execPath]) bindings[path] = sha(path);
  bindings[join(toolchain, 'pnpm-lock.yaml')] = sha(join(toolchain, 'pnpm-lock.yaml'));
  const exports = read(join(manifest.root, 'package.json')).exports;
  const entry = resolve(manifest.root, exports['.'].import);
  const bundles = {};
  for (const activation of ['bare', 'native-loaded']) {
    const input = join(out, `${activation}.entry.mjs`), output = join(out, `${activation}.mjs`);
    writeFileSync(input, `export { signalTree, entityMap${activation === 'native-loaded' ? ', link, transactions, restoration' : ''} } from ${JSON.stringify(entry)};\n`, { flag: 'wx' });
    const build = await esbuild.build({ entryPoints: [input], outfile: output, bundle: true, format: 'esm', platform: 'node', target: 'node24', minify: true, metafile: true,
      define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' } });
    const meta = join(out, `${activation}.meta.json`); write(meta, build.metafile);
    const inputs = Object.keys(build.metafile.inputs).map(path => resolve(path));
    // Parsed inputs include tree-shaken modules. Only emitted contributions
    // establish that the native factory remains in this consumer bundle.
    const nativeModule = Object.values(build.metafile.outputs).some(output =>
      Object.entries(output.inputs).some(([path, input]) => path.endsWith('/experimental-publication/entity.js') && input.bytesInOutput > 0));
    assert.equal(nativeModule, activation === 'native-loaded', 'Native module admission must match the named activation arm');
    for (const path of inputs) bindings[path] = sha(path);
    for (const path of [input, output, meta]) bindings[path] = sha(path);
    bundles[activation] = { path: output, sha256: sha(output), bytes: readFileSync(output).length, nativeModule };
  }
  verify(bindings);
  write(join(out, 'packet.json'), { kind: 'optimization-runtime-screen-packet-v1', manifestPath, sourceHead: manifest.head, bundles, bindings,
    limits: 'Fresh built neutral-kernel bundles, not installed Angular application timing or release artifacts. Bare omits the native publication factory; native-loaded retains its module without adding a recipient.' });
  console.log(JSON.stringify({ prepared: out, bundles }));
} else if (mode === 'compare' || mode === 'controls') {
  const [baselineArg, candidateArg, outArg] = args;
  assert.ok(baselineArg && candidateArg && outArg);
  const packets = { baseline: resolve(baselineArg), candidate: resolve(candidateArg) }, out = resolve(outArg);
  const bindings = { [runner]: sha(runner) };
  for (const packet of Object.values(packets)) {
    const path = join(packet, 'packet.json'); bindings[path] = sha(path); Object.assign(bindings, read(path).bindings);
  }
  verify(bindings); fresh(out);
  const schedule = [];
  if (mode === 'controls') {
    for (const fault of [undefined, 'wrong-value', 'missing-row', 'snapshot-corruption']) schedule.push({ arm: 'baseline', activation: 'bare', rows: 100, width: 4, round: 0, kind: 'timing', ...(fault ? { fault } : {}) });
  } else {
    let profile = 0;
    for (const width of [8, 32]) for (const activation of ['bare', 'native-loaded']) {
      for (let round = 0; round < 3; round++) {
        for (const arm of (round + profile) % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
          schedule.push({ arm, activation, rows: 10000, width, round, kind: 'timing' });
        // A/A pairs cover this exact width/module profile and stay separate.
        if (round !== 1) for (const repeat of [0, 1])
          schedule.push({ arm: 'baseline', activation, rows: 10000, width, round, repeat, kind: 'timing', control: 'AA' });
      }
      profile++;
    }
  }
  const schedulePath = join(out, 'schedule.json');
  write(schedulePath, { createdUTC: new Date().toISOString(), command: [process.execPath, runner, ...process.argv.slice(2)], bindings, packets, schedule,
    scope: 'Preliminary three-pair neutral CPU/elapsed screen, two row widths and two module states; two separate A/A pairs for each profile. First process execution retained; no discarded warmups. No confidence interval, heap win, native-recipient parity or release qualification implied.' });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const resultPath = join(out, `child-${String(index).padStart(3, '0')}.json`);
    const command = [runner, 'child', packets[sample.arm], resultPath, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 120000, env: { ...process.env, NODE_ENV: 'production' } });
    const log = resultPath + '.log'; writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const result = existsSync(resultPath) ? read(resultPath) : undefined;
    const wantedError = { 'wrong-value': 'value-oracle', 'missing-row': 'population-oracle', 'snapshot-corruption': 'snapshot-oracle' }[sample.fault];
    let admissionError;
    try { admit(result, sample, join(packets[sample.arm], 'packet.json'), !wantedError); }
    catch (error) { admissionError = describeError(error); }
    const passed = !admissionError && !!result && !Object.hasOwn(result, 'cleanupError') && (wantedError ? child.status === 1 && result.passed === false && result.error?.includes(wantedError) === true : child.status === 0 && result.passed === true);
    const record = { sample, command: [process.execPath, ...command], exitCode: child.status, signal: child.signal, error: child.error ? String(child.error) : undefined,
      resultPath, resultSha256: result ? sha(resultPath) : undefined, log, logSha256: sha(log), admissionError, passed };
    write(join(out, `invocation-${index}.json`), record); results.push(record);
    console.log(JSON.stringify({ index, ...sample, passed }));
    if (!passed) break;
  }
  verify(bindings);
  const passed = results.length === schedule.length && results.every(result => result.passed);
  write(join(out, 'results.json'), { passed, schedulePath, scheduleSha256: sha(schedulePath), bindings, results });
  if (!passed) process.exitCode = 1;
} else if (mode === 'child') {
  const [packetArg, outArg, sampleArg] = args;
  const packetPath = join(resolve(packetArg), 'packet.json'), packet = read(packetPath), sample = JSON.parse(sampleArg);
  verify(packet.bindings);
  assert.ok(['bare', 'native-loaded'].includes(sample.activation));
  const bundle = packet.bundles[sample.activation]; assert.equal(sha(bundle.path), bundle.sha256);
  const { signalTree, entityMap } = await import(pathToFileURL(bundle.path).href);
  const rows = Array.from({ length: sample.rows }, (_, id) => Object.fromEntries([['id', id], ['value', id], ...Array.from({ length: sample.width - 2 }, (_, field) => [`f${field}`, id + field])]));
  const expected = rows.map(row => ({ ...row }));
  const stages = {}, result = { sample, pid: process.pid, node: process.version, packetPath, packetSha256: sha(packetPath), bundleSha256: bundle.sha256,
    host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, load: os.loadavg(), freeBytes: os.freemem() }, stages, passed: false };
  let tree, map, first;
  const timed = (name, work) => {
    const cpu = process.cpuUsage(), start = process.hrtime.bigint();
    const value = work();
    const elapsedNs = Number(process.hrtime.bigint() - start), consumed = process.cpuUsage(cpu);
    stages[name] = { elapsedNs, cpuMicroseconds: consumed, cpuMs: (consumed.user + consumed.system) / 1000 };
    return value;
  };
  try {
    tree = timed('emptyTree', () => signalTree({ rows: entityMap({ selectId: row => row.id }) })); map = tree.$.rows;
    timed('population', () => map.setAll(sample.fault === 'missing-row' ? rows.slice(1) : rows));
    assert.equal(map.count(), rows.length, 'population-oracle');
    first = timed('firstAll', () => map.all());
    assert.deepEqual(first, expected, 'population-oracle');
    // Fresh entity input may retain caller row identity. The snapshot check
    // below concerns replacement through library writes, not caller mutation.
    timed('sparseWrites', () => {
      for (let i = 0; i < 100; i++) {
        const id = (i * 97) % sample.rows;
        map.updateOne(id, { value: i + sample.rows }); expected[id].value = i + sample.rows;
      }
    });
    if (sample.fault === 'wrong-value') expected[0].value--;
    assert.deepEqual(map.all(), expected, 'value-oracle');
    if (sample.fault === 'snapshot-corruption') first[0].value = -1;
    assert.equal(first[0].value, 0, 'snapshot-oracle');
    timed('broadProjection', () => {
      for (let i = 0; i < 40; i++) {
        const id = (i * 89) % sample.rows;
        map.updateOne(id, { value: sample.rows + 100 + i }); expected[id].value = sample.rows + 100 + i;
        const all = map.all(); assert.equal(all.length, sample.rows, 'projection-cardinality-oracle');
        assert.equal(all[id].value, expected[id].value, 'projection-value-oracle');
      }
    });
    assert.deepEqual(map.all(), expected, 'value-oracle');
    const reverse = [...expected].reverse();
    timed('existingReplacementAndReorder', () => map.setAll(reverse));
    assert.deepEqual(map.all(), reverse, 'reorder-oracle');
    timed('destroy', () => tree.destroy()); tree = undefined; map = undefined; first = undefined;
    verify(packet.bindings); result.passed = true;
  } catch (error) { result.error = describeError(error); }
  finally {
    try { tree?.destroy(); }
    catch (error) { result.cleanupError = describeError(error); result.passed = false; }
    write(resolve(outArg), result);
  }
  if (!result.passed) process.exitCode = 1;
} else throw new Error('Use prepare MANIFEST TOOLCHAIN OUT | compare BASE_PACKET CANDIDATE_PACKET OUT | controls BASE_PACKET CANDIDATE_PACKET OUT | child PACKET OUT SAMPLE');
