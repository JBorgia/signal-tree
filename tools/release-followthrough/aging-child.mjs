// Original registered aging operations; only the shared-helper import path changes.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { cpus, freemem, loadavg } from 'node:os';
import { pathToFileURL } from 'node:url';
import { quiesce } from '../lib/heap-quiescence.mjs';

globalThis.ngDevMode = false;
const [dist, profile, output] = process.argv.slice(2);
const entry = pathToFileURL(dist + '/index.js').href;
const { signalTree, entityMap } = await import(entry);
const width = { 'wide-8': 8, 'wide-32': 32, steady: 3, promote: 3 }[profile];
assert.ok(width);
const rounds = width > 3 ? 6 : 12;
const treeCount = 6;
const rowCount = 512;
const keyNames = Array.from({ length: width - 1 }, (_, i) => 'f' + i);
const env = () => ({ load: loadavg(), free: freemem() });
const out = { entry, profile, width, rounds, treeCount, rowCount, version: process.version, cpu: cpus()[0].model, start: env(), metrics: {}, heap: {} };
const drain = () => new Promise(setImmediate);

async function measure(name, operation) {
  const cpu = process.cpuUsage();
  const wall = performance.now();
  const operations = operation();
  const syncWall = performance.now() - wall;
  const sync = process.cpuUsage(cpu);
  await drain(); await drain();
  const total = process.cpuUsage(cpu);
  out.metrics[name] = {
    operations,
    syncWall,
    syncCpu: (sync.user + sync.system) / 1000,
    totalCpu: (total.user + total.system) / 1000,
  };
}
function seed(i) {
  const row = { id: String(i) };
  for (const field of keyNames) row[field] = 0;
  return row;
}
function populate() {
  return Array.from({ length: treeCount }, () => {
    const tree = signalTree({ rows: entityMap() });
    tree.$.rows.setAll(Array.from({ length: rowCount }, (_, i) => seed(i)));
    assert.equal(tree.$.rows.count(), rowCount);
    return { tree, rows: tree.$.rows, handles: undefined };
  });
}
function verify(held, fields, completedRounds) {
  const expected = Object.fromEntries(fields.map((field, index) =>
    [field, completedRounds - ((completedRounds - 1 - index + fields.length) % fields.length)]));
  for (const { handles } of held) {
    for (let i = 0; i < handles.length; i++) {
      const row = handles[i]();
      assert.equal(row.id, String(i));
      assert.equal(Object.keys(row).length, fields.length + 1);
      for (const field of fields) {
        const last = expected[field];
        assert.equal(row[field], last > 0 ? last : field === 'extra' ? -1 : 0);
      }
    }
  }
}
function edit(held, fields, count) {
  for (let round = 1; round <= count; round++) {
    const field = fields[(round - 1) % fields.length];
    const patch = { [field]: round };
    for (const { rows, handles } of held) {
      for (let i = 0; i < rowCount; i++) {
        rows.updateOne(String(i), patch);
        assert.equal(handles[i]()[field], round);
      }
    }
  }
  return treeCount * rowCount * count;
}
function release(held) {
  for (const { tree } of held) tree.destroy();
}
async function run() {
  out.heap.baseline = await quiesce();
  let held;
  await measure('populate', () => {
    held = populate();
    return treeCount * rowCount;
  });
  const weak = held.map(({ tree }) => new WeakRef(tree));
  out.heap.cold = await quiesce();
  try {
    for (const fixture of held) {
      fixture.handles = Array.from({ length: rowCount }, (_, i) => fixture.rows.byIdOrFail(String(i)));
    }
    out.heap.primed = await quiesce();
    await measure('first', () => edit(held, keyNames, rounds));
    verify(held, keyNames, rounds);
    out.heap.first = await quiesce();
    let secondKeys = keyNames;
    if (profile === 'promote') {
      await measure('promote', () => {
        for (const { rows, handles } of held) {
          for (let i = 0; i < rowCount; i++) {
            rows.updateOne(String(i), { extra: -1 });
            assert.equal(handles[i]().extra, -1);
            assert.equal(Object.keys(handles[i]()).length, width + 1);
          }
        }
        return treeCount * rowCount;
      });
      secondKeys = [...keyNames, 'extra'];
      out.heap.promoted = await quiesce();
    }
    await measure('second', () => edit(held, secondKeys, rounds));
    // Each field is exercised in the narrow second phase. Wider rows retain
    // zeroes for fields neither phase touched.
    verify(held, secondKeys, rounds);
    out.heap.second = await quiesce();
  } finally {
    release(held);
  }
  return weak;
}
const weak = await run();
out.heap.destroyed = await quiesce();
out.weakAlive = weak.filter(ref => ref.deref() !== undefined).length;
out.end = env();
writeFileSync(output, JSON.stringify(out, null, 2));
assert.equal(out.weakAlive, 0);
