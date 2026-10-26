# Membership admission and completed projection: successor design check

Date: 2026-10-26. Source: rejected f01ed39a7df8a5de185ebec0773e09e36537dacb, preserved at `/private/tmp/v16-transition-qualification`. This is a private protocol proposal, not runtime implementation, executed evidence, or permission to resume slices. Production remains 87f6831fa60cafe87508f0ace84b7638698ca3b0. B remains closed.

## Question and binding premises

Can the existing optional membership capture port and experimental projection queue carry installed membership facts to Link without changing public notification semantics or adding another settlement authority?

Frozen source premises at f01ed39a:

- `source-mutation.ts`: “SHARE INTERPRETATION. DO NOT SHARE AUTHORITY.” Link owns its relationship baseline; inspection predating connection creation is part of that baseline. Later inspection does not advance it.
- `source-mutation.ts`: “Deliberately NOT a re-read of current state: re-reading after a notification is how inspection contamination re-enters”.
- `member-membership.ts`: “ANNOUNCED HERE, BEFORE THE WRITER ANNOUNCES ITS VALUE”. Held descendant re-add keeps innermost-first membership announcement.
- `path-observation-port.ts`: “PRODUCERS MUST NOT STATICALLY OWN OPTIONAL DELIVERY MACHINERY.” Keep its nullable, type-only optional boundary.
- `installPreparedMember`: “no observer, equality or user callback may separate physical membership from its settlement responsibility.” Publication evidence must obey the same no-reentry interval; it does not replace that responsibility.

Owner instructions retain separate physical/ordinary facts, original compound-undo and leaf-Link assertions, callback-authored work, default production hold, and the recurrence stop. Declared dependencies concern publication only. No new API, notification family, transaction owner, history turn, or canonical state store is proposed.

## What source inspection establishes

`recursiveUpdate` installs a new member and invalidates membership before later sibling updaters/equality. Its finally block still publishes installed partial results if a later sibling throws. Presence reconciliation also republishes before the late tagged event. `reactivatePathOnWrite` changes path membership and can republish before announcing it.

`capturePlainBranchMembership` records before-presence, then emits only net presence differences and reads exposed after-values at finalization. Therefore an outer absent→present installation followed by nested removal can have no outer event. An outer add with nested field write can emit an after-value containing that nested write. Neither event identity nor the outer metadata alone identifies all authors of that after-value.

The experimental queue currently stores facts only. `completeSource` associates events with the latest completed fact by revision; `project` attaches the later payload. This is insufficient for the above sequences. Moving annotate before enqueue observers is also too late for earlier native invalidation.

These are source-derived sequences, not newly executed failures. The existing leaf omission timeout is the executed falsifier preserved separately.

## Candidate: enrich the existing queue, not the public event

The candidate has two distinct lifetimes:

1. An **installed unit** identifies one no-reentry installation interval. It carries literal source identity, participation, immutable dependency/declaration evidence, and an immutable native projection delta for exactly the facts installed in that interval.
2. A **producer completion** closes one existing membership capture operation. It records which units installed, including partial-success exits and net-zero public summaries. It does not assert that all constituent writes were atomic or all authored by the outer caller.

The optional capture callback becomes a private plan with preparation, installed-unit admission and finalization responsibilities. This is a private contract change, not an adapter SDK or public export. No new subscriber API or public event is added. Ordinary capture/history continue consuming the current tagged membership notification. Experimental Link uses the same existing projection queue enriched with the unit's projection delta and completion state; there is no parallel operation journal.

Each queue entry has an immutable identity and prepared data. Mutable state is limited to `prepared / installed / completed / consumed / discarded`. A unit may become installed once; a failed preparation never becomes installed. A callback throwing after installation cannot change installed to discarded. Nested operations allocate distinct units. One outer completion may name several units but cannot relabel their authorship or suppress nested completion.

### Source data and installation

| Source interval | Delta that must be prepared | Admission point |
| --- | --- | --- |
| Fresh ordinary child | Actual prepared child identity, literal key, absence→presence, and authored supplied projection; not a reread after later siblings | In `installPreparedMember` with terminal responsibility, before `publishMembershipChange` |
| Whole/partial write omission | Actual present→absent footprint; no fabricated scalar undefined write | With the selected `setMemberPresence` changes, before `republishMembers` |
| Dormant member activation | Presence plus the authoritative supplied path/value already selected for installation; dormant unrelated storage is not an after-value | With presence activation before native publication, sharing the value installation's source unit where required |
| Held descendant re-add | Complete selected ancestor-presence changes and off-path omissions, paired with the actual authored descendant value | Prepare before the writer's installation; admit with its value/presence installation; keep current public membership-before-value chronology |
| Prepared restoration membership | Exact prepared target facts and participation, including ordinary realization facts; not a late physical whole row | With existing validated target installation, before its publication |

The held-path row is a proof obligation: the current `reactivatePathOnWrite` runs after value installation. Merely allocating a potentially throwing plan there cannot satisfy preparation-failure atomicity. A native proposal must map preparation into the existing writer preparation/terminal-record seam, or show that a minimal preinstalled record already retains every required fact. Moving user equality/read callbacks earlier is not an acceptable shortcut. This design does not claim that source mapping has been demonstrated.

Private preparation may run user code. After its last such callback, validate source revision/presence and connection-index generation before installation; stale outer preparation must not overwrite a nested installed identity. The final install/admission interval executes no user callback or observable publication. Allocate all fallible plan storage before it. Allocation guarantees concern supported preparation failures, not universal recovery from process OOM.

