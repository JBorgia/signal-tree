# V16 integration evidence

## Source selection

Donor: published v15.4.0 `4ceb24a2a62dc893bf28c50ad971a955190539a7`.
Untouched destination baseline: `628d302dadb082a48c58528651c9088234d0a777`.
`baseline/` preserves all four current-runner results, original-case output,
commands, input hashes and exits. No baseline execution errors occurred.
Historical `transaction-options/current.mjs` pins a different source and was
not used as evidence for this baseline.

## Slice 1: collection identity and own-field presence

Committed as `042e8ede`; test-declaration checkpoint `479d449d`.

The initial 59 carried cases produced 17 failures: six cross-collection identity
failures and all eleven field-presence cases. Literal-dotted collection cases
already passed and remain preservation controls. Collection scoping by actual
node now passes 48/48 identity cases, plus 72/72 existing v16 recovery,
inspection, rekey and current-truth controls. V16 owner-node indexing and
`subjectFieldSegments` remain authoritative.

Presence is captured and coalesced independently from value, inverted for
reversal, retained for reapply, and applied as deletion at an absent endpoint.
Presence-only effects are not discarded as undefined-to-undefined no-ops.
The original eleven cases plus ten additional controls passed. Independent
review found no bounded runtime blocker and requested actual nested siblings
and an absent-present-absent net-effect control. Those strengthen the final
presence suite to 23 passing cases.

The added suite's first six failures were **two implementation failures and
four wrong test expectations**: v16 already refuses the queued external/ABA
whole-turn rollback. The tests preserve that refusal and test retained authority
and later confirmation; no partial-rollback policy was introduced.

Full kernel: 331 files, 2936 passed, six expected failures, thirteen skipped,
exit 0 (before two final review cases were added). All-package build exit 0.
Typecheck and lint passed initially; spec-types failed on eighteen stale type
errors in four pre-existing v16 test files. Commit `479d449d` updates only those
test declarations to the API their runtime calls already use; all assertions
are unchanged. Corrected typecheck/spec-types/lint:budget: 3/3, exit 0.
Final review controls: 23/23 presence cases, exit 0. These are working-tree
slice checks, not an exact-SHA release qualification or performance claim.

## Preserved failures for subsequent slices

The lifecycle probe now distinguishes direct subscribers (v16 isolates their
exceptions) from reactive realization delivery (which can throw). The original
probe incorrectly required direct subscriber errors to propagate, then to be
reported: those first results are fixture mistakes, not repaired runtime bugs.
The corrected twelve-case probe gives eight passes and four genuine failures:
undo/redo applies the value, realization throws, history keeps its old position.
Reentrant settlement controls already pass and must be preserved.
Source and raw runs: `/private/tmp/st-v16-integration-evidence/slice2/`.

The stronger net-presence test also exposed same-tick composition: immediately
after rollback, a new `undoable()` sequence changes the value but undo does not
restore it. Both enhancer orders fail. The complete failing fixture is retained
at `/private/tmp/st-v16-integration-evidence/slice3/same-turn-rollback-then-undoable.spec.ts`.
The slice-1 net-presence control separates turns with a flush; that is **not**
a fix or qualification of the same-tick case. The fixture does not install batching. Restore the original no-flush case
and trace capture chronology before choosing a repair; scope draining is a
hypothesis, not an established cause. No failing expectation was marked skipped.

Next: diagnose the preserved same-tick case, then semantic-scope and
membership work. No v16 publication, ownership-model selection, or v15 budget
transfer is implied by this checkpoint.

## Slice 2: operation-scoped application outcomes

Committed as `65cf7b38`. The corrected reactive-realization probe had four
genuine history failures before repair; direct subscriber isolation and
reentrant settlement were preservation controls. Restoration now completes its
history bookkeeping after applied writes whose delivery throws, then rethrows
the original consumer value. Pre-application failure does not advance history.

The donor used a persistent WeakSet brand on consumer errors. Reusing an error
from an earlier delivery failure during a later pre-application failure could
misclassify that second operation. An internal per-invocation receipt replaces
that brand; public boundaries unwrap it, preserving object identity and primitive
throws. Same-tree nesting and incomplete outer application are covered. This
does not claim recovery from arbitrary partial application.

Final focused suite: 25 passed. Reinstating persistent error branding produces
four failures and 21 passes; source was restored. Independent review found no
additional blocker or public receipt leak within this scope. Full kernel:
333 files, 2963 passed, six expected failures, thirteen skipped, exit 0. Angular:
164 passed / three skipped; React 26, Vue 20, Solid 46 passed. All five package
builds and typecheck/spec-types/lint:budget pass. Raw commands and logs remain
under `/private/tmp/st-v16-integration-evidence/slice2/`.

The reused-error finding was separately reproduced against the published
15.4.0 kernel tarball using public restoration/factory APIs plus controlled
internal validation fault injection. It is a bounded provenance defect, not
evidence of a common application trigger. A narrow v15 backport is underway on
`fix/v15-outcome-provenance`; v16 recovery/refusal policy is not copied into v15.
Published-artifact reproduction and integrity are preserved under
`/private/tmp/st-v15-published-outcome-probe/`.

## Slice 3a: rollback is not a new authored history contribution

Committed as `a42094b9`. Independent diagnosis showed the no-batching same-tick
fixture was not a lost subscription or scope-timing bug. Compensation restored
provenance, then fell through into ordinary restoration capture. An immediate
authored write either cancelled against that inverse or inherited the rejected
value as its undo baseline. Six new cases failed before repair; four external
truth controls already passed.

Return after both existing v16 provenance restorations prevents that capture.
Pending-history discard remains in its existing lifecycle handler. Review found
no blocker; recovery, queued truth, inspection and whole-turn refusal remain
unchanged. Final focused set 33/33; existing v16 controls 75/75; kernel 2973
passed, six expected failures, thirteen skipped; typecheck/spec-types/lint 3/3,
kernel build exit 0. Raw evidence:
`/private/tmp/st-v16-integration-evidence/slice3/compensation-exclusion/`.

This closes the preserved same-tick rollback→undoable fixture. It does not close
the remaining deferral/scope or plain-branch membership integration.

## Slice 3b: deferred write classification and chronological segments

Committed as `76dcaa04`. V16 already captures enqueue-time metadata and undo
designation and deliberately refuses a transaction opened inside outer coalesce.
No donor scope-drain helper, early scope-exit visibility, or transaction-entry
drain was imported. The repair instead deduplicates replacements within
uninterrupted compatible context/designation segments, preserving their order
across locations. Updaters drain preceding segments and the same-location
predecessor; accepted work still drains before the original error is rethrown.

Initial tests overreached: their expected external→new-undoable baseline of 5
also failed without coalesce. That result does not establish that 0 is correct.
The final suite checks direct/coalesced equivalence and actual nonempty enqueue
evidence for that case, without declaring either baseline authoritative. A
second direct control found ordinary scalar designation loss even without
coalesce; dynamic entity controls pass. Original counterexamples are preserved
under `preserved/first-with-direct-control.spec.ts.txt` and
`preserved/pre-interpretation.spec.ts.txt`, with original logs under
`/private/tmp/st-v16-integration-evidence/scope-deferral/`. These two issues remain
open for notifier/capture investigation and the full semantic matrix.

The first per-location queue prototype reordered different contexts across
locations; two chronology tests rejected it. The final segmented queue passes
independent source review. Review added updater-drain reentry and throwing
updater controls, including `throw undefined`. The exact final 41-case fixture
against original runtime gives 20 failures / 21 passes (exit 1), then repaired
runtime 41 passes (exit 0); file restoration hashes match.

Existing destination controls: 150/150. Full kernel before the final three
review cases: 3011 ordinary passes plus six expected failures, thirteen skips
(Vitest JSON reports 3017 passed). Types, spec types, kernel lint and all five
package builds pass. The final comments/three review cases were followed by
fixture and spec-type rechecks. No v16 size/performance qualification is claimed.

Next: plain-membership production evidence and chronological delivery, then
its capture/reversal/Link integration. Investigate the preserved static
designation loss when touching notifier attribution; do not silently bless the
external-baseline counterexample from an incumbent measurement alone.

## Slice 3c: plain-branch membership and notifier designation

Conceptual port of v15.4.0 plain-branch membership plus the notifier part of
v15.4.2's HIST-C2 designation fix. Donor files are byte-identical to v15.4.0 or
differ only by `transaction()` → `transact()`; independent review confirmed it.

First full kernel run of the uncommitted slice (2026-10-05): 5 failures in three
files that all pass at `03d9696f` (72/72), so the slice caused them. Each pinned
pre-port behaviour that v15 itself changed in `cf98697a`: branch writes now also
publish the parent membership path, and differing origin/transaction metadata
splits frames instead of coalescing to `mixed`. Each v16 test block was verified
equal to v15's pre-change block (whitespace/commas only) before v15's updated
block replaced it. Review then found one v15 test the transplant had dropped
(coalescible metadata deliberately discarded); it is restored beside the renamed
one. Logs: `/private/tmp/st-v16-integration-evidence/2026-10-05-*`.

Results: full kernel 3098 passed, six expected failures, thirteen skips; all four
framework suites pass (164, 26, 20, 46); types and kernel lint pass. The two final
review fixes (restored test, merged imports) were rechecked with focused suites
(139), types and lint, not a further full run.

Independent review found no regression in 3c and no weakened destination
contract (inspect statuses, recovery, observeEnqueue, literal-dotted owners and
own-undefined reversal were probed). Open items it raised:

1. **Owner invalidation gap, both lines, pre-existing.** A membership-only branch
   write fires `observeOwnerInvalidation` once with no enhancers and zero times
   with `transactions()` or `restoration()`; the value has already changed. Probed
   identically on v15 (`5c22eac5`) and v16 (`03d9696f`). This breaks destination
   contract 3 for membership and affects published 15.4.2. Root cause not yet
   established; it needs a carrier test and a repair on both lines.
2. Minor divergences kept for now: v15's unreachable `plainBranchMembershipChange`
   guard in `hasSameSemanticIdentity` is absent; `mergeOrigin`'s `mixed` result is
   now unreachable; the diagnostic journal records membership frames as a branch
   effect with undefined before/after (as v15 does).

Separate finding, recorded for the rollback integration: v15.4.2 restricts
structural supersession to settled erasers. The same six v15 cases on v16
`03d9696f`: 2 pass, 4 differ. v16 refuses with `later-confirmed-dependency` while
a removing transaction is open (no resurrection hazard, different kind), keeps
refusing after the remover rolls back, and keeps refusing after an open editor
confirms. Probe: `2026-10-05-v16-unsettled-probe.spec.ts.txt`. Decide these
against the v16 laws and semantic matrix; do not copy v15's kinds blindly.

Next: carry the rest of 15.4.1/15.4.2 (outcome-provenance fixture,
external-authored baseline and inspection-write exclusion in restoration) with
their tests, then the open designation and external-baseline counterexamples.

## 15.4.1 and 15.4.2 carry-over status (2026-10-05)

15.4.1's outcome-provenance runtime originated in v16 slice 2; v16's
per-invocation receipt matches v15's. Its v15 fixture
`restoration/outcome-provenance.spec.ts` is now carried (only `transaction()` →
`transact()`) and passes unchanged.

15.4.2's restoration repair (separate historical capture so external truth
cannot become an authored undo baseline; inspection writes excluded from order
capture; net-zero authored boundaries kept) is NOT yet carried. Its 387-line spec,
ported with the same spelling change, fails 28 of 63 cases on v16 — the expected
defects (undo returns 0 instead of the external 5, lost historical boundaries,
inspection reorder reversed). Preserved as
`preserved/external-authored-baseline.spec.ts.txt`; first-red log at
`/private/tmp/st-v16-integration-evidence/2026-10-05-slice3d-first-red.log`.

It depends on two v15 restoration changes v16 lacks: the order-capture rule that
compensation writes are not new order history (`cf98697a`, slice 5) and
`hasRetainedOrPendingHistory()` (`03deb906`, slice 9; an allocation guard, so a
correctness-first port may allocate unconditionally). Carry the repair with or
after slice 5 rather than pulling those slices out of order.

Carried after slice 5 (`0571bced`); see "15.4.2 restoration carry" below,
which also corrects the case count (69, not 63).

## 15.4.3 carry-over: membership-only writes reach every reader (2026-10-05)

The two defects fixed in v15 15.4.3 (`849e825e`) reproduced identically on v16:
with position-topology, owners were not invalidated; without it, a removed
leaf's own token was never published. `republishMembers` is now identical to
15.4.3's, with one internal location-runtime export. The six carriers (kernel,
angular, react, vue, solid) are carried with only `transaction()` → `transact()`.
They assert parity with value writes, so they hold under v16's while-pending
owner invalidation as well as v15's settle-time law.

On `b7095766` without the fix: 26/54 and 66/144 kernel carrier failures; with it,
54/54 and 144/144. Full kernel 3319 passed, six expected failures, thirteen
skips; frameworks angular 179, react 23, vue 61, solid 41; types and lint pass.
Logs: `/private/tmp/st-v16-integration-evidence/2026-10-05-*membership*`.

## Slice 4: committed entity capture, pending overlap and descriptor lifetime

Committed as `5cd573d9` (committed entity capture), `c1553346` (reserved
transaction order), `574b74e3` (descriptor release) and `2e220e2f`
(restoration admission), on `integrate/v16-slice4` from `c596ab2a`. Raw logs,
mutation logs and the patched-runtime snapshot:
`/private/tmp/st-v16-integration-evidence/slice4/run2/`.

Donor fixtures copied from v15 `012fd11d` (identical to `cf98697a`) with
`.transaction(` → `.transact(` and `typeof tree.transaction` →
`typeof tree.transact`. All eight pass unchanged on v15 `012fd11d` (21, 9, 4,
64, 27, 12, 10, 4).

First red on `c596ab2a` (re-measured on this worktree; matches the earlier run):
descriptor-retention 13/21 failed, reentrant-order-bookkeeping 7/9,
committed-entity-capture 3/4 (`subscribeCommittedEntity` missing),
pending-active-entity 44/64, pending-overlap 4/27, pending-overlap-admission
2/12, transaction-reentrant-order 3/4; entity-membership-capture does not load
(imports `lib/internals/entity-membership-view`, slice 6).

### Classification

| Fixture / case                                                                                                                                                             | First-red cause                                                                                                                                                                                                                                                                                                   | Class         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| transaction-reentrant-order: later ordinary / transaction scalar write on explicit rollback (2)                                                                            | The pending turn id was allocated at materialization, after the post-callback flush, so an observer's write got the OLDER id and was invisible to the plan; x reverted to 0 (L4).                                                                                                                                 | a             |
| transaction-reentrant-order: observer entity write when the callback throws                                                                                                | Same ordering defect on the throwing-callback path: v=2 erased. v16 now refuses through the dependency plan and attaches recovery (contract 2), not v15's record-as-committed.                                                                                                                                    | a             |
| reentrant-order-bookkeeping: earlier rollback sees a later capture / observed later pending turn (2)                                                                       | Ordering defect plus no pending record while the later callback is open. Expected kind `later-pending-dependency` is v15-only; v16's `RollbackFailureCause` reports later pending overlap as `later-confirmed-dependency`.                                                                                        | a + b (kind)  |
| reentrant-order-bookkeeping: entity rollback sees an open entity capture (overlap=true)                                                                                    | Open callback's committed entity write not visible to an older rollback; n:2 erased. Kind as above.                                                                                                                                                                                                               | a + b (kind)  |
| reentrant-order-bookkeeping: opened-listener writes precede the callback (batching false/true)                                                                             | Runtime already refused; only the v15 kind differed.                                                                                                                                                                                                                                                              | b (kind only) |
| reentrant-order-bookkeeping: opened-listener ordinary writes form the baseline (false/true)                                                                                | Writes queued by an `opened` listener were read as LATER queued evidence against the new turn, refusing its rollback over its own baseline.                                                                                                                                                                       | a             |
| committed-entity-capture (3)                                                                                                                                               | Committed entity evidence channel absent (`subscribeCommittedEntity`, frame observer).                                                                                                                                                                                                                            | a             |
| descriptor-retention: ordinary churn, net-zero structural, release-vs-reclamation, live unclaimed addresses, pending addresses through churn, redo-owned through churn (9) | Ordinary confirmed flushes recorded subject descriptors and never released them (L15): 40 subjects after 40 churned rows, 21 instead of 1 under a pending turn.                                                                                                                                                   | a             |
| descriptor-retention: open capture during a reentrant ordinary/confirmed write (3)                                                                                         | First fails on the unrelated row's leaked descriptor; the open-capture protection is the deeper half (mutation M4 below).                                                                                                                                                                                         | a             |
| descriptor-retention: confirmed consequence throws                                                                                                                         | `settleCommitScope` throwing skipped the descriptor release in `confirm()`.                                                                                                                                                                                                                                       | a             |
| pending-active-entity (44)                                                                                                                                                 | Restoration admission saw a foreign transaction's entity write only when the notifier DELIVERED it, so undo/redo inside the callback or from an earlier subscriber overwrote pending truth; committed-observation lifetime API absent.                                                                            | a             |
| pending-overlap: undo/redo inside the running callback (2)                                                                                                                 | Same, for a scalar write still queued in the notifier.                                                                                                                                                                                                                                                            | a             |
| pending-overlap: explicit rollback refusal releases consequences                                                                                                           | v15 settles the commit scope on refusal; v16 holds it until real settlement (`rollback-refusal-scope.spec.ts` anchor). Adapted: 0 released after refusal, 1 after `confirm()`.                                                                                                                                    | b             |
| pending-overlap: redo truncation when designated pending work is staged                                                                                                    | v15 truncates redo at staging, permanently even after rollback. v16 truncates only on admission ("Only admitted work replaces redo. Staging may still be abandoned.", `d2218eb0`), consistent with L3. Adapted: redo refused ST1034 while pending; after rollback redo still applies; after confirm redo is gone. | b             |
| pending-overlap-admission (2)                                                                                                                                              | In-callback scalar overlap not refused; the fix must not flush/deliver another tree.                                                                                                                                                                                                                              | a             |
| entity-membership-capture (whole file)                                                                                                                                     | Needs the slice-6 reader. With the reader stubbed, its 3 reader-free cases pass on both `c596ab2a` and this slice; the 7 reader cases wait. Preserved as `preserved/entity-membership-capture.spec.ts.txt`.                                                                                                       | c             |

Two existing v16 tests changed because they recorded the defects above:
`lib/transaction-observer-failure.spec.ts` "the throwing-callback rollback is
unchanged from 9df8fbff" (a "compatibility characterization, NOT a safety
assertion" that pinned v=5 being overwritten) and
`lib/e2c-real-causal-path.spec.ts` E2-C3 (recorded destructive undo over a
pending ABA write "without endorsing it"). v15 corrected both in `cf98697a`.
The throwing-callback case keeps v16's recovery handle instead of v15's
record-as-committed (pending count 1, scope held until
`recovery.transaction.confirm()`); the window-based TX-AUTO-ROLLBACK-0 refusal
is still post-callback only, and what changed is order. E2-C3 now refuses the
undo with ST1034 while the pending turn owns x. Both new forms fail on
`c596ab2a` and pass here.

### Ported (conceptual hunks of `cf98697a`, against v16)

- `I/mutation-capture-runtime.ts`: `CommittedEntityMutation`/`CommittedEntityCapture`, `hasCommittedEntityObservers`, `publishCommittedEntity` (observer failures contained and reported), `subscribeCommittedEntity`.
- `K/lib/physical/entity-mutation-frame.ts`: `commit(observeCommitted?)` reports every touched lifetime once, after all instructions apply; inactive retained backing reads as absent.
- `K/lib/entity-signal.ts`: `committedEntityObserver`/`captureCommittedEntity` (pay-for-use; attribution frozen before callbacks) on the frame path, `commitExistingSubjectValue`, `upsertMany`, `clear` and `setAll`. No membership-inventory or setAll-order hunks (slices 5/6).
- `E/transactions/transactions.ts`: `reservePending` (id reserved after `opened` listeners, before the callback; placeholder exposes the open bucket's effects and entity footprints); `createPending(reservedId, …)` and discard of empty reservations; any throw before materialization abandons the reservation and its bucket (v16 addition after review); drain of `opened`-listener writes (queued evidence still goes to OLDER pending turns); open-callback committed entity footprints (no baselines); `descriptorOwnersBefore` taken after reservation; ordinary confirmed flushes release unclaimed subject details but not subjects held by an open capture, never shells; `confirm()` releases even when a durable consequence throws. Not ported: `later-pending-dependency`, abort record-as-committed, lifecycle reader, `!callbackFailed` removal.
- `E/restoration/restoration.ts`: `pendingFootprints` (addresses only) fed by committed entity capture and the PathNotifier enqueue witness, installed on a foreign `opened` and released when no foreign transaction is open or pending (or on destroy); included in the existing pending-overlap admission; history reset no longer clears `activeForeignTransactions`/`stagedTransactionEffects`. v16 adaptation: the enqueue witness replaces v15's per-leaf intrinsic observers (scalars do not reach restoration's leaf interceptor on v16, and v16 already owns enqueue-time evidence).

