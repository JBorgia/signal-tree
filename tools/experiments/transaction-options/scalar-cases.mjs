// Non-shipping conformance tests. Frozen sources: PROTOCOL.md and
// docs/research/transaction-semantics-2/{LAWS,MATRIX,MUTATIONS}.md.
// The runner supplies a NEW default-seeded model for EACH case/profile.
// No candidates, factories, callbacks-as-writes, or candidate-specific branches.
import { assert, set, snap, settled, pending, terminal } from './assertions.mjs';

export const cases = [];
const snapshot = (x = 0, y = 0, z = 0) => ({
  values: [{ path: ['x'], value: x }, { path: ['y'], value: y }, { path: ['z'], value: z }],
  entities: [{ ref: 'original', key: 'A', fields: { name: 'Original', priority: 0 } }],
});
const expect = (c, visible, canonical = visible) => {
  assert.equal(snap(c.read()), snap(visible), 'visible snapshot');
  assert.equal(snap(c.canonical()), snap(canonical), 'canonical snapshot');
};
function add(id, family, profiles, run) {
  cases.push({ id, family, profiles, run(c) {
    expect(c, snapshot()); // Also catches accidental fixture reuse by the runner.
    run(c);
  } });
}
function done(c, id, status, count = 1) {
  terminal(c, id, status);
  const dispositions = c.state(id).dispositions;
  assert.equal(dispositions.length, count, 'every recorded operation has a disposition');
  const allowed = status === 'accepted' ? ['committed', 'superseded'] : ['rejected', 'superseded'];
  assert.ok(dispositions.every(d => allowed.includes(d)), `${status}: invalid terminal disposition`);
}
function finish(c, id, method, count = 1) {
  settled(c[method](id)); // Scalar success profiles MUST NOT pass by refusing.
  done(c, id, method === 'accept' ? 'accepted' : 'rejected', count);
}
function beginWriters(c, n) {
  const ids = [];
  for (let i = 1; i <= n; i++) {
    ids.push(c.begin([set('x', i)]));
    expect(c, snapshot(i), snapshot());
    ids.forEach(id => pending(c, id));
  }
  return ids;
}

// Capture values immediately: retaining mutable snapshot objects could conceal
// a half-state. Check callback-time read() as well as the delivered snapshot.
// Notification multiplicity is unspecified; every notification must be coherent
// and a visible change must notify synchronously. observe has no initial event.
function observed(c, action, visible, canonical = visible) {
  const before = snap(c.read());
  const events = [];
  const off = c.observe(s => events.push([snap(s), snap(c.read()), snap(c.canonical())]));
  try {
    assert.deepEqual(events, [], 'observe must not emit an initial snapshot');
    action();
    expect(c, visible, canonical);
    if (before !== snap(visible)) assert.ok(events.length > 0, 'visible change must publish');
    else assert.deepEqual(events, [], 'unchanged visible truth must not publish');
    for (const event of events) {
      assert.deepEqual(event, [snap(visible), snap(visible), snap(canonical)], 'coherent publication');
    }
  } finally { off(); }
}

for (const method of ['accept', 'reject']) {
  add(`S01-one-${method}`, 'scalar', ['live'], c => {
    const [p] = beginWriters(c, 1);
    finish(c, p, method);
    expect(c, snapshot(method === 'accept' ? 1 : 0));
  });
  add(`S02-local-supersedes-${method}`, 'scalar', ['live'], c => {
    const [p] = beginWriters(c, 1);
    settled(c.write([set('x', 9)], { context: 'local' }));
    expect(c, snapshot(9));
    pending(c, p);
    finish(c, p, method);
    expect(c, snapshot(9));
  });
}
add('S03-two-pending', 'scalar', ['live'], c => { beginWriters(c, 2); });
add('S04-three-pending', 'scalar', ['live'], c => { beginWriters(c, 3); });

for (const [id, index, method, visible, canonical] of [
  ['S05', 0, 'reject', 3, 0], ['S06', 1, 'reject', 3, 0],
  ['S07', 2, 'reject', 2, 0], ['S08', 0, 'accept', 3, 1],
  ['S09', 1, 'accept', 3, 2], ['S10', 2, 'accept', 3, 3],
]) {
  add(`${id}-${method}-${index + 1}`, 'scalar', ['live'], c => {
    const ids = beginWriters(c, 3);
    finish(c, ids[index], method);
    expect(c, snapshot(visible), snapshot(canonical));
    ids.forEach((p, i) => { if (i !== index) pending(c, p); });
  });
}

