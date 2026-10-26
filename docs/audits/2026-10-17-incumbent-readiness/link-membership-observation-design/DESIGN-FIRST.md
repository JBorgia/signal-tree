# Membership observation and conservative fallback: bounded design check

Design only, 2026-10-26. Frozen source2dacae7b9e9137018d05c4e00382ac9287bc76d4;
readiness parent6ebe0901323020e629819b1f753a2e1be27dfbef. No runtime or test edits,
new API, selection of a successor, or new execution result. The recurrence stop
remains active. The previous42 passes are historical scoped evidence, not
qualification of this design. Production87f6831f and closed B remain unchanged.

## Premises and three different observation boundaries

Approved A0 (4ed3b609, frozen A0.md):

> A valid independent declaration contributes no declared owners; it cannot clear known support.

> Permission for a payload requires every still-contributing fact and relevant validation horizon to permit it.

> Default automatic Link remains conservative.

The owner-approved authored-input rule covers all inputs to newly authored facts,
while untouched outgoing contributors can hold a valid declaration. Hidden-input
omissions remain application responsibility only where a complete declaration
actually makes that assertion. It is not a waiver for an undeclared raw copy.
Inspection does not become ordinary authority. User-approved surviving-write
semantics permit fresh ordinary authorship after rejection; they do not confirm
an old speculative ticket. No rollback-ownership rule changes here.

1. **Native supplied input.** Kernel explicitly supplies a snapshot/current value
   to an updater. The kernel can describe that input's full native observation
   domain before invoking user code. Capture is conservative across that supplied
   domain; it need not instrument each Object.hasOwn or property expression.
2. **Read in application code.** A getter may provide a value or snapshot, but
   without a scoped consumption handoff the later setter cannot identify its
   origin. Framework tracking is not a publication certificate. Saved values,
   cached application computed values and async continuations remain unobserved
   unless the approved complete declaration supplies their responsibility.
3. **Recipient projection.** Connection coverage describes its outgoing revision.
   A missing recipient annotation cannot erase native evidence or contaminate
   another connection. Enrollment supplies neither native input facts nor origin.

A declarative claim and a native input certificate serve different jobs. Neither
proof comes from comparing payloads. Known dependency is not the same as a
conservative set of possible blockers.

## Membership input contract

Represent a supplied native input as its existing identity/revision/participation
plus a description of observable facts, not as values alone. This is a private
conceptual record, not an exported type or selected storage implementation.

| Input/observation | Facts required by the input domain | Facts not inferred |
| --- | --- | --- |
| Present scalar or entity field | Value revision, addressed lifetime and observable ancestor membership | No authorship of occupancy merely from accessing a field |
| Missing lookup on a native supplied object | Containing membership domain and ordinary absence fact for the key, including ancestor absence | No need to expose a dormant child's old value |
| hasOwn / in / descriptor query on that object | Exact own-key membership and prototype/descriptor semantics of the supplied representation | Querying a handle's function properties is not data membership |
| Object.keys / entries / values / spread / JSON of supplied snapshot | Domain-wide membership, observable key sequence, and values actually included by the native snapshot domain | Not a set of only surviving value dependencies |
| Native branch/root/updateAndReport updater argument | Full supplied value + membership/absence domain recursively, at the supplied revision | No proof that the callback used only its returned field or enumerated every key |
| Collection by-key result or absence | Key occupancy generation, current lifetime if present, relevant existence | Payload id does not establish key occupancy; retired lifetime does not retarget |
| ids / all / count / empty | Ordinary membership domain; all also fields and lifetime mapping; ordered arrays include order support | Empty output does not imply empty responsibility |
| first/last/index/selection/activeEntity | Order or selection identity plus occupancy/existence facts determining the result | An absent selected key does not acquire a replacement lifetime through a held reference |
| Explicitly supplied full collection input | Membership, key mapping, distinct lifetime identities, order and included value domains | Preparing an incidental anchor is not authored ordering |
| Saved plain snapshot or application-native computed | Historical native input only if an explicit supported handoff carries its exact descriptor | No promise of automatic later causal tracking or fresh framework computed reads |

The matrix defines required facts when those results cross a supported native
input boundary. It does not invent collection-updater APIs or automatically
track arbitrary JavaScript observations. The source inventory distinguishes which
routes currently supply such a boundary and which remain unavailable. A direct
method read outside it belongs to unobserved origin until explicitly declared.

The native membership claim is about supported own data keys. Inherited prototype
properties, mutation of Object.prototype, callable carrier properties and custom
user getters are not automatically native membership evidence. Snapshot keys and
carrier keys have different meanings; supported symbol/key behavior must follow
the existing snapshot producer rather than a new string-only enumeration rule.

