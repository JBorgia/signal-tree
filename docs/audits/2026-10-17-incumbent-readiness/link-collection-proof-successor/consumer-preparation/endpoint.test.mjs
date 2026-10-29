import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createEndpoint } from './endpoint.mjs';

test('real HTTP log, hold, release, fail-before-apply, explicit retry and reset', { timeout: 10000 }, async () => {
  const endpoint = createEndpoint();
  const base = await endpoint.listen();
  const post = (route, body = {}) => fetch(base + '/control/' + route, { method: 'POST', body: JSON.stringify(body) });
  const put = rows => fetch(base + '/orders/PO-42/items', { method: 'PUT', body: JSON.stringify(rows) });
  const get = path => fetch(base + path).then(res => res.json());
  const a = [{ id: 'W1', title: 'Inspect scale', status: 'open' }];
  const b = [{ ...a[0], status: 'ready' }];
  try {
    assert.equal((await put(a)).status, 200);
    assert.deepEqual(await get('/orders/PO-42/items'), a);
    await post('hold');
    const received = once(endpoint.events, 'received');
    const pending = put(b);
    const [id] = await received;
    assert.deepEqual(await get('/orders/PO-42/items'), a);
    assert.deepEqual((await get('/control/log')).held, [id]);
    assert.equal((await post('reset')).status, 409);
    assert.equal((await post('release', { id, outcome: 'ack' })).status, 200);
    assert.equal((await pending).status, 200);
    assert.deepEqual(await get('/orders/PO-42/items'), b);
    await post('fail');
    assert.equal((await put(a)).status, 503);
    assert.deepEqual(await get('/orders/PO-42/items'), b);
    assert.equal((await put(a)).status, 200); // explicit client retry, not Link retry
    assert.deepEqual(await get('/orders/PO-42/items'), a);
    await post('hold');
    const receivedFailure = once(endpoint.events, 'received');
    const heldFailure = put(b);
    const [failId] = await receivedFailure;
    await post('release', { id: failId, outcome: 'fail' });
    assert.equal((await heldFailure).status, 503);
    assert.deepEqual(await get('/orders/PO-42/items'), a);
    assert.deepEqual((await get('/control/log')).log.map(row => row.outcome), ['applied', 'applied', 'failed-before-apply', 'applied', 'failed-before-apply']);
    assert.equal((await put([{ id: 'duplicate' }])).status, 400);
    assert.equal((await post('reset')).status, 200);
    assert.deepEqual((await get('/control/log')).log, []);
    assert.deepEqual(await get('/orders/PO-42/items'), []);
  } finally { await endpoint.close(); }
});

test('shutdown terminates held request without applying it', { timeout: 10000 }, async () => {
  const endpoint = createEndpoint(); const base = await endpoint.listen();
  await fetch(base + '/control/hold', { method: 'POST' });
  const received = once(endpoint.events, 'received');
  const pending = fetch(base + '/orders/PO-42/items', { method: 'PUT', body: JSON.stringify([{ id: 'W1', title: 'Held', status: 'open' }]) });
  await received;
  const closing = endpoint.close();
  assert.equal((await pending).status, 503);
  await closing;
});
