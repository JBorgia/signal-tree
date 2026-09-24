import { assert, permutations, settled, snap, terminal } from './assertions.mjs';

// Preregistered against PROTOCOL.md and transaction-semantics-2/{MATRIX,LAWS}.
// No candidate imports, feature probes, caught Unsupported, or inferred outcomes.
// Every run receives a fresh default-seeded adapter. The runner owns destroy().
// Keys below repeat the structural matrix, not just an isolated identity smoke test.
// LIMITATION: the frozen contract does not define canonical support topology
// when committed structural truth relies on pending-created existence or a
// pending-vacated key. Such intermediates assert visible topology and ownership,
// not an invented exact canonical entity list. Refusal must still preserve the
// ENTIRE canonical snapshot byte-for-byte semantically, including support facts.
// Exact canonical checks below cover independent scalar values, pending-only
// proposals, isolated mapping writers, and final states after settlement.
const KEY_PAIRS = [
  ['A', 'B'], ['a.b', 'a/b'], ['a/b', 'a::b'],
  ['a::b', 'jo.doe@example.com'], ['jo.doe@example.com', '1.2.3'],
  ['1.2.3', 'a.b'], [1, '1'], ['1', 1],
];
const LIVE = ['live'];
const BOTH = ['live', 'draft'];
const add = (ref, key, name = 'New') =>
  ({ kind: 'add', ref, key, fields: { name, priority: 0 } });
const field = (ref, name) => ({ kind: 'field', ref, field: 'name', value: name });
const remove = ref => ({ kind: 'remove', ref });
const rekey = (ref, key) => ({ kind: 'rekey', ref, key });
const scalar = x => ({ kind: 'set', path: ['x'], value: x });
const row = (ref, key, name = 'Original') => ({ ref, key, fields: { name, priority: 0 } });
const snapshot = (entities, x = 0) => ({
  values: ['x', 'y', 'z'].map(key => ({ path: [key], value: key === 'x' ? x : 0 })),
  entities,
});
const ordered = s => ({
  values: [...s.values].sort((a, b) => JSON.stringify(a.path).localeCompare(JSON.stringify(b.path))),
  entities: [...s.entities].sort((a, b) => a.ref.localeCompare(b.ref)),
});
const equalSnapshot = (actual, expected) => assert.deepEqual(ordered(actual), ordered(expected));
const check = (c, visible, canonical = visible) => {
  equalSnapshot(c.read(), visible);
  equalSnapshot(c.canonical(), canonical);
};
const checkDependent = (c, visible, canonicalX = 0) => {
  equalSnapshot(c.read(), visible);
  // Unspecified structural support is not permission to commit a pending scalar.
  assert.deepEqual(ordered(c.canonical()).values, ordered(snapshot([], canonicalX)).values);
};
const local = (c, ops) => settled(c.write(ops, { context: 'local' }));
const state = (c, id, status, dispositions) => {
  if (status !== 'pending') terminal(c, id, status);
  const actual = c.state(id);
  assert.equal(actual.status, status);
  assert.equal(actual.authority, status === 'pending');
  assert.equal(actual.dispositions.length, dispositions.length);
  dispositions.forEach((expected, i) => {
    assert.ok([expected].flat().includes(actual.dispositions[i]),
      `operation ${i}: expected ${JSON.stringify(expected)}, got ${actual.dispositions[i]}`);
  });
};
// L9 allows a rejected, already non-effective operation to be reported as
// removed OR superseded. Neither spelling permits committed/pending ownership.
// This is one preregistered semantic alternative for every adapter, not a probe.
const REMOVED_NON_EFFECTIVE = ['rejected', 'superseded'];

function atomic(c, action, visible, canonical = visible) {
  const before = snap(c.read());
  const events = [];
  const off = c.observe(s => events.push(structuredClone(s)));
  try {
    settled(action());
    check(c, visible, canonical);
    for (const event of events) equalSnapshot(event, visible);
    if (before !== snap(visible)) assert.ok(events.length > 0, 'changed truth must publish');
    else assert.equal(events.length, 0, 'unchanged truth must not publish');
  } finally { off(); }
}

function refused(c, ids, action, draftIds = []) {
  const before = {
    visible: structuredClone(c.read()), canonical: structuredClone(c.canonical()),
    states: ids.map(id => structuredClone(c.state(id))),
    drafts: draftIds.map(id => structuredClone(c.draft(id))),
  };
  const events = [];
  const off = c.observe(s => events.push(structuredClone(s)));
  try {
    assert.equal(action().status, 'refused');
    equalSnapshot(c.read(), before.visible);
    equalSnapshot(c.canonical(), before.canonical);
    ids.forEach((id, i) => assert.deepEqual(c.state(id), before.states[i],
      'refusal must preserve the complete disposition vector and authority'));
    draftIds.forEach((id, i) => equalSnapshot(c.draft(id), before.drafts[i]));
    assert.deepEqual(events, [], 'refusal must publish no intermediate or final snapshot');
  } finally { off(); }
}

