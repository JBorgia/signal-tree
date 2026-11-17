import assert from 'node:assert/strict';
import test from 'node:test';
import { signalTree, transactions, external, link } from '@signal-tree/kernel';
import { transactionLifecycleReader, linkStateReader } from '@signal-tree/kernel/internals';
import { OperationCoordinator } from './coordinator.mjs';
import { startDispatchEndpoint, httpCommandAdapter } from './http/fixture.mjs';
import { withCleanup } from './cleanup.mjs';

// Copied into the installed consumer by public-workflow.mjs. This is a real
// loopback HTTP boundary with an intentionally in-memory test authority.
async function session(body) {
  const endpoint = await startDispatchEndpoint({ reviewRequired: true });
  const tree = signalTree({ route: 'north', capacity: 10, note: '', progress: 0 }, { enhancers: [transactions()] });
  const grants = new Map();
  let transportCalls = 0;
  let receiptTransform = (_command, receipt) => receipt;
  const transport = httpCommandAdapter(endpoint.url, 'fixture-only', command => grants.get(command.commandId));
  const operations = new OperationCoordinator({ async apply(command) { transportCalls++; return receiptTransform(command, await transport.apply(command)); } });
  const pending = () => transactionLifecycleReader(tree).snapshot().pending;
  const prepare = (id, observed = endpoint.backend.snapshot(), patch = { route: 'west' }) => {
    operations.create(id, endpoint.backend.proposal(patch, ['capacity'], observed));
    const local = tree.transact(() => { for (const [key, value] of Object.entries(patch)) tree.$[key](value); });
    const binding = operations.review(id);
    const command = Object.freeze({ ...binding, commandId: JSON.stringify([binding.operationId, binding.revision]) });
    grants.set(command.commandId, endpoint.grantReviewForTest(command));
    operations.approve(binding);
    return { local, command, binding };
  };
  await withCleanup(() => body({ endpoint, tree, operations, prepare, pending, transportCalls: () => transportCalls, setReceiptTransform: transform => { receiptTransform = transform; } }),
    [() => operations.dispose(), () => tree.destroy(), () => endpoint.close()]);
}

test('HTTP: reviewed command, pending local owner and acknowledged receipt are separate stages', async () => {
  await session(async ({ endpoint, tree, operations, prepare, pending }) => {
    const { local } = prepare('accepted');
    assert.equal(tree.$.route(), 'west');
    assert.equal(endpoint.backend.snapshot().values.route, 'north');
    assert.equal(endpoint.backend.commits, 0);
    const id = pending()[0].transactionId;
    const outcome = await operations.deliver('accepted');
    assert.equal(outcome.status, 'succeeded');
    assert.equal(pending()[0].transactionId, id, 'Transport success must not silently settle native ownership');
    local.confirm();
    assert.equal(pending().length, 0);
    assert.equal(endpoint.backend.commits, 1);
    assert.equal(endpoint.backend.snapshot().values.route, tree.$.route());
    operations.forget('accepted');
  });
});

test('HTTP: delayed agent observation rejects ABA while independent native work remains useful', async () => {
  await session(async ({ endpoint, tree, operations, prepare, pending }) => {
    const observed = endpoint.backend.snapshot();
    const service = new OperationCoordinator(endpoint.backend);
    for (const capacity of [5, 10]) {
      const id = `external-${capacity}`;
      service.create(id, endpoint.backend.proposal({ capacity }));
      service.approve(service.review(id));
      assert.equal((await service.deliver(id)).status, 'succeeded');
      external(() => tree.$.capacity(capacity));
      service.forget(id);
    }
    service.dispose();
    const { local } = prepare('stale', observed);
    tree.$.note('human edit during the agent delay');
    const writes = [];
    const connection = link(tree.$.progress, { set: value => { writes.push(value); } });
    try {
      const receipt = connection.declare({ kind: 'independent' }, () => tree.$.progress(1));
      await connection.settled();
      assert.ok(writes.includes(1), 'Unrelated pending route must not block useful progress');
      assert.equal(pending().length, 1);
      assert.notEqual(receipt.read().state, 'held');
      const outcome = await operations.deliver('stale');
      assert.equal(outcome.status, 'failed');
      assert.equal(outcome.receipt.reason, 'conflict');
      local.rollback();
      assert.equal(tree.$.route(), 'north');
      assert.equal(tree.$.capacity(), 10);
      assert.equal(tree.$.note(), 'human edit during the agent delay');
      assert.equal(tree.$.progress(), 1);
      assert.equal(pending().length, 0);
      assert.equal(endpoint.backend.commits, 2);
      operations.forget('stale');
      const fresh = prepare('fresh');
      assert.equal((await operations.deliver('fresh')).status, 'succeeded');
      fresh.local.confirm();
      assert.equal(endpoint.backend.commits, 3);
      operations.forget('fresh');
    } finally { connection.dispose(); }
  });
});

test('HTTP: applied then lost acknowledgment retains the same owner and retries one command', async () => {
  await session(async ({ endpoint, operations, prepare, pending }) => {
    const { local } = prepare('lost-ack');
    const id = pending()[0].transactionId;
    endpoint.loseNextAcknowledgment();
    assert.equal((await operations.deliver('lost-ack')).status, 'uncertain');
    assert.equal(endpoint.backend.commits, 1);
    assert.equal(pending()[0].transactionId, id);
    assert.throws(() => operations.forget('lost-ack'));
    assert.equal((await operations.deliver('lost-ack')).status, 'succeeded');
    assert.equal(endpoint.backend.commits, 1);
    assert.equal(pending()[0].transactionId, id);
    local.confirm();
    assert.equal(pending().length, 0);
    operations.forget('lost-ack');
  });
});

