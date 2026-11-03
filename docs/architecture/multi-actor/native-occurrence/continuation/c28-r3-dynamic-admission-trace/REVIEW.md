# Dynamic ordinary scalar admission: bounded causal trace

The missing producer is now localized: transaction scalar terminal preparation is attached by an initial leaf traversal, while native scalar selection is tree-registry-wide. Newly materialized ordinary scalar sources receive native publication and ownership/slot registration but never receive that terminal preparer. Their next changed transactional write reaches selection with no prepared terminal record, triggering the existing admission guard. This is production registration, not a stale test spy.

No runtime implementation. Proposed shared repair below requires architecture review. No entity-cost/ABA investigation in this packet.

## Frozen evidence

Exact R3 base manifest `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`; all3095 baseline paths verified unchanged before and after. Own candidate adds only2 test files. Final manifest `25f95d6463d7a4ecd671a53b883f60f6560cd9ded965642b6aa0e839f98ff8fb`; tests.patch `60ac4ed6449833872a299ef250dc3e5bad8d0bed442194a53551fc5714eeb4cb`. SNAPSHOT.json records run identities. No original repro/test/runtime/config changes.

1. runs/unchanged-and-minimal-first: unchanged whole-value-new-keys selected three original failures plus minimal public static/dynamic pair.4fail1pass23filtered; exit1/sourceUnchanged. All3 original errors preserved. Minimal static succeeds; dynamic fails the same native admission exception. REPRO.json and first.log preserve stacks.
2. runs/observation-first:3 diagnostic failures before the write because the new observer fixture imported getTreeScalarSlotRuntime from the wrong module. Original fixture preserved as OBSERVATION-FIRST-IMPORT-ERROR.spec.ts. This is a harness failure, not runtime evidence.
3. runs/observation-import-corrected: only import corrected to existing tree-scalar-slot-port.3 observational cases pass their characterization assertions; exit0/sourceUnchanged. They intentionally record the2 dynamic errors, not passing public correctness. OBSERVATIONS.jsonl stores copied facts. No observer changes classification or supplies admission; typed rest wrappers return original results and restore spies in finally.

Commands use own pinned Node24.15.0/pnpm10.17.0 Nx kernel, maxWorkers1, own caches/tmp, external180s group cap; no timeout. Exact args recorded per COMMAND.json. Minimal/original run explicitly filters only named3+2 cases; no broad suite. Diagnostic requires ST_DYNAMIC_ADMISSION_OUTPUT=/private/tmp/st-c28-r3-dynamic-admission-trace/OBSERVATIONS.jsonl. No source/spec-types claim for the new trace fixtures.

## Last intact facts and first missing attachment

| At native selector entry | Initially seeded rows.b.n | Later whole-created rows.b.n | Reentrantly created rows.b.n surviving outer failure |
| --- | --- | --- | --- |
| Intrinsic source and publication preparer | present | present | present |
| Owned position, registry, resolved scalar slot | present | present | present |
| Transaction ID / changed replace / values |1 / true /2->3 |1 / true /2->3 |1 / true /2->3 |
| prepareTerminalMutations registered for exact leaf | yes | no | no |
| Source prepareTerminal getter | function | absent | absent |
| Mutation preparedTerminal | present,4 writes | absent | absent |
| scalarAdmission effect + operationEffect | both set effects, rows.b.n,2->3, matching position | neither | neither |
| Outcome | write and rollback succeed to2 | throws before value installation, remains2 | same throw, remains2 |

Thus an operation record is not being lost between producer and selection on these dynamic attempts: **the producer was never attached/called**. The last intact prepared input is the ordinary changed mutation, source/slot identity and proposed endpoint. There is no detached terminal operation/effect pair to bind. In the static control the exact producer returns both cumulative bucket effect and per-operation effect before native selection. The trace records them before selection binds their field endpoints.

The uninstrumented minimal fixture uses only public tree construction, whole member installation, transact, held row write, inspection and rollback; it has no source spies or injected ports. Public runtime behavior is reproduced independently of the diagnostic observers. Static/dynamic tests share the same2->3 write and rollback oracle. The reentrant observational route creates its member inside a getter while an unrelated outer construction throws; the member retains valid source/slot identity but lacks the same hook. Original reentrant test separately preserves exact held handles/slot counts and fails at its later transaction write.

## Exact source chain

- signal-tree.ts:213 finalizeLeafSignal assigns address/registry/owned metadata and calls wrapOwnedWritableSignal for both initial and prepared ordinary leaves. Allocation cancellation owns its returned release; isActive gates provisional resources.
- tree-scalar-leaf-runtime.ts:210–228 creates a detached leaf/source and attaches it to the real slot/publication runtime through ConstructionAllocation. This successfully registers the dynamic slot. It does not attach transaction terminal preparation.
- intrinsic-mutation.ts:237 registerIntrinsicMutationSource installs native publication. prepareTerminalMutations:282 is a separate single-owner hook.
- transactions.ts:4188 calls interceptLeafSignals once. Its options.terminalRecord at4231–4320 is the sole production scalarAdmission producer found. It preserves writer guards, constructs the combined bucket effect and OperationRecord, returns detached writes/adds and scalarAdmission.
- intercept-leaf-signals.ts:observeLocation installs that terminal callback via prepareTerminalMutations; its visitTree processes then-existing leaves. No dynamic-source enrollment exists there.
- owned-mutation.ts:226 wrapOwnedWritableSignal is already shared by dynamic and static leaves, but attaches only post-install intrinsic observation. That existing dynamic observation cannot retroactively provide pre-install scalarAdmission.
- location-runtime.ts:489 calls mutationSource.prepareTerminal before preparePublication. Dynamic prepareTerminal is absent, so preparedTerminal stays undefined. tree-scalar-slot-runtime.ts:337 calls this preparation before values are installed.
- transactions.ts:2873 registry-wide selection accepts the owned changed slot;2890–2891 requires the detached admission and throws. This guard is functioning as written; bypassing it would lose endpoint/effect binding.