function duplicates(c, id) {
  const visible = structuredClone(c.read());
  const canonical = structuredClone(c.canonical());
  const beforeState = structuredClone(c.state(id));
  const events = [];
  const off = c.observe(s => events.push(structuredClone(s)));
  try {
    for (const method of ['reject', 'accept']) {
      assert.ok(['settled', 'already-settled'].includes(c[method](id).status));
      check(c, visible, canonical);
      assert.deepEqual(c.state(id), beforeState);
    }
    assert.deepEqual(events, []);
  } finally { off(); }
}

export const cases = [];
function keyed(id, family, profiles, run) {
  KEY_PAIRS.forEach(([a, b], index) => cases.push({
    id: `${id}/keys-${index}`, family, profiles,
    run(c) {
      if (a !== 'A') local(c, [rekey('original', a)]);
      check(c, snapshot([row('original', a)]));
      run(c, a, b);
    },
  }));
}

// T01: rejecting one's own add returns exactly to the base in either profile.
keyed('T01-add-reject', 'structural', BOTH, (c, a, b) => {
  const expected = snapshot([row('original', a)]);
  const p = c.begin([add('new', b)]);
  state(c, p, 'pending', ['pending']);
  atomic(c, () => c.reject(p), expected);
  state(c, p, 'rejected', ['rejected']);
  duplicates(c, p);
});

// T02a/F5: a committed field depends on pending-created existence. Rejecting
// the add must refuse, retain authority, and refuse again until dependency ends.
keyed('T02a-add-committed-edit-refusal', 'structural', LIVE, (c, a, b) => {
  const base = snapshot([row('original', a)]);
  const p = c.begin([add('new', b)]);
  local(c, [field('new', 'Dependent')]);
  checkDependent(c, snapshot([row('original', a), row('new', b, 'Dependent')]));
  state(c, p, 'pending', ['pending']);
  refused(c, [p], () => c.reject(p));
  refused(c, [p], () => c.reject(p));
  local(c, [remove('new')]);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', [REMOVED_NON_EFFECTIVE]);
});

// T12/F4: a pending dependent writer is also an obligation. Removing that
// writer permits a real retry; success must remove the formerly blocked add.
keyed('T12-add-pending-edit-refusal-retry', 'structural', LIVE, (c, a, b) => {
  const base = snapshot([row('original', a)]);
  const added = snapshot([row('original', a), row('new', b, 'New')]);
  const p = c.begin([add('new', b)]);
  const q = c.begin([field('new', 'Dependent')]);
  check(c, snapshot([row('original', a), row('new', b, 'Dependent')]), base);
  state(c, p, 'pending', ['pending']);
  state(c, q, 'pending', ['pending']);
  refused(c, [p, q], () => c.reject(p));
  atomic(c, () => c.reject(q), added, base);
  state(c, q, 'rejected', ['rejected']);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', ['rejected']);
});

for (const decision of ['accept', 'reject']) {
  // T03/T04: newer local removal supersedes existence; same-key replacement
  // is a different lifetime and must not be erased or resurrect the old one.
  for (const replacement of [false, true]) keyed(
    `T03-T04-add-remove-${replacement ? 'replacement' : 'absent'}-${decision}`,
    'structural', LIVE, (c, a, b) => {
      const expected = snapshot([row('original', a),
        ...(replacement ? [row('replacement', b, 'Replacement')] : [])]);
      const p = c.begin([add('new', b)]);
      local(c, [remove('new'), ...(replacement ? [add('replacement', b, 'Replacement')] : [])]);
      checkDependent(c, expected);
      state(c, p, 'pending', ['superseded']);
      atomic(c, () => c[decision](p), expected);
      state(c, p, decision === 'accept' ? 'accepted' : 'rejected',
        [decision === 'accept' ? 'superseded' : REMOVED_NON_EFFECTIVE]);
      duplicates(c, p);
    });
}

// T05/R6/F09/F10/O04: failed removal reversal cannot retire authority. A retry
// after the new occupant leaves must restore the original lifetime AND scalar.
keyed('T05-R6-remove-readd-atomic-authority-retry', 'structural', LIVE, (c, a) => {
  const base = snapshot([row('original', a)]);
  const p = c.begin([scalar(7), remove('original')]);
  local(c, [add('replacement', a, 'Replacement')]);
  checkDependent(c, snapshot([row('replacement', a, 'Replacement')], 7));
  state(c, p, 'pending', ['pending', 'pending']);
  refused(c, [p], () => c.reject(p));
  refused(c, [p], () => c.reject(p));
  local(c, [remove('replacement')]);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', ['rejected', 'rejected']);
  local(c, [field('original', 'Restored lifetime')]);
  check(c, snapshot([row('original', a, 'Restored lifetime')]));
  duplicates(c, p);
});