A never-present key does not require an allocation for every possible string.
Its negative answer is covered by the containing membership-domain revision.
An omission with pending or recoverable responsibility needs a retained negative
fact even when no visible value remains. Same business key / new lifetime needs
new occupancy identity; old captured negative/positive facts cannot silently
retarget. Same-lifetime reactivation and fresh creation remain distinct.

The descriptor must match the supplied view. Ordinary source facts can describe
ordinary input. If inspection changes the input's physical value/topology, do not
label it ordinary by reading an O-only ledger; carry that participation or mark
coverage unavailable under the current contract. Explicit adoption supplies the
authored ordinary transition. Selected inverses consume their existing O facts,
not a new physical snapshot. No descendant/ancestor creation rule changes.

## Single input description and caching

The existing snapshot builder (utils.ts) already handles dormant membership for
reactive invalidation. The rejected private Object.keys walker duplicates only
the visible part of that domain. Replacing it with Object.getOwnPropertyNames
would introduce the opposite mistake: dormant payloads can be retained without
being observable. Neither walker is a sufficient general fix.

The proposed invariant is that native snapshot production and native input
certification use the same description of observable source facts. Collection
projection producers must describe their own domain under that same contract.
This need not materialize all facts for a point read. A cached value needs a
matching immutable descriptor or a current source-domain certificate for exactly
that cached revision. A cache hit cannot skip responsibility checks. Angular, for example, publishes
into a native signal; public reads can return that signal without invoking the
kernel reader. A hook only in the snapshot builder or native peek is therefore
insufficient for general application-read tracking. This design certifies native
supplied arguments; it does not change framework computed/effect timing. Equal value
with changed membership/support must invalidate the relevant certificate without
forcing an application value event. Never attach changed authority to an older
saved snapshot merely because object identity/value equality matches.

Inspection-only physical changes and ordinary support changes can invalidate
different descriptions. Keep them separate. Unavailable certification blocks
declared permission; it is not an invitation to synthesize a clean baseline.

## Evidence lifecycle and work limits

Creation/preparation specifies exact value, positive/negative membership,
occupancy/lifetime and ordering support before installation. State, incumbent
responsibility and publication-support edits install together through the
existing unit; failure before that unit exposes none of them. Callback reentry
starts a new unit and cannot amend the old input revision.

A field overwrite replaces that field's proof only. It cannot erase sibling
absence or ancestor existence. Omission replaces the membership fact; it does
not delete the dormant value proof needed by supported inverse/reuse. Re-addition
replaces the authored membership/occupancy facts using same/new lifetime rules.
Confirmation changes an authentic outcome, not input contents. Rejection
invalidates an old grant; selected inverse operations and current O reevaluation
supply any new projection. Failed settlement leaves responsibility and retained
facts usable. Disposing a connection never clears native facts.

A native domain can compact terminal facts only when no current, saved supported
input, pending capture/recovery, queued or in-flight obligation needs them.
Detached receipts own their result only. Negative facts are not permanent
per-string tombstones. A historical descriptor must pin compact evidence, not a
source tree/callback/payload graph accidentally. Source destruction and explicit
connection disposal remain distinct under A0; disappearance from a registry is
not confirmation.

Point preparation/cleanup must follow addressed facts and live obligation indexes,
not scan unrelated trees/collections. Full snapshot materialization can enumerate
its output and negative facts needed to certify that domain; benchmark fixed-local
omission among increasing unrelated members separately from full divergence.
Candidate storage must explain how negative-domain certificates and cached support
avoid both unbounded history and a whole-collection scan on every scalar write.
This is a design constraint, not a measured performance claim.

## Fallback: evidence class first, delivery second

An empty target gate is not proof of independence for an unobserved origin.
The following facts are distinguishable and must not share one unknown bit:

| Evidence class | Permission constraint | Trigger for reevaluation |
| --- | --- | --- |
| Valid complete declaration + complete native inputs | Known contributors/horizons must all permit the exact revision | Indexed owner/horizon/completion changes |
| Complete native evidence, recipient-only coverage unavailable | No declared grant; supported tree-local ordinary fallback remains possible | Local settlement and actual native foreign obligations |
| Known foreign dependency pending | No declared or ordinary bypass | That dependency's irreversible outcome plus completed inverse/publication |
| Unobserved origin | No early grant from lack of evidence; policy below remains unselected | A specified conservative obligation ending, fresh supported authorship, or disposal |
| Rejected/invalid/unavailable evidence | Do not release the old ticket as confirmed | Fresh ordinary evaluation under approved rules; unresolved constraints remain explicit |

A held revision must register the events that can change its eligibility, even
when no value notification occurs. In821, project stores blocker cells without
an operation reverse link; ownerWake cannot reach that work. In2dacae, project
removes blockers and sends prematurely. A wake registration must be revision-bound,
retired on supersession/disposal, and independent of value notifications. Passive
recipient enrollment cannot introduce or erase it for another connection.

