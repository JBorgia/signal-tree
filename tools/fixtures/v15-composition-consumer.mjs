/** Run unchanged against an installed npm artifact or a freshly packed candidate. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const [entry] = process.argv.slice(2);
assert.ok(entry, 'An installed kernel entry path is required');
const { signalTree, entityMap, transactions, restoration, batching, undoable, external, link } =
  await import(pathToFileURL(entry).href);
const { observeWrites, treeRuntimeId } = await import(pathToFileURL(join(dirname(entry), 'internals.js')).href);
const cases = [];
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const check = async (name, run) => {
  try { await run(); cases.push({ name, status: 'passed' }); }
  catch (error) { cases.push({ name, status: 'failed', error: String(error) }); }
};

await check('literal dotted branch field remains distinct through Link', async () => {
  const tree = signalTree({ data: { 'a.b': 0, a: { b: 10 } } });
  const sent = [];
  const connection = link(tree.$.data, { set: value => { sent.push(value); } });
  try {
    tree.$.data['a.b'](1);
    tree.$.data.a.b(11);
    await connection.settled();
    assert.deepEqual(sent.at(-1), { 'a.b': 1, a: { b: 11 } });
  } finally { connection.dispose(); tree.destroy(); }
});

for (const id of ['jo.doe@example.com', '1.2.3', 1, '1']) {
  await check(`entity rollback preserves exact keys (${typeof id}:${id})`, async () => {
    const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions()] });
    try {
      const original = { id, 'a.b': 0, a: { b: 10 } };
      tree.$.rows.addOne(original); await tick();
      const pending = tree.transaction(() => tree.$.rows.updateOne(id, { 'a.b': 1, a: { b: 11 } }));
      pending.rollback();
      assert.deepEqual(tree.$.rows.byIdOrFail(id)(), original);
    } finally { tree.destroy(); }
  });
}

await check('outer coalesce retains transaction settlement authority', async () => {
  const tree = signalTree({ n: 0 }, { enhancers: [batching(), transactions()] });
  try {
    let pending;
    tree.coalesce(() => { pending = tree.transaction(() => tree.$.n(1)); });
    assert.equal(tree.$.n(), 1);
    pending.rollback();
    assert.equal(tree.$.n(), 0);
  } finally { tree.destroy(); }
});

await check('external classification survives deferred undo designation', async () => {
  const tree = signalTree({ n: 0 }, { enhancers: [batching(), restoration()] });
  const frames = [];
  const owner = treeRuntimeId(tree);
  const stop = observeWrites(frame => { if (frame.ownerId === owner) frames.push(frame); });
  try {
    tree.coalesce(() => undoable(() => external(() => tree.$.n(2))));
    await tick();
    assert.equal(tree.$.n(), 2);
    assert.equal(tree.canUndo(), false);
    assert.equal(frames.length, 1, 'The classification assertion must observe a real write');
    assert.equal(frames[0].participation, 'realized');
  } finally { stop(); tree.destroy(); }
});

await check('undo and redo reach a linked collection with correct membership', async () => {
  const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions(), restoration()] });
  tree.$.rows.setAll([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]); await tick();
  const sent = [];
  const connection = link(tree.$.rows, { set: value => { sent.push(value); } });
  try {
    undoable(() => tree.$.rows.removeOne('b')); await connection.settled();
    assert.deepEqual(sent.at(-1), [{ id: 'a', n: 1 }]);
    tree.undo(); await connection.settled();
    assert.deepEqual(sent.at(-1), [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
    tree.redo(); await connection.settled();
    assert.deepEqual(sent.at(-1), [{ id: 'a', n: 1 }]);
    assert.equal(sent.length, 3);
  } finally { connection.dispose(); tree.destroy(); }
});

await check('whole-branch omission rollback restores presence and value', async () => {
  const tree = signalTree({ profile: { name: 'Ada', age: 42 } }, { enhancers: [transactions()] });
  try {
    const retained = tree.$.profile.age;
    const pending = tree.transaction(() => tree.$.profile({ name: 'Grace' }));
    assert.deepEqual(tree.$.profile(), { name: 'Grace' });
    pending.rollback();
    assert.deepEqual(tree.$.profile(), { name: 'Ada', age: 42 });
    assert.equal(tree.$.profile.age, retained);
  } finally { tree.destroy(); }
});

const failed = cases.filter(test => test.status === 'failed').length;
console.log(JSON.stringify({ entry, passed: cases.length - failed, failed, cases }, null, 2));
process.exitCode = failed === 0 ? 0 : 1;
