import { assert, set, value, snap, settled, pending, terminal, refusalUnchanged } from './assertions.mjs';

// MODEL-LEVEL tests of PROTOCOL.md, traced to the frozen SEMANTICS-2 matrix/laws.
// These are NOT actual SignalTree link/batching/restoration composition tests.
// Run with fresh default-seeded adapters; the runner owns creation/destruction.
// Run the same functional cases with diagnostics false and true where selectable;
// a default-only adapter supplies default-only evidence, not an on/off comparison.
// stats() is instrumentation of correctness retention, NOT a semantic black-box
// memory measurement. No heap/MB claim follows. Optional diagnostic history may
// be nonzero; this protocol specifies neither a history cap nor its eviction API.
// Deferred write records model captured context. Nested callbacks, deferred
// begin(), deferred undo(), and real framework scheduling are outside this API.

const both = ['live', 'draft'];
const live = ['live'];
const cases = [];
const add = (id, family, profiles, run) => cases.push({ id, family, profiles, run });

function counters(c) {
  const s = c.stats();
  for (const key of ['active', 'retainedOperations', 'history']) {
    assert.ok(Number.isSafeInteger(s[key]) && s[key] >= 0, `invalid stats.${key}`);
  }
  return s;
}

function noGrowth(c, baseline) {
  const now = counters(c);
  assert.equal(now.active, baseline.active, 'active correctness records grew');
  assert.equal(now.retainedOperations, baseline.retainedOperations, 'retained operations grew');
}

for (const [id, method, status] of [
  ['R01', 'accept', 'accepted'],
  ['R02', 'reject', 'rejected'],
]) {
  add(`${id}-50000-without-undo-history`, 'retention', both, c => {
    const base = counters(c);
    assert.equal(base.active, 0);
    for (let i = 1; i <= 50_000; i++) {
      const p = c.begin([set('x', i)]);
      pending(c, p);
      const during = counters(c);
      assert.equal(during.active, 1, `iteration ${i}: one live responsibility`);
      // Fixed one-location workload: allow one canonical frontier record in
      // addition to the pending operation, never a record per terminal unit.
      assert.ok(during.retainedOperations <= base.retainedOperations + 2);
      settled(c[method](p));
      terminal(c, p, status);
      assert.equal(value(c.read(), 'x'), method === 'accept' ? i : 0);
      assert.equal(value(c.canonical(), 'x'), method === 'accept' ? i : 0);
      const after = counters(c);
      assert.equal(after.active, 0, `iteration ${i}: terminal unit remains active`);
      assert.ok(after.retainedOperations <= base.retainedOperations + 1,
        `iteration ${i}: terminal operation accumulation`);
    }
    // No undoable writes were requested. Diagnostic evidence is deliberately
    // not required to report history === 0 when diagnostics are enabled.
  });
}

add('R03-failed-retry-no-growth', 'retention', live, c => {
  const p = c.begin([{ kind: 'rekey', ref: 'original', key: 'B' }]);
  settled(c.write([{ kind: 'add', ref: 'occupant', key: 'A', fields: { name: 'Other', priority: 0 } }], { context: 'local' }));
  const before = counters(c);
  const state = structuredClone(c.state(p));
  for (let i = 0; i < 1_000; i++) {
    refusalUnchanged(c, p, () => c.reject(p));
    assert.deepEqual(c.state(p), state);
    noGrowth(c, before);
  }
  settled(c.write([{ kind: 'remove', ref: 'occupant' }], { context: 'local' }));
  settled(c.reject(p));
  terminal(c, p, 'rejected');
  assert.equal(counters(c).active, 0);
  assert.equal(c.read().entities.find(e => e.ref === 'original')?.key, 'A');
});

add('R04-terminal-records-leave-active-machinery', 'retention', both, c => {
  const a = c.begin([set('x', 1)]);
  const b = c.begin([set('y', 2)]);
  assert.equal(counters(c).active, 2);
  settled(c.accept(a));
  terminal(c, a, 'accepted');
  pending(c, b);
  assert.equal(counters(c).active, 1);
  settled(c.reject(b));
  terminal(c, b, 'rejected');
  assert.equal(counters(c).active, 0);
  assert.equal(value(c.read(), 'x'), 1);
  assert.equal(value(c.read(), 'y'), 0);
});

add('R05-destroy-releases-pending-machinery', 'retention', both, c => {
  c.begin([set('x', 1), set('y', 2)]);
  c.begin([set('z', 3)]);
  assert.equal(counters(c).active, 2);
  assert.ok(counters(c).retainedOperations > 0);
  c.destroy();
  // stats() after destruction is the model's release instrumentation. No
  // post-destroy read/write/settle behavior is invented by this case.
  const after = counters(c);
  assert.equal(after.active, 0);
  assert.equal(after.retainedOperations, 0);
});

