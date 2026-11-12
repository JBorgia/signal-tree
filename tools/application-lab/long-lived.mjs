#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [mode, packetArg, outArg, sampleArg, bundleArg] = process.argv.slice(2);
assert.ok(
  ['pilot', 'control', 'compare', 'child'].includes(mode) && packetArg && outArg
);
const packet = resolve(packetArg),
  out = resolve(outArg);
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(
  new URL('./long-lived-protocol.md', import.meta.url)
);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const planPath = join(packet, 'plan.json'),
  plan = read(planPath);
const bindings = {
  ...plan.inputs,
  [planPath]: sha(planPath),
  [runner]: sha(runner),
  [protocol]: sha(protocol),
};
// Bind executable package payloads that Node actually resolves through the frozen
// toolchain. Existing plan hashes remain authoritative and cannot be replaced.
function bindTree(path) {
  for (const ent of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, ent.name);
    if (ent.isDirectory()) bindTree(p);
    else if (/\.(?:mjs|cjs|js|json)$/.test(ent.name)) {
      const digest = sha(p);
      if (bindings[p])
        assert.equal(digest, bindings[p], `Frozen binding drift: ${p}`);
      else bindings[p] = digest;
    }
  }
}
for (const name of [
  '@angular/core',
  '@angular/compiler',
  '@ngrx/signals',
  'rxjs',
  'tslib',
])
  bindTree(realpathSync(join(plan.toolchainDirectory, 'node_modules', name)));
const verify = () => {
  for (const [p, digest] of Object.entries(bindings))
    assert.equal(sha(p), digest, `Input drift: ${p}`);
};
if (bundleArg) {
  const receiptPath = resolve(bundleArg),
    receipt = read(receiptPath);
  bindings[receiptPath] = sha(receiptPath);
  for (const [p, digest] of Object.entries(receipt.bindings)) {
    if (bindings[p]) assert.equal(bindings[p], digest);
    bindings[p] = digest;
  }
}
verify();
const limits =
  'Angular-native synchronous Node state work including common per-operation assertions; no rendering, event latency, full coordination equivalence or per-feature memory attribution. Five serial fresh processes; no discarded warm-up; shared host. Memory includes libraries, fixture oracle and held readers.';