// Literal expected [visible x, canonical x] after EVERY settlement. A/R is
// indexed by authorship (P1,P2,P3), not by settlement order. These tables are
// preregistered expectations, never calculated from candidate output.
const TWO = [
  ['12', 'AA', [[2, 1], [2, 2]]],
  ['12', 'AR', [[2, 1], [1, 1]]],
  ['12', 'RA', [[2, 0], [2, 2]]],
  ['12', 'RR', [[2, 0], [0, 0]]],
  ['21', 'AA', [[2, 2], [2, 2]]],
  ['21', 'AR', [[1, 0], [1, 1]]],
  ['21', 'RA', [[2, 2], [2, 2]]],
  ['21', 'RR', [[1, 0], [0, 0]]],
];
const THREE = [
  ['123', 'AAA', [[3, 1], [3, 2], [3, 3]]],
  ['123', 'AAR', [[3, 1], [3, 2], [2, 2]]],
  ['123', 'ARA', [[3, 1], [3, 1], [3, 3]]],
  ['123', 'ARR', [[3, 1], [3, 1], [1, 1]]],
  ['123', 'RAA', [[3, 0], [3, 2], [3, 3]]],
  ['123', 'RAR', [[3, 0], [3, 2], [2, 2]]],
  ['123', 'RRA', [[3, 0], [3, 0], [3, 3]]],
  ['123', 'RRR', [[3, 0], [3, 0], [0, 0]]],
  ['132', 'AAA', [[3, 1], [3, 3], [3, 3]]],
  ['132', 'AAR', [[3, 1], [2, 1], [2, 2]]],
  ['132', 'ARA', [[3, 1], [3, 3], [3, 3]]],
  ['132', 'ARR', [[3, 1], [2, 1], [1, 1]]],
  ['132', 'RAA', [[3, 0], [3, 3], [3, 3]]],
  ['132', 'RAR', [[3, 0], [2, 0], [2, 2]]],
  ['132', 'RRA', [[3, 0], [3, 3], [3, 3]]],
  ['132', 'RRR', [[3, 0], [2, 0], [0, 0]]],
  ['213', 'AAA', [[3, 2], [3, 2], [3, 3]]],
  ['213', 'AAR', [[3, 2], [3, 2], [2, 2]]],
  ['213', 'ARA', [[3, 0], [3, 1], [3, 3]]],
  ['213', 'ARR', [[3, 0], [3, 1], [1, 1]]],
  ['213', 'RAA', [[3, 2], [3, 2], [3, 3]]],
  ['213', 'RAR', [[3, 2], [3, 2], [2, 2]]],
  ['213', 'RRA', [[3, 0], [3, 0], [3, 3]]],
  ['213', 'RRR', [[3, 0], [3, 0], [0, 0]]],
  ['231', 'AAA', [[3, 2], [3, 3], [3, 3]]],
  ['231', 'AAR', [[3, 2], [2, 2], [2, 2]]],
  ['231', 'ARA', [[3, 0], [3, 3], [3, 3]]],
  ['231', 'ARR', [[3, 0], [1, 0], [1, 1]]],
  ['231', 'RAA', [[3, 2], [3, 3], [3, 3]]],
  ['231', 'RAR', [[3, 2], [2, 2], [2, 2]]],
  ['231', 'RRA', [[3, 0], [3, 3], [3, 3]]],
  ['231', 'RRR', [[3, 0], [1, 0], [0, 0]]],
  ['312', 'AAA', [[3, 3], [3, 3], [3, 3]]],
  ['312', 'AAR', [[2, 0], [2, 1], [2, 2]]],
  ['312', 'ARA', [[3, 3], [3, 3], [3, 3]]],
  ['312', 'ARR', [[2, 0], [2, 1], [1, 1]]],
  ['312', 'RAA', [[3, 3], [3, 3], [3, 3]]],
  ['312', 'RAR', [[2, 0], [2, 0], [2, 2]]],
  ['312', 'RRA', [[3, 3], [3, 3], [3, 3]]],
  ['312', 'RRR', [[2, 0], [2, 0], [0, 0]]],
  ['321', 'AAA', [[3, 3], [3, 3], [3, 3]]],
  ['321', 'AAR', [[2, 0], [2, 2], [2, 2]]],
  ['321', 'ARA', [[3, 3], [3, 3], [3, 3]]],
  ['321', 'ARR', [[2, 0], [1, 0], [1, 1]]],
  ['321', 'RAA', [[3, 3], [3, 3], [3, 3]]],
  ['321', 'RAR', [[2, 0], [2, 2], [2, 2]]],
  ['321', 'RRA', [[3, 3], [3, 3], [3, 3]]],
  ['321', 'RRR', [[2, 0], [1, 0], [0, 0]]],
];
for (const [prefix, table, n] of [['S11', TWO, 2], ['S12', THREE, 3]]) {
  for (const [order, outcomes, trace] of table) {
    add(`${prefix}-${order}-${outcomes}`, 'scalar', ['live'], c => {
      const ids = beginWriters(c, n);
      const statuses = Array(n).fill('pending');
      [...order].forEach((digit, step) => {
        const i = Number(digit) - 1;
        const method = outcomes[i] === 'A' ? 'accept' : 'reject';
        const [visible, canonical] = trace[step];
        observed(c, () => finish(c, ids[i], method), snapshot(visible), snapshot(canonical));
        statuses[i] = method === 'accept' ? 'accepted' : 'rejected';
        statuses.forEach((status, j) => {
          if (status === 'pending') pending(c, ids[j]);
          else done(c, ids[j], status);
        });
      });
    });
  }
}

