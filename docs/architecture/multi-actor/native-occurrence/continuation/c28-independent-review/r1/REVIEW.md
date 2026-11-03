# Frozen R1 independent mechanism review

Bounded recommendation: proceed to focused next qualification. No concrete blocker demonstrated in this R1 delta. This is not whole-C28 acceptance, release approval, completed type verification, or proof of arbitrary reentry safety.

Identity: /private/tmp/st-c28-r1-current-capture/MANIFEST.json SHA256 9805ab2fae49202a334ef506c71a3583ff0f8dfebec51e8b27d992b23971653b; runtime.patch 6509ca669862704b62bc0eafd9704231c7cdcfdbc78c201bf32a48890dee4da5. SNAPSHOT declares frozen, confirmed by Main. Independently verified both hashes and nine inspected runtime/test files against manifest; retained source and packet copies plus IDENTITY.json here. No author REVIEW.md or other implementation verdict read. Root review contract and previously inspected CURRENT-SPEC plus explicit owner approval govern. No candidate/root edits or new test executions.

## Mechanism

private.ts:107–139, beginBranchInput near 202: only fresh branch acquisition opts into currentSource=true. Snapshot registration and native factory capture retain their default path. At a structural container the walker bypasses the supplied object's historical certificate, gathers current retained-membership support and negative-domain views, then descends backing storage. At a writable native leaf it combines current nativeViews support with the supplied opaque object's snapshotViews certificate, then stops. This is a conjunction: neither clean payload history nor clean holder support overwrites the other. Requirement deduplication is by identity after collection, not by dropping roles.

Absent membership returns after collecting path support, before descending the absent subtree/payload. Existing entity dispatch still precedes generic traversal: top-level nativeInputs uses entity captureInput; nested suppliedViews uses entity captureViews. No new entity normalization or admission is introduced. These are source findings, not executed absence/entity qualifications.

lifecycle.ts:163 now returns an empty relevance mask when the retained requirement is not ready. nativeRequirementReady at 122 checks unfinished and unactivated membership recursively over components. Thus the guard covers both finalization and activation, not merely proof presence. It prevents this admission from projecting historical roles out of an unresolved predecessor; it does not silently defer cleanup until later. Useful cleanup can require a later fresh admission. Current invocation validation/protected-owner rules remain separate. No new terminal outcome policy is introduced.

No cache invalidation, materializer, snapshot identity, updater invocation, or error-handler code changes in R1. The walker reads structural supplied properties but stops before inspecting opaque payload properties; WeakMap lookup itself does not invoke payload getters. Ordinary materialized containers use data properties (utils.ts builder). There is no added catch that swallows/replaces caller exceptions. This does not prove that every possible materialization/reentry schedule aligns supplied values with later current support: values are acquired before beginBranchInput. Exact capture interleavings remain a focused qualification item, not a demonstrated new defect.

## Fixtures and actual evidence

FIXTURE-CORRECTION.md is justified by the preserved source diff: precisely two recursive callback returns change {} to the exact supplied value. Whole-branch omission is not an identity/no-mutation recipe. No assertions were removed. Such corrected routes can perform a later equal admission; the separate original report-route regression returns {} on updateAndReport and intentionally performs no subsequent source write, preventing that admission from hiding a missing capture.

Author after-first raw log: four files, 18 actual tests pass, exit 0/no timeout/sourceUnchanged. Opaque-independent-first: one file, four actual tests pass, same result metadata. I inspected tests, results and raw opaque observations; I did not replay them. Main is replaying independently. No broader/type results claimed.

The independent opaque fixture is useful: names r only and s only each throw after-callback contradiction; naming both succeeds. It settles the sole named owner first, observes no send, then settles the other and verifies exactly [7], settlement, payload identity, unchanged owner inspection and disposal cutoff. This independently tests both directions of missing responsibility. The saved-before-q case preserves payload identity and permits a saved clean certificate without retroactively importing later source q. It does not bless omission of a pending current holder obligation. Three current-validation cases retain nested confirmed-handle completeness and pending-at-capture/entry validation after confirmation.

## Bounded next qualification (not run here)

1. Preserve/replay original fresh-input and all opaque controls unchanged, plus ordinary source/spec types. Do not weaken either contradiction or useful delivery assertions.
2. One absent/restore branch control and an existing nested entity/field capture control: unchanged dispatch must retain membership/lifetime evidence, settle usefully and avoid duplicate sends.
3. One supported materialization/reentry case and one exact thrown-sentinel case: establish supplied value/current certificate alignment at acquisition, exactly-once callback behavior and unchanged exception identity. Do not invent arbitrary private monkeypatch reentry. Compare to the frozen predecessor before attributing any existing mismatch to R1.
4. A retained predecessor whose validation/activation horizon is still open: no early relevance cleanup; fresh validation survives; a subsequent closed fresh admission can still make the approved no-write progress. Recheck approved A/B, old issued snapshots/active receipt dependencies, and bounded retained roots on final composed C28. R1 alone does not establish those broader gates.

These are finite missing qualifications, not reasons to infer failure. The runtime delta implements the reviewed private fresh-container/opaque-leaf handoff without an observed API or policy expansion. Broader acceptance remains gated on the outstanding checks.
