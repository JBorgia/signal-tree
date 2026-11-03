import assert from 'node:assert/strict';
import { entityMap, signalTree, transactions, undoable, restoration } from '@signal-tree/kernel';
import { getPathNotifier } from '@proof/packages/kernel/src/lib/path-notifier.ts';
import { peekInternalTransactionRuntime } from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import { StructuralStore } from '@proof/packages/kernel/src/lib/physical/structural-store.ts';

const control = process.argv[2] ?? 'suite';
assert.equal(control, 'suite');
const output = { faultInjection: false, results: [] };
for (const scenario of ['reversed', 'before']) {
  const trace = { scenario, placementCalls: [], checks: [] };
  output.results.push(trace);
  let tree;
  const original = StructuralStore.prototype.resolveSubjectRestorePlacement;
  let observing = false;
  const check = (name, run) => {
    try { run(); trace.checks.push({ name, pass: true }); }
    catch (error) { trace.checks.push({ name, pass: false, error: error.stack }); process.exitCode = 1; }
  };
  const attempt = (run) => {
    try { run(); return { threw: false }; }
    catch (error) { return { threw: true, code: error?.code, message: error?.message }; }
  };
  try {
    // Read-only diagnostic wrapper: original receives identical arguments and
    // determines placement; neither inputs nor result are altered.
    StructuralStore.prototype.resolveSubjectRestorePlacement = function (...args) {
      const resolved = original.apply(this, args);
      if (observing) trace.placementCalls.push({ args, resolved: { ...resolved }, stack: new Error().stack });
      return resolved;
    };
    tree = signalTree({ scalar: 0, rows: entityMap() }, { enhancers: [restoration(), transactions()] });
    const rows = tree.$.rows;
    rows.addMany(['a', 'b', 'c'].map((id) => ({ id })));
    getPathNotifier().flushSync();
    const held = rows.byIdOrFail('b');
    const pending = tree.transact(() => undoable(() => { tree.$.scalar(1); rows.removeOne('b'); }));
    const runtime = peekInternalTransactionRuntime(tree);
    const turnId = runtime.getPendingTurnIds()[0];
    const effects = () => runtime.describePendingTurn(turnId)?.effects;
    trace.capturedEffects = effects();
    const state = () => ({ scalar: tree.$.scalar(), ids: [...rows.ids()], pending: runtime.getPendingTurnCount(), held: held() });
    trace.speculative = state();
    check('useful scalar and removal contribution', () => {
      assert.equal(trace.speculative.scalar, 1);
      assert.deepEqual(trace.speculative.ids, ['a', 'c']);
      assert.equal(trace.speculative.pending, 1);
    });
    undoable(() => {
      if (scenario === 'reversed') rows.setAll([{ id: 'c' }, { id: 'a' }]);
      else rows.removeOne('c');
    });
    getPathNotifier().flushSync();
    trace.beforeRollback = state();
    trace.retainedEffects = effects();
    observing = true;
    trace.rollback = attempt(() => pending.rollback());
    observing = false;
    getPathNotifier().flushSync();
    trace.after = state();
    const expected = scenario === 'reversed' ? ['b', 'c', 'a'] : ['a', 'b'];
    check('unchanged rollback succeeds', () => assert.equal(trace.rollback.threw, false));
    check('unchanged placement assertion', () => assert.deepEqual(rows.ids(), expected));
    check('unchanged held lifetime assertion', () => assert.equal(rows.byIdOrFail('b'), held));
    check('unchanged scalar and retirement assertions', () => { assert.equal(tree.$.scalar(), 0); assert.equal(runtime.getPendingTurnCount(), 0); });
    trace.retry = attempt(() => pending.rollback());
    getPathNotifier().flushSync();
    trace.afterRetry = state();
    check('terminal retry does not mutate', () => { assert.equal(trace.retry.threw, false); assert.deepEqual(trace.afterRetry, trace.after); });
    trace.status = trace.checks.every((item) => item.pass) ? 'pass' : 'fail';
  } catch (error) { trace.status = 'fixture-error'; trace.error = error?.stack ?? String(error); process.exitCode = 1; }
  finally { StructuralStore.prototype.resolveSubjectRestorePlacement = original; tree?.destroy(); getPathNotifier().flushSync(); }
}
console.log(JSON.stringify(output, null, 2));
