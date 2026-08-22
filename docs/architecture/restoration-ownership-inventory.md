# Restoration ownership — who can revive a retired subject, and what ends that

**Status:** inventory complete. No design proposed.

The churn finding ([retired-subject-churn.md](./retired-subject-churn.md)) put
the problem here: reclamation is not missing, **eligibility ownership** is. So
the question is narrow — what in v15 can restore a retired subject, for how
long, and what event ends the ability.

## Owners: two, sharing one seam

```text
enhancers/time-travel/time-travel.ts   ─┐
enhancers/transactions/transactions.ts ─┴─> tree-realization-adapter
                                              -> __planRestore / __restoreOne
                                              -> planRestore
                                              -> frame.stageSubjectRestore
                                              -> structuralStore
                                                   .restoreSubjectAtResolvedPlacement
```

Those are the only two. Nothing else in core reaches the adapter, and
`stageSubjectRestore` has exactly one caller. Snapshot restore and persistence
hydration go through `setAll`, which allocates **fresh** subjects rather than
reviving retired ones, so they are not restoration owners in this sense.

This matters for scope: reality needs two owners and they already share a seam.
A generalized claim system is not required to express that — though the seam
should let a third owner participate later.

## End-of-ability events: one silent, one unsupplied

**`timeTravel`** keeps its own `history` array and evicts by trimming it:

```ts
if (this.history.length > this.maxHistorySize) {
  this.history.shift();
  ...
}
```

A plain array shift. When the entry holding the last restoration path to a
subject is dropped, **nothing is emitted**. The subject silently transitions
from restorable to unrestorable, and no layer observes it.

**`transactions`** uses the causal `TurnStore`, which _does_ have the hook:

```ts
this.retainEvictedConfirmedTurn?.(evictedTurn);
this.onEvictConfirmedTurn?.(evictedTurn);
```

But the single production construction is `new TurnStore()` — no options — so
neither callback is supplied there. `onEvictConfirmedTurn`, the one that would
say "restoration is no longer possible", is declared and never passed anywhere.

The only eviction hook with an implementation is `retainEvictedConfirmedTurn`
(in `realization-context.ts`), and it moves in the opposite direction: it folds
the evicted turn's effects into `baselineValues` and pushes a copy onto
`forgottenConfirmedTurns`. On eviction the system currently **retains more**,
not less.

## Reclamation: fully built, zero production callers

```text
storage primitives
  valueStore.retireSubjectValue                     exists
  entity-signal prepare/apply/listCandidates        exists, gated
eligibility gate
  causallyEligible                                  fires; falsely asserting it
                                                    makes undo throw
coordinator
  reclaimSubject                                    exists
  reclaimAvailableSubjects                           exists
  runPhysicalMaintenance                             exists
production callers of any of the three               NONE
```

`reclaimSubject`, `reclaimAvailableSubjects` and `runPhysicalMaintenance` are
imported only by `subject-reclamation-coordinator.spec.ts`,
`pending-rollback.spec.ts` and `pending-confirmation.spec.ts`.

So three complete layers — primitives, gate, coordinator — plus an eviction
notification point, all tested, and **the wire between the last two was never
run**. That is why 130 B/retired accumulates while a correct reclaimer sits
beside it.

## The gap, stated precisely

```text
event                                    who notices today
-----                                    -----------------
timeTravel evicts the last path to S     nobody (silent array shift)
transactions evicts a confirmed turn     retainEvictedConfirmedTurn, which
                                         retains rather than releases
transaction confirms / draft disposed    not traced in this pass
```

Not one of these reaches `runPhysicalMaintenance`.

## Transaction end-of-ability: traced

| terminal transition               | does restoration ability end?                      |
| --------------------------------- | -------------------------------------------------- |
| `abort()`                         | N/A — the subjects it could restore are _restored_ |
| `confirm()`                       | **NO.** A confirmed turn is still undoable         |
| confirmed turn evicted from store | **YES** — this is the real boundary                |
| pending turn discarded            | YES                                                |

Neither `confirm()` nor `abort()` calls maintenance, and neither
`greenfield-transactions.ts` nor `transactions.ts` references the coordinator.

## Correction: eligibility is already derived, not asserted

An earlier reading of this work distrusted the `causallyEligible: true`
argument as a caller assertion. That was wrong, and it was wrong because the
probe bypassed the coordinator and called storage directly.

`reclaimSubject` does not trust callers:

```ts
const initial = assessReclamationEligibility({ subjectId, store, appliedHistory });
if (!initial.eligible) return { ok: false, kind: 'blocked', blockers };
const prepared = owner.__prepareSubjectReclamation(subjectId, { causallyEligible: true });
const final = assessReclamationEligibility({ subjectId, store, appliedHistory });
if (!final.eligible) return { ok: false, kind: 'causal-drift', blockers };
owner.__applyPreparedSubjectReclamation(prepared);
```