The earlier R2/R3 matched differential already established inheritance. This trace localizes the common mismatch; it does not date the original introducing change.

## One proposed shared lifecycle repair — not implemented

Move the **existing** scalar terminal responsibility producer from traversal-only attachment to the common owned ordinary-leaf lifecycle, using the existing tree-local MutationCaptureRuntime as the provider. No late notification reconstruction, consumer fallback, fabricated admission, member-name special case or source selection relaxation.

Minimal intended seams:

1. mutation-capture-runtime.ts: add a private optional scalar-responsibility preparation provider with the existing terminal producer's metadata/value tuple and TerminalRecordPlan result, parallel in ownership to prepareMemberResponsibility/prepareEntityResponsibility. This is tree-local preparation, not a new public authority or notification subscription.
2. transactions.ts: register the exact existing producer on that runtime, retaining all guards and effect/operation construction. Clear only its owned provider on cleanup. Remove its old ordinary terminalRecord attachment so initially seeded leaves do not acquire two terminal owners. Keep existing observation/beforePublication work and entity/member producers unchanged.
3. owned-mutation.ts wrapOwnedWritableSignal: attach the single terminal delegate alongside its existing intrinsic observation, using current write metadata/intent and installed owner address/position. It reads the tree-local provider when preparing a write, so already-created leaves work after enhancer initialization and later-created leaves work without a rescan. Return a combined release for both registrations. Honor hooks.isActive before preparing provisional leaves, matching the existing allocation lifetime.
4. Existing finalizeLeafSignal/ConstructionAllocation already supply common creation, activation and cancellation seams. Prefer no changes there unless review finds the combined release cannot honor them. No generic tree rescan, global leaf registry, post-install listener or entity enrollment change.

Preparation remains before physical write. Failed/canceled detached members release only their own delegate; reentrantly installed inner members retain theirs. Terminal method registration must be checked for success rather than silently swallowing missing/double ownership. Only transactions currently supplies production options.terminalRecord, but the helper's generic single-owner contract must remain intact; another provider must not be silently overridden. The new dormant delegate on capture-enabled trees and its interaction with non-transaction enhancers need review, not an assumed compatibility exemption. Bare trees without mutation-capture should not acquire this attachment. No allocation/performance claim is made.

This is a bounded private lifecycle attachment change across the producer/runtime/ordinary-leaf wrapper, broader than a one-line caller fix. Its sufficiency has not been executed because no runtime repair is authorized. In particular, preserving exact capture metadata, cleanup ordering and duplicate-observation behavior must be verified rather than inferred from the successful static path.

## Finite qualification inventory for an approved successor

First: unchanged3 original dynamic/reentrant cases and minimal static/dynamic pair, useful rollback/retained handles, both direct callable and native set/update paths where already supported. Keep original first failures.

Then narrowly exercise: initially seeded scalar controls; freshly created direct/nested members; reentrant inner installation surviving outer construction failure; failed unpublished construction releasing only provisional hooks; held absent member/reactivation; repeated installation/cancellation without duplicate terminal preparation; enhancer/connection/tree teardown; inspection/realized/restoration/foreign-owner guards; equal/no-op writes without fabricated operation; multi-write same transaction preserving both combined and per-operation effects; callback failure/rollback with exact errors and no value installed on preparation refusal.

Entity producers remain unchanged: a small existing entity counterweight may check no double attachment, but no entity-cost investigation or general graph redesign belongs here. Review architecture before implementing. No repaired pass, full-suite pass or integration conclusion is claimed.

## Four-framework acceptance addendum

Read and preserved FRAMEWORK-FAILURES.json from /private/tmp/st-r3-compatibility-inventory. All4 whole-value-new-keys fixture hashes match this exact frozen R3 baseline; FRAMEWORK-ACCEPTANCE.json records exact names, hashes and raw log paths. These are externally executed failures, not new replays in this trace. No source/test/runtime edits or additional runs.

Any reviewed shared repair must pass the entire unchanged files:

- Angular: packages/angular/src/lib/whole-value-new-keys.spec.ts.
- React: packages/react/src/whole-value-new-keys.spec.tsx.
- Vue: packages/vue/src/lib/whole-value-new-keys.spec.ts.
- Solid: packages/solid/src/lib/whole-value-new-keys.spec.ts.

All4 fail the later scalar write after creating the member within the same transaction. Angular/Solid native set and Vue value assignment pass through native-tree-scalar-leaf-runtime preparation; React callable uses location-runtime. Both routes converge at the same native selector missing prepared admission. This broadens required realization coverage, not the authority/semantics or proposed repair location. It does not by itself execute a per-facade terminal-hook registration trace.

Retain every useful assertion: native computed/UI after delivery, direct/root/branch agreement, rollback to absence, held handle absence, confirmed recreation preserving the supported held identity and new value. Keep the same files' seeded/unseeded failure-coherence counterweights unchanged. Preserve existing kernel static/sibling controls, minimal static/dynamic pair, all3 original kernel failures and retained-reentrant-handle control. No individual facade patch, native timing change, caller guard or weakened assertion. The shared provider/delegate mechanism must be reviewed before implementation; current trace is complete at this boundary.
