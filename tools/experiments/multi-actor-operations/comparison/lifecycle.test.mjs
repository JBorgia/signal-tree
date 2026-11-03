import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdinaryApp } from './c0.mjs';
import { SignalTreeApp } from './c1.mjs';
import { TanStackApp } from './c3.mjs';
import { ReferenceServer } from './reference-server.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';

for (const [name, App, Backend] of [
  ['C0', OrdinaryApp, ReferenceServer], ['C1', SignalTreeApp, ReferenceServer],
  ['C2', OperationCoordinator, DispatchBackend], ['C3', TanStackApp, ReferenceServer],
]) {
  test(`${name}: churn releases terminal records and old approval bindings cannot target replacements`, async () => {
    const backend = new Backend();
    const app = new App(backend);
    const retained = [];
    for (let i = 0; i < 32; i++) {
      const id = `churn-${i}`;
      app.create(id, backend.proposal({ note: String(i) }));
      const review = app.review(id); retained.push(review);
      if (i % 2) {
        app.approve(review);
        assert.equal((await app.deliver(id)).status, 'succeeded');
      } else app.reject(id);
      app.forget(id);
      assert.throws(() => app.inspect(id), /Unknown/);
    }
    assert.equal(backend.commits, 16);
    // Local stale-binding defense only. Reusing IDs for backend delivery is forbidden.
    app.create('churn-0', backend.proposal({ note: 'replacement' }));
    app.review('churn-0');
    assert.throws(() => app.approve(retained[0]));
    app.reject('churn-0'); app.forget('churn-0');
    await app.dispose(); await app.dispose();
    assert.throws(() => app.create('late', backend.proposal({ note: 'late' })));
    for (let i = 0; i < 32; i++) assert.throws(() => app.inspect(`churn-${i}`));
    assert.equal(retained[1].proposal.patch.note, '1');
  });
  test(`${name}: teardown refuses pending/uncertain work and succeeds after authoritative retry`, async () => {
    const backend = new Backend();
    let finish;
    let calls = 0;
    const app = new App({ apply(command) {
      if (++calls === 1) return new Promise((resolve, reject) => { finish = () => { backend.apply(command); reject(new Error('ack lost')); }; });
      return backend.apply(command);
    } });
    app.create('pending', backend.proposal({ route: 'west' }));
    app.approve(app.review('pending'));
    const flight = app.deliver('pending');
    assert.throws(() => app.forget('pending'));
    await assert.rejects(async () => { await app.dispose(); });
    for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
    assert.equal(typeof finish, 'function');
    finish();
    assert.equal((await flight).status, 'uncertain');
    assert.throws(() => app.forget('pending'));
    await assert.rejects(async () => { await app.dispose(); });
    assert.equal((await app.deliver('pending')).status, 'succeeded');
    assert.equal(backend.commits, 1);
    app.forget('pending'); await app.dispose();
    assert.throws(() => app.inspect('pending'));
  });
}
