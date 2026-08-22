# Whole-collection access profile — an architectural input we never gathered

**Status:** partial. Static structure measured; runtime frequency NOT measured.
No disposition drawn.

SignalTree deliberately accepts construction cost to make steady-state cheap.
That trade is only decidable against how often each operation actually runs over
a store's lifetime — and every judgement in this repo about whole-collection
access being "hot" or "cold" has so far rested on nothing. Grep counts call
sites; they do not count executions. One `computed(() => rows.all().filter(...))`
can execute thousands of times.

## What is measured: static structure in real consumer code

TruckTrax v3, `chore/signaltree-14-upgrade` (core **14.0.0**), production code
only — tests, mocks and testing helpers excluded:

```text
entityMap declarations    7
.all()                   44
.byId(                   28
.ids()                    0
.asMap()                  0
.where(                   0
```

Identical on `main` (13.3.0), so the profile is durable across at least one
major upgrade.

## But the raw counts overstate the whole-collection workload

Classifying the 44 `all()` sites by what the caller actually wanted:

| intent                                         | sites | is `all()` the right call?         |
| ---------------------------------------------- | ----: | ---------------------------------- |
| `all().find(...)` — one row by a NON-key field |    10 | **No** — missing capability        |
| `all().map(...)` — projection over every row   |     4 | Yes                                |
| `all().length` — aggregate                     |     2 | Yes (though `count()` exists)      |
| assigned then consumed (loops, passing, finds) |    28 | mixed, not individually classified |

**At least 10 of 44 whole-collection reads (23%) are point lookups wearing a
whole-collection costume.** The keys used are `projectExternalId`,
`customerExternalId`, `externalId`, and `name.toUpperCase()` — business keys,
while the entity is keyed by `id`. There is no secondary-index or
lookup-by-alternate-key capability, so each of these scans the collection.

So "whole-collection reads outnumber point reads 44:28" is **not** a statement
about workload. Part of that ratio is a missing index, and correcting for it
moves reads in the opposite direction.

## And the read-modify-write finding is withdrawn

`service-crud-ops.setEntity` does `setAll(all().map(...))` per single-entity
update. Its own comment explains why:

> Store exactly `entity` under its id, replacing (not merging) any existing row
> and preserving its position — SignalTree's `upsertOne`/`updateOne` MERGE,
> which would leave keys behind when a server response or a rollback snapshot
> legitimately lacks a property the current row has.

The developer knew about `upsertOne`/`updateOne` and rejected them correctly.
What they needed is `replaceOne(id, entity)` — documented as "Replace, not
merge… the only way to REMOVE a key, which `updateOne` cannot express at all".

```text
replaceOne in v14.0.0-rc.1   ABSENT
replaceOne in v14.1.1        PRESENT  (80f41e94)
TruckTrax usage              zero call sites — pinned to 14.0.0
```

So it was **the only correct option at the pinned version**, and the gap it
worked around is already closed. It is neither consumer error nor evidence of a
workload need, and it must not be used to justify a representation. Designing
around it would be designing for a defect we have already fixed.

The architecture those consumers live in is explicitly projection-oriented:
`tier1-entity-resolution.derived.ts`, `tier2-business-logic.derived.ts`,
`tier-business-logic.derived.ts`. Typical shapes:

```ts
projectOptions: $.clearView.projects.all,                    // exposed directly
plantOptions:  computed(() => $.clearView.plants.all().map(...)),
scaleOptions:  computed(() => $.clearView.scales.all().map(...)),
filteredProjectOptions: computed(() => { … projects.all() … }),
```

Dropdown/option models derived from whole collections and read by templates —
recomputed on any mutation to the collection. One screen
(`ticket-form.component.ts`) carries 18 whole-collection reads.

⚠️ **Version caveat, and it matters.** TruckTrax is on `@signaltree/core`
**13.3.0** — two majors behind this repo and well behind the v15 work. So this
is evidence about **how applications use collections**, which is reasonably
durable across versions, and NOT evidence about v15 behaviour. In particular
`packages/core-services-v2` does, per single-entity update:

