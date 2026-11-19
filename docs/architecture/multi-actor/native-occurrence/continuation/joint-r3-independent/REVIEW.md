# Independent R3 membership phase review

Bounded acceptance of the R2-to-R3 membership-phase mechanism and separately reviewed test companions. **No whole-R3 acceptance:** the frozen broad membership selection has 76 failures / 197 passes and requires causal triage. No parent snapshot or C6/construction composition is qualified here.

Identity: SOURCE-SHA256.json `59cdc07d250e7262f09789c3332bd80363f152011d777cc15ca5226ffe69c6c8`; incremental runtime patch `b7056edc9f995964c956a640daf37fd8f7058f8b68119b7b4aed6fb410790c94`. Independently verified all seven FREEZE artifact hashes and every manifested source file before copying. Final verification finds no author or copied manifested-file changes. Exactly two runtime files differ from R2: plain-branch-membership.ts and causal-runtime/tree-realization-adapter.ts. Original admitted membership falsifier is byte-identical to my R2 handoff, not one of the earlier unavailable-location fixtures.

## Mechanism

Operation owners now create PublicationPreparation before membership preparation, pass it through member scalar and sibling scalar/entity preparations, seal after sibling callbacks, and validate before stores. Exact retained-member checks join that phase; delegated member installation avoids repeating that validation after sibling stores. Standalone helpers retain an owned phase and pre-install validation. No proof resampling at install is introduced.

Membership-owned scalar publication is suppressed during invalidation when an outer phase owns completion; the owner's completion drain now includes the member result. Point and structural selected plans catch completion errors independently and continue sibling completion. Ordinary applyAtomically queues membership completion with the other detached completions; scalar fallback now explicitly publishes invalidation and queues the frame completion. These changes address the original early seal, rather than modifying its pending-owner assertion.

## Independent executed checks

Fresh copy uses the frozen manifest and linked installed dependencies. Node24.15.0, corepack/pnpm, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. All runs use `pnpm nx test <project> --skip-nx-cache <files> --maxWorkers=1`:

- focused.log: kernel joint-membership-seal-independent.spec.ts, joint-membership-phase.spec.ts, joint-install-boundary-independent.spec.ts, tree-realization-adapter.spec.ts: **56 pass** (2 unchanged original membership +9 phase +2 original installation-boundary +43 adapter).
- drain.log: new review-only joint-membership-drain-independent.spec.ts: **2 pass**. Point and structural plans install without completion, then member completion observes both installed sources, authors other=777, and throws an exact sentinel. Collection completion still runs once, sees installed values and 777, and publish rethrows that sentinel. Both committed state and independent reentry survive. The tests assert actual callback counts and snapshots, not merely an absent throw.
- standalone.log: plain-branch-membership.spec.ts: **10 pass** with existing standalone install/publish contract.
- vue.log: entity-projection-publication.spec.ts and settlement-publication.spec.ts: **23 pass**.

Total independent passes:91. No full-suite or all-framework replay claim. Copies and new test preserved beside this report.

## Test companions

Approved reader patch is consistent with the owner's explicit acquisition-independent SignalTree-reader freshness approval. It asserts before=0 and held reader after=9; the native computed identity expectation and nested confirm/final9 remain. This does not approve unrelated parent-snapshot behavior. Both exact companion files replayed above.

Private hook patch is a valid causal replacement, with its limits stated explicitly. The old restore test replaced a no-longer-called __planRestore.commit, so it could not inject the intended failure. The replacement throws the same exact sentinel once from the current source preparation and retains absent lifetime/held leaf, unchanged revision and no-notification assertions. It qualifies preparation refusal, not arbitrary post-install exceptions. The other old wrapper omitted prepareCommit; the complete current wrapper now performs the independent undoable write before invoking the captured real prepareCommit. The exact stale-preparation guard fires once, independent work/history survives, and outer state/delivery assertions remain. I read the original/aligned diff and replayed the full43-test adapter file; missing seam setup cannot satisfy either expected sentinel. No baseline failure was silently declared a runtime pass.

## Unresolved broad evidence

Read frozen membership-regression.log:76 failed /197 passed, including collection-reversal delivery and reentrant listener assertions. These are executed behavior failures, not merely setup warnings. Author/Main predecessor/C0 triage is ongoing; this review does not attribute all76 to R3, waive them as inherited, or treat the focused passes as whole-candidate acceptance. Keep the original log and assertions until that causal classification is complete. Parent design remains separate.

## Final phase follow-through: independently isolated broad failure

Executed the cheapest unchanged broad-suite discriminator on fresh exact C0 and R2 copies and the verified R3 review copy: `pnpm nx test kernel --skip-nx-cache membership-reversal-delivery.spec.ts '--testNamePattern=left clear \+ right clear' --maxWorkers=1`. Node/environment match the runs above. Commands/exits are in MINIMAL-TRIAGE.json and run-minimal-triage.py; logs are c0-minimal-membership.log, r2-minimal-membership.log, candidate-minimal-membership.log.

- C0:2 pass,214 skipped.
- R2:2 fail,214 skipped.
- R3:2 fail,214 skipped.

The spec is byte-identical in all three arms (SHA256 `1f96503a2afb00c06066997e2d1d8c21f96614c6cb06202c055695ef478ad27a`). R2 and R3 report the same ten replica removal mismatches at sequences2,4,12,14 in both enhancer orders. The assertion consumes actual membership events and checks removal identity/key against its replayed prior membership; it is not a missing-location setup failure. No partial-reversal/final-state assertion appears in these two failures, so this evidence specifically establishes event-replay inconsistency, not a claimed failed physical rollback.

This resolves attribution only to this boundary: the selected failures predate the two-file R3 delta, but do NOT predate cumulative phase work relative C0. They cannot be waived as C0 inheritance or by the held SignalTree-reader approval. Exact introduction within the C0-to-R2 chain and all other74 failures remain author/Main triage; this small replay does not extrapolate their cause. Bounded R2-to-R3 mechanism verdict remains unchanged, while whole cumulative R3 integration remains blocked on this concrete evidence.
