#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, packetArg, cohortArg, outArg, sampleArg] = process.argv.slice(2);
assert.ok(
  ['compare', 'child'].includes(mode) && packetArg && cohortArg && outArg
);
const packet = resolve(packetArg),
  cohort = resolve(cohortArg),
  out = resolve(outArg),
  runner = fileURLToPath(import.meta.url),
  protocol = fileURLToPath(
    new URL('./field-demand-cleanup-protocol.md', import.meta.url)
  );
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const write = (p, v) =>
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const original = read(join(cohort, 'schedule.json'));
const bindings = {
  ...original.bindings,
  [runner]: sha(runner),
  [protocol]: sha(protocol),
};
const verify = () => {
  for (const [p, d] of Object.entries(bindings))
    assert.equal(sha(p), d, `Input ${p}`);
};
verify();
if (mode === 'compare') {
  assert.ok(!existsSync(out));
  mkdirSync(out, { recursive: true });
  const schedule = [];
  for (const rows of [1000, 10000])
    for (let round = 0; round < 5; round++)
      for (const arm of round % 2 ? ['v16', 'v15'] : ['v15', 'v16'])
        schedule.push({ arm, rows, round, pinned: false });
  for (const arm of ['v15', 'v16'])
    schedule.push({ arm, rows: 10000, round: 0, pinned: true });
  write(join(out, 'schedule.json'), {
    createdUTC: new Date().toISOString(),
    command: [process.execPath, ...process.argv.slice(1)],
    bindings,
    schedule,
  });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const path = join(out, `child-${String(index).padStart(3, '0')}.json`),
      args = [
        '--expose-gc',
        runner,
        'child',
        packet,
        cohort,
        path,
        JSON.stringify(sample),
      ];
    const child = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 120000,
    });
    writeFileSync(path + '.log', (child.stdout ?? '') + (child.stderr ?? ''), {
      flag: 'wx',
    });
    write(join(out, `invocation-${index}.json`), {
      command: [process.execPath, ...args],
      exit: child.status,
      signal: child.signal,
      resultPath: path,
      resultSha256: existsSync(path) ? sha(path) : null,
      logSha256: sha(path + '.log'),
    });
    if (existsSync(path)) results.push(read(path));
    if (child.status !== 0 || !results.at(-1)?.passed) break;
    console.log(
      index,
      sample.arm,
      sample.rows,
      sample.pinned ? 'pin detected and released' : 'collected'
    );
  }
  verify();
  const passed =
    results.length === schedule.length && results.every((r) => r.passed);
  // Independently bind each stored child back to its invocation and schedule.
  for (const [index, child] of results.entries()) {
    const receipt = read(join(out, `invocation-${index}.json`));
    assert.equal(receipt.resultSha256, sha(receipt.resultPath));
    assert.equal(receipt.logSha256, sha(receipt.resultPath + '.log'));
    assert.deepEqual(read(receipt.resultPath), child);
    for (const [k, v] of Object.entries(schedule[index]))
      assert.equal(child[k], v);
  }
  write(join(out, 'results.json'), {
    passed,
    scheduleSha256: sha(join(out, 'schedule.json')),
    results,
    limits:
      'Finite sampled-object cleanup after async phase return; no unlimited boundedness or general no-leak claim. Separate from original demand-phase heap cohort.',
  });
  if (!passed) process.exitCode = 1;
} else {
  const sample = JSON.parse(sampleArg);
  assert.ok(
    ['v15', 'v16'].includes(sample.arm) && [1000, 10000].includes(sample.rows)
  );
  const plan = read(join(packet, 'plan.json')),
    bundles = read(join(cohort, 'bundles.json')).bundles,
    require = createRequire(join(plan.toolchainDirectory, 'package.json'));
  await import(pathToFileURL(require.resolve('@angular/compiler')).href);
  const angular = await import(
    pathToFileURL(require.resolve('@angular/core')).href
  );
  angular.enableProdMode();
  const api = await import(pathToFileURL(bundles[sample.arm]).href);
  const pin = { field: undefined };
  const result = {
    ...sample,
    pid: process.pid,
    node: process.version,
    host: {
      cpu: os.cpus()[0]?.model,
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    passed: false,
  };
  async function exercise() {
    const tree = api.signalTree({
      rows: api.entityMap({ selectId: (row) => row.id }),
    });
    try {
      tree.$.rows.setAll(
        Array.from({ length: sample.rows }, (_, i) =>
          Object.fromEntries([
            ['id', `R-${i}`],
            ...Array.from({ length: 32 }, (_, f) => [`f${f}`, i * 100 + f]),
          ])
        )
      );
      const handles = Array.from({ length: 200 }, (_, i) =>
        tree.$.rows.byIdOrFail(`R-${Math.floor((i * sample.rows) / 200)}`)
      );
      let verified = 0;
      for (let i = 0; i < handles.length; i++)
        for (let f = 0; f < 32; f++) {
          const field = handles[i][`f${f}`];
          assert.equal(field(), Math.floor((i * sample.rows) / 200) * 100 + f);
          verified++;
        }
      const row = handles[0],
        field = row.f0,
        payload = row();
      const refs = {
        tree: new WeakRef(tree),
        row: new WeakRef(row),
        field: new WeakRef(field),
        payload: new WeakRef(payload),
      };
      if (sample.pinned) pin.field = field;
      // An actual async phase ends; neither temporary descriptors nor loop locals
      // share the frame in which later GC and weak-reference observations occur.
      await new Promise((done) => setImmediate(done));
      return { refs, verified };
    } finally {
      tree.destroy();
    }
  }
  const observe = async (refs) => {
    const passes = [];
    for (let n = 0; n < 12; n++) {
      await new Promise((done) => setImmediate(done));
      global.gc();
      const alive = Object.fromEntries(
        Object.entries(refs).map(([name, ref]) => [
          name,
          ref.deref() !== undefined,
        ])
      );
      passes.push({
        pass: n + 1,
        alive,
        heapBytes: process.memoryUsage().heapUsed,
      });
      if (n >= 2 && Object.values(alive).every((value) => !value)) break;
      if (sample.pinned && pin.field !== undefined && n >= 2) break;
    }
    return passes;
  };
  try {
    assert.equal(typeof global.gc, 'function');
    const phase = await exercise();
    assert.equal(phase.verified, 6400);
    result.verified = phase.verified;
    result.initial = await observe(phase.refs);
    if (sample.pinned) {
      assert.equal(
        result.initial.at(-1).alive.field,
        true,
        'Planted field pin must be observed'
      );
      pin.field = undefined;
      result.released = await observe(phase.refs);
    } else result.released = result.initial;
    assert.ok(
      Object.values(result.released.at(-1).alive).every((alive) => !alive),
      'All sampled objects should collect after phase and pin release'
    );
    verify();
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack);
  } finally {
    pin.field = undefined;
    write(out, result);
  }
  if (!result.passed) process.exitCode = 1;
}
