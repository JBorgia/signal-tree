# Selected structural installation boundary: independent audit

Disposition: the existing selected-settlement contract already requires complete
selected installation before rich capture or external observation. Separating
prepared structural installation from observation is compatible with that contract
in principle. I found no deliberate guarantee that a rich capture observer must see
an intermediate selected inverse, or that its reentrant write may be overwritten by
a later constituent of that inverse. This is not approval of a particular phase
extraction. Simply holding rich capture/completion is insufficient to establish a
callback-free, fully prepared selected installation.

Read-only audit of integration HEAD0135ef18567573fec627667fc58bc3e7819cc29e plus
concurrent draft changes. SOURCE.json and source/ preserve exact inspected files.
No runtime, tests or central documents edited; no tests executed. The independent
physical-input W qualification question is excluded from this disposition.

## Applicable contract and its limit

A0 lines29–31 distinguish source installation unit, logical method, and declaration
horizon. Ordinary methods may install several units with earlier siblings surviving
later failure; a declaration is not an atomicity mechanism. A0 lines94/99 explicitly
preserve ordinary scalar capture-before-reAdd timing and require the whole selected
structural inverse domain to be prepared before any installation. Line96 requires
complete selected ordinary membership/order before capture/history/publication
consumers accept its final domain.

392fcf46's mixed-undo clause requires source installation chronology through deferred
publication, preserving unaffected parts/completion on reentry or callback failure;
it prohibits whole physical-row rereads, suppressing an entire operation or adding
a flush. The successor MECHANISM lines85–99 explicitly puts all selected row/member/
order edits in the selected prepared unit, with admission/minimum responsibility
before native invalidation, rich capture, path-enqueue observers and taps. Its
“Preserve current public/native notification timing” sentence must coexist with
that earlier complete-unit requirement; it is not permission for intermediate
selected observations. Ordinary partial writers remain distinct.

The existing heterogeneous-atomicity.spec.ts quotes the invariant that “no observer,
publication adapter, or persistence consequence may see an intermediate heterogeneous
state.” Its tests explicitly run batched forward transactions; they do not prove
synchronous notifier or rich capture coverage. That limitation matters. The narrower
committed-entity-selected-unit.spec.ts already states the exact private capture
expectation for selected inverse work, described below. No new public semantic rule
is needed to demand that expectation. Its presence is not evidence of passing.

## Actual callback map

1. tree-realization-adapter.ts1434–1467 installs the scalar frame, then each planned
   removal, placement restore/fresh add, and rekey by calling plan.commit. Only
   afterward does it install livePointPlans and ordinaryPlans. The public plan type
   promises commit/publish, not a primitive install-only phase.
2. entity-signal.ts1735–1820 and2188–2392 implement those structural commit methods.
   They create entity frames and call commitAndProjectEntityMutationFrame during
   commit, then perform subject/activation signals, active selection updates,
   cache work and updateSignals. They therefore cannot be classified as purely
   mechanical installation merely from the method name. In particular rekey's
   deepEqual and frame/ordinary preparation still occur inside sequential commit.
3. entity-signal.ts1334–1364 prepares minimum responsibility and publication work,
   then calls frame.commit with committedEntityObserver. physical/entity-mutation-
   frame.ts390–408 installs ordinary edits and responsibility, then immediately
   calls observeCommitted. That is atomic for one entity frame, not for all plans
   of the surrounding selected heterogeneous unit.
4. mutation-capture-runtime.ts157–181 synchronously invokes committed-entity and
   structural-boundary subscribers. They can read state and author reentrant writes.
   Listener exceptions are caught and reported with reportContainedObserverError;
   one listener does not starve the next. This specific rich path does not normally
   throw the listener's exception out of the structural commit. Thus “moving rich
   capture changes the first thrown error” is not established by this chain alone.
   Reentry remains a concrete concern even when errors are contained.
5. The draft additionally invokes entityPublication.complete from the installOrdinary
   closure before frame.commit installs its responsibility argument. The source's
   complete dispatcher attempts all participants but can rethrow its first error.
   Current native participant complete is empty; Link participant completes its
   private projection. This added dispatch cannot be assumed callback-free merely
   because it is private. Its exact admitted work/error obligations must be separated
   from installation, and it must not bypass the minimum-responsibility boundary.
