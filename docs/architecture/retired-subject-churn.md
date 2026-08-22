# Retired-subject churn — unbounded, half of it reclaimable, no driver

**Status:** STILL OPEN. 15.0 reclaims the value backing on a zero-owner
retirement — a 6.1x reduction — but the growth is still LINEAR and the
pre-registered success criterion is NOT met.
Reproduce with `node --expose-gc tools/bench-entity-churn-retention.mjs`.

> **Read the RESOLUTION section at the bottom before quoting any number above
> it.** Everything from here to that section is the investigation as it stood
> when no reclamation ran, and its headline figures — 249 B/retired shipped,
> 119 B reclaimable-in-principle — are now the BEFORE column. The measured
> after is 117 B/retired for a tree with no restoration owner, and unchanged
> at 1310 B for a tree with one.

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


---

## RESOLUTION — zero-owner reclamation, 15.0

The "no driver" finding is answered for exactly one case, and the answer came
from the phase model rather than from this investigation.

### What changed upstream

`.with()` is deleted; enhancers are declared in `signalTree`'s config. So
"does this tree have a restoration owner?" stopped being a question whose answer
could change between two writes and became a property of the finished build
plan — see `internals/runtime-tree-plan.ts` and the AMENDMENT in
[restoration-ownership-inventory.md](./restoration-ownership-inventory.md).

That collapsed open question 1. With no restorer configured, no causal layer can
ever exist to ask, so the absence IS the eligibility. The retirement boundary in
`entity-signal.ts` now releases the retained value backing at the moment of
retirement when `hasRestorationAuthority` is false.

### Measured

`node --expose-gc tools/bench-entity-churn-retention.mjs`, 1,000 live rows held
constant, 50 full key generations:

| arm                 | before  | after       | note                                     |
| ------------------- | ------: | ----------: | ---------------------------------------- |
| `no-history`        | 249 B   | **117 B**   | matches the 119 B predicted above        |
| `no-history-reads`  | 797 B   | **117 B**   | NOT predicted — see below                |
| `time-travel`       | 1310 B  | 1310 B      | control: unchanged, as it must be        |
| `time-travel-reads` | 1859 B  | 1859 B      | control: unchanged                       |

The predicted result landed within 2 B. The **unpredicted** one is the read arm:
797 B → 117 B, a 6.8x reduction, and it is the arm that resembles a real app,
because rows that render get observed. Reclaiming the backing also drops the
subject's `entitySignals` entry, and that entry was the whole difference between
the two no-history arms. Observation no longer costs anything per RETIRED
subject; it still costs per LIVE one.

Both `time-travel` arms are unchanged to the byte, which is the control that
makes the result mean something. A change that reclaimed unconditionally would
have moved them too — and would have been data loss, not a fix.

### Cost

None resolvable on the path this touches. Interleaved A/B against the
pre-reclamation build (7959f6bc) on `tools/bench-public-collection-layers.mjs`,
two alternating rounds, 9 samples each:

```text
              removeOne median   range
  after        0.326 ms          0.316-0.345
  before       0.337 ms          0.296-0.658
  after        0.328 ms          0.321-0.358
  before       0.563 ms          0.350-0.761
```

The after arm is stable and at or below the before arm, whose spread is roughly
4x wider. Reclamation adds work to the retirement path and none of it is
resolvable at this fixture size — `removeOne` retires ONE subject.

⚠️ DO NOT READ A `setAll` RESULT OUT OF THIS RUN. The same tool reported `setAll`
between 17.5 ms and 33 ms for the SAME build across a few minutes of this
session, so the cross-worktree `setAll` gap is machine load, not code, and the
`setAll` arm retires nothing anyway (it populates an empty collection). The
quiet-machine figure for the current build is 18.61 ms at n=10,000, consistent
with the 17.86–19.64 ms recorded in
[setall-regression.md](./setall-regression.md).

Nothing on the entity layer table or the memory harness moved: those arms hold
live entities, and this touches only retirements.

### What is still open

- **Open question 2 is now the whole remaining question, and it BLOCKS
  closure**, because the residual is what keeps growth linear. Is the residual
  ~131 B/retired earned? It is the lifetime record, the revision entry and Map
  overhead, and it supports stale-handle isolation, which
  `check-signal-identity-durability.mjs` pins and which still passes all four
  properties after this change. It is also still unbounded.
- **Open question 3 is untouched.** A tree WITH `timeTravel` still retains
  1310 B/retired, and eviction from a bounded history still goes unnoticed.
  That case needs history-aware eligibility and remains
  `runPhysicalMaintenance`'s problem; the zero-owner path deliberately does not
  route through it, because with no owner there are no turns for it to assess.
- **This is not a general reclamation policy.** It is one case where the answer
  is decidable statically. Do not generalise the mechanism to the owned case by
  loosening the guard.



---

## TRIAL — is the 117 B lifetime ledger earned? NOT REFUTED

Open question 2, run as a null hypothesis rather than as a fix. Reproduce with
`node --expose-gc tools/bench-entity-churn-retention.mjs` (arms
`no-history-forget`, `no-history-reads-forget`),
`packages/core/src/lib/entity-lifetime-ledger-null.spec.ts`, and
`node --expose-gc tools/check-signal-identity-durability.mjs --forget-lifetime`.

**The trial is OFF by default. Nothing shipped changed.** The flag exists to
falsify, not to configure, and the trial ends by deleting it in whichever
direction the evidence points.

### The null

The semantic the residue is believed to buy is NOT on trial and is
non-negotiable:

```text
held handle -> removed subject -> undefined, forever
fresh entity reuses the same business key -> the held handle must NOT follow it
```

