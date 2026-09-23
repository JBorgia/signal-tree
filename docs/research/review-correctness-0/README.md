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

## Scoring — four outcomes, not two

Ratified before running. A pass/fail scheme cannot express what SignalTree
actually does on the structural cases, and would score a refusal as a win.

    REVERSED   T1 undone, later/unrelated truth intact     <- the ONLY wedge win
    REFUSED    nothing changed, error raised naming why    <- safe, wedge NOT delivered
    STRANDED   reported rejected, yet partly applied       <- worse than refusing
    WRONG      final state incorrect                       <- failure

**Only REVERSED satisfies the hypothesis.** Rationale: any store can refuse.
A refusal preserves truth but delivers no reversal, so counting it as a win
would let SignalTree pass this matrix while doing nothing a competitor cannot.

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
    R5  COVERED   proposal-rejection-0.spec.ts:293    REFUSED   ('later-confirmed-dependency')
    R6  COVERED   proposal-rejection-0.spec.ts:463    STRANDED  (see below)
    R7  COVERED   rekey-supersession-0.spec.ts (5)    REVERSED
    R8  PARTIAL   -- the only unknown in arm A

Under the ratified scoring, arm A therefore scores REVERSED on R1,R2,R3,R4,R7;
REFUSED on R5; STRANDED on R6.

### Two facts recorded against SignalTree, verified in source

1. `transactions.ts:386` — "`hasSameSubjectDependency` is named for a dependency
   test but implements a **presence** test: any later effect on the same subject
   refuses." The structural arm is over-broad by construction: it refuses
   whenever anything later touched the subject, not only when something depends
   on it. The wedge accuses competitors of requiring broader rollback; here
   SignalTree requires broader refusal.

2. `proposal-rejection-0.spec.ts:463` (case 15, flagged PRE-EXISTING, TODO.md:1373)
   — a pending REMOVE superseded by a later add returns
   `'effect-validation-failed'`, preserves the server row, and **strands `x` at
   its proposed value**. The turn is reported rejected while half its effects
   persist. The same source comment calls that outcome "worse than refusing"
   while justifying the presence test; it occurs anyway through another door.
   SignalTree LOSES R6 to any arm that reverses cleanly or refuses atomically.

## The only unknown: R8

Absent at the public API. Closest existing evidence, neither sufficient:
  - `proposal-0-kernel.spec.ts:289` — two outstanding proposals, but DISJOINT
    fields (name vs priority), and only one settlement order.
  - `pending-rollback-composition.spec.ts:355` — genuinely overlapping same-field
    pending turns, but at the internal TurnStore port, and only oldest-first.

R8 must exercise: partly-overlapping (not disjoint, not identical) fields and
entities, BOTH settlement orders, through the public `transact()`/`propose()` API.

## Preregistered predictions for R8 (arm A), recorded before running

  R8-scalar, overlapping field, reject P1 then settle P2   predict REVERSED
  R8-scalar, overlapping field, settle P2 then reject P1   predict REVERSED
  R8-structural, overlapping subject, either order         predict REFUSED
       (presence test fires: P2 touched a subject P1 also touched)
  R8-mixed, partial field overlap + one structural effect  predict REFUSED or STRANDED

If R8 returns WRONG or STRANDED in any order, the wedge dies immediately and
arms B and C are never built.

## Execution order — cheapest falsifier first

    1. Close R8 for arm A ALONE. One spec file. If it strands or corrupts,
       STOP: the wedge is dead without installing TanStack.
    2. Only if arm A survives R8: build arms B and C for the DISCRIMINATOR
       subset R3, R5, R6, R7, R8. R1/R2/R4 are commodity — every serious store
       passes them, and building them wastes the budget.
    3. Score all arms on the four-outcome scheme.

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
