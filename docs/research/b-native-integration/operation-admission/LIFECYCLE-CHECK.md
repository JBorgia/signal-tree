# Ordering responsibility: finite design check

Source checkpoint: `9eb83bbbc494c56517e2817b1c0f2f799da6eab3`.
Date: October 17, 2026. Design analysis only; runtime and regression assertions
remain unchanged. B and the operation-admission implementation remain rejected.
This check does not select a representation or authorize another integration.

## Binding premises and evidence

Owner instruction in this task:

> “Observed topology remains preparation input unless the operation explicitly authors it.”

> “Rejecting transaction 1 should refuse atomically and retain both transactions’ authority unless the implementation can preserve that dependency through an already-defined settlement rule.”

> “Explicit full-order operations, which may legitimately describe many entities”

> “Append/prepend operations, which should not reconstruct dependencies for every existing member.”

Repository contributor contract at the source checkpoint:

> “Framework packages may realize SignalTree truth for their runtime. They must not create another state authority.”

These premises constrain the investigation; they do not answer creator-payload
survival. The seventh audit assertion remains outside the established-failure
count. Stable v15 and the approved v16 complete-installation-before-callback
contract remain unchanged.

Executed evidence is inherited from README.md/EVIDENCE.md, not rerun here:
31 focused passes, stale terminal-order failure, unresolved payload assertion;
four original replays pass. Map-constructor input counts are 8,256 / 32,896 /
131,328 for 128 / 256 / 512 same-author appends. They measure construction work,
not CPU, total allocation or retention. No new runtime or benchmark result is
claimed in this check.

## A fact through its lifecycle

Use existing lifetimes A,B,C to keep creation/payload out of this trace. Initial
native order is A,B,C. P authors exact C,A,B. Q later authors exact B,C,A.
The following is a design transition model. Pending hiding is supported by the
preserved tests; pure order-only irreversible supersession is a proposed rule
requiring explicit justification beyond the tested composite replacement/removal.
This is not a newly executed scenario or a new public-contract decision.

| Transition | Authoritative disposition | Records that must remain | What must not occur |
| --- | --- | --- | --- |
| Prepare P | Native A,B,C remains current until installation succeeds | Prepared exact fact, inverse provenance and dependency/index changes | Installing order before its responsibility is ready |
| Install P | Native C,A,B is visible; P is the pending ordering authority | P exact subjects and their dependencies; sufficient inverse A,B,C | Treating inverse order as independently authored truth |
| Install pending Q | Native B,C,A is visible; Q masks P | P remains latent, Q pending, both required dependency sets | Reclaiming P because it is not currently visible |
| Reject Q | P becomes effective again, yielding C,A,B | P and its inverse provenance; Q may retire after coherent installation | Reconstructing P from Q's observed snapshot |
| Confirm Q instead | Q's authored order becomes irreversible relative to older ordering facts | Q's existence obligations while providers remain pending; release of older P dependencies requires its own justified rule | Letting later rejection or confirmation of older P overwrite Q |
| Reject P after Q confirms | B,C,A remains; only P's unsuperseded responsibilities can act | Other owners and recovery obligations, if any | Replaying P's inverse A,B,C |
| Drain obligations | Native current order is sufficient once no pending/recovery claim needs these records | Only independently required history/claims, under their existing contracts | Permanent full-order mirror or obsolete dependency records |

The proposed model requires that confirmation not acquire a newer authorship sequence: an old operation
confirmed late cannot override a newer committed replacement. Pending hiding is
reversible; committed supersession is not. A transaction can remain pending for
fields/key facts after all of its ordering facts have been superseded. Its handle
and inspection must not be confused with authority to restore obsolete order.

The terminal failure adds another transition: a confirmed exact C2,A,B depends
on a pending rekey, then ordinary setAll B,A removes C2. The new exact replacement
has no pending provider obligation. Its installation must simultaneously retire
the old ordering authority and dependency/index entries. Storing no new record
is not equivalent to leaving the old record untouched. No permanent tombstone is
required if every still-reachable old reference is detached or made ineligible
in the same prepared unit; that completeness is an obligation, not yet proved.

## Separate the three kinds of information

1. Authored facts: explicit exact order, or placement of the selected subjects at
   the front/end with their within-operation order. Field/key/membership facts
   retain separate authorship even when the public operation is composite.
2. Semantic dependencies: named lifetimes required by effective or still-revealable
   authored facts. Confirmation does not release these while providers are pending.
3. Recovery provenance: prior placement and identity needed to undo or resolve a
   later operation. A neighbor recorded here does not gain an existence promise.
   Backing retention for recovery and semantic authority have different lifetimes.

This requires explicit dispositions: effective, reversibly hidden, permanently
superseded, and recovery-only. They need not be four runtime flags, but their
transitions must be representable and testable. Retained does not imply eligible
to publish; invisible does not imply reclaimable.

## Full reorder versus local placement

| Operation | Authorship and legitimate work | Unjustified work |
| --- | --- | --- |
| Exact order of n subjects | Describes n subjects; can create n dependencies and invalidate affected older ordering facts | Omitting dependency retirement because no new pending record is needed |
| Append/prepend k selected subjects | k subject placements and their internal order; endpoint intent, not all pairwise relations; inverse displacement for moved existing subjects | Copying dependencies of all previous operations or enumerating untouched members at every admission |
| Field write/rekey | Only its actual value/key facts and required lifetime | Capturing order merely because the collection has an order record |
| Remove/restore | Existence plus sufficient inverse placement; validate against final surviving topology | Promoting every inverse anchor into an authored dependency |

