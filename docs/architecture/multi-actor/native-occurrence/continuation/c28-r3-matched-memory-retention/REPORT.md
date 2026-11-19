# Independent matched-memory review and N512 GC diagnostic

Both authorized N512 invocations pass the two unchanged selected case bodies (four case executions; nine other cases filtered per invocation). GC is available in the actual workers, exactly three calls occur only after destruction/drain, heap limits are unchanged and final owned-process censuses are empty. No runtime edits, heap-limit increase, larger run, profile, retry of a test outcome or budget change.

## Independent review of the prior packet

Read the original fixture, instrumentation patch/template, preparation/runner source, raw memory/events/results for all eight invocations, source maps and the one-function index diff. Independently verified:

- Removing marked instrumentation/final drain recovers original source exactly; each per-run test equals that template with only LARGE replaced. Original imports, membership observer, preceding membership case, seed/replacement/undo/redo assertions and60s/120s timeouts remain. Two useful case outcomes are recorded per worker, not a vacuous memory-only test.
- All eight original runs have distinct workers, pass exactly2 cases, have no recorded runtime mismatch/remaining owned process. Recomputed every reported replacement/before-undo/undo/redo/destroy/final-drain heap value from raw rows; zero SUMMARY.json mismatches. PRIOR-REVIEW.json preserves independent checks.
- The arms' complete3,095-entry maps differ only at tree-realization-adapter.ts: baseline108517fe533b6e5f0c4abbbb700ed1d358ac3db170fbac6bf3ed270872018eb6 versus index0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce. Index adds owner/subject maps and arrays containing existing change references, retaining per-call slice identity. The diff supplies no direct count/byte measure of live retained index objects.
- Boundary instrumentation records primitive memory values and does not hold trees/plans/payloads in a log array. It changes scheduling through synchronous I/O and final drain; it is not a timing experiment or true peak measurement.

The prior report's numerical observations are supported. Its common-footprint interpretation is plausible but cannot identify owners of retained memory. In particular after-destroy growth is allocation/GC-position evidence, not a leak proof. “GC position” is an inference from whole-heap decreases and variability, not observed GC events. I found no fixture defect preventing this separately labeled follow-up.

Semantic coverage limit: original membership checks empty count and positive events; restoration checks count/first ID at undo and first ID at redo. It does not assert every row payload or every native certificate. We retain that exact scope rather than silently call it complete semantic equivalence.

## Follow-up protocol and first outcome preservation

PREREGISTRATION.md was saved before launch. Fresh sequential baseline512 then indexed512 workers; same original first-two-case history, same output-only stage markers. After redo assertions:12 microtasks and one setTimeout(0) task boundary, sample without GC. After unchanged tree.destroy and final drain: same task boundary and sample. Then exactly three fixed repetitions of task/microtask drain → actual globalThis.gc() → task/microtask drain → sample. No GC during seed, replacement, prepare, undo, redo or destruction. No adaptive convergence loop.

Use established NODE_OPTIONS=--expose-gc propagation from retention-gc/check-forwarding-retention (not ineffective old poolOptions.forks.execArgv). Every memory marker requires typeof globalThis.gc==='function', otherwise throws; each raw row records gcAvailable, gcCalls and NODE_OPTIONS. GC counts remain0 through post-destroy sample and then1/2/3. Both test-overlay files are byte-identical. No caller-facing runtime/config changes.

Pinned Node24.15.0, corepack pnpm10.17.0, Nx kernel, installed root node_modules; commands/env and before/after source verification preserved under runs. Shared host and other-agent activity uncontrolled. Both use heap_size_limit4,496,293,888 bytes, identical to the prior packet; no heap override.

First launcher failed in sandbox at initial /bin/ps census, before any worker/test/GC started. FIRST-LAUNCH-FAILURE.txt preserves that environment failure. Authorized process-census escalation then launched the unchanged two-run schedule. It is not a failed runtime test or favorable sample retry. Runner uses180s no-progress/360s absolute caps, birth-matched descendant tracking and cancellation across detached groups by verified PID. Neither limit fired. Both final results show remainingOwned:[] and no runtime mismatches; frozen comparator/index inputs also reverified unchanged.

## Results: heapUsed MiB (2^20 bytes)

| Boundary | Baseline PID79258 | Indexed PID79334 |
| --- | ---: | ---: |
| Post-workload drain, tree live | 71.894 | 71.036 |
| Post-destroy/drain, before forced GC | 57.109 | 80.384 |
| GC/drain1 | 39.669 | 39.448 |
| GC/drain2 | 38.614 | 38.635 |
| GC/drain3 | 38.614 | 38.620 |

RETENTION-SUMMARY.json stores unrounded heapUsed, heapTotal, RSS, external, arrayBuffers and GC count; raw memory.jsonl also retains V8 values. These metrics are not added or interchanged. Maximum sampled heapUsed was81.177MiB baseline and80.384MiB indexed, not a peak claim. Both commands exit0 with2pass/9filtered, one actual invocation per arm.

## Interpretation and limits

There is a substantial transient component in both workloads: post-destroy pre-GC heap falls to roughly38.6MiB under the same forced-collection/drain protocol. The indexed arm's larger pre-GC teardown reading does not persist as a comparable post-GC excess. The third sample differs by about0.006MiB, far too little evidence to attribute to the index or rank memory efficiency. The first-to-second collection reduction also demonstrates why a single GC boundary would overstate this measured remainder.

What remains is whole-process reachable/unreclaimed heap under these fixed boundaries: runner/module/framework state, prior membership workload, shared runtime structures and potentially retained test locals. The tree variable remains lexically in scope after destroy; optimizer liveness and collection internals are not controlled. No payload WeakRef/dominator proof, object census, empty-process subtraction or attribution to a specific source owner was performed. Similar remainders support a shared floor in this pair, not identical object graphs or universal release. Three fixed samples do not certify convergence, leak freedom, bounded long-lived retention or production artifact behavior.

No index-specific OOM conclusion follows. N512 cannot qualify130k, extrapolate safe heap size or explain the previously different watchdog/OOM campaigns. No additional run/profile authorized or performed. Source/spec type gates for this diagnostic overlay were not run; both actual Vitest executions and inverse-source verification are recorded. The separate metadata successor review remains independent.
