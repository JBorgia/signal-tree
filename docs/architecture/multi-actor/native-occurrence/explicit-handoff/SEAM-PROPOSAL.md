# Explicit private write continuation

Predecessor: /private/tmp/st-native-invocation-successor/candidate, source manifest 5d2a2893bde2e196f79c69985a425bb30974e5028ac9b2ad833db9d1a9c83272. All 2924 files verified before copying. Candidate: ./candidate. Main scope fixture copied unchanged from root reentry-review. Original source and failure archives remain intact.

The root reentry-review/RESULT.md establishes internal certificate misassignment before claim, not an outgoing endpoint leak. The getter executes in the projection observer-before-read. Moving an ambient claim to updateOne cannot close that interval.

Reviewed bounded mechanism (user-relayed independent source review; no execution acceptance):
- applyEffect resolves its existing target and dispatches a private selected-write port. Public replaceLocation, Location, SDK and framework interfaces remain unchanged.
- Existing writable binding gets a separate private selected replacement continuation. Portable/native projections share their original replacement core: before-read -> write -> after-read -> intrinsic observer. The selected endpoint is an explicit argument held by that particular invocation, never active write context.
- interceptLocationWrites wraps both public and selected replacements with its same interceptor. Only the latter's proceed closure captures the endpoint. Operation payload exposed to interceptor remains intent/value. Coalesce stores that exact proceed, retaining existing scheduling/deduplication. Nested public writes cannot obtain the outer selection. No direct writeField/store bypass.
- Private projection writer signature carries optional selection to writeField; shared private updateOne/replaceOne implementation accepts it. Public methods call those implementations without selection. Kernel-native projection bridge owns the private forwarding; framework adapters require no new API.
- Row absence follows existing row replacement semantics via a private row continuation bound on its existing entity publication binding. It shares the callable row core; no changed planner.
- Source/lifetime identity and final own-presence/value validation remain. Identity is checked at private entry and after user callbacks/value equality before installation. Exceptions do not make the payload ambient. Prepared restoredFields is the existing terminal handoff; no new certificate authority or persistent selection index.

Exact source map: tree-realization-adapter.ts applyEffect:1780–1850; location-runtime.ts writable binding:49, interceptLocationWrites:121, createWritableProjection:148; native-location-realization.ts:162; entity-signal.ts row core:3061, bindLocation:3088, writeField:3111, updateOne:3707, replaceOne:3783, selectedInverseField:2037. Batching createProjection forwards the private writer unchanged; its writePort stores proceed (batching.ts:193–255).

Preserve unchanged original25 plus main scope3. Add registered-location-interceptor reentry and coalesce controls before runtime. Keep the legacy ambient-helper unit test unchanged as a historical helper control; production callers must cease using the ambient helper. Removing that unreferenced historical helper and migrating its test is a later explicit cleanup, not evidence for the replacement mechanism. No structural changes.

First gate: original native handoff4 + unchanged main scope3 + new continuation controls. Freeze a covered recurrence, preserving first failure; do not disguise an unimplemented transport route as model equivalence. Then original25 and source/spec types. Independent source review is not execution acceptance.