### v16 controls

`E/transactions/reentrant-order-v16-controls.spec.ts` (6) and
`E/restoration/pending-footprint-v16-controls.spec.ts` (10, both enhancer
orders): superseded failed contribution is terminal with no recovery; a
dependent row write refuses automatic compensation with a usable recovery
handle; reservation does not outlive an empty callback; the PLAN falsifier (an
observer confirms another transaction during capture: unrelated row reversible
and its compensation notifies, conflicting field keeps refusal authority);
undo re-entered from an EARLIER subscriber of the pending write is refused;
every row of an UNBATCHED multi-row commit is owned before the first delivery;
staged ownership and an open transaction both survive a history reset;
observation installed only while a foreign transaction is open or pending; a
post-callback throw does not strand the reservation. On `c596ab2a`: 4/6 and
10/10 fail (the notification control preserves existing behaviour; the
stranded-reservation control guards this slice's own change).

### Mutations (each restored; logs `slice4/run2/mutations/`)

Counts are killed cases.

- M1 placeholder without the open-bucket view: 2. M2 reserve before the
  `opened` listeners: 4. M3 no `opened`-listener drain: 2. M4 release ignores
  open captures: 1. M5 ordinary flush also collects shells: 3. M10 row-wide
  entity footprints (L16 over-refusal): 1. M11 release skipped on a throwing
  consequence: 1. M12 reservation not abandoned on a post-callback throw: 1.
- R1 enqueue witness only (no committed capture): every donor admission case
  still passes; the unbatched multi-row control fails in both orders, plus the
  observation-lifetime cases (8 donor, 2 control).
- R2 committed capture only: 6 (in-callback scalars, delivery isolation,
  earlier-subscriber control).
- R3 read the queue at admission instead of the enqueue witness: every donor
  fixture passes; only the earlier-subscriber control fails (both orders).
- R4 reset clears the open set: 2. R5 reset clears pending evidence: 2. R6
  frame reports nothing: the unit fixture (2) and the unbatched control (2).

### Results

Per fixture after: 21/21, 9/9, 4/4, 64/64, 28/28, 12/12, 4/4; controls 6/6 and
10/10; changed v16 specs 34/34 and 5/5. Destination anchors (22 files incl.
recovery-handle-0, settlement-inspection-terminality, proposal-inspection-0/
safety, queued-inspection-review, rollback-refusal-scope, history-retention-0/15,
rekey-supersession/occupancy-0, path-notifier-enqueue/queued-witness,
entity-egress-footprint(-delivery), entity-inspection-egress, owner-invalidation
(-membership), batching adversarial/context-safety/detachment,
restoration-queued/structured-authority): 248/248. Full kernel: 355 files, 3477
passed, 6 expected failures, 13 skipped, exit 0 (`c596ab2a`: 346 files, 3319
passed; +158 is exactly the new cases). Each of the four runtime commits was
also run alone: 3323, 3342, 3363, 3477 passed. Frameworks: angular 179 (+3
skipped), react 23, vue 61, solid 41, exit 0. `tsc -p tsconfig.typecheck-all.json` and
`nx lint kernel` exit 0. `tools/check-spec-types.mjs` exits 1 on
`owner-invalidation-membership.spec.ts` (2 errors, `TransactionalOwner` has no
`transact`) identically on `c596ab2a`; no new spec-type errors.

### Independent review

No critical finding. One major, fixed before commit: a throw between
reservation and materialization stranded the placeholder as the minimum
pending id (reproduced by making `flushSync` throw after the callback),
pinning later confirmed records and the dependency ledger. Minor findings
fixed: committed-entity observer failures are now reported
(`reportContainedObserverError`) instead of swallowed; the
`committedEntityObserver` comment no longer claims batch writers report the
whole commit at once (they report row by row, interleaved only with staged
publications that a transaction's invalidation group defers); E2-C3 destroys
its tree. The reviewer judged both changed v16 characterizations justified by
L2/L4/L10, contract 2 and the identical v15 corrections. Observable side
effects recorded rather than changed: every `transact()` now consumes a turn
id (empty and failed callbacks leave id gaps; readers already must not infer
from gaps), and the open reservation counts in `getPendingTurnCount()` while
the callback runs.

### Open items

1. Refusal vocabulary: v15's public `later-pending-dependency` kind is not on
   v16; later PENDING overlap still reports `later-confirmed-dependency`.
   Decide with the lifecycle reader (slice 6) and the unsettled-remover probe.
2. Structural committed footprints claim the whole lifetime as a `set` with
   `[]` segments (as v15). A pending rekey-occupancy conflict against an OPEN
   callback's add is therefore seen only once the add is delivered.
3. Pre-existing spec-type error in `owner-invalidation-membership.spec.ts`
   (15.4.3 carry), not touched here.
4. entity-membership-capture waits for slice 6.
5. CHANGELOG "Carried from 15.3.1" still says the throwing-callback rollback
   is unchanged. The window refusal is; the dependency refusal now reaches
   that path (recovery attached). Reword when the release notes are drafted.
6. A foreign handle that is never settled now keeps restoration's staged
   evidence, footprints and both observers across `resetRestorationHistory()`
   (reset is not a settlement). Destroy still releases everything. No test
   covers an abandoned handle.

## Slice 5: collection order, scale and staging coherence

Committed as `06173c99` (order and staging), `67eadea6` (shared key snapshot,
`ids()` identity), `b4543600` (bounded work and argument spreads) and the
review follow-up `d287e3f4` (addMany anchors in overwrite mode), on
`integrate/v16-slice5` from `78482a55`. Raw logs, first reds, mutation logs and
patched-runtime snapshots: `/private/tmp/st-v16-integration-evidence/slice5/`.

Donor fixtures copied from v15 `012fd11d` with `.transaction(` → `.transact(`.
All seven pass unchanged on an export of `012fd11d` (36, 12, 11, 12, 7, 10;
external-authored-baseline 69): `slice5/donor-on-v15-012fd11d/`.

First red on `78482a55`: set-all-order-reversal and entity-large-batches do
not load (they import the slice-6 `entityMembershipReader`); carried without
the reader they fail 22/36 and 9/10. add-many-redo-order 8/12,
entity-set-all-staging 3/12, entity-ids-identity 1/7. entity-observation-gate
6/10: five are the slice-9 demand gate; the sixth fails only because the
ungated port also records the preceding `setAll`.

### Classification

| Fixture / case                                                                                                      | First-red cause                                                                                                                                                                                                                                                                                           | Class                     |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| set-all-order-reversal: undo/redo and rollback of remove-one/swap/add-one/add-and-remove with survivor reorder (16) | `setAll` published an order delta only for a pure permutation; neighbour hints cannot restore moved survivors ([a,b,c] → [c,a] reversed to [b,c,a]).                                                                                                                                                      | a                         |
| set-all-order-reversal: undo of remove-all and replace-all, rollback of replace-keep-order (6)                      | Removal anchors pointed only at survivors, so adjacent removals shared anchors and replay order decided the result ([c,b,a], [a,c,b]).                                                                                                                                                                    | a                         |
| set-all-order-reversal: membership snapshot equals physical order after rollback                                    | Needs `entityMembershipReader` (slice 6). Carried spec checks ids and values instead; the donor is `preserved/set-all-order-reversal.spec.ts.txt`.                                                                                                                                                        | c                         |
| add-many-redo-order (8)                                                                                             | Anchors read the pre-add key list at `i + previous - added`; redo gave [k1,k2,k3,k4,x,k5,y].                                                                                                                                                                                                              | a                         |
| entity-large-batches: 130k undo/redo of a full replacement                                                          | Wrong order (undo gave [129999, …]) and 159 s: survivor-only anchors plus a per-removal `findIndex` and the pairwise key-handoff scan.                                                                                                                                                                    | a                         |
| entity-large-batches: neighbour-search work guards (8)                                                              | One `findIndex` per removed row: n(n+1)/2 predicate visits.                                                                                                                                                                                                                                               | a                         |
| entity-large-batches: 130k setAll/replace/clear with membership observed                                            | Needs the slice-6 reader; preserved as `preserved/entity-large-batches.spec.ts.txt`. v16's own spread sites are covered by the v16 controls below.                                                                                                                                                        | c                         |
| entity-set-all-staging: adjacent removals carry removed neighbours                                                  | Survivor-only anchors (as above).                                                                                                                                                                                                                                                                         | a                         |
| entity-set-all-staging: add interceptor adds a row during staging                                                   | v16 committed the stale plan: on `78482a55` the interceptor's `extra` row is dropped from the order (ids `['q']`, count 1) while its key stays registered. Now the operation throws "collection topology changed during staging" and the completed write stands. Probe: `first-red/staging-state-probe*`. | a                         |
| entity-set-all-staging: removal interceptor rekeys during staging                                                   | v16 refused only incidentally ("Entity with id b not found") with coherent state; the guard now refuses explicitly before anything commits.                                                                                                                                                               | a                         |
| entity-ids-identity: reused across field writes                                                                     | `ids()` copied the walk on every version bump, re-notifying `ids()` consumers on value-only writes.                                                                                                                                                                                                       | a                         |
| entity-observation-gate: five demand-gate cases                                                                     | v16 has no `hasObservers` gate on entity payloads (97affed3/172a8268, slice 9). Preserved as `preserved/entity-observation-gate.spec.ts.txt`.                                                                                                                                                             | c                         |
| entity-observation-gate: every pre-removal neighbour captured when the last interceptor enables observation         | Only the ungated port's record of the preceding `setAll` differs. Carried with `mockClear()` after that `setAll`; the removal assertions are unchanged and hold with or without the gate.                                                                                                                 | c (adapted, not weakened) |

The two removal-observation staging controls pass before and after (v16 builds
every payload, so a mid-operation observer cannot miss one).

### Ported (conceptual hunks, against v16)

- `K/lib/entity-signal.ts` `setAll`: one walk of the structural order into
  parallel key/lifetime arrays (`StructuralStore.snapshotActiveOrder`);
  index-aligned incoming staging (first position, last value; interceptors
  per occurrence via the shared `interceptReplacedEntity`); removal anchors
  are immediate pre-state neighbours and add anchors adjacent after-order
  entries, both read by index; the order delta is published whenever
  surviving rows change relative order; 8fe2664f's topology guard (order
  frontier or key→lifetime changed during interceptors/selectors) runs after
  every callback and before any commit. v16's commit/publication sequence is
  kept (`tombstoneSubjectSignal` before reclamation, per-row
  `publishSubjectPhysicalChange`, `syncEntitySignal`, notify arguments). Not
  ported: the slice-9 demand gate (`pathObserved`, epoch/reclamation skips),
  the slice-6 membership units, the `ST2001` duplicate-key warning, and
  8fe2664f's `removeOne`/`removeMany` reordering (it only moves demand sampling
  after interceptors; v16 has no demand sampling).