The boolean is an internal handshake made only _after_ verification, and
re-verified afterwards to catch drift — there is even a `causal-drift` result
kind. `assessReclamationEligibility` derives the answer from causal state alone:

```text
store.getPendingTurns()   referencing the subject -> 'pending-reference'
store.getTurns() + appliedHistory.getAppliedTurnIds() / getRedoTurnIds()
                          -> 'confirmed-restore-path'
```

That is a causal-claim mechanism, already implemented and declarative. It also
needs **no event payload**: it re-derives from current state, so nothing has to
describe what changed. The missing wiring is a _call_, not a message.

## ⚠️ The blocker: the assessor cannot see `timeTravel`

`timeTravel` has **zero** references to `TurnStore` or `AppliedHistory`. It is
invisible to `assessReclamationEligibility`.

So in a `timeTravel`-only tree the assessment is:

```text
getPendingTurns()   empty
getTurns()          empty
blockers            none
verdict             every tombstoned subject is eligible
```

which is wrong — `timeTravel`'s own `history` array holds live restore paths.
Reclaiming on that verdict makes a subsequent `undo()` of a removal throw
"Subject N has retired backing and cannot be restored", which this investigation
already demonstrated by falsely asserting eligibility with history attached.

**So "just call `runPhysicalMaintenance` at the lifecycle boundaries" is not
safe as stated.** For the primary restoration owner the assessor returns a
confidently wrong answer.

## Consequence for the smallest safe step

The measured 130 B/retired recovery was in the **no-history** arm — no
restoration owner attached at all. That case is safe by construction: with no
owner there are no restore paths, so the assessor's empty-store verdict is
correct rather than accidentally correct.

That suggests the minimal safe scope is narrower than the full wiring, and that
connecting `timeTravel` is a separate and larger question: either the assessor
gains a second input shape, or `timeTravel` publishes its restore paths into the
structures the assessor already reads. Both are design work, and neither is
required to recover the no-history case.

## DECIDED: restoration authority is prospective

> "No restoration owner was attached when the subject became retired" is
> sufficient authority to reclaim it. An owner attached later has **no
> retroactive restoration rights** over subjects retired before it existed.

Attachment does not create history retroactively. Without this rule the
physical layer would have to retain every retired subject forever against the
chance that some future enhancer wants it — which makes reclamation impossible
without a permanently present omniscient authority.

**This is already the observable behaviour**, verified before anything was built
on it:

```text
A removed BEFORE timeTravel attached  -> undo() does not restore A   holds
B removed AFTER attachment            -> undo() restores B           holds
same for transactions                                                holds
```

Pinned as a permanent contract in
`packages/core/src/lib/entity-restoration-authority.spec.ts` (4 assertions, plus
one `it.todo` for the reclamation step that has nothing to observe yet — an
explicit gap rather than a skipped test that looks like coverage).

## ⚠️ The capability seam exists but has no source of truth

The rule must not be expressed as `if (!timeTravel && !transactions)` inside
`entityMap` — the physical layer cannot know enhancer names. It does not have
to: the seam already exists, in three parts that are not connected.

```text
declaration    transactions.ts:1382  capabilities: ['causal-runtime']
               time-travel.ts:3017   capabilities: ['causal-runtime',
                                                   'temporal-snapshots']
consumption    MaterializationContext.hasCapability(...)
               already used by entity-map.ts for 'position-topology'
                                              and 'mutation-capture'
wiring         NONE. Nobody supplies hasCapability; the default returns
               `capability === 'position-topology' ? positionTopologyEnabled : true`
               so 'mutation-capture' is unconditionally true and
               'causal-runtime' is not in the union at all.
```

Two consequences:

1. **Zero-owner reclamation is not implementable today.** The query it depends
   on has no source of truth. Wiring capability declarations into a runtime
   query is a prerequisite, not part of the fix.
2. **A construction-time snapshot is the wrong shape.** Markers materialize
   during `signalTree(...)` while enhancers attach afterwards via `.with()`, so
   a value captured at materialization would report "no causal-runtime" for a
   tree that acquires `timeTravel` immediately after. Under the prospective rule
   the question must be asked **at retirement time**, dynamically — "is an owner
   attached now?" — not baked in at construction.

## Open, deliberately

1. **Should absence of a restorer be sufficient?** With no history or
   transaction enhancer attached, no owner exists, so nothing can ever restore.
   Whether that alone establishes eligibility — or whether an explicit authority
   must answer — is a semantics question.
2. **Is the coordinator's model the right one?** It was built around
   `TurnStore`, which the _primary_ owner (`timeTravel`) does not use.
   Connecting `timeTravel` may mean giving it turn semantics, or giving the
   coordinator a second input shape.
3. **Is the residual 119 B/retired earned?** Separate trial. It supports
   stale-handle isolation, which `check-signal-identity-durability.mjs` pins.

## Not concluded

That reclamation should be automatic, that a general claim abstraction is
warranted, or that `timeTravel` should adopt `TurnStore`. The inventory says
what exists; which seam carries the eligibility decision is a derivation, and
"two owners sharing one adapter" is a materially smaller problem than the
five-owner version would have been.

