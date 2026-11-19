import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationCoordinator } from './coordinator.mjs';
import { DispatchBackend } from './dispatch-fixture.mjs';

function ready(coordinator, backend, id, patch, actor, reads) {
  coordinator.create(id, backend.proposal(patch, reads), actor);
  const review = coordinator.review(id);
  coordinator.approve(review);
  return review;
}

test('review is immutable, detached, unforgeable locally, and invalidated by revision', () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  const proposal = structuredClone(backend.proposal({ route: 'west' }));
  coordinator.create('a', proposal);
  proposal.patch.route = 'tampered';
  const review = coordinator.review('a');
  assert.equal(review.proposal.patch.route, 'west');
  assert.throws(() => { review.proposal.patch.route = 'east'; }, TypeError);
  assert.throws(() => coordinator.approve(structuredClone(review)), /Unknown review/);
  coordinator.revise('a', backend.proposal({ route: 'south' }));
  assert.throws(() => coordinator.approve(review), /Stale review/);
  assert.equal(coordinator.inspect('a').revision, 2);
  assert.equal(backend.commits, 0);
});

test('backend rejects reviewed operation after a relevant human edit, including ABA', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  ready(coordinator, backend, 'a', { route: 'west' });
  ready(coordinator, backend, 'human-1', { route: 'south' });
  await coordinator.deliver('human-1');
  ready(coordinator, backend, 'human-2', { route: 'north' });
  await coordinator.deliver('human-2');
  const result = await coordinator.deliver('a');
  assert.equal(result.status, 'failed');
  assert.equal(result.receipt.reason, 'conflict');
  assert.equal(backend.snapshot().values.route, 'north');
  assert.equal(backend.commits, 2);
});

test('two agents and human independently edit the same entity; rejection preserves later work', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  ready(coordinator, backend, 'a', { route: 'west' }, { kind: 'declared', label: 'agent-a' });
  ready(coordinator, backend, 'b', { note: 'call ahead' }, { kind: 'declared', label: 'agent-b' });
  ready(coordinator, backend, 'human', { window: '10:00' });
  assert.deepEqual((await Promise.all(['b', 'human'].map(id => coordinator.deliver(id)))).map(x => x.status), ['succeeded', 'succeeded']);
  coordinator.reject('a');
  assert.deepEqual(backend.snapshot().values, { route: 'north', note: 'call ahead', window: '10:00', capacity: 10 });
  assert.equal(backend.commits, 2);
});

test('explicit read dependencies reject a proposal when an external input changes', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  ready(coordinator, backend, 'a', { route: 'west' }, undefined, ['capacity']);
  ready(coordinator, backend, 'service', { capacity: 5 });
  await coordinator.deliver('service');
  assert.equal((await coordinator.deliver('a')).receipt.reason, 'conflict');
  assert.equal(backend.snapshot().values.route, 'north');
});

test('lost acknowledgment is uncertain; retry keeps command identity and applies once', async () => {
  const backend = new DispatchBackend();
  const calls = [];
  const coordinator = new OperationCoordinator({ async apply(command, context) {
    calls.push({ command, context });
    const receipt = backend.apply(command);
    if (calls.length === 1) throw new Error('ack lost');
    return receipt;
  } });
  ready(coordinator, backend, 'a', { route: 'west' });
  assert.equal((await coordinator.deliver('a')).status, 'uncertain');
  assert.equal(backend.snapshot().values.route, 'west');
  assert.throws(() => coordinator.reject('a'), /potentially delivered/);
  assert.throws(() => coordinator.revise('a', backend.proposal({ route: 'south' })), /cannot be revised/);
  assert.equal((await coordinator.deliver('a')).status, 'succeeded');
  assert.deepEqual(calls[0].command, calls[1].command);
  assert.notEqual(calls[0].context.attemptId, calls[1].context.attemptId);
  assert.equal(backend.commits, 1);
});

test('explicit unknown UI actor remains unknown through asynchronous delivery', async () => {
  const backend = new DispatchBackend();
  const gates = new Map();
  const coordinator = new OperationCoordinator({ apply(command, context) {
    return new Promise(resolve => gates.set(context.operationId, () => resolve(backend.apply(command))));
  } });
  ready(coordinator, backend, 'ui', { note: 'UI input' });
  ready(coordinator, backend, 'agent', { route: 'west' }, { kind: 'declared', label: 'agent' });
  const first = coordinator.deliver('ui');
  assert.equal(coordinator.deliver('ui'), first);
  const second = coordinator.deliver('agent');
  await Promise.resolve();
  gates.get('agent')();
  assert.equal((await second).id, 'agent');
  assert.equal(coordinator.inspect('ui').status, 'delivering');
  gates.get('ui')();
  const result = await first;
  assert.deepEqual(result.actor, { kind: 'unknown' });
  assert.equal(result.id, 'ui');
  assert.equal(result.attempts, 1);
  assert.equal(backend.commits, 2);
});