for (const method of ['accept', 'reject']) {
  add(`S13-two-pending-local-frontier-${method}`, 'scalar', ['live'], c => {
    const [p1, p2] = beginWriters(c, 2);
    settled(c.write([set('x', 9)], { context: 'local' }));
    expect(c, snapshot(9));
    pending(c, p1); pending(c, p2);
    observed(c, () => finish(c, p1, method), snapshot(9));
    pending(c, p2);
    observed(c, () => finish(c, p2, method), snapshot(9));
  });
  // S14 means a newer authored writer commits while an older writer remains
  // pending. It does NOT mean begin() can author a retroactive contribution.
  add(`S14-newer-accepted-older-${method}`, 'scalar', ['live'], c => {
    const [p1, p2] = beginWriters(c, 2);
    observed(c, () => finish(c, p2, 'accept'), snapshot(2));
    pending(c, p1);
    observed(c, () => finish(c, p1, method), snapshot(2));
    done(c, p2, 'accepted');
  });
}
add('S13-frontier-between-proposals', 'scalar', ['live'], c => {
  const [p1] = beginWriters(c, 1);
  settled(c.write([set('x', 9)], { context: 'local' }));
  expect(c, snapshot(9));
  const p2 = c.begin([set('x', 2)]);
  expect(c, snapshot(2), snapshot(9));
  finish(c, p1, 'accept');
  expect(c, snapshot(2), snapshot(9));
  pending(c, p2);
  finish(c, p2, 'reject');
  expect(c, snapshot(9));
});

for (const [suffix, ingress] of [
  ['snapshot', c => c.authority({ ops: [set('x', 9)], order: { kind: 'snapshot' } })],
  ['external', c => c.write([set('x', 9)], { context: 'external' })],
  ['version', c => c.authority({ ops: [set('x', 9)], order: { kind: 'versioned', revision: 11 } })],
]) {
  add(`A1-A5-unrelated-${suffix}`, 'authority', ['live'], c => {
    const [p] = beginWriters(c, 1);
    observed(c, () => settled(ingress(c)), snapshot(1), snapshot(9));
    pending(c, p);
    observed(c, () => finish(c, p, 'reject'), snapshot(9));
  });
}
add('A5-equal-value-is-not-an-ack', 'authority', ['live'], c => {
  const [p] = beginWriters(c, 1);
  settled(c.authority({ ops: [set('x', 1)], order: { kind: 'snapshot' } }));
  expect(c, snapshot(1));
  pending(c, p);
  settled(c.authority({ ops: [set('x', 9)], order: { kind: 'snapshot' } }));
  expect(c, snapshot(1), snapshot(9));
  pending(c, p);
  finish(c, p, 'reject');
  expect(c, snapshot(9));
});

