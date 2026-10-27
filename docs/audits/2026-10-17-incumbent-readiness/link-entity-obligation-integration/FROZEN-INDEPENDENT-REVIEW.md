# Frozen entity integration: independent bounded correctness review

Disposition: **reject this candidate for covered structural-projection recurrence;
stop dependent runtime repairs under the current attempt's stop rule.** This is
supported by two unchanged ordinary-order assertions that pass the predecessor and
fail the new shared admission path. It does not depend on counting inherited reds,
the now-resolved inspection-window policy, or treating every retained negative fact
as a leak. No runtime/test/architecture edits or executions in this review.

## Exact identity and execution evidence

Checkout `/private/tmp/link-entity-obligation-integration`, HEAD
0135ef18567573fec627667fc58bc3e7819cc29e plus frozen dirty draft.
`INDEPENDENT-FROZEN-REVIEW-SOURCE.json` verifies current files match012/013/014/017
manifests, and each corresponding BEFORE/AFTER pair is identical. Original ordinary
order, egress footprint, structure-fault and selected-capture tests are unchanged.
Relevant SHA256:

- entity-signal.ts fc2cbd159f6740071c466fc266ae22ac1bbe63a1aa3e8b060886ecb0970fab02
- experimental-publication/entity.ts 02a0eddb8d36141dbb7480e15ad682765ff459c70f9b61639946f69dfa705cec
- entity-egress-projection.ts e158db8d0d70077bddbef9e13b1d0ea0118e26c5c6dc88a24ab5f51e7f44947f
- link.ts 41408abb0df624dd84dbe06525082cde6cd7aec653f120286006b0f3acbcb142
- lifecycle.ts 7fcfd3098cd59bbdd9f07ff9ce46e547e63175d14ff0ea7c265a410b41593dff

Raw evidence:012 focused53/55;013 semantic95/101;014 scalar225/227 with two retained
historical oracle failures;015 two terminal horizon controls pass and two negative
retirement cases fail at final counter;017 each framework3/3;018 predecessor20/24,
including ordinary-order5/5 and the same four inherited semantic failures.016 is
explicitly not executed, not a failed framework run. These are separate workloads,
not a deduplicated total. I inspected raw outputs/manifests; did not rerun them.

## Blocker1: source O delta is not the recipient's authored membership footprint

`ordinary-order-source-boundaries.spec.ts`61–77 constructs early connection baseline
[a], inspection-adds x9, then creates a later connection whose legitimate baseline
contains[a,x]. Ordinary removeOne(x) must leave early connection silent and send[a]
to the later one. Both collection and nested branch variants pass on0135 predecessor
(018) and fail in013 at line77: no output was sent by the later connection. Subsequent
re-add/adoption assertions in those cases were not reached; do not claim they failed
or passed. The two selected-field-inverse baseline controls still pass.

Source mapping:

- entity-signal.ts1319+ passes physical changes plus ordinaryPlan.changes to the new
  prepared publication unit. Removing an inspection-created x can be source-O neutral.
- entity-egress-projection.ts184–190 applies every physical structural edit with
  inspection=true, changing latent topology only. It applies publication-authorizing
  edits exclusively from packet.ordinary. With no ordinary x remove, the later
  relationship's eligible x is never removed and changed remains false.
- link.ts573–600 installs the prepared relationship projection and creates publication
  work only for changed; line622 skips notifications carrying the admitted unit marker.
  Thus the prior notification's authored removal cannot repair the missing admission.

This is not a demand to adopt inspection into the earlier connection, to treat every
physical change as ordinary, or to make all recipient payloads equal. It requires the
same actual noninspection authored removal to be interpreted against each existing
relationship baseline. The packet must preserve that authored participation/footprint
even when the source's canonical O before/after has no delta. Physical topology,
source O target, authored footprint, and recipient baseline are distinct inputs.

SCOPE.md explicitly promises ordinary footprint, P/O separation, recipient-only R,
frame membership/order and useful delivery.392fcf46 preserves these native/recipient
boundaries, and its no-final-physical-substitution rule cannot authorize omitting a
real ordinary removal. The earlier approved source map W6 requires correct authored
removal without promoting inspection-created row values. The A0 baseline rule lets
later relationships establish their own baseline. Those obligations already cover
this route. This is the same architectural loss of authored evidence the shared
admission mechanism is intended to prevent, now shown in an already-migrated frame/
structural recipient path. It is not an explicitly unmigrated producer or merely a
novel test count. The unchanged passing predecessor makes the regression concrete.

The cheapest falsifier already ran: the two existing variants. No individual caller
exception or replay-from-notifier fallback is an adequate mechanism disposition.
A successor would need a reviewed complete authored membership handoff and baseline-
relative interpretation; that is a requirement, not authorization to patch this run.

## Blocker2 and limit: cleanup without erasing still-relevant negative evidence

012 `entity-publication-work-lifetime.spec.ts` fails at line51 in cycle0: presence1,
expected0. No owner is pending; ordinary remove follows a completed independent write;
connection disposal has finished. Source physical lifetime can be forgotten, and its
held handle remains identity-isolated. Source-owned maps still retain the obsolete
membership entry. Source explanation: `entity.ts` writes negative members/visible
entries on ordinary remove and only deletes them in retire(subject); entity-signal
calls that hook from explicit prepared lifetime reclamation3277, whereas automatic
zero-restoration-owner retirement3357+ commits physical forgetting without the same
publication retirement hook. There is no automatic terminal callback in entity.ts
that retires the retained entry. This is a real missing lifetime integration, not a
CPU/heap measurement. Later cycles/remaining counter/receipt assertions were not
reached, so the log does not establish an observed twelve-cycle slope or all maps leaking.
The fixed point-work counter case and pending-inverse retention case passed.

