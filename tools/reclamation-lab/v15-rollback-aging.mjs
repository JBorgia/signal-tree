#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, inputArg, outArg, sampleArg] = process.argv.slice(2);
assert.ok(['compare', 'control', 'child'].includes(mode) && inputArg && outArg);
const input = resolve(inputArg),
  out = resolve(outArg),
  runner = fileURLToPath(import.meta.url),
  protocol = fileURLToPath(
    new URL('./v15-rollback-aging-protocol.md', import.meta.url)
  );
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, v) =>
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const reportPath = join(input, 'bundles.json'),
  report = read(reportPath),
  bindings = {
    [runner]: sha(runner),
    [protocol]: sha(protocol),
    [reportPath]: sha(reportPath),
  };
for (const b of report.summaries) {
  assert.equal(sha(b.bundle), b.bundleSha256);
  assert.equal(sha(b.source), b.sourceSha256);
  assert.equal(sha(b.planPath), b.planSha256);
  assert.equal(
    'sha512-' +
      createHash('sha512').update(readFileSync(b.archive)).digest('base64'),
    b.archiveIntegrity
  );
  for (const p of [b.bundle, b.source, b.planPath, b.archive])
    bindings[p] = sha(p);
}
const verify = () => {
  for (const [p, h] of Object.entries(bindings))
    assert.equal(sha(p), h, `Input drift: ${p}`);
};
if (mode !== 'child') {
  assert.ok(!existsSync(out));
  mkdirSync(out, { recursive: true });
  const schedule = [];
  if (mode === 'control')
    schedule.push({
      arm: 'baseline',
      keys: 'reused',
      round: 0,
      fault: 'early-send',
      pinned: false,
    });
  else {
    for (const keys of ['reused', 'fresh'])
      for (let round = 0; round < 3; round++)
        for (const arm of round % 2
          ? ['lazy', 'baseline']
          : ['baseline', 'lazy'])
          schedule.push({ arm, keys, round, pinned: false });
    for (const arm of ['baseline', 'lazy'])
      schedule.push({ arm, keys: 'reused', round: 0, pinned: true });
  }
  save(join(out, 'schedule.json'), {
    mode,
    createdUTC: new Date().toISOString(),
    command: [process.execPath, ...process.argv.slice(1)],
    bindings,
    schedule,
    limits:
      'Whole-process retained-tree trajectory, including numeric ID inspection list; finite10cycles×1000rows, no per-feature allocation attribution or universal leak/boundedness claim.',
  });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const path = join(out, `child-${String(index).padStart(3, '0')}.json`),
      args = [
        '--expose-gc',
        runner,
        'child',
        input,
        path,
        JSON.stringify(sample),
      ];
    const child = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 240000,
    });
    writeFileSync(path + '.log', (child.stdout ?? '') + (child.stderr ?? ''), {
      flag: 'wx',
    });
    save(join(out, `invocation-${index}.json`), {
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
      assert.match(
        results.at(-1)?.error ?? '',
        /No outbound delivery before settlement/
      );
    } else if (child.status !== 0 || !results.at(-1)?.passed) break;
    console.log(
      index,
      sample.arm,
      sample.keys,
      sample.pinned
        ? 'pin detected/released'
        : mode === 'control'
        ? 'fault detected'
        : 'passed'
    );
  }
  verify();
  const passed =
    results.length === schedule.length &&
    (mode === 'control' || results.every((r) => r.passed));
  for (const [index, result] of results.entries()) {
    const receipt = read(join(out, `invocation-${index}.json`));
    assert.equal(sha(receipt.resultPath), receipt.resultSha256);
    assert.equal(sha(receipt.resultPath + '.log'), receipt.logSha256);
    assert.deepEqual(read(receipt.resultPath), result);
    for (const [k, v] of Object.entries(schedule[index]))
      assert.equal(result.sample[k], v);
  }
  const groups = [],
    stats = (values) => ({
      median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
      min: Math.min(...values),
      max: Math.max(...values),
      values,
    });
  if (passed && mode === 'compare')
    for (const keys of ['reused', 'fresh'])
      for (const arm of ['baseline', 'lazy']) {
        const cells = results.filter(
          (r) =>
            r.sample.keys === keys && r.sample.arm === arm && !r.sample.pinned
        );
        assert.equal(cells.length, 3);
        groups.push({
          arm,
          keys,
          cycles: Array.from({ length: 10 }, (_, i) => ({
            cycle: i + 1,
            settledHeapDelta: stats(
              cells.map((c) => c.cycles[i].settledHeapBytes - c.emptyHeapBytes)
            ),
            retainedLifetimes: stats(
              cells.map((c) => c.cycles[i].resources.retainedLifetimes)
            ),
            retainedValueBackings: stats(
              cells.map((c) => c.cycles[i].resources.retainedValueBackings)
            ),
            valueBackedCandidates: stats(
              cells.map((c) => c.cycles[i].resources.valueBackedCandidates)
            ),
            sampledPayloadsAlive: stats(
              cells.map((c) => c.cycles[i].sampledPayloadsAlive)
            ),
          })),
        });
      }
  save(join(out, 'results.json'), {
    passed,
    mode,
    scheduleSha256: sha(join(out, 'schedule.json')),
    groups,
    results,
  });
  if (!passed) process.exitCode = 1;
} else {
  const sample = JSON.parse(sampleArg);
  assert.ok(
    ['baseline', 'lazy'].includes(sample.arm) &&
      ['reused', 'fresh'].includes(sample.keys)
  );
  const b = report.summaries.find((b) => b.arm === sample.arm),
    api = await import(pathToFileURL(b.bundle).href);
  assert.equal(typeof global.gc, 'function');
  const pin = { tree: undefined };
  const result = {
    sample,
    node: process.version,
    pid: process.pid,
    bundleSha256: b.bundleSha256,
    host: {
      cpu: os.cpus()[0]?.model,
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    cycles: [],
    passed: false,
  };
  const flush = async () => {
    for (let n = 0; n < 160; n++) await Promise.resolve();
  };
  const gcHeap = async () => {
    for (let n = 0; n < 3; n++) {
      await new Promise((r) => setImmediate(r));
      global.gc();
    }
    return process.memoryUsage().heapUsed;
  };
  async function retainedStore() {
    const tree = api.create();
    let deliveries = 0,
      badPayloads = 0;
    const connection = api.attach(tree, (values) => {
      deliveries++;
      if (values.length !== 0) badPayloads++;
    });
    const allIds = [],
      payloadRefs = [],
      transactionRefs = [];
    try {
      await flush();
      assert.equal(deliveries, 0);
      result.emptyHeapBytes = await gcHeap();
      const collection = tree.$.rows;
      for (const method of [
        '__findKeyBySubjectId',
        '__inspectSubjectResources',
        '__listSubjectReclamationCandidates',
      ])
        assert.equal(
          typeof collection[method],
          'function',
          `Inspection method ${method}`
        );
      async function cycle(number) {
        const rows = Array.from({ length: 1000 }, (_, i) =>
          Object.fromEntries([
            ['id', sample.keys === 'fresh' ? `R-${number}-${i}` : `R-${i}`],
            ...Array.from({ length: 8 }, (_, f) => [
              `v${f}`,
              number * 100000 + i * 10 + f,
            ]),
          ])
        );
        const before = deliveries;
        let transaction;
        try {
          transaction = tree.transact(() =>
            api.populate(
              tree,
              rows.map((row) => ({ ...row }))
            )
          );
          assert.deepEqual(api.read(tree), rows);
          assert.equal(api.pending(tree), 1);
          // V15 folds testing handles out of production. Its collection-owned
          // metadata exposes the same exact IDs without acquiring row facades.
          const ids = [...collection.__subjectIds];
          assert.equal(ids.length, rows.length);
          assert.deepEqual(ids.map(id => collection.__findKeyBySubjectId(id)), rows.map(row => row.id));
          const payload = new WeakRef(api.read(tree)[0]),
            tx = new WeakRef(transaction);
          await flush();
          if (sample.fault === 'early-send') deliveries++;
          assert.equal(
            deliveries,
            before,
            'No outbound delivery before settlement'
          );
          assert.equal(badPayloads, 0);
          transaction.rollback();
          transaction = undefined;
          await flush();
          await connection.settled();
          assert.deepEqual(api.read(tree), []);
          assert.equal(api.pending(tree), 0);
          assert.equal(badPayloads, 0, 'Every outbound payload must be []');
          if (number === 1)
            assert.ok(
              deliveries > before,
              'First rollback must exercise Link sink'
            );
          return {
            ids,
            payload,
            transaction: tx,
            deliveries: deliveries - before,
          };
        } finally {
          transaction?.rollback();
        }
      }
      function resources() {
        let retainedLifetimes = 0,
          retainedValueBackings = 0,
          active = 0,
          facades = 0;
        for (const id of allIds) {
          const state = collection.__inspectSubjectResources(id);
          if (state) {
            retainedLifetimes++;
            if (state.retainedValueBacking) retainedValueBackings++;
            if (state.state === 'active') active++;
            if (state.nodeFacadeMaterialized) facades++;
          }
        }
        assert.equal(active, 0);
        assert.equal(facades, 0, 'Inspection must not acquire row facades');
        return {
          observedLifetimes: allIds.length,
          retainedLifetimes,
          retainedValueBackings,
          valueBackedCandidates:
            collection.__listSubjectReclamationCandidates().length,
          active,
          facades,
        };
      }
      for (let number = 1; number <= 10; number++) {
        const completed = await cycle(number);
        allIds.push(...completed.ids);
        payloadRefs.push(completed.payload);
        transactionRefs.push(completed.transaction);
        const settledHeapBytes = await gcHeap();
        const counts = resources();
        assert.deepEqual(api.read(tree), []);
        assert.equal(api.pending(tree), 0);
        const sampledPayloadsAlive = payloadRefs.filter(
          (ref) => ref.deref() !== undefined
        ).length;
        const sampledTransactionsAlive = transactionRefs.filter(
          (ref) => ref.deref() !== undefined
        ).length;
        result.cycles.push({
          cycle: number,
          settledHeapBytes,
          resources: counts,
          sampledPayloadsAlive,
          sampledTransactionsAlive,
          deliveries: completed.deliveries,
        });
      }
      result.deliveries = deliveries;
      result.badPayloads = badPayloads;
      if (sample.pinned) pin.tree = tree;
      return {
        tree: new WeakRef(tree),
        connection: new WeakRef(connection),
        payloadRefs,
        transactionRefs,
      };
    } finally {
      connection.dispose();
      tree.destroy();
    }
  }
  const observe = async (refs) => {
    const passes = [];
    for (let i = 0; i < 12; i++) {
      await new Promise((done) => setImmediate(done));
      global.gc();
      const alive = {
        tree: refs.tree.deref() !== undefined,
        connection: refs.connection.deref() !== undefined,
        payloads: refs.payloadRefs.filter((r) => r.deref() !== undefined)
          .length,
        transactions: refs.transactionRefs.filter(
          (r) => r.deref() !== undefined
        ).length,
      };
      passes.push({
        pass: i + 1,
        alive,
        heapBytes: process.memoryUsage().heapUsed,
      });
      if (
        i >= 2 &&
        ((!alive.tree &&
          !alive.connection &&
          alive.payloads === 0 &&
          alive.transactions === 0) ||
          pin.tree !== undefined)
      )
        break;
    }
    return passes;
  };
  try {
    result.beforeHeapBytes = await gcHeap();
    const refs = await retainedStore();
    result.postHelper = await observe(refs);
    if (sample.pinned) {
      assert.equal(
        result.postHelper.at(-1).alive.tree,
        true,
        'Actual pinned tree must remain alive'
      );
      pin.tree = undefined;
      result.afterPinRelease = await observe(refs);
    } else result.afterPinRelease = result.postHelper;
    const final = result.afterPinRelease.at(-1).alive;
    assert.deepEqual(
      final,
      { tree: false, connection: false, payloads: 0, transactions: 0 },
      'Sampled graph must collect after helper and pin release'
    );
    verify();
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack);
  } finally {
    pin.tree = undefined;
    save(out, result);
  }
  if (!result.passed) process.exitCode = 1;
}
