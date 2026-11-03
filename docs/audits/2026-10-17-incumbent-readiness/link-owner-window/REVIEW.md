# Independent implementation review

No production edits or repairs. Reviewed `/private/tmp/link-owner-window-impl/private.ts`, `loader.mjs`, `window.ts`, loaded Link and PathNotifier sources. Independently replayed frozen `first-window-bundle.mjs` and `targeted-bundle.mjs` using Node24.15.0. Entire JSON outputs exactly match saved first-window and targeted traces. Raw independent outputs: `/private/tmp/link-owner-window-review-replay.json` and `/private/tmp/link-owner-window-review-targeted.json`.

## Decisive failure reproduced

P opens; y42 is authored with blocker[P]; Q opens on unrelated z; y99 then y42 are authored in one batch with blockers[P,Q]. P confirms: no delivery, correctly. Q confirms: still no delivery, incorrectly; expected endpoint[42].

For the ABA tree(owner6), receipts show y revision21 blocker[1], followed by revisions23 and24 blockers[1,2]. Both terminal confirmations are recorded. This is not missing terminal recording.

`private.annotate` updates latest(y) at enqueue to revision24. Link's researchFact updates only in its PathNotifier subscriber (`link.ts.loaded:692`). PathNotifier deliberately suppresses net-equal coalesced entries (`path-notifier.ts.loaded:506`): 42→99→42 has newValue===oldValue, so the subscriber never sees revision24. Link retains revision21. Both ordinary admission and terminal wake require `latest.get(key)===researchFact`, so no wake can release the stale ticket even after both blockers confirm.

This is an eligibility-evidence transport mismatch across value-notification coalescing. The value payload itself is correct; newer responsibility identity has changed despite equal values. Do not remove the revision check or weaken net-equal observer semantics to hide it. Stop this candidate as its prewritten rule requires; no repair selected here.

## Other observed results

Owner-window run: 46 assertions,45pass/1fail, across11 asserted scenarios, plus1 cross-tree boundary witness. Direct, reactive, multiowner, rejected-then-new authored revision, ordinary overwrite, opened-listener, reentry, refusal, restoration-exclusion and foreign-attribution controls have no failed checks.

The direct/reactive cases establish useful narrow progress: a later unrelated transaction may remain pending after earlier captured blockers confirm. They do not establish independence from owners already pending at authorship.

Cross-tree witness sends7 while the other tree's source transaction remains pending. That is not a same-tree success: it demonstrates why this mechanism cannot be adopted as globally safe publication classification. User approval of ordinary post-rejection writes does not approve copying still-pending cross-tree speculation.

Unchanged targeted delivery run:34checks,32pass/2fail. The two failures are the retained historical `unknown-confirm` oracle: it expects no send and unsettled waiter after confirmation, but the new mechanism sends42 and resolves the waiter. This is the explicitly proposed all-confirm behavior change, not either previously repaired delivery defect. Preserve the old assertion/results and use separate new expected outcome; do not report34/34 unchanged checks pass. Reentry, held/eligible in-flight serialization, coalescing, explicit disposal, equality, callback-error and endpoint-error observations otherwise match exactly.

## Limits retained

At completion diagnostics retain sources13, outcomeTrees13 and latest36 with listeners0. This implementation unregisters connection listeners but does not qualify resource reclamation; its maps retain tree source closures/outcomes. No retention acceptance follows from teardown.

Snapshots and fact arrays are frozen and source registration uses per-tree identities; terminal outcome reversal throws rather than mutates existing outcome. These are source findings, not an exhaustive attack qualification. No production suite, native framework, entity, benchmark or destruction migration tested by this review.

The candidate earns a capability result but fails its defined mechanism conditions. Keep production hold; do not select an API or extend the policy menu from this result.