for (const [kind, status] of [['accepts', 'accepted'], ['rejects', 'rejected'], ['includes', 'accepted']]) {
  add(`A2-A4-${kind}-only-named-owner`, 'authority', ['live'], c => {
    const [p1, p2] = beginWriters(c, 2);
    observed(c, () => settled(c.authority({
      ops: [set('x', 10)], order: { kind: 'snapshot' }, settlements: [{ kind, id: p1 }],
    })), snapshot(2), snapshot(10));
    done(c, p1, status);
    pending(c, p2);
    observed(c, () => finish(c, p2, 'reject'), snapshot(10));
  });
}
add('A4-includes-is-not-a-global-watermark', 'authority', ['live'], c => {
  const p1 = c.begin([set('y', 1)]);
  const p2 = c.begin([set('x', 2)]);
  expect(c, snapshot(2, 1), snapshot());
  settled(c.authority({
    ops: [set('x', 10)], order: { kind: 'snapshot' }, settlements: [{ kind: 'includes', id: p2 }],
  }));
  expect(c, snapshot(10, 1), snapshot(10));
  pending(c, p1); done(c, p2, 'accepted');
  finish(c, p1, 'reject');
  expect(c, snapshot(10));
});
add('A2-correlation-without-payload', 'authority', ['live'], c => {
  const [p1, p2] = beginWriters(c, 2);
  settled(c.authority({ ops: [], order: { kind: 'snapshot' }, settlements: [{ kind: 'accepts', id: p1 }] }));
  expect(c, snapshot(2), snapshot(1));
  done(c, p1, 'accepted'); pending(c, p2);
  finish(c, p2, 'reject');
  expect(c, snapshot(1));
});
add('A6-T18-T21-version-order-not-arrival', 'authority', ['live', 'draft'], c => {
  for (const [revision, payload, expected] of [[11, 11, 11], [10, 10, 11], [12, 12, 12], [9, 9, 12]]) {
    const result = c.authority({ ops: [set('x', payload)], order: { kind: 'versioned', revision } });
    // Ignoring stale evidence may be reported as settled or refused. This is
    // authority admission, not permission to refuse scalar settlement.
    if (revision < expected) assert.ok(['settled', 'refused'].includes(result.status));
    else settled(result);
    expect(c, snapshot(expected));
  }
});
add('T20-stale-payload-independent-ack', 'authority', ['live'], c => {
  const [p1, p2] = beginWriters(c, 2);
  settled(c.authority({ ops: [set('x', 12)], order: { kind: 'versioned', revision: 12 } }));
  expect(c, snapshot(2), snapshot(12));
  pending(c, p1); pending(c, p2);
  settled(c.authority({
    ops: [set('x', 11)], order: { kind: 'versioned', revision: 11 },
    settlements: [{ kind: 'accepts', id: p1 }],
  }));
  expect(c, snapshot(2), snapshot(12));
  done(c, p1, 'accepted'); pending(c, p2);
  finish(c, p2, 'reject');
  expect(c, snapshot(12));
});
add('T22-unordered-refuses-unchanged', 'authority', ['live'], c => {
  const [p] = beginWriters(c, 1);
  const before = structuredClone(c.state(p));
  observed(c, () => {
    assert.equal(c.authority({ ops: [set('x', 9)], order: { kind: 'unordered' } }).status, 'refused');
  }, snapshot(1), snapshot());
  assert.deepEqual(c.state(p), before);
  pending(c, p);
  finish(c, p, 'reject');
  expect(c, snapshot());
});

for (const first of ['accept', 'reject']) {
  for (const second of ['accept', 'reject']) {
    add(`F-terminal-${first}-then-${second}`, 'terminal', ['live', 'draft'], c => {
      const p = c.begin([set('x', 1), set('y', 2)]);
      finish(c, p, first, 2);
      const expected = first === 'accept' ? snapshot(1, 2) : snapshot();
      expect(c, expected);
      // A later committed value makes a duplicate that replays old work visible.
      settled(c.write([set('x', 9), set('y', 8)], { context: 'local' }));
      expect(c, snapshot(9, 8));
      const state = structuredClone(c.state(p));
      observed(c, () => {
        assert.ok(['settled', 'already-settled'].includes(c[second](p).status));
      }, snapshot(9, 8));
      assert.deepEqual(c.state(p), state);
      done(c, p, first === 'accept' ? 'accepted' : 'rejected', 2);
    });
  }
}

