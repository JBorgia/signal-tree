# FLUSH-0 — preregistration

> **Written before running.** Frozen 2026-09-10.
>
> Decides S2's capture primitive, and therefore whether the `ownerId` scoping
> repair is ever *necessary* (it is already *authorized* by OWNER-SCOPE-0).

## The question

Not *"how do we make the journal flush on every tree?"* but:

> **What semantic fact does S2 need, and does observing that fact actually
> require a flush boundary?**

The first question assumes the journal's packaging is a requirement. The second
tests it.

## The falsifier that decides it

> **If raw `PathNotifier` delivery already gives S2 all required per-write truth
> on a bare tree, then making `restoration()` — or any flush driver — a Studio
> capability prerequisite would be an architectural mistake.**

That would promote a dormant journal's implementation detail into product
architecture, which is the class of error this research line exists to catch.

## Cases

**1 — bare scalar tree.** Measure three things *separately*, because conflating
them is how the earlier harness went vacuous:

```text
A. did PathNotifier deliver the value transition?
B. did the journal retain it in its open buffer?
C. did the journal materialize a turn?

If A = yes and C = no, the missing flush is PACKAGING, not observation.
```

**2 — bare external realization.** Does the raw observation already carry
`path`, `ownerPath`, `before`, `after`, `origin: 'external'`,
`participation: 'realized'`, `ownerId`? If yes, S2's required fact exists
without any flush.

**3 — multiple synchronous realized writes.** Is there a **shipped semantic
fact** proving `a`, `b`, `c` belong to one meaningful realization operation? If
not, **do not invent a "realization turn."**

**4 — transaction authored, then realized.** Do S1's source (`confirmedTurns`,
authoritative for transaction net consequence) and S2's source (raw observed
effect, authoritative for value succession) combine cleanly in a query layer
**without sharing a container**?

**5** restoration realized write · **6** entity whole-object realization ·
**7** multiple writes before any flush · **8** nested/composed flush-driving
enhancers.

## Outcomes — frozen

**A.** All S2-relevant realization compositions already guarantee flush.
→ legitimate capability precondition; journal packaging is fine.

**B.** Relevant trees don't guarantee flush, but the journal can safely
materialize pending observations on snapshot/read.
→ narrow journal repair.

**C.** A universal semantic turn boundary already exists elsewhere.
→ the journal should use that instead.

**D.** No universal grouping boundary exists.
→ **S2 captures effects and does not invent turns.** Explicitly acceptable.

## Why D is live, not a fallback

SUPERSESSION-0 returned WEAK: S2's product fact is **value succession**, not
transaction causation.

```text
cart.total  9800 → 10200   origin external   participation realized
```

That is already useful and needs no turn container. Forcing realization events
into turn-shaped records because `DiagnosticJournal` was built that way would
repeat the same error in a new place.

## Constraint that holds regardless

⚠️ **Do not weaken S1 to unify the two.** `confirmedTurns` stays authoritative
for transaction net consequence; the realization stream stays authoritative for
write succession. **Two sources, combined by the query layer** — not one merged
capture.

## Consequence for the repair

```text
journal survives FLUSH-0   -> land the ownerId repair, finish JOURNAL-LIVE-0
journal's turn model is unnecessary
                           -> do NOT repair dead machinery for Studio's sake;
                              extract or build the smallest bounded
                              effect-capture primitive instead
```


---

# RESULT — 2026-09-10

Suites: `flush-0.spec.ts`, `flush-probe.spec.ts`

```text
case 1  bare tree: delivered=NO   turns=0
case 2  complete=YES  origin=external participation=realized ownerId=2
case 3  writes=3  groupingFact=NO  transactionIds=[null]
case 4  authoredFrames=1 realizedFrames=1  succession=9600->10200
case 6  entity rowFrame=YES participation=realized
case 7  delivered=["a","b","c"]   (no flush involved)
```

## Outcome: **D** — capture effects, do not invent turns

**Case 3 is decisive.** Three synchronous realized writes inside one
`external()` call share **no identifier whatsoever** (`transactionIds=[null]`).
There is no shipped semantic fact proving they belong to one realization
operation, so S2 must not manufacture a "realization turn".

**Case 7 confirms flush is packaging, not observation.** Three writes were each
delivered individually with no flush involved. The journal's `onFlush`
buffering was how a dormant module chose to group records — not a semantic
boundary S2 depends on.

**Case 2 confirms raw delivery is sufficient.** One frame carries `path`,
`ownerPath`, `before`, `after`, `origin: 'external'`,
`participation: 'realized'` and `ownerId` — S2's entire required fact, with no
flush and no turn container.

## ⚠️ But the precondition is REAL — and it is not the journal's fault

I expected the flush dependency to be the journal's artifact. It is. **The
actual constraint is different and more fundamental:**

```text
bare (no enhancers)            0 frames
batching()                     0 frames
restoration()                  2 frames
transactions()                 2 frames
restoration()+transactions()   2 frames
```

**Scalar leaf writes are unobservable unless `restoration()` or
`transactions()` is installed.** Either alone suffices; `batching()` does not
help. `entityMap` writes are observable with no enhancers at all (case 6).

The gate is **leaf interception**, which those enhancers install — not flush,
and not anything Studio can opt into after the fact.

So S2 *does* carry a capability precondition, but it must be stated correctly:

> **Scalar realization coverage requires a tree composed with `restoration()`
> or `transactions()`. Entity/structural realization does not.**

A tree without either shows an empty realization history that is
indistinguishable from "no realizations happened" — which is exactly the
absence-is-not-evidence failure. It must be reported as **unsupported**, not
empty.

## Consequences

1. **Do not adopt `createDiagnosticJournal`.** Its turn model is unnecessary
   (case 3) and its flush packaging is not a semantic boundary (case 7). Useful
   prior art for classification and bounded retention; not the primitive.
2. **The `ownerId` repair is no longer necessary.** OWNER-SCOPE-0 authorized it,
   FLUSH-0 removes the reason. Do not repair dead machinery for Studio's sake —
   it remains a real kernel defect, tracked separately, on its own merits.
3. **Build the smallest bounded effect-capture primitive**, roughly:

```ts
interface RealizationEffect {
  sequence: number;
  treeId: StudioTreeId;
  path: string;
  ownerPath: string;
  before: unknown;
  after: unknown;
  origin?: WriteOrigin;
  participation: 'realized';
  transactionId?: number;   // correlation only when actually supplied
}
```

   No turn. No flush requirement. Bounded retention plus explicit coverage.
4. **S1 is untouched.** `confirmedTurns` stays authoritative for transaction net
   consequence; this stream is authoritative for value succession; the query
   layer combines them. Two sources, never one merged capture.
