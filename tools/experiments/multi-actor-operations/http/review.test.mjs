import test from 'node:test';
import assert from 'node:assert/strict';
import { startDispatchEndpoint, httpCommandAdapter } from './fixture.mjs';
import { OperationCoordinator } from '../coordinator.mjs';

function command(endpoint, id = 'review-command') {
  return { commandId: id, operationId: id, revision: 1, actor: { kind: 'unknown' }, proposal: endpoint.backend.proposal({ note: 'reviewed' }) };
}
function post(endpoint, body, token = 'fixture-only') {
  return fetch(endpoint.url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body });
}

test('review: forged actor and approval cannot replace host bearer credential', async t => {
  const endpoint = await startDispatchEndpoint(); t.after(() => endpoint.close());
  const payload = { ...command(endpoint), approved: true, actor: { kind: 'verified', label: 'admin' } };
  const response = await post(endpoint, JSON.stringify(payload), 'wrong');
  assert.equal(response.status, 401);
  assert.equal(endpoint.backend.commits, 0);
});

test('review: malformed and overlimit JSON install no state', async t => {
  const endpoint = await startDispatchEndpoint(); t.after(() => endpoint.close());
  assert.equal((await post(endpoint, '{')).status, 400);
  assert.equal((await post(endpoint, JSON.stringify({ commandId: 'x', proposal: { patch: null } }))).status, 200);
  const oversized = JSON.stringify({ ...command(endpoint), padding: 'x'.repeat(65536) });
  assert.equal((await post(endpoint, oversized)).status, 413);
  assert.equal(endpoint.backend.commits, 0);
});

test('review: command key reuse with different content cannot apply a second effect', async t => {
  const endpoint = await startDispatchEndpoint(); t.after(() => endpoint.close());
  const first = command(endpoint);
  assert.equal((await post(endpoint, JSON.stringify(first))).status, 200);
  const changed = { ...first, proposal: endpoint.backend.proposal({ note: 'different' }) };
  assert.equal((await post(endpoint, JSON.stringify(changed))).status, 400);
  assert.equal(endpoint.backend.commits, 1);
  assert.equal(endpoint.backend.snapshot().values.note, 'reviewed');
});

test('review: lost acknowledgment of rejection remains uncertain until correlated retry', async t => {
  const endpoint = await startDispatchEndpoint(); t.after(() => endpoint.close());
  const app = new OperationCoordinator(httpCommandAdapter(endpoint.url));
  app.create('review-rejection', endpoint.backend.proposal({ route: 'west' }));
  app.approve(app.review('review-rejection'));
  endpoint.backend.failNextPersistence();
  endpoint.loseNextAcknowledgment();
  assert.equal((await app.deliver('review-rejection')).status, 'uncertain');
  assert.equal(endpoint.backend.commits, 0);
  const retry = await app.deliver('review-rejection');
  assert.equal(retry.status, 'failed');
  assert.equal(retry.receipt.reason, 'persistence');
  assert.equal(endpoint.backend.commits, 0);
  app.dispose();
});
