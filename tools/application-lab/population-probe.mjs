#!/usr/bin/env node
// Diagnostic only: neutral installed kernel, not Angular application timing.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seedJobs } from './model.ts';

const [mode, suppliedPacket, suppliedOut, suppliedSample] =
  process.argv.slice(2);
assert.ok(['compare', 'child'].includes(mode) && suppliedPacket && suppliedOut);
const packet = resolve(suppliedPacket);
const out = resolve(suppliedOut);
const runner = fileURLToPath(import.meta.url);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const planPath = join(packet, 'plan.json');
const plan = read(planPath);
const modelPath = fileURLToPath(new URL('./model.ts', import.meta.url));
assert.equal(
  sha(modelPath),
  plan.inputs[join(packet, 'v16', 'src/model.ts')],
  'Diagnostic seed/model must match the frozen application input'
);
const bindings = {
  ...plan.inputs,
  [planPath]: sha(planPath),
  [runner]: sha(runner),
  [modelPath]: sha(modelPath),
};
for (const [path, expected] of Object.entries(plan.inputs))
  assert.equal(
    bindings[path],
    expected,
    `Do not replace a frozen binding: ${path}`
  );
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift: ${path}`);
};
verify();

if (mode === 'compare') {
  assert.ok(!existsSync(out), 'Preserve prior attempts');
  mkdirSync(out, { recursive: true });
  const schedule = [];
  for (const rows of [1000, 10000])
    for (let round = 0; round < 5; round++)
      for (const line of round % 2 ? ['v16', 'v15'] : ['v15', 'v16'])
        for (const method of (round + (line === 'v16' ? 1 : 0)) % 2
          ? ['addMany', 'setAll']
          : ['setAll', 'addMany'])
          schedule.push({ rows, round, line, method });
  write(join(out, 'schedule.json'), {
    createdUTC: new Date().toISOString(),
    command: [process.execPath, runner, ...process.argv.slice(2)],
    bindings,
    schedule,
    limits:
      'Neutral installed kernel diagnostic; no Angular, rendering or general API equivalence claim. Five fresh Node processes per method/line/size; no discarded warm-up. Timings include row copies. Same host remains shared. This selects an application hypothesis, not an optimization winner.',
  });
  const results = [];
  for (let index = 0; index < schedule.length; index++) {
    const path = join(out, `child-${String(index).padStart(3, '0')}.json`);
    const command = [
      '--expose-gc',
      runner,
      'child',
      packet,
      path,
      JSON.stringify(schedule[index]),
    ];
    const child = spawnSync(process.execPath, command, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 120000,
    });
    writeFileSync(path + '.log', (child.stdout ?? '') + (child.stderr ?? ''), {
      flag: 'wx',
    });
    if (existsSync(path)) results.push(read(path));
    write(join(out, `invocation-${index}.json`), {
      command: [process.execPath, ...command],
      exit: child.status,
      signal: child.signal,
      error: child.error ? String(child.error) : null,
      resultPath: path,
      resultSha256: existsSync(path) ? sha(path) : null,
    });
    if (child.status !== 0 || !results.at(-1)?.passed) break;
    console.log(
      index,
      schedule[index].line,
      schedule[index].method,
      schedule[index].rows,
      'passed'
    );
  }
  verify();
  const passed =
    results.length === schedule.length && results.every((r) => r.passed);
  write(join(out, 'results.json'), {
    passed,
    scheduleSha256: sha(join(out, 'schedule.json')),
    bindings,
    results,
  });
  if (!passed) process.exitCode = 1;
} else {
  const sample = JSON.parse(suppliedSample);
  assert.ok(['v15', 'v16'].includes(sample.line));
  assert.ok(['setAll', 'addMany'].includes(sample.method));
  assert.ok([1000, 10000].includes(sample.rows));
  const directory = join(
    packet,
    sample.line,
    'node_modules/@signal-tree/kernel'
  );
  const manifest = read(join(directory, 'package.json'));
  assert.equal(manifest.name, '@signal-tree/kernel');
  const { signalTree, entityMap, leaf } = await import(
    pathToFileURL(resolve(directory, manifest.exports['.'].import)).href
  );
  const rows = seedJobs(sample.rows);
  let tree;
  let all;
  const stages = {};
  const timed = (name, work) => {
    const cpu = process.cpuUsage();
    const start = process.hrtime.bigint();
    const value = work();
    const elapsedNanoseconds = Number(process.hrtime.bigint() - start);
    stages[name] = {
      elapsedNanoseconds,
      cpuMicroseconds: process.cpuUsage(cpu),
    };
    return value;
  };
  const gcHeap = async () => {
    assert.equal(typeof global.gc, 'function');
    // WeakRef-kept objects live through the current JS job. End that job before
    // collections and between passes; no GC is included in the timed stages.
    for (let n = 0; n < 3; n++) {
      await new Promise((done) => setImmediate(done));
      global.gc();
    }
    return process.memoryUsage().heapUsed;
  };
  const result = {
    ...sample,
    pid: process.pid,
    node: process.version,
    packageVersion: manifest.version,
    bindings,
    stages,
    host: {
      cpu: os.cpus()[0]?.model,
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    heapBytes: { before: await gcHeap() },
    passed: false,
  };
  try {
    tree = timed('emptyTree', () =>
      signalTree({
        rows: entityMap({ selectId: (row) => row.id }),
        query: '',
        selected: leaf(null),
        error: leaf(null),
      })
    );
    timed('populationIncludingRowCopies', () =>
      tree.$.rows[sample.method](rows.map((row) => ({ ...row })))
    );
    all = timed('firstAllRead', () => tree.$.rows.all());
    assert.deepEqual(all, rows);
    assert.equal(tree.$.rows.count(), rows.length);
    // Do not let input mutation silently replace ownership isolation.
    rows[0].title = 'mutated caller input';
    assert.equal(tree.$.rows.byIdOrFail('J-0')().title, 'Inspect pump 0');
    result.heapBytes.populatedAfterRead = await gcHeap();
    all = undefined;
    timed('destroy', () => tree.destroy());
    tree = undefined;
    result.heapBytes.afterDestroy = await gcHeap();
    verify();
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack);
  } finally {
    tree?.destroy();
    write(out, result);
  }
  if (!result.passed) process.exitCode = 1;
}
