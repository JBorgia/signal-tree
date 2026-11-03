import test from 'node:test';
import assert from 'node:assert/strict';
import { startDispatchEndpoint, httpCommandAdapter } from './fixture.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { withCleanup } from '../cleanup.mjs';
function ready(coordinator, backend, id) {
  coordinator.create(id, backend.proposal({ route: 'west' }));
  coordinator.approve(coordinator.review(id));
}
test('lost HTTP acknowledgment retries the same command without repeating the effect', async () => {
  const endpoint = await startDispatchEndpoint();
  const coordinator = new OperationCoordinator(httpCommandAdapter(endpoint.url));
  await withCleanup(async () => {
    ready(coordinator, endpoint.backend, 'http/1');
    endpoint.loseNextAcknowledgment();
    assert.equal((await coordinator.deliver('http/1')).status, 'uncertain');
    assert.equal(endpoint.backend.commits, 1);
    assert.equal((await coordinator.deliver('http/1')).status, 'succeeded');
    assert.equal(endpoint.backend.commits, 1);
    coordinator.dispose();
  }, [() => endpoint.close()]);
});
test('permission and persistence rejection return correlated failures without installing changes', async () => {
  const endpoint = await startDispatchEndpoint();
  const coordinator = new OperationCoordinator(httpCommandAdapter(endpoint.url));
  await withCleanup(async () => {
    ready(coordinator, endpoint.backend, 'http/denied');
    endpoint.backend.setAllowed(false);
    const denied = await coordinator.deliver('http/denied');
    assert.equal(denied.status, 'failed'); assert.equal(denied.receipt.reason, 'permission');
    endpoint.backend.setAllowed(true);
    ready(coordinator, endpoint.backend, 'http/storage'); endpoint.backend.failNextPersistence();
    const failed = await coordinator.deliver('http/storage');
    assert.equal(failed.status, 'failed'); assert.equal(failed.receipt.reason, 'persistence');
    assert.equal(endpoint.backend.commits, 0);
    coordinator.dispose();
  }, [() => endpoint.close()]);
});
