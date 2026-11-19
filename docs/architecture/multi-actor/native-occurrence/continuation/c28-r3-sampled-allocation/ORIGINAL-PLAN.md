# Bounded allocation-pressure discriminator — plan only

No instrumentation, profiler session, workload or runtime change executed for this plan. Preserve the matched-memory and N512 retention packets. Goal: identify allocation-producing work in the remaining replacement/undo/redo workload, not justify heap limits or establish index-specific OOM causality.

Arms remain exact frozen R3 manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3 versus prepared disposition-index only. Adapter source hashes: baseline108517fe533b6e5f0c4abbbb700ed1d358ac3db170fbac6bf3ed270872018eb6; indexed0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce. Do not compose metadata/dynamic successors into this experiment. Reverify all3,095 input paths before/after.

## Source findings

Paths relative to packages/kernel/src; source inspection, not reached allocation attribution:

1. **Known removed repeated scan:** adapter publicationMeta baseline filters every ordinary plan's changes per effect. Indexed source builds owner/subject group arrays once, then slices selected groups per call. Index stores references to existing changes, not cloned payloads. The baseline filter can allocate many tiny arrays while testing a large domain; an O(N²) predicate count does not imply O(N²) output bytes. Count input domain, output lengths and call multiplicity separately.
2. **Whole backing-map copy, reachability unproved:** physical/entity-value-store.ts:164–175 prepareTargetValues creates `new Map(retainedEntities)` and then applies prepared subjects. physical/prepare-entity-target.ts:130–155 also copies current/target order and deep-clones each target value. entity-signal's __prepareTransitionTarget binding (:5521+) exposes this target route. A once-per-collection copy is linear in retained subjects; repeated invocation on growing prefixes could be expensive. Source has not established which route this exact undo uses or how often. This is the highest-value cheap reachability/cardinality discriminator.
3. **No demonstrated descriptor-prefix copy:** adapter rememberTreeRealizationDescriptor:380–397 reuses structuralEffects, structuralEffectBySubject and subjectDescriptors when they are Maps. Do not label these `new Map` expressions per-row growing copies merely from a search hit. Count fallback-clone frequency/size if sampled stacks later implicate this path. restoration.ts:618 appends new cloned effects to existing history rather than cloning its entire prefix there.
4. **Shared full-unit list copies:** internals/entity-publication.ts:29 flattens steps into ordinary edits; :332 concatenates physical/ordinary/step packet lists once per grouped point preparation. intrinsic-mutation.ts:21–26 composes terminal deletes/writes/adds with flatMap. Those operations are not fully covered by the old visit counter. Whether composition repeatedly copies a growing record depends on call/input sizes, not the presence of flatMap. Keep their order/identity contracts.
5. **Per-row snapshots/evidence:** experimental-publication/entity.ts:148/149 copies staged field and view maps, :162 snapshots physical edit views, :196 copies selected physical evidence. With two-field rows these copies are bounded per row; duplicate edits of a subject may add more versions. Many empty Maps/Sets and evidence/support closures are created per prepared unit (:130–147 and :196 onward). Need unit count, rows per unit, field-map size totals and retained per-edit evidence count before calling this collection-quadratic.
6. **Shared structural and history representations:** entity-signal.ts:1450–1515 deep-clones add/remove payloads into structural records and prepares physical placement; entity-mutation-frame.ts:402 and415 materializes observed changes and changed subject IDs. restoration.ts:3941–3987 copies effects/descriptor inputs and completes order evidence when draining capture. These may produce several linear representations at once. Raw count13000 point-write evidence does not measure their bulk bytes.
7. **Native proof arrays:** lifecycle.ts:290–320 constructs inputs/known/frame arrays and terminal edits, then finalizes candidate windows. The frozen workload has no Link/declaration and no transaction enhancer, but source inputs/native factory can still exist. Do not infer zero native work, recursive-prefix growth or permission to suppress it. Count shallow input/frame/record lengths only if this family is reached; no recursive proof graph traversal.

No new growing-prefix allocation is proved by this audit. The evidence supports testing multiplicity/cardinality before interpreting broad whole-heap totals.

## First choice: source-local cardinality, before allocation sampling

Authorize a separate diagnostic overlay only, same placements in both arms. N512 then N2048 (four fresh workers maximum, alternate arms by size), preserving original preceding membership case and all original replacement/undo/redo assertions. No heap profile or prototype wrappers in this phase.

Accumulate primitive integer counters during already-existing loops, output only after the original operation/drain or after a prepared plan is fully built, never from atomic installation. No arrays of plans/values/stacks, no new native snapshot, no additional traversal to count objects. Counter increments must not invoke user code.

Finite counters per logical stage (seed/replacement/undo/redo/cleanup distinguished):

- prepareTargetValues: calls, sum/max retainedEntities.size and prepared subject count. This immediately distinguishes absent route, one full copy, or repeated full copies. Read size before existing Map constructor; do not enumerate it again.
- EntityPublicationSource preparation: calls, packet ordinary/physical/step counts; native participant calls. At existing row-copy sites tally source-map.size and snapshot count.
- combineTerminalRecords: calls, sum/max input writes/adds/deletes lengths; count lengths in its existing composition callbacks rather than add a walk. Record output lengths when available. Inputs are private prepared primitive records, not user getters.
- Adapter: ordinary plan count/change count, publicationMeta call count and emitted selected-disposition count. Indexed group reference additions counted inside existing grouping; baseline matches selected output size without constructing a second index. Distinguish N² filter visits from total selected references.

