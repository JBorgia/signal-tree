import test from 'node:test';
import assert from 'node:assert/strict';
import { startDispatchEndpoint, httpCommandAdapter } from './fixture.mjs';
import { OperationCoordinator } from '../coordinator.mjs';

const command = (endpoint, id) => ({ commandId: id, operationId: id, revision: 1,
  actor: { kind: 'unknown' }, proposal: endpoint.backend.proposal({ route: 'west' }) });
const post = (endpoint, body, bearer = 'fixture-only', grant) => fetch(endpoint.url, {
  method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json',
    ...(grant === undefined ? {} : { 'x-review-grant': grant }) }, body: JSON.stringify(body),
});

test('independent HTTP: bearer, grant, and body consent are distinct at the server', async t => {
  const endpoint = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => endpoint.close());
  const c = command(endpoint, 'credentials'); const token = endpoint.grantReviewForTest(c);
  assert.equal((await post(endpoint, c, token, token)).status, 401);
  assert.equal((await post(endpoint, c, 'wrong', token)).status, 401);
  assert.equal((await post(endpoint, c, 'fixture-only', 'fixture-only')).status, 400);
  assert.equal((await post(endpoint, { ...c, approved: true, reviewGrant: token, reviewerContext: {} })).status, 400);
  assert.equal((await post(endpoint, { ...c, approved: true }, 'fixture-only', token)).status, 400);
  assert.equal(endpoint.backend.commits, 0);
  const response = await post(endpoint, c, 'fixture-only', token);
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'applied');
  assert.equal(endpoint.backend.commits, 1);
});

test('independent HTTP: grant is endpoint-local and all reviewed command fields remain bound', async t => {
  const a = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => a.close());
  const b = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => b.close());
  const c = command(a, 'binding'); const token = a.grantReviewForTest(c);
  assert.equal((await post(b, c, 'fixture-only', token)).status, 400);
  for (const changed of [{ ...c, commandId: 'other' }, { ...c, operationId: 'other' },
    { ...c, revision: 2 }, { ...c, actor: { kind: 'declared', label: 'admin' } },
    { ...c, proposal: { ...c.proposal, expected: { route: 99 } } }]) {
    assert.equal((await post(a, changed, 'fixture-only', token)).status, 400);
  }
  assert.equal(a.backend.commits, 0); assert.equal(b.backend.commits, 0);
  assert.equal((await post(a, c, 'fixture-only', token)).status, 200);
  assert.equal(a.backend.commits, 1);
});

test('independent HTTP: concurrent same-command receipt retries install once; revocation gates cached receipts too', async t => {
  const e = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => e.close());
  const c = command(e, 'concurrent'); const token = e.grantReviewForTest(c);
  const adapter = httpCommandAdapter(e.url, 'fixture-only', () => token);
  e.loseNextAcknowledgment(); await assert.rejects(adapter.apply(c)); assert.equal(e.backend.commits, 1);
  e.backend.setAllowed(false);
  const receipts = await Promise.all([adapter.apply(c), adapter.apply(c), adapter.apply(c)]);
  for (const r of receipts) assert.deepEqual(r, { commandId: c.commandId, status: 'applied' });
  assert.equal(e.backend.commits, 1);
  e.revokeReviewForTest(token); await assert.rejects(adapter.apply(c), /400/);
  assert.equal(e.backend.commits, 1);
});

test('independent HTTP: lost rejection stays uncertain through revoked grant until host restores receipt access', async t => {
  const e = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => e.close());
  let grant;
  const operations = new OperationCoordinator(httpCommandAdapter(e.url, 'fixture-only', () => grant));
  operations.create('rejected-retry', e.backend.proposal({ route: 'west' }));
  const binding = operations.review('rejected-retry'); const c = { ...binding, commandId: JSON.stringify([binding.operationId, binding.revision]) };
  grant = e.grantReviewForTest(c); operations.approve(binding);
  e.backend.failNextPersistence(); e.loseNextAcknowledgment();
  assert.equal((await operations.deliver(binding.operationId)).status, 'uncertain');
  e.revokeReviewForTest(grant);
  assert.equal((await operations.deliver(binding.operationId)).status, 'uncertain');
  assert.throws(() => operations.dispose(), /unresolved/); assert.equal(e.backend.commits, 0);
  grant = e.grantReviewForTest(c);
  const recovered = await operations.deliver(binding.operationId);
  assert.equal(recovered.status, 'failed'); assert.equal(recovered.receipt.reason, 'persistence');
  assert.equal(e.backend.commits, 0); assert.equal(e.backend.snapshot().values.route, 'north');
  e.revokeReviewForTest(grant); operations.dispose();
});

test('independent HTTP: gate defaults off explicitly; enabling it does not replace domain permission', async t => {
  const legacy = await startDispatchEndpoint(); t.after(() => legacy.close());
  const plain = command(legacy, 'optional');
  assert.throws(() => legacy.grantReviewForTest(plain), /not enabled/);
  assert.equal((await httpCommandAdapter(legacy.url).apply(plain)).status, 'applied');
  const gated = await startDispatchEndpoint({ reviewRequired: true }); t.after(() => gated.close());
  const c = command(gated, 'permission'); const token = gated.grantReviewForTest(c);
  gated.backend.setAllowed(false);
  const receipt = await httpCommandAdapter(gated.url, 'fixture-only', () => token).apply(c);
  assert.equal(receipt.status, 'rejected'); assert.equal(receipt.reason, 'permission');
  assert.equal(gated.backend.commits, 0);
});

test('independent HTTP: grant cap and host teardown are finite, not an unresolved-command recovery owner', async () => {
  const e = await startDispatchEndpoint({ reviewRequired: true }); const c = command(e, 'capacity');
  let closed = false;
  try {
    const tokens = Array.from({ length: 128 }, () => e.grantReviewForTest(c));
    assert.throws(() => e.grantReviewForTest(c), /capacity/);
    e.revokeReviewForTest(tokens[0]); assert.equal((await post(e, c, 'fixture-only', tokens[0])).status, 400);
    const replacement = e.grantReviewForTest(c);
    assert.equal((await post(e, c, 'fixture-only', replacement)).status, 200);
    assert.equal(e.backend.commits, 1);
    await e.close(); closed = true;
    assert.throws(() => e.grantReviewForTest(c), /disposed/);
    assert.throws(() => e.revokeReviewForTest(replacement), /disposed/);
  } finally { if (!closed) await e.close(); }
});
