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
(tooling admission, typing/consumer fixtures, API baseline) and the review
follow-up `c277d1ce`, on `integrate/v16-slice6` from `515a6969`. Raw logs,
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
  `prependMany` (one grouped unit), and cancellation on a throw. Restoration's
  declarative target, transaction rollback's declarative target and the
  realization adapter hold reader delivery for the whole reversal.
  `visitTree` regains `includeNonEnumerable` (dormant members).
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
kernel + batching 14.23 → 14.24 KB.

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