add('R06-diagnostics-independent-functional-trace', 'retention', both, c => {
  // Identical expected trace for either diagnostics setting, including default.
  // Intentionally no stats() assertions: diagnostic evidence is not correctness.
  const a = c.begin([set('x', 1)]);
  const b = c.begin([set('x', 2)]);
  settled(c.accept(b));
  terminal(c, b, 'accepted');
  pending(c, a);
  assert.equal(value(c.read(), 'x'), 2);
  assert.equal(value(c.canonical(), 'x'), 2);
  settled(c.reject(a));
  terminal(c, a, 'rejected');
  assert.equal(value(c.read(), 'x'), 2);
  const d = c.begin([set('y', 3)]);
  settled(c.reject(d));
  terminal(c, d, 'rejected');
  assert.equal(value(c.read(), 'y'), 0);
});

function watch(c, path) {
  const events = [];
  const off = c.link([path], v => events.push(v));
  // PROTOCOL specifies no initial callback for observe, but not for link.
  events.length = 0;
  return { events, off };
}

add('N01-N03-pending-x-repeated-independent-y', 'progress', live, c => {
  const x = watch(c, 'x');
  const y = watch(c, 'y');
  try {
    const p = c.begin([set('x', 1)]);
    assert.deepEqual(x.events, [], 'pending x must not synchronize');
    for (let i = 1; i <= 100; i++) {
      const count = y.events.length;
      settled(c.write([set('y', i)], { context: 'local' }));
      assert.ok(y.events.length > count, `y=${i} blocked by pending x`);
      assert.equal(y.events.at(-1), i);
      assert.equal(value(c.read(), 'y'), i);
      assert.equal(value(c.read(), 'x'), 1);
      pending(c, p);
      assert.deepEqual(x.events, []);
    }
    settled(c.reject(p));
    assert.equal(value(c.read(), 'y'), 100);
  } finally {
    x.off(); y.off();
  }
});

add('N02-failed-x-settlement-does-not-block-y', 'progress', live, c => {
  const y = watch(c, 'y');
  try {
    const p = c.begin([set('x', 1), { kind: 'rekey', ref: 'original', key: 'B' }]);
    settled(c.write([{ kind: 'add', ref: 'occupant', key: 'A', fields: { name: 'Other', priority: 0 } }], { context: 'local' }));
    for (let i = 1; i <= 20; i++) {
      refusalUnchanged(c, p, () => c.reject(p));
      const count = y.events.length;
      settled(c.write([set('y', i)], { context: 'local' }));
      assert.ok(y.events.length > count);
      assert.equal(y.events.at(-1), i);
      assert.equal(value(c.read(), 'x'), 1);
      pending(c, p);
    }
  } finally { y.off(); }
});

add('N04-N05-multiple-links-independent-settlement', 'progress', live, c => {
  const x = watch(c, 'x');
  const y1 = watch(c, 'y');
  const y2 = watch(c, 'y');
  const z = watch(c, 'z');
  try {
    const px = c.begin([set('x', 1)]);
    const py = c.begin([set('y', 2)]);
    assert.deepEqual(x.events, []);
    assert.deepEqual(y1.events, []);
    assert.deepEqual(y2.events, []);
    settled(c.write([set('z', 3)], { context: 'local' }));
    assert.equal(z.events.at(-1), 3);
    settled(c.accept(py));
    assert.equal(y1.events.at(-1), 2);
    assert.equal(y2.events.at(-1), 2);
    pending(c, px);
    assert.deepEqual(x.events, []);
    for (let i = 3; i <= 10; i++) {
      settled(c.write([set('y', i), set('z', i + 10)], { context: 'local' }));
      assert.equal(y1.events.at(-1), i);
      assert.equal(y2.events.at(-1), i);
      assert.equal(z.events.at(-1), i + 10);
      pending(c, px);
    }
  } finally { x.off(); y1.off(); y2.off(); z.off(); }
});

// Unsupported is evidence, never a conformance pass. Check both immediate
// atomicity and the next flush before propagating it to the runner. A queued
// mutation concealed behind refusal therefore fails instead of being skipped.
function deferred(c, ops, context, ids = [], afterUnsupportedFlush) {
  const before = snap(c.read());
  const canonical = snap(c.canonical());
  const states = ids.map(id => structuredClone(c.state(id)));
  const events = [];
  const off = c.observe(s => events.push(snap(s)));
  try {
    let result;
    let unsupported;
    try { result = c.write(ops, { context, defer: true }); }
    catch (error) {
      if (error?.name !== 'Unsupported') throw error;
      unsupported = error;
    }
    if (unsupported || result?.status === 'unsupported') {
      assert.equal(snap(c.read()), before);
      assert.equal(snap(c.canonical()), canonical);
      ids.forEach((id, i) => assert.deepEqual(c.state(id), states[i]));
      assert.deepEqual(events, []);
      c.flush();
      if (afterUnsupportedFlush) afterUnsupportedFlush(events);
      else {
        assert.equal(snap(c.read()), before);
        assert.equal(snap(c.canonical()), canonical);
        assert.deepEqual(events, []);
      }
      ids.forEach((id, i) => assert.deepEqual(c.state(id), states[i]));
      throw unsupported ?? Object.assign(new Error(result.reason ?? 'Deferred context unsupported'), { name: 'Unsupported' });
    }
    settled(result); // Generic 'refused' is NOT an explicit unsupported capability.
  } finally { off(); }
}

