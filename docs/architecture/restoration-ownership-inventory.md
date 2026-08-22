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
