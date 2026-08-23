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


---

## BOUNDED HISTORY DOES NOT BOUND RETENTION — the RC discriminator

Run before implementing Step 8, to classify it: is history-owned retention an
OPTIMIZATION (bounded, just larger than necessary) or a CORRECTNESS defect
(unbounded)? The answer decides whether Step 8 blocks `15.0.0-rc.1`.

Reproduce with `node --expose-gc tools/probe-bounded-history-retention.mjs`.
Registered as a KNOWN-RED gate: without it a full run reads 40/40 and says
nothing about the one case that blocks the RC.

### Method

200 live rows held constant, keys fully churned each round, so every round
retires exactly 200 subjects. `maxHistorySize: 20`, and the rounds run far past
it so eviction happens on every round after the twentieth. A control arm sets
the bound to 100,000 so it never evicts.

Two postconditions per point, because **a plateau produced by breakage looks
identical to a plateau produced by reclamation**: live membership must be
exactly 200, and `undo()` must still move the collection back a generation.

### Result: UNBOUNDED

```text
BOUNDED — maxHistorySize 20
  rounds   retired    growth    B/retired   history   undo
      20      4000      5.67 MB      1486        20   ok
      40      8000      9.55 MB      1252        20   ok
      80     16000     15.73 MB      1031        20   ok
     160     32000     30.48 MB       999        20   ok
     240     48000     48.39 MB      1057        20   ok
     320     64000     60.02 MB       983        20   ok

CONTROL — maxHistorySize 100,000 (never evicts)
      20      4000      5.69 MB      1493        22   ok
      40      8000     10.71 MB      1404        42   ok
      80     16000     19.19 MB      1258        82   ok
     160     32000     38.53 MB      1263       162   ok
```

`historyLength` is pinned at 20 throughout and `undo()` works at every point, so
the semantic bound is enforced and history is alive. Retention still grows with
total churn: 16x the rounds gives 10.6x the heap, and B/retired settles at ~1000
instead of falling toward zero.

**The semantic history bound is not a physical retention bound.** Evicting an
entry releases its snapshot — the bounded arm ends at 60 MB where the control
would be near 77 — but not the entity-side backing of the subjects that entry
referenced. Nothing tells the entity layer that the last history reference to a
subject has gone, and zero-owner reclamation deliberately does not run when a
restorer exists.

### Consequence

A long-running application with `timeTravel()` attached grows with every
subject it has ever retired, no matter how small `maxHistorySize` is. That is a
correctness defect, not an optimization, and **Step 8 blocks the RC**.

It also sharpens Step 8 from "history uses too much memory" to one question:

> which structure still makes a retired subject reachable after the history
> entry that justified that reachability has been evicted?

The zero-owner answer — a static ownership fact decided at construction — does
not transfer. This one is dynamic: ownership ends when the last retained history
reference to the subject does, and nothing currently observes that moment.


---

## STEP 8, NULL FIRST — orphaned retired subjects account for the slope

Run before designing any mechanism, to test the explanation rather than assume
it. Reproduce with `node --expose-gc tools/probe-history-subject-ownership.mjs`.

Two inventories, both counted rather than estimated. PHYSICALLY RETAINED is
`__listSubjectReclamationCandidates()` — the entity layer's own list of
tombstoned subjects still holding value backing. SEMANTICALLY OWNED is the union
of `restorationSubjectIds` across every retained history entry, intersected with the
retired set.

```text
  rounds   retired   physical   claimed   owned   ORPHANS   growth
      20      4000      4000      4200    4000         0     5.67 MB
      40      8000      8000      4200    4000      4000     9.55 MB
      80     16000     16000      4200    4000     12000    15.73 MB
     160     32000     32000      4200    4000     28000     30.5 MB
     320     64000     64000      4200    4000     60000    60.01 MB
```

Three facts, and the third is the finding:

1. **`physical` equals `retired` exactly, at every point.** Not "most", not
   "asymptotically" — every subject the tree has ever retired is still holding
   its backing. Nothing is ever released.
2. **`owned` is pinned at 4000 and `claimed` at 4200.** The semantic window is
   bounded exactly as designed: 20 entries x 200 rows, plus the 200 live. The
   history layer is doing its job.
