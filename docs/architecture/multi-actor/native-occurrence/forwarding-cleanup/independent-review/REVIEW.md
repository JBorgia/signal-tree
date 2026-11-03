# Independent selected-forwarding cleanup review

**Accept the narrow cleanup improvement on exact d3b6; no blocker demonstrated in that scope.** Source implements the reviewed clearable forwarding edges and separate dispatch outcome correctly. Independent nine behavioral controls and six matched Nx GC runs pass. This is NOT acceptance of c47b integration, the complete feature, framework compatibility, activation or release.

## Frozen identity and source scope

Candidate /private/tmp/st-selected-forwarding-cleanup-successor/candidate. Manifest SHA256 d3b6da2906ae9cef72e5623b35eb6de3dee73d64b12f5c9bd408352aa627e73b. All2941 entries verified before copying; original and disposable copy entries reverified unchanged after execution. Predecessor c47b manifest verified before comparison. Existing predecessor entries differ in exactly three runtime files: selected-write-operation.ts, location-runtime.ts and causal-runtime/tree-realization-adapter.ts. Seven added paths are tests/configuration/Nx harness/type declaration, not new runtime implementation. Existing predecessor specs are unchanged.

Read source.patch, inspected exact source and independently generated actual-runtime.diff. Read RESULTS for commands and evidence locations, not as acceptance. Reviewed against /private/tmp/st-selected-forwarding-cleanup-review/PROPOSAL.md and docs/review-contract.md. Root HEAD628d302dadb082a48c58528651c9088234d0a777, branch fix/d1-d2-forward-port; unrelated dirty work preserved. No runtime, source, config or fixture edits in original or copied candidate. Dependency versions/manifest verification in IDENTITY.json. Source+patch snapshots archived.

## Mechanism / exact failure receipt

- selected-write-operation.ts53–57 creates/registers one clearable edge per selected forwarding registration and invokes a separate lexical factory with only invocation/edge. makeSelectedProceed46–51 does not capture the original downstream argument. At49 it removes edge.next before calling the synchronous local, so same-edge reentry refuses before another preparation.
- closeSelected30–35 marks closed first, clears every registered edge.next (including unforwarded inner edges), clears/detaches the inventory, request and outcome reference. Repeated close has no callbacks or failure. failSelected36–40 records only the first failure into the dispatch-owned receipt, then uses the same close path. Existing downstream stack locals may retain what execution still requires until they unwind; that is distinct from saved callback ownership.
- location-runtime.ts95–97 owns the outcome locally. If an interceptor catches a downstream failure and returns, outcome.failed still causes the original error to be thrown. Caught undefined remains a failure because the boolean is independent of error value. Finally clears outcome.error and closes again. Nested fail calls cannot overwrite the first stored receipt after detachment. A different error thrown directly out by the outer interceptor still escapes directly; no global first-error-wins policy was introduced.
- tree-realization-adapter.ts1860–1862 adapts the direct row-shaped selected path to the same owner/receipt construction and finally cleanup. It consumes directly without an extra interceptor pass. Source search finds only these two openSelected owner sites; no abandoned caller remains.
- Terminal consume still clears request and moves to consumed before existing observer-before-read. It does not prematurely close active outer dispatch. Ordinary public interceptor replace/derive functions, framework writers, admission, paired-step composition and whole-unit installation are unchanged. Builder-owned edits/plans/deliveries are not tied to edge cleanup and retain existing install/abort ownership.

No source-level mismatch with the bounded proposal found. A comment about cleared wrapper records is now supported by its lexical inputs and measured targets; it is not a universal statement about all reachable internals.

## Independent executed controls

All commands use pinned Node24.15.0, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. Fresh independent directory: /private/tmp/st-forwarding-cleanup-independent/candidate. RUNS.json preserves exact arguments, environment, working directory and exits. First logs retained; no failures/retries or assertion changes in this review.