## AMENDMENT — declarative construction changes consequence 2

Added after the 15.0 declarative-construction migration. Consequence 2 above
says a construction-time snapshot is the wrong shape, because "markers
materialize during `signalTree(...)` while enhancers attach afterwards via
`.with()`". **That premise is now false.** `.with()` is deleted; the enhancer set
is declared in `signalTree`'s config and applied during construction, and there
is no operation that adds one to a live tree.

What follows, and what does not:

- **Consequence 2 inverts.** A construction-time answer is now the only
  well-defined one. "Does this tree have a restoration owner?" is decided before
  the first write and cannot change, so a value captured at materialization
  cannot go stale the way the old note describes.
- **Consequence 1 stands unchanged.** The capability query still has no source
  of truth at retirement time. Knowing the answer is fixed does not supply it;
  wiring `hasCapability` remains a prerequisite for zero-owner reclamation.
- **Open question 1 gets easier but is not answered.** Absence of a restorer is
  now a static property of the tree rather than a race against a future
  `.with()`, which removes the strongest objection to treating it as sufficient.
  It does not settle whether an explicit authority should still answer.
- **Nothing here licenses turning reclamation on.** No production path calls
  `runPhysicalMaintenance`, and that is unchanged.

The rule the assertions pin moved with it: `entity-restoration-authority.spec.ts`
asserted a PROSPECTIVE rule evaluated over time and now asserts a STATIC one —
that a tree built without a restoration owner has no path to acquiring one. Read
that file's header before building on either statement.

## RESOLVED — consequence 1 and open question 1, 15.0

Written after zero-owner reclamation shipped. The AMENDMENT above said
consequence 1 stood ("the capability query still has no source of truth") and
open question 1 got easier but was not answered. Both moved.

**Consequence 1 is closed for this question.**
`internals/runtime-tree-plan.ts` supplies the query, built once from the
finalized `TreeBuildPlan` and frozen:

```ts
interface RuntimeTreePlan {
  hasCapability(capability: TreeCapability): boolean;
  readonly hasRestorationAuthority: boolean;
}
```

It is a VALUE, not the mutable registry the v14 design called for. The registry
was correct for v14 — `.with()` could change the answer between two writes — and
is now a mutable container for an immutable fact. It reaches the retirement
boundary through `MaterializationContext`, whose `hasCapability` is widened from
`'mutation-capture' | 'position-topology'` to the full `TreeCapability` union so
it can answer for `causal-runtime` at all.

`hasRestorationAuthority` is `causal-runtime || temporal-snapshots`, which is
deliberately broader than "an enhancer named timeTravel is attached": requesting
the causal runtime through `capabilities` installs the machinery to drive
restoration with no enhancer present, and this decision must be wrong in the
safe direction. The default when no plan exists — a test, a direct
materialization — is `true`, i.e. RETAIN.

**Open question 1 is answered: yes, for the zero-owner case only.** Absence of a
restorer is sufficient, because it is now a static property of the tree rather
than a race against a future attachment. Measured result and the control that
makes it a result are in
[retired-subject-churn.md](./retired-subject-churn.md), "RESOLUTION".

**Open questions 2 and 3 stand.** Whether the coordinator's `TurnStore` model is
the right one, and whether the residual 117 B/retired is earned, are untouched.
The zero-owner path does not route through `runPhysicalMaintenance` and is not a
bypass of it: with no owner there are no turns for it to assess, so its causal
question has no subject. The owned case is still entirely its problem.


## SECOND AMENDMENT — open question 2 is answered: the residue was not earned

Open question 2 above asks whether the residual per-retired cost is earned. It
is not, and the answer came from falsifying it rather than reasoning about it.

Zero-owner retirement now forgets the subject entirely — value backing, entity
signal, lifetime record and revision. Retention went 249 B -> 117 B -> **6 B per
retired subject**, and at 150 rounds it measures -6 B, which is the quiescence
noise floor. Growth is no longer linear in retired subjects at all.

The stale-handle semantic the residue was believed to buy is untouched. All four
GC-dependent properties in `check-signal-identity-durability.mjs` pass, because
isolation is anchored in SUBJECT identity, not key identity: `nextSubjectId` only
increases and `tombstoneSubject` already removes the key -> subject mapping, so a
re-add of the same business key is a different subject by construction. A held
reference keeps reading `undefined` because the consumer holds the orphaned
signal and, with the map entry gone, nothing can write to it again.

The general statement, which is the useful part:

> Subject identity needs to be durable only for as long as something can still
> observe that subject.

Neither a permanent tombstone ledger nor weak-reference machinery is required.
The second was the designed fallback if the hard delete had failed; it did not.

**Open question 3 is unchanged**, and open question 1 (whether the coordinator's
`TurnStore` model is the right one) with it. The owned case still retains
1,310 B/retired and still needs history-aware eligibility.
