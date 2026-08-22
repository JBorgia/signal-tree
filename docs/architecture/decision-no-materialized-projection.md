# Decision: v15 does not permanently materialize entity collection projections

**Status:** DECIDED. Implemented and verified. Candidate C.

## The decision

v15 does not permanently materialize entity collection projections.

Real applications demonstrate that whole-collection projection is an important
workload ([collection-access-profile.md](./collection-access-profile.md)), but
the materialized representation cost ~126 B/entity and accelerated only
realization of the shared whole-collection snapshot. It did not reduce repeated
downstream derived traversals, which is where reactive fan-out actually spends.
The non-materialized implementation measures ~0.28 ms at 10k and ~4.9 ms at
100k. We prefer the lower-retention representation while preserving the
architectural seams for future workload-driven incremental derivation or
adaptive materialization.

## Why, in the order the reasons were established

1. **Whole-collection access is not cold.** TruckTrax shows 44 `all()` sites, 19
   inside `computed()`, 4–7 whole-collection consumers on several collections.
   An architecture hostile to whole-collection derivation would be wrong.
2. **The materialized index did help `all()`.** 1.25–1.7x across 1k–100k,
   consistent in direction, outside run-to-run spread. This is not the reason
   the decision went the other way.
3. **It helped nothing else.** Mutation differences were sub-microsecond;
   construction differences changed sign across sizes.
4. **Shared caching moves the bottleneck off `all()`.** Angular `computed` is
   lazy and shared, so five consumers cost `1 x all() reconstruction + 5 x
traversal`. A faster reconstruction is amortized across fan-out and hits a
   floor set by per-consumer traversal. The index does not touch that floor.
5. **A7 is binding.** Permanent per-entity memory requires repeated benefit _or_
   broader architectural use. The benefit was confined to one operation on one
   workload shape; there is no broader use today.
6. **Its best case sits where the evidence is weakest.** The advantage grows
   with N, and A5 ("10k–100k supported") is an _assumption_ — no application
   evidence above 10k.

## What was explicitly NOT used as a reason

Milliseconds do not repay megabytes. An earlier draft claimed a store doing
thousands of recomputes "recovers the 12.8 MB" — that is a category error. Time
and retained memory are separate resources, and there is no break-even between
them without an invented conversion rate. The architecture profile is a vector:

```text
{ construction latency, steady-state CPU, operation latency,
  retained memory, peak/transient memory }
```

evaluated against budgets and priorities, not summed into one scalar.

Also not used: "it might become incremental-derivation / rollback / sync
infrastructure." Those need change over time — before, after, operation,
version, origin, transaction. This structure held current ordered entities; it
was not a mutation log.

## What was removed

The concept, not a no-op of it: `MaterializedEntityProjection` (module deleted),
`EntityMutationFrame.project()`, the five `projection*` instruction arrays and
their types, `projectionRebuildRequired`, the now-shapeless generics on
`EntityMutationCommitResult`, three `__…StorageProjectionForTesting` hooks, and
seven dead counters in `ProductionSubstrateStats`.

## What was preserved

The seams, deliberately:

```text
authoritative storage  ->  mutation frame / commit boundary  ->  query API
```

`StructuralStore` and `EntityValueStore` remain authoritative;
`rebuildActiveProjectionFromOwners` remains as the owner-derived derivation. The
mutation frame remains the single place where change becomes coherent — which is
what future transaction / history / optimistic / sync / incremental-derivation
work needs. We kept the place where change becomes coherent without keeping
today's snapshot cache.

## Test disposition

Every failing test was classified as required semantics or implementation
assumption, per assertion rather than per file.

| spec                                    | disposition                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity-handle-resolution.spec.ts`      | kept — tests handle resolution; only frame construction changed                                                                                                                        |
| `entity-mutation-frame.spec.ts`         | 7 projection-behaviour tests deleted; commit/structural tests kept                                                                                                                     |
| `entity-signal.spec.ts`                 | 21 projection-snapshot assertions removed; the public-API assertions in the same tests (`count()`, `byIdOrFail`, `byId`) were already asserting the atomicity contracts and still pass |
| `production-scalar-substrate.benchmark` | projection counters dropped from expected rows; the structural-store counters that carry the O(1) complexity contract kept intact                                                      |

The atomicity tests ("does not partially add when upsertMany later fails", "does
not partially remove … when a later setAll arrival blocks") verify through the
public API first; the projection snapshot was a second instrument, not the
property.

## Verified

```text
core suite                     1,791 pass / 0 fail
run-many core+ng-forms+shared+events   green
typecheck-all                  green
eslint packages/core/src       clean
causal behaviour probe         remove/add/rekey undo all pass
structural reactivity probe    all pass
activation-token invariants    all hold
```

## Measured envelope, v15 baseline

|       N |   setAll | `all()` recompute | `updateOne` | add+remove | retained B/entity |
| ------: | -------: | ----------------: | ----------: | ---------: | ----------------: |
|   1,000 |  2.09 ms |         0.0547 ms |  0.00073 ms |  0.0035 ms |               355 |
|  10,000 | 17.43 ms |         0.2816 ms |  0.00086 ms |  0.0034 ms |               462 |
|  50,000 | 80.86 ms |         2.2918 ms |  0.00069 ms |  0.0031 ms |               406 |
| 100,000 | 155.2 ms |         4.8697 ms |  0.00074 ms |  0.0034 ms |               406 |

Layer decomposition at 10k:

```text
L0 payload            120 B/entity
L1 physical stores    455 B/entity
L4 public entityMap   486 B/entity   <- was 613
existence overhead     31 B/entity   <- was 158
```

## v15 performance envelope

The `100k uncached all() < 10 ms` side of the fork is chosen. C measures
**4.87 ms**, comfortably inside it.

⚠️ Recorded as a **benchmark-machine release guard, not a universal SLA.** It
says 100k remains usable without charging every collection ~126 B/entity
permanently; it does not promise a wall-clock figure on consumer hardware.

## Public surface impact: none

Verified rather than assumed, which is why this change is **not** marked
breaking:

```text
reachable from ".", "./security", "./storage"   no
present in the dist barrel .d.ts               no
present in tools/api-baseline.json             no
rc-public-dispositions gate                    pass
built-barrels gate                             pass
```

`EntityMutationFrame`, `EntityMutationCommitResult` and
`MaterializedEntityProjection` are internal modules; `export` inside
`lib/physical/` is not package-public. The three removed hooks were
`__`-prefixed, non-enumerable, untyped on any public interface, and named
`ForTesting`. Marking an internal architectural simplification semver-breaking
would blur the line between implementation contracts and SignalTree's public
contract.

## Reopening condition

Per the release rule: this reopens only if release work reveals a structural
problem expensive or impossible to fix afterwards. A product requirement of
`100k all() < 3.5 ms` would qualify — C measures 4.87 ms, and B was the only
candidate that met it. If the envelope target is `< 10 ms`, C passes
comfortably. **Setting that target is a product decision and is not made here.**
