// Attribution only: hold the same rows, then progressively demand field carriers.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { quiesce } from '../lib/heap-quiescence.mjs';

globalThis.ngDevMode = false;
const [dist, output] = process.argv.slice(2);
const { signalTree, entityMap } = await import(pathToFileURL(dist + '/index.js').href);
const fields = Array.from({ length: 31 }, (_, i) => 'f' + i);
const result = { width: 32, trees: 6, rows: 512, heap: {}, metrics: {} };
async function phase(name, work) {
  const cpu = process.cpuUsage();
  const start = performance.now();
  work();
  const usage = process.cpuUsage(cpu);
  result.metrics[name] = { wallMs: performance.now() - start, cpuMs: (usage.user + usage.system) / 1000 };
  result.heap[name] = await quiesce({ label: name });
}
async function run() {
  result.heap.baseline = await quiesce();
  const held = [];
  await phase('cold', () => {
    for (let t = 0; t < result.trees; t++) {
      const tree = signalTree({ rows: entityMap() });
      tree.$.rows.setAll(Array.from({ length: result.rows }, (_, i) =>
        Object.fromEntries([['id', String(i)], ...fields.map(key => [key, 0])])));
      assert.equal(tree.$.rows.count(), result.rows);
      held.push({ tree, handles: [], first: [] });
    }
  });
  const refs = held.map(({ tree }) => new WeakRef(tree));
  try {
    await phase('handles', () => {
      for (const fixture of held) {
        fixture.handles = Array.from({ length: result.rows }, (_, i) => fixture.tree.$.rows.byIdOrFail(String(i)));
        for (const handle of fixture.handles) {
          const descriptors = Object.getOwnPropertyDescriptors(handle);
          for (const key of ['id', ...fields]) {
            assert.equal(typeof descriptors[key].get, 'function');
            assert.equal(descriptors[key].enumerable, true);
            assert.equal(descriptors[key].configurable, true);
          }
        }
      }
    });
    await phase('whole', () => {
      for (const { handles } of held) for (let i = 0; i < handles.length; i++) {
        const row = handles[i]();
        assert.equal(row.id, String(i));
        for (const key of fields) assert.equal(row[key], 0);
      }
    });
    await phase('edited', () => {
      for (let round = 1; round <= 12; round++) {
        const key = fields[(round - 1) % fields.length];
        for (const { tree, handles } of held) for (let i = 0; i < handles.length; i++) {
          tree.$.rows.updateOne(String(i), { [key]: round });
          assert.equal(handles[i]()[key], round);
        }
      }
    });
    await phase('oneField', () => {
      for (const fixture of held) for (const handle of fixture.handles) {
        const field = handle.f0;
        assert.equal(field(), 1);
        assert.equal(handle.f0, field);
        fixture.first.push(field);
      }
    });
    await phase('allFields', () => {
      for (const { handles } of held) for (let i = 0; i < handles.length; i++) {
        const handle = handles[i];
        assert.equal(handle.id(), String(i));
        for (let k = 0; k < fields.length; k++) {
          const carrier = handle[fields[k]];
          assert.equal(carrier(), k < 12 ? k + 1 : 0);
          assert.equal(handle[fields[k]], carrier);
        }
      }
    });
    await phase('allFieldsEdited', () => {
      for (const { tree, handles, first } of held) for (let i = 0; i < handles.length; i++) {
        tree.$.rows.updateOne(String(i), { f0: 99 });
        assert.equal(first[i](), 99);
        assert.equal(handles[i].f0, first[i]);
      }
    });
    for (const { handles, first } of held) refs.push(new WeakRef(handles[0]), new WeakRef(first[0]));
  } finally {
    for (const { tree } of held) tree.destroy();
  }
  return refs;
}
const refs = await run();
result.heap.destroyed = await quiesce();
result.collected = refs.map(ref => ref.deref() === undefined);
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
assert.ok(result.collected.length === 18 && result.collected.every(Boolean));
