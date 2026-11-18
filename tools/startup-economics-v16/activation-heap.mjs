// Adapted from the v15 first-claim/transaction follow-up: v16 uses transact().
// Package identity remains the bound v16 artifact packet; no implementation alias.
// First-claim and real-transaction heap follow-up. This never rewrites the
// initial post-disposal checkpoint or pools timings with either CPU cohort.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cpus, loadavg, freemem } from 'node:os';

const script = fileURLToPath(import.meta.url);
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, value) => writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const verify = bindings => { for (const [p, h] of Object.entries(bindings)) assert.equal(sha(p), h, p); };
const [command, configArg, outputArg, sampleArg] = process.argv.slice(2);
assert.equal(process.version, 'v24.15.0');

if (command === 'plan') {
  const configPath = resolve(configArg), config = read(configPath), out = resolve(outputArg);
  assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  assert.deepEqual(Object.keys(config.arms).sort(), ['baseline', 'candidate']);
  const bindings = { [configPath]: sha(configPath), [script]: sha(script) };
  for (const p of Object.values(config.arms)) { bindings[p] = sha(p); Object.assign(bindings, read(p).bindings); }
  verify(bindings);
  const samples = [], controls = [];
  for (const profile of ['ordinary-sparse', 'ordinary-dense', 'transactions']) {
    for (let round = 0; round < 3; round++) for (const arm of round % 2
      ? ['candidate', 'baseline', 'baseline-aa'] : ['baseline-aa', 'baseline', 'candidate'])
      samples.push({ profile, arm, round });
  }
  for (const arm of ['baseline', 'candidate']) {
    controls.push({ arm, profile: 'ordinary-sparse', pin: true });
    controls.push({ arm, profile: 'ordinary-sparse', fault: 'drop-delivery', expected: 'live-delivery' });
    controls.push({ arm, profile: 'ordinary-sparse', fault: 'skip-destroy', expected: 'cleanup-exactly-once' });
    controls.push({ arm, profile: 'transactions' });
    controls.push({ arm, profile: 'transactions', fault: 'skip-confirm', expected: 'confirmed-authority' });
    controls.push({ arm, profile: 'transactions', fault: 'skip-rollback', expected: 'rolled-back-value' });
  }
  save(join(out, 'plan.json'), { createdUTC: new Date().toISOString(), command: process.argv, config, bindings, samples, controls,
    limits: '27 fresh serial Angular heap children, three matched rounds plus adjacent A/A.12 positive/fault controls use same exact baseline/combined packages.64x128 ordinary leaves:64claimed(sparse) or8192claimed(dense); live, disposed and rearmed observations distinct.10k rows with actual pending/confirmed/rolled-back transactions then retirement. Four GC requests separated by event-loop jobs per checkpoint; whole-process bytes, not dominators or performance timings. No publication.' });
  console.log(join(out, 'plan.json'));
} else if (command === 'run') {
  const planPath = resolve(configArg), plan = read(planPath), out = resolve(outputArg), kind = sampleArg;
  assert(['controls', 'heap'].includes(kind)); assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  verify(plan.bindings);
  const samples = kind === 'controls' ? plan.controls : plan.samples, results = [];
  save(join(out, 'admission.json'), { command: process.argv, planPath, planSha256: sha(planPath), kind });
  for (const [index, sample] of samples.entries()) {
    const args = ['--expose-gc', script, 'child', planPath, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
    writeFileSync(join(out, `${index}.stdout`), child.stdout ?? '', { flag: 'wx' });
    writeFileSync(join(out, `${index}.stderr`), child.stderr ?? '', { flag: 'wx' });
    save(join(out, `${index}.invocation.json`), { args, status: child.status, signal: child.signal, error: String(child.error ?? '') });
    if (sample.fault) { assert.equal(child.status, 1, sample.fault); assert(child.stderr.includes(sample.expected), child.stderr); }
    else { assert.equal(child.status, 0, child.stderr); results.push(JSON.parse(child.stdout)); }
    console.log(index, sample.profile, sample.arm, sample.fault ?? 'positive', 'passed');
  }
  verify(plan.bindings); save(join(out, 'results.json'), { passed: true, samples, results });
} else if (command === 'child') {
  const plan = read(configArg), sample = JSON.parse(outputArg);
  verify(plan.bindings);
  const packetPath = plan.config.arms[sample.arm === 'baseline-aa' ? 'baseline' : sample.arm];
  const packet = read(packetPath);
  const api = await import(pathToFileURL(packet.bundles?.angular ?? join(dirname(packetPath), 'angular.mjs')).href);
  const result = { sample, heaps: {}, host: { node: process.version, cpu: cpus()[0]?.model, load: loadavg(), free: freemem() } };
  const gc = async name => {
    for (let n = 0; n < 4; n++) { await new Promise(r => setImmediate(r)); global.gc(); }
    result.heaps[name] = process.memoryUsage().heapUsed;
  };
  const drain = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
  await gc('moduleReady');
  let pins = [];
  const episode = async () => {
    const trees = [], refs = [];
    let cleanups = 0;
    const own = tree => { trees.push(tree); refs.push(new WeakRef(tree)); tree.registerCleanup(() => cleanups++); return tree; };
    if (sample.profile.startsWith('ordinary')) {
      const seeds = Array.from({ length: 64 }, (_, id) => Object.fromEntries(Array.from({ length: 128 }, (_, f) => [`f${f}`, id + f])));
      seeds.forEach(seed => own(api.signalTree(seed)));
      const selected = trees.flatMap(t => Array.from({ length: sample.profile === 'ordinary-dense' ? 128 : 1 }, (_, index) => t.$[`f${index}`]));
      // Root public leaf properties are exactly the128seeded fields.
      assert.equal(selected.length, sample.profile === 'ordinary-dense' ? 8192 : 64, 'selected-leaf-count');
      const writes = selected.map(leaf => leaf.set), observed = selected.map(() => []);
      const snapshots = trees.map(t => t.$());
      await gc('constructed');
      let links = selected.map((leaf, i) => api.link(leaf, { set: value => { if (!(sample.fault === 'drop-delivery' && i === 0)) observed[i].push(value); } }));
      for (let i = 0; i < writes.length; i++) writes[i](10000 + i);
      await Promise.all(links.map(l => l.settled()));
      assert.deepEqual(observed, selected.map((_, i) => [10000 + i]), 'live-delivery');
      await gc('liveLinks');
      links.forEach(l => l.dispose()); links = [];
      for (let i = 0; i < writes.length; i++) writes[i](20000 + i);
      await drain();
      assert.deepEqual(observed, selected.map((_, i) => [10000 + i]), 'disposed-delivery');
      await gc('disposedLinks');
      links = selected.map((leaf, i) => api.link(leaf, { set: value => observed[i].push(value) }));
      for (let i = 0; i < writes.length; i++) writes[i](30000 + i);
      await Promise.all(links.map(l => l.settled()));
      assert.deepEqual(observed, selected.map((_, i) => [10000 + i, 30000 + i]), 'rearmed-delivery');
      assert.deepEqual(snapshots, seeds, 'held-snapshots');
      await gc('rearmedLinks');
      links.forEach(l => l.dispose());
    } else {
      const seeds = Array.from({ length: 10000 }, (_, id) => ({ id, value: id }));
      const tree = own(api.signalTree({ rows: api.entityMap({ selectId: row => row.id }) }, { enhancers: [api.transactions()] }));
      const rows = tree.$.rows;
      rows.setAll(seeds); await drain();
      assert.deepEqual(rows.all(), seeds, 'populated-values');
      let held = rows.byIdOrFail(0), snapshot = rows.all();
      await gc('populated');
      let pending = tree.transact(() => { rows.updateOne(0, { value: -1 }); rows.changeId(1, 10001); });
      assert.equal(tree.__transactions.getPendingTurnCount(), 1, 'open-authority');
      assert.equal(held().value, -1, 'pending-value');
      assert.equal(rows.has(1)(), false); assert.equal(rows.has(10001)(), true);
      await gc('openConfirm');
      if (sample.fault !== 'skip-confirm') pending.confirm();
      assert.equal(tree.__transactions.getPendingTurnCount(), 0, 'confirmed-authority');
      pending = undefined; await drain();
      await gc('confirmed');
      pending = tree.transact(() => { rows.updateOne(0, { value: -2 }); rows.removeOne(2); rows.addOne({ id: 10002, value: -3 }); });
      assert.equal(tree.__transactions.getPendingTurnCount(), 1, 'rollback-open-authority');
      assert.equal(held().value, -2); assert.equal(rows.has(2)(), false); assert.equal(rows.has(10002)(), true);
      await gc('openRollback');
      if (sample.fault !== 'skip-rollback') pending.rollback();
      assert.equal(held().value, -1, 'rolled-back-value');
      assert.equal(tree.__transactions.getPendingTurnCount(), 0, 'rolled-back-authority');
      assert.equal(rows.has(2)(), true); assert.equal(rows.has(10002)(), false);
      assert.deepEqual(rows.ids(), seeds.map(row => row.id === 1 ? 10001 : row.id), 'restored-order');
      assert.equal(snapshot[0].value, 0, 'held-snapshot');
      pending = undefined; await drain();
      await gc('rolledBack');
      rows.removeOne(0); rows.addOne({ id: 0, value: -4 }); await drain();
      assert.equal(held(), undefined, 'retired-lifetime');
      assert.equal(rows.byIdOrFail(0)().value, -4, 'replacement-lifetime');
      assert.equal(rows.count(), 10000); assert.equal(rows.ids().at(-1), 0);
      await gc('retiredWithHeldNode');
      held = snapshot = undefined;
      await gc('retiredReleasedNode');
    }
    if (sample.pin) pins = [trees[0]];
    if (sample.fault !== 'skip-destroy') trees.forEach(t => t.destroy());
    assert.equal(cleanups, trees.length, 'cleanup-exactly-once');
    assert(trees.every(t => t.destroyed()), 'destroyed-flags');
    return refs;
  };
  const refs = await episode();
  await gc('helperReturned');
  if (sample.pin) { assert(refs[0].deref(), 'positive-pin'); pins = []; await gc('pinReleased'); }
  assert(refs.every(ref => ref.deref() === undefined), 'tree-release');
  assert.equal(pins.length, 0);
  verify(plan.bindings); result.passed = true; console.log(JSON.stringify(result));
} else throw new Error('Expected plan, run or child');