015 negative-window confirm/reject cases are different. They prove before the final
counter assertion that negative membership retains foreign W(q), a truthful independent
native consumer remains conservative/unknown, delivery holds whileq is pending, then
sends useful0 with surviving basis afterq settles while laterr stays pending. Those
safety/usefulness checks pass. Only negativePresence1 versus0 fails.

The exact zero oracle is not fully justified solely by q terminality. The approved
terminal control `publication-terminal-obligation.spec.ts`69–82 explicitly requires
confirmed possible-owner history to remain unknown when consumed by a later native
operation; confirmation does not certify that source's hidden origin. Current source
absence is still a fact that a later supplied snapshot can consume. Active inverse,
input certificates, current negative-domain evidence and an obsolete per-lifetime
ledger are distinct retention reasons. A compact representation may retire obsolete
lifetime entries while preserving current uncertainty, but this test's single counter
does not demonstrate such a transfer or establish permission to erase all support.

Therefore retain these two reds as a **retirement representation/oracle boundary**,
not a newly observed safety failure and not proof every negative entry is a leak.
Do not fix them by unconditional retire-on-source-forget or retire-on-owner-confirm:
the former loses the passing pending-W hold, and the latter can turn inherited
uncertainty into declared proof. The no-W/no-recovery churn leak above remains a
separate unambiguous blocker. Qualification needs bounded retention of relevant
negative support without unbounded dead lifetime records and without laundering W.
No replacement count threshold is invented here; original tests remain untouched.

## Selected rich capture and inherited four

012 selected-capture test observes restored lefta1 while right still50/60 rather
than selected11/12.011 predecessor independently fails the same test. That is a real
observable incomplete selected unit, no longer merely a source concern. The final
righta777 assertion is after the failing observation assertion and is unexecuted.
The source's sequential structural plan.commit invokes rich capture before later
live-point/ordinary plans install, as detailed in selected-boundary/REVIEW.md.

The existing selected contract requires the full selected inverse before capture.
The worker has explicitly not extracted the structural preparation/install boundary;
this inherited uncovered seam must prevent whole-entity acceptance but is not a new
regression attributable to the point-admission changes. It cannot be called accepted
merely because the original public26 now pass. Any contemplated extraction must obey
whole-unit preparation, occupied-key dependencies, callback-free primitive install,
minimum responsibility and post-install error containment. This report's recurrence
stop already applies via Blocker1; no structural extraction is authorized this turn.

018 demonstrates the same four semantic failures as013: whole-row inspection-adoption
versus old no-op expectation, two missing getter-throw expectations, and different
reentry error identity. They are inherited, not four new integration regressions.
The first is an unresolved old no-op/adoption oracle against later ordinary-adoption
rules. The getter tests expect cloning/preparation to throw the accessor's error,
while deep-clone.ts13–23 catches structuredClone failures then preserves accessor
descriptors in its fallback110–120; that can swallow the original getter exception
while preserving its reentrant effect. Exact public error/clone semantics need their
own adjudication before calling these new recurrence. Later rollback/liveness
assertions in the tests did not execute after their first failures. This is not a
waiver of contract qualification or permission to rewrite their assertions.

## New inspection-window authority: implementation discriminator only

The owner has now explicitly selected fixed authorship W for a complete independent
claim consuming inspection-derived unavailable native input. The earlier timing
ambiguity is resolved for that category. The frozen runtime has not implemented it;
its previous view-test behavior is not falsely credited as passing. This new policy
answer can be preserved as specification without resuming a candidate stopped for
Blocker1.

`inputs.some(input => nativeProof(input.requirement).unknown)` is not a sound category
check: inherited W(q) itself causes unknown, including after q confirms. Capturing
new currentr because that input is unknown extends the wrong horizon and breaks the
passing015 later-r discriminator and terminal uncertainty contract.

`NativeRequirement.unknown` distinguishes a directly constructed unavailable() from
a freshly prepared W-only requirement at some sites, but is not sufficient across
composition. It also represents other source/authenticity uncertainty; a consumer
of unavailable input may have its own unknown=false and a proof whose unknown=true
came from the input. Horizon finish/finalization freezes proof then clears input refs;
thereafter the intrinsic reason cannot be recovered reliably from the flattened bit.
The owner-selected unavailable-physical category must remain distinguishable through
input capture, higher-hop composition, proof freezing and cleanup, separately from
inherited W and recipient-only R. An explicit internal reason or equivalently
lossless existing metadata is sufficient in principle; no new public API, value
store or authority policy is needed. Active validation invalidity remains distinct.
Direct raw-field flags alone are not a higher-hop proof. No code recipe or runtime
exception is approved here.

## Final gate boundary

The frozen candidate makes real progress: original26, native input/declaration
controls, point-work counts, terminal horizon controls and framework3-each evidence
must be preserved. They do not clear the two new baseline-relative authored-removal
failures. These meet the current covered-mechanism recurrence stop. Preserve all
first logs, exact candidate, original assertions, the new owner policy answer and
this review; do not continue independent runtime repairs in this attempt. Full
qualification, entity acceptance and production release remain unestablished.
