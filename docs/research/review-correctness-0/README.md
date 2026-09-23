# REVIEW-CORRECTNESS-0 — preregistration

Status: PREREGISTERED, not yet run. Written 2026-09-23, before any arm executed.
Program: PRODUCT-ARCH-0. npm 16.0.0 publish is FROZEN for the duration.

## Why this runs first

It is the cheapest experiment that can kill the supposed transaction/proposal
wedge. If it dies here, `EXTERNAL-PROPOSAL-0`, actor identity, Relay, MCP and
Studio product work are all moot.

## Hypothesis under test

> SignalTree can **reverse** one writer's contribution while preserving later
> and unrelated truth, in cases where competing models require broader
> rollback, application-specific conflict reconstruction, or cannot
> distinguish subject lifetime correctly.

NOT the hypothesis: "SignalTree has transactions." TanStack DB already does.

## Scoring — independent axes, not one label

REVISED 2026-09-23 before execution. The first draft used four mutually
exclusive labels. That was wrong twice over: refusal and correctness are
different properties, and one of the labels ("STRANDED") asserted a lifecycle
fact no measurement had established. Score every arm/case on four axes:

    REVERSAL     COMPLETE | PARTIAL | NONE
    SAFETY       PRESERVED_NEWER_TRUTH | CORRUPTED_NEWER_TRUTH
    SETTLEMENT   SETTLED | REFUSED_RECOVERABLE | REFUSED_POISONED | UNKNOWN
    ATOMICITY    WHOLE_OPERATION | PARTIAL_OPERATION

**Only `COMPLETE + PRESERVED_NEWER_TRUTH + SETTLED` satisfies the surgical
reversal wedge.** A safe refusal is genuinely better than corruption and the
axes must say so, but it does not satisfy the hypothesis: any store can refuse.

