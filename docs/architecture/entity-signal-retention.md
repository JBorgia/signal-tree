# Entity-signal post-observation retention — cost SURVIVES

**Status:** trial complete. The function is earned and the cheaper
representation tested here is **unsafe**. No change made.

This is the first row in this sequence where a cost survived. Recorded that way
deliberately: two ownership violations in a row did not establish that every
remaining cost is one.

## The residue

At 10k on `7896addf`:

```text
L4  public entityMap, untouched        486 B/entity
L5t byId() every row, nodes dropped  1,054 B/entity
                                     ─────────────
    post-observation residue           568 B/entity
```

`entitySignals` is a strong `Map<number, WritableSignal<E | undefined>>`,
populated lazily on `byId()`/field access and never pruned for a live subject.
It is cleared wholesale by `resetEntitySignals()` on `clear`/`setAll`, and
deleted per subject only through internal reclamation.

Note the asymmetry that motivated the trial: in the same file `nodeCache` is
`Map<number, WeakRef<EntityNode>>` with a `FinalizationRegistry`. Two lifecycle
policies for the same shape of problem.

## The claimed function, and the first null

The machinery states its own guarantee, on `tombstoneSubjectSignal`:

> The signal itself is kept keyed by SubjectId so held field references stay
> valid (they read undefined) and a restore of the same subject re-publishes
> through the same signal.

Stated without mechanism nouns:

```text
FUNCTION
  A reference obtained from a member continues to report that member's current
  state — including removal and a later restoration of the same member — for as
  long as the holder retains it.
```

**Null 1 — never intern** (every `getEntitySignal` returns a fresh signal seeded
from authoritative value backing): **28 tests fail**, including
`an entity write is captured by undo` and
`DOES recompute when the active row changes`. Those are reactivity contracts,
not representation assertions. A consumer holds a dependency edge on one signal
while writes go to another, so invalidation never arrives.

**The function survives.** Identity continuity for a live observed subject is
earned.

That null was also mis-specified: it broke identity for _live_ subjects, which
was never the question. The question is what requires the signal to remain after
the observation is unreachable.

## Null 2 — weak interning. Passes the suite, breaks the guarantee.

Hold entity signals weakly, mirroring `nodeCache`, on the theory that a live
consumer's dependency edge keeps the signal reachable and the slot drops when
nothing can observe it.

```text
core suite                       1,791 pass / 0 fail
causal-behaviour probe           all pass
structural-reactivity probe      all pass

L5t residue         1,054 -> 498 B/entity   (568 -> 12 over L4)
churn, byId reads     798 -> 249 B/retired  (identical to no-reads)
churn, tt + reads   1,859 -> 1,311          (identical to no-reads)
```

Attractive numbers, and **wrong**. The suite never forces GC, so it cannot test
the one thing this change depends on. A targeted probe does:

```text
establish a live consumer -> force GC + allocation pressure -> mutate

  weak interning   consumer keeps returning the STALE value   FAIL
  strong map       consumer invalidates correctly             PASS
```

A live `computed` re-fetches the signal on each read rather than holding it, so
its dependency edge does not reliably keep the signal reachable across GC. The
write path finds a cleared `WeakRef`, skips silently, and the consumer never
learns. That is a stale-UI defect with no test coverage and no error.

So the strong map is doing real work: it guarantees writes reach the same signal
a consumer depends on, independently of GC timing.

## A probe error worth recording

The same probe reported a second failure — a held field reference reading
`undefined` after remove followed by a fresh `addOne` at the same key — **on
committed HEAD as well**. That is not a defect; the probe asserted the wrong
contract. Identity here is subject-based, not key-based:

```text
remove -> undo (same subject restored)     Alice -> undefined -> Alice   correct
remove -> fresh addOne at the reused key   Alice -> undefined            correct
  (a live read returns the new occupant; the old handle must not follow it)
```

Confirmed by the existing specs `does not resolve an acquired handle to a fresh
same-key replacement` and `allocates a fresh subject lifetime when adding at a
retired subject key`.

## Disposition

```text
FUNCTION                              SURVIVES
STRONG-MAP REPRESENTATION             REQUIRED by this trial's alternative
WEAK-REF KEYED BY SUBJECT ID          REJECTED — silent staleness under GC
568 B/entity                          EARNED under the representations tested
```

This does **not** establish that 568 B/entity is irreducible. It establishes
that weak interning is not a valid substitute. Other candidates remain
untested, e.g. pruning on tombstone once no reachable holder exists, or making
the field facade capture its signal so the dependency edge is a real strong
reference and reachability means what the weak variant assumed. Each would need
the same forced-GC probe as its acceptance gate.

## What this row contributes to the method

The suite passed. The layer numbers improved substantially on two axes. Both
were true and both were irrelevant, because the guarantee at stake is only
observable under garbage collection and nothing in 1,791 tests forces one. The
acceptance criterion for any future change here is the forced-GC consumer probe,
not the suite.
