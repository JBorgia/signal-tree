// Independent, non-shipping attacks derived only from PROTOCOL.md, frozen
// LAWS.md, and frontier.mjs source. No existing result or candidate rationale.
// These exercise the bounded model, NOT actual SignalTree composition.
// Retention evidence is stats() instrumentation, never heap/MB measurement.
// Observer exception propagation policy is unspecified; the robustness attack
// permits either propagation or containment, but not replay of a committed write.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const set = (path, value) => ({ kind: 'set', path: Array.isArray(path) ? path : [path], value });
const add = (ref, key) => ({ kind: 'add', ref, key, fields: { name: ref, priority: 0 } });
const normal = s => ({
  values: [...s.values].sort((a, b) => JSON.stringify(a.path).localeCompare(JSON.stringify(b.path))),
  entities: [...s.entities].sort((a, b) => a.ref.localeCompare(b.ref)),
});
const at = (s, path) => s.values.find(v => isDeepStrictEqual(v.path, Array.isArray(path) ? path : [path]));
function expectValue(s, path, expected) {
  assert.ok(at(s, path), `missing path ${JSON.stringify(path)}`);
  assert.deepEqual(at(s, path).value, expected, `value at ${JSON.stringify(path)}`);
}
function settled(result) {
  if (result?.status === 'unsupported') throw Object.assign(new Error(result.reason), { name: 'Unsupported' });
  assert.equal(result.status, 'settled');
}
function pending(c, p) {
  assert.equal(c.state(p).status, 'pending');
  assert.equal(c.state(p).authority, true);
}
const local = (c, ops) => settled(c.write(ops, { context: 'local' }));
const note = (evidence, label, c, extra = {}) => evidence.push({
  label, visible: c.read(), canonical: c.canonical(), stats: c.stats(), ...extra,
});

