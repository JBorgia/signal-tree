# Combined source review

Source/evidence conclusion: no blocker demonstrated for manifest 89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84. Author freeze is now confirmed against FREEZE.json and its recorded hashes; this conclusion applies to these exact frozen bytes. No candidate/root edits or independent runtime replay. Main replay is separately attributed below.

## Composition

Independently verified all 3119 manifest files with zero mismatches. Exactly six runtime files differ from the composition base. Four match the reviewed lint arm byte-for-byte; Link matches the reviewed registration arm. Entity differs from that arm only by removal of unused EntityPublicationPacket type import. No behavioral merge adaptation, runtime policy, public API or error-order change beyond the two reviewed disjoint deltas. FINAL-CHECK-IDENTITY.json records hashes and matching layers; provisional evidence remains preserved.

## Permanent fixtures and useful receipt assertions

Original8 cases.mjs and lifecycle6 lifecycle.mjs are byte-identical to the reviewed predecessor controls. Source wrappers now use relative imports into packages/kernel/tests/entity-registration, within the actual graph's kernel project root packages/kernel. No absolute scratch imports remain in those wrappers. Moving fixtures did not change their useful assertions or release discovery config.

Six additional cases cover field/row/collection times independent/dependent. Non-no-write assertions are paired with changed physical9, unchanged foreign inspection/value, exact pending held receipt and no early transport, unresolved settled until confirmation, useful single9 delivery and started receipt. Independent cases require delivery while foreign remains pending. Every case then writes11, requires exact two deliveries, preserves earlier terminal receipt through newer work/disposal, and checks no duplicates. These are useful public behavioral assertions, not vacuous negatives. No exception swallowing or fallback pass path found.

Receipt TS harness is imported by ordinary discovered specs, so spec-types follows it even though the directory is not an initial include. Relocated source/public/spec checks exit0. Source-types alone is not harness qualification; source excludes ordinary specs. The JS fixtures' .d.mts files type their boundary, not their implementation. Manual artifact scripts/documentation state that distinction. Node24 artifact execution erases the private type-only import; it does not independently check installed public types. Same-project TS harness receives explicit ESLint invocation rather than relying on ignored tools paths. No baseline, lint suppression, test exclusion or production build config change found.

## Corrected lint and execution evidence

runs/lint-local-fixtures builds Nx graph, loads the actual cached graph containing kernel/root packages/kernel and react/root packages/react, then runs the full affected list and separately receipt-cases.ts. Exit0; 0errors26warnings; no skipped-rule/ignored-harness message. Earlier skipped-rule and three import-boundary errors remain preserved, superseded by actual corrected coverage; they are not current blockers. The relocated 20 cases execute/pass, with source/public/spec type checks passing. Recorded run source maps agree with final manifest; canonical build SOURCE-BEFORE equals final manifest and build completes exit0/source unchanged.

Main-independent-replay/RESULTS.json and raw logs show production original8, lifecycle6, receipt6, and useful no-Link inspect/confirm/rollback all pass, no deadline. Independently rehashed all four current artifacts against before/after hashes: exact matches. This reviewer inspected Main's replay rather than rerunning. No need to duplicate runtime work for the remaining source questions.

Permanent build-consumers.mjs receives an explicit isolated consumer directory; entries import installed public package and relative copied fixtures. It introduces no source alias, sideEffects override or activation. Manual scripts are not automatically registered release gates. Reviewed original8 receipt fields remain observations; the separate six-case file carries the new assertions. Prior lifecycle confirmation-oracle correction remains preserved in predecessor evidence and was not changed again here.

## Limits

Bounded composition/source approval only. Remaining bundle, large-workload and full qualification gates are not waived; no allocation/timing claim, activation or release authority. Genuinely late first entity-factory registration remains unqualified; existing split test initializes factory in early shared chunk. Declaration/helper checks and passing packaged tests do not expand source admission. No broad reruns or new failures were produced by this reviewer.

## Final freeze confirmation

Author FREEZE.json confirms no further source changes and exact manifest 89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84 (3119 files), matching the independently reviewed identity. Independently verified every recorded freeze hash, including REPORT.md and runtime.patch; see FREEZE-CONFIRMATION.json. Final verdict: bounded accept, no blocker demonstrated in this composition. No runtime rerun, release/performance waiver or further combined work. Prior provisional records remain preserved.
