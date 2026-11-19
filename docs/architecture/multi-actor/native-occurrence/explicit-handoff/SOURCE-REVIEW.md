Recommend an **explicit, call-local payload through the private kernel write pipeline**, rather than another ambient claim scope. Keep the existing setter behavior and interceptors; only change how the selected endpoint reaches that invocation.

The frozen candidate’s six changed files match its manifest. Its failed state remains intact. Faraday’s interrupted service is not acceptance.

The concrete failure is earlier than `onUpdate`:

`applyEffect → target.set → projection observer “before” read → getter → nested updateOne`

The nested call can claim the ambient endpoint before the intended write reaches `updateOne`. Both portable and native projection implementations perform this pre-write read.

| Exact seam in frozen candidate | Recommended responsibility |
|---|---|
| [tree-realization-adapter.ts:1795](/private/tmp/st-native-invocation-successor/candidate/packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts:1795), `applyEffect`’s `invoke` | Resolve and validate source/lifetime/field, then explicitly dispatch the selected endpoint to a private write port. Keep ordinary `system`/`realized` metadata, but remove endpoint authority from `WriteMetadata`. |
| [location-runtime.ts:47](/private/tmp/st-native-invocation-successor/candidate/packages/kernel/src/lib/internals/location-runtime.ts:47), writable binding and interceptor chain | Carry the payload in the **particular invocation’s continuation**. Public writes start without it; nested writes cannot discover it. Preserve registered interception rather than calling the raw writer directly. |
| [location-runtime.ts:149](/private/tmp/st-native-invocation-successor/candidate/packages/kernel/src/lib/internals/location-runtime.ts:149) and [native-location-realization.ts:163](/private/tmp/st-native-invocation-successor/candidate/packages/kernel/src/lib/internals/native-location-realization.ts:163), projection replacement | Preserve before-read → write → after-read → intrinsic-observer ordering. Forward the payload explicitly only to the intended kernel writer. |
| [entity-signal.ts:3109](/private/tmp/st-native-invocation-successor/candidate/packages/kernel/src/lib/entity-signal.ts:3109), `writeField`; row callable around line 3062 | Forward into shared private update/replacement implementations. Public `updateOne`/`replaceOne` invoke those same implementations without endpoint authority. Provide a corresponding private row-replacement entry for certified absence. |

A private registry keyed by the existing location/row identity can expose these kernel-only entries without changing framework carriers. The exact implementation should reuse the current mutation bodies, not duplicate a rollback-specific mutation engine.

Concrete compatibility pitfalls:

- **Do not bypass interception.** `interceptLocationWrites` wraps binding replacements and synchronizes native `.set`; batching uses that continuation. A direct call to `writeField`, `commitExistingSubjectValue`, or the physical store would skip part of the existing contract.
- **Do not accidentally publish the payload.** `replaceLocation` is already exported through `kernel/adapter`. Avoid adding an endpoint-bearing public overload, framework setter argument, or `ObservationAdapter` capability. Public setter wrappers should not forward arbitrary extra arguments into the private lane.
- **Preserve absence versus present `undefined`.** `applyEffect` currently uses whole-row replacement to remove a field. Routing every inverse through `updateOne` would merge and retain the key.
- **Keep lifetime and transformed-value validation.** Getter/interceptor/equality reentry can replace the entity lifetime or transform the proposed value. Explicit transport prevents borrowing; it does not replace `selectedInverseField` validation or installation-time checks. Address the retained subject, not a newly occupied key.
- **Account for deferred continuations.** Batching’s `coalesce` stores `proceed`. Decide and test the existing rollback/coalescing interaction explicitly: neither silently dropping the payload nor retaining reusable authority after the inverse invocation is acceptable. This interaction is not established by the supplied failure.
- **Keep unsupported paths bounded.** The candidate accepts only one-segment selected fields. Its synthetic nested-field replacement closures lack equivalent binding metadata; do not silently generalize their authority.

The cheapest acceptance falsifier is the preserved getter-reentry fixture, unchanged: nested evidence must differ from the baseline, while the intended inverse restores the correct endpoint. Retain the passing lifetime-replacement, equality-reentry, interceptor-reentry, throw-cleanup, absence/undefined and pair-composition controls. Add one registered location-interceptor reentry control and one coalescing control for the explicit continuation.

This is a source-based recommendation. I inspected the preserved failing logs and verified source identity; I did not rerun tests or modify runtime files.

---

Identity appendix added when preserving the verbatim review above:

- Frozen candidate: `/private/tmp/st-native-invocation-successor/candidate`
- Root HEAD: `628d302dadb082a48c58528651c9088234d0a777`
- Source manifest SHA-256: `5d2a2893bde2e196f79c69985a425bb30974e5028ac9b2ad833db9d1a9c83272`
- Runtime patch SHA-256: `23f988db710add731c60ca7cb42e16cea62ad01449a71a1d11708c888702e4cf`
- [Full per-file and reentry-evidence identities](IDENTITIES.json). All six changed candidate files were reverified against the frozen manifest when saving this record. No runtime edits or tests were performed.
