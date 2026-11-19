import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchToolStream } from './ag-ui.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';

test('tool completion preserves versions of the observation supplied before reasoning', async () => {
  const backend = new DispatchBackend();
  // This is the data/version packet the host supplied to its producer. It is
  // not a version inferred from the later arrival of the producer's response.
  const observed = backend.snapshot();
  const operations = new OperationCoordinator(backend);
  const stream = dispatchToolStream({ coordinator: operations,
    makeProposal: (patch, reads) => backend.proposal(patch, reads, observed) });
  stream.consume({ type: 'RUN_STARTED', threadId: 'input-test', runId: 'r1' });
  stream.consume({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'propose_dispatch' });
  backend.apply({ commandId: 'independent/capacity', proposal: backend.proposal({ capacity: 0 }) });
  stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"patch":{"route":"west"},"reads":["capacity"]}' });
  const operation = stream.consume({ type: 'TOOL_CALL_END', toolCallId: 't1' });
  assert.equal(operation.proposal.expected.capacity, 0, 'completion must not upgrade the observed version');
  operations.approve(operations.review(operation.id));
  const outcome = await operations.deliver(operation.id);
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.receipt.reason, 'conflict');
  assert.equal(backend.snapshot().values.route, 'north');
  assert.equal(backend.commits, 1);
  operations.dispose(); stream.dispose();
});
