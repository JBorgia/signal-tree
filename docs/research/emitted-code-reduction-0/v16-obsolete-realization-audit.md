# Bounded obsolete realization audit

**No whole transaction/reversal engine was proved obsolete. There are specific unused payloads and unreachable/redundant checks worth removing; larger fallback deletions remain blocked by live callers and contracts.** This audit supplies no bundle-size or performance claim and does not propose budget increases or architecture changes.

Source: `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`, HEAD `4b37f3fca9194cadb393d108ad6194e4418a12bc`, plus the uncommitted reviewed point-owner lookup. Existing dirty items were preserved: the realization adapter, `docs/research/point-owner-cost-0/`, and two point-owner specs. No validator micro-optimization is assumed. Read-only source/history/test inspection; no tests, builds or benchmarks executed. Locations below are relative to this checkout.

## Specific deletion candidates supported by source

### 1. Unused effect payloads in four heterogeneous plan queues

`packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts:950–980`, pushes at 1025, 1042, 1112, 1152; consumers at 1173–1235.

`plannedRestores`, `plannedFreshAdds`, `plannedRekeys`, and `plannedRemoves` store `{ effect, plan }`. Every subsequent consumer destructures only `plan`. These arrays are local and never returned or passed to another function; the returned closures consume them only for commit/publication. The original effect is already used during planning, before each push.

**Candidate:** delete the four stored `effect` members and their type declarations. Optionally store plans directly and remove the wrapper objects, preserving the four queues and their exact iteration order. This is a concrete unused-data deletion, not removal of structural planning. Blame traces the payloads to `e978e3c866`, `b4a69acd7d`, and `b47598a1c3`; the `12a04f57` split into install/invalidate/publish did not introduce a reader.

**Do not extend this to merging queues:** installation is remove → fresh add → restore → rekey, while publication is remove → restore → fresh add → rekey. Restore ordering also uses live anchors. Changing either ordering is beyond this deletion.

**Validation needed when implemented:** focused adapter cases “realizes remove-restore-rekey-scalar as one coherent prepared topology turn,” fresh add plus later scalar, fresh add followed by rekey, and stale heterogeneous refusal; `heterogeneous-atomicity.spec.ts`. Tests inspected, not run. No counterexample to deleting only the unused member was found.

### 2. Unreachable repeated missing-runtime check

Same file: 938–949 and the `for (const effect of framedScalarEffects)` loop at approximately 1055.

Before the loop, nonempty `framedScalarEffects` with absent `scalarFrameRuntime` or frame returns undefined. `resolvedScalarFrameRuntime` is an immutable alias of that runtime. Reaching any loop iteration therefore implies it is present; the inner `if (!resolvedScalarFrameRuntime) { discard(); return undefined; }` cannot run.

**Candidate:** delete only that inner guard (and simplify the alias if desired). Preserve the earlier gate and the per-effect unresolved-slot check: an existing runtime can still fail to resolve a particular owner. The runtime gate was adjusted in `dd63ddf101`; this is local control-flow redundancy, not evidence that unavailable-runtime fallback generally disappeared. Staging-failure and unknown-position tests in the adapter spec are appropriate falsifiers.

### 3. Small obsolete statements/predicate arm

- `planScalarFrame`, lines 1288–1290: `void tree`, `void descriptors`, `void structuralOwnerPaths` are leftover no-op reads. All three arguments are actually used by its commit/publication closure. Delete the statements, **not the parameters**. Blame: `45ad9d73b9`.
- `isRealizationAttachmentHost`, lines 319–323: `isTraversableNode(node) || typeof node === 'function'` has an unreachable successful second arm. `node-shape.ts` already accepts all non-null functions. Delete the second arm; keep the helper/type predicate if useful. Blame: `1eb5f04ae3`.

These are source cleanups, not a substantiated route to satisfying a bundle budget; a build may already erase or simplify them.

## Larger candidate requiring evidence before deletion

### Stored rekey descriptors, not rekey realization

`rememberTreeRealizationDescriptor` records every structural effect through `toStructuralEffectKey`, including `rekey:*` entries (lines 349–354, 2835–2844). The structural payload consumer `getStructuralAddEffect` (2510–2545) looks up only remove/add keys and the add/remove-by-subject map. No production realization lookup of a rekey-keyed payload was found in the inspected repository references.

**Candidate to investigate:** stop recording rekey entries in `structuralEffects`, then remove the corresponding key-encoding branch if no other caller needs it. This would leave rekey operations, prepared rekeys, journal effects and subject descriptors intact.

**Not yet approved as deletion:** `transactions.ts:1586–1596` reads the map's size when deciding whether a descriptor can be discarded; `forgetSubjectsInTreeRealizationDescriptors` also traverses its keys. Thus “payload never read for reversal” does not establish observational deadness. Removing entries can change descriptor lifetime, especially across pending claims, open capture, ordinary rekeys and history retention. `descriptor-retention.spec.ts` explicitly observes descriptor-map sizes. Check rekey-only then settle/release/recapture, another open pending transaction, and restoration undo/redo across rekey before accepting. Diagnostic reachability is being audited separately by the owner; this review does not assume it away.

