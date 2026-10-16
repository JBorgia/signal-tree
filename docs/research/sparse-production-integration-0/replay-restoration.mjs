// Permanent unchanged ordinary-input acceptance test; run against a fresh built kernel.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const [repo] = process.argv.slice(2);
const { signalTree, transactions, restoration, undoable, entityMap } = await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/index.js`));
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const observations = [];
for (const entity of [false, true]) {
  const t = signalTree({ x: 0, rows: entityMap({ selectId: r => r.id }) }, { enhancers: [transactions(), restoration()] });
  try {
    t.$.rows.addOne({ id: 'A', n: 0 }); await flush();
    const read = () => entity ? t.$.rows.byId('A')()?.n : t.$.x();
    const write = n => entity ? t.$.rows.updateOne('A', { n }) : t.$.x(n);
    write(1); await flush();
    undoable(() => write(2)); await flush();
    t.undo(); await flush();
    const afterUndo = read();
    const pending = t.transact(() => write(3)); await flush();
    const afterWrite = read();
    pending.rollback(); const afterReject = read();
    pending.rollback(); const afterRetry = read();
    observations.push({ entity, afterUndo, afterWrite, afterReject, afterRetry });
  } finally { t.destroy(); }
}
console.log(JSON.stringify(observations, null, 2));
assert.deepEqual(observations, [false, true].map(entity => ({ entity, afterUndo: 1, afterWrite: 3, afterReject: 1, afterRetry: 1 })));