3. **Orphans — retired, physically retained, claimed by no retained entry —
   grow linearly and cost 945 B each, which is 90% of all heap growth.**

So the two layers disagree about what is alive, and the disagreement is the
leak. Eviction ends a restoration claim and nothing releases the backing that
claim was justifying.

### What this rules in, and what it rules out

RULED IN: the fix belongs at the eviction boundary. The information needed is
already on the entry — `restorationSubjectIds` is recorded at capture time and is the set
a restore of that entry would need.

RULED OUT: a reachability sweep as the production mechanism. It would discard
information the system already has and pay `retired x retained-history` to
rediscover it. A sweep is still worth building as a TEST-ONLY oracle, because
claim bookkeeping is easy to get subtly wrong and an independent recomputation
is the only cheap way to falsify it.

⚠️ ALSO RULED OUT: claiming every subject named in `entry.state`. A snapshot
names the whole collection, so counting it would make every retained entry claim
every subject and reproduce today's over-retention inside a tidier structure.
The claim set is restoration NECESSITY, not serialization reachability — which
is what `restorationSubjectIds` already records.

### A note on the statistic, not the data

The first version of this probe divided `last.orphans / first.orphans`. The
first point has ZERO orphans by construction — at 20 rounds a 20-entry history
still covers every round, so nothing has been evicted — and the division printed
NOT CONFIRMED over data that confirms the hypothesis cleanly. A wrong statistic
on a right experiment reads exactly like a result. The verdict now tests three
things instead: the owned set is bounded, orphans grow from the first point that
HAS them, and the marginal heap per marginal orphan is stable and positive.


---

## STEP 8 PHASE 2 — the oracle: `restorationSubjectIds` is a SAFE AUTHORITY

Run before the claim registry, to decide what a claim should CONTAIN. Reproduce
with `node tools/probe-restoration-required-set.mjs`.

The definition under test is not "touched", not "named in the snapshot", not
"part of that turn":

> required(H) = the non-current subject lifetimes that H may legally make live
> again while H remains retained

It covers undo AND redo, which matters: after an undo, the subjects the forward
operation created are themselves retired and redo has to resurrect them.

Measured observationally — traverse every legal position (undo to the oldest
retained entry, redo forward to the newest) and record which subject ids are LIVE
at each step. That never reads `restorationSubjectIds`.

The first run had to omit `clear()`, because `clear()` was not undoable and the
traversal could not get past one — see "A defect the oracle found on its way"
below. It reported excess 1/57 (2%) over a 12-operation script. The table here is
the re-run after `d9451b42` repaired `clear()`, on the full 13-operation script:

```text
  maxHistory   entries   physical   named   required   excess   unnamed   ok
           4         4         16      10         10        0         0   yes
           6         6         16      14         14        0         0   yes
          10        10         16      16         16        0         0   yes
          24        14         16      16         16        0         0   yes
```

**Outcome C is refuted at every size: `unnamed` is 0.** Nothing a legal traversal
required was missing from `restorationSubjectIds`. And with `clear()`
participating the excess is **0/56 — EXACT at every history size**, outcome A
rather than B. Adding an operation improved the figure rather than degrading it,
which is what makes the earlier 2% readable as an artifact of the broken entry
rather than as headroom the mechanism needs.

**The property Step 8 actually needs holds: the named set scales with the
WINDOW, not with total churn** — 4→10, 6→14, 10→16, 24→16 against 16 ever
retired. Claims keyed on `restorationSubjectIds` therefore bound retention at
`O(live + window)`, which is the RC requirement.

### The honest limit on the oracle's independence

`time-travel.ts` calls `restoreState(entry.state, entry.restorationSubjectIds,
entry.__positionIds)` — **the restore path CONSUMES the metadata**. So the
traversal observes what restoration resurrects GIVEN that metadata, not what it
would need in principle, and the probe cannot refute C by observation alone.

That limit is itself a finding: `restorationSubjectIds` is not debugging metadata, it
participates in restoration semantics. C is refuted instead by CORRECTNESS — the
traversal's end state is compared against an independent replay of the same
script, at every history size, and matches. A required-but-unnamed subject would
land the traversal somewhere else.

