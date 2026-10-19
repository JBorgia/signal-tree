> UPDATED DISPOSITION: positive bounded finding withdrawn pending full-kernel failures. Full kernel log reports 72 failed / 5763 passed / 5 expected failures / 12 skips. Earlier review retained below as superseded evidence.

# Independent restoration review

Initial review base d832058c120f560bfb995fc55de3fd43d99d40ed; final reviewed checkout HEAD e9653a4198b4b2f048ec2659673efbc97ae88d34 after rejected Link checkpoint/revert. Candidate hashes verified below. Reviewer read source and raw logs; no reviewer test/build execution or repository edits.

## Disposition

No further concrete blocker found for the bounded order-endpoint composition repair after the ordinary multi-removal correction. Proceed to broader affected qualification, not release acceptance. This finding is independent of the separately rejected Link dependency candidate.

## Preserved review failures

Initial candidate cleared capture authority before fallible endpoint preparation. Final prepareCaptureBucket constructs the result without clearing; drain clears only after preparation succeeds. Pending bucket deletion likewise follows successful drain. This corrects the identified destructive ordering; it does not establish universal allocation-failure recovery.

Independent ordinary-input counterexample: from [A,B,C,D,E], one designated turn removeMany([A,C,B]), then reorder survivors [E,D]. Native removeMany records pre-frame neighbors in caller order. Reverse-array restoration attempted B first while A/C were absent. The helper threw and no undo turn was recorded; visible order remained [E,D]. First failure is /private/tmp/st-r1r2-20261019/review-multi-removal-first.log; pre-review helper archived beside it.

Final helper replaces reverse caller-order execution with per-frame indexed dependency readiness. Departures are removed first; insertions become ready when a predecessor/successor exists, awakening dependent placements. Empty restoration seeds only a frame-local chain. This addresses the failing mechanism, rather than recognizing tested IDs. The original example, all six A/B/C permutations, disconnected removed runs and repeated undo/redo held-reference controls are preserved.

Read focused-reviewed-final.log: eight files / 124 ordinary passes. First-candidate six formerly expected-failure successes and six obsolete characterization assertions remain separate archived evidence, not silently rewritten historical passes.

## Mechanism and scope

Admission captures touched structural identities/placement facts and frontier tokens before installation; observer retention remains post-install and contains errors. Explicit order endpoints are extended only across matching tokens, avoiding replay of membership already enclosed by setAll/prepend. Whole-order materialization occurs at drain, where explicit reorder legitimately processes its supplied order; indexed placement avoids repeated full-array searches per touched record. Source inspection supports O(order-size + touched records) work for the helper, not a full runtime performance guarantee.

External membership-between-orders control and existing drift guards prevent the tested adoption of foreign truth; no new canonical authority or weakened ST1034 rule is introduced. Frontier checks alone are not a proof of every interleaving; full suites remain required.

## Failure boundary limitations

The historical-preparation fault test injects a helper throw, retains capture, then retries after a later ordinary notification. It proves that retained evidence is not erased at that boundary. It does not prove immediate retry of every lifecycle event. A foreign staged notification is one-shot: retaining its bucket alone does not rematerialize a missed history entry automatically. Do not claim that injected staged failure is repaired, or universal post-install allocation recovery.

Helper missing-subject/repeated-subject/missing-anchor exceptions are invariant checks. The previously ordinary reachable missing-anchor example was reproduced and fixed. I found no additional ordinary reachable malformed-evidence case in the reviewed source, but did not run an exhaustive model. Supported correctness and controlled fault claims must stay separate.

## Exact source receipt

```text
4beae5709949a6eafbe8a0e003958f846048d668d42ff2e9934acaf54684e14a  packages/kernel/src/enhancers/restoration/restoration.ts
f86b63862d73df0a64e0b11ddb4ae11380c350710e739e265109dc334594537a  packages/kernel/src/enhancers/restoration/order-boundary-evidence.ts
8fa3e52b4b1ced40401632bee7c9926e5b3cf41095e49c5ec16e0bf21ebd1904  packages/kernel/src/enhancers/restoration/order-boundary-evidence.spec.ts
6b986b4713189ce6845c6e21be84b5b2378bde4f7efd372d144daba7b8aa095c  packages/kernel/src/enhancers/restoration/order-composition-readiness.spec.ts
b2a276d9dcb73b8e1dedf09e544a392a3b6f8aae73bc1c7d924154929b72d76d  packages/kernel/src/enhancers/restoration/reversal-known-limitations.spec.ts
2704b7353a419acee3a661afbc9dc8aa917f523f701759927acac36c429cbc54  packages/kernel/src/lib/entity-signal.ts
011aeea5cc9227df21ec63ebe073681dfab4946932215c8f6052a9392ad4ba91  packages/kernel/src/lib/internals/mutation-capture-runtime.ts
```

