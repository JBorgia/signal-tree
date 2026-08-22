# Entity churn retention — pre-registered interpretation

**Status:** RESOLVED for the zero-owner case in 15.0. All four criteria below
are met, criterion 1 included — see "Criterion 1, re-checked" at the bottom. The
owned case (a tree with `timeTravel`) is untouched and still open.
Reproduce with `node --expose-gc tools/bench-entity-churn-retention.mjs`.

This document is written **before** any fix, and says in advance what would
count as one. A memory finding that is characterised after the patch lands
tends to be characterised as whatever the patch happened to achieve; the point
of pre-registering is that the target cannot move.

## The finding

Live membership is held constant at 1,000 rows. Each round calls `setAll` with
a fresh set of keys, so the number of subjects that have ever existed grows
while the number that exist stays flat.

| arm                                         | growth    | per retired subject |
| ------------------------------------------- | --------- | ------------------- |
| plain tree, no node reads                   | 38.06 MB  | 798 B               |
| plain tree, `byId()` every row every round  | 64.18 MB  | 1,346 B             |
| `timeTravel()` attached, no node reads      | 95.52 MB  | 2,003 B             |
| `timeTravel()` attached, `byId()` every row | 121.65 MB | 2,551 B             |

Growth is linear in retired subjects with no plateau. At `--rounds 150` the
same four arms read 119.72 / 199.89 / 301.24 / 381.46 MB — per-subject costs of
837 / 1,397 / 2,106 / 2,667 B, i.e. flat against the 50-round figures rather
than amortising. `count()` is pinned at 1,000 throughout and the tool fails if
it is not. The no-history arm alone reaches 119.72 MB while holding 1,000 rows
and being unable to restore any of them.

## What retains, mechanically

Removal — including the implicit removal inside `setAll` — TOMBSTONES a subject
rather than deleting it:

- `StructuralStore.subjectStates` keeps a lifetime record. `retireSubject()`
  does not delete it either; it overwrites it with
  `{active: false, restoreAllowed: false}`. Only `clear()` empties the map.
- `EntityValueStore` is never told to retire the value, so the entity object
  itself stays reachable.
- if `byId()` ran for that subject, `entitySignals` and `subjectStateSignals`
  each keep a signal. `subjectStateSignals` has no `delete` call anywhere in
  `entity-signal.ts`.

Tombstones default to `restoreAllowed: true`, so the retention presents itself
as earned: the subject can be restored.

## The attribution, and the test that produced it

The question that decides defect-versus-earned is not "is this a lot of memory".
It is:

> after a subject is gone, with no public handle retained and nothing able to
> restore it, is any public or frozen semantic contract still entitled to its
> state?

Restoration is reachable only through `__restoreOne` / `__planRestore` —
non-enumerable properties consumed exclusively by the causal-runtime adapter
behind `timeTravel()`. There is no public path to either. So the test is
executable: measure a tree that HAS a restorer against one that CANNOT have one.

```text
EARNED, by an explicit opt-in
  +1,205 B/subject   the timeTravel() delta (2,003 − 798).
                     Undo must be able to reproduce a removed row, so the row
                     has to be somewhere. Bounded by maxHistorySize.

ORPHAN, no contract entitled to it
     798 B/subject   structural lifetime record + retained entity value
                     backing, in a tree where NOTHING can restore anything.
  +  548 B/subject   observation signals (1,346 − 798), left behind by a
                     `byId()` on a row that is now gone.
```

The orphan portion is the finding. It is retained in a tree that has no history
enhancer attached, for subjects no public API can name, and it never stops
growing.

## Pre-registered success criteria

A fix resolves this if and only if, with `--width 1000 --rounds 150`:

1. **The no-history arm stops growing per retired subject.** Not "grows less" —
   the per-subject figure must fall with rounds rather than hold flat, which is
   the signature of a bounded cost rather than a slower leak.
2. **`timeTravel()` still restores a removed row after churn.** The earned
   retention must survive; a fix that reclaims what undo needs is a correctness
   regression wearing a memory win. Existing restore specs must pass unchanged.