For n repeated one-subject appends, new semantic dependency entries should grow
linearly in n. Lookup/index overhead may be logarithmic; this does not justify
copying every earlier entry. A broad operation may retire d affected records and
therefore require work proportional to d, even when the final collection is small.
Sparse work is proportional to authored/affected facts and real dependencies,
not a universal constant-time promise. Optional snapshots can enumerate output.
Deferred cleanup must have a drain bound and remain ineligible for resolution;
labeling an unbounded stale chain as lazy reclamation does not satisfy the gate.

## Can the current representation express this?

Its exact/front/append vocabulary can describe several required outcomes. The
current storage/installation protocol cannot meet both acceptance properties:
`normalize/merge` reconstruct growing arrays and dependency Maps; capture reads
whole native order unconditionally; `retainNativeOrder=false` skips installation
without retiring an existing admission. Adding just a deletion guard would fix
one transition while leaving admission cost and lifecycle implicit.

This does not prove arrays, operation intents or every extension of a merged
representation unsuitable. The design recommendation is to stop extending this
concrete copying algorithm with isolated guards. A viable representation must be
able to identify affected authority, preserve dependency/inverse provenance and
retire obsolete responsibilities atomically with native order. Explicit fact
identities and owner indexes are possible implementations, not proved necessary
architecture. No data structure is selected.

## Local placement hypothesis and discriminators

A possible representation records selected lifetime placements with endpoint intent,
authorship identity/sequence and inverse provenance; explicit exact operations
remain broad. Native state remains current truth. Pending obligations may retain
inverse data; that is not permission for an independently writable canonical mirror.
This is a hypothesis, not evidence of implementation sufficiency.

A latest-wins next/previous pointer alone fails the design check. With pending
exact C,A,B then ordinary front B, native order is B,C,A. Rejecting the earlier
exact must yield B,A,C, as the unchanged test requires. B's observed successor C
must not freeze the relative order of A and C. Another required distinction is
late confirmation of an older exact versus admission of a genuinely newer exact.

| Discriminator | Required result / reason |
| --- | --- |
| Original removed-anchor replay | Reject the combined operation and restore intended surviving order even when one or several inverse anchors disappear in that same settlement; validate before installation |
| Two pending exact orders | Reject newer to reveal older; failed settlement preserves both; a confirmed newer exact prevents resurrection by older rejection |
| Exact then committed front/append | Preserve the later authored placement while restoring untouched relative order; no implicit commitment of observed topology |
| Pending creation plus explicit ordering | Refuse creator rejection atomically while a required lifetime would disappear; rejecting dependent order releases the obligation |
| Confirmed order then committed replacement | Preserve B,A in the permanent terminal test and retire obsolete dependencies, including when the old owner has no order contribution of its own |
| Pending removal hides ordered lifetime | Keep revealable dependencies; reverse settlement restores the same lifetime; held references never retarget replacements |
| Same-author exact then append | Append composes without erasing exact dependencies; repeated appends do not reconstruct earlier dependency maps |
| No observers / fixed k with increasing untouched size | Admission must avoid whole-order snapshots; count all preparation and index work, not only installer work |
| Post-drain reclamation | No obsolete semantic record remains reachable from active owner/dependency indexes; recovery-only records have identified live obligations |

Removed anchors require inverse provenance to resolve against the complete proposed
final topology. Replacing a missing anchor with an arbitrary surviving neighbor is
not an ordering rule. Whether an indexed provenance chain or another representation
can perform that resolution without global replay remains unproved. Do not solve
it by requiring all observed anchors to survive. No new arbitrary-placement API
or conflict tie-break rule is introduced here.

## Independent review and unresolved boundary

Independent premise review agreed that sparse edges alone are insufficient and
identified a further limit: pending removal of B from A,B,C, followed by an
independent move of C to the front. On restoring B, should inverse placement
follow historical successor C or another positional relation? The inspected finite
controls do not establish that general rule. No answer is selected here. A future
experiment must first locate an applicable existing contract/test or return the
concrete ambiguity for owner decision. This differs from the already established
case where anchors disappear during the same settlement.

Review also limited the overlap inference: existing evidence covers reversible
hiding and committed composite replacement/removal; it does not by itself prove
every pure order-only dependency-release rule. In particular, committed partial
front/append is not global supersession. The lifecycle table's pure-exact branch
is a proposed transition requirement to validate, not an accepted semantic change.
Inverse reference chains and fan-out must be included in work/retention accounting;
destructive path compression is unsafe if pending rejection can reveal the old
chain. These qualifications leave the preserved counterexamples decisive. Interpretation
review also separated required lifecycle capabilities from optional fact-ID/index
implementations; the design record now makes that distinction explicit.

Review used source and prior evidence without running tests. Root verified its
claims against the unchanged helper, capture boundary and regression sources.
No runtime, test, API, build, ceiling or activation change is made in this check.

## Acceptance and stopping boundary

Keep the terminal-order test, original replay, six established audit failures and
all passing controls unchanged. Keep the payload premise separately reported.
The admission counter is a preserved failing-work witness, currently a measurement
script rather than a passing automated complexity assertion. A later experiment
must count dependency creation/copy visits over increasing n and untouched size,
and establish its derived bound across all preparation paths; moving the same work
into projection or cleanup does not pass. Do not choose a loose numeric threshold
that admits the recorded n(n+1)/2 behavior.

This finite check identifies a coherent set of required transitions, not a proven
sparse algorithm. It supports testing a replacement representation only if that
experiment explicitly covers supersession, inverse provenance and atomic index
retirement together. It does not justify another isolated cleanup guard, production
integration, performance tuning or activation. Existing CPU/size penalties remain
open. A creator-payload contract decision is still needed before claiming complete
entity settlement, but it need not be chosen to analyze ordering.
