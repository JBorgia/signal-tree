# Finite native-publication allocation discriminator

The bounded evidence rules out **retention-only** as an explanation of all observed cost. Native population repeatedly materializes full-batch arrays even with zero recipients. The retirement candidate fixes the measured owner-free retained records but leaves that construction unchanged. This does **not** establish which test or allocation caused the earlier 130k/full-run OOM.

## Runs and identity

Two separate diagnostic copies, based on frozen `/private/tmp/st-row-source-successor/candidate` and `/private/tmp/st-publication-retirement-successor/candidate`. Originals remain untouched. `VERIFICATION.json` checks all 172 manifest-listed kernel non-spec files in each original and allows exactly two instrumented files in each copy; source SHA-256 pairs are in `IDENTITY.json`. Instrumentation diffs are `row-instrumentation.patch` and `retirement-instrumentation.patch`. Added helper and spec hashes are recorded too.

Final suites: **10 passed per candidate**: nine finite workloads plus one counter calibration. Nine raw checkpoint records per candidate are in `row.jsonl` and `retirement.jsonl`; `SUMMARY.json` contains totals and all retention counters at every phase. Logs are `row.log` and `retirement.log`. `summarize.py` verifies the formulas and cross-phase retention findings rather than inferring them from test pass status.

Node 24.15.0, pnpm 10.17.0, Vitest 4.1.9. For each ARM=row or retirement, run from this directory's ARM copy:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH \
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
ST_ALLOCATION_OUTPUT=/private/tmp/st-publication-allocation-discriminator/ARM.jsonl \
corepack pnpm nx test kernel --skip-nx-cache allocation-diagnostic.spec.ts --maxWorkers=1
```

Replace ARM in both cwd and output path. Output appends; use a fresh output filename for replay. No heap or timeout override, no 130k rerun, no CPU/timing claim. Existing unrelated tsconfig discovery warnings appear in logs; selected tests executed. These are diagnostics, not release/typecheck qualification.

## Measurement scope

For each N=32/128/1024: populate fresh two-field rows `{id,n}`; remove all rows owner-free (bare or holding a delivered receipt), or remove N−1 under a foreign pending transaction while retaining one useful row. Checkpoints separate synchronous method return (which already includes synchronous completion) from microtask/notifier drain. “Complete” does not mean owner settlement. Foreign confirmation has its own checkpoint.

Counters are source-site stamped. AllocationMap counts constructors, iterable entries copied, set calls, and absent-key insertions for Map constructions in **experimental-publication/entity.ts only**. It keeps ordinary Map values/order and does not retain counter references to maps or payloads. Array counters wrap the actual proposal spread and entityPublicationOrdinary flatMap result without changing their iteration. Calibration checks contents plus copy/update distinction. This is neither an exhaustive JS-object allocation census nor a byte/live-heap measurement. Sets, object literals, other modules' containers, and retirement readiness arrays are not counted. Zero measured maps during retirement does not mean zero allocations.

All eight source maps are inspected: rows=fields-map entries; presence=members; placements; viewRows=views; visible; placementViews; mappings; mappingViews. Nested field/view entry counts are also recorded. The row predecessor required only adding the two omitted mapping counts to inspection. Before population the native participant is unallocated, so those counters are absent rather than falsely reported as zero.

## Population construction, identical in both candidates

These counts occur before any receipt/foreign transaction is created; source recipients=0. They match in all three modes.

| N | Native Map constructors | Map iterable entries copied | Proposal arrays / entries | Ordinary flatMap arrays / entries | Combined measured array entries |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | 180 | 192 | 64 / 2,048 | 65 / 2,080 | 4,128 |
| 128 | 660 | 768 | 256 / 32,768 | 257 / 32,896 | 65,664 |
| 1024 | 5,140 | 6,144 | 2,048 / 2,097,152 | 2,049 / 2,098,176 | 4,195,328 |

Map constructors are 5N+20, including eight source root maps; copied Map entries are 6N. Recorded Map set calls and total absent-key insertions are each 29N (these are different metrics, not additive). Some prepared row maps become installed state; do not call every constructed map transient garbage.

The source mechanism is explicit: entity.ts:68 proposal creates `[...entityPublicationOrdinary(packet)].reverse().find(...)` for each of two authored fields per row. That makes 2N arrays of N references: 2N² entries. With steps present, entity-publication.ts:27–34 independently creates a flatMap array for each call, plus one ordinary-loop call: 2N²+N entries. Total **4N²+N** is reproduced at all three sizes. These are cumulative copied references, not distinct payload objects or simultaneous retained entries. The reverse/search work is additional and is not measured by these allocation counts.

Therefore eliminating retired records alone cannot remove this population cost. It exists in an initially empty, zero-recipient tree before removal and persists unchanged after the retirement fix. Extrapolating it into an OOM byte count would be unsupported.

## Retention through removal and destroy

All N-sized tables below apply at all three sizes. Tuple order is `(rows,presence,placements,viewRows,visible,placementViews,mappings,mappingViews)`.

- After population, both: `(N,N,N,N,N,N,N,N)`, with 2N nested field and view entries.
- Bare/held immediate removal return, both: `(0,N,0,0,N,0,N,N)`, with N negative memberships and N negative physical memberships. The retirement candidate has N queued retirement requests at this boundary.
- Bare/held after completion drain: predecessor remains `(0,N,0,0,N,0,N,N)`; retirement becomes `(0,0,0,0,0,0,0,0)`, with N retire calls and zero pending retirement requests.
- These respective counts remain after recipient disposal and destroy. In the held arm an actual declared write delivered 7 before removal; its terminal snapshot rejects mutation and stays unchanged after destroy, and the old row is absent. Keeping that receipt does not prevent neutral source retirement.
- Bare removal construction is identical between candidates at the measured sites: 24 Maps, no Map iterable copies, 7N set calls, 4N absent-key insertions; two flatMap arrays containing N entries in total. Later retirement cleanup changes retention, not these measured construction counts.

The test deliberately holds the private source through destroy to inspect it. Nonzero post-destroy map sizes establish records reachable through that held source, **not** a claim that the destroyed source is rooted or fails GC after all references are dropped.

## Foreign pending proof stays live

Both candidates retain `(1,N,1,1,N,1,N,N)` after removing N−1 rows under a foreign pending owner, with N−1 negative memberships. The test checks an actual pending possible-owner role on the removed subject's proof. A newly enrolled collection Link then declares an independent update to the surviving row. Its native value becomes 2, but no value is sent; the receipt is conservative/unknown. This is a useful-publication control, not silence from doing nothing.

The source maps remain at those counts after confirmation, recipient disposal and destroy through the held source. Readiness is not an owner-settlement notification, and this experiment invents no settlement cleanup policy. Presence of live negative proof is not evidence of a retirement bug. Future enrollment still needs the native source evidence even when there were no Links at removal.

## Preserved failures and limitations

`first-failures/` preserves the initial nine failures in each arm plus the original diagnostic spec and empty/partial records. The harness wrongly demanded all eight map counters before lazy native participant creation. Correction exempts only the created checkpoint; every post-population checkpoint still requires explicit counters. No runtime correction was made. The nine passing workloads before calibration are preserved separately as `*-before-calibration.*`.

The previous work-attribution histogram still has **22 setup-only visits**, because histogram setup was not reset with the original counter. Its runtime result remains 14,400, not 14,422. This allocation diagnostic uses separate source counters and does not reinterpret that result.

The earlier log `/private/tmp/st-current-read-integration/runs/combined-full/first.log:1233` reports fatal V8 heap OOM; the worker exit follows at 2212. Its causal test and retained/transient allocation mix remain unassigned. This experiment provides a concrete repeated-materialization mechanism at finite populations, not a reproduction of that OOM or proof of exclusive cause.

Concrete bounded proposals, including ordinary-point neutral-certificate sharing and final-placement enumeration at an identical authority version, are in `OPTIONS.md`. None is implemented; no no-observer shortcut, authority-policy change, persistent root, or counter-evading loop rewrite is proposed.