for (const defer of [false, true]) {
  const mode = defer ? 'deferred' : 'direct';
  add(`CCTX1-external-${mode}-preserves-pending`, 'context', live, c => {
    const p = c.begin([set('x', 1)]);
    if (defer) deferred(c, [set('x', 2)], 'external', [p]);
    else settled(c.write([set('x', 2)], { context: 'external' }));
    c.flush();
    pending(c, p);
    assert.equal(value(c.canonical(), 'x'), 2);
    assert.equal(value(c.read(), 'x'), 1);
    settled(c.reject(p));
    assert.equal(value(c.read(), 'x'), 2);
  });

  add(`CCTX1-external-${mode}-does-not-become-undoable`, 'context', both, c => {
    settled(c.write([set('y', 5)], { context: 'undoable' }));
    if (defer) deferred(c, [set('x', 2)], 'external');
    else settled(c.write([set('x', 2)], { context: 'external' }));
    c.flush();
    assert.equal(value(c.read(), 'x'), 2);
    assert.equal(value(c.read(), 'y'), 5);
    settled(c.undo());
    assert.equal(value(c.read(), 'x'), 2, 'external truth is not an undo record');
    assert.equal(value(c.read(), 'y'), 0, 'undo must reach the authored write');
    assert.equal(snap(c.read()), snap(c.canonical()));
  });

  add(`CCTX3-undoable-${mode}-restores-own-write`, 'context', both, c => {
    settled(c.write([set('x', 7)], { context: 'external' }));
    if (defer) deferred(c, [set('x', 8), set('y', 9)], 'undoable');
    else settled(c.write([set('x', 8), set('y', 9)], { context: 'undoable' }));
    c.flush();
    assert.equal(value(c.read(), 'x'), 8);
    assert.equal(value(c.read(), 'y'), 9);
    const events = [];
    const off = c.observe(s => events.push(snap(s)));
    try {
      settled(c.undo());
      assert.equal(value(c.read(), 'x'), 7);
      assert.equal(value(c.read(), 'y'), 0);
      assert.equal(snap(c.read()), snap(c.canonical()));
      assert.ok(events.length > 0, 'undo must publish its change');
      assert.ok(events.every(s => s === snap(c.read())), 'undo published a half-state');
    } finally { off(); }
  });
}

add('CCTX2-local-deferred-supersedes-pending-authorship', 'context', live, c => {
  const p = c.begin([set('x', 1)]);
  deferred(c, [set('x', 2)], 'local', [p]);
  c.flush();
  pending(c, p);
  assert.equal(value(c.read(), 'x'), 2);
  assert.equal(value(c.canonical(), 'x'), 2);
  settled(c.accept(p));
  assert.equal(value(c.read(), 'x'), 2);
});

add('CCTX4-CCTX5-mixed-deferred-contexts-or-atomic-unsupported', 'context', live, c => {
  const p = c.begin([set('x', 1)]);
  deferred(c, [set('x', 2)], 'external', [p]);
  const expectedRead = snap(c.read());
  const expectedCanonical = structuredClone(c.canonical());
  expectedCanonical.values.find(v => v.path.length === 1 && v.path[0] === 'x').value = 2;
  // Second classification shares the queue with external work. Unsupported
  // may preserve that already-authorized work, but must not schedule y=3.
  deferred(c, [set('y', 3)], 'undoable', [p], events => {
    pending(c, p);
    assert.equal(value(c.read(), 'x'), 1);
    assert.equal(value(c.canonical(), 'x'), 2);
    assert.equal(value(c.read(), 'y'), 0);
    assert.equal(value(c.canonical(), 'y'), 0);
    assert.equal(snap(c.read()), expectedRead);
    assert.equal(snap(c.canonical()), snap(expectedCanonical));
    assert.ok(events.every(s => s === snap(c.read())));
  });
  c.flush();
  pending(c, p);
  assert.equal(value(c.read(), 'x'), 1);
  assert.equal(value(c.canonical(), 'x'), 2);
  assert.equal(value(c.read(), 'y'), 3);
  settled(c.undo());
  pending(c, p);
  assert.equal(value(c.read(), 'x'), 1);
  assert.equal(value(c.canonical(), 'x'), 2);
  assert.equal(value(c.read(), 'y'), 0);
  settled(c.reject(p));
  assert.equal(value(c.read(), 'x'), 2);
});

export { cases };