add('O01-live-multifield-accept', 'publication', ['live'], c => {
  let p;
  observed(c, () => { p = c.begin([set('x', 1), set('y', 2)]); }, snapshot(1, 2), snapshot());
  pending(c, p);
  observed(c, () => finish(c, p, 'accept', 2), snapshot(1, 2));
});
add('O02-live-multifield-reject', 'publication', ['live'], c => {
  const p = c.begin([set('x', 1), set('y', 2)]);
  expect(c, snapshot(1, 2), snapshot());
  observed(c, () => finish(c, p, 'reject', 2), snapshot());
});
add('O05-partially-superseded-accept', 'publication', ['live'], c => {
  const p = c.begin([set('x', 1), set('y', 2)]);
  settled(c.write([set('x', 9)], { context: 'local' }));
  expect(c, snapshot(9, 2), snapshot(9));
  pending(c, p);
  observed(c, () => finish(c, p, 'accept', 2), snapshot(9, 2));
});
add('O02-partially-superseded-reject', 'publication', ['live'], c => {
  const p = c.begin([set('x', 1), set('y', 2)]);
  settled(c.write([set('x', 9)], { context: 'local' }));
  expect(c, snapshot(9, 2), snapshot(9));
  observed(c, () => finish(c, p, 'reject', 2), snapshot(9));
});
add('O-authority-settles-two-units-atomically', 'publication', ['live'], c => {
  const p1 = c.begin([set('x', 1)]);
  const p2 = c.begin([set('y', 2)]);
  expect(c, snapshot(1, 2), snapshot());
  observed(c, () => settled(c.authority({
    ops: [set('x', 10), set('y', 20)], order: { kind: 'snapshot' },
    settlements: [{ kind: 'accepts', id: p1 }, { kind: 'rejects', id: p2 }],
  })), snapshot(10, 20));
  done(c, p1, 'accepted'); done(c, p2, 'rejected');
});

// Fair draft controls: no concurrent conflict is required to succeed. Conflicting
// draft merges may legitimately refuse under PROTOCOL; these controls do not
// turn that permission into a loophole in the live scalar permutation matrix.
for (const method of ['accept', 'reject']) {
  add(`D-S01-O-multifield-${method}`, 'publication', ['draft'], c => {
    let p;
    observed(c, () => { p = c.begin([set('x', 1), set('y', 2)]); }, snapshot());
    assert.equal(snap(c.draft(p)), snap(snapshot(1, 2)));
    pending(c, p);
    const expected = method === 'accept' ? snapshot(1, 2) : snapshot();
    observed(c, () => finish(c, p, method, 2), expected);
  });
}
add('D-S03-isolated-proposals', 'scalar', ['draft'], c => {
  const p1 = c.begin([set('x', 1)]);
  const p2 = c.begin([set('x', 2)]);
  expect(c, snapshot());
  assert.equal(snap(c.draft(p1)), snap(snapshot(1)));
  assert.equal(snap(c.draft(p2)), snap(snapshot(2)));
  finish(c, p1, 'reject');
  expect(c, snapshot());
  pending(c, p2);
  assert.equal(snap(c.draft(p2)), snap(snapshot(2)));
  finish(c, p2, 'accept');
  expect(c, snapshot(2));
});
add('D-A1-canonical-advances-draft-keeps-base', 'authority', ['draft'], c => {
  const p = c.begin([set('x', 1)]);
  expect(c, snapshot());
  observed(c, () => settled(c.authority({
    ops: [set('x', 9), set('y', 8)], order: { kind: 'snapshot' },
  })), snapshot(9, 8));
  pending(c, p);
  assert.equal(snap(c.draft(p)), snap(snapshot(1)));
  observed(c, () => finish(c, p, 'reject'), snapshot(9, 8));
});

// Deliberately unasserted where the protocol is silent: equal-revision conflicting
// payloads, unknown IDs, and draft conflict/refusal policy. `includes` is treated
// as successful acceptance of only its named owner; it is not a global watermark.
// Stale payload + fresh ACK must process the relation independently (L11/L12).