Worked examples:

    R3 (SignalTree's strongest)      R5 (refusal)                 an ugly implementation
      REVERSAL    COMPLETE             REVERSAL    NONE             REVERSAL    PARTIAL
      SAFETY      PRESERVED            SAFETY      PRESERVED        SAFETY      CORRUPTED
      SETTLEMENT  SETTLED              SETTLEMENT  REFUSED_?        SETTLEMENT  SETTLED
      ATOMICITY   WHOLE                ATOMICITY   WHOLE            ATOMICITY   PARTIAL

The `?` on R5 is deliberate: recoverable vs poisoned is UNMEASURED. See
R6-LIVENESS-0.

## Arms

    A   SignalTree, current transact()/propose() implementation
    B   TanStack DB, implemented to WIN (manual transactions, autoCommit:false)
    C   ordinary strong store (reducer/immer + explicit snapshots), implemented to WIN
    N   null arm #35 — "stay a state library". Mandatory control.

Arms B and C are built OUTSIDE production SignalTree code. No production
kernel source is modified by this experiment.

## Cases

    R1  scalar, no concurrency           T1 x:0->1; reject; expect x=0
    R2  unrelated later write            T1 x:0->1; later y:0->2; reject; x=0 AND y=2
    R3  same-field newer truth           T1 x:0->1; later x->2; reject; x=2 SURVIVES
    R4  proposed add later removed       T1 add A; later remove A; reject; no resurrection
    R5  proposed add later edited        T1 add A; later update A; reject; dependent truth intact
    R6  remove/re-add same business key  T1 remove A(S1); later add A(S2); reject; S2 untouched
    R7  rekey + later operation          T1 A->A2; later update/remove same subject; reject; no lifetime confusion
    R8  two overlapping proposals        P1,P2 partly-overlapping fields/entities; settle BOTH orders

## Arm A is already answered for R1-R7 — these are INPUTS, not experiments

Settled findings are inputs and must not be re-derived. Citations are to the
working tree at 2026-09-23.

    R1  COVERED   proposal-rejection-0.spec.ts:127    REVERSED
    R2  COVERED   proposal-rejection-0.spec.ts:319    REVERSED
    R3  COVERED   proposal-rejection-0.spec.ts:146,168 REVERSED (supersession)
    R4  COVERED   proposal-rejection-0.spec.ts:351,379 REVERSED (supersession)
    R5  COVERED   proposal-rejection-0.spec.ts:293    REVERSAL NONE, SAFETY PRESERVED, SETTLEMENT UNMEASURED
    R6  COVERED   proposal-rejection-0.spec.ts:463    REVERSAL PARTIAL?, SAFETY PRESERVED, SETTLEMENT UNMEASURED
    R7  COVERED   rekey-supersession-0.spec.ts (5)    REVERSED
    R8  PARTIAL   -- the only unknown in arm A

Under the revised axes, arm A reaches the full wedge condition
(COMPLETE + PRESERVED + SETTLED) on R1, R2, R3, R4, R7 only. R5 and R6 refuse,
and **their SETTLEMENT axis is unmeasured** — which R6-LIVENESS-0 now closes
before any competitor arm is built.

### Two facts recorded against SignalTree, verified in source

1. `transactions.ts:386` — "`hasSameSubjectDependency` is named for a dependency
   test but implements a **presence** test: any later effect on the same subject
   refuses." The structural arm is over-broad by construction: it refuses
   whenever anything later touched the subject, not only when something depends
   on it. The wedge accuses competitors of requiring broader rollback; here
   SignalTree requires broader refusal.

2. `proposal-rejection-0.spec.ts:463` (case 15, PRE-EXISTING, TODO.md:1373)
   — a pending REMOVE superseded by a later add returns
   `'effect-validation-failed'`, preserves the server row, and leaves `x` at
   its proposed value `1` **at the moment of the throw**. What this does NOT
   establish is the proposal's lifecycle state afterwards. `reject()` runs
   `pending.rollback()` and assigns `settled` only if it returns
   (`transactions.ts:2384-2390`), so a throw leaves `settled` undefined and
   `inspect()` falling back to live `read()`. The turn may therefore still be
   OPEN and recoverable rather than half-settled. An earlier draft of this
   document called it STRANDED; that label is WITHDRAWN as unmeasured.

## R6-LIVENESS-0 — runs FIRST, before R8

Closes the SETTLEMENT axis for a refused rejection. Cheapest experiment in the
program; it is a handful of assertions on an existing scenario.

    initial   A(S1), x=0
    P1        x=1 ; remove A(S1)
    later     add A(S2)            (same business key, new subject)
    reject P1 -> throws 'effect-validation-failed'

    THEN MEASURE, rather than infer:
      __transactions.getPendingTurnCount() / getPendingTurnIds()
      proposal.inspect()          -- live read, or a settled snapshot?
      is accept() still legal?
      is reject() retryable?
      remove S2, retry reject: does x return to 0 and S1 restore correctly?

Three materially different outcomes, only the last of which is "stranded":

    REFUSED_RECOVERABLE   rollback refused, proposal still pending,
                          conflict resolvable, retry succeeds
    REFUSED_POISONED      still nominally pending, can never settle correctly
    PARTIALLY_SETTLED     considered rejected/closed while speculative
                          contribution remains

**Do not fix R6 before characterizing it.** It is currently excellent evidence.
Measure the failure completely, then decide whether it is a bug worth fixing or
evidence that the optimistic-live proposal architecture is the wrong model.

## R8 — concrete, overlapping, both orders

Not "partly overlapping" in prose. The fixture is:

    base   x=0  y=0  z=0
    P1     x=1  y=1
    P2          y=2  z=2        <- P2 supersedes P1 on y; x and z are disjoint

Eight settlements, all through the public `transact()`/`propose()` API:

    A  reject P1 -> accept P2        E  reject P1 -> reject P2
    B  accept P2 -> reject P1        F  reject P2 -> reject P1
    C  reject P2 -> accept P1        G  accept P1 -> accept P2
    D  accept P1 -> reject P2        H  accept P2 -> accept P1

### Preregistered expected final states, recorded before writing the spec

    A  x=0 y=2 z=2   reject P1 reverses x; y NOT reverted (superseded by P2)
    B  x=0 y=2 z=2   same, order-independent
    C  x=1 y=1 z=0   rollback of P2 must restore y to P1's PENDING 1, not 0
    D  x=1 y=1 z=0   P1 confirmed first; P2 rollback returns y to P1's value
    E  x=0 y=0 z=0   P2 rollback must NOT resurrect rejected P1's y=1
    F  x=0 y=0 z=0   full baseline
    G  x=1 y=2 z=2   both confirmed; P2's y wins as the later write
    H  x=1 y=2 z=2   same

C and E are the discriminating cases.
  C fails if rolling back P2 restores y to the true baseline 0 — that would
    destroy P1's still-pending contribution (SAFETY CORRUPTED).
  E fails if rolling back P2 restores y to 1 — resurrecting a contribution
    from an already-rejected proposal.

The question is not "does it throw". It is: **can it remove exactly P1's
surviving contribution without damaging P2's?**

## Execution order — cheapest falsifier first

    1. R6-LIVENESS-0. Closes the SETTLEMENT axis on the two refusal cases.
    2. R8 against arm A ALONE, all eight orderings. If SignalTree cannot
       surgically separate overlapping SCALAR proposals, the wedge does not
       survive our own implementation and no competitor arm is needed.
    3. Only then build arms B and C, for the discriminator subset
       R3/R5/R6/R7/R8. R1/R2/R4 are commodity; every serious store passes them.

## Kill rule

Burden is measured as what the APPLICATION must supply, not package size or LOC:

    custom conflict algorithms
    manual whole-row or whole-entity snapshots
    manual per-field merge rules
    manual subject-lifetime IDs
    application-specific rollback code
    extra semantic annotations

**The wedge is retired if** arm B or arm C reaches REVERSED on the same
discriminator cases as arm A without reconstructing SignalTree's semantic
machinery in application code.

**The wedge is real only if** a competitor fails specifically because whole-row
transaction layering cannot express subject/field supersession cleanly — the
failure mode TanStack's own docs make plausible, which is why this is a fair
test rather than a straw man.

**Null arm #35 wins by default** if the differentiation is real but costs more
adoption than it returns. #35 is the only arm with zero adoption cost, and its
absence from earlier planning was a methodological error.

## Standing rule for the whole program

> A missing capability is no longer permission to build it. It is a question to test.

## Recorded alongside, not part of this experiment

### The classifier approximates dependency with presence

`hasSameSubjectDependency` cannot currently distinguish:

    supersession           later fact REPLACES the earlier one
    dependency             later fact RESTS ON the earlier one
    independent consequence later fact merely TOUCHED the same subject

It collapses the second and third into "same subject present, refuse". The
rekey arm shows the distinction is tractable — a later `set` rides along with a
rekeyed subject because a key change and a field change do not contend
(`transactions.ts:364`) — so the conservatism is not inherent, only unbuilt.

"Which later facts depend on which earlier facts" is more general than
transactions and may be one of SignalTree's genuinely interesting ideas. It is
NOT a roadmap item: a missing capability is a question to test, not permission
to build. Recorded here only so the abstraction is not advertised as more exact
than it is.

### version-claims has the wrong semantic owner

`checkReleaseClaim` validates `**Current release:**` against `package.json`,
so the tree is self-consistent at 16.0.0 while npm and GitHub serve 15.2.1.
Mechanically coherent, semantically misleading to a reader. The sentence should
eventually become:

    Development version: 16.0.0 (unreleased)
    Latest published release: 15.2.1

with `version-claims` taught the difference. Not urgent relative to
PRODUCT-ARCH-0, but a misleading sentence should not be preserved merely
because a gate happens to enforce it.