if (mode !== 'child') {
  assert.ok(!existsSync(out), 'Preserve earlier attempts');
  mkdirSync(out, { recursive: true });
  // Match production consumer import selection. Importing an installed ESM
  // barrel directly evaluates unused Link registration and is a different arm.
  const toolRequire = createRequire(
    join(plan.toolchainDirectory, 'package.json')
  );
  const esbuild = await import(
    pathToFileURL(toolRequire.resolve('esbuild')).href
  );
  const bundleBindings = {},
    bundles = {};
  const corePath = toolRequire.resolve('@angular/core');
  for (const arm of ['ngrx', 'v15', 'v16']) {
    const entryPath = join(out, `${arm}-entry.mjs`);
    const bundlePath = join(out, `${arm}-bundle.mjs`);
    const metaPath = join(out, `${arm}-metafile.json`);
    const entry =
      arm === 'ngrx'
        ? `export { signalStore, patchState } from ${JSON.stringify(
            toolRequire.resolve('@ngrx/signals')
          )};\nexport { withEntities, setAllEntities, updateEntity, removeEntity, addEntity, removeAllEntities } from ${JSON.stringify(
            toolRequire.resolve('@ngrx/signals/entities')
          )};\n`
        : `export { signalTree, entityMap } from ${JSON.stringify(
            join(packet, arm, 'node_modules/@signal-tree/angular/dist/index.js')
          )};\n`;
    writeFileSync(entryPath, entry, { flag: 'wx' });
    const built = await esbuild.build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      platform: 'node',
      format: 'esm',
      bundle: true,
      treeShaking: true,
      minify: true,
      metafile: true,
      define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'shared-angular-runtime',
          setup(build) {
            build.onResolve({ filter: /^@angular\/core$/ }, () => ({
              path: corePath,
              external: true,
            }));
          },
        },
      ],
    });
    if (arm === 'v16') {
      for (const output of Object.values(built.metafile.outputs))
        for (const [path, contribution] of Object.entries(output.inputs ?? {}))
          if (
            /\/lib\/link\.js$|\/experimental-publication\/entity\.js$/.test(
              path
            )
          )
            assert.equal(
              contribution.bytesInOutput,
              0,
              'Ordinary fixture must omit native Link implementation'
            );
    }
    write(metaPath, built.metafile);
    for (const p of [entryPath, bundlePath, metaPath])
      bundleBindings[p] = sha(p);
    // Bind every source selected by the actual bundler, not just exports.
    for (const p of Object.keys(built.metafile.inputs))
      bundleBindings[resolve(p)] = sha(resolve(p));
    bundles[arm] = bundlePath;
  }
  const bundleReceipt = join(out, 'bundles.json');
  write(bundleReceipt, {
    esbuild: esbuild.version,
    bundles,
    bindings: bundleBindings,
    externalAngular: corePath,
    limits:
      'Production tree-shaken state fixture; Angular shared as an external installed runtime. No app rendering or bundle-size comparison claim.',
  });
  bindings[bundleReceipt] = sha(bundleReceipt);
  for (const [p, digest] of Object.entries(bundleBindings)) {
    if (bindings[p]) assert.equal(bindings[p], digest);
    bindings[p] = digest;
  }
  const schedule = [];
  if (mode === 'control')
    schedule.push({
      arm: 'v15',
      rows: 1000,
      fields: 8,
      round: 0,
      repeat: 0,
      fault: 'skip-write',
    });
  else if (mode === 'pilot') {
    for (const arm of ['native', 'ngrx', 'v15', 'v16'])
      schedule.push({ arm, rows: 10000, fields: 32, round: 0, repeat: 0 });
  } else {
    for (const rows of [1000, 10000])
      for (const fields of [8, 32])
        for (let round = 0; round < 5; round++) {
          const arms = ['native', 'ngrx', 'v15', 'v16'];
          const rotated = [
            ...arms.slice(round % 4),
            ...arms.slice(0, round % 4),
          ];
          for (const arm of rotated)
            schedule.push({ arm, rows, fields, round, repeat: 0 });
          schedule.push({ arm: 'v15', rows, fields, round, repeat: 1 });
        }
  }
  write(join(out, 'schedule.json'), {
    createdUTC: new Date().toISOString(),
    command: [process.execPath, runner, ...process.argv.slice(2)],
    mode,
    bindings,
    artifacts: plan.artifacts,
    limits,
    schedule,
  });
  const results = [];
  for (let index = 0; index < schedule.length; index++) {
    const path = join(out, `child-${String(index).padStart(3, '0')}.json`);
    const args = [
      '--expose-gc',
      runner,
      'child',
      packet,
      path,
      JSON.stringify(schedule[index]),
      bundleReceipt,
    ];
    const child = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 240000,
    });
    writeFileSync(path + '.log', (child.stdout ?? '') + (child.stderr ?? ''), {
      flag: 'wx',
    });
    if (existsSync(path)) results.push(read(path));
    write(join(out, `invocation-${index}.json`), {
      command: [process.execPath, ...args],
      exit: child.status,
      signal: child.signal,
      error: child.error ? String(child.error) : null,
      resultPath: path,
      resultSha256: existsSync(path) ? sha(path) : null,
      logSha256: sha(path + '.log'),
    });
    const last = results.at(-1);
    if (mode === 'control') {
      assert.equal(child.status, 1, 'Planted skip-write must fail');
      assert.equal(last?.failedStage, 'sparse-100');
      assert.match(last?.error ?? '', /write receipt/);
    } else if (child.status !== 0 || !last?.passed) break;
    console.log(
      index,
      schedule[index].arm,
      schedule[index].rows,
      schedule[index].fields,
      mode === 'control' ? 'fault detected' : 'passed'
    );
  }
  verify();
  const passed =
    results.length === schedule.length &&
    (mode === 'control' || results.every((r) => r.passed));
  write(join(out, 'results.json'), {
    passed,
    mode,
    scheduleSha256: sha(join(out, 'schedule.json')),
    limits,
    results,
  });
  if (!passed) process.exitCode = 1;
} else {
  const sample = JSON.parse(sampleArg);
  assert.ok(['native', 'ngrx', 'v15', 'v16'].includes(sample.arm));
  assert.ok(
    [1000, 10000].includes(sample.rows) && [8, 32].includes(sample.fields)
  );
  const require = createRequire(join(plan.toolchainDirectory, 'package.json'));
  const load = (name) => import(pathToFileURL(require.resolve(name)).href);
  await load('@angular/compiler');
  const angular = await load('@angular/core');
  angular.enableProdMode();
  const { computed, signal } = angular;
  let st, ngrx, entities, Store;
  const bundles = read(resolve(bundleArg)).bundles;
  if (sample.arm.startsWith('v')) {
    const directory = join(
      packet,
      sample.arm,
      'node_modules/@signal-tree/angular'
    );
    const manifest = read(join(directory, 'package.json'));
    assert.ok(manifest.version.startsWith(sample.arm.slice(1) + '.'));
    st = await import(pathToFileURL(bundles[sample.arm]).href);
  } else if (sample.arm === 'ngrx') {
    ngrx = await import(pathToFileURL(bundles.ngrx).href);
    entities = ngrx;
    Store = ngrx.signalStore(entities.withEntities());
  }
  const numericFields = Array.from(
    { length: sample.fields },
    (_, k) => `f${k}`
  );
  const makeRow = (i, generation = 0) =>
    Object.fromEntries([
      ['id', `R-${i}`],
      ...numericFields.map((field, k) => [
        field,
        i * 100 + k + generation * 10000000,
      ]),
    ]);
  let oracle = new Map(
    Array.from({ length: sample.rows }, (_, i) => {
      const row = makeRow(i);
      return [row.id, row];
    })
  );
  let seed = [...oracle.values()].map((row) => ({ ...row }));
  let adapter, held, derived, late, aggregate;
  let activeStage;
  const stages = [],
    heapBytes = {};
  let cumulativeMs = 0;
  const timed = (name, operations, work) => {
    activeStage = name;
    const cpu = process.cpuUsage(),
      start = process.hrtime.bigint();
    const value = work();
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    cumulativeMs += ms;
    stages.push({
      name,
      operations,
      elapsedMs: ms,
      cumulativeMs,
      cpuMicroseconds: process.cpuUsage(cpu),
    });
    return value;
  };
  const gcHeap = async () => {
    assert.equal(typeof global.gc, 'function');
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
    createdUTC: new Date().toISOString(),
    host: {
      cpu: os.cpus()[0]?.model,
      platform: os.platform(),
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    stages,
    heapBytes,
    passed: false,
  };
  const wrap = (readField, writeField) => ({
    read: readField,
    write: writeField,
  });
  function createAdapter() {
    if (st) {
      const tree = st.signalTree({
        rows: st.entityMap({ selectId: (row) => row.id }),
      });
      return {
        initialize: (rows) =>
          tree.$.rows.setAll(rows.map((row) => ({ ...row }))),
        all: () => tree.$.rows.all(),
        row: (id) => tree.$.rows.byId(id)?.(),
        handle(id, field) {
          const row = tree.$.rows.byIdOrFail(id),
            cell = row[field];
          return wrap(
            () => (row() ? cell() : undefined),
            (value) => {
              if (row()) cell.set(value);
            }
          );
        },
        replace(id, row) {
          tree.$.rows.removeOne(id);
          tree.$.rows.addOne({ ...row });
        },
        destroy: () => tree.destroy(),
      };
    }
    if (ngrx) {
      const injector = angular.createEnvironmentInjector(
        [],
        angular.Injector.NULL
      );
      const store = angular.runInInjectionContext(injector, () => new Store());
      const tokens = new Map();
      return {
        initialize: (rows) =>
          ngrx.patchState(
            store,
            entities.setAllEntities(rows.map((row) => ({ ...row })))
          ),
        all: () => store.entities(),
        row: (id) => store.entityMap()[id],
        handle(id, field) {
          let token = tokens.get(id);
          if (!token) {
            token = {};
            tokens.set(id, token);
          }
          const cell = computed(() =>
            tokens.get(id) === token
              ? store.entityMap()[id]?.[field]
              : undefined
          );
          return wrap(cell, (value) => {
            if (tokens.get(id) === token)
              ngrx.patchState(
                store,
                entities.updateEntity({ id, changes: { [field]: value } })
              );
          });
        },
        replace(id, row) {
          tokens.delete(id);
          ngrx.patchState(
            store,
            entities.removeEntity(id),
            entities.addEntity({ ...row })
          );
        },
        destroy() {
          tokens.clear();
          ngrx.patchState(store, entities.removeAllEntities());
          store.entities();
          injector.destroy();
        },
      };
    }
    const records = new Map(),
      ids = signal([]);
    const all = computed(() => ids().map((id) => records.get(id)()));
    return {
      initialize(rows) {
        for (const row of rows) records.set(row.id, signal({ ...row }));
        ids.set([...records.keys()]);
      },
      all,
      row: (id) => records.get(id)?.(),
      handle(id, field) {
        const carrier = records.get(id);
        const cell = computed(() => {
          ids();
          return records.get(id) === carrier ? carrier()[field] : undefined;
        });
        return wrap(cell, (value) => {
          if (records.get(id) === carrier)
            carrier.update((row) => ({ ...row, [field]: value }));
        });
      },
      replace(id, row) {
        records.delete(id);
        records.set(id, signal({ ...row }));
        ids.set([...records.keys()]);
      },
      destroy() {
        records.clear();
        ids.set([]);
        all();
      },
    };
  }
  const assertAll = () => {
    const actual = adapter.all();
    assert.equal(actual.length, oracle.size, 'row count');
    for (const row of actual)
      assert.deepEqual(row, oracle.get(row.id), `whole row ${row.id}`);
  };
  const ids = Array.from(
    { length: 200 },
    (_, i) => `R-${Math.floor((i * sample.rows) / 200)}`
  );
  try {
    heapBytes.fixtureBeforeStore = await gcHeap();
    adapter = timed('empty-store', 1, createAdapter);
    timed('population', sample.rows, () => adapter.initialize(seed));
    timed('first-collection-read', sample.rows, () =>
      assert.equal(adapter.all().length, sample.rows)
    );
    assertAll();
    seed = undefined;
    heapBytes.populated = await gcHeap();
    held = timed('acquire-sparse', ids.length, () =>
      ids.map((id) => adapter.handle(id, 'f0'))
    );
    derived = held.map((h) => computed(() => h.read() * 2));
    for (let i = 0; i < held.length; i++)
      assert.equal(derived[i](), oracle.get(ids[i]).f0 * 2);
    heapBytes.sparseReaders = await gcHeap();
    let count = 0;
    for (const end of [100, 1000, 5000]) {
      const ops = [];
      for (let i = count; i < end; i++) {
        const index = i % ids.length,
          id = ids[index],
          value = 100000000 + i;
        oracle.get(id).f0 = value;
        ops.push({ index, value });
      }
      timed(`sparse-${end}`, end - count, () => {
        for (const [n, op] of ops.entries()) {
          if (!(sample.fault === 'skip-write' && count === 0 && n === 0))
            held[op.index].write(op.value);
          assert.equal(held[op.index].read(), op.value, 'write receipt');
          assert.equal(
            derived[op.index](),
            op.value * 2,
            'retained computed receipt'
          );
        }
      });
      count = end;
      assertAll();
      heapBytes[`sparse${end}`] = await gcHeap();
    }
    // Filtering consumes the same complete collection on every mutation. Prepare
    // oracle outputs before timing to avoid charging a second full scan to arms.
    const aggregateOps = [];
    for (let i = 0; i < 200; i++) {
      const index = i % ids.length,
        value = 200000000 + i;
      oracle.get(ids[index]).f0 = value;
      const selected = [...oracle.values()].filter((row) => row.f0 % 2 === 0);
      aggregateOps.push({
        index,
        value,
        count: selected.length,
        sum: selected.reduce((sum, row) => sum + row.f0, 0),
      });
    }
    aggregate = computed(() => {
      const rows = adapter.all().filter((row) => row.f0 % 2 === 0);
      return {
        count: rows.length,
        sum: rows.reduce((sum, row) => sum + row.f0, 0),
      };
    });
    timed('aggregate-200', 200, () => {
      for (const op of aggregateOps) {
        held[op.index].write(op.value);
        const observed = aggregate();
        assert.equal(observed.count, op.count);
        assert.equal(observed.sum, op.sum);
      }
    });
    assertAll();
    heapBytes.afterAggregate = await gcHeap();
    timed('retire-replace-128', 128, () => {
      for (let i = 0; i < 128; i++) {
        const id = ids[i],
          replacement = makeRow(Number(id.slice(2)), 1);
        adapter.replace(id, replacement);
        oracle.set(id, replacement);
        assert.equal(held[i].read(), undefined, 'retired reader must retire');
        held[i].write(-999);
        assert.deepEqual(
          adapter.row(id),
          replacement,
          'retired editor must not mutate replacement'
        );
        held[i] = adapter.handle(id, 'f0');
        derived[i] = computed(() => held[i].read() * 2);
        assert.equal(derived[i](), replacement.f0 * 2);
      }
    });
    assertAll();
    heapBytes.afterRetirement = await gcHeap();
    late = timed(
      'acquire-wide-200-rows',
      ids.length * numericFields.length,
      () =>
        ids.map((id) => numericFields.map((field) => adapter.handle(id, field)))
    );
    for (let i = 0; i < ids.length; i++)
      for (let f = 0; f < numericFields.length; f++)
        assert.equal(late[i][f].read(), oracle.get(ids[i])[numericFields[f]]);
    heapBytes.wideReaders = await gcHeap();
    const wideOps = [];
    for (let i = 0; i < 1000; i++) {
      const index = i % ids.length,
        fieldIndex = Math.floor(i / ids.length) % numericFields.length,
        value = 300000000 + i;
      oracle.get(ids[index])[numericFields[fieldIndex]] = value;
      wideOps.push({ index, fieldIndex, value });
    }
    timed('wide-edits-1000', 1000, () => {
      for (const op of wideOps) {
        const h = late[op.index][op.fieldIndex];
        h.write(op.value);
        assert.equal(h.read(), op.value, 'late field receipt');
      }
    });
    assertAll();
    heapBytes.afterWideEdits = await gcHeap();
    timed('destroy', 1, () => adapter.destroy());
    adapter = undefined;
    held = undefined;
    derived = undefined;
    late = undefined;
    aggregate = undefined;
    oracle = undefined;
    // Computed dependency links can retain producers: drop the query itself,
    // not merely its array-free cached summary, before teardown collection.
    heapBytes.afterDestroy = await gcHeap();
    verify();
    result.passed = true;
  } catch (error) {
    result.failedStage = activeStage;
    result.error = String(error.stack);
  } finally {
    adapter?.destroy();
    write(out, result);
  }
  if (!result.passed) process.exitCode = 1;
}
