import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalTreeApp } from './c1.mjs';
import { OrdinaryApp } from './c0.mjs';
import { TanStackApp } from './c3.mjs';
import { ReferenceServer } from './reference-server.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';

const arms = [
  ['C0 ordinary', OrdinaryApp, ReferenceServer],
  ['C1 installed SignalTree public package', SignalTreeApp, ReferenceServer],
  ['C2 existing coordinator (no ST integration)', OperationCoordinator, DispatchBackend],
  ['C3 TanStack DB 1.0.0-rc.1', TanStackApp, ReferenceServer],
];
function prepare(app, backend, id, patch, reads) {
  app.create(id, backend.proposal(patch, reads));
  const review = app.review(id);
  app.approve(review);
  return review;
}
for (const [name, App, Backend] of arms) {
  function fixture(t, wrap = server => server) {
    const server = new Backend();
    const transport = wrap(server);
    let teardown = false;
    const app = new App({ apply: (...args) => teardown ? server.apply(...args) : transport.apply(...args) });
    const ids = new Set();
    const create = app.create.bind(app);
    app.create = (id, ...args) => { const result = create(id, ...args); ids.add(id); return result; };
    t.after(async () => {
      teardown = true;
      for (const id of ids) {
        const status = app.inspect(id).status;
        if (['draft', 'reviewed', 'approved'].includes(status)) app.reject(id);
        if (status === 'uncertain') await app.deliver(id);
        app.forget(id);
        assert.throws(() => app.inspect(id));
      }
      await app.dispose();
    });
    return { app, server };
  }
  test(`${name}: immutable proposal, exact approval, successful apply`, async t => {
    const { app, server } = fixture(t);
    const proposal = structuredClone(server.proposal({ note: 'reviewed' }));
    app.create('a', proposal);
    proposal.patch.note = 'unreviewed';
    const binding = app.review('a');
    assert.throws(() => { binding.proposal.patch.note = 'tampered'; }, TypeError);
    assert.throws(() => { app.inspect('a').proposal.patch.note = 'tampered'; }, TypeError);
    app.approve(binding);
    assert.equal((await app.deliver('a')).status, 'succeeded');
    assert.equal(server.snapshot().values.note, 'reviewed');
    assert.equal(server.commits, 1);
  });
  test(`${name}: revised proposal rejects old review and accepts fresh review`, async t => {
    const { app, server } = fixture(t);
    app.create('a', server.proposal({ route: 'west' }));
    const old = app.review('a');
    app.revise('a', server.proposal({ route: 'south' }));
    assert.throws(() => app.approve(old));
    app.approve(app.review('a'));
    assert.equal((await app.deliver('a')).status, 'succeeded');
    assert.equal(server.snapshot().values.route, 'south');
  });
  test(`${name}: stale backend version and ABA are refused`, async t => {
    const { app, server } = fixture(t);
    prepare(app, server, 'a', { route: 'west' });
    prepare(app, server, 'human-1', { route: 'south' });
    await app.deliver('human-1');
    prepare(app, server, 'human-2', { route: 'north' });
    await app.deliver('human-2');
    const result = await app.deliver('a');
    assert.equal(result.status, 'failed');
    assert.equal(result.receipt.reason, 'conflict');
    assert.equal(server.snapshot().values.route, 'north');
    assert.equal(server.commits, 2);
  });
  test(`${name}: independent agent and human progress survives proposal rejection`, async t => {
    const { app, server } = fixture(t);
    prepare(app, server, 'agent-a', { route: 'west' });
    prepare(app, server, 'agent-b', { note: 'call ahead' });
    prepare(app, server, 'human', { window: '10:00' });
    const results = await Promise.all(['agent-b', 'human'].map(id => app.deliver(id)));
    assert.deepEqual(results.map(r => r.status), ['succeeded', 'succeeded']);
    app.reject('agent-a');
    assert.deepEqual(server.snapshot().values, { route: 'north', note: 'call ahead', window: '10:00', capacity: 10 });
    assert.equal(server.commits, 2);
    assert.throws(() => app.deliver('agent-a'));
  });
  test(`${name}: declared external input changes invalidate approval`, async t => {
    const { app, server } = fixture(t);
    prepare(app, server, 'a', { route: 'west' }, ['capacity']);
    prepare(app, server, 'service', { capacity: 5 });
    await app.deliver('service');
    assert.equal((await app.deliver('a')).receipt.reason, 'conflict');
    assert.equal(server.snapshot().values.route, 'north');
  });
  test(`${name}: lost ack retries exact command without duplicate effect`, async t => {
    const calls = [];
    const { app, server } = fixture(t, backend => ({ async apply(command, context) {
      calls.push({ command, context });
      const receipt = backend.apply(command);
      if (calls.length === 1) throw new Error('Lost acknowledgment');
      return receipt;
    } }));
    prepare(app, server, 'a', { route: 'west' });
    assert.equal((await app.deliver('a')).status, 'uncertain');
    assert.equal(server.snapshot().values.route, 'west');
    assert.throws(() => app.reject('a'));
    assert.equal((await app.deliver('a')).status, 'succeeded');
    assert.deepEqual(calls[0].command, calls[1].command);
    assert.notEqual(calls[0].context.attemptId, calls[1].context.attemptId);
    assert.equal(server.commits, 1);
  });
  test(`${name}: failed persistence installs nothing and is terminal`, async t => {
    const { app, server } = fixture(t);
    prepare(app, server, 'a', { route: 'west', note: 'pending' });
    const before = server.snapshot();
    server.failNextPersistence();
    const result = await app.deliver('a');
    assert.equal(result.status, 'failed');
    assert.equal(result.receipt.reason, 'persistence');
    assert.deepEqual(server.snapshot(), before);
    assert.equal(server.commits, 0);
    assert.throws(() => app.deliver('a'));
  });
  test(`${name}: async out-of-order receipts stay correlated; UI actor unknown`, async t => {
    const gates = new Map();
    const { app, server } = fixture(t, backend => ({ apply(command, context) {
      return new Promise(resolve => gates.set(context.operationId, () => resolve(backend.apply(command))));
    } }));
    prepare(app, server, 'ui', { note: 'UI note' });
    prepare(app, server, 'agent', { route: 'west' });
    const first = app.deliver('ui');
    assert.equal(app.deliver('ui'), first);
    const second = app.deliver('agent');
    // Settle microtasks only; no clock sleeps or race-dependent timing.
    for (let i = 0; i < 10 && gates.size < 2; i++) await Promise.resolve();
    assert.equal(gates.size, 2);
    gates.get('agent')();
    assert.equal((await second).id, 'agent');
    assert.equal(app.inspect('ui').status, 'delivering');
    gates.get('ui')();
    assert.deepEqual((await first).actor, { kind: 'unknown' });
    assert.equal(server.commits, 2);
  });
  test(`${name}: foreign acknowledgment cannot become success`, async t => {
    const { app, server } = fixture(t, () => ({ apply() { return { commandId: 'unrelated', status: 'applied' }; } }));
    prepare(app, server, 'a', { route: 'west' });
    assert.equal((await app.deliver('a')).status, 'uncertain');
    assert.equal(server.commits, 0);
  });
}
