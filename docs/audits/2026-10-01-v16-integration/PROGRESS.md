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
