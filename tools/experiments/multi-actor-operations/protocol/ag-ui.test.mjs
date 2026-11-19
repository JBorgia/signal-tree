import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchToolStream } from './ag-ui.mjs';
import { OperationCoordinator } from '../coordinator.mjs';
import { DispatchBackend } from '../dispatch-fixture.mjs';
function fixture(options = {}) {
  const backend = new DispatchBackend();
  const coordinator = new OperationCoordinator(backend);
  const stream = dispatchToolStream({ coordinator, makeProposal: (patch, reads) => backend.proposal(patch, reads), ...options });
  stream.consume({ type: 'RUN_STARTED', threadId: 'thread', runId: 'run' });
  const start = () => stream.consume({ type: 'TOOL_CALL_START', toolCallId: 'tool', toolCallName: 'propose_dispatch' });
  const args = delta => stream.consume({ type: 'TOOL_CALL_ARGS', toolCallId: 'tool', delta });
  const end = () => stream.consume({ type: 'TOOL_CALL_END', toolCallId: 'tool' });
  return { backend, coordinator, stream, start, args, end };
}
test('fragmented tool output creates a proposal; finished run does not grant approval', async () => {
  const f = fixture(); f.start(); f.args('{"patch":{"route":'); f.args('"west"}}');
  const op = f.end();
  assert.equal(op.status, 'draft'); assert.deepEqual(op.actor, { kind: 'unknown' });
  f.stream.consume({ type: 'RUN_FINISHED', threadId: 'thread', runId: 'run' });
  assert.equal(f.backend.commits, 0); assert.throws(() => f.coordinator.deliver(op.id));
  f.coordinator.approve(f.coordinator.review(op.id));
  assert.equal((await f.coordinator.deliver(op.id)).status, 'succeeded');
  f.coordinator.dispose(); f.stream.dispose();
});
test('transport metadata and state events cannot approve or mutate canonical data', () => {
  const f = fixture(); f.start(); f.args('{"patch":{"note":"hello"}}');
  const op = f.end();
  assert.throws(() => f.stream.consume({ type: 'STATE_SNAPSHOT', snapshot: { approved: true, route: 'evil' } }));
  assert.equal(f.coordinator.inspect(op.id).status, 'draft'); assert.equal(f.backend.snapshot().values.route, 'north');
  f.coordinator.reject(op.id); f.coordinator.dispose(); f.stream.dispose();
});
test('invalid and oversize arguments leave no operation', () => {
  const f = fixture({ maxBytes: 8 }); f.start();
  assert.throws(() => f.args('123456789')); f.args('{}');
  assert.throws(() => f.end()); assert.throws(() => f.coordinator.inspect('["thread","run","tool"]'));
  f.coordinator.dispose(); f.stream.dispose();
});
test('duplicate calls, unrelated finishes and incomplete runs are refused', () => {
  const f = fixture(); f.start(); assert.throws(f.start);
  assert.throws(() => f.stream.consume({ type: 'RUN_FINISHED', threadId: 'thread', runId: 'wrong' }));
  assert.throws(() => f.stream.consume({ type: 'RUN_FINISHED', threadId: 'thread', runId: 'run' }));
  f.stream.dispose(); assert.throws(f.end); f.coordinator.dispose();
});
test('host actor context is declared; tool-provided actor and permission are rejected', () => {
  const f = fixture({ actor: { kind: 'declared', label: 'embedded scheduler' } }); f.start();
  f.args('{"patch":{"route":"west"},"actor":"admin"}'); assert.throws(f.end);
  assert.equal(f.backend.commits, 0); f.stream.dispose(); f.coordinator.dispose();
});
