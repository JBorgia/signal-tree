#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadavg } from 'node:os';

const [mode, inputArg, outArg, sampleText] = process.argv.slice(2);
assert(['compare', 'child', 'control'].includes(mode));
const input = resolve(inputArg), out = resolve(outArg);
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(new URL('./v15-residual-heap-protocol.md', import.meta.url));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const reportPath = join(input, 'bundles.json');
const artifact = read(reportPath).summaries.find(item => item.arm === 'lazy');
assert(artifact);
assert.equal(sha(artifact.bundle), artifact.bundleSha256);
assert.equal(sha(artifact.source), artifact.sourceSha256);
assert.equal(sha(artifact.planPath), artifact.planSha256);
assert.equal('sha512-' + createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'), artifact.archiveIntegrity);
const bindings = Object.fromEntries([runner, protocol, reportPath, artifact.bundle,
  artifact.source, artifact.planPath, artifact.archive].map(path => [path, sha(path)]));
const verify = () => { for (const [path, hash] of Object.entries(bindings)) assert.equal(sha(path), hash); };

if (mode !== 'child') {
  mkdirSync(out, { recursive: false });
  const schedule = [];
  if (mode === 'control') {
    for (const fault of ['skip-populate', 'early-send'])
      schedule.push({ recipient: true, cumulativeIds: false, repeat: 0, fault });
  } else {
    const cells = [
      { recipient: true, cumulativeIds: true },
      { recipient: false, cumulativeIds: false },
      { recipient: true, cumulativeIds: false },
      { recipient: false, cumulativeIds: true },
    ];
    for (let repeat = 0; repeat < 2; repeat++)
      for (const cell of repeat ? [...cells].reverse() : cells) schedule.push({ ...cell, repeat });
  }
  save(join(out, 'schedule.json'), { command: [process.execPath, ...process.argv.slice(1)],
    createdUTC: new Date().toISOString(), cycles: 30, rows: 1000, bindings, schedule });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const path = join(out, `child-${index}.json`);
    const command = ['--expose-gc', runner, 'child', input, path, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 240000,
      env: { ...process.env, NODE_ENV: 'production' } });
    writeFileSync(path + '.log', child.stdout + child.stderr, { flag: 'wx' });
    const result = read(path);
    save(join(out, `invocation-${index}.json`), { command: [process.execPath, ...command],
      status: child.status, signal: child.signal, resultSha256: sha(path), logSha256: sha(path + '.log') });
    if (mode === 'control') {
      assert.equal(child.status, 1);
      assert.match(result.error, sample.fault === 'skip-populate' ? /Populated rows/ : /No outbound delivery before settlement/);
    } else { assert.equal(child.status, 0, result.error); assert.equal(result.passed, true); }
    results.push(result);
    console.log(index + 1, schedule.length, JSON.stringify(sample), mode === 'control' ? 'fault detected' : 'passed');
  }
  verify();
  assert.equal(new Set(results.map(r => r.pid)).size, results.length);
  save(join(out, 'results.json'), { passed: true, mode, bindings, results });
} else {
  const sample = JSON.parse(sampleText);
  assert.equal(typeof global.gc, 'function');
  const api = await import(pathToFileURL(artifact.bundle));
  const result = { sample, pid: process.pid, node: process.version, bundleSha256: artifact.bundleSha256,
    hostLoad: loadavg(), cycles: [], passed: false };
  const flush = async () => { for (let n = 0; n < 160; n++) await Promise.resolve(); };
  const gcHeap = async () => {
    for (let n = 0; n < 3; n++) { await new Promise(done => setImmediate(done)); global.gc(); }
    return process.memoryUsage().heapUsed;
  };
  const inspectRegistries = tree => {
    const root = tree.$;
    const descriptors = root[Symbol.for('SignalTree:TreeRealizationDescriptors')];
    const claims = root[Symbol.for('SignalTree:SubjectRestorationClaims')];
    const positions = root[Symbol.for('SignalTree:PositionRegistry')];
    const maps = { descriptors: descriptors?.size ?? null, structuralEffects: 0,
      structuralEffectBySubject: 0, subjectDescriptors: 0 };
    for (const descriptor of descriptors?.values() ?? []) {
      for (const key of ['structuralEffects', 'structuralEffectBySubject', 'subjectDescriptors'])
        maps[key] += descriptor[key]?.size ?? 0;
    }
    return { ...maps, claims: claims?.snapshot() ?? null,
      positions: Object.fromEntries(['parents', 'addresses', 'collectionPaths'].map(key => [key, positions?.[key]?.size ?? null])) };
  };
  async function retainedStore() {
    const tree = api.create();
    let deliveries = 0, badPayloads = 0;
    const connection = sample.recipient ? api.attach(tree, values => {
      deliveries++; if (values.length) badPayloads++;
    }) : undefined;
    const payloadRefs = [], transactionRefs = [];
    let oracleIds = [];
    try {
      await flush();
      assert.equal(deliveries, 0);
      result.emptyHeapBytes = await gcHeap();
      const collection = tree.$.rows;
      async function cycle(number) {
        const rows = Array.from({ length: 1000 }, (_, i) => Object.fromEntries([
          ['id', `R-${i}`], ...Array.from({ length: 8 }, (_, f) => [`v${f}`, number * 100000 + i * 10 + f]) ]));
        const before = deliveries;
        let transaction = tree.transact(() => {
          if (sample.fault !== 'skip-populate') api.populate(tree, rows.map(row => ({ ...row })));
        });
        try {
          assert.deepEqual(api.read(tree), rows, 'Populated rows must match');
          assert.equal(api.pending(tree), 1);
          const ids = [...collection.__subjectIds];
          assert.equal(ids.length, rows.length);
          assert.deepEqual(ids.map(id => collection.__findKeyBySubjectId(id)), rows.map(row => row.id));
          const payload = new WeakRef(api.read(tree)[0]), tx = new WeakRef(transaction);
          await flush();
          if (sample.fault === 'early-send') deliveries++;
          assert.equal(deliveries, before, 'No outbound delivery before settlement');
          transaction.rollback(); transaction = undefined;
          await flush(); await connection?.settled();
          assert.deepEqual(api.read(tree), []); assert.equal(api.pending(tree), 0);
          assert.equal(badPayloads, 0);
          if (number === 1 && sample.recipient) assert(deliveries > before, 'Real Link delivery required');
          if (!sample.recipient) assert.equal(deliveries, 0);
          return { ids, payload, transaction: tx };
        } finally { transaction?.rollback(); }
      }
      for (let number = 1; number <= 30; number++) {
        const completed = await cycle(number);
        if (sample.cumulativeIds) oracleIds.push(...completed.ids);
        else oracleIds = completed.ids;
        payloadRefs.push(completed.payload); transactionRefs.push(completed.transaction);
        const heapBytes = await gcHeap();
        for (const id of oracleIds) assert.equal(collection.__inspectSubjectResources(id), undefined);
        assert.deepEqual(collection.__listSubjectReclamationCandidates(), []);
        const payloadsAlive = payloadRefs.filter(ref => ref.deref() !== undefined).length;
        const transactionsAlive = transactionRefs.filter(ref => ref.deref() !== undefined).length;
        assert.equal(payloadsAlive, 0); assert.equal(transactionsAlive, 0);
        result.cycles.push({ cycle: number, heapBytes, oracleIds: oracleIds.length, payloadsAlive,
          transactionsAlive, retainedLifetimes: 0, retainedValueBackings: 0, deliveries,
          registries: inspectRegistries(tree) });
      }
      return { tree: new WeakRef(tree), connection: connection ? new WeakRef(connection) : undefined };
    } finally { connection?.dispose(); tree.destroy(); }
  }
  try {
    result.beforeHeapBytes = await gcHeap();
    const refs = await retainedStore();
    result.afterHelperHeapBytes = await gcHeap();
    assert.equal(refs.tree.deref(), undefined);
    assert.equal(refs.connection?.deref(), undefined);
    verify(); result.passed = true;
  } catch (error) { result.error = String(error?.stack ?? error); process.exitCode = 1; }
  save(out, result);
}
