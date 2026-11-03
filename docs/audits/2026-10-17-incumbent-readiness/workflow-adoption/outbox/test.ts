import assert from 'node:assert/strict';
import type { PendingTransaction } from '@signal-tree/kernel';
import { deferOperationConsequence } from '/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/packages/kernel/src/lib/internals/commit-consequence';
import { DispatchService as FirstService } from './application-first';
import { activeTransactionContext, transactionLifecycleReader } from '@signal-tree/kernel/internals';
import { DispatchService, type Command } from './application';
export async function run() {
  const results: { name: string; trace: unknown[] }[] = [];
  async function check(name: string, fn: (trace: unknown[]) => Promise<void>) {
    const trace: unknown[] = []; await fn(trace); results.push({ name, trace }); console.log('PASS', name);
  }
  await check('preserved first implementation counterexample: reentrant lifecycle observer loses outer handle', async trace => {
    const app = new FirstService(async () => undefined);
    let inner: PendingTransaction | undefined;
    let armed = true;
    const stop = transactionLifecycleReader(app.tree)!.subscribe(event => {
      if (event.kind === 'opened' && armed) { armed = false; inner = app.tree.transact(() => app.tree.$.truck('T-2')); }
    });
    try {
      assert.throws(() => app.begin(() => {
        app.tree.$.dock(2);
      }), /unsupported nested/);
      assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 2);
      inner!.rollback(); assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 1);
      stop(); trace.push('outer pending authority stranded until whole-tree destroy');
    } finally { app.destroy(); }
  });
  await check('context identity retains outer handle across reentrant observer transaction', async trace => {
    const app = new DispatchService(async () => undefined);
    let inner: PendingTransaction | undefined;
    let armed = true;
    const stop = transactionLifecycleReader(app.tree)!.subscribe(event => {
      if (event.kind === 'opened' && armed) { armed = false; inner = app.tree.transact(() => app.tree.$.truck('T-2')); }
    });
    try {
      const outer = app.begin(() => {
        app.tree.$.dock(2);
      });
      assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 2);
      inner!.rollback(); app.settle(outer, 'rollback');
      assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 0);
      assert.deepEqual(app.tree.$(), { shipment: 'S-104', truck: 'T-1', dock: 1 });
      stop(); trace.push('both handles settle, initial shipment restored');
    } finally { app.destroy(); }
  });
  await check('shipment dispatch narrative: independent progress, joint approval, reject and supersede', async trace => {
    const app = new DispatchService(async (c, id) => { trace.push({ id, c }); });
    try {
      const driver = app.begin(() => app.tree.$.truck('T-7'));
      const dock = app.begin(() => app.tree.$.dock(4));
      const payload = (): Command => ({ kind: 'dispatch', ...app.tree.$() });
      const held = app.enqueue('dispatch-104', payload(), [driver, dock]);
      app.enqueue('audit-104', { kind: 'audit', shipment: 'S-104', note: 'manifest checked' }, []);
      await app.drain(); assert.deepEqual(trace, [{ id: 'audit-104', c: { kind: 'audit', shipment: 'S-104', note: 'manifest checked' } }]);
      assert.equal(held.status, 'queued');
      app.settle(driver, 'confirm'); await app.drain(); assert.equal(trace.length, 1);
      app.settle(dock, 'confirm'); await app.drain();
      assert.deepEqual(trace[1], { id: 'dispatch-104', c: { kind: 'dispatch', shipment: 'S-104', truck: 'T-7', dock: 4 } });
      const rejected = app.begin(() => app.tree.$.truck('T-UNAPPROVED'));
      const captured = payload(); const cancelled = app.enqueue('cancel', captured, [rejected]);
      app.settle(rejected, 'rollback'); await Promise.resolve();
      const deferred = app.enqueue('deferred', captured, [rejected]);
      const old = app.enqueue('old', payload(), []); app.supersede('old');
      app.enqueue('replacement', payload(), []); await app.drain();
      assert.equal(cancelled.status, 'cancelled'); assert.equal(deferred.status, 'cancelled'); assert.equal(old.status, 'superseded');
      assert.deepEqual(trace.map(item => (item as { id: string }).id), ['audit-104', 'dispatch-104', 'replacement']);
      assert.ok(!JSON.stringify(trace).includes('UNAPPROVED'));
    } finally { app.destroy(); }
  });
  await check('endpoint failure, explicit retry, serialized drains, applied but acknowledgement lost', async trace => {
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    let calls = 0;
    const app = new DispatchService(async (c, id) => {
      calls++; trace.push({ applied: id, command: c });
      if (calls === 1) { await gate; throw new Error('ack lost after apply'); }
    });
    try {
      const e = app.enqueue('audit', { kind: 'audit', shipment: 'S-104', note: 'verified' }, []);
      const first = app.drain(); const concurrent = app.drain(); assert.equal(first, concurrent);
      await Promise.resolve(); await Promise.resolve(); assert.equal(calls, 1);
      release(); await Promise.all([first, concurrent]); assert.equal(e.status, 'uncertain');
      await app.drain(); assert.equal(calls, 1); // no automatic retry
      app.retry('audit'); await Promise.all([app.drain(), app.drain()]);
      assert.equal(calls, 2); assert.equal(e.attempts, 2); assert.equal(e.status, 'sent');
      assert.deepEqual(trace.map(item => (item as { applied: string }).applied), ['audit', 'audit']);
    } finally { app.destroy(); }
  });
  await check('destroy distinguishes queued abandonment and in-flight uncertainty', async trace => {
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    const app = new DispatchService(async (_c, id) => { trace.push(id); await gate; });
    const active = app.enqueue('active', { kind: 'audit', shipment: 'S-104', note: 'sent' }, []);
    const queued = app.enqueue('queued', { kind: 'audit', shipment: 'S-104', note: 'unsent' }, []);
    const drain = app.drain(); await Promise.resolve(); await Promise.resolve();
    assert.equal(active.status, 'sending'); app.destroy();
    assert.equal(active.status, 'uncertain'); assert.equal(queued.status, 'abandoned');
    release(); await drain; assert.equal(active.status, 'uncertain'); assert.deepEqual(trace, ['active']);
    assert.throws(() => app.enqueue('late', { kind: 'audit', shipment: 'S-104', note: 'late' }, []), /closed/);
    assert.throws(() => transactionLifecycleReader(app.tree)!.snapshot(), /destroyed/);
    app.destroy();
  });
  await check('rollback refusal retains pending; contained observer error still rolls back', async trace => {
    const app = new DispatchService(async (_c, id) => { trace.push(id); });
    try {
      const a = app.begin(() => app.tree.$.dock(2)); const b = app.begin(() => app.tree.$.dock(3));
      const e = app.enqueue('refused', { kind: 'dispatch', ...app.tree.$() }, [a, b]);
      assert.throws(() => app.settle(a, 'rollback')); assert.equal(a.state, 'pending');
      await app.drain(); assert.equal(trace.length, 0);
      app.settle(b, 'rollback'); app.settle(a, 'rollback'); await app.drain(); assert.equal(e.status, 'cancelled');
      const terminal = app.begin(() => app.tree.$.dock(8));
      const stop = app.tree.$.dock.subscribe(() => { throw new Error('observer failure after compensation'); });
      app.settle(terminal, 'rollback'); stop(); // This neutral leaf delivery swallows subscriber errors.
      assert.equal(terminal.state, 'rejected'); assert.equal(app.tree.$.dock(), 1);
      assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 0);
      trace.push({ terminal: terminal.state, restoredDock: app.tree.$.dock() });
    } finally { app.destroy(); }
  });
  await check('thrown terminal confirmation uses lifecycle truth', async trace => {
    const app = new DispatchService(async (_c, id) => { trace.push(id); });
    try {
      const owner = app.begin(() => {
        app.tree.$.dock(6);
        const context = activeTransactionContext()!;
        // Test-only internal fault injection, matching descriptor-retention.spec.ts.
        deferOperationConsequence(context.owner, context.id, 'failure', () => { throw new Error('durable consequence failed'); });
      });
      app.enqueue('confirmed-command', { kind: 'dispatch', ...app.tree.$() }, [owner]);
      assert.throws(() => app.settle(owner, 'confirm'), /durable consequence failed/);
      assert.equal(owner.state, 'confirmed'); assert.equal(transactionLifecycleReader(app.tree)!.snapshot().pending.length, 0);
      await app.drain(); assert.deepEqual(trace, ['confirmed-command']);
    } finally { app.destroy(); }
  });
  await check('negative control: omitted owner sends unapproved captured input', async trace => {
    const app = new DispatchService(async c => { trace.push(c); });
    try {
      const owner = app.begin(() => app.tree.$.truck('T-SPECULATIVE'));
      app.enqueue('wrong-label', { kind: 'dispatch', ...app.tree.$() }, []);
      await app.drain(); assert.equal(owner.state, 'pending');
      assert.deepEqual(trace, [{ kind: 'dispatch', shipment: 'S-104', truck: 'T-SPECULATIVE', dock: 1 }]);
      app.settle(owner, 'rollback');
    } finally { app.destroy(); }
  });
  return results;
}
