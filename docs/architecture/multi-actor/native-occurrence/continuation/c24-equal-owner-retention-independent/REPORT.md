# Independent bounded live-source retention discriminator

**Finding confirmed in the captured working prototype:** repeated equal declarations retain a source-owned component chain proportional to declaration count, despite one unchanged destination obligation. This is not merely a whole-tree collectibility concern. No final frozen-candidate verdict follows; author edits remain independent.

| Route | Equal calls | Selected nodes | Max component depth | Readiness visits | Proof visits | D owners |
|---|---:|---:|---:|---:|---:|---:|
| leaf |64|129|64|129|129|1|
| leaf |256|513|256|513|513|1|
| whole branch |64|129|64|129|129|129|1|
| whole branch |256|513|256|513|513|513|1|

Initial graph is1node/depth0 with1visit for each query. Input/validation/possible owner counts remain0. Leaf confirmation leaves the129/513-node graphs intact; whole-branch rollback selects the restored1-node initial requirement. These are structural counts of the selected source graph, not heap bytes, GC conclusions, timings or a claim about every other retained object. Depth is edges from root. Counts match R(n+1)=combine(R(n),fresh), giving2n+1nodes and depth n.

## Exact source and instrumentation

`CAPTURE.json` lists181 runtime-only files copied from `/private/tmp/st-c24-equal-owner/candidate`, their SHA256s, and changedDuringCopy=[] from a second read. This is a precise working-runtime snapshot, not an author freeze/full workspace identity. No author source was modified or executed. Its captured runtime lives under `source/packages/kernel/src`; dependency resolution uses the root node_modules linkage, pinned Node24.15.0/pnpm10.17.0. The frozen C23 workspace supplies only Nx execution context/config discovery, not the imported library runtime.

`private.uninstrumented.ts`, `lifecycle.uninstrumented.ts`, `instrument.mjs`, and `INSTRUMENTATION.patch` preserve the two diagnostic changes. Added counters increment at nativeRequirementReady/nativeProof entry. A private diagnostic getter looks up the selected nativeValues requirement, iteratively counts its components, resets visit counters, and calls the existing readiness/proof functions once. It returns counts/owner-role sizes only. No decisions, owner transitions, equality, callback insertion, installation or readiness implementation is replaced. This does add observation overhead; no performance measurement is made. No public API export is changed.

`specs/retention.spec.ts` runs leaf/whole routes at64/256 repetitions with a live p owning x7. Receipts are discarded. Each iteration asserts no outbound value; after all repetitions, assertions check exact source value, unchanged p.inspect(), zero equal notifications, fixed owner counts, ready evidence, and unresolved settled waiter. Leaf arms confirm p and require exactly one x7 output; whole arms rollback p and require exactly one x0 output. Both await settlement and assert no duplicate and no output after disposal. Four public assertion cases pass in the first complete run. Structural growth is diagnostic evidence reported here, not an arbitrary newly invented numeric ceiling disguised as a passing gate.

## Execution and preserved runner failure

Command in `runs/neutral/COMMAND.json`:

`corepack pnpm nx exec -- pnpm exec vitest run --config /private/tmp/st-c24-equal-owner-retention-independent/vitest.config.mjs --maxWorkers=1`

Own cache/data/tmp and120s no-output/240s total watchdog; ancestry/birth-checked owned groups. `nx exec` unexpectedly iterated the same command in multiple contexts. Raw log contains repeated runs of ONLY this four-case diagnostic, not a broad suite. After observing repetition, the verified owned groups were terminated. Final runner result is **exit-15, no deadline, no observed descendants remaining**, not exit0 qualification. The first full Vitest run reports4/4 passes and first four COUNTS rows; those are the primary bounded evidence. All32 recorded rows and repeated-run logs remain preserved, not erased or pooled into a larger qualification count. No additional invocation/retry was launched. `MANUAL-STOP.txt`, `SIGNALS.json`, ownership logs and RESULT preserve cleanup.

`COUNTS.jsonl` is append-only raw. `FIRST-RUN-COUNTS.json` extracts its first four rows without modifying it. Later repeated rows agree on recorded structural counts; they are not needed for this finding. No heavy builds, timings or heap/GC workload occurred.

## Disposition

The source hypothesis is now backed by exact bounded execution: useful safety/settlement succeeds while retained graph depth and proof/readiness traversal grow with equal-operation history. Confirmation alone does not reclaim it. Require a bounded current-support representation before accepting this mechanism. Flattening recursion while retaining all settled components would not satisfy that requirement. Preserve live validation/readiness and all D/I/V/W/unknown/rejected-role obligations; this report prescribes no runtime patch. Recheck the final frozen implementation and repeat only the discriminating controls warranted by its actual changes.