3. **Live-collection retention does not regress.** `bench-entity-layers.mjs`
   L4 stays at ~1,181 B/entity.
4. **The reclamation is not opt-in.** A public `compact()` that users must
   remember to call converts a leak into a documentation problem. If reclamation
   ends up explicit, that is a product decision and needs its own acceptance,
   recorded separately from this document.

## What is deliberately NOT claimed here

- Not that all 207 MB is leaked. Some is earned; the split above is the point.
- Not that the orphan portion is unbounded in every application. A collection
  whose keys are stable never retires a subject and never pays this.
- Not a fix direction. `retireSubject` already exists and already fails to
  delete; whether the answer is deletion, a weak lifetime map, or a reclamation
  pass on tombstone is a design question this document does not prejudge.


---

## Criteria checked against 15.0 zero-owner reclamation

`node --expose-gc tools/bench-entity-churn-retention.mjs --width 1000
--rounds {50,150}`, against the retirement-boundary reclamation described in
[retired-subject-churn.md](./retired-subject-churn.md), "RESOLUTION".

| # | criterion                                              | verdict  | evidence                                                              |
| - | ------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| 1 | no-history arm stops growing per retired subject        | **FAIL** | `no-history` 117 B at 50 rounds, 140 B at 150 — not falling            |
| 2 | `timeTravel()` still restores a removed row after churn | pass     | both time-travel arms byte-identical; restore specs unchanged and green |
| 3 | live-collection retention does not regress              | pass     | `bench-entity-layers.mjs` L4 487 B/entity, unmoved                     |
| 4 | reclamation is not opt-in                               | pass     | runs at the retirement boundary; no public `compact()`                 |

Criterion 1 is the one that matters and it failed. The reduction is real and
large — at 50 rounds, `no-history` 249 B → 117 B and `no-history-reads`
797 B → 117 B — but the shape did not change. Tripling the rounds does not push
the per-subject cost toward zero; it rises slightly as the fixed component
amortizes the other way:

```text
                     50 rounds   150 rounds
  no-history            117 B       140 B
  no-history-reads      117 B       131 B
```

Growth is still linear in retired subjects with no plateau. The reclaimed half
was the entity value; the surviving half is the per-subject lifetime record, and
nothing about reclaiming values makes that bounded.

(The 150-round BEFORE column is not measured here. The 50-round pair is the
controlled comparison; the 150-round run exists to test the shape, not the
delta.)

Criterion 3's threshold in the list above (~1,181 B/entity) is stale — it
predates the materialized-projection deletion, and L4 has since moved to
~487 B/entity. The criterion is "does not regress", and it did not.

This document stays open. Closing it requires the residual to become bounded,
which is a different piece of work from the one measured here.


---

## Criterion 1, re-checked after the lifetime ledger was forgotten

The first check recorded criterion 1 as FAILED: zero-owner reclamation released
the value backing but kept a permanent lifetime record, so retention fell 6x and
stayed linear. Forgetting the ledger as well removes the slope:

```text
                   50 rounds   150 rounds
  reclaim only        117 B       140 B      <- linear, criterion 1 FAILED
  + forget ledger       6 B        -6 B      <- flat,   criterion 1 MET
```

Negative at 150 rounds is the quiescence noise floor, not memory being created.
The point is that tripling the retirements does not scale the total, which is
what "stops growing per retired subject" asks for.

| # | criterion                                              | verdict | evidence                                                     |
| - | ------------------------------------------------------ | ------- | ------------------------------------------------------------ |
| 1 | no-history arm stops growing per retired subject        | **MET** | gated by `tools/check-retired-subject-slope.mjs`              |
| 2 | `timeTravel()` still restores a removed row after churn | met     | both time-travel arms unchanged; durability gate 4/4          |
| 3 | live-collection retention does not regress              | met     | `bench-entity-layers.mjs` L4 487 B/entity, unmoved            |
| 4 | reclamation is not opt-in                               | met     | runs at the retirement boundary; no public `compact()`        |

Criterion 3's threshold in the original list (~1,181 B/entity) is stale — it
predates the materialized-projection deletion and L4 has since moved to
~487 B/entity. The criterion is "does not regress", and it did not.
