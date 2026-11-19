import test from 'node:test';
import assert from 'node:assert/strict';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { reviewAuthority } from './review-fixture.mjs';
const setup = options => {
  const backend = new DispatchBackend();
  const trustedReviewer = Object.freeze({ fixtureCredential: 'reviewer' });
  const gate = reviewAuthority(backend, context => context === trustedReviewer, options);
  const command = { commandId: 'review-bound-command', operationId: 'operation', revision: 1, proposal: backend.proposal({ route: 'west' }) };
  return { backend, trustedReviewer, gate, command };
};
test('server gate requires authenticated-host approval bound to exact command', () => {
  const f = setup();
  assert.throws(() => f.gate.apply({ ...f.command, approved: true }), /approval/);
  assert.throws(() => f.gate.approve(f.command, { fixtureCredential: 'reviewer' }), /unauthorized/);
  assert.equal(f.backend.commits, 0);
  const token = f.gate.approve(f.command, f.trustedReviewer);
  assert.throws(() => f.gate.apply({ ...f.command, proposal: f.backend.proposal({ route: 'south' }) }, token), /mismatched/);
  assert.equal(f.gate.apply(f.command, token).status, 'applied');
  assert.equal(f.gate.apply(f.command, token).status, 'applied');
  assert.equal(f.backend.commits, 1);
  f.gate.dispose();
});
test('approval cannot bypass current backend permission or changed input versions', () => {
  for (const cause of ['permission', 'conflict']) {
    const f = setup(); const token = f.gate.approve(f.command, f.trustedReviewer);
    if (cause === 'permission') f.backend.setAllowed(false);
    else f.backend.apply({ commandId: 'foreign', proposal: f.backend.proposal({ route: 'south' }) });
    const receipt = f.gate.apply(f.command, token);
    assert.equal(receipt.status, 'rejected'); assert.equal(receipt.reason, cause);
    assert.notEqual(f.backend.snapshot().values.route, 'west');
    f.gate.dispose();
  }
});
test('revocation, bounded retention and disposal remove unused authority', () => {
  const f = setup({ maxApprovals: 1 });
  const token = f.gate.approve(f.command, f.trustedReviewer);
  assert.throws(() => f.gate.approve(f.command, f.trustedReviewer), /capacity/);
  f.gate.revoke(token); assert.throws(() => f.gate.apply(f.command, token), /approval/);
  const next = f.gate.approve(f.command, f.trustedReviewer);
  f.gate.dispose(); assert.throws(() => f.gate.apply(f.command, next), /disposed/);
  assert.equal(f.backend.commits, 0);
});
test('authorization callback reentry cannot mint after disposal', () => {
  const backend = new DispatchBackend(); let gate;
  gate = reviewAuthority(backend, () => { gate.dispose(); return true; });
  assert.throws(() => gate.approve({ commandId: 'late', proposal: backend.proposal({ note: 'late' }) }, {}), /disposed/);
  assert.equal(backend.commits, 0);
});