- `addMany`: anchors are the previous added row, or the last row before the
  call (no key-list copy). v16 refinement after review (`d287e3f4`): "added"
  means a FRESH row; an `overwrite` replacement stays in place and is not an
  anchor (the donor anchored x after k2 in [k1..k4] + [k2', x]).
  `entity-add-many-anchors.spec.ts` (4) fails 1/4 on `0571bced` and 4/4 with
  `78482a55`'s addMany.
- `K/lib/physical/structural-store.ts`: cached active-key snapshot cleared at
  the start of all twelve list/key mutators (including v16's `clear()`);
  `reorderActiveKeys` returns early, with no new frontier, when the order is
  unchanged. `ids()` reuses its array while the snapshot is unchanged.
- New `I/utilities/append-all.ts`; `appendAll` replaces call spreads in
  restoration (historical gap, undo/redo, directed `jumpTo` in both directions
  via a reverse loop, claim release — c2f72e6e), the structural target's
  pending-anchor order and devtools path registration. v16 has no
  serialization enhancer.
- `C/target-transition.ts`: key handoff indexed by owner and key, hits
  re-checked with `Object.is`.
- v16 addition (same mechanism class, no donor hunk; v15 has the same scan):
  `C/pending-rollback.ts` chose each effect's dominant structural effect with
  a scan of every structural effect in the turn. Indexed by lifetime;
  `sameSubjectScope` still decides within one lifetime. Without it a 130k-row
  rollback did not finish.
- `tools/verify-setall-neighbour-search.mjs` from 8fe2664f (not the
  a2117020/36409c42 timing margins), adapted to v16: one carried argument-limit
  case (10 tests, 1 skipped) and no demand gate, so the neighbour mutation
  fails both modes (8, 4 per mode). Passes: control 9/9, both mutations 8.

### v16 controls

- `K/lib/entity-large-batches-v16-controls.spec.ts` (16): 130k
  setAll/replace/clear with a notifier subscriber; 130k rollback of a full
  replacement that reuses one removed key (a key handoff sends it through the
  declarative target with no live anchor, so the pending-anchor order is
  appended in one batch), both enhancer orders; pending-rollback dominance
  work guards (find-predicate visits ≤ 2n) for replace and clear at 256/1024
  in three enhancer configurations, plus the instrumentation self-test.
- `E/restoration/large-batch-restoration-v16-controls.spec.ts` (2, own
  worker): `jumpTo` across a 130k `clear()` turn in both directions; history
  truncation releasing that turn's 130k claims.
- `C/target-transition-key-handoff.spec.ts` (6): the handoff rule (same owner,
  never self, `Object.is` for ±0 and NaN, rekey chains) and an `Array#some`
  work guard.

On `78482a55`: the notifier control passes but takes 103.6 s (1.0 s now); both
restoration controls throw `RangeError: Maximum call stack size exceeded`;
all 12 dominance guards fail (131328/2098176 visits for replace,
32896/524800 for clear); the handoff work case visits 2100224 (its five rule
cases pass). The first-draft rollback control (a plain replacement, without
the key reuse) timed out after 310 s on `78482a55`; the final key-reuse form
was not run there. Final: 16/16, 2/2, 6/6.

### Mutations (each restored; logs `slice5/mutations-part1/`)

Counts are killed cases.

- M1 survivor-only removal anchors: 7. M2 order delta only for a pure
  permutation: 16. M3 addMany pre-add offset (15.3.1): 8. M4 every add after
  the last pre-call row: 8. M5 no topology guard: 4. M6 frontier-only guard: 3. M7 no snapshot invalidation on `changeId`: 3. M8 fresh `ids()` copy: 1.
  M9 handoff without `Object.is`: 1. M10 handoff across owners: 1. M12
  rollback index without the scope check: 3. M13 pending-anchor order with a
  spread: 0 against the first rollback control, which never reached that site;
  rerun as M13b against the key-reuse control: 2. M14 directed undo with a
  spread: 1. M15 claim release with a spread: 1. M16 redo with a spread: 1.
  M17 unindexed dominance scan: 12. Review follow-up (`mutations-review/`):
  advancing the addMany anchor on overwritten rows (the donor rule) 1; never
  advancing it 12.
- Survivor: M11 (index keeps only the last structural effect per lifetime).
  It differs only when one lifetime has structural effects in two collections
  AND a field effect in the turn. The only such turn is update-then-remove of
  a row, which is already wrong on both lines (open item 2); an add-then-update
  falsifier coalesces into one add. Attempt and log:
  `slice5/open-item-update-then-remove-rollback/m11-attempted-falsifier*`.

### Results

Per fixture after: 36/36, 12/12, 10/10, 12/12, 7/7, 3/3; controls 16/16, 2/2,
6/6, 4/4. Full kernel, each commit alone: `06173c99` 359 files / 3540 passed,
`67eadea6` 360 / 3547, `b4543600` 364 / 3581, and with the 15.4.2 carry
`0571bced` 367 / 3686, `d287e3f4` 368 / 3690; 6 expected failures and 13
skipped each, exit 0 (`78482a55`: 355 / 3477; the differences are exactly the
new cases). Frameworks: angular 179 (+3 skipped), react 23, vue 61, solid 41.
`tsc -p tsconfig.typecheck-all.json`, `tools/check-spec-types.mjs` and
`nx lint kernel` exit 0 (spec-types reports three pre-existing files below
their baseline; the baseline was not ratcheted here).

## 15.4.2 restoration carry

Committed as `0571bced`. Ports 5c22eac5's restoration hunks and the
order-capture rule it depended on (cf98697a: compensation is not new order
history), which slice 5 part 1 did not provide.

The preserved spec (`preserved/external-authored-baseline.spec.ts.txt`) is
restored as `E/restoration/external-authored-baseline.spec.ts`, unchanged but
for a header. Correction to the carry-over status above: it has 69 cases, not
63; the slice-3d log reads "69 tests | 28 failed" for this file (its 91 total
included another file). First red on `b4543600`: 27/69. The 28th, jumpTo
through historical membership/order gaps, fails on `78482a55` and passes from
`06173c99` (survivor order delta with membership change).

### Classification

All 27 are real v16 defects (class a). No expectation conflicted with a v16
contract or law.

| Cases (× enhancer variants)                                                        | First-red cause                                                                                                         | Law / contract            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| undo restores the external baseline before the first authored turn (4)             | External 0 → 5 shared the authored effect map, so undo of 5 → 6 restored 0.                                             | L3, L4, L11; P0-C         |
| earlier boundary reconstruction across external and authored work in one flush (4) | Same contamination; undo gave [0, 1, 0] instead of [5, 1, 0].                                                           | L3, L11                   |
| entity undo keeps external sibling fields (4)                                      | External `{a: 5, b: 7}` folded into the authored row diff.                                                              | L3, L4                    |
| disjoint external truth stays outside designated history, nested and not (8)       | The external `x` entered the designated turn and was reversed.                                                          | L3, L18 (nested external) |
| net-zero external/authored work keeps an authored boundary (2)                     | External 0 → 5 + authored 5 → 0 coalesced to nothing; the turn had no boundary event.                                   | L3                        |
| inspection reorder is not reversed by an unrelated authored turn (4)               | Inspection order captures entered authored order.                                                                       | DEVTOOLS-JUMP-0.1         |
| inspection reorder does not erase external order protection (1)                    | The inspection capture took the authored branch and deleted the external-order owner, so undo no longer refused ST1034. | P0-C, DEVTOOLS-JUMP-0.1   |

### Ported

- `E/restoration/restoration.ts`: a historical bucket, allocated only while
  retained or pending history exists (`hasRetainedOrPendingHistory()`, the
  03deb906 predicate; its flush-time skip is slice 9 and not ported),
  receives realized writes and ordinary (non-transaction) authored writes,
  never compensation or inspection; realized scalar, row and plain-branch
  membership writes no longer enter the authored bucket. Boundary events
  (`addEntry` → `buildTurn`) and gaps use the historical capture; turn
  effects stay authored-only. A net-zero flush with a boundary keeps its
  event. Collection order captures from compensation or inspection are
  ignored; realized ones go to the historical bucket and keep marking
  external-order ownership. `resetRestorationHistory()` also clears the
  ordinary and historical buckets (v16 still keeps open-transaction capture).
  `clearCaptureBucket` comes from 03deb906.
- HIST-C2's notifier half was already carried in slice 3c.

### Preserved counterexamples resolved

Slice 3b preserved two readings of the external → undoable baseline.
`preserved/first-with-direct-control.spec.ts.txt` (baseline 5) fails 12/28 on
`b4543600` and passes 28/28 after; it is restored as
`E/batching/external-baseline-coalescing.spec.ts` (coalesced and direct,
scalar and dynamic entity field, both enhancer orders — L18).
`preserved/pre-interpretation.spec.ts.txt` (baseline 0) now fails exactly
those 12 and is annotated as superseded: undo removes the authored
contribution and leaves surviving external truth (L3, L4, L11), as published
15.4.2 does.

### v16 controls

`E/restoration/external-authored-baseline-v16-controls.spec.ts` (8, both
enhancer orders): an external gap while a refused automatic compensation's
recovery handle keeps the turn pending (contract 2) stays external through
recovery `confirm()` and undo; `resetRestorationHistory()` inside an open
transaction keeps that transaction's turn, and external truth written after
the reset stays out of its reversal; a rollback's compensation never reaches a
later boundary's reconstruction; external plain-branch membership stays out of
an authored turn. All pass on `b4543600` too (composition and exclusion
controls); the membership case kills mutation M11 below.

### Mutations (logs `slice5/mutations-part2/`)

- Killed: M1 realized writes still in the authored bucket 34 (22 carried, 12
  coalescing); M2 no historical bucket 21; M4 net-zero boundary dropped 1;
  M5 inspection order captured 5; M7 gaps from authored effects 16; M8
  boundary event from authored effects 5; M10 pending authored writes in the
  historical bucket 2; M11 realized membership still authored 2 (v16
  control).
- Survivors, each explained: M3 allocating the historical bucket
  unconditionally changes no tested result. Review noted that history which
  first appears mid-flush (a subscriber stages a transaction during delivery)
  leaves the bucket without that flush's earlier writes; those writes precede
  every boundary, so the conditional (the donor's) leaves nothing to
  reconstruct, whereas unconditional allocation would file them AFTER the new
  boundary. Kept as donated; not probed further;
  M6 dropping the compensation order exclusion — no v16 path publishes an
  order capture under compensation (rollback installs prepared targets; a
  subscriber or owner-invalidation listener runs outside the compensation
  context: `part2/compensation-order-*probe*`), so the rule is defensive;
  M9 compensation in the historical bucket — compensation does reach the
  subscription (`part2/compensation-delivery-probe*`), but it returns a
  location to the value the bucket already reconstructs, so no observed state
  differs.

### Results

Carried spec 69/69; coalescing 28/28; v16 controls 8/8. Full kernel 367 files,
3686 passed, 6 expected failures, 13 skipped, exit 0 (`d287e3f4`: 368 /
3690). Frameworks angular 179 (+3), react 23, vue 61, solid 41. Types,
spec-types, kernel lint exit 0, at both commits.

### Independent review

One read-only review of `78482a55..0571bced` (code-reviewer agent). No
critical finding; it confirmed the setAll commit/publication order, snapshot
invalidation coverage, handoff and rollback-index equivalence, the 15.4.2 port
hunk for hunk, and fixture fidelity. Dispositions:

- Major, addMany `overwrite`: fresh rows anchored to an overwritten mid-list
  row, and undo deletes overwritten rows. The anchor is fixed in `d287e3f4`
  with its spec; the deletion predates this slice on both lines and stays
  open item 3.
- Minor, historical bucket allocated only once history exists: kept as
  donated (see the M3 survivor above).
- Minor, the collection-order subscription has no `origin === 'restoration'`
  filter: undo, redo and `jumpTo` publish no order capture on v16 (prepared
  targets), probed in three enhancer configurations
  (`review-fixes/restoration-order-capture-probe*`). Unchanged.
- Minor, `setAll` skips a current row whose backing is absent (it would then
  drop out of the reordered list): the old projected-entries filter did the
  same; an active subject without backing is not reachable. Unchanged.
- Info, `ids()` returns one shared array between key changes (it already did
  between version bumps); a consumer that mutates it corrupts later reads.
- Info, the set-all-order-reversal header overstated "unchanged"; reworded in
  `d287e3f4`. The commit message of `0571bced` says allocating
  unconditionally "changes no result"; read it as "no tested result".

The reviewer's own probe directory could not be deleted under its
permissions; it was moved out of the worktree to the session scratchpad,
unchanged.

### User-visible behaviour changes in v16 (slice 5 and 15.4.2)

1. `setAll` throws "Cannot setAll: collection topology changed during
   staging" when an interceptor or selector changes membership, keys or order
   mid-operation; the callback's own write stands and nothing else commits.
2. `ids()` keeps its array identity across value-only writes.
3. `setAll` structural effects carry immediate pre-state removal neighbours
   and adjacent add neighbours; `setAll` publishes an order capture whenever
   survivors reorder, so undo/rollback restore order exactly. `addMany`
   anchors each fresh row to the previous fresh row or the pre-call tail.
4. A `setAll` that leaves the order unchanged mints no new order frontier.
5. Entity batches past ~1.2e5 rows no longer throw `RangeError` in
   restoration, transaction rollback or devtools; large replacements undo and
   roll back in linear-ish work.
6. Undo/redo never reverses external truth captured in the same flush or as
   plain-branch membership; inspection reorders create no history and no
   longer clear external order protection; a net-zero authored turn keeps its
   history boundary; reset clears pending ordinary capture.

### Open items

1. `where()`/`find()` external reactive dependencies (7463f4eb) reproduce on
   v16 (2/2 fail, `slice5/where-find-probe*`). PLAN assigns them to slice 9 or
   an independent entity slice; not ported here.
2. Pending rollback of update-then-remove in one transaction restores the
   UPDATED value (n 1, not 0); with lifetimes shared across collections it
   refuses with effect-validation-failed. Reproduced identically on
   `78482a55` and v15 `012fd11d`
   (`slice5/open-item-update-then-remove-rollback/`). Not a slice-5 hunk.
3. `addMany(..., { mode: 'overwrite' })` publishes an overwritten existing row
   as a structural add, so undo deletes that row and redo re-adds it at the
   wrong position (`78482a55`: anchor-cycle refusal on redo; v15 `012fd11d`
   and `0571bced`: identical reorder; `d287e3f4`: fresh rows redo in order,
   the overwritten row returns after them). Both lines
   (`slice5/open-item-addmany-overwrite/`). What an overwrite should publish
   (a value replacement with `prev`; which tap fires) is a behaviour decision.
4. Scale limits beyond the call-argument class, seen while building the
   controls: retention across `jumpTo` of a 130k replacement (~25 KB/row,
   4 GB heap exhausted) and `deriveStructuralTargetOrder`'s per-addition
   search/splice (redo of a 130k `addMany` via `jumpTo`: 392 s). Slice 9 or
   later; no v16 performance claim is made here.
5. Spread sites left unchanged because their counts are not entity-sized:
   applied-turn-projection's redo-id `splice(...)` (redo turns) and
   location-runtime's `errors.push(...flushConsumers())` (publisher errors).
6. A write queued before `resetRestorationHistory()` in the same tick is still
   captured at delivery, after the reset, before and after this carry.

## Slice 6: read-only runtime observation readers

Committed as `4ce48aa5` (entity membership), `d20dac0f` (transaction
lifecycle), `c0809eca` (restoration lineage), `c761404f` (Link activity),
`f06a47e7` (state location and confirmed `fieldSegments`), `fbb88104`
(tooling admission, typing/consumer fixtures, API baseline), the review
follow-up `c277d1ce`, and the size follow-up `6d3449ca`, `ea05968e`,
`dca4a989`, `d48c4e56` with its review follow-up `34d37b73` (see "Size
follow-up" below; it supersedes where the reader machinery lives), on `integrate/v16-slice6` from `515a6969`. Raw logs,
first reds, probes and mutation logs:
`/private/tmp/st-v16-integration-evidence/slice6/`.

Donor fixtures copied from v15 `012fd11d` with `.transaction(` →
`.transact(`. All pass unchanged on an export of `012fd11d`
(`slice6/donor-on-v15-012fd11d/`): transaction-lifecycle-view 17,
restoration-reader 11, restoration-operation-outcome 8,
entity-membership-view 14, entity-membership-producer 6,
membership-reversal-delivery 216, entity-membership-link-restoration 12,
link-state-view 26, state-location-view 8, entity-membership-capture 10,
set-all-order-reversal 36, entity-large-batches 11 (confirmed-turn-reader and
membership-history-projection were already carried on v16 and still pass).

First red on `515a6969` (`slice6/first-red/`): eleven files do not load (the
reader modules do not exist); entity-membership-link-restoration loads and
fails 6/12 (no reader involved).

### Classification

| Fixture / case                                                                                                        | Cause on v16                                                                                                                                                                                                                                                                                                                                                                                                 | Class   |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| all reader cases (eleven files)                                                                                       | Reader modules and producer hooks absent.                                                                                                                                                                                                                                                                                                                                                                    | a       |
| entity-membership-link-restoration: rollback of remove, undo/redo of remove and add (6)                               | `planRestore` published a restored lifetime as a value-only write, so Link's egress projection dropped the re-added row (sent `[]`/`[a,c]`). cf98697a hunk ported: structural `add` on restore.                                                                                                                                                                                                              | a       |
| restoration-operation-outcome (8)                                                                                     | Needs an owner-held refusal set; v16 refusal sites threw plain `Error`s.                                                                                                                                                                                                                                                                                                                                     | a       |
| transaction-lifecycle-view: refused pending authority; public opened observer (2)                                     | v15 `later-pending-dependency` kind. v16's owner reports later PENDING overlap as `later-confirmed-dependency` (slice-4 open item 1); the reader reports the owner's kind.                                                                                                                                                                                                                                   | b       |
| transaction-lifecycle-view: refused pending authority; realization refusal (2)                                        | v15 settles the commit scope on refusal; v16 keeps it open until real settlement (`rollback-refusal-scope.spec.ts`), so `consequencesReleased` is false.                                                                                                                                                                                                                                                     | b       |
| transaction-lifecycle-view: automatic abort refusal                                                                   | On v16 the later replacing write supersedes the failed contribution: it retires as rolled back with no refusal (L3/L4, `reentrant-order-v16-controls.spec.ts`), not v15's refused-then-committed.                                                                                                                                                                                                            | b       |
| transaction-lifecycle-view: pending handle after destruction; restoration-reader: late confirmation after destroy (2) | A destroyed v16 tree refuses settlement ("Cannot settle a destroyed tree").                                                                                                                                                                                                                                                                                                                                  | b       |
| entity-membership-capture: protects pending membership before reader callbacks can redo                               | v15 refused redo of lifetime `a` while lifetime `b` was pending, as a collection-wide overlap, with or without a reader (`probes/redo2*`). v16 footprints are lifetime-scoped; independent lifetimes progress (L16) and rollback removes only `b`. A same-lifetime redo control (refused on both lines, `probes/redo4*`) keeps the protection.                                                               | b       |
| state-location-view: confirmed effects; removed field (2)                                                             | `updateOne(id, { d: { m } })` carries v16's producer-known coordinate `['d']` (contract 4, slice 1); v15's capture descended to `['d', 'm']`.                                                                                                                                                                                                                                                                | b       |
| entity-membership-view (whole file, harness)                                                                          | Imports v15's `entity-observation` activation hook. v16 positions are owned differently (a collection allocates its own position on `__positionIds`), so the hook is not ported; the neutral test source owns a position directly. No assertion changed.                                                                                                                                                     | harness |
| tooling-admission.typing: generic helper                                                                              | v16 keeps its `<T, C, TAccum>` parameter order and its root accessor is typed from the construction carried by `TAccum`, so a generic helper forwards all three parameters; explicit `<T>` against a concrete tree is kept.                                                                                                                                                                                  | b       |
| vue tooling-admission: opaque-leaf undo/redo                                                                          | Refused before this slice with no reader ("Unsupported scoped undo effect at structural-drift"); a later scalar undo is refused too once an external leaf write sits in the history gap (`vue-leaf-undo-probe/`). Atomic registered-terminal reversal is slice 8. Block preserved as `preserved/vue-tooling-admission-leaf-undo.spec.ts.txt`; the spec exercises the restoration reader with a scalar entry. | c       |

The three fixtures preserved by slices 4 and 5 are restored:
entity-membership-capture (whole file), set-all-order-reversal's membership
snapshot assertion and entity-large-batches' observed 130k case
(`preserved/*.txt` stay as the historical record). entity-observation-gate
stays preserved for slice 9.

### Ported (conceptual, against v16)

- `I/tooling-tree.ts`: `ToolingTree<T, C, TAccum>` = `ISignalTreeOf<T, C, TAccum>`,
  v16's parameter order; all eight helpers and `peekInternalTransactionRuntime`
  admit it (`treeCapabilities` gains the accumulated surface it fixed to
  `unknown`).
- Entity membership (`I/entity-membership-inventory.ts`,
  `I/entity-membership-view.ts`): the dormant source of 172a8268 (inventory
  installed on first observation; deltas only while a reader listens), units
  from the mutation frame (add/rekey/remove, neighbours read at the add),
  prepared transition targets (captured at install, delivered from publish),
  `clear()`/`setAll()`/`upsertMany()` (one unit after the operation installs;
  the removed rows' `publishSubjectPhysicalChange` and setAll's zero-owner
  reclamation now follow the unit, before notification), `prependOne`/
  `prependMany` (one grouped unit), and cancellation on a throw (now: the
  unit closes and announces what physically changed; size follow-up). Restoration's
  declarative target, transaction rollback's declarative target and the
  realization adapter hold reader delivery for the whole reversal.
  `visitTree` regains `includeNonEnumerable` (dormant members) — reverted in
  the size follow-up; the view walks own members itself.
- Transaction lifecycle (`I/transaction-lifecycle-view.ts`): transitions
  recorded at the change, before the engine announcement; public delivery
  after the announcement (opened), materialization (staged), consequences
  (confirmed, rolled-back). Refusals report the owner's kind,
  `pendingRetained: true` and `consequencesReleased` read from the scope
  (`isCommitScopeOpen`, new, read-only). A throwing callback is never staged,
  so a retained refused compensation stays `opened`. A transaction abandoned
  before it has a handle leaves the snapshot under a new sequence
  (`advance()`, review follow-up) with no invented event: the engine
  announces no terminal transition on those paths.
- Restoration (`I/restoration-reader.ts`): stable never-reused entry ids,
  recorded transaction relations, operation outcomes folded into v16's
  `runOperation` (entries resolved before application, recorded after it
  returns; `refused` only for an owner-made refusal in a WeakSet: pending
  overlap, order ownership, value drift, structured validation).
  `getRestorationHistory()` keeps its runtime shape.
- Link (`I/link-state-view.ts`): v16's per-send permission scheduler — `held`
  includes a send waiting for permission, `sending` only while an endpoint
  call is in flight, no publication between leaving the queue and the first
  call, construction failure leaves no record, `disposed` before user
  cleanup, and a listener's dispose on the sending/retrieving publication
  prevents the endpoint call.
- State location (`I/state-location-view.ts`): re-founded on v16 address
  ownership — the registry's typed address for the position, walked through
  the current tree (each step an enumerable, non-dormant member; the node must
  still own the position), lifetimes only on collections, own-property field
  presence. No whole-tree walk, no label parsing, no leaf descent;
  `observation-substrate.ts` untouched.
- Confirmed view: `fieldSegments` projected (copied) from v16's
  `subjectFieldSegments`; no rename of the internal field.
- Not ported: v15's `entity-observation` activation hook and its
  observation-substrate hunk, the slice-9 demand gate, `later-pending-dependency`,
  v15's commit-on-refusal lifecycle, v15's whole-tree location walk, the user
  guide `docs/guides/runtime-observation.md`.

### Public internals delta (`@signal-tree/kernel/internals`, additive)

Functions: `transactionLifecycleReader`, `restorationReader`,
`entityMembershipReader`, `linkStateReader`, `stateLocationReader`. Types:
`PendingTransactionView`, `TransactionLifecycleReader`,
`TransactionLifecycleSnapshot`, `TransactionLifecycleObservation`,
`TransactionRefusalReason`; `RestorationReader`, `RestorationReaderSnapshot`,
`RestorationReaderEvent`, `RestorationEntryView`, `RestorationEntryId`,
`RestorationOperationId`; `EntityMembershipReader`,
`EntityMembershipSnapshot`, `EntityMembershipEvent`,
`EntityMembershipCollection`, `EntityMembershipLocation`, `EntityMembership`,
`EntityMembershipChange`; `LinkStateReader`, `LinkStateView`,
`LinkStateEvent`, `LinkStateSnapshot`; `StateLocationReader`,
`StateLocationSegment`, `StateLocationTarget` (30 symbols, the same set v15
exports). `ConfirmedTurnEffectView` gains optional `fieldSegments`. The
existing helpers' admission widens from `ISignalTreeOf<T, C, unknown|TAccum>`
to the identical `ToolingTree<T, C, TAccum>`.

`TransactionRefusalReason` is v16's owner vocabulary,
`'later-confirmed-dependency' | 'effect-validation-failed'`; v15's union also
named `later-pending-dependency` (not a v16 kind) and `structural-drift`
(unreachable on both lines: validation refusals are `effect-validation-failed`).

`tools/api-baseline.json` gains exactly those 30 `./internals` entries. The
API gate still fails on pre-existing drift from `d394047c` (25 `Proposal*`
symbols removed, 15 `ChangeStatus`/`InspectedChange`/`TransactionInspection`
added across the five roots) — present at `515a6969`, unrelated to this
slice, left for its own decision. `tools/api-callable-baseline.json` is
unchanged: its inventory reads only package roots; its drift is the same
`d394047c` fold.

### v16 controls

`E/transactions/transaction-lifecycle-view-v16-controls.spec.ts` (8),
`E/restoration/restoration-reader-v16-controls.spec.ts` (4, both enhancer
orders), `E/restoration/membership-declarative-delivery-v16-controls.spec.ts`
(4), `K/lib/link-state-view-v16-controls.spec.ts` (2),
`K/lib/state-location-view-v16-controls.spec.ts` (5),
`K/lib/entity-membership-view-v16-controls.spec.ts` (5), one same-lifetime
redo case in entity-membership-capture, and a native Vue leaf location in
the Vue admission spec.

### Mutations (each restored by content hash; logs `slice6/mutations/`)

Counts are killed cases.

- Lifecycle: L1 record 'opened' after the engine announcement 2; L2 retire
  the confirmed view after the announcement 1; L3 v15 refusal facts 4; L4
  `consequencesReleased` from the scope query alone 1; L5 a throwing
  callback's view reported staged 1; L6 abandoned reservation keeps its view
  1; L7 staged delivered without the hold 1 (the donor's in-listener
  assertion is swallowed by listener isolation, so a v16 control asserts
  outside the listener). Review follow-up: L8 abandonment without a sequence
  advance 2; L9 a throw before the reservation keeps its view 1.
- Restoration: R1 refusal by message text 1; R2 record entries before
  application 5; R3 resolve entries after application 2; R4 no transaction
  relation 4; R5 structured refusal unmarked 3.
- Link: K1 send awaiting permission not held 1; K2 no disposed check after
  the sending publication 1; K3 construction failure publishes 1; K4
  'disposed' after user cleanup 1; K5 false-idle publication 1; K6 sending
  claimed before permission 1.
- Membership: M1 restoration declarative target unheld 2 and M2 rollback
  declarative target unheld 2 (both survived the donor fixtures, which route
  through the realization adapter; killed by the declarative-delivery
  control); M9 realization adapter unheld 146; M3 clear() committed before
  tombstoning 1; M4 interrupted unit not cancelled 1; M5 frame omits rekey
  39; M6 restore published value-only 6; M7 prependOne ungrouped 1 and M7b
  prependMany ungrouped 1; M8 setAll committed before the reorder 2.
- Location: S1 dormant step resolves 2; S2 lifetime on a non-collection 1;
  S3 field presence unchecked 1; S4 label parsing 3. Survivor: S5 (no
  ownership check on the reached node) — every registered address leads to
  the node that owns it on v16 today; the check is defensive.
- Confirmed view: F1 not projected 4; F2 not copied 1.
- Admission: T1 `ToolingTree` weakened to a structural object → 3 type errors
  in the kernel typing project (unused `@ts-expect-error`); the packed
  consumer still passes under T1, because its negative cases (`{}`,
  `{ $: {} }`, a bare `tree.$`) are rejected by the weakened type too. T2
  `ISignalTree<T>` (TreeNode rebuilt from T) → 10 type errors. T3 admission
  fixed to the `location` carrier, rebuilt and packed → 48 consumer errors
  (Angular, Vue and Solid trees, both resolutions).

### Results

Per fixture after: transaction-lifecycle-view 17/17, restoration-reader
11/11, restoration-operation-outcome 8/8, entity-membership-view 14/14,
entity-membership-producer 6/6, membership-reversal-delivery 216/216,
entity-membership-link-restoration 12/12, link-state-view 26/26,
state-location-view 8/8, entity-membership-capture 11/11 (10 + the
same-lifetime control), set-all-order-reversal 36/36, entity-large-batches
11/11, Vue tooling-admission 2/2; the kernel typing spec compiles. Controls:
8, 4, 4, 2, 5, 5.

Full kernel at `c277d1ce`: 384 files, 4048 passed, 6 expected failures, 13
skipped, exit 0 (`515a6969`: 368 / 3690; +16 files and +358 tests are exactly
the new specs and cases). Each commit was also checked alone from a `git
archive` export (typecheck-all, kernel typing project, full kernel;
`slice6/commits/`): `4ce48aa5` 374 / 3954, `d20dac0f` 376 / 3977 with one
timeout (the restored observed 130k case took 7.0 s against the 5 s default
while other suites ran; 2.5 s alone; timeout added in `c277d1ce`),
`c0809eca` 379 / 4001, `c761404f` 381 / 4029, `f06a47e7` and `fbb88104` 384 /
4047; type checks exit 0 at every commit. Frameworks: angular 179 (+3
skipped), react 23, vue 63, solid 41. `tsc -p tsconfig.typecheck-all.json`,
the kernel typing project, `tools/check-spec-types.mjs` (three pre-existing
improvements, baseline not ratcheted), `nx lint kernel`, `nx lint vue`,
kernel-neutrality, dead-exports and the five-package build exit 0.
Tree-shaking: kernel-only 12.75 KB gzipped on both `515a6969` and this slice;
kernel + batching 14.23 → 14.24 KB. Not reported here originally: the
`signaltree-entities` bundle budget went 23.37 → 24.17 KB prod (+0.80 KB)
at `c277d1ce`; fixed in the size follow-up below.

`node tools/api-inventory.mjs --check` fails only on the 40 pre-existing
`d394047c` lines; `api-callable-inventory --check` only on the same fold.
`node tools/verify-consumer-typecheck.mjs` fails only on its pre-existing
PROPOSAL-0 sample (`propose()` and the `Proposal*` types left the API in
`d394047c`); a scratch copy without that block passes under bundler and
node16 with every new reader case (`slice6/full/consumer-typecheck-isolated.log`).
`check-source-controls` fails only on the pre-existing control characters in
`docs/audits/2026-10-01-v16-integration/slice1/build.log`.

### Independent review

One read-only review of `515a6969..fbb88104` (code-reviewer agent; it also
ran the full kernel on an export: 384 / 4047). No critical finding; it
confirmed hold release and unit completion on every path, transition-time
capture, refusal facts, membership commit order, the planRestore notification
against every notifier consumer, Link facts, state location, admission and
the fixture adaptations. Dispositions:

- Major: an abandoned reservation removed the pending view without a new
  sequence (snapshot changed under an unchanged sequence). Fixed in
  `c277d1ce`: `advance()`; no invented terminal event (see open item 2).
- Major: a throw between registering the view and the reservation left a
  permanent `opened` view. Fixed (covered from the 'opened' record to the
  reservation) with a control.
- Minor, membership deltas of a prepared target are delivered at publish, so
  a sibling install that throws leaves an installed change unannounced; and
  `cancel()` on a mid-unit throw publishes nothing. Both match the notifier,
  which publishes nothing for those failed operations either; the `cancel()`
  contract is now documented as such. Unchanged.
- Minor, mid-unit snapshot refusal and per-call discovery walk: documented.
- Minor, internal turns now carry `entryId`/`__transactionId`: internal only;
  a control now pins the public history shape.
- Minor, `history-changed` is also published when a pending entry is staged
  (no visible entry change), and `linkStateReader` throws rather than
  returning `undefined` for a registry-less tree: donor behaviour, unchanged.

### Size follow-up: observation behind internals-only seams

The coordinator caught a regression the slice report missed:
`check-bundle-budget` `signaltree-entities` prod 23.37 → 24.17 KB, dev
26.02 → 26.82 KB (bare unchanged) — +0.80 KB gzip for read-only tooling, against
L19 (a dormant capability imposes no active-state machinery). Budgets were not
touched (v16 is already over the inherited ceilings at `515a6969`; that is the
later size pass). Evidence: `/private/tmp/st-v16-integration-evidence/slice6-size/`.

Attribution (esbuild metafile over the built dist, prod `ngDevMode: false`,
same scenario as the gate; `compare.sh`, `slice6-vs-base.txt`), gzip delta vs
`515a6969` and per-module minified delta:

| Scenario     | Before (`c277d1ce`) | Main contributors (min)                                                                                           |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| entities     | +825 B              | entity-signal +2131 (dormant units, delta construction), mutation frame +412 (membership changes), inventory +215 |
| transactions | +1105 B             | transaction-lifecycle-view +1101, transactions +1071, entity-membership-view +610 (holds), inventory +198         |
| restoration  | +1373 B             | restoration +1528, restoration-reader +1174, membership view +610, confirmed-turn-view +335 (destroyed error)     |
| link         | +525 B              | link-state-view +913, link +581                                                                                   |
| full         | +3283 B             | all of the above                                                                                                  |

What moved. Each production owner now holds only a seam, a nullable
observer/tap that is `undefined` until the internals reader first attaches;
derivation, event construction, snapshots, sequences, queues, holds and
formatting live in the reader modules, reachable only from
`@signal-tree/kernel/internals`:

- Membership (`6d3449ca`): `I/entity-membership-source.ts`. The collection
  calls one optional tap per structural unit: FACTS after a frame commits
  (its instructions; point deltas, no scan), OPEN/CLOSE around a grouped unit
  (prepend), OPEN_ORDER/CLOSE around a bulk unit (setAll, clear, upsertMany,
  moveToFront, a reversal target), which the observer diffs from order
  snapshots taken only while someone listens. The inventory, `frameChanges`,
  `diffOrders`, delivery holds and formatting are internals-only. The mutation
  frame is back to `515a6969` (only `mutations` became readable); `visitTree`
  is back to `515a6969`. Reversal holds register through the source module, so
  transactions, restoration and the realization adapter import no reader code.
- Transaction lifecycle (`ea05968e`): `I/transaction-lifecycle-source.ts`.
  The owner keeps the pending phase record, the scope-backed
  `consequencesReleased` and a transition count (needed to answer a late
  reader); the view builds events, classifies the refusal from the owner's own
  `SignalTreeRollbackError` cause, and holds/delivers.
- Restoration (`dca4a989`): `I/restoration-source.ts` (entry ids, staging
  transaction, the owner-refusal WeakSet); `runOperation` tracks applied
  entries only while observed. `RestorationEntryId` is declared there, so its
  `tools/api-baseline.json` `declFile` moved (metadata only; symbol set
  unchanged).
- Link (`d48c4e56`): `I/link-state-source.ts`, one static record per
  relationship plus a notifier; views and sequences in the view.

Final bytes (`check-bundle-budget`, run on the final build): **entities prod
23.59 KB, dev 26.23 KB; bare 10.39 / 12.60 KB** (still failing on the
pre-existing overage: ceilings 22.6 / 25.25 and 10.25 / 12.45). Gzip delta vs
`515a6969`, dist (`final-vs-base.txt`), next to v15's own reader cost
(source-level bundles of v15 `012fd11d` with and without its reader hooks,
`stub-v15.py`; `source-level-final.txt` gives this line's source-level delta
for a like-for-like comparison):

| Scenario     | Before  | After (dist) | After (source-level) | v15 reader cost (source-level) |
| ------------ | ------- | ------------ | -------------------- | ------------------------------ |
| entities     | +825 B  | **+226 B**   | +210 B               | +825 B                         |
| transactions | +1105 B | +429 B       | +456 B               | +620 B                         |
| restoration  | +1373 B | +420 B       | +440 B               | +844 B                         |
| link         | +525 B  | +269 B       | +281 B               | +310 B                         |
| full         | +3283 B | +1172 B      | +1132 B              | +2311 B                        |
| bare         | 0       | 0            | —                    | —                              |

What remains in entities (+617 B min): one optional tap call at each of
seven sites (frame commit, the group helper, moveToFront, upsertMany, clear,
setAll, reversal install) and the source definition (entity-signal +482,
entity-membership-source +126). The `planRestore` structural `add` (the
cf98697a correctness port, not reader cost) is ~6 B gzip of it.

Decided:

1. A membership unit that throws still CLOSEs (in `finally`) and announces
   exactly what physically changed, instead of being cancelled. Events now
   agree with the snapshot after a partial failure (before, `cancel()`
   published nothing while the snapshot already showed the change). New
   control: "a unit that throws after a partial change announces exactly that
   change". The donor inventory's `cancel()` API is kept (its spec uses it).
2. Point-add neighbours are read when the frame commits (before: at each add
   inside the frame). For a multi-row frame (`addMany`, `prependMany`) an
   earlier add now names its later sibling as `afterLifetimeId` (before:
   `undefined`). This is the convention bulk units already had (one event
   describes its end state; the donor replica in
   membership-reversal-delivery defers an add until its neighbour exists).
   Pinned by two controls (single and multi-row).
3. Restoration and Link reader sequences and operation ids count from reader
   attach (the reader owns them); the lifecycle sequence stays owner-counted,
   because the owner already counts transitions for the late-attach snapshot
   (new control: a late reader sees sequence 5, current pending, no history).
4. Refusal `consequencesReleased` keeps the old value for a transaction no
   longer pending (`false`), via `!!retained?.consequencesReleased`; every
   refusal site today has it pending.
5. A reversal target's membership changes are derived at install (diff of
   the orders before and after the install) and delivered under the same
   reversal hold, before reactive publication, in commit order; the before
   order is read at install rather than at prepare. Within one
   event the order is canonical (removes, adds, rekeys, reorder) rather than
   per subject; the end state is the same.
6. Close-on-throw covers grouped and bulk units. A frame whose `commit`
   throws part-way reports nothing, as before (preparation precedes every
   apply, so this needs a failing store write).
7. A frame committed while a diffed bulk unit is open (reachable only through
   a reentrant write) is left to the unit's diff, so it is reported once.

Controls added: lifecycle late attach (1); membership partial throw in
clear(), setAll and upsertMany (3, the last two replaying events onto the
snapshot), single and multi-row point neighbours (2), a reentrant frame
inside a bulk unit (1); restoration "applied, then reactive delivery failed"
stays `applied` (1; uses the reactive test realization, the only way to reach
`AppliedDeliveryFailure`) and late attach (1); Link late attach (1).

Mutations re-run on the restructured code (`slice6-size/mutations-seam/`,
each restored by content hash; killed cases):

- Lifecycle: L1 2, L2 1, L3 4, L4 1, L5 1, L6 1, L7 1, L8 2, L9 1; new seam
  mutations L10 owner does not count transitions 8, L11 reason not read from
  the cause 2, L12 holds are no-ops 3.
- Restoration: R1 1, R2 5, R3 2, R4 4, R5 3; new R6 history changes not
  reported 2, R7 a post-completion error reported as failure 1 (survived the
  donor fixtures, whose delivery throw never reaches `AppliedDeliveryFailure`;
  killed by the new control).
- Link: K1–K6 1 each; new K7 a disposed relationship keeps its record 8.
- Membership: M1 106, M2 94, M9 146 (holds), M3 clear() closes before
  tombstoning 1, M4 an interrupted clear() not closed 2, M5 frame rekeys
  omitted 39, M5b bulk rekeys omitted 8, M6 6, M7 1, M7b 1, M8 setAll closes
  before the reorder 1; new M10 frame facts not reported 6, M11 bulk units
  take no before-order 160, M12 point-add neighbours swapped 1 (survived the
  donor fixtures; killed by the new control), M13 bulk-add neighbour dropped
  106, M14 bulk reorder not announced 40, M15 moveToFront unobserved 1, M16
  reversal target unobserved 112, M17 upsertMany unobserved 1, M18 reader
  never registers its hold 190.
- Review follow-up (new controls): M19 a frame inside a diffed unit reported
  again 1, M20 setAll closed only on success 1, M21 upsertMany closed only on
  success 1, M22 a frame add drops its after-neighbour 1, R8 operation ids not
  counted from attachment 1, K8 Link sequence not counted from attachment 1.
  M3–M5, M5b, M8, M10–M17 re-run after the review fixes to the inventory:
  M3 1, M4 2, M5 39, M5b 8, M8 1, M10 9, M11 163, M12 2, M13 106, M14 41,
  M15 2, M16 112, M17 1.
- Not re-run: S1–S5, F1–F2, T1–T3 (state location, confirmed view and
  admission code is untouched by the restructuring).

Verification on the final tree `34d37b73` (`slice6-size/verify/run2/`):
`pnpm typecheck` (deep-typing proofs, kernel typing project, typecheck-all)
0; `check-spec-types` 0; `nx lint kernel` 0, `nx lint vue` 0;
kernel-neutrality 0; dead-exports 0; devmode-foldable 0; kernel 384 files,
4058 passed (+10 controls), 6 expected failures, 13 skipped; frameworks
angular 179 (+3 skipped), react 23, vue 63 (with the tooling-admission
spec), solid 41; five-package build 0; `check-bundle-budget` entities 23.59 /
26.23 KB, bare 10.39 / 12.60 KB (fails only on the pre-existing overage);
all six attribution scenarios identical to `d48c4e56`
(`final2-vs-base.txt`). Unchanged pre-existing failures: `api-inventory
--check` (the same 40 `d394047c` lines; `RestorationEntryId`'s `declFile`
is the only metadata change and is in the baseline), `api-callable-inventory
--check` (same fold), consumer typecheck (12 errors, all PROPOSAL-0), and
`check-contract-neutrality` ("No \*.contract.ts modules found"; there are none
at `515a6969` either).

Each seam commit checked alone from a `git archive` export (typecheck-all,
kernel typing project, full kernel; `slice6/commits/<sha>-*.log`):
`6d3449ca` 384 / 4050, `dca4a989` and `d48c4e56` 384 / 4052, type checks 0
throughout. `ea05968e` had one failure, the wall-clock assertion in
entity-granular-reactivity ("repeated collection reads … cached", 6.0 ms
against `< 5`) while the reviewer ran suites in parallel; that spec passes 3/3
alone on the same export (`verify/ea05968e-granular-rerun.log`) and touches no
transaction code. The `34d37b73` tree is the run2 tree above.

### Independent review (size follow-up)

One read-only review of `993d5717..d48c4e56` (code-reviewer agent, given the
range, the L19 goal and the intended semantic changes; it ran the four reader
suites, 300 tests, and a probe of ten membership operations on exports of
both ends). No critical or major finding. It confirmed matching payloads,
order and sequences for prepend, setAll, clear, upsertMany, removeMany,
changeId and upsertOne; refusal facts at all three refusal sites; restoration
outcome classification; Link event semantics; balanced units (each producer
captures its tap once, so a reader attaching mid-unit cannot close what it did
not open); destroy and re-create; and that only the four `*-source.ts` modules
are reachable from the package root. Dispositions:

- Minor, multi-row frame neighbours changed and were untested: kept (decision
  2), control added.
- Minor, close-on-throw tested only for clear(): setAll and upsertMany
  controls added (M20, M21).
- Minor, restoration/Link attach-relative counting untested: controls added
  (R8, K8).
- Minor, `cancel()` dead and two docs stale: docs fixed; `cancel()` kept for
  the donor spec.
- Minor, `key as string | number` casts in `frameChanges`: removed.
- Minor, a frame that throws mid-commit reports nothing: as before; recorded
  (decision 6).
- Info, a reentrant frame inside a bulk unit would be double-reported:
  guarded and pinned (decision 7, M19).
- Info, reversal-target change order within an event: recorded (decision 5).
- Minor, Link records register after a reader's destroy cleanup: benign (the
  slot is per registry in a WeakMap and records leave on dispose); unchanged.

### User-visible behaviour changes in v16 (slice 6)

1. Five new read-only readers on `@signal-tree/kernel/internals` and
   `fieldSegments` on confirmed effects. Readers install no transaction or
   restoration capability; observing membership installs only that
   collection's membership producer.
2. Undo/redo/rollback that re-adds a removed row now notifies with a
   structural `add` (previously a value-only write), so Link and other
   notifier consumers see the row return.
3. `retrieve()` on a disposed Link performs no endpoint call.
4. `clear()`/`setAll()`: removed rows' subject revision/state-signal bumps
   (and setAll's zero-owner reclamation) run after the whole structural
   operation, not between rows.
5. Restoration refusals are `Error`s registered as owner refusals; messages
   are unchanged.

### Open items

1. Pre-existing gate drift from `d394047c` (one vocabulary, `propose()` folded
   into `transact()`): `tools/api-baseline.json` (25 removed, 15 added),
   `tools/api-callable-baseline.json` and the consumer typecheck's PROPOSAL-0
   sample are stale at `515a6969`. Needs its own deliberate refresh.
2. Abandoned transactions (pre-existing owner behaviour, now visible): a
   throw before the reservation or before materialization abandons the
   transaction with no engine announcement and no commit-scope settlement
   (the scope stays open, holding Link consequences); the pre-reservation
   path also leaves its `pendingTransactions` bucket, and restoration keeps
   its foreign-transaction state. The reader reports the transaction leaving
   under a new sequence, without an event. Options: (a) a public `abandoned`
   lifecycle kind; (b) the owner settles and announces on abandonment
   (changes owner semantics, also releases scope and restoration state);
   (c) keep. Decision pending.
3. Refusal vocabulary (slice-4 item 1): later PENDING overlap is reported as
   `later-confirmed-dependency`; `TransactionRefusalReason` follows the
   owner.
4. Redo of an independent lifetime while another is pending: v15 refuses
   (collection-wide), v16 admits (lifetime-scoped, L16). Recorded divergence;
   no order dependency was found in the probes.
5. A refused automatic compensation of a throwing callback stays `opened`
   (never staged). If tooling needs "callback finished", that is a new fact,
   not a reinterpretation of `phase`.
6. Vue opaque-leaf undo/redo (`preserved/vue-tooling-admission-leaf-undo.spec.ts.txt`)
   and entity-observation-gate remain preserved for slices 8 and 9.
7. The observed 130k setAll is ~3.7x v15's time without slice 9's demand
   gate (`probes/perf.log`); no performance claim either way.
8. Mutation survivor S5 (defensive ownership check in state location).
9. The v15 user guide `docs/guides/runtime-observation.md` is not carried.

## Gate repairs after slice 6 (2026-10-05)

Slice 6 merged at `8398b829` after independent re-verification:
- kernel: 384 files, 4058 passed;
- frameworks: angular 179, react 23, vue 63, solid 41;
- typecheck, spec-types, lint and kernel neutrality: pass;
- entities production bundle: 23.59 KB, which is +226 B over `515a6969`.

The gates that were already red at `515a6969` are repaired:

- `0fcde58c`: refreshes the API and callable baselines and the consumer sample
  for the `d394047c` change, which folded `propose()` into `transact()`. The
  baselines differ only by that drift. `api-inventory --check`,
  `check-callable-inventory` and the consumer type-check (bundler and node16)
  now pass.
- `4647d138`: removes ANSI escape codes from `slice1/build.log`.
  `check-source-controls` now passes.
- `f261f4a5`: deletes the orphaned `check-contract-neutrality`. Nothing runs it,
  and every module it checked was deliberately deleted.

Still red: the bundle budget. Bare was already over at `515a6969`
(10.39/10.25 KB), and entities is over too (23.59/22.6 KB). v15's ceilings do
not carry over to v16; the size and performance pass sets v16's own ceilings
and fixes what it measures.

## Slice 7: Link asynchronous settlement

Committed as `eee2786e` (carried fixtures), `b6633617` (`settled()` waits
for queued reactive writes, with its v16 controls) and the review follow-ups
`8e8a280b` and `079dd04f`, on `integrate/v16-slice7` from `f23fe37e`. Raw
logs, first reds, probes and mutation logs:
`/private/tmp/st-v16-integration-evidence/slice7/`.

Donor fixtures copied from v15 `cf98697a` with `.transaction(` →
`.transact(`. They and `link.ts` are byte-identical at `cf98697a`, `4ceb24a2`,
`012fd11d` and `d63166c9`. Each carried spec has a provenance header.

First red on `f23fe37e` (`first-red/`): link-same-turn-settlement 3/3 pass,
link-address-lifecycle 7/7 pass, link-async-settlement 7/8 (the explicit
refusal case timed out at 5 s). The 64 kernel specs that exercise Link
(`anchors-base/`): 59 exit 0; four are not in the default config (three
`*.typing.spec.ts`, and `link-lifetime`, which runs in the retention-gc
gate); the fifth is the refusal case.

### Classification

| Fixture / case | Cause on v16 | Class |
| --- | --- | --- |
| link-same-turn-settlement (3) | Already present: v16's own in-flight repair (`d2218eb0`, Sep 24, before `cf98697a`) re-checks chain identity after each drain and asks the commit authority for permission at each send. | a (present) |
| link-async-settlement: later send after a rejected one; dispose releases waiters (resolve, reject); newer value held until confirm/rollback; already-queued send rechecks the scope; waits for every scope (7) | Already present (per-send `sendEligible` permission, `settlementWaiters`, the reporting catch keeps the queue). | a (present) |
| link-async-settlement: "preserves v15 explicit refusal" | v15 settles the scope as `commit` on a refused rollback. v16 keeps the turn pending AND the scope open (`rollback-refusal-scope.spec.ts`, contract 2). Adapted: after each of two refusals only `[[1]]` is sent and `settled()` waits; `confirm()` sends `[[1],[99]]`; the final rows are `[99]`. | b |
| link-address-lifecycle (7) | Already present: v16 resolves each notification through the registry's typed address at delivery (`relativeSourceAddress`), not v15's creation-time `visitTree` index. | a (present) |

No class (c) case. Nothing in `cf98697a`'s Link hunks needed porting:

| Donor hunk | v16 equivalent |
| --- | --- |
| `drain()` re-checks `chain` identity | `settled()`'s `chain !== awaitedChain` (`d2218eb0`) |
| `hasOpenCommitScope` re-check at each lap | `sendEligible`: permission at the actual endpoint call; a deferred release re-attempts on a microtask |
| `settlementWaiters`, idempotent `dispose()`, user cleanup last | Present |
| construction failure releases everything | `dispose()` in the catch; no record (slice 6) |
| `queued`/`sending`/`registerLinkState` | Slice 6, behind `link-state-source.ts` |
| visitTree address index, plain-branch membership | Typed addresses; membership carried in slice 3c |

### New defect: `settled()` before a send caused by a reactive write

This was found by a v16 probe that is not from the donor (`explore/`). A
notifier subscriber that writes while it handles an earlier write queues a new
notification. Each hop is delivered at a later flush (one microtask). The
chain, retrievals, order captures and held sends were all empty while that
write was still queued, so from two hops `settled()` resolved before the
resulting send started or was acknowledged. One hop passed only because of
microtask order. The coordinator assigned the repair to this slice.

v15 has the same defect. Against v15 exports of `d63166c9` and `f8ff7431`
(`git archive` under `/private/tmp/st-v16-slice7-v15-export/`):
- The exploration probe (`explore/v15/*.log`): reactive hops 1–4 fail with
  `expected { received: [ 7 ], settled: true } to deeply equal { received: [ 7 ], settled: false }`.
  "Write authored after `settled()` in the same synchronous turn" also fails
  (`expected true to be false`); it passes on v16.
- The final 48-case controls (`explore/v15/controls-*.log`, an earlier
  38-case draft): 18 fail, identically on both commits. That includes the
  public-API echo through another relationship. The order-only and row-field
  failures are the reorder defect and an absent API respectively.
This is routed to the v15 Link stream as a 15.4.4 candidate; no v15 worktree
was touched.

Repair (`K/lib/link.ts`, one block). Where `settled()` would declare the
relationship idle, it asks the shared PathNotifier `hasPending()`. If anything
is queued, it waits for the next flush through a one-shot `onFlush` (a
signal, not a poll) and loops. Link's own `flushOutbound` was registered
earlier, so it has already run when the waiter resumes. The queue is
deliberately the shared one, because a hop can pass through another tree.
Work inside another relationship's endpoint call stays that relationship's.
`Link.settled()`'s doc comment now says it covers a write still queued for
delivery; the API and callable baselines are unchanged. The slice-6 Link
reader is unchanged: the activity tuple has no new fact, and a `settled()`
waiting on a flush holds no Link work.

### v16 controls

`K/lib/link-reactive-settlement.spec.ts` (48 cases):
- scalar chains of 1, 2, 3, 6 and 12 hops, each with a slow and a
  synchronous endpoint;
- a chain that passes through another tree;
- `settled()` requested inside a hop;
- mixed entity and scalar hops: linked scalar, collection and row field, and
  an order-only hop;
- hops that write nothing or an equal value;
- pending transactions:
  - hops of a write authored in the callback, confirm and rollback, 2/4 hops
    and a 12-hop rollback;
  - hops triggered by the rollback compensation itself;
  - an ordinary write made while a transaction is pending, then confirm or
    rollback;
  - a hop that opens its own transaction, with 0 or 3 hops before it;
  - a transaction confirmed before delivery;
- `destroy()` mid-chain, three cases bounded to "nothing or the one chain
  value" so they hold whether or not a later slice makes `destroy()` dispose
  Links;
- `dispose()` from a hop;
- two public-API relationship echoes.

With the flush wait removed (the `f23fe37e` `settled()`), 26 fail. The other
22 are preservation and boundary controls:
- `transact()` drains its queue with `flushSync`, so hops of a write
  authored in the callback run synchronously while the scope holds the send;
- `confirm()` and `rollback()` do not drain;
- one hop, writes-nothing, order-only (`pendingOrders`) and dispose.
Three repeated runs are stable (48/48).

### Mutations (each restored by content hash; logs `mutations*/`)

Counts are killed cases.

- Wrong fixes, on the final 48 cases (`mutations-r6/`):
  - RM1 one flush, then stop: 22.
  - RM2 check the queue only before the chain wait: 1 (the canonical value
    relayed by hops, added after RM2 survived the first draft).
  - RM3 wait only while `dirty`: 26.
  - RM4 wait only for this tree's queued writes: 1 (the cross-tree chain,
    deepened to three source hops after RM4 survived).
  - RM6 no flush wait: 26.
- Existing v16 code behind the donor cases that already passed
  (`mutations/`, the three carried files):
  - EM1 no chain-identity re-check: 3.
  - EM2 weak `settled()` (`await chain`): 4.
  - EM3 a released send uses its stale value: 1.
  - EM4 a send without the commit authority: 5.
  - EM5 `dispose()` keeps the waiters: 2.
  - EM6 a rejection wedges the queue: 2.
  - EM7 `settled()` after `dispose()` waits: 2.
  - EM9 leaves are not armed: 10.
  - EM10 (`mutations-em10/`) a creation-time position index: 7.
  - TM1 (`transactions.ts`) a refusal releases the scope, v15's law: 1, the
    adapted case.
  - Survivor EM8, membership deltas ignored: the donor address cases always
    carry the whole profile value. `branch-omission-correctness` (slice 3c)
    kills it: 11 (`mutations-em8/`).

### Results

Per fixture after: 3/3, 8/8, 7/7; controls 48/48.

The Link-related specs plus rollback-refusal-scope and recovery-handle-0 were
run with the fix applied, before the final control additions
(`anchors-after-fix/`): 63 files, 659 passed, 0 failed.

Verification at `b6633617` (`verify/run1/`), all exit 0 unless noted:
- full kernel: 388 files, 4116 passed, 6 expected failures, 13 skipped;
- frameworks: angular 179 (+3 skipped), react 23, vue 63, solid 41;
- `pnpm typecheck`;
- `check-spec-types` (three pre-existing improvements; baseline not
  ratcheted);
- lint on all five projects;
- kernel-neutrality, source-controls, `api-inventory --check`,
  callable-inventory;
- five-package build;
- consumer typecheck (bundler and node16);
- retention-gc: 3 files, 10 tests;
- `check-bundle-budget` exit 1 on the pre-existing overage only.

The follow-ups change only the controls spec:
- full kernel at `8e8a280b`: 388 files, 4124 passed, 6 expected failures, 13
  skipped (`verify/final/`); `f23fe37e` was 384 / 4058, so +4 files and +66
  cases = 3 + 8 + 7 + 48;
- at `079dd04f`: the controls (48/48), spec-types and kernel lint.

Audit probes (`probes/`; p01/p08 from the v16 export, x01/x03 adapted) are
identical before and after: p01 30 pass / 3 fail, p08 15/1, x01 17/10,
x03 3/0. The failures are P01d and six x01 cases (head-of-collection
restore order, CAB/CDAB), four X01b undo/rollback reorders (reorder
propagation) and P08d (`tree.destroy()` does not release a `settled()`
waiter). These are the three v15 defects deferred to a later slice; none is
needed by a section-7 falsifier. On v15 `d63166c9`, X01b fails the forward
cases instead.

Size (`size/`, esbuild attribution over the built dist, prod):

| Scenario | `f23fe37e` | `079dd04f` | Delta |
| --- | --- | --- | --- |
| link | 16.74 KB gzip | 16.77 KB | +25 B gzip, +84 B min, all `lib/link.js` |
| full | 64.91 KB | 64.92 KB | +14 B gzip, +88 B min, all `lib/link.js` |
| entities, bare, transactions, restoration | — | — | 0 |

`check-bundle-budget`, before and after: entities 23.59 / 26.23 KB, bare
10.39 / 12.60 KB (unchanged; still over the inherited ceilings).

### Independent review

One read-only review (code-reviewer agent), given the raw diff and the PLAN
contracts. It ran the destination specs and the carried and control specs on
an export of `b6633617`: inflight-settlement-audit 9, commit-ordering 7,
drain-settlement 2, structured-address-audit 19, value-roundtrip 2, all
passing.

Its first pass stopped when a command was denied: building a second export
with `f23fe37e`'s `link.ts`. That command was not rerun on its behalf. It
then read the pre-fix logs from this slice's own runs instead.

No critical finding, and no runtime defect in the `settled()` wait. It
checked:
- that a flush is guaranteed whenever a waiter exists: `notify`, `flushSync`,
  `clear`/reset, batching disabled;
- callback order and reentrancy;
- that there is no leak beyond one microtask after `dispose()`.

Dispositions:
- **Major: 13 of the 14 transaction controls did not discriminate.** Fixed
  in `8e8a280b`: compensation-triggered hops, an ordinary write while
  pending, and a transacting hop after three hops; destroy bounds added.
- **Minor: the in-flight destroy control pinned the deferred
  destroy-keeps-Links behaviour.** Its send starts after `destroy()`. Fixed
  in `079dd04f` with the either-outcome bound.
- **Minor, kept:** `settled()` depends on unrelated trees' queued writes, at
  most one flush per lap; this is documented.
- **Minor, kept:** `onFlush`/`hasPending` are called without `?.` while the
  older registration uses `?.`. The notifier is the concrete `PathNotifier`.
- **Minor, kept:** the 1-hop, order-only, writes-nothing and dispose
  controls pass both ways by design. Carried same-turn and address cases
  passed before this slice and are regression carriers.
- **Info:** writes deferred outside the notifier stay outside the repair's
  reach (open item 3). The controls use real timers.

### User-visible behaviour changes in v16 (slice 7)

1. `link().settled()` also waits for sends caused by writes still queued for
   notification delivery, including reactive writes several hops away and
   through other trees. While anything is queued, each check costs one more
   flush (microtask).
2. `Link.settled()`'s doc comment says so. There is no API or type change.

### Open items

1. **Reactive-hop `settled()` defect on v15.** Reproduced on `d63166c9` and
   `f8ff7431`, including the public-API echo. Routed to the v15 Link stream
   (15.4.4). v15 also fails a write authored after `settled()` in the same
   synchronous turn.
2. **Rollback of a transaction whose hops wrote derived values.** The held
   derived value is sent at release, then the re-derived one, for example
   `[7, 0]` (`explore/explore2-base.log`). It is current truth under the
   tree-wide hold; whether a send should wait for a quiet queue before
   reading its value is a separate decision.
3. **Writes outside the notifier are not covered.** A hop that writes from
   `queueMicrotask`, a framework effect, or another relationship's endpoint
   I/O is visible only once it reaches the queue.
4. **`destroy()` with a held send.** `settled()` never resolves, because
   `cancelCommitScopes` drops held consequences (P08d family,
   `explore2-base.log`). This belongs to the deferred `destroy()`-disposes-Links
   work.
5. **The three deferred v15 Link defects reproduce unchanged on v16**
   (probes above).
6. **Minor divergence:** `retrieve()` on a disposed relationship without
   `get()` throws on v16 and returns on v15.

## Slice 8: atomic registered-terminal reversal

Committed as `f589bbb1` (the repair with the carried fixtures), `8dc48472`
(v16 controls), `b334b7c8` (the preserved Vue block restored) and the review
follow-up `930aa086` (omitted-terminal controls),
on `integrate/v16-slice8` from `269ef687`. Raw logs, first reds, probes,
mutation logs and size attribution:
`/private/tmp/st-v16-integration-evidence/slice8/`.

Donor `2892b650`. Its four fixtures and its three runtime hunks are identical
at `2892b650`, `4ceb24a2`, `012fd11d` and `d63166c9`. The fixtures are carried
with `.transaction(` → `.transact(` only, each with a provenance header. v16's
`undo-nonscalar-leaf.spec.ts` and `conforming-collection-prototype.spec.ts`
were byte-identical to the donor's parent, so the donor's updates apply as
written. The donor removed the per-case "former assertions" from
undo-nonscalar-leaf, so its closure note now restates them beside the
historical finding.

There was no donor-on-v15 run. Its `git archive` export command was denied,
and the coordinator then dropped the run: the fixtures are v15's own tests and
shipped in 15.4.0.

First red on `269ef687` (`first-red/`):
- kernel opaque-leaf-restoration: 14 of 20 failed;
- undo-nonscalar-leaf: 5 of 7 failed, `Unsupported scoped undo effect at
  rows|when|lookup|seen`;
- conforming-collection-prototype: 1 of 7 failed (CANONICALITY);
- Vue opaque-leaf-restoration: 8 of 9 failed;
- Vue tooling-admission with the preserved block restored: 2 of 2 failed.

There were two mechanisms, plus one smaller v16 defect:
1. **Capture split terminal objects into fields.** Capture split a
   plain-object replacement of a registered terminal into per-field effects at
   the terminal's own slot (`bounds.min`, `bounds.max`). Both transactions and
   restoration did this. No realization path applies such effects, so undo,
   redo, jumpTo and transaction rollback all refused with `structural-drift`.
   Automatic compensation of a throwing callback was refused the same way and
   handed back a recovery handle.
2. **Admission refused non-scalar values.** Restoration admission
   (`isSupportedEffect`) refused any non-scalar value at a top-level terminal:
   arrays, Date, Map, Set, and null → object.
3. **Delivered external `undefined` was dropped.** Restoration deleted it from
   external truth, although the same write still in the queue was honoured.
   For a scalar leaf this meant undo refused before the flush, but after the
   flush it overwrote the external `undefined` (`probes/p2-*.txt`, S1/S1q).

### Classification

| Fixture / case | Cause on v16 | Class |
| --- | --- | --- |
| opaque-leaf-restoration: undo/redo whole object, both orders, with and without a preceding entity transaction (4); confirmed object-leaf transaction undo, both orders (2); restoration alone (1); shape change from `{min,max}` (1) | Restoration capture split the object at the terminal's slot, which gave `structural-drift`. Fixed by the restoration capture hunk. | a |
| opaque-leaf-restoration: shape change from `null` | `null` → object was already one effect, but admission refused the non-scalar value (`…at bounds`). Fixed by the admission hunk. | a |
| opaque-leaf-restoration: transaction-only rollback | Transactions capture split the object, so compensation refused with `structural-drift [effect-validation-failed]`. Fixed by the transactions capture hunk. | a |
| opaque-leaf-restoration: external truth with a safe sibling; pending overlap refusal and retry; redo after external `undefined`; external `undefined` refuses undo (4) | The split effects refused before the external-truth and overlap checks were reached. The two external-`undefined` cases also need the external-truth hunk (RM8). | a |
| opaque-leaf-restoration: ordinary branch children | Passed already. Plain-branch writes are per leaf on v16, because each child owns a slot. This is a topology preservation control (EM1 kills it). | a (present) |
| opaque-leaf-restoration: structural drift beside an atomic leaf | Passed on `269ef687` only because the split terminal itself drifted. After the slice the refusal comes from the rekey (EM2 kills it), and a v16 no-drift control discriminates. | a (present, now discriminating) |
| opaque-leaf-restoration: a retained slot does not permit restoring an externally omitted terminal | Passed already: external membership truth refuses it (EM3). RM7 shows that admission must not decide liveness. | a (present) |
| opaque-leaf-restoration: rollback after external `undefined`, three orders | Passed on `269ef687` by refusal: the split `bounds.min` was a later-confirmed dependency of the external `bounds` write. After the slice the rollback completes: the external write supersedes the terminal contribution, as it does for a scalar. The donor case admits both outcomes; the v16 controls pin completion (EM4 kills both). | a (outcome changed) |
| undo-nonscalar-leaf: Array, Date, Map, Set, mixed turn (5) | Admission refused non-scalar terminal values. Fixed by the admission hunk. | a |
| conforming-collection-prototype: CANONICALITY | The same, for an array terminal. | a |
| Vue opaque-leaf-restoration (8 of 9) | The same mechanisms as the kernel, through native Vue leaves. The branch control passed. | a |
| Vue tooling-admission, the block preserved in slice 6 (class c there) | Restored live in place of the scalar stand-in. Failed on `269ef687` in both orders. | a |

There is no class (b) or (c) case.

### Ported (the donor's three conceptual hunks, against v16)

The slot test is the existing scalar-slot authority, `resolveScalarSlot` on the
tree's runtime. Each site also requires a subject-less write.
- **`E/transactions/transactions.ts` `captureEffects`:** a plain-object pair
  at a registered slot stays one `set` effect. Branches and entity rows still
  decompose by field.
- **`E/restoration/restoration.ts` `captureEffects`:** the same guard. It also
  covers the 15.4.2 historical capture, which uses the same function.
- **Restoration `isSupportedEffect`:** a subject-less `set` on a registered
  slot is admitted, whatever its payload. Admission decides the effect kind
  only. Liveness stays with the external membership truth and the value-truth
  checks, both of which run before anything applies.
- **The restoration notifier subscription** keeps a delivered external
  `undefined` as truth at a registered terminal. A collection notification
  with no value still clears it.

Checked and left unchanged:
- **The leaf interceptor** records realized truth, including `undefined`, and
  has no deletion path. It is not what protects these shapes (EM5);
  `readQueuedExternalAuthority` and the subscription are.
- **`readQueuedExternalAuthority`** already kept a queued `undefined` for every
  non-subject path. That was the source of the queued-versus-delivered split.
- **`applyDirectedTurnTransition`** (jumpTo and temporal restore) has no
  admission gate on either line. Validation and external truth decide there.
  Adding the gate (XG1) changes no result in the eight jumpTo specs or the
  full kernel and Vue runs.
- **No liveness check on external `undefined`.** v16 announces an omission as
  a membership change on the parent, not as an `undefined` write at the
  terminal (`probes/p1-out-base.txt`). Every re-add path notifies the member's
  value before its membership, which clears the path truth (`probes/p2`,
  S2/S3). An externally omitted terminal is refused by membership truth. A
  variant that keeps `undefined` only for a non-dormant terminal (RM11) is
  equivalent on every test.

### v16 controls

`K/lib/opaque-leaf-restoration-v16-controls.spec.ts`: 62 cases at `8dc48472`,
and 71 with the review follow-up (see "Independent review"). The orders
are transactions alone, transactions first and restoration first, where each
applies.
- **Pending inspection:** one `bounds` change at address `['bounds']`, which
  becomes `superseded` after an external replacement.
- **Automatic compensation of a throwing callback:** the terminal is restored,
  the callback's own error is rethrown, and there is no recovery handle.
- **A refused compensation (forced, `throw undefined`):** recovery reports
  `callbackFailed` with an undefined `callbackError`. Its `inspect()` shows
  one terminal change, and its `rollback()` restores the whole object.
- **Pending rollback after an external `undefined`:** the exact v16 outcome,
  for an object terminal and for a scalar leaf. The terminal change is
  `superseded`, rollback completes, the terminal stays present and
  `undefined`, and the sibling reverts.
- **Atomic replacements:** array, Date, Map, Set and plain-object terminals
  roll back as one inspected change, and a confirmed replacement undoes and
  redoes as one value.
- **External `undefined`, still queued and delivered:** for an object
  terminal and a scalar leaf, undo and redo refuse with ST1034. The value and
  own presence are kept, the sibling is unchanged, and the index and
  `canRedo()` are unchanged. A later authored write releases the terminal.
- **jumpTo:** moves an object terminal as one value, and refuses an external
  `undefined` atomically.
- **Nested terminal:** a terminal nested in a plain branch restores
  atomically while its siblings stay independent.
- **Drift discriminator:** the no-drift twin of the donor structural-drift
  case: the same turn undoes cleanly.
- **Readers:** the confirmed-turn reader shows one terminal effect with no
  `fieldSegments`, while entity rows keep `['name']` and `['meta']`. The
  restoration reader keeps the entry status across undo and redo.

On `269ef687` 43 of 62 fail (`controls/final-base.log`). The 19 that pass are
preservation controls: scalar-leaf rollback (3), array/Date/Map/Set rollback
(12) and the queued scalar refusals (4). The restored Vue tooling-admission
block keeps the slice-6 reader entry-status checks on the leaf entry.

### Mutations (each restored by content hash; logs `mutations/`)

Counts are killed cases, on the 62-case controls (the follow-up's own
mutations are under "Independent review"). The repair suite has six files: the four donor files
(kernel and Vue opaque-leaf-restoration, undo-nonscalar-leaf,
conforming-collection-prototype), the controls and Vue tooling-admission.
"Full" means the whole kernel suite (4225 cases) plus Vue (72).

Wrong repairs:
- **Transactions capture:**
  - RM1r split every plain record (the hunk reverted): 18. That is the donor
    rollback case and 17 controls. Restoration history does not read
    transaction effects, so the donor undo cases survive this mutation.
  - RM1 never split, entity rows included: 2 (the row-field control). The
    first run's log labels this mutation "reverted"; its `false` actually
    disabled every split, and RM1r is the true revert.
  - RM2 "no subject means terminal", slot ignored: 0 on the suite.
- **Restoration capture:**
  - RM3 the hunk reverted: 38.
  - RM4 no subject means terminal: 0 on the suite.
- **RM246, all three slot tests replaced by "no subject":** 0 on the suite.
  On the full run it kills 1: `path-notifier-enqueue` "fails inspection
  closed after a hostile record". A plain record at a position with no slot
  must still be read field by field there, so the slot, not the missing
  subject, is what decides.
- **Admission:**
  - RM5 the hunk reverted: 54.
  - RM6 admit any subject-less `set`: 0. Every capture now emits either slot
    effects or field paths, which the existing clause already admits.
  - RM7 admit only a live (non-dormant) terminal: 1. The omitted-terminal
    case then fails with "Unsupported…" instead of ST1034: liveness belongs
    to membership truth.
- **External `undefined`:**
  - RM8 the hunk reverted: 12.
  - RM9 kept only when the previous payload was an object: 4 (the scalar
    delivered controls).
  - RM10 kept for every path, collections included: 0, on the suite and on
    the full run.
  - RM11 kept only for a non-dormant terminal: 0. This is an equivalent
    alternative, not a wrong one (see "Ported").

Existing v16 code behind the donor cases that already passed:
- EM1 construction builds nested plain objects as terminals: 11, including
  the branch control in kernel and Vue.
- EM2 rekey validation ignores a drifted key: 1 (the structural-drift
  sibling).
- EM3 external membership truth ignored: 1 (the omitted terminal).
- EM4 rollback compensates a superseded contribution: 9 (the three donor
  rollback orders and six controls).
- EM5 the leaf interceptor records no realized truth: 0.
- EM6 queued authority records no path truth: 8 (the queued controls).
- EM56 both of the last two: 8. Queued truth is owned by
  `readQueuedExternalAuthority`.

Exploration: XG1, an admission gate in `applyDirectedTurnTransition`, killed
0 on the jumpTo specs and 0 on the full run.

### Results

Per fixture after: kernel opaque-leaf-restoration 20/20, undo-nonscalar-leaf
7/7, conforming-collection-prototype 7/7, Vue opaque-leaf-restoration 9/9,
Vue tooling-admission 2/2; controls 62/62. `opaque-terminal-snapshot.spec.ts`
and the recovery/inspection anchors pass in the full run.

Verification at `b334b7c8` (`verify/run1/`), all exit 0 unless noted:
- full kernel: 390 files, 4206 passed, 6 expected failures, 13 skipped
  (`269ef687` was 388 / 4124, so +2 files and +82 cases = 20 + 62);
- frameworks: angular 179 (+3 skipped), react 23, vue 72 (+9), solid 41;
- `pnpm typecheck`;
- `check-spec-types` (the same three pre-existing improvements; baseline not
  ratcheted);
- lint on all five projects;
- kernel-neutrality, source-controls, `api-inventory --check`,
  callable-inventory;
- consumer typecheck (bundler and node16);
- five-package build;
- `check-bundle-budget` exit 1 on the pre-existing overage only.

The follow-up `930aa086` changes only the controls spec. Rechecked at that
commit (`verify/final/`): full kernel 390 files, 4215 passed, 6 expected
failures, 13 skipped (+9 cases); controls 71/71; spec-types; kernel lint.

Size (`size/`, esbuild attribution over the built dist, prod, with the
package's `sideEffects`):

| Scenario | `269ef687` | `b334b7c8` | Delta |
| --- | --- | --- | --- |
| transactions | 36.25 KB gzip | 36.27 KB | +22 B gzip, +84 B min, all `transactions.js` |
| restoration | 35.69 KB | 35.73 KB | +50 B gzip, +234 B min, all `restoration.js` |
| full | 64.92 KB | 64.98 KB | +62 B gzip, +318 B min |
| entities, bare, link | — | — | 0 |

`check-bundle-budget`, before and after: entities 23.59/22.6 KB prod and
26.23/25.25 KB dev; bare 10.39/10.25 KB prod and 12.60/12.45 KB dev. These
are unchanged and still over the inherited ceilings.

### Independent review

One read-only review (code-reviewer agent), given the raw diff, the plan text
for section 8 and the destination contracts, without this record. It ran:
- all the carried and control specs on the worktree;
- the same specs on its own export, with only the two runtime files reverted
  to `269ef687`: kernel opaque-leaf-restoration 14/20 failed, matching the
  header, and about 45 controls failed;
- probes written in the export only.

Verdict: minor only. No critical or major finding, and no missed capture,
admission or external-truth path: historical capture, jumpTo, rollback
planning, pending inspection and recovery handles were checked. It also found
no destination-contract regression, and no row or branch misclassification:
an entity row field `meta: {a}|undefined` still splits.

Dispositions:
- **Minor: the omitted-terminal case covered only undo with restoration alone,
  and passed before the slice.** Fixed in `930aa086` with nine controls:
  pending rollback (three orders), undo and redo (both orders), and an
  external re-add. On `269ef687` 5 of the 9 fail. Mutations on the final
  controls:
  - EM3 (membership truth ignored) kills undo and redo, 4;
  - RM7 kills 4;
  - RM1r kills the three rollbacks;
  - the re-add survives EM3 and a mutation that ignores the tree-level value
    truth (EV, 17 other kills). Disabling both kills it (EM3EV).
  - EM4 does not kill the rollbacks: compensating the superseded terminal
    would write only into its dormant slot, which no public read sees (open
    item 1).
- **Minor: a registered terminal inside an externally omitted plain branch is
  still written by undo and redo.** The probe was
  `{a:{bounds:leaf(), n:0}, count:0}` with `tree.$({count:1})` applied
  externally. The detached handles read the restored values, while `tree.$()`
  stays without `a`. A plain scalar in that branch behaves identically on
  `269ef687`: membership truth is per member and is not inherited. Recorded
  in open item 1; not pinned either way.
- **Info: external-`undefined` retention covers every registered slot,
  including plain scalars.** This is intended (donor rule). It is recorded as
  user-visible change 5, and the controls pin it.
- **Info: no Angular, React or Solid spec for terminal reversal.** The hunks
  key on the framework-neutral `resolveScalarSlot`. Vue covers native leaves.
  Unchanged.
- **Info: the leaf interceptor and queued authority needed no change.** This
  agrees with "Ported".

### User-visible behaviour changes in v16 (slice 8)

1. **Atomic undo, redo, jumpTo and rollback.** These now work for a
   registered terminal holding a plain object (`leaf({...})`), an array, a
   Date, a Map or a Set, and for null ↔ object, in both enhancer orders and in
   Vue. Before, they refused with `Unsupported scoped undo effect at
   structural-drift` or `at <path>`. A turn mixing such a terminal with
   scalars is no longer refused as a whole.
2. **A throwing `transact()` callback is compensated** when it wrote such a
   terminal. The callback's own error is rethrown, with no recovery handle.
   Before, compensation was refused, the error was a `SignalTreeRollbackError`
   with `recovery`, and the turn stayed pending.
3. **Inspection reports one change per terminal.**
   `PendingTransaction.inspect()` and recovery-handle inspection report
   `{ path: 'bounds', address: ['bounds'] }`, not `bounds.min`/`bounds.max`.
   The confirmed-turn reader reports one effect with no `fieldSegments`, and
   `getRestorationHistory()` entries hold one effect.
4. **Rollback after an external replacement or `undefined`.** A later external
   write to the terminal supersedes the pending terminal change: the change is
   `superseded` and rollback completes the rest. Before, the split field
   effects made it a `later-confirmed-dependency` refusal.
5. **Delivered external `undefined` is protected, scalar leaves included.**
   Undo, redo and jumpTo now refuse with ST1034 after the flush. Before the
   flush they already refused; after it they overwrote the value.
6. No API, type or export change.

### Open items

1. **Undo or compensation into a dormant terminal.** This is pre-existing and
   beyond the donor. Admission by slot registration lets a reversal write
   into a terminal that is not currently live when no membership truth
   covers it. That happens in two cases:
   - (i) an ordinary (non-designated) authored omission of the terminal
     itself, then undo of an earlier write (`probes/p2-*.txt`, S4);
   - (ii) an external omission of an ancestor branch, then undo or redo
     (review probe). Membership truth is recorded per member, not inherited.

   The reversal succeeds and writes the value into the dormant slot, which
   reads cannot see. The member stays absent, and the siblings revert. Scalar
   leaves behaved this way at `269ef687`; object terminals now match them,
   where before they refused with `structural-drift`. The scalar frame
   bypasses `reactivateOnWrite`, against member-membership's rule that
   writing an absent descendant reactivates it. Options:
   - (a) refuse when the target or an ancestor is dormant and the reversal
     does not restore it;
   - (b) keep the hidden write;
   - (c) restore membership with the value.

   Recommendation: (a) for (ii), where external truth owns the ancestor's
   absence; decide (i) with (a) or (c) for scalars and terminals together.
   The admission rule is the same in v15 `d63166c9` (source read only, not
   run). Routed to the coordinator.
2. **Slot clauses that no test discriminates.** No v16 producer emits a
   subject-less plain record at a position without a slot. Only the synthetic
   hostile-record case (`path-notifier-enqueue`, on the transactions path)
   tells "no subject" apart from "registered slot". The restoration capture
   and admission slot clauses (RM4, RM6) and the collection limit on external
   `undefined` (RM10) are therefore scope guards that no test pins.
3. **jumpTo has no admission gate** on either line (XG1 is inert). Recorded,
   not changed.
4. **Admission refusals are plain `Error`s.** `Unsupported scoped undo effect
   at <path>` is not registered as an owner refusal, so the restoration reader
   does not classify it as `refused`. Pre-existing and unchanged.
5. **The leaf interceptor's realized-truth record** is redundant for the
   tested shapes (EM5). It has no `undefined` deletion. Unchanged.
6. **The bundle budget** is still over the inherited ceilings, unchanged by
   this slice.

## Slice 8b: hidden registered locations, slot guards, typed refusals, adapters

Commits on `integrate/v16-slice8b`, from `bbbb4ba2` (slice 8 merged):
- `cedf0f40`: a hidden location is restored fully or refused;
- `9ed8c75f`: admission refusals are typed, and the slot guards are pinned;
- `7a47f3e5`: adapter specs;
- `019d9da0` and `351d2849`: the two review follow-ups.

This slice covers slice 8's open items 1–5, decided by the owner
(2026-10-05). Raw logs, first reds, probes, mutation logs and size
attribution: `/private/tmp/st-v16-integration-evidence/slice8b/`.

### Open item 1: reversing a hidden location

An omitted member hides a location. The member is either the location itself
or a plain branch above it.

Baseline on `bbbb4ba2` (`probes/p1-base.txt`, both enhancer orders, scalar
and object terminal):
- **Ordinary omission of the location, then undo, redo or jumpTo:** "ok". The
  value is written into the dormant slot, and the member stays absent.
- **Ordinary or external omission of an enclosing branch:** "ok" as well. A
  detached handle reads the restored value, but `tree.$()` still lacks the
  branch.
- **External omission of the location itself:** refused with ST1034 (slice
  8).
- **Entity rows, adds, removes and reorders inside an omitted branch:**
  written into the hidden collection, even under external omission (review,
  probe `p3.txt`).

**The 15.4.2 analogy, checked before implementing (i).** The rule is pinned
by `external-authored-baseline.spec.ts`, "keeps the baseline of an already
recorded earlier authored turn":
- an ordinary write at the location in a later turn leaves the designated
  turn in history (`getRestorationHistory()` length 1);
- undo restores the pre-image over that later write (`x` 6 → 0).

Without the external write, a probe gives the same result in both orders:
undo → 0, redo → 1. "later ordinary replacement cannot erase designation of
the same scalar" is the same-turn variant (HIST-C2). No spec pins a different
rule.

**Ported. This is v16-only; there is no donor.**
- **New helpers** in `I/plain-branch-membership.ts`:
  - `hidingMembers(root, position)` walks the registry's structured address
    and returns the omitted members, outermost first.
  - `composeHiddenMemberValue` builds the whole re-add value. It takes the
    member's retained state locations, never a collection or marker, and
    installs each target at its keys. Hidden members on a target's way are
    re-added; other hidden members stay absent.
- **Restoration (`applyTurnEffectsThroughRealizationPort`).** Before anything
  applies, it checks every slot value effect, entity row effect, structural
  effect and order delta whose location is hidden.
  - **External omission.** If any hiding member has external membership truth
    `present: false`, the reversal refuses with ST1034. Nothing is applied.
  - **Ordinary omission.** The outermost hidden member is re-added as one
    membership effect. That effect carries the slot targets; row and order
    effects then apply as usual.
    - Collections under that member are found under it, because the
      current-tree walk skips them.
    - A member that the reversal itself re-adds or omits is left to the
      reversal's own effect.
  - **Pending work.** A re-add refuses with ST1034 while pending work sits on
    the member or below it, because the re-add would expose speculative
    state.
  - **Unwalkable location.** A member that cannot be re-added, or a
    registered address that no longer walks to its owner, is refused with a
    typed `structural-drift` refusal.
- **Transactions (`getPendingRollbackPlan`).** A later *pending* membership
  change of an enclosing member counts as a dependency, like a later pending
  write at the location. The earlier rollback refuses with
  `later-confirmed-dependency`, keeps its recovery, and retries after the
  later turn settles. Enclosure is a strict prefix of structured addresses,
  never a display path.

**Rollback (decision not dictated; settled through review).**
- **Under an omitted enclosing branch**, rollback compensates the retained
  slot, as on `bbbb4ba2`. The branch stays omitted.
- **Why not supersede.** `cedf0f40` first made such an omission supersede the
  contribution. Review found that the rolled-back value then stayed in the
  hidden slot, and the next re-add brought it back. `019d9da0` withdrew that
  supersession.
- **Why not refuse.** v16's rollback never overwrites a later write, and its
  refusal rule is the pending dependency above.
- **The location itself omitted.** That omission still supersedes the
  contribution, as a later replacement does.
- **Owner confirmation needed.** This is a deliberate write into a dormant
  slot during rollback. It is not observable until a re-add, and it is what
  keeps a re-add correct. The reviewer asked for owner confirmation of this
  reading of "never silent".

**Re-adding a branch (decision not dictated).** The branch's untouched members
keep their retained values. Those are what they held when it was omitted, or
what a later hidden write left there. A turn's own membership effect (its
captured before-image) takes precedence.

### Open item 2: slot guards pinned

`E/restoration/registered-slot-guards.spec.ts` has 12 cases, each run with
restoration alone, transactions first and restoration first. The notifications
are synthetic, as in `path-notifier-enqueue`.
- **Capture:**
  - at an unregistered position, a hostile record is read field by field (the
    getter is reached and reported);
  - at a registered terminal, the same record is one value and is never read.
- **Admission:**
  - an array at an unregistered position is refused, typed;
  - the same array at a registered terminal is admitted and applied.

### Open item 3 (slice 8 item 4): admission refusals are refusals

Admission (`Unsupported scoped undo effect at <path>`) now throws through
`restorationRefusal`, as ST1034 and the structured validation refusals do. The
restoration reader reports `refused` with no affected entries. Genuine
validator exceptions stay `failed` (`restoration-operation-outcome`). Item 1's
refusals use the same path.

Carriers:
- Vue checks `refused` through the reader.
- Angular, React and Solid check the ST1034 refusal through their adapters.
  Their test configurations have no internals alias.

### Open item 4 (slice 8 item 5): adapter specs

| Spec | Cases |
| --- | --- |
| `packages/angular/src/lib/opaque-leaf-restoration.spec.ts` | 8 |
| `packages/react/src/opaque-leaf-restoration.spec.tsx` | 6 |
| `packages/solid/src/lib/opaque-leaf-restoration.spec.ts` | 6 |
| `packages/vue/src/lib/opaque-leaf-restoration-v16-controls.spec.ts` | 6 |

All run in both orders, and each result is read through the adapter: Angular
`computed`, React `useSignalTree`, a Solid memo, Vue `computed`. They cover:
- an object terminal plus a Map (a Date in React), undo and redo;
- an external `undefined` refusal;
- an ordinary omission re-added by undo.

### jumpTo keeps no admission gate (slice 8 item 3)

jumpTo and temporal restore (`applyDirectedTurnTransition`) stay without
`isSupportedEffect`.
- **No effect.** In slice 8's exploration XG1, adding the gate changed no
  result in the eight jumpTo specs or in the full kernel and Vue runs.
- **Covered elsewhere.** Validation, external truth and, since 8b, the
  hidden-location check decide there. The 8b specs cover jumpTo for both
  re-adding and refusing.
- **Redundant.** The gate would only duplicate them for effects no v16
  producer emits.

### v16 controls and first red

`E/restoration/hidden-terminal-reversal.spec.ts` has 158 cases:
- **Ordinary omission:**
  - undo re-adds with the pre-image, and redo and undo stay symmetric;
  - redo after the omission re-adds with the after-image;
  - jumpTo re-adds.
  - Each is covered for scalar and object terminal, for the location itself
    and an omitted branch, and in three orders.
- **Re-add shape:**
  - a branch keeps its other members as they were when omitted;
  - hidden members on the way are re-added, and others stay absent;
  - a turn with a collection reorder re-adds through the declarative target.
- **External omission:**
  - undo, redo and jumpTo refuse, with no notification and the snapshot,
    index and `canRedo()` unchanged;
  - an external omission above an authored one refuses;
  - the reader reports `refused`.
- **Pending rollback (three orders):**
  - the rest rolls back;
  - under an omitted branch, the hidden slot holds the pre-image;
  - for the location itself, nothing is written.
  - Rollback still compensates under an unrelated omission and beside a
    literal dotted sibling key.
- **Ordering:** a turn's own membership effect wins over a later hidden
  write.
- **Review follow-up:**
  - no rolled-back contribution resurfaces on re-add;
  - a re-add refuses while pending work sits under it, or while a pending
    transaction itself omitted the member;
  - entity update, add, remove, reorder, and slot plus reorder inside an
    omitted branch are restored through the collection (ordinary) or refused
    (external);
  - a branch holding a collection is re-added for a slot target;
  - an earlier rollback stays pending while a later pending turn omits its
    branch.

First red on `bbbb4ba2` (`first-red/`):

| Spec | Failed | Passed on `bbbb4ba2` |
| --- | --- | --- |
| `hidden-terminal-reversal` | 107 of 158 | 51: the 18 external refusals of the location itself, the 24 rollbacks (on `bbbb4ba2` rollback already compensated a hidden branch's slot, and superseded for the location itself) and the 9 address and own-membership controls. All are preservation controls. |
| `registered-slot-guards` | 3 of 12 (admission reported `failed`) | 9, which pin slice 8's guards |
| each adapter spec | 2: the re-add cases | the rest |

### Mutations (each restored by content hash; logs `mutations/`, final run `run-final.log` on `351d2849`)

Counts are killed cases. The final run was on `351d2849`, against the
158-case spec, the guards and the adapter specs.

**Hidden-location planning**

| Mutation | Killed |
| --- | --- |
| H1x hidden-location check inert | 112 (104 kernel + 2 per adapter) |
| H2 every hidden target refused, authored ones included | 67 |
| H3x every hidden target re-added, external ones included | 37 |
| H4x only the location itself checked | 85 |
| H5 innermost member re-added instead of the outermost | 3 |
| H6 re-added branch without retained members | 30 |
| H7 declarative path given the original effects | 7 |
| H8x the reversal's own membership effects ignored | 3 |
| H9 the replaced slot write also applied | 0, equivalent: the slot already holds the target |

H8 survived on the first spec; the own-membership control was added for it.

**Review follow-ups**

| Mutation | Killed |
| --- | --- |
| F1 re-add copies every key, collections included | 18 |
| F2 entity and structural effects unchecked | 24 |
| F3 no pending-work check before a re-add | 4 |
| F4 the `cedf0f40` rollback supersession restored | 34 |
| F5 an unwalkable address falls through | 0, defensive: neither I nor the reviewer could construct a trigger |
| F6 no realizability check | 0, defensive: a captured omission always registers the member's address |
| F7 pending work only strictly below the member | 2 |
| F8 order deltas unchecked | 6 |
| F9 bindings under a re-added member not found | 9 |
| F10 later pending enclosing omission not a dependency | 3 |

**Guards and typed refusal**

| Mutation | Killed |
| --- | --- |
| G1 capture: no subject means terminal | 3 |
| G2 capture splits every record | 3 |
| G3 admission admits any subject-less set | 3 |
| G4 the registered-slot admission never fires | 3 |
| E1 admission refusal back to a plain `Error` | 3 |

**S8, slice 8's capture and admission reverted:** 32 of the 35 adapter cases,
Vue's carried spec included.

### Results

Verification at `351d2849` (`verify/run3/`), all exit 0 unless noted:
- full kernel: 392 files, 4385 passed, 6 expected failures, 13 skipped. At
  `bbbb4ba2` it was 390 files and 4215, so +2 files and +170 cases = 158 + 12.
- frameworks: angular 187 (+3 skipped), react 29, vue 78, solid 47 (+8, +6,
  +6, +6);
- `pnpm typecheck`;
- `check-spec-types` (the same three pre-existing improvements; baseline not
  ratcheted);
- lint on all five projects;
- kernel-neutrality, source-controls, `api-inventory --check`,
  callable-inventory;
- five-package build;
- consumer typecheck (bundler and node16);
- `check-bundle-budget` exit 1 on the pre-existing overage only.

Two earlier full-kernel runs under machine load each failed one
timing-sensitive pre-existing case:
- at `7a47f3e5`, `entity-granular-reactivity` "repeated collection reads
  between writes are cached" took 12.4 ms against its 5 ms bound;
- before `351d2849` was committed, the 130k-row
  `large-batch-restoration-v16-controls` jumpTo exceeded its 120 s timeout.

Both pass alone. The jumpTo took 70.6 s at `bbbb4ba2`, 42.9 s at `019d9da0`
and 28.8 s on the final code, all measured alone; the variance is machine
load, and the code got no slower.

Size (`size/`, esbuild attribution over the built dist, prod, with the
package's `sideEffects`):

| Scenario | `bbbb4ba2` | `351d2849` | Delta |
| --- | --- | --- | --- |
| restoration | 35.73 KB gzip | 36.63 KB | +913 B gzip, +2742 B min (`restoration.js` +2064, `plain-branch-membership.js` +666) |
| transactions | 36.27 KB | 36.36 KB | +91 B gzip, +242 B min (`transactions.js`) |
| full | 64.98 KB | 66.04 KB | +1083 B gzip, +3056 B min |
| entities, bare | — | — | 0 |
| link | 16.77 KB | 16.76 KB | −1 B gzip |

`check-bundle-budget`, before and after: entities 23.59/22.6 KB prod and
26.23/25.25 KB dev; bare 10.39/10.25 KB prod and 12.60/12.45 KB dev. Both are
unchanged and still over the inherited ceilings.

### Independent review

Three rounds by one read-only code-reviewer agent. It was given the raw diff,
the owner decisions and the PLAN contracts, but not this record. It probed
only in its own exports (`/private/tmp/st-v16-slice8b-review-1..3`), and the
worktree was never touched.

1. **`cedf0f40..7a47f3e5`: needs fixes.** Three majors, all fixed in
   `019d9da0`:
   - entity rows inside an omitted branch were written silently, including
     under external omission;
   - re-adding a branch resurfaced a rolled-back contribution;
   - a branch holding a collection threw an untyped "unavailable member".

   Minor findings:
   - an unwalkable address fell through to a write: now refused;
   - the guards did not pin the registered-terminal half of admission: now
     covered, and G4 kills it.
2. **`019d9da0`: needs fixes.** The three majors were confirmed fixed. A new
   major and an older gap, both fixed in `351d2849`:
   - new major: a reorder or remove under an omitted branch threw "no
     binding" on the declarative path, and an external reorder was not
     refused;
   - older gap: with two pending transactions, an earlier rollback let the
     later rollback resurrect its value (also on `bbbb4ba2`).
3. **`351d2849`: minor only.** Everything earlier is fixed. The new dependency
   check refuses only a later pending omission or re-add of the enclosing
   branch: not an unrelated branch, and not a confirmed later turn. Minor
   findings, kept as open items:
   - under external omission, order-only and add refusals read "Expected
     undefined but found undefined";
   - rollback order now matters, which should be documented.

### User-visible behaviour changes in v16 (slice 8b)

1. **Ordinary omission is reversed.** After an ordinary (non-designated)
   omission of a location, or of a plain branch above it, undo, redo and
   jumpTo re-add it with the reversal's target. This covers entity rows and
   collection order inside the branch. Before, they wrote state nothing could
   read and reported success.
2. **External omission of an enclosing branch is refused.** Undo, redo and
   jumpTo now refuse with ST1034 and name the branch, including for entity
   effects inside it. Before, they reported success after a hidden write.
3. **Re-adding a member with pending work is refused** with ST1034, until
   that work settles.
4. **Rollback order can matter.** Rolling back a transaction whose branch a
   later *pending* transaction omitted now refuses with
   `later-confirmed-dependency`, with recovery. It succeeds once the later
   transaction settles, so the settle order matters.
5. **Admission refusals report `refused`.** For `Unsupported scoped undo
   effect at <path>`, the restoration reader reports `refused`, not
   `failed`. The message and error type are unchanged.
6. **No API, type or export change.**

### v15 applicability (source reading only, not run)

The exports are `/private/tmp/st-v16-slice8b-v15-export-1/` (`d63166c9`,
15.4.3) and `-2/` (`43e16e31`, the v15 candidate). Both have:
- the same admission rule (slot registration since 2892b650);
- membership truth checked only at the effect's own position, with no
  enclosing walk and no hidden-member handling, for value, row or order
  effects;
- later work, pending or confirmed, related to an earlier rollback by
  position and subject only (`classifyLaterOverlap`, the
  `later-pending-dependency` kind), never through an enclosing member;
- the admission refusal thrown as a plain `Error`.

So, by source, these 8b shapes apply to both:
- the ordinary-omission hidden write (location itself and enclosing branch);
- the hidden write under an externally omitted branch, including entity rows;
- the `failed` admission outcome;
- the two-pending-transaction resurfacing.

The external omission of the location itself is refused on both, as on v16.
Routed to the coordinator.

### Open items

1. **Owner confirmation needed: rollback under an omitted branch writes the
   dormant retained slot.** This is deliberate. It is what keeps a later
   re-add from resurfacing the rolled-back value. The visible state is
   complete either way.
2. **Pending rollback order now matters.** A rollback refuses
   (`later-confirmed-dependency`, retryable) while a later pending turn omits
   or re-adds an enclosing branch. Add a line to the docs or changelog.
3. **Refusal text.** Under external omission, the ST1034 text for order-only
   and add reversals reads "Expected undefined but found undefined". An
   unrealizable member reads "Unsupported scoped undo effect at
   structural-drift". The refusals are correct and typed; only the text is
   uninformative.
4. **Defensive clauses with no test that reaches them:** F5 (unwalkable
   address) and F6 (realizability). H9 is an equivalent survivor.
5. **Size: restoration +913 B gzip.** This is for the later size pass. The
   budget scenarios are unchanged.
6. **Untested nesting.** Collections more than one branch deep, and several
   collections under one re-added member, are not covered (review: info).
7. **Retained-value policy.** A value written through a detached handle into
   a hidden branch resurfaces when that branch is re-added (review: minor).
8. **Load-sensitive pre-existing tests.** The `entity-granular-reactivity`
   5 ms bound and the 130k-row jumpTo 120 s timeout flake under machine
   load.

## Slice 8c: retained storage, nested collections, refusal text, determinism

Committed on `integrate/v16-slice8c` from `ddf81590` (slice 8b merged):
- `2abb31e2`: re-add only a reversal's own locations; hidden collections at
  depth; refusal text; defensive checks;
- `a4973f4b`: deterministic load-sensitive cases;
- `45b8a6ef`: docs;
- `da273b12`: the review follow-up.

This slice covers slice 8b's open items 1–8. Raw logs, first reds, probes,
mutation logs and size attribution are in
`/private/tmp/st-v16-integration-evidence/slice8c/`.

### Item 1: rollback under an omitted branch — confirmed

The owner confirmed (coordinator, 2026-10-05) that rollback under an omitted
branch writes the pre-image into the hidden retained storage. The reasoning
is the owner's law that no undo, redo or jumpTo may reinstate a value that
only the rejected transaction wrote. Skipping the write would let the
rejected value come back on a later re-add. So the write is a full reversal,
not a silent partial one.

This is recorded in `packages/kernel/README.md` (`restoration()`, "Locations
an omission has hidden"). Since this slice, retained storage never supplies a
re-added value (item 7). The write therefore keeps the hidden storage
consistent with history, rather than being the only thing that stops a
resurfacing.

### Item 2: the rollback-order dependency is documented

| Location | What it now says |
| --- | --- |
| `CHANGELOG.md` 16.0.0-dev | One line for omitted-location reversal and one for the rollback order. |
| `packages/kernel/README.md`, Lifetime | The retryable refusal while a newer pending transaction omitted or re-added an enclosing branch. |
| `llms.txt` and `docs/guides/composition-recipes.md` | The same rule. |

There is no transaction-failures guide on this line: v15's
`transaction-failures-v15.md` is not carried. The README's Lifetime section
is the v16 equivalent, so the note is there.

Those three surfaces also named `later-pending-dependency`. That kind does
not exist on v16, whose owner reports a newer pending overlap as
`later-confirmed-dependency` (slice 4 item 1, slice 6 item 3). They now name
the real kind. The doc gates pass: links, imports, symbols and the 29
documented examples.

### Item 3: refusal messages name the location and the reason

Codes and types are kept. Both go through `restorationRefusal`, and the
reader reports `refused`. The new messages, captured in `messages.txt`:

- **External omission** (formerly "Expected undefined but found undefined"
  for order-only and add reversals):
  > `ST1034: restoration refused — 'g' was omitted by external truth after the operation being reversed, and 'g.rows' lies under it; restoring 'g.rows' would overwrite that omission. Nothing was changed; the history position is unmoved.`

  For the location itself:
  > `'value' was omitted by external truth after the operation being reversed; restoring 'value' would overwrite that omission.`
- **A member that cannot be re-added** (formerly `...at structural-drift`):
  > `Unsupported scoped undo effect at 'g.rows.a.n': its enclosing member 'g.rows' was omitted and cannot be re-added, because it is not a plain state location (an entity collection, for example). Nothing was changed; the history position is unmoved.`

  The other reason reads "its retained location is no longer available".

The location label is presentation only: the effect's display path, or the
structured address joined with dots for an order-only effect. Carriers in
`hidden-terminal-reversal.spec.ts` assert the exact text for the location
itself and for an enclosing branch, a pattern for reorder and add (never
containing "undefined"), and the omitted-collection refusal.

### Item 4: the defensive checks

**A member that cannot be re-added — now reachable and tested.** An entity
collection can be omitted from its parent by a whole-value write
(`tree.$.g({ k: 0 })`), and a collection is not a membership-managed
location. Undo of a row change then refuses, says why, and leaves state and
the index unchanged.

**The other reason — unreachable, documented in code.** A plain member whose
retained location is unavailable cannot happen, because restoration
registers a member's location whenever it observes the omission.

**An unwalkable structured address — unreachable, documented in code.** v16
never deletes a member: omission makes it non-enumerable, and dynamic members
reactivate with their identity. So every registered address still leads to
its owner. Slice 6 found the same for the state-location reader (mutation
survivor S5).

The hidden-member walk (`hidingMembers`, `collectionBindingAt`) now
traverses any node, as the state-location reader does, rather than only
branch accessors.

### Item 6: collections nested more than one level, and several under one member

`E/restoration/hidden-collection-nesting.spec.ts` has 25 cases: 18, plus 7
from the review follow-up. The state is
`{ g: { h: { rows, k }, other, j }, count }`. The turn updates a row,
reorders `g.h.rows` (declarative path) and adds to `g.other`. Covered:
- ordinary omission of `g`: undo, redo after the omission, and jumpTo;
- external omission: undo, redo and jumpTo refuse with nothing written;
- pending rollback after an ordinary or external omission, in three orders.

They revealed two defects on `ddf81590`, and review found two more (below):
- An ordinary-omission re-add of a branch with a collection two levels down
  threw an untyped "Plain branch target contains an unavailable member". The
  8b composition copied the nested branch, collection key included, from
  retained storage. Fixed by the item 7 composition.
- A pending rollback of entity changes under an omitted branch refused with
  "Transaction rollback has no collection binding", because the current-tree
  walk skips hidden members. It now finds the
collection along its structured address (`collectionBindingAt`) and restores
the hidden collections' pre-image, per the confirmed law. Restoration's
declarative path uses the same lookup in place of 8b's subtree walk. An
entity effect now also adds "the way to its collection" to the re-add, so a
collection two branches down becomes current.

### Item 7: a detached-handle write under a hidden branch

**v16's rule for absent members:**
- `whole-value-membership.spec.ts` (header and case 18): "PHYSICAL RETENTION
  MUST NOT CREATE A SECOND OBSERVABLE STATE" and "DORMANT STORAGE MUST NOT
  SUPPLY THE REACTIVATED VALUE".
- `member-membership.ts` (`activateOne`): "MEMBERSHIP ACTIVATION IS NEVER A
  STANDALONE OPERATION. IT MUST BE COUPLED TO AN AUTHORITATIVE SUPPLIED
  VALUE."
- For writes: `whole-value-membership.spec.ts` case 7 says "WRITING AN
  ABSENT DESCENDANT REACTIVATES ITS MEMBERSHIP", and
  `nested-absence-independent.spec.ts` says "a write must not vanish
  silently. Either it reaches the tree, or it refuses."

Under these rules a write to an absent descendant is live: it is neither
"not live" nor "staging".

**The re-add, made consistent.** The 8b re-add took a hidden branch's
untouched members from retained storage, which the rule forbids. That is what
made a detached-handle value reappear. The re-add is now built only from
supplied targets: the members on the way to the reversal's locations come
back, and every other state location stays absent, as the ordinary omission
left it. This also matches the 15.4.2 analogy, under which an undo restores
the pre-image over a later ordinary write only at its own locations. 8b's
"retained values on re-add" decision is withdrawn.

A turn's own membership effect, with its captured before-image, still wins.
Collections and markers are not membership-managed; they become current with
their branch.

**The write path itself — pre-existing, not changed here.** The rule says a
write to an absent descendant reaches the tree. `reactivateOnWrite` only
reactivates a leaf that is itself the omitted member. A leaf under an omitted
ancestor (`a.keep` after `a` is omitted) is written into hidden storage and
nothing becomes visible, which breaks case 7 and the nested-absence law for
nested descendants. A held nested read likewise sees retained storage.
Changing this is a core read and write path change in every adapter. It is
recorded as open item 1 with options, not done.

### Item 8: deterministic cases

| Case | Before | Now |
| --- | --- | --- |
| `entity-granular-reactivity` "repeated collection reads between writes are cached" | 500 reads had to take under 5 ms | Asserts the identical array across 500 reads, plus a write that invalidates the cache. A cached read returns the array it returned before; a rebuild returns a new one. |
| `large-batch-restoration-v16-controls` 130k-row jumpTo | hit its 120 s timeout under load | See below |

For the jumpTo case:
- **Cause.** 20.6 s of its 28.8 s went to `getRestorationHistory()`
  materializing snapshots of a 130k-row clear. That grows faster than
  linearly (16k 0.56 s, 32k 0.83 s, 64k 3.4 s, 130k 20.6 s; `probe2.txt`)
  and is not this case's subject.
- **Replacement check.** The history check is now `getCurrentIndex()` and
  `canUndo()`.
- **Counters.** Substrate counters pin each jump:
  - `jumpTo(0)`: `valueStoreWrites === LARGE`, and at most 3 publication
    dependency reads per row (2 measured);
  - `jumpTo(1)`: `structuralSubjectTombstones === LARGE`, and at most 10 per
    row (9 measured).
- **Runtime.** 9.8 s alone. The 120 s timeout stays; it now has a 12x
  margin.

### First red on `ddf81590` (`first-red/`)

| Spec | Failed on `ddf81590` |
| --- | --- |
| `hidden-collection-nesting` (first 18 cases) | 12 of 18: the 6 rollbacks (no binding), and the 6 ordinary-omission cases. The 8b re-add copied the nested branch `h` from retained storage, `rows` key included, and the installer threw an untyped "Plain branch target contains an unavailable member". That was a second 8b defect for collections more than one level down. The 6 external refusals passed. |
| `hidden-terminal-reversal` | 45 of 173: the path-only expectations, the message carriers and the omitted collection |

The two determinism changes pass on both sides; they change how the cases
measure, not what they assert.

### Mutations (each restored by content hash; logs `mutations/`)

Counts are killed cases.

| Mutation | Killed |
| --- | --- |
| C1 re-add takes untouched members from retained storage (8b form) | 36 |
| C2 entity effects add no way to their collection | 6 |
| C3 rollback finds no binding for a hidden collection | 6 |
| C4 declarative restoration finds no binding for a hidden collection | 12 |
| C5 refusal reason flipped | 3 |
| C6 hidden-member walk only through accessors | 0 |
| C7 external message without the omitted member | 45 |
| D1 `all()` rebuilt on every read | 1, the identity case |
| B1 only the outermost hidden member checked for re-add (review follow-up) | 2 |
| B2 a supplied collection snapshot treated as an unavailable member (review follow-up) | 5 |

C6 is equivalent on every test: no v16 producer puts a location under a
non-accessor node. The permissive walk keeps a future user marker from being
refused as "unwalkable".

### Results

Verification at `da273b12` (`verify/run2/`), all exit 0 unless noted:
- **Full kernel:** 393 files, 4425 passed, 6 expected failures, 13 skipped.
  The run inside the list had one timeout in the pre-existing
  `production-scalar-substrate` timing guard while the reviewer's export
  loaded the machine. It passes alone (`scalar-benchmark-rerun.log`) and in
  a clean full rerun (`kernel-rerun.log`). At `ddf81590` the count was 392 /
  4385, so the delta is +1 file and +40 cases (25 + 15).
- **Frameworks:** angular 187 (+3 skipped), react 29, vue 78, solid 47.
- **Static gates, build and consumers:** `pnpm typecheck`;
  `check-spec-types` (three pre-existing improvements; baseline not
  ratcheted); lint on all five projects; kernel-neutrality; source-controls;
  `api-inventory --check`; callable-inventory; the five-package build; the
  consumer typecheck (bundler and node16).
- **Doc gates (run separately):** doc-links, documented-imports,
  documented-symbols and documented-examples.
- **Bundle budget:** `check-bundle-budget` exits 1, on the pre-existing
  overage only.

Size (`size/`: esbuild attribution over the built dist, prod, with the
package's `sideEffects`; `final-vs-base.txt`):

| Scenario | `ddf81590` | `da273b12` | Delta |
| --- | --- | --- | --- |
| restoration | 36.63 KB gzip | 36.96 KB | +342 B gzip, +870 B min (`restoration.js` +643, `plain-branch-membership.js` +227) |
| transactions | 36.36 KB | 36.43 KB | +76 B gzip, +250 B min (`plain-branch-membership.js` +225 for `collectionBindingAt`, `transactions.js` +25) |
| full | 66.04 KB | 66.34 KB | +304 B gzip, +882 B min |
| entities, bare | — | — | 0 |
| link | — | — | +1 B gzip |

The restoration growth is mostly the refusal text. `check-bundle-budget`
before and after: entities 23.59/22.6 KB prod and 26.23/25.25 KB dev; bare
10.39/10.25 KB prod and 12.60/12.45 KB dev. Both are unchanged and still over
their inherited ceilings.

### Independent review

One read-only code-reviewer agent, given the raw diff, the coordinator's
items and the PLAN contracts, without this record. It probed only in its own
exports (`/private/tmp/st-v16-slice8c-review-1..3`).

**`45b8a6ef`: needs fixes.** All four findings were fixed in `da273b12`:
- **Major: a collection omitted below an omitted branch was reported as
  restored.** With `rows` omitted from `h` and then `g` omitted, undo
  re-added `g`, rewrote the dormant collection and returned normally. Every
  hidden member on the way must now be re-addable, or the undo refuses and
  names the blocking member.
- **Minor: rollback of a newer transaction that omitted a branch holding a
  collection threw "Plain branch target contains an unavailable member".**
  The branch's before-image carries a collection snapshot. The installer now
  ignores a snapshot supplied for a member that is not membership-managed,
  because the collection keeps its own state and its own effects restore it.
  The same fix lets undo of a designated omission of such a branch re-add
  it. The documented rollback order is now pinned in three orders.
- **Minor: the CHANGELOG claimed the older rollback "succeeded" before.** It
  did not: the slot case was already refused at `ddf81590`. Reworded.
- **Minor: the large-batch change dropped the history assertion.** It is now
  checked through the restoration reader, which materializes nothing. The
  `jumpTo(1)` read bound is widened from 10 to 12 per row (9 measured).

**`da273b12`: clean.** It confirmed each fix, including retrying after
either settlement. One minor remains: the installer skip admits any
traversable child that is not membership-managed, not only collections and
markers. It was kept because such members keep their own state; no failing
case was found.

The reviewer's info notes are recorded above: no transaction-failures guide
exists on v16, and the defensive branches are argued unreachable rather than
tested.

### User-visible behaviour changes in v16 (slice 8c)

1. **Untouched members stay absent.** An undo, redo or jumpTo that re-adds a
   branch an ordinary write omitted no longer brings back that branch's
   untouched members from retained storage. They stay absent; only the way
   to the reversal's own locations is re-added.
2. **Hidden collections roll back.** Pending rollback of entity changes in a
   collection under an omitted branch, at any depth, now completes and
   restores the hidden collections. Before, it refused with "Transaction
   rollback has no collection binding".
3. **Refusals say what and why.** The two refusal kinds name the omitted
   member, the location and the reason. Codes and types are unchanged.
4. **Docs name the real refusal kind.** The docs name
   `later-confirmed-dependency` for the rollback-order refusal, and cover
   enclosing-branch omissions.

### Port notes for v15 (8b + 8c)

Read from the exports of `d63166c9` and `43e16e31`; nothing was run. The
v15 transaction stream owns `restoration.ts` and `transactions.ts` there.

- **`I/plain-branch-membership.ts`.** Add `hidingMembers`,
  `composeHiddenMemberValue` (supplied targets only), `collectionBindingAt`
  and `isReAddableMember`. The surrounding code (`memberAddress`,
  `canRealizePlainBranchMember`, `preparePlainBranchMembers`) is identical.
- **`E/restoration/restoration.ts`.**
  - `isSupportedEffect`'s caller: throw through the file-local
    `restorationRefusal`.
  - `applyTurnEffectsThroughRealizationPort`: insert the hidden-location
    planning after the pending-overlap check. v15 has the same
    `externalMembershipTruth`, `pendingTransactions`, `pendingFootprints`
    and `stagedTransactionEffects`, but no `readQueuedExternalAuthority`, so
    a still-queued external omission needs a v15 probe.
  - Use `appliedEffects` for validation, `applyAtomically` and
    `deriveDeclarativeTransitionTarget`.
  - Add the `collectionBindingAt` fallback in the declarative binding
    lookups. v15's `requiresDeclarativeStructuralTarget` takes one argument.
- **`E/transactions/transactions.ts`.**
  - The binding fallback at "Transaction rollback has no collection
    binding".
  - The later-pending enclosing-membership dependency. v15 has no
    later-pending loop in `getPendingRollbackPlan`; it reports
    `later-pending-dependency` from the plan. Add the enclosure check where
    v15 classifies later pending effects, and keep v15's kind name.
  - Do not port 8b's withdrawn rollback supersession.
- **Specs.** `hidden-terminal-reversal`, `hidden-collection-nesting`,
  `registered-slot-guards` and the four adapter specs, with `.transact(` →
  `.transaction(` and v15's refusal kind names. v15 settles the commit scope
  on refusal (slice 7), which may change lifecycle assertions.

### Open items

1. **Writes and reads under an omitted ancestor (pre-existing).** A write to
   a leaf under an omitted ancestor goes to hidden storage, and a held nested
   read sees retained storage. This breaks `whole-value-membership` case 7
   and the nested-absence law for nested descendants. Options: reactivate
   along the path with siblings left absent, refuse the write, or keep the
   current behaviour. The owner decided to reactivate along the path; that is
   slice 8d.
2. **`getRestorationHistory()` grows faster than linearly** when it
   materializes a very large clear: 16k rows 0.56 s, 32k 0.83 s, 64k 3.4 s,
   130k 20.6 s (`probe2.txt`). Left for the performance pass.
3. **Remaining wall-clock bounds:** the 0.05 ms per-update bound in
   `entity-granular-reactivity`, and the `production-scalar-substrate`
   timing guard, which timed out under load. Slice 8d.
4. **Undo of a designated omission of an entity collection itself** does not
   bring the collection back. This is pre-existing, part of the "omitted
   branch keys" family. Slice 8d.
5. **The installer skips any traversable non-managed child** (review minor),
   not only collections and markers.

## Slice 8d: absent paths, omitted collections, counted guards

Committed on `integrate/v16-slice8d` from `b8498ad3` (slice 8c merged):
- `c0be453f`: item (a), reads and writes under an omitted member;
- `ef1631b0`: item (c), counted work instead of wall-clock bounds;
- `352fac93`: item (a) review follow-up;
- `370d2f48`: item (b), reversing a designated omission of an entity
  collection;
- `eb259b3a`: item (c) review follow-up (more iteration primitives counted);
- `29cc810b`: item (b) review follow-up (collections hidden inside a
  re-added branch; the rollback-side check);
- `19ed5156`: a type fix to `29cc810b`;
- this record.

Evidence (design note, probes, first reds, mutation logs, verification,
size attribution and the three review passes) is in
`/Users/jonathanborgia/code/signaltree/.claude/evidence/v16/slice8d/`. The
slice 8, 8b and 8c evidence cited in earlier entries was copied beside it
into `.claude/evidence/v16/` before the tmp cleaner removes
`/private/tmp/st-v16-integration-evidence/`.

### Item (a): writes and reads under an omitted member

Owner decision: reactivate along the path, leaving sibling members absent.
The design note (`DESIGN-NOTE.md`) was written before implementation and
lists every read and write path; its appended sections record what changed
during implementation and after review, and why.

**Baseline on `b8498ad3` (`probe1.txt`, `probe2.txt`):**
- Under an omitted `a`, held and detached handles read retained storage
  (`a.b()`, `a.b.value()`, `a.side()`), and `a.b.keep(9)` went to hidden
  storage; `tree.$()` stayed `{ count: 0 }`.
- Undo of that write re-added `a` through the 8b/8c path, as if an ordinary
  omission had hidden it.
- A held consumer of an omitted branch kept its value: a held
  `computed(() => box.drop())` stayed `{ v: 2 }` after `box({ keep })`, and a
  held `a()` kept the whole branch after `a` was omitted.
- A write re-adding a directly omitted leaf (`user.age(50)`) was recorded
  without its membership, so undo and rollback left `age` present with
  `undefined`.

**What changed:**
- **One liveness authority, along the path.** Omitting a member links it and
  every state location below it to its parent, once (`linkDescendants`).
  `isAbsentMember` follows the links; enumerability still answers. Leaf reads
  (kernel and native runtimes, so every adapter), branch reads, `peek`,
  updaters and the whole-value equal-value skip use it. A node never under an
  omitted member pays one symbol lookup, as before.
- **Writes re-add the path** (`reactivatePathOnWrite`): every omitted member
  on the path comes back with only the written path; members off the path
  are made dormant first, so retained storage supplies nothing. The result
  is what a whole value holding only that path at the outermost omitted
  member would give. Leaf set and updater, branch set and updater,
  `updateAndReport` (review follow-up) and dynamic members are covered.
- **Recorded like a whole value.** Each level's membership change is
  announced after the value write, innermost first. Undo, redo, jumpTo and
  rollback therefore make the path absent again, and the direct-leaf defect
  above is fixed.
- **Held consumers.** Omitting or re-adding a branch member republishes every
  present location below it, for whole-value writes and for reversals; an
  absent branch read depends on its membership revision.
- **Structural scope.** A whole value reconciles and announces membership
  itself, so a leaf it writes keeps the old silent own-member reactivation.
- **Found while fixing `updateAndReport` (pre-existing):** a whole value that
  supplies an omitted key as `undefined` re-added it with its retained value
  (`probe5.txt`: `$({ a: undefined, count: 0 })` gave `a: { v: 1 }`).
  Reconciliation now re-adds only keys whose supplied value was installed.

**Not covered: entity collections under an omitted member.** The collection
is absent from the tree's value, but its own methods still read and write its
retained rows, and such a write does not re-add the path. Which value an
absent collection's `all()`, `count()` and `byId()` return, and whether its
writes re-add the path or refuse, is an owner decision. README and
CHANGELOG say so (the first review found they had overclaimed).

### Item (b): undo of a designated omission of an entity collection

**Baseline (`probe3.txt`).** A whole value that leaves out a collection key
omits it. The membership change was observed but dropped when lowered to
effects (collections were not "accessor or writable location"), so undo,
redo, jumpTo and rollback reported success and left it omitted, in every
enhancer order.

**What changed.** A collection member is now recorded: its presence change
is an effect, its location is registered, a dormant collection being
re-added is captured, and a reversal installs its presence. Its rows are its
own retained state, restored by its own effects.

**Restored fully or refused.** When a collection is hidden, omitted itself
or with a branch around it, its rows are remembered from its physical truth
(`readSource`, not the snapshot, which a reversal reads stale: measured,
`probe6.txt`). They are remembered again when a reversal hides it or a
rollback compensates its rows while hidden. A reversal that makes it current
again, by re-adding it, a branch around it, or (8c planning) an outer member
for an earlier turn, while rows the reversal does not write itself have
changed, refuses with a typed restoration refusal ("Unsupported scoped undo
effect at 'g.rows': the entity collection was omitted and changed after
that, so re-adding it would not restore it as it was. Nothing was changed;
the history position is unmoved."), reported as `refused` by the restoration
reader. Rollback refuses the same case with `SignalTreeRollbackError`
(`effect-validation-failed`) and the same sentence. A reversal's own row
writes are excluded: an operation that omitted the collection and wrote a
row through a held handle is reversed exactly.

The first version (`370d2f48`) checked only a collection that was itself the
omitted member, and on the rollback side relied on the newest-first rule.
The second review pass showed both gaps with plain writes through a held
handle (below), and the fix covers them.

### Item (c): counted work instead of wall-clock bounds

- `entity-granular-reactivity`, "a single-entity update does not rebuild the
  collection": the 0.05 ms per-update bound becomes counted work. The same
  200 updates must visit exactly as many elements at 20,000 rows as at 2,000
  (counter below), with a control that the counter sees a copy.
- `production-scalar-substrate`, "Timing guard" (median time at 100,000
  positions within 40x of 10; it timed out under load) becomes a counted
  "Scale guard": each compiled read, write and frame does identical substrate
  work and iterates identical elements at every size. The opt-in timing
  report is unchanged.

The counter sees Map and Set iteration, `Array.from`, `Object.keys`,
`values` and `entries`, and the Array methods that build, search or walk
arrays (searches counted at full length). It does not see an indexed loop
that builds nothing. Every O(size) regression the mutations reintroduced (a
map, a spread, a slice, a filter, an `indexOf`, an `Object.keys`) was
caught. The helper is duplicated in the two specs (review: minor, style).

### Item (d): `getRestorationHistory()` scaling, measured, left for the performance pass

Materializing the history of one very large clear (8c `probe2.txt`, copied
to `.claude/evidence/v16/slice8c/`):

| Rows | `getRestorationHistory()` |
| --- | --- |
| 16,000 | 0.56 s |
| 32,000 | 0.83 s |
| 64,000 | 3.4 s |
| 130,000 | 20.6 s |

Doubling from 64k to 130k costs about 6x, so the growth is worse than
linear. Not changed in this slice.

### First red (`first-red/`)

| Carrier | Red against |
| --- | --- |
| kernel `absent-path-write` (41 at the time) | all 41 on `b8498ad3` source |
| angular, vue, solid, react `absent-path-write` | 6 of 6 each on `b8498ad3` source |
| kernel `designated-collection-omission` (27 at the time) | all 27 on `352fac93` source |
| angular, vue, solid, react `designated-collection-omission` | 6 of 6 each on `352fac93` source |
| own-row cases in `designated-collection-omission` | 6 false refusals of the first (b) design (`b-own-rows-red.log`) |
| hidden-in-a-branch cases (review 2) | 9 of 9 on `370d2f48` (`b-review2-red.log`) |

The item (a) review follow-up's cases are pinned by mutations R1–R7 instead:
putting `c0be453f`'s `signal-tree.ts` back failed all 60 cases, because it
no longer matches the follow-up's `member-membership.ts` exports, which is
not a discriminating red.

### Mutations (each restored by content hash; logs `mutations/`)

Counts are killed cases.

| Mutation | Killed |
| --- | --- |
| A1 liveness is own-only | 47 |
| A2 no subtree links on omission | 58 |
| A3 no sibling deactivation on re-add | 48 |
| A4 no membership announcement on re-add | 58 |
| A5 announce only the outermost level | 4 |
| A6 activate only the outermost omitted member | 1 |
| A7 no subtree republish on a path write | 21 |
| A8 republish a re-added leaf too (double publication) | 13 |
| A9 structural writes re-add and announce too | 3 |
| A10 / A25 an added member (or its subtree) is not linked | 1 / 1 |
| A11 re-add announced before the value | 1 |
| A12 native leaf read own-only | 24 |
| A13 native replace does not announce | 12 |
| A14 native updater gets retained storage | 3 (0 before a bare-tree case was added) |
| A15 absent branch read without a membership edge | 5 |
| A16 branch read never absent via the path | 36 |
| A17 branch write never re-adds | 24 |
| A18 absent branch updater gets retained storage | 2 |
| A19 equal-value skip ignores absence | 1 |
| A20 whole-value change: no subtree republish | 27 |
| A21 whole-value change: branch revisions not bumped | 14 |
| A22 reversal-installed members: no subtree republish | 17 (0 before the designated-omission cases were added) |
| R1–R7 review follow-up (partial re-add, its announcement, its report, branch updater in a whole value, installed-only re-add in partial and whole values, re-entrant announcement) | 4, 3, 1, 1, 1, 1, 1 |
| B1 a collection member is not lowered to an effect | 66 |
| B2 a dormant collection being re-added is not captured | 3 |
| B3 a collection is not a member address | 36 |
| B4 restoration does not refuse a changed hidden collection | 21 |
| B5 rollback does not refuse a changed hidden collection | 3 (0 at `370d2f48`, where only the newest-first rule was exercised) |
| B6 rollback does not refresh compensated rows | 4 |
| B7 an observed omission does not remember hidden rows | 24 |
| B8 a reversal that hides a member does not remember its rows | 3 |
| B9 rows compared by snapshot, not physical truth | 56 |
| B10 / B11 a reversal's own row writes count as a change (restoration / rollback) | 9 / 6 |
| B12 collections below a re-added branch are neither checked nor remembered | 9 |
| B13 the 8c earlier-turn re-add is not checked | 3 |
| B14 refresh ignores a collection hidden by its branch | 4 |
| C1–C6 an O(size) map, spread, slice, filter, `indexOf` or `Object.keys` in `updateOne`, a compiled read or a compiled write | 1 each |

A23 and A24 mutated `realizePlainBranchMember`, which the note's M3 had
changed; they survived because that function's membership branch is
unreachable (`applyAtomically` sends every membership effect to
`preparePlainBranchMembers`; `applyEffect` gets value effects only). M3 was
reverted and they are void.

### Results

Verification at `19ed5156` (`verify/run3/`), all exit 0 unless noted:
- **Full kernel:** 395 files, 4550 passed, 6 expected failures, 13 skipped.
  At `b8498ad3` it was 393 / 4425: +2 files and +125 cases, the two
  carriers (`absent-path-write` 63, `designated-collection-omission` 62).
- **Frameworks:** angular 204 (+3 skipped), react 43, vue 95, solid 64: the
  two carriers per adapter (+17 each; react +14, no bare-tree updater case).
- **Static gates, build and consumers:** `pnpm typecheck`;
  `check-spec-types` (the three pre-existing improvements; baseline not
  ratcheted); lint on all five projects (8 pre-existing warnings, 0 errors);
  kernel-neutrality; source-controls; `api-inventory --check`;
  callable-inventory; the five-package build; the consumer typecheck
  (bundler and node16).
- **Doc gates:** doc-links, documented-examples, documented-imports and
  documented-symbols.
- **Bundle budget:** `check-bundle-budget` exits 1. Both scenarios were
  already over; item (a) adds to both, because the path liveness and re-add
  are core semantics and ship in the bare kernel.

`verify/run2/` at `29cc810b` failed `pnpm typecheck`, `check-spec-types`
and the Vue and Solid pre-test `tsc` on one cast (TS2352) in
`plain-branch-membership.ts`; `19ed5156` fixes it. Vitest does not
typecheck, so the earlier spec runs had passed.

Size (`size/`: esbuild attribution over the built dist, prod, with the
package's `sideEffects`; `final2-vs-base.txt`; base is 8c's `da273b12`
build, code-identical to `b8498ad3`):

| Scenario | `b8498ad3` | `19ed5156` | Delta |
| --- | --- | --- | --- |
| bare | 10.39 KB gzip | 11.04 KB | +660 B gzip, +1,871 B min (`member-membership.js` +910, `signal-tree.js` +751, `tree-scalar-leaf-runtime.js` +169) |
| entities | 23.59 KB | 24.25 KB | +681 B gzip, +1,887 B min (same modules) |
| transactions | 36.43 KB | 37.79 KB | +1,392 B gzip, +4,025 B min (also `plain-branch-membership.js` +1,453, `transactions.js` +662) |
| restoration | 36.96 KB | 38.07 KB | +1,140 B gzip, +3,403 B min (also `plain-branch-membership.js` +978, `restoration.js` +515) |
| link | 16.77 KB | 17.57 KB | +826 B gzip |
| full | 66.34 KB | 67.72 KB | +1,411 B gzip, +4,376 B min |

`check-bundle-budget` before and after: bare 10.39 → 11.04 KB prod against
10.25 (dev 12.60 → 13.26 against 12.45); entities 23.59 → 24.25 KB prod
against 22.6 (dev 26.23 → 26.91 against 25.25). Items (b) and (c) add
nothing to bare or entities.

### Independent review

One read-only code-reviewer agent, given the raw diffs, the coordinator's
items verbatim, the design note and the mutation logs, without this record.
It probed only in its own exports (`/private/tmp/st-v16-slice8d-review-1..3`).

**`c0be453f` (item a): needs fixes.** Fixed in `352fac93`:
- **Major: `updateAndReport` still lost a write under an omitted member**
  (partial outer level, never re-added). A path the design note missed (W4).
- **Major: the README and CHANGELOG overclaimed** for entity collections
  under an omitted member. Now stated as not covered.
- **Minor:** a re-entrant write to the same leaf could drop the outer
  re-add's announcement; a branch updater inside a whole value received
  retained storage; the structural scope allocated a closure per level.
- **Info:** A23 and A24 were void (they targeted reverted code).

**`352fac93`: clean.** It also accepted the pre-existing `$({ a: undefined })`
fix as matching case 18.

**`ef1631b0` (item c): clean, with a coverage Minor**: searches
(`indexOf`, `find`, ...) and `Object.keys` were not counted. Fixed in
`eb259b3a` and pinned by mutations C5 and C6.

**`370d2f48` (item b): needs fixes.** Fixed in `29cc810b`:
- **Major: a collection hidden inside an omitted branch** came back with a
  row a plain write had added while hidden, when undo re-added the branch.
- **Major: rollback** re-added a changed collection after a plain write (no
  later turn, so the newest-first rule did not refuse), contradicting the
  commit message.
- **Minor:** the snapshot-versus-physical-truth mutation had not been run.

**`eb259b3a` and `29cc810b`: clean.** The reviewer re-ran its probes two
levels down and in all orders, and tried to provoke false refusals (an
off-path sibling from an 8d(a) re-add, recorded hidden row writes, repeated
omission with rows changed while present, jumps across omissions,
sequential and out-of-order rollbacks). It found none. `19ed5156` (the
type fix) was not reviewed; it is a cast.

The reviewer's remaining info notes: the iteration counter still ignores
indexed loops and `flatMap`, `reduceRight`, `structuredClone` and
`JSON.stringify`; external omission of a collection was not probed.

### User-visible behaviour changes in v16 (slice 8d)

1. **Absent reads absent.** A location under an omitted member reads
   `undefined` through any handle, held consumers follow omission and
   re-add, and updaters there receive `undefined`.
2. **Writing it re-adds its path.** Only the written path comes back; the
   omitted member's other members stay absent. Undo, redo, jumpTo and
   rollback of the write make it absent again. `updateAndReport()` behaves
   the same and reports the re-added leaves.
3. **A re-added omitted leaf is undone to absent**, not to present
   `undefined`.
4. **`undefined` does not bring a member back.** A whole value supplying an
   omitted key as `undefined` leaves it absent.
5. **An omitted entity collection is restored by reversal**, itself or
   inside a branch the reversal re-adds, or the reversal refuses, names it
   and changes nothing.
6. **Entity collections under an omitted member are not covered yet**
   (documented).

### v15 applicability (source reading only, not run)

Read from exports of `v15.4.3` (`/private/tmp/st-v16-slice8d-v15-export-1`)
and of the newest v15 work branch tip, `fix/v15-entity-review` at `85db805e`
(`-export-2`).

- **(a) applies.** `member-membership.ts` is byte-identical to `b8498ad3`, and
  `tree-scalar-leaf-runtime.ts` and `snapshot-authority.ts` are identical.
  Both v15 trees read and write through `isDormantMember` /
  `reactivateOnWrite` (own member only) in both leaf runtimes, read the
  branch at `isDormantMember(self.accessor)`, hand a branch updater
  `unwrap(store)`, skip equal values on `!isDormantMember`, republish only
  direct members, and return from a partial `recursiveUpdate`
  (`updateAndReport`) without re-adding. The `$({ a: undefined })` re-add
  with retained storage applies too (reconciliation activates every supplied
  dormant key).
- **(b) applies.** v15's `plainBranchMembershipEffects` drops any member that
  is not an accessor or writable location, so a collection's omission is
  never recorded, and its capture skips non-callable dormant members.

### Port notes for v15 (8d)

- **(a)** ports almost mechanically: `member-membership.ts` (links,
  `isAbsentMember`, `reactivatePathOnWrite`, structural scope, republish
  port), `tree-scalar-leaf-runtime.ts`, `snapshot-authority.ts`
  (`observeMembership`), `materialize-markers.ts`, and `signal-tree.ts`
  (R3, W3, R4, republish subtree, partial re-add, installed-only re-add).
  v15's `native-tree-scalar-leaf-runtime.ts` lacks v16's dormant-observer
  forcing in `replace` and `derive`; port those lines with the 8d change.
  `plain-branch-membership.ts`: only the subtree republish in
  `preparePlainBranchMembers` publish.
- **(b)** needs the lowering, capture and member-address changes in
  `plain-branch-membership.ts`, the remembered rows (for every collection a
  member's omission hides), and the refusal in restoration's reversal
  planning. v15 has no 8b/8c hidden-location block; put the check before
  `externalConflict` in `applyTurnEffectsThroughRealizationPort`, for
  re-adding membership effects only (there is no 8c outer re-add to check).
  In transactions, the check goes at the top of `applyRollbackCompensation`
  (its effects are the forward ones: a re-add is before true, after false),
  and the refresh after compensation succeeds.
- **Specs:** the five `absent-path-write` and five
  `designated-collection-omission` carriers, with `.transact(` →
  `.transaction(` and v15's refusal kind names.

### Open items

1. **Entity collections under an omitted member** (above): owner decision on
   absent reads and on writes.
2. **`getRestorationHistory()` scaling** (item (d)): performance pass.
3. **Dead code:** `realizePlainBranchMember` and `applyEffect`'s membership
   branch are unreachable.
4. **External omission of an entity collection** was not probed by the
   reviewer; the existing ST1034 external-truth handling applies to its
   membership effect as to any member's, but no carrier pins it.
