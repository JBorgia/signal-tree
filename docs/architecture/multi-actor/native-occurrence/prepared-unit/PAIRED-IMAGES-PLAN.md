# Bounded selected-step image correction — design only

Frozen source: /private/tmp/st-native-prepared-unit-successor/candidate, manifest 94ac87f1e1c29f8ffdcd0b1041b8da1d9b9c3ed734bac5a8e7e1976b96504a82. Do not edit this candidate. This plan does not qualify additional routes or change public semantics. Hume's independent review remains pending.

## Concrete mismatch

entity-signal.ts:516 prepareSelectedRows seeds a physical draft from operation.before. At :587 preparePointValues labels its composed physical step images as ordinary publication images. Field masks currently prevent the tested untouched z from being acquired; the unchanged independent 17 cases pass. That does not satisfy the producer contract. Each ordinary packet must contain actual ordinary images without relying on a consumer to ignore falsely labelled siblings.

## Representation and source ownership

Split provisional intercepted intent from a completed selected step. Keep source, subject lifetime, key, operation ordinal, explicit authored field domain, certified endpoints, and preparer identity on both. The provisional record contains materialized physical inputs and an explicit semantic edit; it must not claim to contain ordinary images before ordered source composition.

The completed private SelectedRowEdit contains physicalBefore, physicalAfter, ordinaryBefore, ordinaryAfter, fields, selections, source, subject, key and ordinal. No generic before/after aliases. Field absence is represented by present:false; present undefined remains present:true/value:undefined. Field names remain Map keys; property insertion uses defineProperty, not assignment to an ordinary object prototype. Selections are per-step exact maps, never a final row-wide selection map retroactively attached to earlier steps.

Producer seams:

1. entity-signal.ts stageSelected captures the already-run public interceptor result and validated selected endpoint, once. It stages a provisional explicit field edit, not an ordinary row. Do not rerun public onUpdate, transformed getters or projection callbacks during composition.
2. prepareSelectedRows groups by actual publication source and subject, preserving operation order. Its first physical image comes from the captured producer physical input; its first ordinary image comes from EntityValueStore ordinaryForSubject, under the same source/lifetime and whole-unit revision validation. No observer snapshot, collection scan or physical fallback asserted as ordinary authority.
3. Factor the existing ordered edit reduction inside physical/entity-value-store.ts:94 prepareRealizationTransition into a source-owned preparation helper that can return intermediate paired images as well as the final transition. Do not repeatedly invoke today's prepareRealizationTransition for each step: it rereads the initial baseline and would erase prior step composition. Seed once; apply each materialized field's presence/value to separate physical and ordinary drafts; retain both before/after images at that ordinal. Each next ordinaryBefore is the previous ordinaryAfter, and likewise physical images. Keep the existing clone/materialization contract, avoid a second getter walk. Compute final divergence/equality before install.
4. preparePointValues receives the producer's completed steps and final transition. Build packet.physical from physical images, packet.ordinary and step.ordinary exclusively from ordinary images. If per-step physical pairing is supplied, it is the same completed step's physical pair. Taps retain their physical per-step values. Retain final aggregate path invalidation behavior separately; do not silently claim per-step observer delivery from aggregate notifications.
5. Install the already-prepared final physical/ordinary transition plus terminal records. Finalize requirements and validate lifetime/revision during whole preparation. Complete the entire selected unit before invalidate/publish. Release provisional drafts and endpoint references on refusal and completed delivery; saved continuations retain only their cleared invocation record.

Exact authority: selected fields receive their certified restored endpoint only after source/lifetime/presence/transformed-value validation. A transformed sibling is an authored contribution at that ordinal, including equal-value transforms; it receives ordinary producer support, not a borrowed restored endpoint. Later selected or authored edits supersede earlier ones in order. Unchanged siblings retain their prior ordinary values and endpoint identities.

## Whole-row and absence boundary (must not disguise replacement as a diff)

supportsSelectedOperation at tree-realization-adapter.ts:700 excludes whole-row effects, structural effects and plain-member effects. Keep that boundary. Public whole replacements are not newly admitted by this plan.

However, applyEffect :1860 routes a certified absent-field inverse through a synthetic row replacement, then replaceOnePrivate :2163 currently derives fields from publicationFields(prev,materialized) plus selected field. This IS reachable and cannot be dismissed as an excluded whole-row effect. A value diff cannot certify authored scope, especially an equal transformed sibling.

Carry an explicit private edit discriminant from this caller: field patch versus certified field removal with row-shaped transport. The removal carries its exact field and presence certificate, not whole-row authority. Preserve existing public replace onUpdate arguments and once-only invocation. Record whether ctx.transform supplied a replacement and its materialized replacement payload at that existing producer seam. For an untouched synthetic transport, lower exactly the certified removal. For a public interceptor replacement, preserve the existing replacement's authored scope honestly: a row semantic edit with explicit replacement footprint, all own keys and removals relative to ordinary domain, and only the matching selected field eligible for its certificate. Equal authored siblings cannot disappear through value-diff narrowing. Apply its row semantics to the ordinary draft as a row edit, not a field diff against displayed physical state.

