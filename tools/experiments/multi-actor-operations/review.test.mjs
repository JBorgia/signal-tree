import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationCoordinator } from './coordinator.mjs';
import { DispatchBackend } from './dispatch-fixture.mjs';

function approve(coordinator, backend, id, patch) {
  coordinator.create(id, backend.proposal(patch));
  coordinator.approve(coordinator.review(id));
}

test('adapter reentry cannot duplicate an in-flight attempt', async () => {
  const backend = new DispatchBackend();
  let nested;
  let calls = 0;
  const coordinator = new OperationCoordinator({ apply(command) {
    calls++;
    nested = coordinator.deliver('op');
    assert.throws(() => coordinator.reject('op'));
    return backend.apply(command);
  } });
  approve(coordinator, backend, 'op', { route: 'west' });
  const first = coordinator.deliver('op');
  const result = await first;
  assert.equal(first, nested);
  assert.equal(calls, 1);
  assert.equal(result.status, 'succeeded');
  assert.equal(backend.commits, 1);
});

test('synchronous transport throw cannot be interpreted as definitive rejection', async () => {
  const backend = new DispatchBackend();
  let calls = 0;
  const coordinator = new OperationCoordinator({ apply(command) {
    if (++calls === 1) throw new Error('transport failed before observation');
    return backend.apply(command);
  } });
  approve(coordinator, backend, 'op', { route: 'west' });
  assert.equal((await coordinator.deliver('op')).status, 'uncertain');
  assert.equal(backend.commits, 0);
  assert.equal((await coordinator.deliver('op')).status, 'succeeded');
  assert.equal(backend.commits, 1);
});

test('an approved operation cannot be changed through a retained draft reference', async () => {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  const proposal = structuredClone(backend.proposal({ note: 'reviewed' }));
  coordinator.create('op', proposal);
  coordinator.approve(coordinator.review('op'));
  proposal.patch.note = 'unreviewed';
  assert.throws(() => coordinator.revise('op', proposal));
  assert.equal((await coordinator.deliver('op')).status, 'succeeded');
  assert.equal(backend.snapshot().values.note, 'reviewed');
});

test('permission rejection and lost acknowledgment remain distinct terminal outcomes', async () => {
  const backend = new DispatchBackend();
  backend.setAllowed(false);
  const coordinator = new OperationCoordinator(backend);
  approve(coordinator, backend, 'op', { route: 'west' });
  const result = await coordinator.deliver('op');
  assert.equal(result.status, 'failed');
  assert.equal(result.receipt.reason, 'permission');
  backend.setAllowed(true);
  assert.throws(() => coordinator.deliver('op'));
  assert.equal(backend.commits, 0);
});
