import test from 'node:test';
import assert from 'node:assert/strict';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { reviewAuthority } from './review-fixture.mjs';

const setup = (auth = context => context === 'trusted', options) => {
  const backend = new DispatchBackend();
  const gate = reviewAuthority(backend, auth, options);
  const command = structuredClone({ commandId: 'independent', operationId: 'op', revision: 1, proposal: backend.proposal({ route: 'west' }) });
  return { backend, gate, command };
};

test('independent: all command fields and nested mutations remain bound', () => {
  const { backend, gate, command } = setup();
  const original = structuredClone(command);
  const token = gate.approve(command, 'trusted');
  for (const edit of [c => c.commandId = 'other', c => c.operationId = 'other', c => c.revision++, c => c.proposal.patch.route = 'south', c => c.proposal.expected.route++, c => c.approved = true]) {
    const altered = structuredClone(original); edit(altered);
    assert.throws(() => gate.apply(altered, token), /approval/);
  }
  command.proposal.patch.route = 'south';
  assert.equal(backend.commits, 0);
  assert.equal(gate.apply(original, token).status, 'applied');
  assert.equal(backend.snapshot().values.route, 'west');
  gate.dispose();
});

test('independent: host must return literal true and exceptions mint no authority', () => {
  for (const result of [false, undefined, 1, 'true', {}, Promise.resolve(true)]) {
    const { backend, gate, command } = setup(() => result);
    assert.throws(() => gate.approve(command, 'trusted'), /unauthorized/);
    assert.throws(() => gate.apply(command, 'invented'), /approval/);
    assert.equal(backend.commits, 0); gate.dispose();
  }
  const { gate, command } = setup(() => { throw new Error('host failure'); });
  assert.throws(() => gate.approve(command, 'trusted'), /host failure/); gate.dispose();
});

test('independent: callback mutation cannot change captured approval', () => {
  let command;
  const f = setup(() => { command.proposal.patch.route = 'south'; return true; });
  command = f.command;
  const original = structuredClone(command);
  const token = f.gate.approve(command, 'trusted');
  assert.throws(() => f.gate.apply(command, token), /approval/);
  assert.equal(f.gate.apply(original, token).status, 'applied');
  assert.equal(f.backend.snapshot().values.route, 'west'); f.gate.dispose();
});

test('independent: nested authorization cannot exceed capacity', () => {
  let nested = false, innerToken, gate, command;
  const f = setup(() => {
    if (!nested) { nested = true; innerToken = gate.approve(command, 'trusted'); }
    return true;
  }, { maxApprovals: 1 });
  ({ gate, command } = f);
  assert.throws(() => gate.approve(command, 'trusted'), /capacity/);
  assert.equal(gate.apply(command, innerToken).status, 'applied');
  gate.revoke(innerToken);
  assert.throws(() => gate.apply(command, innerToken), /approval/);
  assert.equal(f.backend.commits, 1); gate.dispose();
});

test('independent: accessors and executable or non-JSON data fail closed', () => {
  const { gate, command, backend } = setup();
  let calls = 0;
  const accessor = { ...command, get extra() { calls++; return true; } };
  const cyclic = { ...command }; cyclic.self = cyclic;
  for (const bad of [accessor, cyclic, { ...command, extra: NaN }, { ...command, extra: undefined }, { ...command, toJSON() { calls++; return command; } }, { ...command, extra: new Date() }]) {
    assert.throws(() => gate.approve(bad, 'trusted'));
  }
  assert.equal(calls, 0); assert.equal(backend.commits, 0); gate.dispose();
});

test('independent: proxy-triggered revocation or disposal during capture prevents use', () => {
  for (const dispose of [false, true]) {
    const { gate, command, backend } = setup();
    const token = gate.approve(command, 'trusted');
    const proxy = new Proxy(command, { ownKeys(target) { if (dispose) gate.dispose(); else gate.revoke(token); return Reflect.ownKeys(target); } });
    assert.throws(() => gate.apply(proxy, token), /approval|disposed/);
    assert.equal(backend.commits, 0); gate.dispose();
  }
});

test('independent: backend rejects malformed approved proposals without partial writes', () => {
  for (const proposal of [null, {}, { entityId: 'other', patch: { route: 'west' }, expected: { route: 0 } }, { entityId: 'delivery-1', patch: { route: 'west', capacity: 'bad' }, expected: { route: 0, capacity: 0 } }, { entityId: 'delivery-1', patch: { route: 'west' }, expected: {} }, { entityId: 'delivery-1', patch: { route: 'west' }, expected: { route: 0, missing: 0 } }, { entityId: 'delivery-1', patch: {}, expected: {} }]) {
    const { gate, command, backend } = setup(); command.proposal = proposal;
    const before = backend.snapshot();
    const token = gate.approve(command, 'trusted');
    assert.equal(gate.apply(command, token).status, 'rejected');
    assert.deepEqual(backend.snapshot(), before); assert.equal(backend.commits, 0); gate.dispose();
  }
});

test('independent: receipts replay across permission change, failures stay terminal, changed content cannot reuse ID', () => {
  for (const fail of [false, true]) {
    const { gate, command, backend } = setup();
    if (fail) backend.failNextPersistence();
    const token = gate.approve(command, 'trusted');
    const receipt = gate.apply(command, token);
    assert.equal(receipt.status, fail ? 'rejected' : 'applied');
    if (fail) assert.equal(receipt.reason, 'persistence');
    backend.setAllowed(false);
    assert.deepEqual(gate.apply(command, token), receipt);
    backend.setAllowed(true);
    assert.deepEqual(gate.apply(command, token), receipt);
    const other = { ...command, proposal: backend.proposal({ note: 'changed' }) };
    const otherToken = gate.approve(other, 'trusted');
    assert.throws(() => gate.apply(other, otherToken), /Idempotency/);
    assert.equal(backend.commits, fail ? 0 : 1);
    gate.revoke(token); assert.throws(() => gate.apply(command, token), /approval/);
    gate.dispose(); assert.throws(() => gate.approve(command, 'trusted'), /disposed/);
  }
});