Because the metadata is load-bearing rather than incidental, it was named for
what it is before the registry landed: `__subjectIds` → `restorationSubjectIds`
in `384ebedf`, entry-level only. The node-level property of the same old name —
"the subjects that own this value" — is a different concept and keeps its name.

### FROZEN — the claim contract

Settled by the table above; the registry is built against this and not against
whatever the current capture happens to emit.

> **A restoration claim names the subjects whose backing must conservatively
> remain available while the record holding it is retained.**

- **Sufficiency is required.** Every retired subject some legal traversal of the
  record could make live again must be named. A false negative frees backing a
  later undo or redo needs, and that is a correctness defect, not a performance
  one.
- **Minimality is not required.** Naming more than necessary is permitted. It
  costs retention, bounded by the window, and can be narrowed later without
  changing anything that depends on the contract.
- **The bound is what the contract buys**, and it comes from the window rather
  than from exactness: total claimed ⊆ `O(live + window)` regardless of how much
  has ever been retired.
- **Measured EXACT today, specified as a superset.** Anything built on
  "`restorationSubjectIds` is precisely the required set" would be relying on a
  measurement rather than on the contract, and would break the first time
  capture legitimately over-names.
- **Derivation is not the contract.** "Touched by this write", "named in the
  snapshot" and "part of that turn" are candidate derivations. The snapshot walk
  is specifically excluded: it names the whole collection, so every retained
  record would claim everything and reproduce today's unbounded retention inside
  a tidier data structure.
- **Not asserted for positions.** The oracle measured subject claims only.
  `__positionIds` may well satisfy the same contract; no evidence here says so.

### A defect the oracle found on its way

Its first run could not traverse at all: `clear()` is not undoable. The first
undo after a `clear()` silently restores nothing while `canUndo()` reports true,
and the next one throws `Unsupported scoped undo effect at structural-drift`.
Removing the same rows one at a time and undoing works correctly, so it is
specific to `clear()`. Pre-existing — reproduced at `0a23a551` — and pinned at
the time in `clear-not-undoable.spec.ts`.

**RESOLVED in `d9451b42`, before the claim registry** rather than after: a
history entry whose undo semantics are broken cannot have a trustworthy claim set
derived from it. The cause was that `clear()` authored a whole-collection value
change and emptied the entity-signal map, where `removeOne` authors a structural
`remove` per subject. It now authors the same per-subject removals, so the
reversal planner reverses N ordinary removals and nothing in time-travel needed
to know a clear had happened. `clear-undoable.spec.ts` replaces the old pin, and
`clear()` is back in the oracle script — which is where the 0/56 above comes
from.


---

## STEP 8 PHASE 6A — subject ids are COLLECTION-scoped, and collapsing them is safe

Run before the reclamation sink is allowed to delete anything. Reproduce with
`nx test core` — `multi-collection-subject-collision.spec.ts`.

`SubjectRestorationClaims` is TREE-scoped and indexes by `number`.
`StructuralStore` is constructed once per `entityMap` and starts
`nextSubjectId` at 1. So a tree with two collections contains two different
subjects both called 1, and the Phase 2 oracle — one collection — could not see
it. The proposition the sink is about to rely on,

> last claim released ⇒ nothing in this tree can legally require this backing

is under numeric collapsing either conservative or wrong, and which one decides
the sink's shape.

**The collision is real, not hypothetical.** `users#u1` and `orders#o1` allocate
the same number, asserted directly so nothing below can pass vacuously.

**Collapsing is SAFE, and structurally rather than incidentally.** Merging two
subjects under one number can only ever ADD owners to that number, never remove
one. Sufficiency — the half of the frozen contract that is required — is
therefore preserved by construction; it is minimality, the half that is not
required, that degrades. The tests corroborate the construction at the points
where an ordering could bite: a claim from either collection keeps the number
claimed, no eviction reports it unowned while any owner remains, and when it
finally does go unowned BOTH collections still hold their own retired subject of
that number.

**That last fact is what forces the sink's shape.** A number cannot route to a
collection, so `Map<subjectId, PhysicalOwner>` would pick one owner and leak the
other. The sink must BROADCAST an unowned number to every registered physical
owner and let each answer for itself — do I hold this subject, is it retired,
does it still have backing.