## Final seven-file check

Reviewed all seven receipt files, including original desired restoration assertions now ordinary tests and obsolete refusal characterizations archived separately. The assertions requiring successful restoration were not weakened. Read first ordinary multi-removal failure (1 failed / 14 passed) and final reviewed focused result (124 passes), not merely summaries. Existing external-between-orders control accepts only either preservation of external truth with restored authored order or atomic ST1034 refusal; it does not claim broad interleaving success.

Final onFlush prepares both authored and historical channels before clearing either and retains selfDirty through preparation failures. This directly addresses second-channel failure. Failures after clear in addEntry/createPendingEntry remain outside the newly tested preparation guarantee, as does one-shot staged-event replay. Do not characterize all capture/allocation failures as recoverable.

No broader release qualification is warranted while independent Link progress remains blocked. Affected restoration/type checks can qualify this separate bounded checkpoint.

## Full-kernel qualification and exact-baseline correction

Root supplied full kernel log: 72 failed / 5763 passed / 5 expected failures / 12 skipped. Positive disposition withdrawn pending attribution. Read exact d832 five-group baseline log `/private/tmp/incumbent-d832-five-groups.log`: 60 failed / 294 passed, consisting of the same 56 membership-reversal publication failures and four detached-history frontier failures. Those 60 are pre-existing at d832, not introduced by this ordering candidate. Their earlier readiness evidence was insufficient and they remain real runtime blockers.

The candidate adds 12 observer-lifetime failures: unconditional subscribeCommittedEntity installs a persistent observer, contradicting existing pending-active-entity/pending-footprint controls requiring no idle listener and release after terminality. This is a concrete pay-for-use/lifecycle regression, not unsupported observation or a harmless fixture. The new mechanism needs structural evidence without falsely broadening or perpetually retaining committed admission observation.

The four history failures occur in getRestorationHistory detached materialization after native undo/redo succeeds; 56 membership cases expose partial rollback snapshots to membership readers. They are distinct from the earlier removeMany anchor scheduling failure. Baseline attribution forbids using their recurrence as proof the new dependency-graph repair failed. Conversely, unchanged origin does not close their release blockers. No new tests executed by reviewer.

## Corrected observer/history candidate final review

Verified all seven qualification-final-hashes entries below. Read history-origin-final.log (160 ordinary passes) and reviewed two subsequent channel/reentry controls (channel-controls-first.log, 24 ordinary passes including existing composition cases). Runtime hashes unchanged between those runs; test hashes recorded separately.

Dedicated structural boundary observation only enables frame observation when a structural frontier exists. The new test asserts field-only updates invoke neither boundary listener nor publishCommittedEntity, structural addition invokes each once, and destruction releases listeners. This substantively verifies pay-for-use beyond the old observer boolean.

Both order and boundary capture exclude origin restoration, matching pre-existing value-notifier exclusion. This prevents replay becoming a new historical gap, without blanket isRestoring suppression. The reentry control explicitly marks an application-origin order during restoration delivery, proves it survives, and usefully undoes it. That explicit-context control is not a new claim about all implicit callback provenance. Four baseline history errors and twelve new lifecycle errors pass supplied checks.

No further concrete blocker found in these precise corrections. This supports the bounded restoration checkpoint, contingent on affected gates; combined release remains blocked by independent Link dependency requirements and separately verified membership publication. Controlled staging/allocation limitations recorded above still apply.

```text
c8eff760937ac975de308013ca891afe2ebedb3249a20ed5e735dffe9f8eef7a  packages/kernel/src/enhancers/restoration/restoration.ts
f86b63862d73df0a64e0b11ddb4ae11380c350710e739e265109dc334594537a  packages/kernel/src/enhancers/restoration/order-boundary-evidence.ts
8fa3e52b4b1ced40401632bee7c9926e5b3cf41095e49c5ec16e0bf21ebd1904  packages/kernel/src/enhancers/restoration/order-boundary-evidence.spec.ts
191ddb595f21164fcea6ee2be6ea03986d089a55cd926a52e1ade8451ba38c27  packages/kernel/src/enhancers/restoration/order-composition-readiness.spec.ts
b2a276d9dcb73b8e1dedf09e544a392a3b6f8aae73bc1c7d924154929b72d76d  packages/kernel/src/enhancers/restoration/reversal-known-limitations.spec.ts
4459d2ad9dfdf690388ce38f8421234ae8bb3a10266b65125287388cc674aebc  packages/kernel/src/lib/entity-signal.ts
3f2621c3d489d6cb04356bb6cac3b68b46f9587ea82a380316f56098e9a1c88b  packages/kernel/src/lib/internals/mutation-capture-runtime.ts
```