// T06a: field and mapping are independent even on the SAME lifetime.
keyed('T06a-rekey-field-independent', 'structural', LIVE, (c, a, b) => {
  const expected = snapshot([row('original', a, 'Edited')]);
  const p = c.begin([rekey('original', b)]);
  local(c, [field('original', 'Edited')]);
  checkDependent(c, snapshot([row('original', b, 'Edited')]));
  state(c, p, 'pending', ['pending']);
  atomic(c, () => c.reject(p), expected);
  state(c, p, 'rejected', ['rejected']);
});

// T06b: occupancy of the OLD key really does depend on the pending rekey.
keyed('T06b-rekey-old-key-occupancy-dependent', 'structural', LIVE, (c, a, b) => {
  const expected = snapshot([row('original', a, 'Independent edit')]);
  const p = c.begin([rekey('original', b)]);
  local(c, [add('occupant', a, 'Occupant'), field('original', 'Independent edit')]);
  checkDependent(c, snapshot([
    row('original', b, 'Independent edit'), row('occupant', a, 'Occupant'),
  ]));
  state(c, p, 'pending', ['pending']);
  refused(c, [p], () => c.reject(p));
  refused(c, [p], () => c.reject(p));
  local(c, [remove('occupant')]);
  atomic(c, () => c.reject(p), expected);
  state(c, p, 'rejected', ['rejected']);
});

for (const decision of ['accept', 'reject']) keyed(
  `T07-rekey-remove-${decision}`, 'structural', LIVE, (c, a, b) => {
    const expected = snapshot([]);
    const p = c.begin([rekey('original', b)]);
    local(c, [remove('original')]);
    checkDependent(c, expected);
    state(c, p, 'pending', ['superseded']);
    atomic(c, () => c[decision](p), expected);
    state(c, p, decision === 'accept' ? 'accepted' : 'rejected',
      [decision === 'accept' ? 'superseded' : REMOVED_NON_EFFECTIVE]);
    duplicates(c, p);
  });

for (const decision of ['accept', 'reject']) keyed(
  `T07-T08-rekey-remove-destination-replacement-${decision}`, 'structural', LIVE, (c, a, b) => {
    const expected = snapshot([row('replacement', b, 'Replacement')]);
    const p = c.begin([rekey('original', b)]);
    local(c, [remove('original'), add('replacement', b, 'Replacement')]);
    checkDependent(c, expected);
    state(c, p, 'pending', ['superseded']);
    atomic(c, () => c[decision](p), expected);
    state(c, p, decision === 'accept' ? 'accepted' : 'rejected',
      [decision === 'accept' ? 'superseded' : REMOVED_NON_EFFECTIVE]);
    duplicates(c, p);
  });

// T11/I07: a captured reference means a lifetime, never whichever entity now
// occupies its key. Settle an old field write after committed remove/re-add.
for (const decision of ['accept', 'reject']) keyed(
  `T11-held-lifetime-${decision}`, 'identity', LIVE, (c, a) => {
    const held = c.read().entities.find(e => e.ref === 'original').ref;
    const expected = snapshot([row('replacement', a, 'Replacement')]);
    const p = c.begin([field(held, 'Old lifetime edit')]);
    local(c, [remove(held), add('replacement', a, 'Replacement')]);
    checkDependent(c, expected);
    state(c, p, 'pending', ['superseded']);
    atomic(c, () => c[decision](p), expected);
    state(c, p, decision === 'accept' ? 'accepted' : 'rejected',
      [decision === 'accept' ? 'superseded' : REMOVED_NON_EFFECTIVE]);
    local(c, [field('replacement', 'New lifetime edit')]);
    check(c, snapshot([row('replacement', a, 'New lifetime edit')]));
    duplicates(c, p);
  });

// T14/O03: observers must never see one half of structural/scalar settlement.
for (const decision of ['accept', 'reject']) keyed(
  `T14-mixed-scalar-structural-${decision}`, 'structural', LIVE, (c, a, b) => {
    const base = snapshot([row('original', a)]);
    const proposed = snapshot([row('original', b), row('new', a, 'New')], 7);
    const expected = decision === 'accept' ? proposed : base;
    const p = c.begin([scalar(7), rekey('original', b), add('new', a)]);
    check(c, proposed, base);
    state(c, p, 'pending', ['pending', 'pending', 'pending']);
    atomic(c, () => c[decision](p), expected);
    state(c, p, decision === 'accept' ? 'accepted' : 'rejected',
      Array(3).fill(decision === 'accept' ? 'committed' : 'rejected'));
  });