1. `corepack pnpm nx test kernel --skip-nx-cache selected-forwarding-cleanup.spec.ts`: **9 passed**. Source-read the assertions before execution. Covers two saved edges: success, unforwarded skip, throw-before, throw-after, caught error, caught undefined, direct outer replacement error and same-callback reentry; plus ordinary public saved proceed. Refusal tests assert unchanged value/exact support and useful fresh rollback. Saved callbacks refuse before/after an independent later write. Caught failures preserve exact cause; direct replacement error is not overwritten. Ordinary delayed public proceed still performs its write.
2. Six fresh Nx processes, one matched drop/hold pair each for success, caught and skip:
   - Success: `NODE_OPTIONS=--expose-gc corepack pnpm nx run held-continuation-probe:retention --skip-nx-cache`.
   - Caught/skip: same environment with `nx run held-continuation-probe:extended --skip-nx-cache`.
   ST_GC_ARM, ST_GC_SCENARIO and unique ST_GC_OUTPUT are recorded in RUNS.json. **All6 pass**. The original success probe is byte-identical to the independently preserved c47b probe. Extended typed probe was source-inspected; it saves both edges, asserts caught-error identity or skip refusal, removes interceptors, completes a useful fresh rollback on refused cases, destroys the tree and leaves only WeakRefs plus explicitly held callbacks before sampling.

No independent rerun of author139, types, broad kernel, framework differential, build or release gates. Fifteen passing test executions here means nine behavior tests plus six single-test GC processes, not integration qualification.

## GC observations and limits

Same12 task-boundary samples/phase and existing collector (four forced GCs per round), with gc availability asserted. Sampled targets: actual tree facade, row callable, field callable, field EntityPublicationBinding, native EntityPublicationSource, transaction handle and baseline ordinary requirement. The extended caught/skip probes also sample a receiver-bearing Error and object-valued operation.value. “Native publication” refers to the kernel's experimental authority, not a Vue/Angular/Solid native carrier or the private writable-binding WeakMap object.

For **every matched drop and held arm**, all sampled library targets were collected in the held phase and remained collected after release. Positive plain-object sentinel remained reachable while held and collected after release; dropped negative sentinel collected. All recorded round patterns are stable. Held success callback rejects replay; both held extended callbacks reject replay. Raw JSON contains all samples; GC-SUMMARY.json summarizes endpoints/stability.

Contrast to the preserved c47b matched Nx experiment: callback-only holding retained tree/field/publication binding/source/baseline requirement there; on this successor those named targets collect while the callback remains held. This resolves that measured ownership difference for this harness. Row and transaction already collected under c47b held callback; do not describe them as newly fixed.

The failure probe deliberately makes the Error refer to the tree. Its collection while callbacks remain held supports detachment of failure ownership after dispatch, alongside exact error propagation assertions. In skip/caught arms the retry completes before destruction/GC: this measures closed callbacks after the outstanding transaction obligation is discharged, not garbage collection of a still-pending transaction that legitimately owns history.

No explicit-row or explicit-value arm was independently rerun on this successor in this review; those author results remain author evidence, and prior explicit-row controls remain historical evidence. The probes do not establish zero bytes, collection of every internal object, universal engine behavior, all native frameworks, or release of explicitly user-held values/receivers. No arbitrary timing/cost comparison or heap snapshot inference. No runtime WeakRefs were introduced.

## Broader unresolved work remains separate

During this review Main reported an actual framework differential: Vue absent-collection rollback hidden rows passes the predecessor and fails c47b. This is user-reported evidence, not independently reproduced or causally investigated here. Author focused replay is pending; full kernel baseline comparison is still underway with inherited unresolved failures. This cleanup acceptance must not be used to qualify that regression, c47b integration or any broad-suite disposition. The three-file cleanup delta does not claim to repair it.

## Disposition

Accept only the reviewed private forwarding-edge/failure-receipt cleanup on exact d3b6. It preserves tested dispatch/error semantics and removes the sampled callback-only receiver/error retention after completed work and destruction. No blocker demonstrated for that bounded improvement. Original frozen sources are unchanged; broader integration remains unqualified and explicitly unresolved.
