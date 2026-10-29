# Ancestor updater / descendant recipient oracle review

2026-10-29. Read-only interpretation review. No assertion, runtime, or archived result changed; no test run. Inspected the unchanged fixture in frozen `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`, current successor source, and raw `006-core-seed-aggregate.log` plus `007-aggregate-frozen-baseline.log` under `/private/tmp/link-collection-proof-evidence`.

## Classification

The failed **no-send-until-unrelated-p-drains** assertion conflicts with the subsequently approved recipient-only fallback rule for this exact wider-ancestor case. It is not, by itself, a speculative-input safety counterexample. Preserve it as a historical oracle conflict; the test is still failed, not passed or waived.

Supported outcome: after the native operation and declaration horizon complete, `{x:1,y:0}` may use the coherent tree-local ordinary fallback while the unrelated foreign p remains pending. Descendant recipient coverage being incomplete does not create an actual foreign dependency or a new possible-owner window. That incomplete coverage must still deny a **declared** grant; the authorized immediate route is surviving-basis fallback. The current logs prove a send occurred but do not establish its receipt/basis or the rest of the original test's assertions, which were not reached.

## Exact fixture and observed failure

`packages/kernel/src/lib/aggregate-installed-publication.spec.ts:126–134` creates t with all zero values, connects c to t.pair before creating foreign p, and opens p on another tree's z. It then declares an independent root updater:

`input => ({...input, pair:{x:input.x+1, y:input.pair.y}})`.

All supplied root input values and memberships are t's ordinary initial facts. The callback neither reads nor names foreign owner.z. It supplies a full root snapshot domain, not an arbitrary cached application getter. Pair.x becomes1; pair.y remains0. No owned/inspection/unknown-native source fact is established by this fixture.

Both raw logs fail at line131: received `[{x:1,y:0}]`, expected `[]`. Frozen aggregate result is14 passed/1 failed; successor combined result is46 passed/1 failed. These are their separate observed vectors, not a combined qualification count. The receipt assertion and post-p.rollback useful-send assertion occur after the failing no-send check and therefore provide no executed evidence in these runs.

## Authority and why the older premise no longer determines the answer

1. Aggregate authority, preserved at readiness `3c8bbaff` in `link-a1-successor-design/AUTHORITY.md:14–20`, says: “Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.” Actually consumed inputs, transaction authorship and enclosing validation remain lower bounds. The outgoing pair's small width does not redefine the root updater's native supplied-input domain.
2. The reviewed native observation design at `7f2def3d3318f36e05724fee8ec13f01d4d9261b`, `link-membership-observation-design/DESIGN.md:27–38,63`, assigns the full recursively supplied snapshot/membership domain to the source. “Enrollment supplies neither native input facts nor origin.” Native source certification and recipient coverage have different owners.
3. That same design's fallback table at approximately163–171 explicitly allows supported tree-local ordinary fallback for “Complete native evidence AND applicable complete declaration for other authored inputs, recipient-only coverage unavailable,” while denying a declared grant from missing coverage. At approximately197–200 it identifies the exact wider-input case: “The sixth wider-native-input case is different: a complete native descriptor and complete application declaration can exclude unrelated foreign input even if the recipient itself lacks coverage. That case must retain its adjudicated fallback.”
4. Owner authority at `75c645eb71e4a03e5c84491ce8078debfe797e19`, `link-membership-observation-design/AUTHORITY.md`, expressly preserves this distinction: “Recipient-only uncertainty retains its adjudicated fallback and cannot impose another connection's hold.” The selected possible-owner policy applies to unobserved undeclared origin; it does not turn recipient width into missing native provenance. POLICY-DECISION.md likewise preserves useful progress for a complete truthful declaration plus complete native-input evidence.

The older fixture was last changed by rejected aggregate archival commit `2d71d73305fea23173b3b681c2a897ef1a7dffba`. Its title correctly warns against borrowing sibling recipient proof, but its no-send expectation additionally assumes all uncertainty requires foreign-p hold. Those are different claims. The approved source-owned certificate removes the need to borrow a sibling recipient's proof; the recipient may still lack its own declared coverage and use surviving fallback.

## Source correspondence, not a passing result

Frozen `experimental-publication/private.ts:77–114` owns native values/views independently of bindings, captures full supplied snapshot views recursively, and preserves snapshot-specific certificate references. Its factory initializes native source requirements at `:120–123`; `beginBranchInput:138–148` captures native inputs separately from per-recipient width/coverage. `lifecycle.ts:90–96` initializes known clean inputs and applies a new window according to native input/declaration completeness, not passive enrollment.

The fixture's descendant coverage still sets unknown: `private.ts:141–147,233–236`. `prepareRevision` keeps coverage local instead of installing it into shared validation (`lifecycle.ts:158–173`). At `private.ts:303–319`, unknown denies early declared permission; pending actual/possible requirements prevent fallback; otherwise the existing ordinary gate can grant the current revision. `started:320` reports that route as surviving. The current successor retains this scalar coverage path; its collection changes do not independently justify reclassifying recipient width.

This supports the permitted-route interpretation but does not verify that every native producer/certificate is complete. A missing certificate must not be silently treated as empty; a real pending sibling, inspection-derived input, inherited W, or invalid horizon still blocks or contradicts according to its role. In particular, changing t.x to a pending7 before this updater is a different safety control: source-native evidence must retain that lower bound even though c observes only pair. The unscoped direct-copy control is also different because it lacks complete declared hidden-input responsibility.

## Closure needed

Keep the original failure and source identity in the verdict ledger. If the owner/controller permits a separate adjudicated control, it must assert the immediate payload **and** surviving basis, foreign p unchanged/pending, complete native argument capture, and no extra send after unrelated settlement. Preserve sibling-pending/inspection/validation negative controls alongside it. Do not simply reverse the existing assertion or count the current red as green.

No new public policy decision is needed to interpret this exact fixture: the approved policy already distinguishes recipient-only coverage from native unavailability. Remaining qualification is proof/basis evidence for the actual implementation, not a license to suppress unknown native requirements.
