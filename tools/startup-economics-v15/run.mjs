import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cpus, loadavg, freemem } from 'node:os';
import { Session } from 'node:inspector/promises';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, value) => writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const verify = bindings => { for (const [p, hash] of Object.entries(bindings)) assert.equal(sha(p), hash, p); };
const [command, ...args] = process.argv.slice(2);
assert.equal(process.version, 'v24.15.0');

if (command === 'prepare') {
  const [kernelArg, angularArg, outputArg] = args;
  const kernel = resolve(kernelArg), angular = resolve(angularArg), out = resolve(outputArg);
  assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  const require = createRequire(join(repo, 'package.json'));
  const esbuild = require('esbuild');
  const bindings = { [process.execPath]: sha(process.execPath), [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)) };
  const bundles = {};
  for (const carrier of ['neutral', 'angular']) {
    const entry = join(out, `${carrier}.entry.mjs`), bundle = join(out, `${carrier}.mjs`);
    writeFileSync(entry, `export { signalTree, entityMap, transactions, link } from ${JSON.stringify(join(carrier === 'neutral' ? kernel : angular, 'dist/index.js'))};\n`);
    const built = await esbuild.build({ entryPoints: [entry], outfile: bundle, bundle: true,
      format: 'esm', platform: 'node', target: 'node24', minify: false, metafile: true,
      nodePaths: [join(repo, 'node_modules')], legalComments: 'none', logLevel: 'silent',
      alias: { '@signal-tree/kernel/adapter': join(kernel, 'dist/adapter.js'), '@signal-tree/kernel/internals': join(kernel, 'dist/internals.js'), '@signal-tree/kernel': join(kernel, 'dist/index.js') },
      define: { ngDevMode: 'false', __DEV__: 'false', 'process.env.NODE_ENV': '"production"' } });
    save(bundle + '.meta.json', built.metafile);
    for (const input of Object.keys(built.metafile.inputs)) bindings[resolve(input)] = sha(resolve(input));
    assert(!Object.keys(built.metafile.inputs).some(p => p.includes('/packages/kernel/src/')));
    bindings[bundle] = sha(bundle); bundles[carrier] = bundle;
  }
  verify(bindings);
  save(join(out, 'packet.json'), { command: process.argv, kernel, angular, bundles, bindings, esbuild: esbuild.version,
    limits: 'Production defines; unminified consumer fixture for function attribution. Includes actual Angular facade and its peer runtime. Not a delivered-size measurement.' });
  console.log(out);
} else if (command === 'run') {
  const [baselineArg, candidateArg, outputArg, kind = 'cpu', roundsArg = '5'] = args;
  const packets = { baseline: resolve(baselineArg), candidate: resolve(candidateArg) };
  const out = resolve(outputArg); assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  const rounds = Number(roundsArg), schedule = [];
  for (const carrier of ['neutral', 'angular']) for (const profile of ['ordinary', 'entities-1000', 'entities-10000', 'transactions-10000']) {
    for (let round = 0; round < rounds; round++) {
      const arms = round % 2 ? ['candidate', 'baseline', 'baseline-aa'] : ['baseline-aa', 'baseline', 'candidate'];
      for (const arm of arms) schedule.push({ carrier, profile, round, arm, kind });
    }
  }
  save(join(out, 'plan.json'), { command: process.argv, packets, packetHashes: Object.fromEntries(Object.entries(packets).map(([k,p]) => [k, sha(p)])), schedule });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const packetPath = packets[sample.arm === 'baseline-aa' ? 'baseline' : sample.arm];
    const childArgs = [...(kind === 'heap' ? ['--expose-gc'] : []), fileURLToPath(import.meta.url), 'child', packetPath, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, childArgs, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
    writeFileSync(join(out, `${index}.stdout`), child.stdout ?? '', { flag: 'wx' });
    writeFileSync(join(out, `${index}.stderr`), child.stderr ?? '', { flag: 'wx' });
    save(join(out, `${index}.invocation.json`), { args: childArgs, status: child.status, signal: child.signal, error: String(child.error ?? '') });
    assert.equal(child.status, 0, `Child ${index}: ${child.stderr}`);
    results.push(JSON.parse(child.stdout));
    console.log(index, sample.carrier, sample.profile, sample.arm, 'passed');
  }
  save(join(out, 'results.json'), results);
} else if (command === 'child') {
  const [packetArg, sampleArg] = args, packet = read(packetArg), sample = JSON.parse(sampleArg);
  verify(packet.bindings);
  const result = { sample, stages: {}, heaps: {}, host: { node: process.version, cpu: cpus()[0]?.model, load: loadavg(), free: freemem() } };
  const timed = (name, fn) => {
    if (sample.kind === 'heap') return fn();
    const start = process.hrtime.bigint(), cpu = process.cpuUsage();
    const value = fn(); const used = process.cpuUsage(cpu);
    result.stages[name] = { ns: Number(process.hrtime.bigint() - start), cpuUs: used.user + used.system }; return value;
  };
  const checkpoint = async name => {
    if (sample.kind !== 'heap') return;
    for (let i = 0; i < 4; i++) { await new Promise(r => setImmediate(r)); global.gc(); }
    result.heaps[name] = process.memoryUsage().heapUsed;
  };
  const api = await import(pathToFileURL(packet.bundles[sample.carrier]).href);
  await checkpoint('moduleReady');
  const profile = sample.profile;
  let trees = [], seeds, held, snapshots, links = [], sent = [], weak;
  let inspector;
  if (sample.kind === 'profile') { inspector = new Session(); inspector.connect(); await inspector.post('Profiler.enable'); await inspector.post('Profiler.setSamplingInterval', { interval: 100 }); await inspector.post('Profiler.start'); }
  if (profile === 'ordinary') {
    seeds = timed('seed', () => Array.from({ length: 64 }, (_, tree) => Object.fromEntries(Array.from({ length: 128 }, (_, f) => ['f' + f, tree + f]))));
    trees = timed('factory', () => seeds.map(seed => api.signalTree(seed)));
    weak = new WeakRef(trees[0]);
    await checkpoint('constructed');
    snapshots = timed('firstRead', () => trees.map(t => t.$()));
    assert.deepEqual(snapshots, seeds, 'ordinary-values');
    held = trees.map(t => sample.carrier === 'angular' ? t.$.f0.set : t.$.f0);
    timed('writes', () => { for (let n = 0; n < 64; n++) for (let i = 0; i < trees.length; i++) { held[i](n + 100); assert.equal(trees[i].$.f0(), n + 100, 'write-value'); } });
    await checkpoint('used');
    timed('lateLinks', () => { links = trees.map((t,i) => api.link(t.$.f0, { set: v => { sent[i] = v; } })); });
    for (let i = 0; i < trees.length; i++) held[i](200 + i);
    await Promise.all(links.map(l => l.settled()));
    assert.deepEqual(sent, trees.map((_,i) => 200+i), 'late-delivery');
    for (const l of links) l.dispose();
    for (let i = 0; i < trees.length; i++) held[i](300 + i);
    assert.deepEqual(sent, trees.map((_,i) => 200+i), 'released-delivery');
    assert.deepEqual(snapshots, seeds, 'held-snapshot');
  } else {
    const size = Number(profile.split('-')[1]);
    seeds = timed('seed', () => Array.from({ length: size }, (_, id) => ({ id, title: `Inspect pump ${id}`, status: 'open', priority: id % 5, zone: `zone-${id % 20}`, nested: { revision: 0 } })));
    trees = timed('factory', () => [api.signalTree({ rows: api.entityMap({ selectId: r => r.id }), query: '' }, profile.startsWith('transactions') ? { enhancers: [api.transactions()] } : undefined)]);
    weak = new WeakRef(trees[0]);
    await checkpoint('constructed');
    const rows = trees[0].$.rows;
    timed('population', () => rows.setAll(seeds));
    await checkpoint('populated');
    snapshots = timed('firstRead', () => rows.all());
    assert.deepEqual(snapshots, seeds, 'population-values');
    assert.deepEqual(rows.ids(), seeds.map(r => r.id), 'population-order');
    assert.equal(rows.count(), size, 'population-count');
    held = timed('firstDemand', () => Array.from({ length: 100 }, (_, id) => rows.byIdOrFail(id)));
    assert.deepEqual(held.map(n => n()), seeds.slice(0, 100), 'row-demand');
    await checkpoint('demanded');
    timed('writes', () => { for (let n = 0; n < 10; n++) for (let id = 0; id < 100; id++) { rows.updateOne(id, { priority: 100+n }); assert.equal(held[id]().priority, 100+n, 'write-value'); } });
    assert.equal(snapshots[0].priority, 0, 'held-snapshot');
    timed('replace', () => rows.setAll(seeds.slice().reverse()));
    assert.deepEqual(rows.ids(), seeds.map(r => r.id).reverse(), 'replacement-order');
    assert.deepEqual(rows.all(), seeds.slice().reverse(), 'replacement-values');
    rows.removeOne(0); rows.addOne({ ...seeds[0], priority: 999 });
    assert.equal(held[0](), undefined, 'stale-lifetime');
    assert.equal(rows.byIdOrFail(0)().priority, 999, 'replacement-lifetime');
    assert.equal(rows.ids().at(-1), 0, 'replacement-append');
    await checkpoint('used');
  }
  if (inspector) { const { profile: data } = await inspector.post('Profiler.stop'); result.profile = data; inspector.disconnect(); }
  await checkpoint('active');
  timed('destroy', () => { for (const t of trees) t.destroy(); });
  trees = []; seeds = held = snapshots = undefined; links = []; sent = [];
  await checkpoint('released');
  if (sample.kind === 'heap') assert.equal(weak.deref(), undefined, 'tree-release');
  result.passed = true;
  verify(packet.bindings);
  console.log(JSON.stringify(result));
} else throw new Error('Expected prepare, run or child');