export const cases = [
  {
    id: 'partial-newer-ack-revives-older-owner', family: 'authority', profiles: ['live'],
    trace: ['P1: x=1,y=1', 'P2: x=2,y=2', 'snapshot x=10 accepts P2', 'accept P1'],
    run(c, evidence = []) {
      const p1 = c.begin([set('x', 1), set('y', 1)]);
      const p2 = c.begin([set('x', 2), set('y', 2)]);
      settled(c.authority({ ops: [set('x', 10)], order: { kind: 'snapshot' },
        settlements: [{ kind: 'accepts', id: p2 }] }));
      pending(c, p1);
      assert.equal(c.state(p2).status, 'accepted');
      const afterAck = c.read();
      note(evidence, 'after partial acknowledgement', c, { p1: c.state(p1), p2: c.state(p2) });
      settled(c.accept(p1));
      note(evidence, 'after accepting older owner', c);
      // L4/L6/L11: acknowledgement of P2 must retain its authorship frontier
      // for x as well as y, including after P2 leaves active ownership.
      assert.deepEqual(
        [at(afterAck, 'x')?.value, at(afterAck, 'y')?.value, at(c.read(), 'x')?.value, at(c.read(), 'y')?.value],
        [10, 2, 10, 2], 'newer acknowledged truth must survive its owner retirement',
      );
      expectValue(c.canonical(), 'x', 10);
    },
  },
  {
    id: 'mixed-undo-preserves-null-with-unrelated-pending', family: 'context', profiles: ['live'],
    trace: ['local y=null,z=4', 'P: x=1', 'undoable y=7,z=8', 'undo'],
    run(c, evidence = []) {
      local(c, [set('y', null), set('z', 4)]);
      const p = c.begin([set('x', 1)]);
      settled(c.write([set('y', 7), set('z', 8)], { context: 'undoable' }));
      settled(c.undo());
      note(evidence, 'after mixed undo', c, { pending: c.state(p) });
      pending(c, p);
      expectValue(c.read(), 'x', 1);
      expectValue(c.read(), 'z', 4);
      expectValue(c.read(), 'y', null);
      expectValue(c.canonical(), 'x', 0);
      expectValue(c.canonical(), 'y', null);
    },
  },
  {
    id: 'retired-structural-lifetimes-release-correctness-records', family: 'retention', profiles: ['live'],
    trace: ['128 times: begin add fresh ref at B; accept; local remove that ref', 'sample stats with constant live topology'],
    run(c, evidence = []) {
      const baseline = c.stats();
      const initial = normal(c.read());
      note(evidence, 'baseline', c);
      for (let i = 1; i <= 128; i++) {
        const ref = `retired-${i}`;
        const p = c.begin([add(ref, 'B')]);
        settled(c.accept(p));
        local(c, [{ kind: 'remove', ref }]);
        assert.deepEqual(normal(c.read()), initial);
        assert.deepEqual(normal(c.canonical()), initial);
        assert.equal(c.stats().active, 0);
        if ([1, 2, 16, 128].includes(i)) note(evidence, `after ${i} retired lifetimes`, c);
      }
      // No held proposal, undo record, or surviving entity needs these fields.
      // Allow one four-cell tombstone as slack, not one record per dead lifetime.
      assert.ok(c.stats().retainedOperations <= baseline.retainedOperations + 4,
        `retired operation accumulation: ${baseline.retainedOperations} -> ${c.stats().retainedOperations}`);
    },
  },
  {
    id: 'held-precursor-many-newer-commits-stays-bounded', family: 'retention', profiles: ['live'],
    trace: ['P: x=1', '2000 times: begin x=i,y=i; accept', 'reject P'],
    run(c, evidence = []) {
      const base = c.stats();
      const p = c.begin([set('x', 1)]);
      for (let i = 2; i <= 2001; i++) {
        const q = c.begin([set('x', i), set('y', i)]);
        settled(c.accept(q));
        pending(c, p);
        assert.equal(c.stats().active, 1);
        assert.ok(c.stats().retainedOperations <= base.retainedOperations + 3);
        expectValue(c.read(), 'x', i);
      }
      note(evidence, 'held precursor after 2000 commits', c);
      settled(c.reject(p));
      expectValue(c.read(), 'x', 2001);
      expectValue(c.read(), 'y', 2001);
      assert.equal(c.stats().active, 0);
      note(evidence, 'precursor retired', c);
    },
  },
  {
    id: 'nested-typed-paths-and-keys-after-retirement', family: 'identity', profiles: ['live'],
    trace: ['accept six distinct typed paths and numeric/string entity keys', 'update numeric path/entity; remove string-key entity'],
    run(c, evidence = []) {
      const paths = [['a.b'], ['a', 'b'], ['a', 1], ['a', '1'], [1], ['1']];
      const p = c.begin([...paths.map((path, i) => set(path, i + 1)), add('numeric', 1), add('string', '1')]);
      settled(c.accept(p));
      local(c, [set(['a', 1], 99), { kind: 'field', ref: 'numeric', field: 'name', value: 'Numeric only' },
        { kind: 'remove', ref: 'string' }]);
      paths.forEach((path, i) => expectValue(c.read(), path, i === 2 ? 99 : i + 1));
      assert.equal(c.read().entities.find(e => e.ref === 'numeric')?.key, 1);
      assert.equal(c.read().entities.find(e => e.ref === 'numeric')?.fields.name, 'Numeric only');
      assert.ok(!c.read().entities.some(e => e.ref === 'string'));
      assert.deepEqual(normal(c.read()), normal(c.canonical()));
      note(evidence, 'typed paths and lifetimes remain distinct', c);
    },
  },
  {
    id: 'direct-authority-interleave-preserves-local-precedence', family: 'authority', profiles: ['live'],
    trace: ['P: x=1,y=1', 'local x=5', 'snapshot x=9,y=9', 'accept P', 'external x=10,y=10', 'duplicate reject P'],
    run(c, evidence = []) {
      const p = c.begin([set('x', 1), set('y', 1)]);
      local(c, [set('x', 5)]);
      settled(c.authority({ ops: [set('x', 9), set('y', 9)], order: { kind: 'snapshot' } }));
      expectValue(c.read(), 'x', 9);
      expectValue(c.read(), 'y', 1);
      expectValue(c.canonical(), 'y', 9);
      pending(c, p);
      settled(c.accept(p));
      expectValue(c.read(), 'x', 9);
      expectValue(c.read(), 'y', 1);
      settled(c.write([set('x', 10), set('y', 10)], { context: 'external' }));
      assert.ok(['already-settled', 'settled'].includes(c.reject(p).status));
      expectValue(c.read(), 'x', 10);
      expectValue(c.read(), 'y', 10);
      note(evidence, 'direct/authority frontier preserved', c);
    },
  },
  {
    id: 'throwing-observer-must-not-replay-committed-deferred-undo', family: 'robustness', profiles: ['live'],
    trace: ['P: x=1', 'queue undoable y=7', 'observer throws during flush', 'unsubscribe; flush again', 'undo once'],
    run(c, evidence = []) {
      const p = c.begin([set('x', 1)]);
      settled(c.write([set('y', 7)], { context: 'undoable', defer: true }));
      const sentinel = new Error('attack subscriber failure');
      const off = c.observe(() => { throw sentinel; });
      let error;
      try { c.flush(); } catch (e) { error = e; }
      finally { off(); }
      if (error) assert.ok(error === sentinel || error.errors?.includes(sentinel), 'unexpected execution error');
      // Whether subscriber errors propagate is not prescribed. Once y=7 has
      // committed, another flush must not author it again or duplicate history.
      expectValue(c.read(), 'y', 7);
      const once = c.stats();
      note(evidence, 'after subscriber error', c, { error: error?.message });
      c.flush();
      const twice = c.stats();
      note(evidence, 'after retrying flush', c);
      settled(c.undo());
      note(evidence, 'after one undo', c);
      pending(c, p);
      expectValue(c.read(), 'x', 1);
      assert.equal(twice.history, once.history, 'flush replay duplicated undo history');
      expectValue(c.read(), 'y', 0);
    },
  },
  {
    id: 'reentrant-write-explicit-unsupported-without-side-effects', family: 'scope', profiles: ['live'],
    trace: ['observer attempts local y=2 while local x=1 publishes'],
    run(c, evidence = []) {
      let error;
      let invoked = false;
      const off = c.observe(() => {
        if (invoked) return;
        invoked = true;
        try { settled(c.write([set('y', 2)], { context: 'local' })); }
        catch (e) { error = e; }
      });
      try { local(c, [set('x', 1)]); } finally { off(); }
      assert.ok(invoked);
      expectValue(c.read(), 'x', 1);
      if (error) {
        assert.equal(error.name, 'Unsupported');
        expectValue(c.read(), 'y', 0);
        c.flush();
        expectValue(c.read(), 'y', 0);
        note(evidence, 'unsupported reentrancy is atomic', c);
        throw error; // Report unsupported, never count as semantic conformance.
      }
      expectValue(c.read(), 'y', 2);
    },
  },
  {
    id: 'structural-authority-rejected-before-payload-or-correlation', family: 'scope', profiles: ['live'],
    trace: ['P: x=1', 'authority x=99 plus rekey original->B, accepts P'],
    run(c, evidence = []) {
      const p = c.begin([set('x', 1)]);
      const before = { read: normal(c.read()), canonical: normal(c.canonical()), state: c.state(p), stats: c.stats() };
      let error;
      try {
        settled(c.authority({ ops: [set('x', 99), { kind: 'rekey', ref: 'original', key: 'B' }],
          order: { kind: 'snapshot' }, settlements: [{ kind: 'accepts', id: p }] }));
      } catch (e) { error = e; }
      if (error) {
        assert.equal(error.name, 'Unsupported');
        c.flush();
        assert.deepEqual({ read: normal(c.read()), canonical: normal(c.canonical()), state: c.state(p), stats: c.stats() }, before);
        note(evidence, 'unsupported structural authority is atomic', c);
        throw error;
      }
      expectValue(c.read(), 'x', 99);
      assert.equal(c.read().entities.find(e => e.ref === 'original')?.key, 'B');
      assert.equal(c.state(p).status, 'accepted');
    },
  },
];

// Standalone runner: executes only this attack suite, never loads existing
// matrix results. An assertion failure, execution error, and unsupported scope
// are distinct evidence. Expected subscriber errors are inspected inside a case.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { create } = await import('./frontier.mjs');
  const results = [];
  for (const test of cases) {
    const c = create({ profile: 'live', diagnostics: false });
    const result = { id: test.id, family: test.family, trace: test.trace, status: 'passed', evidence: [] };
    try { test.run(c, result.evidence); }
    catch (error) {
      result.status = error?.name === 'Unsupported' ? 'unsupported' : error?.code === 'ERR_ASSERTION' ? 'failed' : 'error';
      result.error = { name: error.name, message: error.message, actual: error.actual, expected: error.expected, stack: error.stack };
    } finally { c.destroy(); }
    results.push(result);
  }
  const report = { scope: 'bounded frontier model; live; diagnostics=false', results };
  const out = process.argv.slice(2).find(arg => arg.startsWith('--out='))?.slice(6);
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(results.map(({ id, status, error }) => ({ id, status, message: error?.message })), null, 2));
  process.exitCode = results.some(r => ['failed', 'error', 'unsupported'].includes(r.status)) ? 1 : 0;
}
