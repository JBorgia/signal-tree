# Paired-boundary successor: source proofs and remaining leaf handoff

October 26, 2026. Continuation of the [finite design review](../complete-operation-design-review/README.md) at 303aa198. Frozen rejected source `f01ed39a7df8a5de185ebec0773e09e36537dacb`; production `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No runtime/model/test/build/performance execution or implementation occurred. B remains closed.

**Disposition:** the private paired-boundary extension has a concrete, independently reviewed interpretation for complete contiguous endpoints, pre-reentry order admission and the specified noncontiguous inverse cases. It is not an accepted native successor. Leaf membership still needs its producer-to-event association specified before first reactive publication; modifying notifier delivery alone cannot establish that property. The recurrence stop remains active.

## What this continuation establishes

- The source's current structuralRecords are not uniformly physical: they come from ordinaryPlan.changes but are paired with a physical frontier. Ordinary-only transitions can also be dropped by physical-frontier-only subscribers. A successor must sample separate prepared P/O placement pairs and carry their provenance explicitly, not rename the existing array.
- A paired source record can carry complete membership/key/adjacency facts without another journal. Proposed current ordinary tokens have no historical back-pointer; existing OperationRecord, capture buckets and history claims remain the retention owners. This is a design, not a measured resource result.
- Order responsibility must be admitted during terminal installation, before capture callbacks can reenter. Otherwise actual own-A / foreign-B / own-C may be observed by the delayed order channel as B,A,C. Later projections must consume an already-admitted identity exactly once.
- Existing authority still selects effects. In the own-rekey / foreign-removal / own-fresh-same-key case, the erased old lifetime is not restored; the fresh owned lifetime is removed and scalar work rolls back. Occupied-destination refusal remains retryable after the foreign occupant is removed. Neighbor support never becomes authored order or payload authority.
- Subset-order restoration preserves ordinary B when inspection hides it: ABC→CBA has authored domain {C,A}, not newly owned B. The existing resolver applies that domain while preserving membership, payload and lifetime.
- Destruction already explicitly clears transactionOrderAdmissions. An initial trace missed the final clear; root verified transactions.ts4991 and the independent follow-up agrees. This is a corrected review claim, not a demonstrated leak.

## Packet and review boundaries

[MECHANISM.md](MECHANISM.md) is the unchanged initial proposal, hash c179bd743ad1c579a4938f9d5d8aacf7b6f618fe86e9ad9fdbce574b629afd69. [Independent review](INDEPENDENT-REVIEW.md) preserves its first two concrete gaps. [Admission and selection mapping](ADMISSION-SELECTION.md), hash faca98744b11e714c0361b0ddfe708846ea699e2b8269820318072834a982c42, addresses them through existing source/test paths. The [bounded follow-up](ADDENDUM-REVIEW.md) verifies those mappings without claiming execution or new authority.

[Ordinary continuity trace](ORDINARY-CONTINUITY.md) and [selection/retention trace](SELECTION-RETENTION.md) were separate read-only questions. The retention trace's original teardown caveat is retained as written but superseded by the correction above; it must not be quoted as a current defect. The final reviewer did not implement the candidate and did not read the other new review verdicts. Root supplied source sites and verified the resulting claims.

[Leaf producer mapping](LEAF-PRODUCER-MAP.md) is a later root source trace, explicitly outside the follow-up review's positive disposition. Whole-value application and held-path re-addition can call native membership publication before their final tagged notification. Existing partial-write, callback-reentry and primary-error semantics must survive any earlier evidence admission. A connection created during preparation differs from one created after installation. The precise private producer correlation remains unimplemented and unqualified.

## Unchanged acceptance and limits

The original compound-undo and bare leaf-Link reproductions, their assertions and hashes remain unchanged. The [slice-5 verdict](../slice5-integration-disposition/README.md) remains **79/84 gates, 66 ordinary kernel failures and four failed bundle budgets**, with expected failures and skips recorded separately. No new pass count is claimed. Stronger arbitrary-order settlement, performance equivalence, collectibility and release readiness are not inferred.

The source requirements now identify where a native successor would change private admission/composition, and where it must preserve existing inverse rules. They do not authorize runtime changes automatically. No production activation, API change, broader semantic rule, budget increase, merge, push, tag or publication. A notifier-only leaf patch or a physical-record relabeling would contradict this design.

Exact sources are listed in SOURCE-SHA256.txt; run `shasum -a 256 -c` against that file from the frozen f01ed39a checkout. Member integrity is recorded in MEMBERS-SHA256.txt. No completed experiments were repeated merely to acknowledge these findings.

## Documentation and identity verification

Node24.15.0 `node --loader /private/tmp/inverse-disposition-native/docs-loader.mjs tools/check-doc-links.mjs` passed: 778/778 links across 188 live surfaces resolve. The existing loader supplies semver from the main checkout; raw output is docs-links.log. `git diff --check` passed; all29 frozen source hashes match. Readiness `git diff --name-only 87f6831f -- packages` remains empty; rejected source is clean. These are documentation/identity checks, not new semantic evidence. Unrelated AGENTS.md and measurement-contract.md changes are excluded.
