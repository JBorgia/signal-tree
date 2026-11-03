import assert from 'node:assert/strict';
import { signalTree, transactions, external } from '@signal-tree/kernel';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
import { withCleanup } from '../cleanup.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';

const results: { name: string; outcome: string }[] = [];
async function check(name: string, body: () => Promise<void>) {
  await body(); results.push({ name, outcome: 'PASS' });
}

await check('accepted reviewed backend command and local transaction have separate terminality', async () => {
  const backend = new DispatchBackend();
  const operations = new OperationCoordinator(backend);
  const tree = signalTree({ route: 'north', note: '', capacity: 10 }, { enhancers: [transactions()] });
  await withCleanup(async () => {
    operations.create('workflow/accepted', backend.proposal({ route: 'west' }, ['capacity']), { kind: 'declared', label: 'scheduler' });
    const local = tree.transact(() => tree.$.route('west'));
    operations.approve(operations.review('workflow/accepted'));
    assert.equal(backend.snapshot().values.route, 'north');
    assert.equal(tree.$.route(), 'west');
    const outcome = await operations.deliver('workflow/accepted');
    assert.equal(outcome.status, 'succeeded');
    // Server result authorizes this application decision; delivery completion alone would not.
    local.confirm();
    assert.equal(backend.snapshot().values.route, tree.$.route());
    operations.forget('workflow/accepted');
  }, [() => tree.destroy(), () => operations.dispose()]);
});

await check('backend input revision rejects ABA while native rollback preserves an independent note', async () => {
  const backend = new DispatchBackend();
  const operations = new OperationCoordinator(backend);
  const service = new OperationCoordinator(backend);
  const tree = signalTree({ route: 'north', note: '', capacity: 10 }, { enhancers: [transactions()] });
  await withCleanup(async () => {
    operations.create('workflow/stale', backend.proposal({ route: 'west' }, ['capacity']));
    const local = tree.transact(() => tree.$.route('west'));
    operations.approve(operations.review('workflow/stale'));
    for (const capacity of [5, 10]) {
      const id = `service/${capacity}`;
      service.create(id, backend.proposal({ capacity }));
      service.approve(service.review(id));
      assert.equal((await service.deliver(id)).status, 'succeeded');
      external(() => tree.$.capacity(capacity));
      service.forget(id);
    }
    tree.$.note('independent');
    assert.equal(tree.$.capacity(), 10);
    const outcome = await operations.deliver('workflow/stale');
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.receipt.reason, 'conflict');
    local.rollback();
    assert.equal(tree.$.route(), 'north');
    assert.equal(tree.$.note(), 'independent');
    operations.forget('workflow/stale');
  }, [() => tree.destroy(), () => operations.dispose(), () => service.dispose()]);
});

await check('lost acknowledgment retains local settlement authority until correlated retry', async () => {
  const backend = new DispatchBackend();
  let lose = true;
  const operations = new OperationCoordinator({ apply(command: unknown) {
    const receipt = backend.apply(command);
    if (lose) { lose = false; throw new Error('lost acknowledgment'); }
    return receipt;
  } });
  const tree = signalTree({ route: 'north' }, { enhancers: [transactions()] });
  await withCleanup(async () => {
    operations.create('workflow/retry', backend.proposal({ route: 'west' }));
    const local = tree.transact(() => tree.$.route('west'));
    operations.approve(operations.review('workflow/retry'));
    assert.equal((await operations.deliver('workflow/retry')).status, 'uncertain');
    assert.ok(local.inspect().changes.length > 0);
    assert.equal(transactionLifecycleReader(tree)!.snapshot().pending.length, 1);
    const pendingId = transactionLifecycleReader(tree)!.snapshot().pending[0].transactionId;
    assert.throws(() => operations.forget('workflow/retry'));
    assert.equal((await operations.deliver('workflow/retry')).status, 'succeeded');
    assert.equal(transactionLifecycleReader(tree)!.snapshot().pending[0].transactionId, pendingId);
    local.confirm();
    assert.equal(transactionLifecycleReader(tree)!.snapshot().pending.length, 0);
    assert.equal(backend.commits, 1);
    assert.equal(tree.$.route(), 'west');
    operations.forget('workflow/retry');
  }, [() => tree.destroy(), () => operations.dispose()]);
});
console.log(JSON.stringify({ sourceHead: '5727cd8fcf701128358674411400c019b137a5e4', evidence: 'public-source-bundle, simulated backend, kernel only', results }, null, 2));
