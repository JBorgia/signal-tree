# Retired-subject churn — unbounded, half of it reclaimable, no driver

**Status:** OPEN. Decomposed and attributed. No change made.
Reproduce with `node --expose-gc tools/bench-entity-churn-retention.mjs`.

## The growth is linear and does not converge

1,000 live rows held constant, keys fully replaced each round, no history
enhancer attached, nothing holding a reference to any retired subject:

| rounds | retired subjects |   growth | per retired |
| -----: | ---------------: | -------: | ----------: |
|     10 |           10,000 |  2.75 MB |       288 B |
|     50 |           50,000 | 11.88 MB |       249 B |
|    100 |          100,000 | 22.47 MB |       236 B |
|    250 |          250,000 | 52.45 MB |       220 B |

Marginal cost ≈ **207 B per retired subject**, flat across a 25x range. The
per-subject figure declines only as fixed cost amortizes; it does not approach
zero. So:

```text
history OFF
subject retired
nothing references it
store lives on
memory grows linearly, forever
```

is true today.

## What survives a tombstone

`tombstoneSubject` correctly releases the `ActiveNode` — both index maps and the
list links, with `prev`/`next` nulled. What remains per retired subject:

```text
StructuralStore.subjectStates     { active: false, restoreAllowed }
StructuralStore.subjectRevisions  a number, deleted only by clear()
EntityValueStore.retainedEntities THE ENTITY OBJECT ITSELF
```

Plus, only if the row was ever observed, an `entitySignals` entry — which the
activation-token work made lazy and which
[entity-signal-retention.md](./entity-signal-retention.md) shows is earned while
a consumer can still reach it.

## Half of it is already reclaimable

Measured using the library's **own** reclamation path
(`__listSubjectReclamationCandidates` -> `__prepareSubjectReclamation` ->
`__applyPreparedSubjectReclamation`), not a patch:

| mode                       |   growth | per retired | reclaimed | refused |
| -------------------------- | -------: | ----------: | --------: | ------: |
| as shipped                 | 11.89 MB |       249 B |         0 |       0 |
| reclaiming every candidate |  5.68 MB |   **119 B** |    50,000 |       0 |

**130 B/retired — 52% — is the retained entity value, and it comes back
completely.** 50,000 of 50,000 candidates reclaimed, zero refusals, live
collection verified intact afterwards.

The remaining 119 B/retired is the lifetime record, the revision entry and Map
overhead. That supports stale-handle isolation — a held reference to a retired
subject must read `undefined` rather than follow a fresh occupant of the same
key, which `check-signal-identity-durability.mjs` pins — so it is plausibly
earned. It is also still unbounded.

## The eligibility gate is real

`causallyEligible` is not a formality. Asserting it falsely breaks undo, loudly:

```text
history OFF   candidate reclaimed, live collection correct
history ON    reclaimed (eligibility falsely asserted), then undo THREW:
              "Subject 1 has retired backing and cannot be restored."
```

That is good design: the guard exists, it fires, and it fails with an explicit
message rather than silently losing data.

## The finding: the eligibility decision has no driver

The machinery is correct and complete. Nothing calls it. Every entry point is
`__`-prefixed internal/testing surface, so in production the question "can this
subject ever be restored?" is never asked — including the case where the answer
is trivially yes-reclaim, namely **no history enhancer attached at all**.

```text
reclamation exists              YES
reclamation is correct          YES, verified
reclamation is gated soundly    YES, the gate fires
anything drives it              NO
```

Same shape as the previous findings in this sequence: a capability that is
built, guarded and never invoked.

## Open questions, not answered here

1. **Who should decide eligibility?** With no history/transaction enhancer
   attached, no causal layer exists to ask. Is the absence of a restorer itself
   sufficient grounds, or must an explicit authority answer?
2. **Is 119 B/retired earned?** Stale-handle isolation needs _something_ per
   retired subject. Whether it needs a lifetime record plus a revision entry
   plus two Map entries is a separate trial.
3. **Does the answer differ per enhancer?** `timeTravel` bounds history by
   `maxHistorySize`; a subject evicted from history is presumably unrestorable
   and therefore eligible. Nothing currently notices the eviction.

## Deliberately not concluded

That reclamation _should_ be automatic. It is safe in the measured no-history
case and unsafe when a restorer exists, and the boundary between those is a
semantics question about who owns the eligibility decision — not something the
memory measurement settles.
