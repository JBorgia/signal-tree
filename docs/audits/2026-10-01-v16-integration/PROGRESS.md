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