**The over-retention is bounded by the collection, not by its neighbour.** A
collection that retires three subjects and goes silent still holds exactly three
after a neighbour churns 400 through the same window. Collapsing costs
`O(collections x window)`, which is bounded, and does not reintroduce growth
with total churn.

**Restoration semantics are unaffected, checked separately.**
`restoreState(state, restorationSubjectIds, positionIds)` puts the numeric set
into the write context, so a restore driven by subject number could in principle
act on the wrong collection's subject of that number. A four-step undo and redo
across two collections with colliding ids moves exactly one collection per step.
This had to be established before the sink regardless of the claim question: a
reclamation built on a restore that already confuses collections would be
reasoning about the wrong thing.

**Conclusion: do not widen the RC scope.** A composite
`{ collection, subjectId }` reference would buy exactness the contract does not
require, and the falsifier gives no reason to pay for it.


---

## STEP 8 PHASE 6B — what each restoration system actually owns

Reproduce with `nx test core` —
`enhancers/transactions/retired-backing-ownership-null.spec.ts`.

Phase 5 wired `timeTravel()` into the claim registry and nothing wired
`transactions()`, so `claims.release(...) -> N` meant "N has no TIME-TRAVEL
owner". The causal coordinator is not quietly covering the gap: `reclaimSubject`
and `assessReclamationEligibility` have NO production caller, and
`TurnStore`/`AppliedHistory` are constructed in exactly one place — inside
`transactions()`.

The question was answered directly rather than by wiring: get into a state,
retire a subject, delete its backing, and see whether every legal operation
still completes.

### The two halves are not the same thing

| what is deleted | who needs it |
| --- | --- |
| the VALUE bytes (`EntityValueStore`) | **nobody, once tombstoned** |
| the LIFETIME record (`restoreAllowed`, subject state) | a pending transaction; a retained history entry |

**Value bytes have no reader on the tombstoned path.** Every
`backingForSubject` caller is active-path: `getProjectedEntity` resolves through
a key mapping the tombstone deleted, `getEntitySignal` materialises for a live
id, `resolveEntityHandle` returns before the read unless the subject is active.
The one apparent exception — `mutation.realizedValue ?? backingForSubject(...)`
in `prepareCommitInstructions` — is dead: the only construction site is
`planRestore(key, entity, ...)`, whose `entity` is required. Every restorer
already holds its own copy: a time-travel entry has the snapshot, a transaction
turn has `__baselineValues`, a structural `remove` effect has
`deepClone(entity)`. The entity layer's retained value is a THIRD copy.

Measured: deleting the value bytes leaves pending rollback, confirm, abort,
time-travel undo, and both-enhancer trees correct — including the HELD
REFERENCE, which is the discriminating case a fresh read would have passed
vacuously.

**The lifetime record is owned, and only while the turn is unsettled.** Full
production reclamation of a subject retired inside a pending turn makes
`rollback()` throw `could not rollback the pending transaction` and loses the
row permanently. That is data loss, not a degraded restore.
`assessReclamationEligibility` already returns a `pending-reference` blocker for
exactly this case; it has no caller, which is why the hazard is reachable.

Historical byte split: 249 B/retired with nothing reclaimed, 117 B with the
ledger kept, 6 B with it forgotten. The value is roughly half and needs no
claim; the ledger is the other half and needs one.

### Ownership lifetimes — FROZEN

| owner | retains from | releases at | bound |
| --- | --- | --- | --- |
| optimistic operation | the optimistic mutation | settlement — confirm OR reject | unresolved operations right now |
| time travel | capture | the entry leaves the retained window | the configured window |
| ordinary mutation | — | — | nothing retained |

> **Retain state for as long as the application still has a legal operation
> that can require it, and reclaim it automatically at the earliest point after
> that right disappears.**

The transaction bound is NOT a configured depth. An application that has made
two million optimistic updates over a week, with four requests currently
outstanding, should retain rollback data for four. Confirmation DISCARDS
rollback state; it does not silently become permanent history. An application
that wants a confirmed optimistic edit to remain undoable composes the two
owners, and the subject is never unowned during the handoff — which is what the
aggregate registry is for.

Defaults that follow: history off unless requested, transactions off unless
requested, reclamation automatic, and no reclamation-policy knob. `timeTravel()`
is bounded by default; the specific depth is configuration and has not been
established empirically.