When an event fires: finish applicable native installation and validation; resolve
current coherent O projection; validate exact revision/evidence; queue only that
revision under serialized delivery. Reentry/supersession must invalidate an older
grant. An in-flight request may need a subsequent corrective send; completion
cannot revive disposed work or mutate a terminal receipt. Source destruction does
not fabricate a confirmation or silently resolve unavailable authority.

## Concrete policy boundary, not a runtime selection

These ordinary expressions have the same target-side information today:

```ts
target(7);                 // unrelated literal
target(source.x());        // source.x() returns pending 7
```

With foreign p open, requiring immediate tree-local fallback for the first and
hold-then-send-on-confirmation for the second needs information the current input
boundary does not carry. Source requirements exist but there is no consuming edge.
The sixth wider-native-input case is different: a complete native descriptor and
complete application declaration can exclude unrelated foreign input even if the
recipient itself lacks coverage. That case must retain its adjudicated fallback.

Finite choices for the unscoped pair:

- **Conservative possible-owner window:** at the authored revision, retain a
  compact immutable set/epoch of instrumented pending owners as possible blockers,
  separately from native dependencies. Both unobserved expressions wait. An
  all-confirm window wakes and reevaluates O, yielding the unchanged copy control's
  required [7]. Later unrelated owners do not extend that fixed window; new writes,
  actual structural dependencies and the existing local gate can still constrain
  current revision. No registered-tree scanning per write is acceptable. Costs
  must count window/index retention and false-positive holds. This explicitly
  qualifies unconditional tree-local fallback for unobserved undeclared writes.
- **Additional tracked execution boundary:** observe actual reads within a
  specified scope and carry them to writes. It needs a public execution model for
  saved values, no-write reads, exceptions, cached framework inputs, reentry and
  async continuations. It exceeds the current native-updater mapping and is not
  authorized by this design check.
- **Limit cross-tree safety:** retain unrestricted tree-local fallback, declare
  the raw copy outside safety scope. This abandons the unchanged assertion and
  conflicts with the latest acceptance requirement; it is not recommended or
  treated as authorized.

The first option is a bounded policy hypothesis, not proof of actual provenance.
It also needs explicit negative-outcome disposition: confirmation is sufficient
for that captured possible-owner window; rejection/unavailability is not.
Existing surviving-write semantics require fresh O reevaluation, but do not by
themselves settle whether a merely possible rejected owner can remain a blocker
forever, or exactly when unknown origin may be conservatively baselined. An
unavailable owner must not be treated as confirmed, and a fresh post-rejection
complete independent write remains a separate useful control. No implementation
chooses the answer. The owner should select the intended liveness/safety tradeoff
before a successor; this design cannot claim to clear that gate while it is open.

## Frozen discriminators and prospective gates

No new test run or passing outcome is claimed. Required unchanged falsifiers:
publication-independent-isolated-omission-input.spec.ts,
link-native-address.spec.ts, original/corrected enrollment controls, scalar
membership4, inspection/adoption, stale-delivery/ABA and nested validation.

Before runtime selection, freeze expectations for:

- Absent lookup/existence/enumeration and cached updater input with a dependent
  omission plus independently overwritten sibling; truthful dependency publishes
  only after confirmation. Never-present key allocates no membership.
- Remove/re-add same lifetime versus new lifetime at one key; old references
  remain detached; pending absence does not transfer to a replacement by spelling.
- ids/all/count/empty/activeEntity/order consumption, including empty collections
  and selection of absent keys; no unsupported native observation counted as pass.
- Enrollment before/after input creation, no Link, passive root/branch, disposal
  and reenrollment; evidence comes from the source throughout.
- Same payload with different responsibility, primed/unprimed caches, inspection
  visibility, ordinary adoption/inverse and failed capture/refusal/reentry.
- Default raw copy: hold before confirmation, publish7 afterward without a new
  value event; multiple owners, late owners, supersession, in-flight completion
  and disposal. Rejection/unavailability expectations follow the owner decision,
  never an implementation convenience.
- Local source and complete declaration progress while genuinely unrelated p
  remains open, retaining useful declared basis and adjudicated ordinary fallback.
- Fixed-local versus full-domain work, recovery-only negative evidence, held old
  references, repeated drain and disposed/retained receipts, with actual source
  collectibility measured independently.

The registration collisions and mixed undo have separate source explanations and
acceptance gates in SEPARATE-FAILURES.md. Absence coverage cannot qualify them.
Only an independently reviewed, policy-complete design can justify proposing a
runtime successor; neither this inventory nor another focused count resumes it.
