#!/usr/bin/env node
// Neutral production-kernel screen. Each child keeps one populated store alive
// through every checkpoint; no phase p95s are added into a synthetic lifetime.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { loadavg, totalmem, freemem, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

const runner = fileURLToPath(import.meta.url);
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function manifest(root) {
  const files = {};
  const walk = (base, relative = '') => {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const child = join(base, entry.name);
      const name = join(relative, entry.name);
      if (entry.isDirectory()) walk(child, name);
      else if (entry.isFile()) files[name] = digest(child);
    }
  };
  walk(root);
  return files;
}

async function child() {
  const [, , , artifact, profile, rowsText] = process.argv;
  const count = Number(rowsText);
  const { signalTree, entityMap } = await import(pathToFileURL(resolve(artifact)));
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const memory = () => {
    for (let i = 0; i < 3; i++) global.gc();
    return process.memoryUsage().heapUsed;
  };
  const importedHeap = memory();
  const input = Array.from({ length: count }, (_, id) => ({
    id, value: 0, active: false, title: `Job ${id}`, owner: id % 8, status: 'open',
  }));
  const createdAt = performance.now();
  const createdCpu = process.cpuUsage();
  let tree = signalTree({ rows: entityMap() });
  tree.$.rows.setAll(input.map((row) => ({ ...row })));
  const setup = { wallMs: performance.now() - createdAt, cpu: process.cpuUsage(createdCpu) };
  const populatedHeap = memory();
  const stages = [];
  let previous = 0;
  let expectedActive = 0;
  const expected = input.map((row) => ({ ...row }));
  let totalWall = setup.wallMs;
  let totalCpu = setup.cpu.user + setup.cpu.system;
  for (const end of [100, 1000, 5000]) {
    const start = performance.now();
    const cpu = process.cpuUsage();
    for (let iteration = previous; iteration < end; iteration++) {
      const id = iteration % count;
      const active = !expected[id].active;
      expected[id] = { ...expected[id], value: iteration + 1, active };
      expectedActive += active ? 1 : -1;
      if (!(process.env['PROJECTION_LAB_PLANT_SKIP_WRITE'] === '1' && iteration === 0)) {
        tree.$.rows.updateOne(id, { value: iteration + 1, active });
      }
      if (profile === 'point') {
        assert.equal(tree.$.rows.byId(id)().value, iteration + 1);
      } else {
        if (profile === 'projection-and-ids') {
          assert.equal(tree.$.rows.ids()[id], id);
        }
        const view = tree.$.rows.all();
        assert.equal(view.length, count);
        assert.equal(view[id].value, iteration + 1);
        if (profile === 'inventory') {
          const matching = view.filter((row) => row.active);
          assert.equal(matching.length, expectedActive);
        }
      }
    }
    const phaseCpu = process.cpuUsage(cpu);
    const wallMs = performance.now() - start;
    totalWall += wallMs;
    totalCpu += phaseCpu.user + phaseCpu.system;
    // Exhaustive state and stable snapshot checks are outside phase timing.
    assert.deepEqual(tree.$.rows.all(), expected);
    const held = tree.$.rows.all();
    assert.equal(tree.$.rows.all(), held);
    stages.push({ edits: end, wallMs, cpu: phaseCpu, cumulativeWallMs: totalWall,
      cumulativeCpuUs: totalCpu, heap: memory() });
    previous = end;
  }
  tree.destroy();
  tree = undefined;
  await new Promise((resolve) => setImmediate(resolve));
  const destroyedHeap = memory();
  process.stdout.write(`${JSON.stringify({ passed: true, pid: process.pid, profile, count,
    artifact: digest(artifact), node: process.version, hostLoad: loadavg(), setup,
    importedHeap, populatedHeap, stages, destroyedHeap })}\n`);
}