6. membershipTap is invoked after the entity frame commit. Existing selected apply
   already wraps holdEntityMembershipDelivery; entity-membership-view.ts120+ says
   deltas are queued in commit order and listeners run after every collection is
   installed. Do not delay the source inventory/delta sequencing indiscriminately
   when only external delivery must be held. Preserve that working distinction.
7. Native signal work calls publishSubjectPhysicalChange, sync/tombstoneEntitySignal
   and updateSignals. Existing location runInvalidationGroup queues publishers and
   drains them after the group, preserving the original error if its body failed.
   That handles native publishers on the wrapped route; it does not hold rich
   capture or arbitrary preparation hooks. Direct install callers and composed
   member/heterogeneous paths must retain the outer grouping guarantee.
8. Path notifications and onAdd/onRemove taps occur in plan.publish. Adapter1486+
   attempts all installed publish obligations; invalidate similarly attempts all
   live-point and scalar invalidations. Commit preserves first invalidate/publish
   failure while continuing installed publication. Synchronous notifier and
   observeEnqueue callbacks still require all admission before publish begins.

## What extraction must preserve, and what is not established

The smallest coherent change is a private prepared structural plan boundary for the
existing selected unit, retaining incumbent selection/anchor/order decisions. All
fallible plan preparation must precede the unit; primitive installs then consume
those plans, followed by the required capture/invalidation/publication phases.
Prepared immutable O/P records must be delivered in source order, including when a
capture callback authors newer truth. This is an implementation obligation within
the selected contract, not authority for a new selector or store.

Deferring only rich observers would still leave late frame preparation, equality,
responsibility and participant preparation inside successive commits. A later throw
could leave earlier selected plans installed; existing prevalidation of structural
drift does not prove every late preparer is nonthrowing. Conversely, freezing all
plans before installation must account for remove-then-restore occupied destinations
and selected rekey/placement dependencies. Preparing every plan independently against
the old live tree can reject a valid selected unit. These are concrete extraction
requirements, not additional executed failures from this audit.

Keep ordinary public writer paths' existing interceptor counts, capture/reAdd split,
partial-success behavior and onAdd/onRemove delivery order. A global defer switch
used for ordinary authoring would need separate compatibility evidence and is not
licensed by selected settlement atomicity. Error containment/reporting versus thrown
first-error precedence are distinct contracts: do not convert contained capture
errors to thrown preparation errors, and do not drop remaining installed obligations
when post-install native delivery fails. I found no intentional test requiring
“early selected rich capture throws, therefore later selected installs never happen.”
No claim of exhaustive absence across every historical test is made.

## Cheapest meaningful falsifiers (not run here)

- Run unchanged committed-entity-selected-unit.spec.ts first. It seeds left.a1 and
  right.a11/b12, authors undoable left removal plus right50/60, then rich capture
  on left's inverse restoration reads both collections and writes right.a777. The
  callback must see restored left plus right11/12, and later physical truth must
  retain777/b12. This directly discriminates early structural capture, without
  depending on Link receipt policy or batching. The existing test is stronger than
  inferring failure from sequential source calls. Preserve its first result.
- Run the unchanged public heterogeneous reentry and independent invalidation/
  containment controls, plus separate-boundary in-flight/queued/disjoint/reverse
  variants. A private capture fix alone must not strand public/default Link work.
- Focused preparation/fault countercase: two selected structural collections,
  inject a failure in the later collection's existing preparation seam. Require
  no selected state/responsibility installation before that failure; do not inject
  an artificial primitive/OOM failure. Pair with a post-install rich listener throw
  proving contained error plus later capture/delivery completion, and a reentrant
  write proving newer truth survives. This is a proposed falsifier, not an executed
  new result, and does not authorize production changes from this report.

No concrete compatibility conflict is demonstrated. The source exposes a boundary
that must be made coherent; the existing selected capture test can establish its
runtime consequence. Phase extraction is not accepted until its exact preparation,
install, error and delivery mapping survives those controls. No policy question on
unknown physical input is answered or bypassed by this result.