Bindings use registry identity, retained node/path identity and literal segments, never dotted diagnostic strings or a fabricated branch PositionId. The existing connection registry gains an affected-source prefix index; work follows the actual affected subtree/bindings, not unrelated trees. A connection created during preparation must be included if still live at installation. A connection created after installation starts from its current baseline and receives no earlier unit. Generation validation prevents a stale prepared binding list from deciding this. Disposal invalidates the binding generation.

### Projection and completion

The existing Link eligible projection remains the only relationship payload state. Its native reducers interpret each admitted unit's immutable delta, in installed order. They do not replace it with a universal ordinary snapshot. Inspection units can update physical observation but cannot advance ordinary outbound projection. No final late physical after-image may replace an exact authored delta or acquire a preceding unit's declaration.

Public events remain chronological barriers with their current grouping/count. Their private metadata may name installed units already admitted; completion is idempotent. The synchronous notifier path completes associations before subscriber delivery, as queued flush does. Event identity may complete only its associated entries, never `latest completed` from an unrelated source.

The producer's existing finally closure also finalizes units when no public membership event exists. This calls the private completion operation directly, not `notify` and not a new observable event. It releases or advances the existing projection queue and schedules through the existing Link consequence mechanism. It cannot itself send a payload while a relevant declaration is validating or while a more recent installed unit lacks a completed projection.

An outer operation does not hold a global lock until its callback returns. Each installed unit has complete evidence before native reentry. A nested event may drain a chronological prefix of already-installed units, even if an enclosing public summary has not been emitted. It must not consume uninstalled work. A later outer summary acknowledges those entries; it cannot replay them over the nested value. This preserves partial success and callback-authored writes without merging nested authorship into the outer unit.

For a net-zero group with no eligible payload change, finalize/retire its unused entries without forcing a value event. Responsibility changes remain observable to Link through its existing private eligibility wake, including ABA. Equality alone cannot restore an old ticket or erase an installed unit.

### Eligibility is the unresolved composition test

An entry's declaration covers its own delta. A native projection that combines several entries cannot simply inherit the last entry's eligibility. The projected payload must retain evidence for all still-relevant contributions; a whole-source overwrite can supersede the payload it replaces, while an unrelated sibling write cannot. Removing a member makes an absent leaf payload; re-add must use newly installed authoritative value, not revive a previous ticket. Presence evidence and value evidence are not interchangeable.

The existing implementation has one latest fact per connection and calls `supersede` on each admission. It does **not yet implement this multi-contribution projection rule**. It is not enough to union every historical blocker: that would retain obsolete dependencies and defeat useful independent overwrites. Nor may it grant the final whole-member snapshot using an outer declaration. The review must decide whether the already-approved complete-transition scope supplies an exact replacement/retention rule here, or whether this is an additional mechanism requiring a separate architecture decision. No such mechanism is silently selected in this document.

## Prewritten discriminators

These are acceptance requirements, not test results. Preserve existing counts/chronology where asserted; do not invent extra public notifications to satisfy them.

| Sequence | Required result |
| --- | --- |
| Original leaf omission, no enhancers | Endpoint receives absence and `settled()` completes; branch/collection controls retain their results |
| Fresh add U; later sibling throws | U remains physically installed and captured; its actual outbound projection can settle under its evidence; first thrown value preserved |
| Outer add U; native callback removes it | Nested removal remains latest; no late outer add payload; no stranded pending delivery when outer net event is absent |
| Outer add U; nested changes U's value | Final useful payload includes nested write, with evidence belonging to both operations where still relevant; outer independence cannot authorize hidden dependent input |
| Outer independent add; nested pending field copy | Copy remains held; do not send its late after-image under outer declaration |
| Later complete independent overwrite | Superseded payload dependencies do not cause permanent hold; unrelated pending work continues |
| Held descendant write while ancestor absent | Only authored path reappears; membership-before-value and exactly-once semantic-slot publication remain |
| Link created before install during preparation | Sees its baseline then the installed change; no missed admission |
| Link created after install during callback | Starts from then-current baseline; no retroactive earlier send or eligibility inheritance |
| Nested declaration fails validation | All relevant installed writes remain conservative; no early send through another connection |
| Same value after responsibility ABA | Ticket refreshes without forced public value notification |
| Inspection between installation and public delivery | No inspection-only payload leaks; distinct connection baselines stay distinct |
| Queued / synchronous / in-flight | Exact event-source completion; serialized corrective send after an already-started old request; no obsolete outer overwrite |
| Failure, disposal, destroy, repeated net-zero cycles | No abandoned installed authority; terminal receipts remain terminal; queue/index/payload references retire after last live obligation |

## Costs and stopping condition

Use the existing queue; append once per actual affected unit, no prefix copying. Attempt storage is proportional to prepared footprint and affected bindings. Ordinary local cleanup must not enumerate unrelated tree state. Broad whole-value input can legitimately visit its input; do not move a collection scan into hidden preparation. Retain only unconsumed deltas, current projection evidence and active declaration/recovery obligations. After completion/supersession/disposal, release payload/node references; user-held terminal receipts retain detached results only.

No runtime cost claim is established. Retained projection evidence may introduce a material cost absent from the current one-fact implementation. Measure it separately if a native experiment is later authorized.

The original event-only proposal is insufficient on source evidence. The enriched-queue candidate is a complete question for review, not an accepted repair: specifically challenge held-path preparation and mixed-contribution eligibility. If either needs a broader writer or authority representation than the approved shared-transition scope, retain this finding and present the precise expansion and alternatives. Do not implement another notifier exception or resume runtime on the strength of this document alone.