This is enough to answer whether a visible copy multiplies by collection size per subject. If it does, report exact callsite, stage, counts and mechanism for review and STOP before a profiler. If counts are linear with large multipliers, do not optimize on counts alone: a sampled byte attribution is useful next. Avoid adding extra counters after seeing results without a concrete question.

## Conditional sampled-allocation pair at N2048

After cardinality results are reviewed, if byte dominance remains unresolved: exactly two fresh workers, baseline then indexed, same original first membership case and restoration case. N2048 fixed, no130k or adaptive sizes/retries. No cardinality/prototype instrumentation in this pair; keep separate artifacts. Original fixtures/imports/assertions/timeouts unchanged apart from N and output-only profiling boundaries.

Use `node:inspector` Session connected to the actual test worker (local connection; no listening debug port). Record worker PID, Node/V8 versions, process.execArgv, NODE_OPTIONS, heap limit, lock/tool versions and session errors. Require a functioning HeapProfiler; failure is a tooling failure, never a skip/pass.

Fixed requested parameters for all stages/arms:

- samplingInterval:32768 bytes (average probabilistic interval, not one guaranteed sample per32KiB).
- stackDepth:64.
- includeObjectsCollectedByMajorGC:true and includeObjectsCollectedByMinorGC:true, to include temporary allocations discarded during collection. Record exact protocol command/reply. Verify support against the actual pinned Node24 V8 protocol before running; installed Node type declarations expose only the older samplingInterval option, so a type cast or accepted request alone is not proof of complete sampling semantics. If runtime capability cannot be established, stop and label the limitation rather than silently use a live-only profile.

The upstream protocol describes node selfSize as bytes excluding children and samples as sized, time-ordered entries; its collected-object flags distinguish temporary allocation pressure from live-only sampling. Reference: https://raw.githubusercontent.com/v8/v8/main/include/js_protocol.pdl (HeapProfiler domain, lines692–781 as inspected). Current upstream documentation is not a receipt for the pinned runtime.

Three independent startSampling/stopSampling windows per worker:

1. **Replacement+ordinary drain:** after initial seed and its original12-microtask drain, immediately before undoable(setAll replacement), through its original12-microtask drain. Includes synchronous preparation/install/publication plus deferred capture/history. It is not labeled preparation-only.
2. **Undo synchronous operation:** immediately before tree.undo(), stop immediately after it returns; then execute original undo count/ID assertions unmodified.
3. **Redo synchronous operation:** immediately before tree.redo(), stop after return; then execute original redo ID assertion unmodified.

No profiles for import/seed/membership/cleanup in this initial pair. Do not infer absent allocation there. No added awaits between original undo/assertion/redo: require local inspector boundary callbacks to complete synchronously for these commands; if they do not, stop as harness-inapplicable rather than silently change scheduling. Replacement retains only its existing awaits. Profiling commands/serialization are outside sampled windows; no inspector command inside a runtime preparation loop. Do not force GC or enable heap tracking/snapshots. Preserve original finally destruction even on failure; stop/disconnect session in diagnostic finally without replacing the first workload error.

Save each raw sampling profile to an owned file after stopping that window; discard profile objects after writing. Exact command and raw profile hashes, all stage markers and resulting test assertions are retained. Profiling/serialization can change natural GC scheduling and subsequent stages despite being outside windows; no timing or CPU comparison is permitted.

## Analysis and containment

Preserve raw callFrame URL/function/line/column and profile sample identities. Node IDs are local to each profiling session; never subtract/merge them across start/stop sessions. Attribute each sample once to its leaf node/call stack; do not add cumulative ancestor bytes to self bytes or double-add samples and node selfSize. Report harness/inspector/runtime/unmapped frames separately. Resolve generated TS/Vite frames with preserved transform/source-map evidence; an unmapped frame remains unmapped. Group only after retaining exact raw paths.

Per stage/arm report estimated sampled bytes by source family and stack, sample counts and unattributed fraction. Sampling is statistical; missing small sites are not zero allocation. No confidence interval or precise cross-arm ranking from one pair. Do not equate sampled allocation bytes with RSS, live heap, peak heap or retained/dominator size. Use cardinality evidence to explain a dominant site's multiplicity; otherwise label attribution incomplete.

Keep existing180s startup/no-progress and360s absolute caps, owned PID/birth census covering detached groups, unchanged test timeouts. Stop at first workload/protocol/assertion/source failure, sampled boundary heapUsed>512MiB, or raw profile>32MiB / >100,000 sample entries. These are experiment containment limits, not product budgets. Profile response itself may allocate before size checking; external timeout remains necessary. No automatic higher threshold, finer sampling, repeat, heap dump, CPU profile, GC inside work or large workload.

Expected useful evidence: unchanged two cases pass per worker, no source drift, all requested stages present; first incomplete/failed output remains preserved. Such a pass qualifies the diagnostic semantics only. If allocations are broadly shared linear work, retain that answer; do not force an index explanation. Any subsequent mechanism change or expanded experiment requires its own bounded review.
