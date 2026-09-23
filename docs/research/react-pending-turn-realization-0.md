# REACT-PENDING-TURN-REALIZATION-0

> **Disposition: CLOSED — FIXED 2026-09-22.** A framework
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

## CORRECTION to the first diagnosis

The original entry below said the invalidation was **discarded, not deferred**,
with "nothing re-delivers it". **That was wrong**, and the error is material
because it named the wrong defect class.

`owner-invalidation.ts` subscribed to `onCommitScopesSettled` and re-scheduled
when `requested > 0`. Invalidations were **deferred and re-delivered at
settlement** — which is why React caught up the moment `confirm()` ran. The
problem was never a lost notification; it was **wrong semantic gating**.

```text
INITIAL HYPOTHESIS   pending invalidations are dropped
REFUTED              they are deferred to transaction settlement

ACTUAL DEFECT 1      current-truth observation was gated by SETTLEMENT
ACTUAL DEFECT 2      rollback compensation changed canonical truth without
                     independently invalidating owner observers

FINAL RULE           coherent canonical truth publication
                       IS NOT
                     operation settlement
```

Defect 2 was **masked** by defect 1: one settlement-time delivery happened to
sweep up the final value, so nobody noticed compensation never announced
itself. Fixing the gating alone produced a UI stranded on a withdrawn value —
caught by control D, which existed for exactly that reason.

## The caller audit that decided it

There is exactly **one** production `openCommitScope()` caller, and its own
comment states its job:

> _"Persistence is post-commit: open the deferral scope BEFORE the callback
> runs, so speculative writes inside it queue instead of reaching storage."_

That is **durable-consequence gating**. "Coherent write assembly" has no
production representative at all — coherence comes from the DOUBLE
`queueMicrotask` in `scheduleInvalidation`, which cannot run until a
synchronous callback returns. Owner invalidation was borrowing a gate that was
never about observation.

## Disposition of the old law

> **`OWNER INVALIDATION LAW` — settlement clause SUPERSEDED by
> `CURRENT-TRUTH-OBSERVATION-0`.** It conflated current-truth observation with
> durable consequence publication. Durable-consequence settlement rules are
> unchanged.

Its two contradicting tests were **rewritten, not deleted**, each carrying why.

## CURRENT-TRUTH-OBSERVATION-0

> **Any coherent change to canonical truth must invalidate observers.
> Settlement determines durable consequences, not whether current truth is
> observable.**

```text
ordinary authored write      observable
speculative pending write    observable
realized/external write      observable
rollback compensation        observable
restoration/undo             observable

durable consequence, pending        NOT published
durable consequence, confirmed      published
durable consequence, rolled back    NOT published
```

Authorship decides authority, history and consequences. It does not decide
whether current truth is observable.

## What changed

```text
1  owner-invalidation.ts   settlement no longer gates observation, and the now
                           dead onCommitScopesSettled subscription is removed
                           rather than left harmless
2  transactions.ts         rollback compensation invalidates observers once,
                           after it coherently completes
```

On (2)'s granularity: both throw paths leave canonical truth unchanged, so
invalidating only after success cannot strand a mutation. The first is a
precondition check before any mutation; the second is a refusal, measured in
`proposal-rejection-0` case 15 — after `effect-validation-failed` the scalar
sat at its proposed value and the server's row was intact, i.e. nothing was
compensated. Declined, not partially applied.

## Result

```text
controls A-D              4/4
React Phase B             7/7   (was 5/7)
Angular / Vue / Solid     7/7   unchanged
carrier mutation proofs   all four kill the contract
React full suite          20/20 (was 14/16)
kernel                    286 files / 2410 passed
typecheck                 exit 0
```

React no longer receives a Proposal-specific workaround. It observes the same
canonical speculative truth the kernel, Angular, Vue and Solid already exposed.

## Where it comes from

`packages/kernel/src/lib/internals/owner-invalidation.ts`, in
`scheduleInvalidation`:

```js
if (hasOpenCommitScope(state.owner.$)) {
  state.pending = false;
  return; // dropped — nothing re-delivers it
}
```

While any commit scope is open the invalidation was not scheduled here. **See
the CORRECTION above**: it was not discarded — `onCommitScopesSettled`
re-delivered it at settlement. The comment intends ordering, and the
double-microtask already provides it; the scope check added an unbounded wait
on an unrelated lifecycle.

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

## Acceptance controls — preregistered before touching the seam

Four controls, fixed in advance so the fix has nowhere to hide. All four are
measured through ONE held `useSignalTree` consumer, because a fix that only
works for a freshly mounted component is not a fix.

```text
A  plain write                 React updates normally
                               (guards against breaking the ordinary path)

B  pending transact            React observes the speculative value BEFORE
                               confirm() is called

C  consequence publication     durable/consequence observers do NOT publish
                               early while the turn is still open

D  pending 7 -> rollback       the SAME held consumer observes 0 -> 7 -> 0
```

**C is the one that makes this hard.** B alone is satisfiable by simply
deleting the `hasOpenCommitScope` guard, which would publish deferred
consequences early and collapse the two layers this track exists to keep apart.
B and C must hold simultaneously.

**D is the one that catches a half-fix.** A seam that delivers the speculative
value but not its compensation leaves the UI showing a value the tree no longer
holds — worse than never showing it, because the user acts on it.

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
