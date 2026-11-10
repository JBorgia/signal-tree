# Candidate C construction CPU and populated heap attribution

November 10, 2026. Candidate C remains on production HOLD. The dominant construction cost in this fixture is populating an EntityMap through the general mutation and publication path. The largest identified heap cost is the representation of current publication evidence for rows whose physical and ordinary state agree. Runtime source was left at Candidate C.

## Measured costs

The fresh campaign used exact Candidate C kernel bytes, verified against the qualification manifest for all 193 package files, and published kernel 15.4.4, downloaded anew and matched against the prior SHA-1 and SHA-512 binding. Node 24.15.0 on Apple M4, production mode, fresh serial processes with a 768 MiB old-space cap and per-child timeout. Host load and free memory are in the samples. This is development evidence from a shared host. Samples were scheduled before launch. Each ordinary profile has two v15 A/A controls and three alternating comparison pairs. Heap profiles used the existing forced-GC and turn quiescence rule. Construction phase probes add instrumentation, so this campaign is separate from the prior qualification timing cohort.

| Ordinary workload | v15 median | C median |
| --- | ---: | ---: |
| 200 creates, checks, and destroys, same fields and empty collection, synchronous process CPU | 48.17 ms | 49.47 ms |
| 200 create/populate/check/destroy tasks, 100 rows each, synchronous process CPU | 57.24 ms | 345.83 ms |
| The 100-row tasks, population phase alone | 28.43 ms | 311.21 ms |
| 30 create/populate/check/destroy tasks, 1,000 rows each, synchronous process CPU | 38.22 ms | 600.38 ms |
| The 1,000-row tasks, population phase alone | 30.56 ms | 590.32 ms |
| Ten trees, 16 scalar fields and empty collections, live minus baseline | 1,030,952 B | 1,268,160 B |
| Same ten trees, 100 three-field rows per tree | 1,569,200 B | 3,675,336 B |
| Same ten trees, 1,000 three-field rows per tree | 4,719,904 B | 17,721,344 B |

The 100-row population CPU ranges were 27.65–28.55 ms for v15 and 297.35–314.90 ms for C. The phase accounts for about 98% of the median batch CPU gap in that fixture. Empty-collection CPU ranges overlap. The 1,000-row fixture used fewer batches and fewer warmups, so cross-size ratios do not establish scaling complexity.

A separate V8 sampling pair on the 100-row workload places about 139 ms of C sampled stack time under `setAll`, about 114 ms under frame preparation, including 47 ms under publication preparation and 35 ms under ordinary topology preparation. The corresponding v15 `setAll` stack has about 7 ms. These are inclusive, overlapping elapsed sample weights, with GC and inspector work visible separately. The phase CPU measurements above are the quantitative comparison. The profile localizes work but does not predict the CPU saving from removing a particular allocation.

## What the heap holds

Separate snapshots at 0 and 1,000 rows per tree show a **12,763,640 B** cross-version difference of populated-minus-empty snapshot self sizes. Following named context edges from Candidate C's entity participant into its maps and backing tables identifies **10,059,520 B** of distinct map, table, and wrapper nodes in the populated snapshot, about 79% of that snapshot difference. Those named participant maps are absent in the empty snapshot. This is a direct census of those nodes, excluding their referents and shared requirements. It is not dominator retention, an exact partition of process heap, or a measurement of recoverable bytes.

| Candidate C participant storage for 10,000 rows | Snapshot self size |
| --- | ---: |
| 10,000 ordinary field maps, their backing tables and 30,000 endpoints | 3,280,000 B |
| 10,000 physical field maps, their backing tables and 30,000 views | 3,040,000 B |
| Eight outer indexes per collection, their backing tables and direct member/visible/placement/mapping wrappers | 3,739,520 B |

There are ten distinct requirement nodes referenced across the counted endpoint and wrapper channels. The excess is predominantly in how a common proof is indexed and represented, with two field maps per row and separate indexes for membership, placement, and key mapping. The inspection baseline and divergent-topology maps have no visible row entries in this snapshot. Row handles were never requested. Transaction journals, row-handle caches, and divergent row values do not explain this measured ordinary gap.

