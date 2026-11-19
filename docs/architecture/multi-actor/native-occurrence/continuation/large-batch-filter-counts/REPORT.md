# C19 bounded Array.filter count finding

Frozen for independent review. No runtime edits. Exact C19 input manifest SHA256 b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576; all 3065 input paths reverified unchanged in frozen input and own candidate. SNAPSHOT.json adds only the test probe. VERIFICATION.json gives hashes. No 130k replay, timing claim, budget adjustment, or resolution of the full-run blocker.

## Result

At N=16/32/64/128, the original first-case sequence (initial setAll, disjoint replacement setAll, empty setAll) has linear filter predicate counts. Exact original imports, including undoable/restoration, were loaded in the final run.

| N | No reader: initial / replacement / clear | Membership reader + subscription: initial / replacement / clear |
|---|---|---|
|16|64 / 128 / 48|96 / 192 / 80|
|32|128 / 256 / 96|192 / 384 / 160|
|64|256 / 512 / 192|384 / 768 / 320|
|128|512 / 1024 / 384|768 / 1536 / 640|

Thus 4N/8N/3N versus 6N/12N/5N in this range. Final-run filter invocation counts are constant: 6/7/6 without reader, 10/11/10 observed. Each observed operation emits one membership event (three total). Actual final count is zero in every workload. Intermediate IDs/counts and instrumented versus uninstrumented state/event parity are asserted.

## Source attribution

Paths below are under candidate/packages/kernel/src. Counts are predicate visits, not inferred array lengths. Full example stacks and per-operation counts are in EXACT-IMPORT-COUNTS.json. Two stack keys at entity-signal:1692 denote separate completion invocations; combine by location for this table.

| Filter site | No-reader visits: initial / replacement / clear | Observed visits | Predicate |
|---|---|---|---|
|lib/entity-signal.ts:337–338, surviving order|N / 2N / N|2N / 4N / 2N|Set.has; sets built before filtering|
|lib/physical/entity-mutation-frame.ts:226, final order|N / N / 0|same|id !== undefined|
|lib/physical/prepared-placement-visibility.ts:21, prepared present entries|N / 2N / 0|same|entry[1].present; clear does not invoke|
|lib/entity-signal.ts:1692, completion tombstones|N / 3N / 2N|same|mutation.kind equality|
|lib/internals/entity-membership-inventory.ts:183–184, surviving order|0 / 0 / 0|N / 2N / N|Set.has|
|lib/experimental-publication/lifecycle.ts:154, captureNativeInput owners|0 / 0 / 0|same|owner.outcome; one empty-array call per operation|

No measured filter predicate contains a nested full-array scan. Shared capture filtering is reached but its owners array is empty. Entity-signal:1042 does contain filter+includes in restoration placement construction, but is NOT visited by these plain-tree operations; this is not causal attribution for the stall. Native entity inspection/requirement-release filters likewise do not appear in the recorded stacks. Do not treat absence here as universal unreachability.

## Falsifier and limits

The concrete hypothesis tested was repeated full-domain filter invocation, or superlinear predicate visits, during these three small plain-tree operations when membership is observed. All four sizes falsify that hypothesis in this bounded range; doubling N exactly doubles visits and does not increase invocation count. Membership activation adds exactly 2N/4N/2N visits.

The sample's ArrayFilter prominence remains an unresolved observation. This experiment does not identify its JS callsite, reproduce the full-worker history, cover large-size thresholds, count other algorithms/allocations/GC, or establish a 130k cost bound. Constant visit counts do not generally prove constant predicate cost; source inspection of the actually visited predicates provides the narrower support here. No production repair or full-suite readiness is established. Independent review should first check workload/import equivalence and the wrapper/count accounting; any further full-worker discriminator needs a separately bounded instruction, not another 130k run.

## Instrumentation and preserved iterations

Native Array.filter still executes iteration, sparse-hole handling and species creation. Only its predicate is wrapped, preserving thisArg and three arguments. Stack capture occurs once per invocation outside predicate counting; recursion during stack collection is guarded. The prototype is restored in finally. Calibration checks sparse/mutating arrays, thisArg/array identity, species, exact thrown object and restoration. Assertions, fixtures, reads and teardown are outside measurement. No asynchronous work is counted.

The initial PROTOCOL.md and FIRST-acquired-reader.spec.ts intentionally remain unmodified historical evidence: their nominal unobserved arm acquired a reader. Reader acquisition itself activates inventory (entity-membership-view discovery), so both arms had observed-path work. FIRST-acquired-reader-counts.json preserves that first result. The corrected no-reader arm and its raw counts are NO-READER-COMPARISON.spec.ts / COUNTS.json. The final variant adds the original spec's undoable/restoration imports; this adds one empty lifecycle filter per operation but no predicate visits. FINAL-probe.spec.ts and EXACT-IMPORT-COUNTS.json are authoritative for this report. No failures were discarded; all three bounded commands passed nine tests each.

## Replay and evidence

Run from candidate with the pinned Node24.15.0/root installed dependencies, via the recorded runner:

`python3 /private/tmp/st-c19-large-batch-filter-counts/run.py exact-imports-no-output corepack pnpm nx test kernel large-batch-filter-count-probe.spec.ts --skip-nx-cache --maxWorkers=1`

Do not overwrite the frozen run when independently replaying: use a new output directory/run name and copy its TMPDIR/filter-counts.json immediately. No output-helper environment is needed. Exact cwd/argv/environment, first.log and result are in runs/exact-imports-no-output; the earlier two run directories preserve their variants. All nine final tests pass. Runner source checks cover the 3065 baseline paths; it does not automatically include this newly named probe, so the final probe is explicitly copied and hashed in VERIFICATION.json/SNAPSHOT.json. No source/spec types or full suite claimed. The sampled input is preserved as INPUT-large-batch-worker.sample.txt. tests.patch is test-only, for review/replay, not proposed permanent promotion.
