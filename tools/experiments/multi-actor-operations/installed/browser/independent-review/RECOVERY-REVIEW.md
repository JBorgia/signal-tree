# Browser recovery correction ready for Faraday review

This implementation worker has stopped editing app.ts/checks.mjs. Review the
current bytes against ../recovery-review/identities.json; old browser evidence is
../history/pre-local-recovery. No external reviewer was launched. This note is a
handoff, not an independent acceptance verdict.

Scope: application glue only. A retained remote terminal outcome is separate from
local native settlement. Local retry calls only the existing confirm/rollback
handle; never deliver. Correlation uses activeTransactionContext().id and public
transactionLifecycleReader facts. An observed matching terminal transition plus
no pending record distinguishes post-terminal observer errors from refusal. An
unverified terminal state is retained for investigation, never silently accepted.

Changes: local-pending phase, server/local outcome display, local recovery button,
adversarial same-field overlap creation/resolution, and a real entity removal
observer failure fixture. Unsent rejection uses the same local recovery path.
Snapshot evidence is bound before tool-stream construction through the backend's
optional observation argument, implemented separately by main.

Validation:
- First exact AOT-class reproduction and original source/assertions preserved in
  ../first-failures/local-recovery. Original version remains a failing control.
- All seven original DOM tests are byte-for-byte unchanged; two new cases pass.
  Nine total, no page errors, full strict AOT. Current evidence work directory:
  /private/tmp/st-p4-browser-W6JNnW.
- Repeated local retry before blocker resolution preserves both IDs; resolving
  newest work restores the original ID; useful retry clears it. Transport calls
  remain exactly one, server commits zero, independent note survives.
- Real onRemove error after rollback is terminal per the public lifecycle;
  reported error is retained in UI, no retry/resubmit, cleanup remains usable.
- Two direct ngOnDestroy controls pass for uncertain and local-pending states.
  Responsibility stays with the live in-memory owner; actual navigation cannot
  be vetoed and no durable handoff or recovery after browser destruction is claimed.
- Public lifecycle observer throw and throwing Link endpoint did not escape
  confirm. No real success/confirm-throw case was constructed; this branch is
  not claimed experimentally qualified. No private hook or fake native handle
  was introduced to manufacture one.
- Main's input-evidence test independently fails on its preserved old backend
  (observed revision 0 upgraded to 1), passes current; all 28 core/protocol tests
  pass. Raw commands/results are in ../recovery-review.

First new DOM run: eight passed, overlap case read old DOM before rendering.
Its full result/source/screenshot remain in first-failures/local-recovery/first-dom-run.
Correction only waits for two rendered IDs before the unchanged length assertion.

The same kernel/Angular tarballs are reused, not rebuilt. No kernel/API, native
candidate, backend approval enforcement or release acceptance claim is made.