On trial is only the claim that preserving it REQUIRES a permanent
`{active:false, restoreAllowed:false}` record plus a revision entry per subject
that ever existed. The null deletes both at a zero-owner retirement
(`StructuralStore.forgetSubject`).

Why it might hold: isolation is anchored in SUBJECT identity, not key identity.
`nextSubjectId` only increases, `tombstoneSubject` already deletes the
key -> subject mapping, so a re-add of the same key is a different subject by
construction. The held signal survives because the CONSUMER holds it, and once
the map entry is gone nothing can write to it.

### Result: every gate passes in both arms

| gate                                                     | ledger kept | forgotten |
| -------------------------------------------------------- | ----------- | --------- |
| stale handle undefined after remove                       | pass        | pass      |
| fresh entity on the reused key is not followed            | pass        | pass      |
| held FIELD reference behaves the same                     | pass        | pass      |
| independent stale handles stay isolated                   | pass        | pass      |
| subject ids are never recycled                            | pass        | pass      |
| timeTravel undo unaffected                                | pass        | pass      |
| transactions rollback unaffected                          | pass        | pass      |
| **GC: live consumer invalidates after collection**        | pass        | pass      |
| **GC: held ref survives remove -> undo (same subject)**   | pass        | pass      |
| **GC: held ref does not follow a reused key**             | pass        | pass      |
| **GC: independent consumers all invalidate**              | pass        | pass      |

The four GC rows are the decisive ones and vitest cannot run them; they come
from `check-signal-identity-durability.mjs --forget-lifetime`.

### Measured

| rounds | arm                       | growth   | per retired |
| -----: | ------------------------- | -------: | ----------: |
|     50 | `no-history`              |  5.60 MB |       117 B |
|     50 | `no-history-forget`       |  0.30 MB |       **6 B** |
|    150 | `no-history`              | 18.79 MB |       131 B |
|    150 | `no-history-forget`       | -0.83 MB |      **-6 B** |

Negative at 150 rounds. That is the quiescence protocol's noise floor, not
memory being created — and it is the point: growth is no longer measurable, so
it is no longer linear in retired subjects. **The pre-registered criterion 1 in
[entity-churn-retention.md](./entity-churn-retention.md), which zero-owner
reclamation FAILED, passes under the null.**

### One found bug, inside the trial

The first trial measurement read 79 B/retired, not 6 B. Cause:
`publishSubjectPhysicalChange` -> `bumpSubjectRevision` runs after the commit and
writes `subjectRevisions.set(id, 1)`, **resurrecting the entry the forget had
just deleted**. The null was silently only two-thirds implemented. Recorded
because the failure mode generalises: deleting from a Map does not stay deleted
if a later step in the same operation interns by the same key.

### What the null gives up

Exactly two things, both on internal surfaces:

1. `resolveSubjectHandle` reports `missing` rather than `tombstoned` for a
   forgotten subject, collapsing it with "handle from a previous collection
   incarnation". Reachable only through `__resolveEntityHandleForTesting`;
   `entity-handle-resolution.ts` has exactly one call site and it is that hook.
2. The subject stops appearing in `__listSubjectReclamationCandidates`. Correct
   — it has nothing left to reclaim — but it can no longer be used to enumerate
   retirement history. Nothing in production enumerates it.

Neither is a production observable. `planRestore`'s
"has retired backing and cannot be restored" guard also loses its input, which
is acceptable ONLY because a tree with no restoration authority has no path to a
restore: the guard becomes unreachable rather than unenforced. If a restorer can
exist, `forgetSubject` must not be called — and it is not.

### PROMOTED — the null is now the implementation

The flag is deleted; forgetting is unconditional for a zero-owner retirement.
Measured on the shipped path:

| rounds |               arm |   growth | per retired |
| -----: | ----------------- | -------: | ----------: |
|     50 | `no-history`      |  0.30 MB |         6 B |
|     50 | `no-history-reads`|  0.30 MB |         6 B |
|    150 | `no-history`      | -0.83 MB |        -6 B |
|    150 | `no-history-reads`| -0.86 MB |        -6 B |

`tools/check-retired-subject-slope.mjs` is the regression gate, and it pins the
ASYMPTOTIC claim rather than a byte budget — 117 B/retired passes any budget
stable enough to keep, and 117 B/retired is unbounded growth. It runs the same
workload at 50 and 150 rounds and fails if the total scales with the
retirements. Its self-test rejects the pre-fix table.

Two regression rows guard the way this quietly undoes itself
(`entity-lifetime-ledger-null.spec.ts`): a forgotten subject must still be
forgotten at the END of the whole retirement operation, and after further
unrelated churn. That is the 79 B bug — anything appended to the retirement path
that touches the subject by id resurrects it.

`planRestore`'s unreachability is encoded too, in both halves: the guard no
longer fires for a forgotten subject, AND no public path reaches it. If a bare
tree ever grows `undo`/`redo`/`transaction`, that row fails and forgetting must
stop.

### The architectural statement

> Subject identity needs to be durable only for as long as something can still
> observe that subject.

Once ownership and external reachability are both gone, permanent historical
identity bookkeeping buys no observable semantic correctness. That is why
neither a permanent tombstone ledger nor weak-reference machinery is needed here
— the second was the fallback if the hard delete had failed, and it did not.

### Still open

The OWNED case. A tree with `timeTravel` still retains 1,310 B/retired (1,407 B
at 150 rounds), and eviction from a bounded history still goes unnoticed. That
needs history-aware eligibility and remains `runPhysicalMaintenance`'s problem;
nothing here routes through it.
