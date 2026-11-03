import assert from 'node:assert/strict';
import { signalTree, entityMap, transactions } from '@signal-tree/kernel';
import { peekInternalTransactionRuntime } from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import { hasOpenCommitScope } from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';

const control = process.argv[2] ?? 'suite';
assert.ok(['suite', 'normal', 'capture-fault'].includes(control));
const scenarios = [
  { name: 'empty', seed: [], mutate: (rows) => rows.addOne({ id: 'N', v: 1 }), after: ['N'] },
  { name: 'zero-tail-key', seed: [{ id: 0, v: 0 }], mutate: (rows) => rows.addOne({ id: 1, v: 1 }), after: [0, 1] },
  { name: 'empty-string-tail-key', seed: [{ id: '', v: 0 }], mutate: (rows) => rows.addOne({ id: 'N', v: 1 }), after: ['', 'N'] },
  { name: 'multiple-fresh', seed: [{ id: 'A', v: 0 }], mutate: (rows) => rows.addMany([{ id: 'N', v: 1 }, { id: 'M', v: 2 }]), after: ['A', 'N', 'M'] },
  { name: 'set-all-removes-tail-adds-fresh', seed: [{ id: 'A', v: 0 }, { id: 'T', v: 0 }], mutate: (rows) => rows.setAll([{ id: 'A', v: 0 }, { id: 'N', v: 1 }, { id: 'M', v: 2 }]), after: ['A', 'N', 'M'] },
  { name: 'rekeyed-tail', seed: [{ id: 'A', v: 0 }, { id: 'T', v: 0 }], prepare: (rows) => rows.changeId('T', 'X'), mutate: (rows) => rows.addOne({ id: 'N', v: 1 }), after: ['A', 'X', 'N'], heldKey: 'X' },
  { name: 'reused-tail-new-lifetime', seed: [{ id: 'A', v: 0 }, { id: 'T', v: 0 }], prepare: (rows) => { rows.removeOne('T'); rows.addOne({ id: 'T', v: 9 }); }, mutate: (rows) => rows.addOne({ id: 'N', v: 1 }), after: ['A', 'T', 'N'], reused: true },
  { name: 'new-lifetime-and-fresh-in-one-turn', seed: [{ id: 'A', v: 0 }, { id: 'T', v: 0 }], mutate: (rows) => { rows.removeOne('T'); rows.addOne({ id: 'T', v: 9 }); rows.addOne({ id: 'N', v: 1 }); }, after: ['A', 'T', 'N'], replacedInTurn: true },
];
const output = { control, results: [] };
for (const fault of control === 'suite' ? [false, true] : [control === 'capture-fault']) {
  for (const scenario of scenarios) {
    for (const settlement of ['rollback', 'confirm']) {
      const trace = { scenario: scenario.name, fault, settlement, captureHits: 0, checks: [] };
      output.results.push(trace);
      let tree;
      const check = (name, run) => {
        try { run(); trace.checks.push({ name, pass: true }); }
        catch (error) { trace.checks.push({ name, pass: false, error: error.stack }); process.exitCode = 1; }
      };
      try {
        tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) }, { enhancers: [transactions()] });
        const rows = tree.$.rows;
        rows.setAll(scenario.seed);
        const oldTail = rows.byId('T');
        scenario.prepare?.(rows);
        const before = { ids: [...rows.ids()], all: rows.all().map((row) => ({ ...row })) };
        const beforeHeld = new Map(before.ids.map((id) => [id, rows.byIdOrFail(id)]));
        if (scenario.reused) {
          assert.notEqual(rows.byIdOrFail('T'), oldTail);
          assert.notEqual(oldTail()?.v, 9);
        }
        if (scenario.heldKey) assert.equal(rows.byIdOrFail(scenario.heldKey), oldTail);
        const state = () => ({ ids: [...rows.ids()], all: rows.all().map((row) => ({ ...row })), pending: peekInternalTransactionRuntime(tree).getPendingTurnCount(), scope: hasOpenCommitScope(tree) });
        if (fault) globalThis.__entityCaptureProbe = (_path, _next, _prev, subjects) => {
          if (subjects?.length) { trace.captureHits++; throw new Error('controlled rich entity capture failure'); }
        };
        const pending = tree.transact(() => scenario.mutate(rows));
        delete globalThis.__entityCaptureProbe;
        trace.before = before;
        trace.speculative = state();
        check('useful authored membership and responsibility', () => {
          assert.deepEqual(trace.speculative.ids, scenario.after);
          assert.equal(trace.speculative.pending, 1);
          assert.equal(trace.speculative.scope, true);
          assert.notDeepEqual(trace.speculative.ids, before.ids);
          if (fault) assert.ok(trace.captureHits > 0);
        });
        let error;
        let threw = false;
        try { pending[settlement](); } catch (caught) { threw = true; error = caught; }
        trace.settlementResult = { threw, code: error?.code, message: error?.message };
        trace.after = state();
        check('settlement completes exact authored disposition', () => {
          assert.equal(threw, false);
          assert.deepEqual(trace.after, { ...(settlement === 'rollback' ? before : { ids: trace.speculative.ids, all: trace.speculative.all }), pending: 0, scope: false });
        });
        check('held lifetime behavior', () => {
          if (settlement === 'rollback') {
            for (const [id, held] of beforeHeld) {
              assert.equal(rows.byIdOrFail(id), held);
              assert.deepEqual(held(), before.all[before.ids.indexOf(id)]);
            }
          }
          if (scenario.reused || (scenario.replacedInTurn && settlement === 'confirm')) {
            assert.notEqual(rows.byIdOrFail('T'), oldTail);
            assert.notEqual(oldTail()?.v, 9);
          }
        });
        let retryError;
        let retryThrew = false;
        try { pending[settlement](); } catch (caught) { retryThrew = true; retryError = caught; }
        trace.retry = { threw: retryThrew, code: retryError?.code, state: state() };
        check('terminal retry does not mutate', () => { assert.equal(retryThrew, false); assert.deepEqual(trace.retry.state, trace.after); });
        trace.status = trace.checks.every((item) => item.pass) ? 'pass' : 'fail';
      } catch (error) { trace.status = 'fixture-error'; trace.error = error?.stack ?? String(error); process.exitCode = 1; }
      finally { delete globalThis.__entityCaptureProbe; tree?.destroy(); }
    }
  }
}
console.log(JSON.stringify(output, null, 2));
