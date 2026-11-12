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
  ['control', 'compare', 'child'].includes(mode) &&
    packetArg &&
    cohortArg &&
    outArg
);
const packet = resolve(packetArg),
  cohort = resolve(cohortArg),
  out = resolve(outArg);
const runner = fileURLToPath(import.meta.url),
  protocol = fileURLToPath(
    new URL('./field-demand-protocol.md', import.meta.url)
  );
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const write = (p, v) =>
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const originalSchedule = read(join(cohort, 'schedule.json')),
  originalResults = read(join(cohort, 'results.json'));
assert.equal(originalResults.passed, true);
assert.equal(
  originalResults.scheduleSha256,
  sha(join(cohort, 'schedule.json'))
);
const bindings = {
  ...originalSchedule.bindings,
  [runner]: sha(runner),
  [protocol]: sha(protocol),
};
const verify = () => {
  for (const [p, digest] of Object.entries(bindings))
    assert.equal(sha(p), digest, `Input drift ${p}`);
};
verify();
const limits =
  'Whole Node heap across demand transitions on selective production bundles. Fixture oracle/code/arrays included. No timing, per-feature byte attribution, universal no-leak claim, or full semantics equivalence. Native/NgRx use application field wrappers, not NgRx deep-signal property access.';
if (mode !== 'child') {
  assert.ok(!existsSync(out));
  mkdirSync(out, { recursive: true });
  const schedule = [];
  if (mode === 'control')
    schedule.push({
      arm: 'v15',
      rows: 1000,
      fields: 8,
      round: 0,
      fault: 'wrong-read',
    });
  else
    for (const rows of [1000, 10000])
      for (const fields of [8, 32])
        for (let round = 0; round < 5; round++) {
          const arms = ['native', 'ngrx', 'v15', 'v16'];
          for (const arm of [
            ...arms.slice(round % 4),
            ...arms.slice(0, round % 4),
          ])
            schedule.push({ arm, rows, fields, round });
        }
  write(join(out, 'schedule.json'), {
    mode,
    command: [process.execPath, ...process.argv.slice(1)],
    createdUTC: new Date().toISOString(),
    bindings,
    limits,
    schedule,
  });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const path = join(out, `child-${String(index).padStart(3, '0')}.json`);
    const args = [
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
    if (mode === 'control') {
      assert.equal(child.status, 1);
      assert.match(results.at(-1)?.error ?? '', /field value/);
    } else if (child.status !== 0 || !results.at(-1)?.passed) break;
    console.log(
      index,
      sample.arm,
      sample.rows,
      sample.fields,
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
  const plan = read(join(packet, 'plan.json')),
    bundles = read(join(cohort, 'bundles.json')).bundles;
  const require = createRequire(join(plan.toolchainDirectory, 'package.json'));
  const load = (name) => import(pathToFileURL(require.resolve(name)).href);
  await load('@angular/compiler');
  const angular = await load('@angular/core');
  angular.enableProdMode();
  const api =
    sample.arm === 'native'
      ? undefined
      : await import(pathToFileURL(bundles[sample.arm]).href);
  let rows = Array.from({ length: sample.rows }, (_, i) =>
    Object.fromEntries([
      ['id', `R-${i}`],
      ...Array.from({ length: sample.fields }, (_, f) => [
        `f${f}`,
        i * 100 + f,
      ]),
    ])
  );
  const indices = Array.from({ length: 200 }, (_, i) =>
    Math.floor((i * sample.rows) / 200)
  );
  let adapter, held, first, all;
  const heapBytes = {},
    counts = {};
  let activeStage;
  const gc = async () => {
    for (let n = 0; n < 3; n++) {
      await new Promise((done) => setImmediate(done));
      global.gc();
    }
    return process.memoryUsage().heapUsed;
  };
  const checkpoint = async (name) => {
    activeStage = name;
    heapBytes[name] = await gc();
  };
  const result = {
    ...sample,
    pid: process.pid,
    node: process.version,
    host: {
      cpu: os.cpus()[0]?.model,
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    heapBytes,
    counts,
    passed: false,
  };
  const makeAdapter = () => {
    if (sample.arm.startsWith('v')) {
      const tree = api.signalTree({
        rows: api.entityMap({ selectId: (row) => row.id }),
      });
      tree.$.rows.setAll(rows.map((row) => ({ ...row })));
      return {
        hold: (id) => tree.$.rows.byIdOrFail(id),
        read: (h) => h(),
        field: (h, f) => h[f],
        readField: (f) => f(),
        destroy: () => tree.destroy(),
      };
    }
    if (sample.arm === 'ngrx') {
      const Store = api.signalStore(api.withEntities()),
        injector = angular.createEnvironmentInjector([], angular.Injector.NULL);
      const store = angular.runInInjectionContext(injector, () => new Store());
      api.patchState(
        store,
        api.setAllEntities(rows.map((row) => ({ ...row })))
      );
      const tokens = new Map();
      return {
        hold: (id) => {
          const token = {};
          tokens.set(id, token);
          return { id, token };
        },
        read: (h) =>
          tokens.get(h.id) === h.token ? store.entityMap()[h.id] : undefined,
        field: (h, f) => ({
          read: angular.computed(() =>
            tokens.get(h.id) === h.token
              ? store.entityMap()[h.id]?.[f]
              : undefined
          ),
          write: (value) => {
            if (tokens.get(h.id) === h.token)
              api.patchState(
                store,
                api.updateEntity({ id: h.id, changes: { [f]: value } })
              );
          },
        }),
        readField: (f) => f.read(),
        destroy: () => {
          tokens.clear();
          api.patchState(store, api.removeAllEntities());
          store.entities();
          injector.destroy();
        },
      };
    }
    const records = new Map(
      rows.map((row) => [row.id, angular.signal({ ...row })])
    );
    const ids = angular.signal([...records.keys()]);
    return {
      hold: (id) => records.get(id),
      read: (h) => h(),
      field: (h, f) => ({
        read: angular.computed(() => {
          ids();
          return records.get(h().id) === h ? h()[f] : undefined;
        }),
        write: (value) => {
          if (records.get(h().id) === h)
            h.update((row) => ({ ...row, [f]: value }));
        },
      }),
      readField: (f) => f.read(),
      destroy: () => {
        records.clear();
        ids.set([]);
      },
    };
  };
  try {
    assert.equal(typeof global.gc, 'function');
    await checkpoint('fixtureBeforeStore');
    adapter = makeAdapter();
    await checkpoint('populated');
    held = indices.map((i) => adapter.hold(`R-${i}`));
    if (sample.arm.startsWith('v')) {
      counts.enumerableFieldGetters = held.reduce(
        (n, h) =>
          n +
          Object.keys(h).filter(
            (k) =>
              typeof Object.getOwnPropertyDescriptor(h, k)?.get === 'function'
          ).length,
        0
      );
      assert.equal(counts.enumerableFieldGetters, 200 * (sample.fields + 1));
    }
    await checkpoint('heldRowsOnly');
    for (let i = 0; i < held.length; i++)
      assert.deepEqual(adapter.read(held[i]), rows[indices[i]]);
    await checkpoint('readRows');
    first = held.map((h) => adapter.field(h, 'f0'));
    counts.firstAcquiredFields = first.length;
    await checkpoint('acquireFirstField');
    for (let i = 0; i < first.length; i++)
      assert.equal(
        adapter.readField(first[i]),
        rows[indices[i]].f0 + (sample.fault === 'wrong-read' ? 1 : 0),
        'field value'
      );
    await checkpoint('readFirstField');
    all = held.map((h, i) =>
      Array.from({ length: sample.fields }, (_, f) =>
        f === 0 ? first[i] : adapter.field(h, `f${f}`)
      )
    );
    counts.allAcquiredFields = all.reduce((n, row) => n + row.length, 0);
    counts.uniqueAcquiredFields = new Set(all.flat()).size;
    assert.equal(counts.allAcquiredFields, 200 * sample.fields);
    assert.equal(counts.uniqueAcquiredFields, 200 * sample.fields);
    await checkpoint('acquireAllFields');
    for (let i = 0; i < all.length; i++)
      for (let f = 0; f < sample.fields; f++)
        assert.equal(
          adapter.readField(all[i][f]),
          rows[indices[i]][`f${f}`],
          'field value'
        );
    if (sample.arm.startsWith('v'))
      for (let i = 0; i < held.length; i++) {
        assert.deepEqual(
          Object.keys(held[i]),
          ['id', ...Array.from({ length: sample.fields }, (_, f) => `f${f}`)],
          'creation-time keyset'
        );
        for (const key of Object.keys(held[i])) {
          const descriptor = Object.getOwnPropertyDescriptor(held[i], key);
          assert.equal(typeof descriptor.get, 'function');
          assert.equal(descriptor.enumerable, true);
          assert.equal(descriptor.configurable, true);
          assert.equal(descriptor.set, undefined);
        }
        for (let f = 0; f < sample.fields; f++)
          assert.equal(
            adapter.field(held[i], `f${f}`),
            all[i][f],
            'carrier identity'
          );
      }
    await checkpoint('readAllFields');
    adapter.destroy();
    adapter = undefined;
    held = undefined;
    first = undefined;
    all = undefined;
    rows = undefined;
    await checkpoint('afterDestroy');
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