This distinction requires review of the existing replacement interception contract; do not infer narrower authority from the synthetic origin after an actual interceptor transformation. If that source contract is not established, leave transformed synthetic replacement unqualified and report it; do not introduce a blanket refusal or a policy change. The normal certified absence path remains required coverage. No general whole-row rollback support is added.

## Acceptance controls before a future source successor is qualified

Preserve unchanged independent 17 plus new producer-packet assertions: each step's ordinary z remains7 while physical z remains99, before AND after, in both orders. A packet capture test must inspect the actual producer hook; a render-only pass is insufficient. Check final transition equals the last completed ordinary step and physical step independently.

Retain four overlap controls (equal/changed y, both orders), certified missing versus present undefined, same-subject multi-step composition and independent reentry refusal. Add absent-field row-transport with untouched inspection sibling; transformed equal sibling and changed sibling on that transport; ordinary-domain-only removed key. Assert values AND field support AND later adoption/rejection. Include callback/getter counts so the helper cannot conceal a second preparation walk. No new assertion oracle inferred from the intended implementation.

## Inherited failures: actual results versus timing ports

First inherited-controls-first.log: 61 pass, four fail (65 tests). Source and original fixtures are preserved in the predecessor evidence and PRE-PORT copies.

- main-invocation-scope: preclaim projection getter cannot lend inverse authority to a nested setter. Original expected successful outer inverse; nested write now invalidates whole-unit preparation. Port asserts refusal and independently installed value/support, with useful confirmation.
- native-invocation-handoff: same-field public interceptor reentry. Original expected the inverse to overwrite nested99. Port expects revision refusal, retained nested99 and its own support, confirmation succeeds.
- native-explicit-handoff: registered location interceptor reentry, coalesce=false and true. Same old immediate-commit expectation; ports preserve nested99/support and refuse stale selected installation.

All four initial errors were masked by ScalarSlotMutationFrame already closed during cleanup; frozen94ac contains the primary-error-preserving cleanup change. These are not four accepted passing tests: the ported inherited set has NOT been rerun in the evidence reported here. Independent17 does cover sibling reentry and continuation closure, but does not substitute for these specific ports. The obsolete ambient-helper-only test was removed from active successor and preserved as history; actual selected continuation tests replace its relevant claim. Do not report the original65 unchanged/pass.

Authorized private timing: selected proceed may prepare without installing; reentry can invalidate the unit; public ordinary proceed stays immediate. A private post-proceed read of old value is therefore not by itself a regression. Actual independent writes, error priority, ordinary onUpdate once, and terminal settlement remain mandatory. The fake native carrier order test is not real batching qualification.

## Exact real batching qualification still required

Run through Nx on a future disposable successor; no runtime changes or extra test run in this planning step.

Existing files: src/enhancers/batching/batching.behavior.spec.ts (ordinary synchronous behavior, same-path dedup, deferred failure and primary body error); batching-context-safety.spec.ts (dynamic fields, distinct same-path locations, coalesce inside transaction, forbidden transaction inside coalesce); batching-semantic-scopes.spec.ts (classification boundaries, updater drain, cross-location chronology, reentrant drains); batching-adversarial.spec.ts (all accepted writes drain, scope refusal before queued setter/updater); external-baseline-coalescing.spec.ts; batching-detachment.spec.ts; src/batching-ownership.spec.ts. These test the actual enhancer, not a substitute interceptor.

Add selected-path integration using transactions()+batching():
- synchronous inner coalesce around the selected proceed drains before the selected invocation returns; x/y complete atomically and original certificates restore;
- outer coalesce around rollback cannot defer selected work past its invocation: preserve existing transaction scope guard, pending values/support and useful retry/confirm; draining must not replay closed authority;
- ordinary same-context replacement dedup and updater drain remain unchanged in the same tree; distinct contexts/designed scopes retain order;
- callback failure plus deferred failure preserves the primary error and cleans queues; fresh invocation retry succeeds;
- actual enhancer notification/tap observations see the fully installed unit, with existing containment/order, no intermediate selected subset;
- destroyed/retired field and held selected continuation cannot install later or retain uncleared endpoint request. Distinguish ordinary user-held operation values from private authority retention.

Review batching.ts:194 scope check before queue/updater, :219 context-scoped Map dedup, :244 pending replacement drain, :328 outermost coalesce drain and failure priority, :410 cleanup. Do not bypass these paths, relax outer scope guards, or globally restrict public normal proceed.

No claim of structural/member install purity, broader benchmarks, SDK integration or production activation. Source correction remains outside frozen94ac, after independent disposition.
