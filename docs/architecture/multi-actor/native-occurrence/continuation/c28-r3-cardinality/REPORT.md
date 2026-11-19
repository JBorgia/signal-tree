# Matched source-local cardinality discriminator

Completed only the authorized four fresh workers: baseline512, indexed512, indexed2048, baseline2048. Each ran the two original membership/restoration cases through Nx: 2 passed, 9 excluded by name filter. All four first invocations exited0; no workload retry or assertion failure. No profiler, forced GC, heap-limit increase,130k run, runtime successor, or budget change.

## Exact evidence and scope

Frozen baseline manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3,3095 files; index differs only in tree-realization-adapter.ts (108517fe533b6e5f0c4abbbb700ed1d358ac3db170fbac6bf3ed270872018eb6 → 0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce). Both input manifests verified before copying and after all runs; FROZEN-INPUTS-AFTER.json has no mismatch. Root HEAD inspected628d302dadb082a48c58528651c9088234d0a777; unrelated root dirty files preserved.

Each disposable arm has five explicitly instrumented source files plus one primitive-counter helper. OVERLAY-MANIFEST.json identifies these diagnostic bytes separately from the frozen MANIFEST.json. Original sources and individual reversible diffs are in each arm's overlays directory. All ten patches were actually reversed in separate verification copies, recovering the frozen hashes (CHECKS.json). No hook was applied to either frozen candidate. The test overlay is separate, with exact original test preserved as ORIGINAL.spec.ts. Removing diagnostic helper/markers and reversing the single N substitution recovers the unchanged original bodies, assertions and60s/120s timeouts. No extra drain is present; the retained runner template's extra final drain was removed before any execution.

Instrumentation takes primitive lengths/sizes at existing copy boundaries, increments in existing filter/group loops, retains no runtime objects, and adds no loop/enumeration of source data. Hook bookkeeping itself is not an allocation measurement. All JSON/memory output occurs in test markers outside runtime operations. Counter intervals name the preceding marker and end at the current marker: synchronous operation vs original subsequent drain and assertion intervals remain distinguishable.29 marker rows per worker. Both original12-microtask drains are untouched.

## Proven multiplicity

Numbers below are **per undo, and separately the same per redo**, not totals across both.

| N | baseline filter input-domain total | filter calls | selected references, both arms | max selected array | indexed group visits/references/groups |
| --- | ---: | ---: | ---: | ---: | ---: |
|512|1,048,576|1,024|1,024|1|1,024 each|
|2048|16,777,216|4,096|4,096|1|4,096 each|

One ordinary plan of2N changes is prepared per undo/redo in both arms. Baseline publicationMeta (original adapter1595–1607) filters that2N domain for each of2N effects:4N² domain entries, but only2N output references in2N singleton arrays. Counts use actual array.length at the actual filter call, not an added predicate traversal. Indexed adapter1597–1626 visits/groups those2N references once; each publication still slices its singleton group. Thus the known quadratic search does not imply quadratic selected-array content allocation. Index allocation still includes its grouping Maps/arrays and selected slices; this experiment measures their cardinality, not bytes or dominance.

Common reached packet work, identical between arms:

| Operation | prepare calls | summed ordinary/physical lengths (each) | step presence |
| --- | ---: | ---: | --- |
|membership seed|1|N|present|
|membership replace|2|2N|both present; one zero-length packet|
|membership clear|2|N|both present; one zero-length packet|
|restoration seed|1|N|present|
|restoration replacement|1|2N|present|
|restoration undo / redo, each|2|3N|one absent; one present withN steps|
|restoration destroy|N|0|N present empty step arrays|

The destruction path's N empty packet preparations are real linear multiplicity, not zero work because their payload lengths are zero. These counters do not measure objects allocated before entering prepare or establish that this cleanup work is redundant. Original drain/assertion intervals produced no counts in these hooked families.

## Unreached families and limits

Every EntityPublicationSource.prepare invocation observed nativeAbsent; nativePresent and experimental entity.prepare stayed zero. This direct-import spec imports signal-tree/markers/restoration, not the root index's Link side-effect registration. This is measured for this fixture graph only; it does not contradict the root-import point-cost packet's native work.

- physical/entity-value-store.ts:164–175 prepareTargetValues: zero calls, so no observed retained-map copies via this route.
- internals/intrinsic-mutation.ts:21–27 combineTerminalRecords: zero calls. Input/output-length equality instrumentation is present but unexercised here; do not claim validated behavior of that family.
- experimental-publication/entity.ts:99,148–162,196 row field/view, physicalAt and selected snapshots: zero calls, corroborated by the nativeAbsent flag. No byte attribution is available for native allocations in other import graphs.

Entity structural payload cloning, restoration capture/history representation, descriptor construction, ordinary planner arrays, closures and backing stores remain outside these five hooks. Their allocation multiplicity/bytes are not bounded by this result. No newly demonstrated growing-prefix copy explains the remaining130k allocation pressure. A separately reviewed sampled-allocation pair remains a possible next diagnostic; it has NOT run and is not authorized by this packet. No CPU/timing/heap-causality or full-workload qualification claim.

## Invariants and containment

CHECKS.json and analysis-first.log verify actual packet flag partitions and matching ordinary/physical/step call counts; nativePresent equals reached native.prepare (both zero); selected lengths≤plan lengths; selected totals and maxima match2N singleton outputs; indexed group additions=visits=groups with no NaN skips; all recorded counters nonnegative integers. No in-hook invariant failures. Terminal-array invariants are explicitly unexercised, not credited as coverage.

Actual workers95886,96051,96201,96371 are distinct; raw memory rows report Nodev24.15.0, common heap limit4,496,293,888 bytes, no NODE_OPTIONS override. Commands use pinned corepack/pnpm and per-run Nx cache/workspace data/TMPDIR. Every run stores COMMAND.json, TEST.spec.ts, SOURCE-BEFORE.json, append-only first.log/events.jsonl/memory.jsonl, OWNED.json and RESULT.json. The supervisor retains180s startup/no-progress and360s absolute caps plus512MiB sampled-boundary containment. Startup is bounded from launch until progress; markers cannot interrupt a synchronous operation. No cap triggered. All final birth-matched owned-process censuses were empty. Source overlays and test hashes remained exact. ps/cancellation-capable supervisor used approved escalation solely to census owned descendants across detached groups.

Exact execution: `python3 /private/tmp/st-c28-r3-cardinality/run.py`; each worker command is `corepack pnpm nx test kernel src/lib/entity-large-batches.spec.ts '--testNamePattern=^entity batches larger than the argument limit' --skip-nx-cache --maxWorkers=1 --reporter=default --reporter=/private/tmp/st-r3-compatibility-inventory/full-reporter.mjs`. Analysis: `python3 /private/tmp/st-c28-r3-cardinality/analyze.py` exit0. No separate source/spec-type gate or broad suite was run for this disposable diagnostic overlay.