test('HTTP: permission revocation refuses; overlap recovery never repeats a terminal server command', async () => {
  await session(async ({ endpoint, tree, operations, prepare, pending, transportCalls }) => {
    const { local } = prepare('revoked');
    const blocker = tree.transact(() => tree.$.route('east'));
    const ids = pending().map(p => p.transactionId);
    endpoint.backend.setAllowed(false);
    const outcome = await operations.deliver('revoked');
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.receipt.reason, 'permission');
    assert.equal(transportCalls(), 1);
    assert.equal(operations.inspect('revoked').attempts, 1);
    assert.throws(() => operations.deliver('revoked'), /Operation cannot be delivered/);
    assert.equal(transportCalls(), 1);
    assert.throws(() => local.rollback());
    assert.deepEqual(pending().map(p => p.transactionId), ids);
    assert.equal(tree.$.route(), 'east');
    assert.equal(endpoint.backend.commits, 0);
    blocker.rollback();
    local.rollback();
    assert.equal(tree.$.route(), 'north');
    assert.equal(pending().length, 0);
    assert.equal(endpoint.backend.commits, 0);
    assert.throws(() => operations.deliver('revoked'), /Operation cannot be delivered/);
    assert.equal(operations.inspect('revoked').attempts, 1);
    assert.equal(transportCalls(), 1);
    operations.forget('revoked');
  });
});

test('HTTP: two simultaneous native owners keep per-command approvals and reject a reordered wrong receipt', async () => {
  await session(async ({ endpoint, tree, operations, prepare, pending, transportCalls, setReceiptTransform }) => {
    const a = prepare('route-A');
    const b = prepare('note-B', endpoint.backend.snapshot(), { note: 'agent note' });
    const ids = pending().map(item => item.transactionId);
    assert.equal(ids.length, 2);
    const acceptedB = await operations.deliver('note-B');
    assert.equal(acceptedB.status, 'succeeded');
    b.local.confirm();
    assert.deepEqual(pending().map(item => item.transactionId), [ids[0]]);
    let corruptOnce = true;
    setReceiptTransform((command, receipt) => {
      if (command.commandId === a.command.commandId && corruptOnce) { corruptOnce = false; return acceptedB.receipt; }
      return receipt;
    });
    const uncertainA = await operations.deliver('route-A');
    assert.equal(uncertainA.status, 'uncertain');
    assert.equal(endpoint.backend.commits, 2);
    assert.deepEqual(pending().map(item => item.transactionId), [ids[0]]);
    tree.$.progress(7);
    assert.equal(tree.$.note(), 'agent note');
    assert.equal(tree.$.progress(), 7);
    const acceptedA = await operations.deliver('route-A');
    assert.equal(acceptedA.status, 'succeeded');
    assert.equal(acceptedA.receipt.commandId, a.command.commandId);
    assert.equal(endpoint.backend.commits, 2);
    assert.equal(transportCalls(), 3);
    a.local.confirm();
    assert.equal(pending().length, 0);
    assert.equal(tree.$.route(), endpoint.backend.snapshot().values.route);
    assert.equal(tree.$.note(), endpoint.backend.snapshot().values.note);
    operations.forget('route-A'); operations.forget('note-B');
  });
});

test('HTTP: dependent publication waits through lost acknowledgment and publishes after correlated receipt plus native confirmation', async () => {
  await session(async ({ endpoint, tree, operations, prepare, pending }) => {
    const { local } = prepare('dependent');
    const values = [];
    const connection = link(tree.$.progress, { set: value => { values.push(value); } });
    try {
      const admission = connection.declare({ kind: 'dependent', owners: [local] }, () => tree.$.progress(tree.$.route() === 'west' ? 1 : 0));
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(admission.read().state, 'held');
      assert.ok(!values.includes(1));
      endpoint.loseNextAcknowledgment();
      assert.equal((await operations.deliver('dependent')).status, 'uncertain');
      assert.equal(endpoint.backend.commits, 1);
      assert.equal(pending().length, 1);
      assert.ok(!values.includes(1));
      assert.equal((await operations.deliver('dependent')).status, 'succeeded');
      assert.equal(pending().length, 1);
      assert.ok(!values.includes(1), 'Remote receipt alone does not consume native responsibility');
      local.confirm();
      await connection.settled();
      assert.ok(values.includes(1));
      assert.equal(pending().length, 0);
      assert.equal(endpoint.backend.commits, 1);
      operations.forget('dependent');
    } finally { connection.dispose(); }
  });
});

test('native boundary control: Link settled is not a successful transport receipt', async () => {
  const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
  const events = [];
  const off = linkStateReader(tree).subscribe(event => events.push(event.kind));
  const attempts = [];
  const connection = link(tree.$.value, { set(value) { attempts.push(value); if (value === 1) throw new Error('injected send failure for confirmed value1'); } });
  try {
    await connection.settled();
    attempts.length = 0; events.length = 0;
    const local = tree.transact(() => tree.$.value(1));
    local.confirm();
    await connection.settled();
    assert.deepEqual(attempts, [1]);
    assert.ok(events.includes('send-failed'));
    assert.equal(transactionLifecycleReader(tree).snapshot().pending.length, 0);
  } finally { connection.dispose(); off(); tree.destroy(); }
});
