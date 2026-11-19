# Independent bounded work attribution

Read-only audit, 2026-10-29. No runtime patch, heap-limit change, timing ranking, or CPU measurement. The original budget failures remain failures.

## Identity and reproduction

`INDEPENDENT-ATTRIBUTION.json` records hashes and reconciliation. All 172 manifest-listed kernel non-spec source files match the frozen row-source manifest in both the diagnostic candidate and the independent original-replay copy. Original/replayed granular spec SHA-256 is `83365544bcb4a572988125141bab0c28786a54b5a2279522f3eed0d9b7d9e872`; instrumented spec is `f05c264d3f4b42cd4db4309673da5bf1fa66de666d07704123a3d93b57481167`.

Main command/environment is preserved in `runs/traced/COMMAND.json`. Independent commands ran from `/private/tmp/st-publication-retirement-successor/predecessor-check`, using Node 24.15.0, pinned pnpm 10.17.0, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`:

```sh
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache prepared-placement-index.spec.ts --maxWorkers=1
```

Raw outputs: `original-replay.log` and `placement-replay.log`. Granular replay: 1 failed, 9 skipped, expected 14400 < 2000. Placement replay: 6 failed, 1 passed. Existing startup tsconfig warnings did not prevent these tests executing.

## Point count: exact reconciliation

Both `visits.jsonl` records report 14,400 for 200 updates, at 2,000 and 20,000 resident rows. Each histogram sums to 14,422: 22 wrapper-installation visits precede the original `visited=0` reset, but the histogram is not reset. Those four setup stacks contribute 2+16+3+1. Excluding them gives exactly 14,400, matching the independent uninstrumented replay. Runtime module totals match across both populations.

| First runtime source frame | Visits | Per update |
| --- | ---: | ---: |
| experimental-publication/entity.ts | 5,800 | 29 |
| entity-signal.ts | 3,800 | 19 |
| internals/intrinsic-mutation.ts | 1,200 | 6 |
| internals/entity-publication.ts | 1,000 | 5 |
| experimental-publication/private.ts | 1,000 | 5 |
| internals/utilities/deep-equal.ts | 800 | 4 |
| internals/location-runtime.ts | 600 | 3 |
| physical/entity-value-store.ts | 200 | 1 |

This establishes collection-size-independent counted overhead for this exact point workload, not acceptable cost, universal constant work, or a CPU ratio. The counter counts some full array lengths even for early-exit methods, counts copies as well as iterator yields, and misses operations such as flatMap and indexed loops. Replacing iteration syntax to evade it is not an optimization. The original positive calibration after the failing threshold was not reached.

## Concrete optimization candidates and required evidence

Source paths below are relative to diagnostic `candidate/packages/kernel/src/lib/`.

1. **Reduce repeated per-row certificate copies within a prepared unit.** `experimental-publication/entity.ts:95–96,109,141` performs five Map copies, each copying the two-field row in this workload: 2,000 counted visits total. These are row maps, not collection maps. A bounded candidate is one immutable prepared row version per distinct physical/ordinary step, reused where the exact version is identical. Do not alias a subsequently mutated map or mutable view requirement. Physical versus ordinary support, equal-value ownership changes, retained receipts, reentry, and earlier-step evidence must still remain distinguishable. Eliminating all five is neither established safe nor sufficient to meet the budget.
2. **Avoid rebuilding the one-point topology/publication representation.** `entity-signal.ts:995–1168,2254,2292–2293` repeatedly groups, spreads, and maps the same prepared changes; this module contributes 3,800 visits, not all removable. A point representation can carry the canonical prepared change through topology, responsibility, and publication without repeatedly manufacturing group/completed-change arrays. This must be selected from the actual nonstructural unit, not from absence of observers, and preserve ordinary/physical divergence and authored scope.
3. **Assemble terminal records once.** `intrinsic-mutation.ts:20` filters three-plan arrays at both native and source publication layers: 1,200 visits. A shared append/assembly path can avoid intermediate arrays and duplicate flattening while preserving install order, finalization, and completion ownership. Verify real object/array reduction rather than merely avoiding instrumented methods.
4. **Keep intrinsic input evidence; avoid redundant capture scaffolding only where identical.** `experimental-publication/private.ts:95,109` contributes 1,000 visits through supplied-view capture, requirement deduplication and input conversion. These occur even without consumer Links. They are not evidence of an unnecessary consumer scan. Reuse requires the same captured input frontier and support identity; no delayed physical reread. Likewise, source publication's 1,000 visits cannot all be deleted: native preparation and completion remain required even with no recipient.

The remaining equality, value-store, and invalidation visits have direct mutation/delivery purposes. There is no evidence here authorizing their removal. Preserve late enrollment after pending work, foreign input proof, inspection divergence, exact inverse endpoints, and completion reentry in any candidate. The trace establishes repeated scaffolding; it does not establish that the <2000 ceiling is achievable under current contracts.

## Prepared placement: 3N reproduced, bounded fusion candidate

Unchanged controls produce 96/384/1536 visits at N=32/128/512 for both setAll and prependMany, exceeding 64/256/1024. Correct ordered ids are asserted before the failed budget. The seventh lifetime/rollback control passes.

The spy counts only iteration of the physical placement stage's patch. Source has three matching consumers: the staged key lookup in `physical/entity-mutation-frame.ts:181`; physical interval capture via `entity-signal.ts:1341` and `physical/entity-ordinary-topology.ts:75`; and the visibility index's present-row extraction in `physical/prepared-placement-visibility.ts:17`. This is source attribution consistent with 3N, not an independently stack-instrumented placement trace. Ordinary-stage iterations and physical.patch.keys() are outside this particular counter.

A bounded candidate fuses interval capture and visibility seed extraction at the same finalized physical stage, or supplies both from a single immutable prepared-patch enumeration. Do not reuse the earlier key lookup blindly: final placement may change after that lookup. Preserve before/after interval identity, neighbor visibility overrides, excluded-subject traversal, cycles, and rollback lifetime. This is transient per-preparation reuse, not a persistent collection root or a global index.

## Eager allocation: correct the name and bound the claim

`audit-entity-projection.spec.ts:27` in the combined log fails because registry.allocate was called once during bare setAll, before row acquisition. It measures a **collection position owner allocation**, not a count of projection objects. `entity-signal.ts:1386` eagerly evaluates getPositionIds for publication preparation; `getPositionIds:1645–1655` allocates/registers that owner. The point path also eagerly calls it at 2293. This explains a concrete loss of laziness; it does not quantify heap cost.

A candidate may separate intrinsic publication's collection identity from optional position-registry materialization, or defer position resolution only to the operation that requires it. First establish that owner-cell lookup, inverse/capture metadata, and later public metadata acquisition still identify the same authority. An undefined-owner fallback or noLinks bypass is not justified. This audit did not independently rerun the allocation control; the failure is preserved in the supplied combined log at 1431–1446.

## Fatal heap failure is separate, unresolved evidence

`/private/tmp/st-current-read-integration/runs/combined-full/first.log:1233` contains:

> FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory

The preceding V8 records show approximately 4 GB of heap; the native stack includes MapPrototypeSet. Lines 2205–2213 report a Vitest worker unexpected exit. These establish a fatal allocation failure, not the responsible test, data structure, retained object, or asymptotic cause. Do not assign it to entity-large-batches or call the reported ten unexecuted cases failures/passes without identifying them. No 130k replay was run and no heap/timeout was raised.

The point histogram cannot explain this OOM. Native publication eagerly allocates prepared Maps/arrays and maintains eight support maps (`experimental-publication/entity.ts:20–27,76–93`). Those are concrete allocation/retention candidates, not a proven leak. Existing inspect() omits mappings/mappingViews, so its counts cannot establish complete retirement.

If pursued, the finite next discriminator is 32/128/1024 rows, fixed-width payloads: count prepared container/entry creation separately from all eight retained maps after population, removal, completion, and destroy. Compare neutral owner-free churn with foreign pending absence proof and retained receipts, then settle/release. Count sites directly; process heap snapshots or GC timing are unnecessary for that first discriminator. This separates transient construction from live correctness obligations and missed retirement. None of those proposed allocation counts were measured by this audit. No global no-observer shortcut is warranted: future enrollment still needs existing native evidence.
