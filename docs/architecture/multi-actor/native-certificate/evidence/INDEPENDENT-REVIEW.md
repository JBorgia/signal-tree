# Independent native certificate review — 2026-10-29

Disposition: this exact frozen candidate does not realize DESIGN completely. No
candidate acceptance or runtime edit. RESULTS.md was not read. The IDENTITY status
was visible while verifying the requested artifact, but conclusions below use raw
source and reproduced assertions.

Identity: baseline 87ddcfdedcb5d91e700d812bd6cbee2f77038510;
SOURCE-SHA256.json 51554d3192ae20bcf2e3a39cfa0e1daf2d22d2a883f963fea9b7108b343cf7f3;
runtime.patch 9d3ea485789f9b9c8aac08b9f502e94c341f0217159934a6c2bbbab01acaa3e0;
source.patch 2c6a45790d634f8d5d9ebc2291eb5293193068e97abd905c910536b33caf6002.
All 2,915 source-manifest entries matched before and after replay. All 26 evidence
manifest entries, five source mirrors and three original fixture hashes matched;
original fixtures also matched the baseline copy.

## Executed observation

From /private/tmp/st-projection-certificate-successor:
NX_DAEMON=false NX_ISOLATE_PLUGINS=false
NX_WORKSPACE_DATA_DIRECTORY=/private/tmp/st-native-independent-nx-data
NX_CACHE_DIRECTORY=/private/tmp/st-native-independent-nx-cache
pnpm nx test kernel --skip-nx-cache --output-style=static --
core-independent-review.spec.ts native-certificate-successor.spec.ts

Exit 1, 5 pass / 2 fail. Raw output:
/private/tmp/st-native-independent-reproduction.log
The missing archived tsconfig warning preceded actual executed assertions; this
was not a blocked test run. Node 24.15.0 / Vitest 4.1.9.

Both failures: q holds nested collection support, then an independent root write
omits its ancestor and sets other=1. The actual tree is {other:1}, but outgoing
messages remain [] instead of [{other:1}]. The restored-collection fixture fails
at omission, so its later restoration assertions are not evidence of correctness.

## Source-grounded findings

1. Completeness/occurrence enrollment gap. private.ts:365-377 only enrolls retained
membership paths with a nativeMembers requirement. Aggregate traversal returns
at an entity publication binding before ordinary writable-location indexing.
registerCollectionProjection (337-341) stores collection entries without indexing
its ancestor membership path. prepareMembership (208) skips recipients lacking
slotNode(b,address). Thus an initially clean branch containing only a collection
can be selected in outgoing payload/support without enrollment for its first
omission. This violates DESIGN representation step 4. It is not merely an incorrect
collectionSelected predicate; the event needed to change completedPresence never
becomes a recipient unit.

2. Point work is not demonstrated. selectedReady (186-192), called inside each
pending-unit iteration at 223, walks completed presence, fields and selected
collection entries; nativeRequirementReady recursively walks composite components.
The all-ready case visits the full selected domain even for a point change.
watchFact (163-169) calls rebuildEnrollmentSummary (158-161), a full field/presence
walk, once per notifying enrolled fact. This is source-level scaling evidence,
not CPU, timing, memory or ceiling measurement. Collection entry proof adjustment
is indexed, but that does not make the surrounding readiness path point-local.

3. Listener implementation is asymmetric. setCollectionEntry (175-183) cancels
old listeners and checks the exact entry still occupies its key before updating.
watchFact checks only the binding's shared watches-map identity, updates a fact,
and rebuilds the summary; there is no equivalent selected-slot/generation check or
replacement cancellation hook. dispose (411) releases watches and deleted bindings
suppress later queued wakes. The readiness test covers explicit unsubscribe, not
actual field/occurrence replacement before close. No stale-visible-state corruption
or measured leak is claimed from this inspection; replacement lifecycle completeness
is not established by that test.

4. Positive but bounded evidence. lifecycle.ts separates readiness from computed
proof presence (76-100), finalizes all horizon requirements before notifying (269+),
and releases composite dependency listeners. Replayed scalar/membership enrollment
and composite tests pass. private.ts scalar and collection acquisition now compare
exact channel tokens (282+,303+); acquire (384) restores the outer ingress object
and therefore its consumed collection set. These hooks agree with DESIGN's authority
separation. Supplied peer tests cover equal/full incoming collection changes in one
enrollment order; nested-acquisition and reverse-order coverage is not established
by the focused tests inspected.

Raw final spec-types log remains red: original optional-branch fixture has two
errors; the unchanged terminal-consumer fixture also calls the now-five-argument
registerCollectionProjection with four arguments. Source typecheck success is not
spec-type success.

## Can one mandatory enrollment + indexed contributor lifecycle express this?

Yes as a bounded design interpretation; no concrete counterexample found requiring
separate field/collection correctness mechanisms. Enrollment must be mandatory for
every selected native occurrence, including currently clean ancestor membership,
with exact occurrence identity, ancestor incidence, payload selector, selected flag,
requirement references and a releasable listener/generation. Field and collection
paths may supply payload/contributor adapters, but must not independently decide
whether an occurrence participates in lifecycle enrollment.

An index can replace selected contributions by subtracting their previous proof and
readiness count, install the new occurrence/payload/support together, and notify
only affected recipients. Initial discovery and an actual subtree omission may
visit that affected subtree; this does not justify all-selected-domain scans on
every unrelated point mutation. Source-owned recovery requirements survive an
occurrence leaving outgoing selection. Consumed-input dependencies must remain
separately attached to surviving authored work.

Concrete counterexample to naive subtree pruning (not to the role-aware design):
p copies q's nested value into surviving root y, then omits q's ancestor. The nested
payload contribution leaves selection, but y's consumed q dependency must still
hold publication. Likewise, same typed address with a new lifetime cannot inherit
old listeners or acquiring-connection authority.

This is an implementation gap consistent with DESIGN, not a proof of that design's
sufficiency. Because a specifically required boundary recurred after implementation,
apply DESIGN's recurrence rule: preserve this candidate and obtain a focused
mechanism-sufficiency disposition for mandatory enrollment/indexed replacement
before resuming fixes. Do not accumulate another collection-only guard or treat
passing narrow tests as authorization/acceptance. No successor was created.

## Prior protocol/HTTP review follow-up

Owner's corrected protocol was independently replayed unchanged review tests:
9/9 pass. /private/tmp/multi-actor-protocol-review-fixed.txt and
/private/tmp/multi-actor-protocol-review-fixed-sha256.txt identify that replay.
Initial two protocol failures remain /private/tmp/multi-actor-protocol-review-first.txt.
HTTP independent tests remain 4/4 pass after approved loopback escalation;
/private/tmp/multi-actor-http-review-approved.txt. Initial EPERM is separately saved.
