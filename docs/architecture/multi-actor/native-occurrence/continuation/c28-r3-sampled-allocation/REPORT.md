# Sampled-allocation preflight: stopped before workload

The reviewed PLAN cannot be executed literally through pinned Node24.15.0 Inspector. No workload, sampling session, callback-synchrony probe, profile or source overlay ran. Neither frozen arm was modified. This is a protocol/plan incompatibility, not a runtime test failure.

## Exact pinned-source evidence

Downloaded upstream Node tag v24.15.0 sources (not V8 main):

- `https://raw.githubusercontent.com/nodejs/node/v24.15.0/deps/v8/include/js_protocol.pdl`, preserved pinned-js_protocol.pdl:792–812: HeapProfiler.startSampling supports samplingInterval and both includeObjectsCollectedByMajorGC/includeObjectsCollectedByMinorGC booleans. It exposes no stackDepth option.
- `https://raw.githubusercontent.com/nodejs/node/v24.15.0/deps/v8/src/inspector/v8-heap-profiler-agent-impl.cc`, preserved pinned-v8-heap-profiler-agent-impl.cc:550–577: forwards both requested collected-object flags, always adds kSamplingForceGC, and calls StartSamplingHeapProfiler with hardcoded stack depth128. Sending stackDepth64 would not establish that it took effect.
- Same agent:610–627: stopSampling calls getSamplingProfile, which calls GetAllocationProfile before stopping the sampler.
- `https://raw.githubusercontent.com/nodejs/node/v24.15.0/deps/v8/src/profiler/sampling-heap-profiler.cc`, preserved pinned-sampling-heap-profiler.cc:284–287: GetAllocationProfile invokes CollectAllGarbage when kSamplingForceGC is set.

Thus profile collection necessarily requests GC through this Inspector implementation, while the sampler is still active. No protocol flag disables that behavior. This conflicts with the PLAN's no-forced-GC restriction and means collection-time work may appear in the returned allocation profile. It also changes the heap state seen by subsequent undo/redo windows. Both collected-object flags are supported, so live-only sampling is not the obstacle.

Actual executable `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node` reports Node24.15.0, V8 13.6.233.17-node.48 (VERSIONS.json). Tagged upstream implementation is source evidence; not a locally rebuilt binary attestation. No unsupported stackDepth parameter was sent or silently accepted. No callback synchrony claim: that preflight remains not run because stopSampling would itself trigger the disallowed behavior.

## Bounded disposition

Stop before either N2048 worker. No new native allocation claim: the previous exact fixture graph reached no native factory; this preflight does not change that evidence.

A viable amendment is to explicitly accept pinned depth128 and Inspector-imposed GC at each stop, retain32768 and both collected-object flags, and label profiles as including collection overhead plus altered later-stage heap state. Only after that amendment should a disposable sync-callback preflight run, followed by the authorized two-worker pair if it passes. No custom native addon, alternate profiler, forced-GC workaround, heap-limit change, or runtime edit is proposed here.

All prior cardinality/retention evidence remains preserved. Raw sampling profiles do not exist; don't treat this packet as completed allocation attribution or forward a successful-profile interpretation request.

## Commands and first outcomes

1. Local include glob for protocol files found none (zsh no matches); not a workload failure.
2. Sandbox curl of the exact protocol URL failed DNS (curl6); saved FIRST-ENVIRONMENT-FAILURES.txt. Read-only escalated curl for the same URL succeeded. Matching agent/profiler source fetches also succeeded with read-only network approval.
3. Pinned `node -p 'JSON.stringify(process.versions)'` exit0.
4. Source searches for `command startSampling`, agent startSampling/stopSampling, and kSamplingForceGC established the incompatibility above. No experiment retry, workload or timing measurement.
