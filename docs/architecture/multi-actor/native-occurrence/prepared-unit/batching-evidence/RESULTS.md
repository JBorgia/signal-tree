# Frozen94ac batching and replacement-scope qualification

Source manifest: 94ac87f1e1c29f8ffdcd0b1041b8da1d9b9c3ed734bac5a8e7e1976b96504a82.
Verified disposable copy: /var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-94ac-batching-0a5k2l73/candidate. All manifest entries in both frozen original and disposable copy verified unchanged after execution. Only two new test files added to disposable copy. No runtime edits, no fixes to failing fixtures, no broad suites.

## Results and commands

Node24.15.0 PATH; NX_DAEMON=false NX_ISOLATE_PLUGINS=false. All commands run in disposable candidate:

1. `corepack pnpm nx test kernel --skip-nx-cache batching.behavior.spec.ts batching-context-safety.spec.ts batching-semantic-scopes.spec.ts batching-adversarial.spec.ts external-baseline-coalescing.spec.ts batching-detachment.spec.ts batching-ownership.spec.ts main-invocation-scope.spec.ts native-invocation-handoff.spec.ts native-explicit-handoff.spec.ts`
   Exit1: 108 passed, 3 failed /111 tests, 8 passed files, 2 failed files. All seven requested existing batching files pass. Original log retained as listed-controls.log.
2. `corepack pnpm nx test kernel --skip-nx-cache selected-real-batching-review.spec.ts`
   Exit0: four passed. Actual transactions()+batching() enhancer in both orders. Inner synchronous coalesce proceeds through existing interceptor chain and restores both selected fields/support; tap sees completed unit. Outer coalesce refuses selected inverse, preserves pending value/support, fresh retry restores baseline, subsequent ordinary dedup writes remain usable. No simulated batching port.
3. `corepack pnpm nx test kernel --skip-nx-cache public-replace-scope-review.spec.ts`
   Exit0: one passed. Public literal row replacement with onUpdate transform to {id:a,z:99}, starting ordinary z7/display99, removes omitted x, calls interceptor once, changes z ordinary support, and later transaction z100 rollback restores99. Useful native rollback assertion establishes adopted ordinary value, not just final display. This already-started narrow test finished; no further runs after Main boundary report.

## Three preserved failures and original expectation changes

native-invocation-handoff same-field reentry and native-explicit-handoff registered interceptor reentry (coalesce false/true) fail because ported regex `/reentered installation/` instead receives `Stale scalar preparation` wrapped in rollback validation failure. First logs preserved unchanged. Later value/support/confirmation assertions did not execute: DO NOT mark those cases accepted on error similarity. main-invocation-scope's ported getter test passes.

Original fixtures expected immediate outer inverse to override nested writes. The authorized prepared private lane instead refuses stale preparation, preserving independent writes. Historical originals remain PRE-PORT copies in /private/tmp/st-native-prepared-unit-successor. Current runs test modified private-timing expectations, not unchanged65green. Cleanup no longer masks the primary refusal with an already-closed-frame error; frozen source itself has not been edited here.

## Replacement contract resolved by source plus public control

entity-signal.ts replaceOnePrivate invokes public onUpdate once with the row-shaped input; ctx.transform replaces `next`, not a merged partial patch. Normal literal replacement creates PreparedValueReplacement with authoredFields:null (:2175); commitAndProjectEntityMutationFrame passes that domain to valueStore.prepareValueTransition (:1186). With null fields and ordinary participation, EntityValueStore uses the complete physicalAfter as ordinaryAfter; omitted properties disappear and equal displayed values can be ordinary adoptions. The public control above exercises that rule directly.

The synthetic certified absence route (tree-realization-adapter.ts:1860) is reached by one-field selected compensation, constructs a row without that property and invokes the row private replacement port. It runs the same replace interceptor but frozen selected preparation narrows fields to a physical diff plus certificate field (entity-signal.ts:2165). That does not preserve the established full transformed replacement scope for an equal sibling. No new ownership policy is needed to identify the mismatch. A certified removal without a public transformation still needs its exact removal scope; carrying row-shaped transport alone is not blanket whole-row authority. Explicit transport/edit scope and transformed replacement scope must remain distinct. No implementation attempted here.

## Recurrence disposition

Main independently reports frozen94ac boundary suite 2pass4fail; /private/tmp/st-prepared-boundary-main.log and Hume /private/tmp/st-prepared-unit-review/run-41kr6lwm/boundary-runtime.log preserve results. Failures include incomplete field+order settlement, mislabeled ordinary producer images in both orders, and equal transformed synthetic row replacement. These supersede any inference of acceptance from independent17 and batching passes. No predicate guard, planner rerouting, runtime successor or asserted new policy introduced. Await Hume causal/disposition review. Structural/member routes remain unqualified.

Remaining qualification includes the three failed ported controls' downstream assertions and selected failure-priority/retention tests beyond existing ordinary batching suites. Do not infer universal callback purity, selected cleanup or source contract compliance from these finite passes.