test('definitive persistence failure does not install state or report success', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  ready(coordinator, backend, 'a', { route: 'west', note: 'pending' });
  const before = backend.snapshot();
  backend.failNextPersistence();
  const result = await coordinator.deliver('a');
  assert.equal(result.status, 'failed');
  assert.equal(result.receipt.reason, 'persistence');
  assert.deepEqual(backend.snapshot(), before);
  assert.equal(backend.commits, 0);
  assert.throws(() => coordinator.deliver('a'), /cannot be delivered/);
});

test('server permission revocation overrides local approval', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  ready(coordinator, backend, 'a', { route: 'west' });
  backend.setAllowed(false);
  assert.equal((await coordinator.deliver('a')).receipt.reason, 'permission');
  assert.equal(backend.commits, 0);
});

test('unrelated acknowledgment cannot mark success; backend rejects key reuse', async () => {
  const backend = new DispatchBackend();
  let captured;
  const coordinator = new OperationCoordinator({ apply(command) {
    captured = command;
    backend.apply(command);
    return { status: 'applied', commandId: 'other' };
  } });
  ready(coordinator, backend, 'a', { route: 'west' });
  assert.equal((await coordinator.deliver('a')).status, 'uncertain');
  const forged = structuredClone(captured);
  forged.proposal.patch.route = 'south';
  assert.throws(() => backend.apply(forged), /reused with different content/);
  assert.equal(backend.commits, 1);
});

test('unsupported proposal data is rejected before recording or revising', () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  const cycle = {}; cycle.self = cycle;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { throw new Error('getter must not run'); } });
  for (const bad of [new Map(), new Date(), cycle, undefined, NaN, 1n, () => {}, accessor, Array(2)]) {
    assert.throws(() => coordinator.create('bad', { nested: bad }), /JSON-like|Cyclic|Sparse/);
    assert.throws(() => coordinator.inspect('bad'), /Unknown operation/);
  }
  coordinator.create('valid', backend.proposal({ route: 'west' }));
  const before = coordinator.inspect('valid');
  assert.throws(() => coordinator.revise('valid', { nested: cycle }), /Cyclic/);
  assert.deepEqual(coordinator.inspect('valid'), before);
});

test('external snapshots and reviews cannot mutate operation or accepted state', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  const actor = { kind: 'declared', label: 'agent-a' };
  coordinator.create('a', backend.proposal({ route: 'west' }), actor);
  actor.label = 'changed';
  const snapshot = coordinator.inspect('a');
  const review = coordinator.review('a');
  assert.throws(() => { snapshot.actor.label = 'forged'; }, TypeError);
  assert.throws(() => { snapshot.proposal.expected.route = 99; }, TypeError);
  assert.throws(() => { review.proposal.patch.route = 'south'; }, TypeError);
  coordinator.approve(review);
  await coordinator.deliver('a');
  assert.equal(coordinator.inspect('a').actor.label, 'agent-a');
  assert.equal(backend.snapshot().values.route, 'west');
});

test('forget and dispose refuse unresolved work and release terminal records', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator({ apply() { throw new Error('offline'); } });
  const binding = ready(coordinator, backend, 'a', { route: 'west' });
  assert.throws(() => coordinator.forget('a'), /unresolved/);
  const flight = coordinator.deliver('a');
  assert.throws(() => coordinator.dispose(), /unresolved/);
  assert.throws(() => coordinator.forget('a'), /unresolved/);
  await flight;
  assert.equal(coordinator.inspect('a').status, 'uncertain');
  assert.throws(() => coordinator.dispose(), /unresolved/);
  assert.throws(() => coordinator.forget('a'), /unresolved/);

  const terminal = new OperationCoordinator(backend);
  ready(terminal, backend, 'done', { note: 'done' });
  await terminal.deliver('done');
  terminal.forget('done');
  assert.throws(() => terminal.inspect('done'), /Unknown/);
  terminal.create('rejected', backend.proposal({ route: 'west' }));
  const old = terminal.review('rejected');
  terminal.reject('rejected');
  terminal.forget('rejected');
  terminal.create('rejected', backend.proposal({ route: 'south' }));
  terminal.review('rejected');
  assert.throws(() => terminal.approve(old), /Stale/);
  assert.throws(() => terminal.approve(binding), /Unknown review/);
  terminal.reject('rejected');
  terminal.dispose();
  terminal.dispose();
  assert.throws(() => terminal.create('new', {}), /disposed/);
  assert.throws(() => terminal.inspect('rejected'), /disposed/);
});