async function compare() {
  const [, , , frozenPath, variantPath, outPath] = process.argv;
  assert(frozenPath && variantPath && outPath,
    'compare FROZEN_PACKAGE_ROOT VARIANT_PACKAGE_ROOT NEW_OUTPUT_DIRECTORY');
  const out = resolve(outPath);
  mkdirSync(out, { recursive: false });
  writeFileSync(join(out, 'compare.mjs'), readFileSync(runner));
  writeFileSync(join(out, 'PROTOCOL.md'), readFileSync(join(dirname(runner), 'PROTOCOL.md')));
  const roots = { frozen: resolve(frozenPath), variant: resolve(variantPath) };
  const sourceRoot = execFileSync('git', ['rev-parse', '--show-toplevel'],
    { cwd: dirname(runner), encoding: 'utf8' }).trim();
  const bindings = { runner: digest(runner), roots: {}, artifacts: {} };
  for (const [arm, root] of Object.entries(roots)) {
    bindings.roots[arm] = { path: root, files: manifest(root) };
    const entry = join(out, `${arm}-entry.mjs`);
    writeFileSync(entry, `export { signalTree, entityMap } from ${JSON.stringify(join(root, 'dist/index.js'))};\n`);
    const outfile = join(out, `${arm}.mjs`);
    const result = await build({ entryPoints: [entry], outfile, bundle: true,
      format: 'esm', platform: 'node', target: 'node24', minify: true,
      define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
      metafile: true, write: true });
    bindings.artifacts[arm] = { path: outfile, sha256: digest(outfile), bytes: readFileSync(outfile).length };
    write(join(out, `${arm}-metafile.json`), result.metafile);
  }
  write(join(out, 'bindings.json'), bindings);
  write(join(out, 'environment.json'), { node: process.version, executable: process.execPath,
    cpus: cpus(), load: loadavg(), totalmem: totalmem(), freemem: freemem(),
    source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
    sourceDiff: execFileSync('git', ['diff', 'HEAD', '--', 'packages/kernel'], { cwd: sourceRoot, encoding: 'utf8' }) });
  for (const [arm, artifact] of Object.entries(bindings.artifacts)) {
    const fault = spawnSync(process.execPath, ['--expose-gc', runner, 'child', artifact.path, 'projection', '16'],
      { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', PROJECTION_LAB_PLANT_SKIP_WRITE: '1' }, timeout: 60000 });
    write(join(out, `${arm}-planted-skip-write.json`), { status: fault.status, stdout: fault.stdout, stderr: fault.stderr });
    assert.equal(fault.status, 1, `${arm} skipped-write control did not fail`);
    assert.match(fault.stderr, /AssertionError/);
    assert.match(fault.stderr, /0 !== 1/);
  }
  const schedule = [];
  for (const count of [1000, 10000]) {
    for (const profile of ['projection', 'inventory', 'point', 'projection-and-ids']) {
      for (let pair = 0; pair < 7; pair++) {
        const arms = pair < 2 ? ['frozen', 'frozen'] : pair % 2 ? ['variant', 'frozen'] : ['frozen', 'variant'];
        for (const [position, arm] of arms.entries()) schedule.push({
          id: schedule.length, count, profile, pair, position, control: pair < 2, arm,
        });
      }
    }
  }
  write(join(out, 'schedule.json'), schedule);
  const results = [];
  for (const item of schedule) {
    const artifact = bindings.artifacts[item.arm];
    assert.equal(digest(artifact.path), artifact.sha256);
    const started = new Date().toISOString();
    const result = spawnSync(process.execPath, ['--expose-gc', runner, 'child', artifact.path, item.profile, String(item.count)],
      { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', PROJECTION_LAB_PLANT_SKIP_WRITE: '0' }, timeout: 60000 });
    const receipt = { ...item, started, hostLoad: loadavg(), status: result.status,
      signal: result.signal, stdout: result.stdout, stderr: result.stderr };
    write(join(out, `child-${String(item.id).padStart(3, '0')}.json`), receipt);
    assert.equal(result.status, 0, `child ${item.id}: ${result.stderr}`);
    const value = JSON.parse(result.stdout);
    assert.equal(value.passed, true);
    results.push({ ...item, ...value });
    process.stdout.write(`${item.id + 1}/${schedule.length} ${item.arm} ${item.profile} ${item.count}\n`);
  }
  assert.equal(new Set(results.map((result) => result.pid)).size, schedule.length);
  for (const [arm, artifact] of Object.entries(bindings.artifacts)) {
    assert.equal(digest(artifact.path), artifact.sha256);
    assert.deepEqual(manifest(roots[arm]), bindings.roots[arm].files);
  }
  write(join(out, 'results.json'), results);
}

if (process.argv[2] === 'child') await child();
else if (process.argv[2] === 'compare') await compare();
else throw new Error('Use child or compare');
