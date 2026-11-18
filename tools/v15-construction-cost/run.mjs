import assert from 'node:assert/strict';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { cpus, loadavg, freemem, totalmem, platform, arch } from 'node:os';
import { gzipSync } from 'node:zlib';
import { read, sha, save, verify, fresh, admit, schedule, faults } from './common.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [command, ...args] = process.argv.slice(2);
assert.equal(process.version, 'v24.15.0');
if (command === 'prepare') {
  const [configArg, outputArg] = args, configPath = resolve(configArg), config = read(configPath);
  assert.deepEqual(Object.keys(config.arms).sort(), ['baseline', 'lazy', 'planning']);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
  const admitted = Object.fromEntries(Object.entries(config.arms).map(([arm, input]) => [arm, admit(input.manifest, input.sha256)]));
  const planningFiles = ['packages/kernel/src/enhancers/index.ts', 'packages/kernel/src/lib/signal-tree.ts'];
  const lazyFiles = ['mutation-capture-runtime', 'position-registry', 'tree-scalar-slot-runtime', 'tree-scalar-leaf-runtime', 'native-tree-scalar-leaf-runtime'].map(name => `packages/kernel/src/lib/internals/${name}.ts`);
  const without = (sources, allowed) => Object.fromEntries(Object.entries(sources).filter(([name]) => !name.endsWith('.spec.ts') && !allowed.includes(name)));
  assert.deepEqual(without(admitted.planning.sources, planningFiles), without(admitted.baseline.sources, planningFiles), 'Planning source isolation');
  assert.deepEqual(without(admitted.lazy.sources, lazyFiles), without(admitted.planning.sources, lazyFiles), 'Lazy source isolation');
  const out = fresh(outputArg, [here, configPath, ...Object.values(admitted).map(value => value.manifest.root)]);
  const bindings = { [configPath]: sha(configPath), [process.execPath]: sha(process.execPath) };
  for (const value of Object.values(admitted)) Object.assign(bindings, value.bindings);
  const harness = join(out, 'harness'); mkdirSync(harness);
  for (const file of ['run.mjs', 'child.mjs', 'common.mjs', 'workload.mjs', 'README.md']) {
    const source = join(here, file), copied = join(harness, file);
    copyFileSync(source, copied); bindings[source] = sha(source); bindings[copied] = sha(copied);
  }
  const require = createRequire(join(resolve(config.toolchain), 'package.json'));
  const esbuildPath = require.resolve('esbuild'), esbuild = require('esbuild');
  bindings[esbuildPath] = sha(esbuildPath);
  const esbuildBinary = createRequire(esbuildPath).resolve(`@esbuild/${platform()}-${arch()}/bin/esbuild`);
  bindings[esbuildBinary] = sha(esbuildBinary);
  for (const file of ['package.json', 'pnpm-lock.yaml']) bindings[join(resolve(config.toolchain), file)] = sha(join(resolve(config.toolchain), file));
  assert.equal(sha(config.angularAdapter), config.angularAdapterSha256);
  bindings[resolve(config.angularAdapter)] = config.angularAdapterSha256;
  const bundles = {}, bundleSizes = {};
  for (const [arm, value] of Object.entries(admitted)) {
    bundles[arm] = {};
    const root = value.manifest.root;
    for (const carrier of ['neutral', 'angular']) {
      bundles[arm][carrier] = {};
      for (const entry of ['bare', 'loaded']) {
        const name = `${arm}-${carrier}-${entry}`, source = join(out, name + '.entry.mjs'), bundle = join(out, name + '.mjs');
        const lines = carrier === 'neutral'
          ? [`export { signalTree } from ${JSON.stringify(join(root, 'dist/index.js'))};`]
          : [`import { createSignalTreeFactory } from ${JSON.stringify(join(root, 'dist/adapter.js'))};`,
            `import { ANGULAR_OBSERVATION_ADAPTER } from ${JSON.stringify(resolve(config.angularAdapter))};`,
            'export const signalTree = createSignalTreeFactory(ANGULAR_OBSERVATION_ADAPTER);'];
        if (entry === 'loaded') lines.push(`export { link, transactions } from ${JSON.stringify(join(root, 'dist/index.js'))};`);
        writeFileSync(source, lines.join('\n') + '\n', { flag: 'wx' });
        const built = await esbuild.build({ entryPoints: [source], outfile: bundle, bundle: true, write: false,
          minify: true, platform: 'node', target: 'node24', format: 'esm', metafile: true,
          nodePaths: [join(resolve(config.toolchain), 'node_modules')], legalComments: 'none', logLevel: 'silent',
          define: { ngDevMode: 'false', __DEV__: 'false', 'process.env.NODE_ENV': '"production"' } });
        const contents = built.outputFiles[0].contents;
        writeFileSync(bundle, contents, { flag: 'wx' });
        const meta = join(out, name + '.meta.json'); save(meta, built.metafile);
        bindings[source] = sha(source); bindings[bundle] = sha(bundle); bindings[meta] = sha(meta);
        for (const input of Object.keys(built.metafile.inputs)) bindings[resolve(input)] = sha(resolve(input));
        const emitted = Object.values(built.metafile.outputs).flatMap(output => Object.entries(output.inputs).filter(([, value]) => value.bytesInOutput > 0).map(([path]) => path));
        assert.equal(emitted.some(path => path.endsWith('/lib/link.js')), entry === 'loaded', 'Link fixture inclusion');
        assert.equal(emitted.some(path => path.endsWith('/enhancers/transactions/transactions.js')), entry === 'loaded', 'Transaction fixture inclusion');
        assert(!emitted.some(path => path.includes('/enhancers/restoration/')), 'No unintended restoration implementation');
        assert(!emitted.some(path => path.includes('/packages/kernel/src/')), 'No source aliases');
        bundles[arm][carrier][entry] = bundle;
        bundleSizes[name] = { bytes: contents.length, gzipBytes: gzipSync(contents, { level: 9 }).length,
          limits: carrier === 'angular' ? 'Includes Angular runtime: not a marginal library-size figure.' : 'Neutral production fixture; exported runtime remains callable.' };
      }
    }
  }
  verify(bindings);
  save(join(out, 'packet.json'), { kind: 'v15-construction-cost-v1', createdUTC: new Date().toISOString(), command: process.argv,
    config, manifests: Object.fromEntries(Object.entries(admitted).map(([arm, value]) => [arm, value.manifestPath])),
    node: process.execPath, esbuild: esbuild.version, harness, bundles, bundleSizes, bindings });
  console.log(JSON.stringify({ prepared: out, bundles: bundleSizes }));
} else if (command === 'run') {
  const [packetArg, kind, outputArg] = args, packetPath = resolve(packetArg), packet = read(packetPath);
  assert.equal(packet.kind, 'v15-construction-cost-v1'); verify(packet.bindings);
  const out = fresh(outputArg, [dirname(packetPath), here]);
  const samples = schedule(kind), packetSha256 = sha(packetPath);
  save(join(out, 'plan.json'), { kind, packetPath, packetSha256, command: process.argv, samples });
  const outcomes = [];
  for (const sample of samples) {
    const bundle = packet.bundles[sample.arm][sample.carrier][sample.profile.entry];
    const bindings = { [bundle]: packet.bindings[bundle], [packet.node]: packet.bindings[packet.node] };
    for (const file of ['child.mjs', 'common.mjs', 'workload.mjs']) { const path = join(packet.harness, file); bindings[path] = packet.bindings[path]; }
    verify(bindings); assert.equal(sha(packetPath), packetSha256);
    const inputPath = join(out, `input-${sample.index}.json`), output = join(out, `result-${sample.index}.json`);
    save(inputPath, { bundle, bindings, sample });
    const childCommand = [packet.node, ...(['heap', 'heap-control'].includes(sample.kind) ? ['--expose-gc'] : []), join(packet.harness, 'child.mjs'), inputPath];
    const startedUTC = new Date().toISOString(), clock = process.hrtime.bigint();
    const environment = { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, cores: cpus().length, totalMemory: totalmem(), freeMemory: freemem(), loadavg: loadavg() };
    const child = spawnSync(childCommand[0], childCommand.slice(1), { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
    writeFileSync(output + '.stdout', child.stdout ?? '', { flag: 'wx' }); writeFileSync(output + '.stderr', child.stderr ?? '', { flag: 'wx' });
    let result;
    try { result = JSON.parse(child.stdout.trim()); } catch { result = { passed: false, error: 'No complete child JSON' }; }
    save(output, result);
    const expectedError = sample.fault ? faults[sample.fault] : undefined;
    const passed = expectedError ? child.status === 1 && result.passed === false && result.error?.includes(expectedError)
      : child.status === 0 && result.passed === true;
    const receipt = { sample, childCommand, startedUTC, seconds: Number(process.hrtime.bigint() - clock) / 1e9, environment,
      inputSha256: sha(inputPath), resultSha256: sha(output), stdoutSha256: sha(output + '.stdout'), stderrSha256: sha(output + '.stderr'),
      exitCode: child.status, signal: child.signal, launchError: child.error?.message, expectedError, passed };
    save(join(out, `receipt-${sample.index}.json`), receipt); outcomes.push(receipt);
    console.log(`${kind} ${sample.index + 1}/${samples.length} ${sample.arm}/${sample.carrier}/${sample.profile.id}: ${passed ? 'pass' : 'FAIL'}`);
    assert(passed, `Child failed; preserve ${output}`);
  }
  verify(packet.bindings); assert.equal(sha(packetPath), packetSha256);
  const groups = new Map();
  for (const receipt of outcomes.filter(value => !value.sample.fault && value.sample.kind !== 'heap-control')) {
    const { sample } = receipt, result = read(join(out, `result-${sample.index}.json`));
    const key = sample.carrier + '/' + sample.profile.id;
    if (groups.has(key)) assert.deepEqual(result.oracles, groups.get(key), `Same observable work: ${key}`);
    else groups.set(key, result.oracles);
  }
  save(join(out, 'result.json'), { passed: true, kind, packetPath, packetSha256, children: outcomes.length,
    sameObservableWork: true, bindingsUnchanged: true, limits: 'CPU stages and whole episode include the declared harness work. Heap is process-wide; finite release observations are not universal leak proof.' });
} else throw new Error('Use prepare CONFIG NEW_PACKET or run PACKET controls|cpu|heap NEW_OUTPUT');
