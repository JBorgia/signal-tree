# C19 cleanup/drain and exact-sequence discriminator

Bounded negative finding, ready for independent review. **No nonlinear Array.filter phase found through N128.** Stop, destroy and the 12-continuation microtask drain each make zero filter calls/visits in every case. Removing intermediate count()/ids() reads changes neither operation callsites nor stage counts. This does not resolve the original 130k stall.

## Workload and results

Exact C19 runtime, original imports (including undoable/restoration), plain tree, initial setAll(rows(N)), disjoint replacement setAll(rows(N,N)), empty setAll. Sizes16/32/64/128; membership reader plus subscription versus no reader acquisition. Distinct variants with intermediate reads and with **no reads/assertions between operations**. Final count/IDs assertions follow the third setAll. No yield between the operations or before stop/destroy. Then twelve awaited Promise.resolve continuations, not a timer/GC drain.

| Phase | No reader predicate visits | Membership observed predicate visits |
|---|---|---|
|initial setAll|4N|6N|
|disjoint replacement|8N|12N|
|empty setAll|3N|5N|
|stop|0|0|
|destroy|0|0|
|12-step microtask drain|0|0|

Operation invocation counts are6/7/6 versus10/11/10 respectively, constant across sizes. Each subscribed operation emits one event, total3; unsubscribed total0. All16 workload records have actual final count0/IDs[], no cleanup/drain event, and instrumented/uninstrumented behavior parity. The18 final tests pass (16 workloads + synchronous and asynchronous instrumentation calibration).

The two workload variants have exactly equal stage records, including stacks/counts/events, at each N/observer pairing. Raw COUNTS.json retains both variants and both plain/counted boundary records; it is not a summary substituted for raw evidence.

## Attribution

All reached operation filter bodies match the prior frozen probe: entity-signal.ts337–338 surviving-order Set.has, entity-mutation-frame.ts226 defined-ID filtering, prepared-placement-visibility.ts21 present-entry filtering, entity-signal.ts1692 tombstone-kind filtering, membership-inventory.ts183–184 surviving-order Set.has, lifecycle.ts154 empty owner filtering. Full callsite stacks are preserved. No new cleanup/drain filter site was reached, so there is no nonlinear source body to attribute.

Cleanup source is consistent with zero filter calls: entity-membership-view.ts306–312 subscriber stop deletes from a Set; its tree cleanup at213–222 marks closed, clears queue/listeners, loops collection stops/closes and clears the collection Map. Entity-membership-inventory.ts127–143 stop deletes a listener; close clears listeners/changes/depth and replaces its read function. These observations do not prove all teardown work is constant or all retained state reclaimed.

## Behavioral and instrumentation controls

Final count zero, empty IDs and positive observed events are mandatory. No event occurs during stop, destroy or the finite drain. After draining, retained reader snapshot and subscribe refuse with STUDIO_TREE_DESTROYED; reacquiring a reader on the destroyed tree also refuses. This checks observable closure, not heap reclamation. Stop effectiveness is not separately challenged by a new mutation because that would change the requested sequence.

Every workload first executes uninstrumented, then instrumented; states/events/cleanup outcomes are compared. The native filter still handles iteration, holes and species; predicate thisArg and arguments are preserved. The synchronous wrapper is restored in finally. The asynchronous wrapper spans the awaited drain and restores in finally as well. Calibration proves a promise-continuation filter is counted (one call/two visits) and a thrown async predicate preserves exact error identity and restores the native function. No runtime algorithms are replaced. The drain window would include unrelated asynchronous filter work if present; no filter at any site was recorded in it.

Boundary records capture stage, PID, execArgv and process.memoryUsage before/after each operation and cleanup/drain stage, outside counting. All final workload boundaries report PID46835. These are process-boundary observations, not transient peaks, leak evidence or an explanation for the large worker sample. Instrumentation and preceding cases affect heap history. No performance conclusion is drawn.

## Evidence and limits

Own scratch only. Previous frozen probe remains byte-identical. BASE-MANIFEST.json is that packet's a13a5e9a2fbbbf89dd0679f712c95c3054f95acd90305170c8e3abcf66eba025 manifest (3066 paths), containing unchanged C19 b8eace runtime and the prior test. All paths reverified in predecessor and successor. SNAPSHOT.json adds only large-batch-cleanup-count-probe.spec.ts; VERIFICATION.json gives hashes. tests.patch is replay-only test instrumentation, not proposed production promotion.

Final command (pinned Node24.15.0/root installed deps; exact environment in COMMAND.json):

`python3 /private/tmp/st-c19-large-batch-cleanup-counts/run.py exact-sequence-no-output corepack pnpm nx test kernel large-batch-cleanup-count-probe.spec.ts --skip-nx-cache --maxWorkers=1`

Final raw log/counts/source identity/result: runs/exact-sequence-no-output. First9-test run and subsequent10-test async-calibration run are preserved separately, with FIRST-probe.spec.ts and CALIBRATED-intermediate-reads.spec.ts. No failure was overwritten. Final probe includes both variants and18 tests. Runner now hashes the new probe and archives its count output. Replay in new scratch/run paths, not over frozen evidence.

Twelve microtask continuations do not establish arbitrary queue exhaustion; timers, forced GC and large-size thresholds are untested. No130k rerun, sizes above128, full-suite replay, source/spec-type claim, runtime change or budget change. No whole-algorithm linearity claim. The exact-sequence hypothesis and the small-workload filter-in-cleanup hypothesis receive negative evidence; full-run qualification remains blocked on the unexplained stall. Further history/size/profile experiments were not performed.
