# Amended sampled allocation pair: completed, interpretation review pending

Both first N2048 workers passed the unchanged two selected cases (4 case executions total;9 cases excluded per worker). All six windows produced raw sampling profiles. No cap fired; final owned PID/birth censuses empty. Runtimequalification candidates/root were not edited. No additional workload or profile repeat.

Original PLAN, the contradictory preflight REPORT.md, pinned protocol/implementation, and owner-authorized AMENDMENT.md are preserved. Use RESULTS.md for the completed state; REPORT.md intentionally remains the earlier stop report. Preflight used actual Node24.15.0/V8 13.6.233.17-node.48 and synchronous Session.post start/stop callbacks. Both collection flags are supported in exact tagged V8 source and were true in every actual request. Sampling interval32768, hardcoded depth128; no ignored stackDepth option was sent. Every actual start/stop completed synchronously. No additional await was inserted. Stop invokes Inspector-imposed GC while sampling is still active. No manually requested GC, heap override or full snapshot.

## Identity and original behavior

Baseline frozen3095-file manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3; indexed entry map differs only in adapter108517fe533b6e5f0c4abbbb700ed1d358ac3db170fbac6bf3ed270872018eb6 → 0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce. Both frozen inputs reverified after runs with zero mismatches. Disposable runtime hashes checked before/after each run; no cardinality hooks. Only test instrumentation and N substitution; original bodies recover byte-exactly after stripping markers/helpers and reverting N. sampling-overlay.patch and ORIGINAL.spec.ts preserve this. Shared harness.mjs imported by both worker copies; no config/runtime edits.

Original membership seed/replace/clear, count0 and events>0 assertions, reader stop/tree destruction remain. Restoration seed+12-microtask drain precede sampling. Replacement window covers undoable setAll and original12-microtask drain. Undo and redo windows cover their synchronous calls; original count and first-ID assertions occur after profile stop. Destroy remains in original finally. Original60s/120s test timeouts unchanged. These assertions are useful but do not assert every row payload. No types/full-suite claim for disposable instrumentation.

Fresh workers12515 baseline,13344 indexed; same reported heap limit4496293888, cleared NODE_OPTIONS, own Nx cache/data/TMPDIR. Supervisor uses180s launch/no-progress and360s absolute caps,512MiB boundary heapUsed containment; profiles bounded at32MiB and100000 samples. Actual raw profiles133039–320123 bytes,2006–4380 samples. Sampling command/parameters/responses and hashes in each protocol.jsonl. Exact Nx commands and environment in COMMAND.json. Generated source collection ran after original destruction, outside all sampling windows.

## Raw sample totals (not exact allocated bytes)

Each raw `samples[].size` is counted once at its nodeId. These are V8 estimated sample weights, not CPU time, retained heap, peak heap or total process allocations. No ancestor accumulation or addition of selfSize to sample sizes.

| arm / window | samples | summed estimated sample bytes | samples missing tree node / estimated bytes |
| --- | ---: | ---: | ---: |
|baseline replacement+drain|2006|71322864|2 /121504|
|indexed replacement+drain|2056|73050592|3 /154504|
|baseline undo|3866|135127768|1 /36192|
|indexed undo|3891|135816088|0 /0|
|baseline redo|4356|151992312|0 /0|
|indexed redo|4380|153097016|0 /0|

First analysis failed on unresolved sample nodeId; analyze-first-failure.cjs and analysis-first.log retained. Corrected analysis preserves every orphan sample and reports it as unattributed; no rerun. Orphan fraction≤0.212%, but this is NOT the entire unattributed fraction. Roughly30–33% of estimated bytes have builtin/empty-URL leaf frames; these can have mapped candidate callers but the exact leaf is unresolved. indexed undo also has66096 bytes at candidate frames without a mapped position. Full leaf class totals are in ALLOCATION-SUMMARY.json. Node-runtime frames and diagnostic frames are separate classes. No claim that profiler overhead or unreported allocations are absent.

Raw tree selfSize sums differ from sample-size sums even in profiles without orphans (e.g baseline redo151921480 vs151992312). Both totals preserved, not reconciled or added. This packet does not establish the cause of that discrepancy; samples are the consistent arithmetic basis for the reported stack associations. Missing nodes and marginal mismatch limit precision and belong in independent interpretation review.

## Concrete observed paths; bounded interpretation

Mapped candidate caller families with large sample associations in BOTH arms are entity-signal, location-runtime, tree-realization-adapter, deep-clone and entity-ordinary-topology during undo/redo. Replacement additionally shows restoration and path-notifier. These are source-associated samples, not proof that one family owns all underlying bytes; builtin leaf allocations are associated with their nearest mapped candidate caller separately.

A repeated substantial undo/redo stack is:
`applyTurnEffectsThroughRealizationPort → validateEffects → buildPreparedRealizationContext → updatePreparedRealizationContext → byId / snapshotCollectionEntityValue → getOrCreateNode → createEntityNode → createWritableProjection/createDerived`.
Exact frozen source: adapter2297 snapshotCollectionEntityValue calls byIdOrFail; context update2305+ uses live collection readers; entity-signal3686+ getOrCreateNode can create/cache a node; createEntityNode begins3511; location-runtime169+ creates writable projection. Individual raw mapped stacks are preserved, including distinct callsites through snapshotCollectionEntityValue. The sampled call-frame location commonly identifies function declaration position, NOT the precise allocation instruction. No inferred copy count or asymptotic behavior from a single N.

Crucial scope correction: prior cardinality hooks proved **EntityPublicationSource's entity native participant** absent, not every scalar native factory. These profiles reach experimental-publication/private.ts:150's registerNativePublicationFactory callback under createWritableProjection. That is scalar initial requirement/view construction on materialized row projections; it does NOT demonstrate that entity native prepare ran or that generic native proof processing dominates this workload. No blanket native-free or native-proof-cost claim is supported. This sharper distinction corrects any earlier shorthand “native factory unreached.”

The disposition index's removed quadratic scans are established by prior cardinality evidence; these profiles do not demonstrate a large reduction in sampled allocation volume. The one-pair totals are not an equivalence test or ranking. Profiling/serialization/collection GC alter subsequent heap conditions; undo/redo are not observations of their unprofiled predecessor heap. No inference to130k OOM/stall causality, retention, peak, CPU or production performance. No optimization or further experiment automatically authorized.

## Mapping, failures and reproducibility

Each raw profile retains original nodeId/sample ordinal/callFrame. SCRIPT-INDEX.json includes actual Debugger.scriptParsed metadata/inline source maps; generated-sources contains corresponding runtime-transformed JS obtained after cleanup. Mapping uses pinned local @jridgewell/trace-mapping0.3.31; all43 baseline and44 indexed mapped source-content entries match captured source files byte-for-byte (SOURCE-MAP-CHECKS.json). Raw unknown frames remain unknown. No silently guessed TS line mapping. Per-window attribution files preserve weighted leaves with full raw+mapped stacks, and unresolved-samples files retain orphan records. Source collection had no cap/error.

Commands: `python3 /private/tmp/st-c28-r3-sampled-allocation/run.py`, then pinned Node `analyze.cjs`. First setup generator match assertion (before any worker) and first analysis failure retained; neither is a runtime test failure. Preflight-first.log and first workload logs preserved. No external host contention measurement; uncontrolled host remains a limitation. Runtime assertions passing qualify the instrumented diagnostic only.
