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