// T09/T10: three mapping writers, every settlement ordering and accept/reject
// combination. Expected winner is greatest surviving AUTHORSHIP index, never
// the most recently settled writer. Expectations are built before begin().
for (const order of permutations([0, 1, 2])) {
  for (let mask = 0; mask < 8; mask++) keyed(
    `T10-three-rekeys/order-${order.join('')}/accept-mask-${mask}`, 'structural', LIVE,
    (c, a, b) => {
      const keys = [b, 'third-destination', 'fourth-destination'];
      const decisions = keys.map((_, i) => (mask & (1 << i)) ? 'accept' : 'reject');
      const statuses = ['pending', 'pending', 'pending'];
      const expected = order.map(i => {
        statuses[i] = decisions[i] === 'accept' ? 'accepted' : 'rejected';
        const committed = statuses.lastIndexOf('accepted');
        const winner = Math.max(committed, statuses.lastIndexOf('pending'));
        return {
          visible: snapshot([row('original', winner < 0 ? a : keys[winner])]),
          canonical: snapshot([row('original', committed < 0 ? a : keys[committed])]),
          status: statuses[i],
          disposition: decisions[i] === 'reject'
            ? (committed > i ? REMOVED_NON_EFFECTIVE : 'rejected')
            : (committed > i ? 'superseded' : 'committed'),
        };
      });
      const ids = keys.map(key => c.begin([rekey('original', key)]));
      check(c, snapshot([row('original', keys[2])]), snapshot([row('original', a)]));
      order.forEach((i, step) => {
        const e = expected[step];
        atomic(c, () => c[decisions[i]](ids[i]), e.visible, e.canonical);
        state(c, ids[i], e.status, [e.disposition]);
      });
      for (const id of ids) assert.equal(c.state(id).authority, false);
    });
}

// I01..I06: delimiter-bearing and typed keys coexist in the SAME topology.
// Separate runs alone cannot detect 1/'1' aliasing. Acceptance is reachable in
// both profiles and all entries, references, fields, and key types are checked.
cases.push({
  id: 'I01-I06-coexisting-typed-keys', family: 'identity', profiles: BOTH,
  run(c) {
    const keys = ['a.b', 'a/b', 'a::b', 'jo.doe@example.com', '1.2.3', 1, '1'];
    const expected = snapshot([row('original', 'A'),
      ...keys.map((key, i) => row(`typed-${i}`, key, `Name ${i}`))]);
    const p = c.begin(keys.map((key, i) => add(`typed-${i}`, key, `Name ${i}`)));
    atomic(c, () => c.accept(p), expected);
    state(c, p, 'accepted', keys.map(() => 'committed'));
    local(c, [field('typed-5', 'Numeric only'), remove('typed-6')]);
    check(c, snapshot([row('original', 'A'),
      ...keys.slice(0, 6).map((key, i) => row(`typed-${i}`, key, i === 5 ? 'Numeric only' : `Name ${i}`))]));
  },
});

// Draft controls are deliberately separate: live add/edit and vacated-key
// dependency setups cannot be credited when the proposal is isolated.
keyed('draft-control-isolated-add', 'structural', ['draft'], (c, a, b) => {
  const base = snapshot([row('original', a)]);
  const proposed = snapshot([row('original', a), row('new', b, 'New')]);
  const p = c.begin([add('new', b)]);
  check(c, base);
  equalSnapshot(c.draft(p), proposed);
  state(c, p, 'pending', ['pending']);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', ['rejected']);
});

keyed('draft-control-remove-does-not-vacate-key', 'structural', ['draft'], (c, a) => {
  const base = snapshot([row('original', a)]);
  const p = c.begin([remove('original')]);
  check(c, base);
  equalSnapshot(c.draft(p), snapshot([]));
  state(c, p, 'pending', ['pending']);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', ['rejected']);
});

keyed('draft-control-rekey-does-not-vacate-key', 'structural', ['draft'], (c, a, b) => {
  const base = snapshot([row('original', a)]);
  const p = c.begin([rekey('original', b)]);
  check(c, base);
  equalSnapshot(c.draft(p), snapshot([row('original', b)]));
  state(c, p, 'pending', ['pending']);
  atomic(c, () => c.reject(p), base);
  state(c, p, 'rejected', ['rejected']);
});

keyed('draft-control-mixed-accept-publication', 'structural', ['draft'], (c, a, b) => {
  const base = snapshot([row('original', a)]);
  const expected = snapshot([row('original', b), row('new', a, 'New')], 7);
  const p = c.begin([scalar(7), rekey('original', b), add('new', a)]);
  check(c, base);
  equalSnapshot(c.draft(p), expected);
  atomic(c, () => c.accept(p), expected);
  state(c, p, 'accepted', ['committed', 'committed', 'committed']);
});
