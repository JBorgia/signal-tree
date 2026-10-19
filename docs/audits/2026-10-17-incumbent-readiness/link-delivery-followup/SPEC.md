# Delivery and eligibility follow-up — acceptance before execution

Baseline 65dd717fcda88663d0200c5b254784aec37f9239, production runtime unchanged.
Owner instruction: “Define which payload/version each eligibility decision covers;
do not reuse that decision for a different value.” “An already-started request may
require a subsequent corrective send rather than cancellation.”

Private research only; same A/B/C policies, no API or production edits. B closed.
Eligibility and delivery are separate claims. Unknown evidence cannot become clean
on confirmation alone. No asynchronous inference is added.

## State contract

Each connection has a latest requested immutable payload revision, its evidence,
and at most one started endpoint request. Eligibility applies to that revision
only. Held/eligible describe requested work; in-flight may coexist with a newer
held or eligible revision. Superseded describes obsolete unstarted work, not a
cancellable already-started effect. Disposed is terminal for new endpoint calls.

- Offer: replace latest requested revision atomically, preserving evidence. An old
  unstarted continuation cannot authorize or install another payload.
- Eligibility change: reevaluate the same revision against current terminal owner
  outcomes. A held send must not occupy an unresolved queue dependency that blocks
  a subsequent eligible revision.
- Start: select an eligible revision, run observation, then recheck disposal,
  revision identity and eligibility immediately before endpoint invocation.
- Reentry: new unknown work holds; new eligible work is reconsidered. Throwing
  observation cannot leave an immortal in-flight marker or lost waiter.
- Complete: acknowledge only the exact payload sent. Reconcile latest requested
  work after completion. Never regress acknowledgement to a different revision.
- Failure: preserve current eligibility and permit subsequent eligible work using
  existing error reporting; no automatic unbounded retry loop.
- Dispose: stop future calls and resolve/cancel internal waiting work. An endpoint
  call already started is not claimed recalled. Tree destruction is measured
  separately from explicit connection disposal; prior inherited failure preserved.

## Immutable evidence contract

Authoritative facts cannot be mutated through returned references. Owner identity
cannot be reset. Pending may become confirmed/rejected/destroyed once; repeating
an identical terminal outcome may be idempotent; terminal reversal must throw
without changing evidence or eligibility. Known dependency omission remains invalid.
Original trusted-harness tests using terminal reversal are preserved as fixture
mismatches; contract-valid setups must retain original observable assertions.

## Finite acceptance set

1. Replay prior actual-Link witness unchanged; label inherited control/harness
   failures separately. No blanket all-green claim.
2. Queued reentry replaces captured42 before start: never send obsolete42; eligible
   replacement must progress, unknown replacement remains held.
3. Started42, unknown7, acknowledgement, eligible9: deliver42 then9 serially.
4. Started42, newer eligible9: delivery completion converges to9, never reverse it.
5. Observer throw and later eligible revision: no stranded delivery.
6. Connection disposal before start / after start: zero calls / only started call.
7. Preserve ingress42 and7 with unrelated pending x, leakage controls, contradictory
   declarations, multiple owners, whole-payload revision association.
8. Runtime mutation and terminal-reset attacks fail without changing authority.
9. Direct ordinary constant after confirmation: trace whether evidence remains
   unknown or delivery fails to wake. If still unknown, explicitly UNMET, not a pass.

One implementation revision, independent review and deterministic replay. If any
new mechanism-level failure recurs, preserve it and stop rather than expanding
options. Passing delivery does not qualify missing evidence capture, frameworks,
entities, cost, retention or release. Failed acceptance returns a concrete scope
choice; it does not silently narrow automatic independent progress.
