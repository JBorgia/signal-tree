# Truth audit — where the kernel asserts something it cannot deliver

2026-09-24. Standard applied: not "is it broken" but **does it create a false
idea of truth**. A defect that reports itself is a bug. A defect that reports
success is a lie, and lies are what make a review product impossible.

Every finding below was reproduced in this workspace. Nothing here is relayed.
Nothing here was repaired; repairs to settlement semantics await an
architecture decision, and conservative refusal is containment, not success.

## Ranked by who is misled

### 1. `inspect()` misreports to a HUMAN

The review surface — the product — cannot always identify which value a status
belongs to.

    proposal wrote LITERAL key 'a.b'  ->  inspect(): [ 'a.b=current' ]
    proposal wrote NESTED path a.b    ->  inspect(): [ 'a.b=current' ]

Two proposals, two different locations, two different concurrent external
writers, one identical public projection. In one of the two the value a
reviewer would read at that path belongs to the external writer, and the status
still says `current`.

Every other finding here misreports to CODE, which eventually surfaces as a bug
report. This one misreports to a person being asked to approve an agent's
action, and it looks correct. It is therefore the finding that bears directly
on whether a review product can be truthful at all.

Pinned: `inspect-path-ambiguity-0.spec.ts`.

### 2. `hasSameSubjectDependency` claims knowledge it does not have

The source says so itself (`transactions.ts:428`):

> `hasSameSubjectDependency` is named for a dependency test but implements a
> presence test.

A reader of this codebase concludes a dependency model exists. It does not —
there is "something else touched this subject, refuse". The name is the false
claim, and it propagates: the same anti-pattern was reproduced in a proposed R8
guard during this work before being caught and reverted.

Measured mitigation: the trichotomy IS separable without a graph (below), so
the honest name is reachable rather than aspirational.

### 3. `rollback()` reports rejection while half-applying

R6, reproduced on published 15.0.0–15.2.1 and on current source:

    pending turns before        1
    rollback()                  throws
    pending turns after         0      <- authority destroyed
    confirmed-turn delta        0      <- and not committed
    speculative value           still live
    rollback() again            returns SUCCESS, reverses nothing

Three false statements in one path: the turn is reported settled while live,
the value is owned by nothing, and a retry reports success.

Pinned: `r6-liveness-0.spec.ts`.

### 4. `accept()` reports success while dropping the accepted transaction's own field

R8/A. Rejecting an older overlapping transaction destroys a newer pending
value; confirming that newer transaction afterwards does not restore its own
contribution. Nothing throws.

Pinned: `r8-overlap-0.spec.ts`.

### 5. The suite documents a false characterization of itself

`proposal-rejection-0.spec.ts` records case 15 as "an EXPECTED REFUSAL control,
not a gap" whose "whole-turn refusal is coherent there". It is not a whole-turn
refusal: half the turn persists. That sentence sat in the suite as reassurance.

### 6. Dead code implying live capability

`hasConfirmedTurnAfter` — 2 definitions, 0 call sites.

## The systemic finding

These are not six independent defects. They are one mistake:

> **The API's vocabulary asserts contribution-level semantics that the
> implementation cannot express.**

`rollback`, `reject`, `accept`, `superseded`, `current`, `dependency` are all
claims about *whose contribution this is and what happens when it is
withdrawn*. The mechanics underneath are per-turn value snapshots. A baseline
answers "what was here before I wrote"; it can never answer "who owns this
now". The words promise a model that does not exist, and the gap then gets
patched case by case — which is the loop this programme exists to leave.

Two honest branches, and only two:

**Build the ownership model** so the words become true. Contributions carry
owner, authored sequence, position/subject and authority; settlement changes
ownership and status instead of writing historical values.

**Or narrow the vocabulary** to what snapshots support: optimistic
single-writer undo, honestly named, with no supersession, no dependency
language and no multi-writer review claims.

Keeping the words and patching the cases is the third option, and it is the one
that produced this list.

## What is NOT wrong — measured, not assumed

Two prerequisites for the ownership model were open doubts. Both hold.

**Typed identity survives composition.** `transactions + entityMap + link`,
8/8: "a.b", "a/b", "a::b", "jo.doe@example.com", "1.2.3" all reach the endpoint
intact; numeric `1` and string `"1"` stay distinct subjects; a re-added key is a
different subject and the old handle stays dead; a rolled-back entity field
leaves the linked payload uncorrupted. Link assertions are guarded against an
inert link passing them vacuously.

This measures the repair, not its absence: `source-mutation.ts` replaced
string-path splitting with segment arrays and `relativeSourceAddress`, which
compares segments including literal dots. L17 implemented at that seam.

**The trichotomy needs no dependency graph.**

    T02a  add + later field write       later-confirmed-dependency  DEPENDENCY
    T06a  rekey + later field write     settled; ids=["A"]; "later" INDEPENDENCE
    T06b  rekey + later add at vacated  effect-validation-failed    DEPENDENCY
    T07   rekey + later remove          settled; ids=[]; x=0        SUPERSESSION

All four separate from local structural facts the store already holds: subject
existence, key occupancy, and which dimension of a subject changed. T06a is the
non-trivial one — the key change reverses while the later field value rides
along with the subject, which a whole-row model cannot express.

One arm decides by ACCIDENT. T06b is correct because the compensating re-add
physically fails on an occupied key, not because a rule recognised the
dependency, and the cost is in the same measurement: `x` stranded at 1, the R6
symptom. Making key occupancy a first-class semantic check rather than a failed
physical operation is a bounded change that converts the last accidental arm
into a deliberate one.

Pinned: `identity-through-seams-0.spec.ts`.

## Disposition

The settlement layer is what is wrong. The identity layer beneath it is sound
and survives the boundary, and the semantic distinctions the ownership model
needs are decidable from facts already present. That is a better starting
position than the defect list alone suggests: what must be replaced is the part
that was always going to be replaced.
