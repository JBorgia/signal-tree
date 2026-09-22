# REACT-PENDING-TURN-REALIZATION-0

> **Disposition: OPEN — preregistered 2026-09-22. Non-shipping.** A framework
> realization defect found by the PROPOSAL-0 Phase B conformance contract. It is
> **not** a Proposal defect, and it is not a kernel semantics defect.

## What was measured

React's `useSignalTree` consumer does not observe speculative state during a
pending turn. Measured with **raw `transaction()`**, no Proposal involved:

```text
plain write             tree = 3    React sees 3     OK
raw transaction()       tree = 7    React sees 3     FAILS   <- before confirm
after confirm           tree = 7    React sees 7
second pending turn     tree = 11   React sees 7     FAILS
after rollback          tree = 7    React sees 7
```

The control was run precisely because Phase B first surfaced this through
`propose()`. Since the facade is a naming layer over `transaction()`, the
cheapest discriminator was to remove the facade from the picture entirely:

```text
raw transaction ALSO invisible   -> generic React realization defect   <- MEASURED
raw transaction visible,
  propose invisible              -> Proposal facade defect             -> not the case
```

So `PROPOSAL-0` is not reopened. Phase A's recorded result stands unchanged:
kernel speculative state IS live-readable. React is failing to physically
realize an established kernel truth.

## Where it comes from

`packages/kernel/src/lib/internals/owner-invalidation.ts`, in
`scheduleInvalidation`:

```js
if (hasOpenCommitScope(state.owner.$)) {
  state.pending = false;
  return; // dropped — nothing re-delivers it
}
```

While any commit scope is open the invalidation is **discarded**, not deferred.
The comment above it intends ordering — "settle before an adapter is told to
reread externally visible truth" — but the implementation achieves suppression.

Blast radius is React alone: it is the only adapter that consumes
`observeOwnerInvalidation`. Angular, Vue and Solid use fine-grained carriers and
all pass the same contract 7/7.

## The fix that must NOT be applied

> Reschedule the dropped invalidation on settlement.

Rejected before implementation. It would repair the lost notification but would
**still fail Phase B case 1**, because the consumer would only be told to reread
at `confirm()`. A reviewer who cannot see a proposal until they accept it has no
review surface at all — which is the entire product requirement.

## The actual question

> How should React's observation seam publish live speculative state without
> prematurely publishing transaction consequences that are intentionally
> deferred?

The two layers this track must not collapse, both already established:

```text
TREE / UI OBSERVATION      speculative state SHOULD be visible while pending
CONSEQUENCE PUBLICATION    effects stay DEFERRED until settlement
```

The open commit scope legitimately gates the second. It is currently also
gating the first, and those are different questions.

## Falsifiers

- a fix that publishes deferred consequences early to make the UI update
- a fix that makes the UI update only at settlement (fails case 1)
- a fix that special-cases Proposal rather than pending turns generally
- a change to `hasOpenCommitScope`'s meaning rather than to what is gated on it
- any divergence introduced between adapters: Angular, Vue and Solid pass today
  and must still pass afterwards

## Exit

The Phase B contract is the acceptance test. React must reach 7/7 on the same
shared assertions the other three already satisfy, with its native-carrier
mutation proof killing the contract as theirs do.

## Provenance

Found by `PROPOSAL-REALIZATION-CONFORMANCE` (PROPOSAL-0 Phase B), preserved on
branch `phase-b-proposal-realization`. At pause: Solid 7/7, Vue 7/7, Angular
7/7, React 5/7 — failing case 1 (speculative publication) and case 3 (reject
republication).

This is the finding the conformance contract existed to produce: an established
kernel semantic that three adapters realize and one does not, invisible to spec
counts and to every other gate.
