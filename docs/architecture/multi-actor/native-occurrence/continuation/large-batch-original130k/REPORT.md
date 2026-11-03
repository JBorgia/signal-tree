# Exact C19 isolated original130k stage trace

**The single fresh-worker execution passed; no stage failed or exceeded the watchdog.** All15 ordered markers are present through drain:after. This does not reproduce or resolve the earlier full-kernel stall, and supplies no basis for a runtime repair or timing/performance ranking. No second130k execution was performed.

## Exact scope

Own new copy of exact C19 SNAPSHOT-C19.json, SHA256 b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576. All3065 input paths verified during copy. Added only large-batch-original130k-stage.spec.ts. Original entity-large-batches.spec.ts and all runtime/config files remain unchanged. Prior bounded-history packet remains frozen.

The new spec retains the original first case's imports (signalTree, entityMap, undoable, membership reader, restoration), Row shape, inline rows generator,130000 size, plain tree, reader acquisition, subscription and event increment. It executes exactly initial setAll(rows(LARGE)), disjoint replacement setAll(rows(LARGE,LARGE)), empty setAll, then the original count()==0 and events>0 assertions, followed by original finally stop/destroy. No intermediate tree reads, filter wrappers, instrumentation of predicates, new enhancer, forced GC or other original tests. The original60000ms Vitest timeout remains, and is not relied on to preempt synchronous work.

The only lifecycle extension is an awaited12-Promise.resolve microtask drain after successful original try/finally completion. The callback is async solely for this drain. Append-only boundary markers surround each operation, final assertion block, stop, destroy and drain; test-start precedes construction. Each marker records PID, execArgv, Date.now and coarse process.memoryUsage. Initial/replacement markers include evaluation of their original inline rows(...) arguments; they do not isolate fixture allocation from setAll. Markers do not inspect tree state. Boundary observation/write overhead prevents treating this as an uninstrumented benchmark.

## Observed gate outcome

Worker PID58691, one named test passed. Sequence verified programmatically:

1. test-start
2. setAll-initial before/after
3. setAll-replace before/after
4. setAll-clear before/after
5. finalassert before/after
6. stop before/after
7. destroy before/after
8. drain before/after

Both original assertions executed and passed; this is not a reporter-only start or a zero-test success. Final count is asserted zero and membership events positive; no stronger event-count result is invented. All memory/phase records are in STAGES.json and the original runs/single-original130k/phases.jsonl. Raw timestamps are watchdog/phase evidence only; no timing comparison or CPU advantage is claimed.

The final post-drain boundary records heapUsed1794980976 bytes and RSS1113964544 bytes. These are coarse process observations without forced GC, reachability analysis or allocation attribution—not evidence of a leak, retained tree state, or the cause of the full-run stall. They are not comparable peak-memory measurements. A12-continuation drain is not proof of all queues being exhausted.

## Parent watchdog

run.py launches the Nx command as a new session/process group, records and checks child PID==owned PGID, and watches append-only markers independently of the test event loop. Startup ceiling180s begins at subprocess spawn. After observing test-start, the parent computes a90s deadline from that marker's timestamp (poll interval0.1s); source hash checks are outside these ceilings. On timeout it would preserve the last complete stage and send SIGTERM only to the owned group, then wait a bounded10s for exit; it contains no SIGKILL/global kill or automatic retry. An incomplete marker line is ignored, preserving the last complete one.

Neither ceiling fired. Process exit0, ownedGroupStillPresent=false after exit, sourceUnchanged=true. PROCESS.json records runner/child/group identity; RESULT.json records the final stage and outcome. No WATCHDOG.json exists because no timeout occurred. The SIGTERM timeout branch was not exercised by this successful run; its implementation is preserved for inspection, not claimed as newly tested behavior.

## Replay identity and artifacts

The one executed command was:

`python3 /private/tmp/st-c19-original130k-stage-trace/run.py`

Underlying command from candidate:

`corepack pnpm nx test kernel large-batch-original130k-stage.spec.ts --skip-nx-cache --maxWorkers=1`

COMMAND.json records exact cwd/environment, pinned Node24.15.0/root installed dependencies and watchdog ceilings. first.log contains the full unedited Nx/Vitest result, including startup warnings. SOURCE-BEFORE.json equals the C19 manifest plus only the new spec; after-check confirms unchanged. SNAPSHOT.json, tests.patch, PROBE.spec.ts, run.py and VERIFICATION.json freeze source and replay provenance. The runner uses an exclusive fixed output directory to prevent overwriting/replaying this packet accidentally. No source/spec-type/full-suite claim.

## Decision limit

There is no failed phase to select for a source/profile repair from this run. Initial population, replacement, clear, assertions and cleanup all completed in this fresh context. The prior full-run stalled case/sample remain valid preserved evidence of a different observed execution; this isolated pass does not retroactively turn that incomplete gate into a pass. Full-suite/process-history/resource interaction remains unadjudicated, not proven causal. Stop after the authorized single large execution; no further profiling, repetition or runtime changes performed.
