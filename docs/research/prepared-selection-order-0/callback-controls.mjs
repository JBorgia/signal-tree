import assert from 'node:assert/strict';
import { nextTick, watchEffect } from 'vue';
import { createSignalTreeFactory } from '@signal-tree/kernel/adapter';
import { entityMap, transactions } from '@signal-tree/kernel';
import { createVueObservationAdapter } from '@proof/packages/vue/src/lib/vue-observation.ts';
import { peekInternalTransactionRuntime } from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import { hasOpenCommitScope } from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';

// Inputs use only public tree, transaction, tap, and Vue APIs. Internal queries
// below observe pending authority/scope; they never change implementation state.
// Callback-failure oracle: rollback retires a physically committed compensation
// before rethrowing applicationFailureCause (transactions.ts rollback). Replay
// taps are post-install observers; their nested writes are ordinary writes
// (entity-replay-tap-boundaries.spec.ts). L13 requires coherent delivery; L14
// requires a terminal retry to be nonmutating. No held/native-computed freshness
// assertion is made inside the authored callback or replay tap.
const mode = process.argv[2] ?? 'C';
const modes = new Set(['C', 'C-then-X', 'C-then-A', 'nestedwrites', 'callbackthrows', 'callbackthrows-undefined', 'removedselectedrows']);
assert.ok(modes.has(mode), `Unknown callback control ${mode}`);
const trace = { mode, taps: [], observers: [], checks: [] };
const marker = mode === 'callbackthrows-undefined' ? undefined : new Error('replay callback first failure');
let tree;
let stop;
let untap;
let phase = 'setup';
let armed = false;
let callbacks = 0;
const attempt = (run) => {
  try { run(); return { threw: false }; }
  catch (error) { return { threw: true, marker: error === marker, undefined: error === undefined, code: error?.code, message: error?.message }; }
};
const read = () => {
  const rows = tree.$.rows;
  const activeId = rows.activeId();
  return {
    scalar: tree.$.scalar(),
    ids: [...rows.ids()],
    all: rows.all().map((row) => ({ ...row })),
    count: rows.count(),
    empty: rows.empty(),
    map: [...rows.asMap()].map(([key, row]) => [key, { ...row }]),
    activeId: activeId ?? null,
    active: rows.activeEntity()?.v ?? null,
    directActive: activeId === undefined ? null : rows.byId(activeId)?.()?.v ?? null,
    directA: rows.byId('A')?.()?.v ?? null,
    directC: rows.byId('C')?.()?.v ?? null,
    pending: peekInternalTransactionRuntime(tree).getPendingTurnCount(),
    scope: hasOpenCommitScope(tree),
  };
};
const check = (name, run) => {
  try { run(); trace.checks.push({ name, pass: true }); }
  catch (error) { trace.checks.push({ name, pass: false, error: error.stack }); process.exitCode = 1; }
};
try {
  tree = createSignalTreeFactory(createVueObservationAdapter())({
    scalar: 0,
    rows: entityMap({ selectId: (row) => row.id }),
  }, { enhancers: [transactions()] });
  const rows = tree.$.rows;
  rows.setAll([{ id: 'A', v: 0 }, { id: 'C', v: 0 }]);
  rows.setActiveId('A');
  const heldA = rows.byIdOrFail('A');
  untap = rows.tap({ onRemove: (id) => {
    trace.taps.push({ phase, id, selection: rows.activeId(), ids: [...rows.ids()] });
    if (!armed || id !== 'D') return;
    callbacks++;
    rows.setActiveId('C');
    if (mode === 'C-then-X') rows.setActiveId('X');
    if (mode === 'C-then-A') rows.setActiveId('A');
    if (mode === 'nestedwrites') { tree.$.scalar.set(9); rows.updateOne('C', { v: 9 }); }
    if (mode === 'removedselectedrows') rows.removeOne('C');
    if (mode.startsWith('callbackthrows')) throw marker;
  } });
  stop = watchEffect(() => {
    const snapshot = read();
    trace.observers.push({ phase, ...snapshot });
  }, { flush: 'sync' });
  const pending = tree.transact(() => {
    tree.$.scalar.set(1);
    rows.changeId('A', 'X');
    rows.addOne({ id: 'D', v: 0 });
  });
  await nextTick();
  trace.speculative = read();
  check('useful speculative contribution', () => {
    assert.equal(trace.speculative.scalar, 1);
    assert.deepEqual(trace.speculative.ids, ['X', 'C', 'D']);
    assert.equal(trace.speculative.activeId, 'X');
    assert.equal(trace.speculative.pending, 1);
  });
  armed = true;
  phase = 'rollback';
  trace.rollback = attempt(() => pending.rollback());
  phase = 'after-rollback';
  await nextTick();
  trace.after = read();
  const tapCountBeforeRetry = callbacks;
  phase = 'retry';
  trace.retry = attempt(() => pending.rollback());
  await nextTick();
  trace.afterRetry = read();
  trace.callbackCount = callbacks;
  const selected = mode === 'C-then-X' ? 'X' : mode === 'C-then-A' ? 'A' : 'C';
  const expectedRows = [{ id: 'A', v: 0 }];
  if (mode !== 'removedselectedrows') expectedRows.push({ id: 'C', v: mode === 'nestedwrites' ? 9 : 0 });
  const active = expectedRows.find((row) => row.id === selected)?.v ?? null;
  const expected = {
    scalar: mode === 'nestedwrites' ? 9 : 0,
    ids: expectedRows.map((row) => row.id), all: expectedRows,
    count: expectedRows.length, empty: false,
    map: expectedRows.map((row) => [row.id, row]),
    activeId: selected, active, directActive: active,
    directA: 0, directC: mode === 'removedselectedrows' ? null : mode === 'nestedwrites' ? 9 : 0,
    pending: 0, scope: false,
  };
  check('callback executed exactly once', () => assert.equal(callbacks, 1));
  check('postcommit first-failure semantics', () => {
    assert.equal(trace.rollback.threw, mode.startsWith('callbackthrows'));
    if (mode.startsWith('callbackthrows')) assert.equal(trace.rollback.marker, true);
  });
  check('complete disposition preserves callback truth', () => assert.deepEqual(trace.after, expected));
  check('successful terminal retry is nonmutating', () => {
    assert.equal(trace.retry.threw, false);
    assert.deepEqual(trace.afterRetry, trace.after);
    assert.equal(callbacks, tapCountBeforeRetry);
  });
  check('held lifetime never retargeted', () => {
    assert.equal(rows.byIdOrFail('A'), heldA);
    assert.equal(heldA().v, 0);
  });
  check('owned projections coherent in settlement observers', () => {
    const delivered = trace.observers.filter((entry) => entry.phase === 'rollback' || entry.phase === 'after-rollback');
    assert.ok(delivered.length > 0, 'settlement must publish useful observer frames');
    // Authority may retire after synchronous delivery; compare visible state
    // here, then assert terminal authority/scope separately in final disposition.
    const { pending: ignoredPending, scope: ignoredScope, ...visibleExpected } = expected;
    for (const entry of delivered) {
      const { phase: ignoredPhase, pending: ignoredPendingFrame, scope: ignoredScopeFrame, ...visible } = entry;
      assert.deepEqual(visible, visibleExpected);
    }
  });
  trace.status = trace.checks.every((entry) => entry.pass) ? 'pass' : 'fail';
} catch (error) {
  trace.status = 'fixture-error';
  trace.error = error.stack;
  process.exitCode = 1;
} finally {
  stop?.();
  untap?.();
  tree?.destroy();
}
console.log(JSON.stringify(trace, null, 2));
