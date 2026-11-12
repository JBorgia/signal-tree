#!/usr/bin/env node
// Installed neutral-runtime episodes. CPU includes assertions and drain work;
// no claim of Angular rendering, per-feature bytes or rival equivalence.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
const [mode, packetArg, outputArg, sampleArg, candidateArg] =
  process.argv.slice(2);
const packet = resolve(packetArg),
  output = resolve(outputArg),
  runner = fileURLToPath(import.meta.url);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, v) =>
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const planPath = join(packet, 'plan.json'),
  plan = read(planPath);
const bindings = {
  ...plan.inputs,
  [planPath]: sha(planPath),
  [runner]: sha(runner),
};
const override = mode === 'compare' ? sampleArg : candidateArg;
const candidate = override ? resolve(override) : undefined;
if (candidate) {
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = join(p, e.name);
      if (e.isDirectory()) walk(f);
      else bindings[f] = sha(f);
    }
  };
  walk(candidate);
}
const verify = () => {
  for (const [p, h] of Object.entries(bindings)) assert.equal(sha(p), h, p);
};
verify();
if (mode === 'compare') {
  assert.ok(!existsSync(output));
  mkdirSync(output, { recursive: true });
  const schedule = [];
  for (const rows of [1000, 10000])
    for (let round = 0; round < 5; round++)
      schedule.push({ rows, round, episodes: 100 });
  save(join(output, 'schedule.json'), {
    command: process.argv,
    bindings,
    schedule,
    limits:
      'Neutral installed v16 only, no competitor-equivalence or UI claim. Each episode includes oracle and fixed microtask draining. Shared host.',
  });
  const results = [];
  for (let i = 0; i < schedule.length; i++) {
    const path = join(output, `child-${i}.json`),
      args = [
        '--expose-gc',
        runner,
        'child',
        packet,
        path,
        JSON.stringify(schedule[i]),
        ...(candidate ? [candidate] : []),
      ];
    const r = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    writeFileSync(path + '.log', (r.stdout ?? '') + (r.stderr ?? ''), {
      flag: 'wx',
    });
    save(path + '.invocation.json', {
      command: [process.execPath, ...args],
      exit: r.status,
      signal: r.signal,
      resultHash: existsSync(path) ? sha(path) : null,
    });
    if (existsSync(path)) results.push(read(path));
    if (r.status !== 0 || !results.at(-1)?.passed) break;
    console.log(i, 'passed');
  }
  verify();
  const passed =
    results.length === schedule.length && results.every((r) => r.passed);
  save(join(output, 'results.json'), {
    passed,
    scheduleSha256: sha(join(output, 'schedule.json')),
    results,
  });
  if (!passed) process.exitCode = 1;
} else {
  assert.ok(['child', 'fault'].includes(mode));
  const sample = JSON.parse(sampleArg),
    dir = candidate ?? join(packet, 'v16/node_modules/@signal-tree/kernel');
  const manifest = read(join(dir, 'package.json'));
  const { signalTree, entityMap, transactions, link } = await import(
    pathToFileURL(resolve(dir, manifest.exports['.'].import))
  );
  const { observeWrites, transactionLifecycleReader } = await import(
    pathToFileURL(resolve(dir, manifest.exports['./internals'].import))
  );
  const flush = async () => {
    for (let n = 0; n < 160; n++) await Promise.resolve();
  };
  const heap = async () => {
    for (let n = 0; n < 3; n++) {
      await new Promise((r) => setImmediate(r));
      global.gc();
    }
    return process.memoryUsage().heapUsed;
  };
  const result = {
    sample,
    pid: process.pid,
    node: process.version,
    version: manifest.version,
    packageDirectory: dir,
    bindings,
    host: { cpu: os.cpus()[0].model, load: os.loadavg() },
    checkpoints: [],
    phases: {},
    passed: false,
  };
  const trees = [],
    links = [];
  let receipts = [];
  const create = (schema, enhanced = false) => {
    const t = signalTree(
      schema,
      enhanced ? { enhancers: [transactions()] } : undefined
    );
    trees.push(t);
    return t;
  };
  const connect = (node, sink) => {
    const c = link(node, { set: sink });
    links.push(c);
    return c;
  };
  let totalNs = 0;
  const timed = async (name, run) => {
    const cpu = process.cpuUsage(),
      start = process.hrtime.bigint();
    await run();
    const ns = Number(process.hrtime.bigint() - start);
    totalNs += ns;
    const entry = (result.phases[name] ??= {
      count: 0,
      elapsedNs: 0,
      cpuUs: 0,
    });
    entry.count++;
    entry.elapsedNs += ns;
    const usage = process.cpuUsage(cpu);
    entry.cpuUs += usage.user + usage.system;
  };
  try {
    result.beforeHeap = await heap();
    let tree, owner, target, independent, history, recoveryTree;
    await timed('setup', async () => {
      tree = create({ rows: entityMap({ selectId: (r) => r.id }) }, true);
      tree.$.rows.setAll(
        Array.from({ length: sample.rows }, (_, i) => ({
          id: String(i),
          n: 0,
          ...Object.fromEntries(
            Array.from({ length: 30 }, (_, j) => ['f' + j, j])
          ),
        }))
      );
      owner = create({ x: 0 }, true);
      target = create({ x: 0 }, true);
      independent = create({ x: 0 });
      history = create({ rows: entityMap({ selectId: (r) => r.id }) });
      history.$.rows.addOne({ id: 'h', x: 0, y: 0 });
      recoveryTree = create(
        { rows: entityMap({ selectId: (r) => r.id }) },
        true
      );
      recoveryTree.$.rows.addOne({ id: 'r', n: 0 });
      await flush();
    });
    result.checkpoints.push({
      stage: 'populated',
      heap: await heap(),
      cumulativeNs: totalNs,
    });
    const sent = [],
      independentSent = [];
    const c = connect(target.$.x, (v) => sent.push(v));
    const independentLink = connect(independent.$.x, (v) =>
      independentSent.push(v)
    );
    for (let i = 0; i < sample.episodes; i++) {
      await timed('declared-dependent-and-independent', async () => {
        sent.length = 0;
        independentSent.length = 0;
        const q = owner.transact(() => owner.$.x(i + 1));
        const inspection = q.inspect();
        const receipt = c.declare({ kind: 'dependent', owners: [q] }, () => {
          owner.updateAndReport((input) => {
            target.$.x(input.x + 1000);
            return {};
          });
        });
        if (mode === 'fault') sent.push(i + 1001); // Planted early publication before owner settlement.
        await flush();
        assert.deepEqual(sent, []);
        assert.equal(receipt.read().state, 'held');
        const independentReceipt = independentLink.declare(
          { kind: 'independent' },
          () => independent.$.x(i + 1)
        );
        await flush();
        assert.deepEqual(independentSent, [i + 1]);
        assert.equal(independentReceipt.read().state, 'started');
        assert.deepEqual(q.inspect(), inspection);
        q.confirm();
        await flush();
        await c.settled();
        assert.deepEqual(sent, [i + 1001]);
        assert.deepEqual(receipt.read(), {
          state: 'started',
          basis: 'declared',
        });
        if (i % 20 === 0) receipts.push(receipt); // Fixed bounded diagnostic retention.
      });
      await timed('transaction-rejection-and-refusal', async () => {
        const row = tree.$.rows.byIdOrFail(String(i % sample.rows)),
          old = row.n();
        const a = tree.transact(() => row.n(old + 1));
        const b = tree.transact(() => row.n(old + 2));
        assert.throws(() => a.rollback());
        assert.equal(row.n(), old + 2);
        b.rollback();
        assert.equal(row.n(), old + 1);
        a.rollback();
        assert.equal(row.n(), old);
        const accepted = tree.transact(() => row.n(old + 3));
        accepted.confirm();
        assert.equal(row.n(), old + 3);
        await flush();
      });
      await timed('retirement-and-late-reader', async () => {
        const id = String((i + 100) % sample.rows),
          old = tree.$.rows.byIdOrFail(id),
          value = old();
        tree.$.rows.removeOne(id);
        await flush();
        assert.equal(old(), undefined);
        tree.$.rows.addOne({ ...value, n: i + 10 });
        const fresh = tree.$.rows.byIdOrFail(id);
        assert.notEqual(fresh, old);
        assert.equal(old(), undefined);
        assert.equal(fresh.n(), i + 10);
        const delivered = [];
        const late = link(fresh.n, { set: (v) => delivered.push(v) });
        try {
          late.declare({ kind: 'independent' }, () => fresh.n(i + 20));
          await flush();
          await late.settled();
          assert.deepEqual(delivered, [i + 20]);
          assert.equal(old(), undefined);
        } finally {
          late.dispose();
        }
      });
      await timed('pre-enrollment-history', async () => {
        const q = owner.transact(() => owner.$.x(10000 + i));
        const inspection = q.inspect();
        history.$.rows.updateOne('h', { x: i + 7 });
        const delivered = [];
        const late = link(history.$.rows, { set: (v) => delivered.push(v) });
        try {
          late.declare({ kind: 'independent' }, () =>
            history.$.rows.updateOne('h', { y: i + 8 })
          );
          await flush();
          assert.deepEqual(delivered, []);
          assert.deepEqual(q.inspect(), inspection);
          q[i % 2 ? 'confirm' : 'rollback']();
          await flush();
          await late.settled();
          assert.deepEqual(delivered, [[{ id: 'h', x: i + 7, y: i + 8 }]]);
        } finally {
          late.dispose();
        }
      });
      await timed('automatic-refusal-recovery', async () => {
        const row = recoveryTree.$.rows.byIdOrFail('r');
        row.n(0);
        await flush();
        let armed = true;
        const off = observeWrites((frame) => {
          if (armed && frame.path.startsWith('rows')) {
            armed = false;
            recoveryTree.$.rows.updateOne('r', { n: 2 });
          }
        });
        let thrown;
        try {
          recoveryTree.transact(() => {
            recoveryTree.$.rows.updateOne('r', { n: 1 });
            throw Error('deliberate callback failure');
          });
        } catch (e) {
          thrown = e;
        } finally {
          off();
        }
        assert.equal(thrown?.recovery?.callbackFailed, true);
        assert.equal(row.n(), 2);
        const snapshot = transactionLifecycleReader(recoveryTree).snapshot();
        assert.equal(snapshot.pending.length, 1);
        assert.equal(snapshot.pending[0].consequencesReleased, false);
        thrown.recovery.transaction.confirm();
        assert.equal(
          transactionLifecycleReader(recoveryTree).snapshot().pending.length,
          0
        );
        await flush();
      });
      if ([0, 9, 49, 99].includes(i))
        result.checkpoints.push({
          stage: `episodes-${i + 1}`,
          heap: await heap(),
          cumulativeNs: totalNs,
        });
    }
    // Many simultaneously pending inverses, then drain, while keeping the same tree.
    let pending = [];
    await timed('pending-open', async () => {
      for (let i = 0; i < 128; i++) {
        const row = tree.$.rows.byIdOrFail(String(i));
        const old = row.n();
        pending.push({ handle: tree.transact(() => row.n(old + 1)), row, old });
      }
      await flush();
    });
    result.checkpoints.push({
      stage: 'pending-128',
      heap: await heap(),
      cumulativeNs: totalNs,
    });
    await timed('pending-drain', async () => {
      for (const { handle, row, old } of pending) {
        handle.rollback();
        assert.equal(row.n(), old);
      }
      pending = [];
      await flush();
    });
    result.checkpoints.push({
      stage: 'settled-128',
      heap: await heap(),
      cumulativeNs: totalNs,
    });
    for (const r of receipts)
      assert.deepEqual(r.read(), { state: 'started', basis: 'declared' });
    receipts = [];
    for (const c of links) c.dispose();
    links.length = 0;
    for (const t of trees) t.destroy();
    trees.length = 0;
    tree = owner = target = independent = history = recoveryTree = undefined;
    await flush();
    result.checkpoints.push({
      stage: 'destroyed',
      heap: await heap(),
      cumulativeNs: totalNs,
    });
    verify();
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack);
  } finally {
    for (const c of links) c.dispose();
    for (const t of trees) t.destroy();
    save(output, result);
  }
  if (!result.passed) process.exitCode = 1;
}