```ts
this.slice.entities.setAll(this.slice.entities.all().map((e) => (e.id === entity.id ? entity : e)));
```

a whole read plus a whole `setAll` for what the caller thinks is a point update.

**Checked: it survives on the 14.0.0 upgrade branch unchanged.** So it is not a
13.x workaround — it is the current shape of a "point update" through the shared
CRUD helper. Whether v15 changes it is still unknown, but it cannot be dismissed
as legacy.

## What is measured: what a materialized read path would buy

Current whole-read walk (`activeKeysSnapshot()` + `backingForSubject()` per key)
versus iterating the projection's linked list, same data:

| n      | current walk | projection walk | speedup |
| ------ | -----------: | --------------: | ------: |
| 1,000  |     0.029 ms |        0.020 ms |   1.47x |
| 10,000 |     0.198 ms |        0.113 ms |   1.75x |
| 50,000 |     1.761 ms |        0.597 ms |   2.95x |

⚠️ **An earlier version of this section claimed the walk was ~10% of `all()`,
using the 2.0 ms figure from the RC decomposition. That figure predates both
cleanup commits and is stale.** Re-measured on the current build, `all()`
recompute at 10k is **0.387 ms**, so the walk is roughly half the operation, not
a tenth.

Measured end to end with the projection actually wired into the query path
(keeping reconstruction independent of it, since `rebuildActiveProjectionFromOwners`
is what the projection is verified against):

| n      | `all()` from stores | from projection | speedup |
| ------ | ------------------: | --------------: | ------: |
| 1,000  |           0.0354 ms |       0.0252 ms |   1.40x |
| 10,000 |           0.3867 ms |       0.2276 ms |   1.70x |
| 50,000 |           2.4736 ms |       1.2991 ms |   1.90x |

Mutation, add/remove and construction are unchanged, and retained memory is
identical either way — **because the projection is built and maintained in both
cases.** The 127 B/entity is already being paid; the only question is whether
anything reads it. Full core suite passes with it wired in (1,798 / 0).

## What is NOT measured

```text
runtime executions of all()/ids()/asMap() per store lifetime      UNKNOWN
distribution of access profiles across collections                UNKNOWN
how much of the 13.3.0 usage shape survives on v15                UNKNOWN
reads per mutation actually realized (vs invalidations issued)     UNKNOWN
```

The fan-out figures say how many consumers _would_ recompute. They do not say
how often anything reads them, which depends on rendering, and that needs a
trace or an instrumented session — not static analysis.

## The comparison that should decide any representation question

```text
TOTAL LIFETIME COST =
    construction cost
  + Σ(operation count × operation cost)
  + retained memory cost
  + transient / high-water cost
```

with operation counts drawn from a profile, and explicit low/typical/high
scenarios where no trace exists rather than a single invented number.

Profiles worth bucketing collections into:

| profile                   | whole-collection behaviour          |
| ------------------------- | ----------------------------------- |
| point-oriented            | almost never                        |
| initialization-oriented   | once or twice, ever                 |
| occasional projection     | sporadic                            |
| projection-heavy          | frequent                            |
| reactive projection-heavy | one write drives several full reads |

On the static evidence above, the TruckTrax derived tiers sit in the last row.
That is one application on an old version, so it establishes that the row is
**occupied**, not what fraction of real collections occupy it.

## Consequence for the open projection fork

The evidence moved, but not to a conclusion:

```text
whole-collection access is cold        NOT SUPPORTED — fan-out 3-7 per collection,
                                      projection-oriented derived tiers exist
projection would make all() cheap     NOT SUPPORTED — it addresses ~10% of all()
projection is therefore dead weight   STILL UNDECIDED
```

The decisive measurement nobody has taken is `all()` end-to-end with the
projection actually wired into `getProjectedEntries()`, against the retained
127 B/entity. Until then the fork stays open, and it should not be closed by
whichever edit is smaller.