## Paths that are still reachable; do not delete on this evidence

### General realization adapter and its commit wrappers

Production construction/reuse: `transactions.ts:1437–1454`; `restoration.ts:2675–2687`. Transaction application at 2719–2736 selects point preparation **only for mixed scalar/entity normalized effects**. Pure scalar/entity effects go directly to the adapter; mixed preparation returning undefined also falls back (membership-bearing fallback goes to the declarative target). Restoration at 3256–3314 validates and applies through the adapter when `usesDeclarativeTarget` is false.

Consequently `createTreeRealizationAdapter.applyAtomically`, `planScalarFrame`, `planHeterogeneousFrame.commit`, and `applyEffect` are not dead. Point preparation uses the heterogeneous plan's split methods, while the adapter still calls its aggregate `commit`. Deleting that wrapper strands a live caller. `12a04f57` added the split route alongside the existing one; it did not migrate every caller.

### Per-effect fallback, scalar extraction, and hidden membership handling

Adapter lines 534–588 deliberately extract slot scalars when a full mixed frame cannot be planned, install members, then apply remaining effects. The concrete historical failure was a collection under a member being re-added: writing a scalar through the authored leaf path re-added a member that the reversal intended to hide. `1dbc5e7e` records and fixes this; `enhancers/restoration/jump-undo-equivalence.spec.ts` carries the jump-versus-chain cases and generated histories.

Point lookup additionally falls back on hidden/non-enumerable paths. `rollbackPendingTarget` uses `collectionBindingAt` for retained collections that a visible-tree walk cannot find. Its contract prevents a rejected row value reappearing on later re-add. `designated-collection-omission.spec.ts` and the point-owner review specs cover relevant boundaries. A fast-path success on ordinary visible rows is not a deletion witness for these paths.

Historical control: `c9157148` really did remove the single-member `applyEffect` arm and `realizePlainBranchMember`, after proving membership effects were intercepted before that call. Those deletions are already in this checkout; they are not available savings to count again. The same proof does **not** apply to value-effect fallback.

### Declarative transitions and structural plans

`rollbackPendingTarget` remains selected for order deltas/key handoffs/anchor constraints and mixed membership fallback. Restoration additionally selects declarative targets for multi-application jumps. `requiresDeclarativeStructuralTarget` explicitly returns false for simpler cases; it is a router, not proof that every structural operation has migrated. Its singleton-anchor check, per-turn additions and order handling remain deliberate.

`19a5bd03` repairs restore placement and fields; `1dbc5e7e`, `fc695494`, and `5fcac0dd` explain multi-turn order/omission constraints. The adapter tests at 1435–2939 include occupied destinations, prepared vacancy, competing restores, fresh subject identity and restore/rekey combinations. Do not delete physical restore/rekey hooks or fresh-vs-retained distinction just because declarative installation exists.

### Optional prepareCommit fallback and native/neutral scalar runtimes

Both current built-in scalar-frame implementations provide `prepareCommit`, so the fallback to `frame.commit({advanceRevision:false,publish:false})` in `transactions.ts:2501–2503` is not exercised by those two implementations. But `ScalarSlotMutationFrame` in `tree-scalar-slot-port.ts:28` declares it optional, and point preparation explicitly returns undefined when absent. Narrowing that contract is not a dead-code deletion. It needs a separate inventory of injected/internal runtimes and relevant fixture contracts; do not silently replace optional support with an assertion.

The native and neutral scalar-frame classes have very similar commit/prepare forwarding methods. Both are instantiated: `signal-tree.ts` defaults to the neutral runtime; `adapter.ts:98` selects the native one. This is duplicated implementation, not unused code. Sharing those methods would be a refactor and is not proposed by this audit. Likewise `commit` itself has live scalar and heterogeneous fallback callers.

### Descriptor/string fallback and reconstruction helpers

`deriveCollectionPathLegacy`/`deriveFieldPathFromRowLegacy` are explicitly called when no canonical collection path is registered. Both production descriptor producers pass a registry, but that does not guarantee every owner is a registered collection (ordinary scalar owners are not). Adapter tests also construct synthetic descriptors without a registry. Existing field resolution can use inline coordinates, per-subject descriptors, or the owner's descriptor; `resolveSubjectFieldPath` is therefore not interchangeable with `deriveFieldSegmentsFromEffect`, which lacks descriptor fallback.

`getStructuralAddEffect` still falls back from inline structural context to descriptor payloads. `rememberTreeRealizationDescriptor` is called by transaction capture and retained restoration history. Deleting the whole descriptor machinery would require proving every admitted effect carries sufficient inline state, including synthetic/internal callers and history retention. That proof was not established here. Address-repair and adapter reconstruction tests are counterweights to treating the word “legacy” as a deletion license.

## Disposition

The defensible immediate candidates are the unused plan payloads and narrow redundant checks/no-op statements above. Rekey descriptor storage is a specific follow-up candidate with a known retention dependency. The substantial fallback planners remain live. No full-path deletion, numerical saving, or release/budget conclusion is supported by this read-only audit.
