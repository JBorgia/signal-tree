# Bounded C21 follow-up and fixture audit

**Only public-selected-unit reran: 4/4 pass, Nx exit0.** Exact C21 source remains unchanged. One requested/reported file, no watchdog trigger, no remaining owned processes. COMMAND.json, RESULT.json, first.log and public-output/{xy,yx}-{retry,confirm}.json preserve execution and meaningful atomic-refusal/retry/confirm assertions. Original partition and its four missing-output failures remain unchanged at /private/tmp/st-c21-undispatched-kernel. This is not full-suite acceptance.

## Held continuation: setup failure, not an obsolete fresh-reader oracle

Original first failure is `expect(typeof globalThis.gc).toBe('function')` at held-continuation-probe.spec.ts:27. It occurs before mode validation, setup, capture or any assertion about retention/replay. Ordinary C21 discovery includes this GC-only probe; ordinary configuration excludes several other retention files but not this one. Missing GC is a runner/routing prerequisite failure, not evidence that a held reader has stale value semantics.

Actual call shape: interceptLocationWrites(leaf, (operation, proceed) => { box.proceed = proceed; proceed(); }); q.rollback(); detach; destroy; sample WeakRefs; call saved proceed() with no arguments. This is a selected WRITE continuation, not a SignalTree reader. Acquisition-independent reader freshness authority does not authorize replay of a consumed selected write. location-runtime.ts:138–147 supplies selectedProceed; selected-write-operation.ts:31–56 closes/consumes invocation, clears forwarding edges and rejects replay. Preserve the stale-replay assertion and positive/negative GC controls.

The fixture's C21 bytes exactly match archived paired-preparation/held-continuation/probe.spec.ts (SHA in HISTORY-IDENTITIES.json), as well as its C8 copy. The archived review describes the explicit three-arm exposed-GC harness, not an ordinary no-GC run. Current closeSelected clears forwarding edges, unlike the historical report's receiver-retention trace. The test does not assert the old tree-retention pattern; it asserts controls and non-replay, so that historical implementation change does not by itself obsolete these assertions. No current GC arm executed; current retention/capture success remains unproved. Cheapest falsifier: same unedited fixture with explicit exposed GC and per-arm unique ST_GC_ARM/ST_GC_OUTPUT, preserving all assertions. Not run under the one-file rerun scope.

## Heterogeneous invalidation: private spy drops required shared-phase context

Both fixtures replace __preparePointValues with function(values) and invoke original.call(port, values), dropping all remaining arguments (independent fixture:13–15; containment:39–45). Actual C21 caller tree-realization-adapter.ts:1287–1289 passes ([row], undefined, publicationPhase), inside withEntityPointPublicationPreparation. Actual signature entity-signal.ts:643–652 has the shared phase as its third parameter.

Concrete causal chain from exact source:
1. Without the phase, each spy-created row plan constructs/seals a private PublicationPreparation and validates again in install (entity-signal.ts:683–690). With the phase it registers with the operation phase and does not revalidate mid-install.
2. Point preparation merges the collection's rows into one publication unit (entity-publication.ts:326–337), and both row plans reference its gate.
3. Normal operation validates captured inputs before installation (tree-realization-adapter.ts:1640), then installs row plans sequentially (:1645). The first row installs the merged terminal record once, advancing the publication source revision (entity-publication.ts:212–219,248).
4. The second spy-created row plan revalidates its captured source after that legitimate sibling install. EntityPublicationSource.validate rejects changed revision (:242–244), producing exactly the error in the preserved first failures.
5. This occurs before the invalidate loop (:1650–1669); the deliberately injected sentinel/containment assertions are not reached. Dropped phase also selects standalone completion scheduling in invalidate (:714), another reason the spy no longer isolates just invalidation failure.

Bounded conclusion: these wrappers are not transparent injections at the current private call seam. The failure does not demonstrate broken post-install failure containment, and the spy must not be used to justify removing source validation. The substantive contract remains: installed siblings must all receive invalidation/delivery despite earlier callback failure, preserving the first error.

Cheapest decisive falsifier: test-only wrapper forwards the exact argument tuple/receiver to original (including the same phase), overrides only invalidate, retains every state/sentinel/attempt/scalar/delivery assertion unchanged. **Not run or edited here.** Passing is not presumed. Source chain is strong attribution, not a runtime trace of the second plan; no statement that all real heterogeneous operations are safe.

## History and limits

Git HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777; these scratch-era paths have no file commit history in that checkout. Exact candidate authority is frozen C21 BASE-MANIFEST.json, not root HEAD. HISTORY-IDENTITIES.json records the three byte-identical C8/C21 fixtures; C8 also contains the third phase parameter. This establishes source history only: no matched C8 execution was done, and no pre-existing-failure claim is made.

Contributor ownership and docs/review-contract reviewed. Original assertions/runtime/source/config were not changed. Source-evidence contains exact fixture copies and numbered seam excerpts. RUNNER-ENV.md and ENV-INVENTORY.json cover output requirements across all 620 cached ordinary file targets, including a newly identified hard-coded-output containment gap in the original partition. No broad tests, GC runs, altered fixtures or repeated campaign.
