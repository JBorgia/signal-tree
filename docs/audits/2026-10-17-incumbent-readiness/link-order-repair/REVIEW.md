# Independent bounded Link order review

Read-only source review of entity-signal.ts, physical/prepare-entity-target.ts, causal-runtime/target-transition.ts, mutation-capture-runtime.ts, and the Link/transaction/restoration order subscribers in the incumbent-readiness worktree. Final candidate identities are recorded separately in /private/tmp/link-order-mixed-inputs.sha256.

No public-behavior blocker established. Prepared order publication follows all physical target installations and precedes target callback delivery. Existing consumers use captured payload facts: Link queues a microtask; transaction/restoration subscribers record metadata. Inspection suppression and transaction-compensation provenance remain the relevant participation boundaries.

Independent executable probe: /private/tmp/link-review-coherence.ts, bundled via esbuild with ngDevMode=false and executed with Node24.15.0. Primed speculative rows.ids()/all() both read b,a. During synchronous internal capture, afterSubjects is restored [1,2] while ids()/all() still read b,a. A subsequent public onUpdate replay tap reads a,b in both projections; final reads also return a,b. Thus capture is an internal installed-fact boundary, not a projection-coherent public callback boundary.

Read preserved first failure /private/tmp/link-order-repair-two-targets.log (6 pass, 1 fail) and subsequent /private/tmp/link-order-repair-phases.log (7 pass). The former demonstrates why per-target order publication after callbacks can overwrite a newer authored order in another target. Publishing all installed order facts first addresses that sequence.

Compatibility limit: production declarative orchestration invokes optional publishOrder. Direct internal/test-only install(); publish() clients omit it and do not exercise order publication. No public API promise inferred from those clients.

Parent-reported later validation: 12 new tests and 57 focused tests, parent typecheck, Vue pass. These were not rerun by this reviewer and are not independent test results.

No edits, no full-suite or release sign-off. This review does not qualify the separate restoration frontier proposal or close earlier independent-Link-progress failures.
