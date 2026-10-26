# Declared Link release-scope decision

October 26, 2026. **Comparison complete; neither scope selected. Runtime stop remains.**

The [concrete comparison](COMPARISON.md) defines two finite scopes and their acceptance boundaries. Independent review finds it ready for a choice between design-only A0 and an explicit B0 product-contract revision, not for runtime implementation or release approval.

| Choice | What the next authorization would permit | What it would not permit |
| --- | --- | --- |
| A0: expand the design | Specify membership-aware operation admission, exact publication-support replacement/retirement and completion scheduling across the named native writers; freeze a reviewed transfer/lifecycle table and acceptance controls | Implement the proposed support map, resume old slices automatically, grant new public semantics or qualify costs |
| B0: defer declared early publication | Remove conditional early-progress from this release promise, document conservative Link behavior and reconcile the remaining release obligations | Waive separately approved inspection adoption/rollback semantics, claim current production is release-ready, treat drafts/outboxes as equivalent qualified replacements |

Under A, all three gaps are handled by one completed source-unit contract: membership work triggers admission independently of equality; payload support retains the evidence of still-contributing writes; completion registers and retires Link work even when the public event is absent. This explicitly replaces late snapshot attribution and whole-payload latest-ticket assumptions. It adds a publication-authority representation and writer preparation/lifecycle work. Calling it an enriched queue does not make that expansion free or already approved.

Under B, current production stays conservative and the experimental declaration machinery remains outside the product artifact. It removes a capability requirement, not a defect by relabeling it. Complete ordinary/physical capture, inspection adoption, restoration/publication, recovery and final qualification still have to meet their independently approved contracts. Deferral therefore reduces one scope but is not evidence that release is near.

## Decision recommendation

Do not approve the expanded runtime from the present evidence. If conditional same-tree progress remains essential for v16, the justified next investment is **A0 only**, with the exact added writers, support-transfer rules, lifetime bounds and expected outcomes frozen before a native experiment. If it can be deferred, **B0** avoids introducing that unqualified publication mechanism in this release, with the limitation made explicit. Product priority selects between them; neither test counts nor previous investment supplies that decision.

The engineering tradeoff is explicit. A benefits applications retaining live speculative proposals that need unrelated synchronization; they also own complete hidden-input declarations. Its new work and metadata costs must be measured for bare, populated and observed trees, including who pays when declarations are unused. B places the synchronization delay or isolation/reconciliation burden on those applications and avoids only the added mechanism; no production CPU, heap or byte saving is demonstrated here. Existing budgets remain binding under both.

Historical ownership architecture B remains closed; the letter B in this scope comparison means **deferral only**.

## Independent review and root verification

- [Deferral premise review](DEFERRAL-PREMISE-REVIEW.md) independently checked owner decisions, production source and historical qualification. Its key correction is retained: adoption requirements survive declaration deferral unless separately changed by the owner.
- [Expansion review](EXPANSION-REVIEW.md) independently challenged the source-unit design, new publication authority, writer scope, receipt/request lifetimes and finite gates. It finds the scope choice ready but A's implementation unapproved.
- [Exact reviewed draft](REVIEWED-DRAFT.md), SHA-256 `ea01813c38fe76dbcbb92271df4f1ae61fc7a5effb9b8f853205ae278d6b6145`, is preserved. The final comparison clarifies publication authority, separates historical architecture B from option B, and makes the review's receipt/in-flight and covered-path interpretations explicit. These clarify existing gates; they do not close A0's missing transfer rules.

Root verified production source has no experimental declaration method and remains unchanged in the package diff from production87; checked the controller's explicit independent scalar adoption decision and archived contract selection; and verified the cited value-preparation/re-add, latest-fact supersession, receipt cleanup and held-send scheduling branches against the frozen source. Reviewers were not given a preferred selection or one another's new verdicts. No runtime/model/tests/build/performance campaign ran for this comparison.

The [prior boundary record](../membership-admission-design/README.md) preserves the source-derived gaps. The earlier [full qualification](../slice5-integration-disposition/README.md) retains the executed compound-undo and leaf-Link differentials. The recent gaps are not recast as newly reproduced tests. Rejected f01's 66 kernel failures and four failed budgets remain that candidate's evidence; production87's separate readiness and artifact obligations remain separate. Neither source equality nor this documentation review is release verification.

## Provenance

Starting documentation HEAD: `cebfcd4ae050403452c3dda1e4373a27331d9ab9`.
Runtime: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
Rejected integration: `f01ed39a7df8a5de185ebec0773e09e36537dacb`.

[Source hashes](SOURCE-SHA256.txt) refer to Git contents at the starting documentation HEAD; the controller is subsequently updated only to link this unselected comparison. [Identities](IDENTITIES.json) and [packet hashes](MEMBERS.sha256) preserve exact evidence. Raw files remain at `/private/tmp/link-scope-comparison`. Documentation-only validation is saved in `VALIDATION.txt` and `DOC-LINKS.log`.

No runtime change, activation, new API, semantic selection, budget increase, merge, push, tag or publication. Unrelated `AGENTS.md` and measurement-contract edits remain untouched.