In a separate C-only probe, ten enhanced stores each authored two overlapping owners on one primed row. Both rollback steps checked the expected intermediate values. Across three corrected fresh processes, pending minus primed was 446,568–447,480 B. Settled heap was roughly another 0.40 MB higher at that checkpoint, so this delta is not a retained owner-cell size or a cost per transaction. The first probe failed its final WeakRef assertion with one tree still visible after the inline async scope. A separate helper scopes the transaction locals to the exercise and preserves the assertions. All 30 sentinels clear in the corrected probe. The first result is preserved as a teardown failure of that invocation, with its cause unresolved.

## What the guarantees require, and what to test cutting

- **Installed provenance for late readers.** An ordinary write has to leave sufficient source evidence for a link or history consumer acquired after installation. A subscriber-count or enhancer check cannot remove that obligation. The fixture shows that an aligned fresh batch can use the same requirement across all rows and channels. Test whether a compact aligned representation can refer to a shared requirement and retain sparse exceptions for changed fields, placement, mapping, or presence. Keep bounded point lookup, captured endpoint identity, and exact retirement. The prior fused-map prototype regressed populated heap. Treat shared defaults with sparse exceptions as a new hypothesis, with dual-map C as the control.
- **Independent physical and ordinary observations.** Inspection and rollback can make the two sides differ, and saved inspection snapshots must retain the proof visible when acquired. The contract requires distinguishable evidence when values, presence, or support diverge. The snapshot shows the current representation pays for both containers even when they agree. Never reconstruct captured evidence from current row values or current owner state.
- **Atomic bulk installation and stable per-edit evidence.** Candidate C builds a general frame, an ordinary topology plan, paired packets, and per-edit selected evidence for an empty-to-populated batch. The native participant makes physical row snapshots and builds another physical row for selected evidence. Test eliminating the redundant copy and repeated enumeration for an admitted sequence of unique fresh subjects, while preserving read isolation after reentry and later writes. Keep duplicate subjects, divergent or inspection participation, active observation, removals, and order changes on the proven general path unless separately qualified. The two fresh-add structural-effect payload clone sites also merit a targeted test. Check callback mutation and notifier delivery timing before sharing or deferring any clone.
- **Settlement and reclamation.** Overlapping owners require exact owner status, captured input, independent publication, and release of only the retired lifetime. Preserve these facts and the stale-reader checks. The ordinary result isolates a larger opportunity than owner-journal tuning, and the enhanced probe gives no justified per-owner saving target.

Start with the narrowly scoped bulk-preparation hypothesis for CPU. Evaluate the compact aligned representation separately for retained heap, with a negative control for saved evidence across divergence and retirement. A candidate would need the original point-work bound, fresh-only and mixed/repeated bulk tests, late acquisition, independent settlement, saved inspection, reentry and reclamation witnesses, plus matched construction/heap/point measurements. These are falsification targets for follow-up experiments. No implementation or release threshold is selected here.

Source anchors are the [bulk entity frame and setAll implementation](../../../packages/kernel/src/lib/entity-signal.ts), [native entity publication participant](../../../packages/kernel/src/lib/experimental-publication/entity.ts), [value-store divergence handling](../../../packages/kernel/src/lib/physical/entity-value-store.ts), and [the prior dual-map decision](../2026-11-04-fast-point-dual-map-runtime/README.md).

## Evidence

The packet contains the schedule, input hashes, verified kernel artifacts, harnesses, raw measurements, CPU profiles, heap snapshots, first failure, corrected enhanced probe, analysis scripts, and focused witness output. The main run produced all 54 ordinary and attribution results before the pending teardown failure stopped the registered sequence. A separate post-run hash check closes the ordinary artifact bindings. The corrected pending runs form a separate probe.

The focused source witnesses passed all 42 cases across five files. The exact command was `NX_DAEMON=false pnpm nx test kernel --skip-nx-cache --maxWorkers=1 integrated-late-history packet-physical-pair-semantics saved-inspection-snapshot-isolation fixed-window-retirement entity-large-batches-v16-controls`.

[Evidence archive](evidence.tar.gz) and [SHA-256](evidence.sha256). To reproduce the analysis after unpacking the archive, run `python3 analyze.py runs` and `python3 maps.py runs/53-snapshot-1000-C.heapsnapshot`. To collect a fresh cohort, extract `kernel.tgz` beside the harness, make the pinned workspace dependencies available there, and run `python3 campaign.py /absolute/path/to/node /absolute/path/to/candidate/dist` in a fresh packet directory with the harness files. The registered schedule includes the original pending scope so its first failure is preserved separately from the corrected probe.
