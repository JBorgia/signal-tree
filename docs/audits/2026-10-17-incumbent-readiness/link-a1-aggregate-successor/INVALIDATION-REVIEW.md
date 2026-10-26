# Independent D3 invalidation-containment review

Read-only review, no tests rerun or source edits. I did not implement the D3 adapter change. My presence work is not reviewed here. I inspected source/diff, test bodies and FIRST.log before reading any result summary; RESULT.md was not needed.

## Verified result and source identity

`FIRST.log` records three focused files, **45/45 passing**: unchanged heterogeneous-independent-invalidation, new heterogeneous-invalidation-containment, and existing tree-realization-adapter tests. The two full source manifests compare equal (811 files, also independently compared their JSON). Current adapter bytes equal archived adapter-after.ts.

SHA-256:

- adapter-before.ts `167803fd47bfa52469f125f7fcddae8c5a84842f52f41b9ef8fff252d52226d0`
- adapter-after.ts/current `5f8eca17ba6da9f33bc18442ec2cc3a4aeaa01cab5c70ef0eec7733542e067d3`
- unchanged original spec `a22e7978157eb600c6d87ee7567f64a2b36fb069d7152c6bacacaf2377f85544`
- preregistered added spec `6275794c45a003ec6330cfd31822e7dcc35134751fc8f3868a42e7871ce2ab02`
- FIRST.log `0753e1dc4edf0c6bac1dc33bf3f418533f47121a259dece26eddc4586c83010d`

## Source correctness within the changed boundary

`planHeterogeneousFrame.invalidate` now attempts every live-point invalidator, then mixed scalar publishPrepared, retaining the first caught value with a separate boolean. This preserves even thrown undefined/null identity; it does not use truthiness as an error sentinel. Later errors cannot replace the first. There is no broad catch around preparation/installation and no attempt to report successful settlement after failure.

Its direct `commit` wrapper runs install first; after successful install, it attempts invalidate and publish independently, then rethrows the first failure. Thus a failed invalidation no longer suppresses the already-installed heterogeneous frame's public row/order/path delivery. Existing `publish` already continues its individual plans and retains its first failure. The patch adds no new inverse selection, projection authority, snapshot or collection traversal.

The composed `preparePointRealization` structural path separately owns an outer continuation wrapper (adapter774–804): it attempts heterogeneous invalidation, member invalidation, member publication and heterogeneous publication despite errors. The D3 change closes the formerly fail-fast inner live-point loop under that wrapper.

## What the added assertions actually prove

Both new/unchanged witnesses use controlled private `__preparePointValues` wrapper faults **after** calling the original invalidator; these are not ordinary-input throwing-callback reproductions. The new test checks exact primary Error identity, two distinct subject invalidation attempts, mixed scalar invalidation once, all restored visible values, and both row update taps. These are useful effects, not merely nonthrowing callbacks. Two distinct sentinels establish precedence; the original assertion remains unchanged.

These public undo witnesses exercise the composed selected-point path used by restoration. They do not, by themselves, execute a directly invoked adapter.applyAtomically path with this injected invalidation failure. Existing adapter suite ordinary successes are useful regression coverage, not direct fault coverage for the newly changed commit catch.

## Limits and remaining containing-boundary gap

**No blocker found in the two changed inner mechanisms for their stated scope.** Accept the bounded D3 result: installed heterogeneous live-point/scalar invalidations are attempted, and its own direct commit attempts its own publication while preserving first failure.

Do not expand that claim to every installed obligation in every outer adapter route. Source still shows a containing direct-route gap: adapter.applyAtomically installs `members` before `heterogeneousFrame.commit` (`609–613`), then calls `members.publish()` only after that commit returns (`624`). If heterogeneous commit reports an invalidation/publication error, its own heterogeneous delivery is now attempted, but the already-installed plain-member publication is skipped in this direct route. The composed path has the separate continuation wrapper; direct applyAtomically does not. This is source-derived, not a newly executed counterexample, and the current added fixture has no plain-member target. A focused direct adapter test combining member target + structural/live point with the existing invalidation fault is needed before claiming full containing-unit obligations. Do not relabel the current45 passes as covering it.

Likewise this patch does not make structural plan installation callback-free, solve early rich-capture reentry, or qualify pending entity publication. Installation failure remains outside the new post-install containment wrapper; that is an explicit scope limit, not proof that partially installed state is safe. No new broad suite, framework, artifact, performance or GC result is claimed.
