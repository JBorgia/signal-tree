# Independent native/equal-write contract review

Read-only source/history review at db82b8ae7b75cd2d1a968a46fd8d79f489e45857 in incumbent-readiness. No tests executed or runtime changes in this review.

## Governing rules actually found

The historical owner disposition in docs/architecture/v15-production-surface-audit.md states: “DevTools state application is INSPECTION: not authorship, not realization, and not restoration.” Its subsequent owner pin states: “An inspection write itself cannot create business dependency evidence. A later independently authored or realized consequence of that inspection is classified on its own terms and may create dependency evidence.” The implementation and initial acceptance appear in history commit dbf958ad (git log -S "participation: 'inspection'" on devtools-impl.ts).

The pin's executable acceptance devtools-jump-0-1.spec.ts108–147 uses an actual changed field: speculative Alpha -> inspected Inspected -> authored Authored; rollback must refuse because authored dependency exists. It does not adjudicate an equal-valued ordinary call after inspection.

write-participation.ts says absence of participation is ordinary authored work, but that classifies an emitted operation; it does not by itself establish that every setter call creates an operation despite equality.

Existing no-op evidence: history-retention-0.spec.ts259 says writing existing0 is a no-op and builds no turn. Native source is explicit: location-runtime.ts500 returns false on equality, and450–459 publishes only when changed. More precisely, the intrinsic observer DOES receive changed:false; owned-mutation.ts245 emitsOwnedMutation only when changed, then still calls configured afterSet/afterUpdate hooks with the false flag. Thus “there is no observable native write attempt” is too broad. There is no ordinary owned-mutation/publication revision on this path, but an intrinsic attempt/hook seam exists.

## What real “exit inspection” means here

DevTools is not an isolated read overlay with a saved live-state pointer. applyInspectionState mutates ordinary physical state inside a synchronous inspection context (devtools-impl.ts1535–1573); finally only clears isApplyingInspectionState and records lastSnapshot. The flag suppresses DevTools feedback while applying, not subsequent application writes.

Both grouped and standalone dispatch paths implement:

- JUMP_TO_STATE/JUMP_TO_ACTION: apply the supplied state as inspection.
- ROLLBACK: apply supplied state as inspection, then sendInit.
- COMMIT: sendInit only; this resets diagnostic history, not SignalTree transaction settlement or publication authority.
- IMPORT_STATE: applies selected supplied state as inspection.
- disconnectDevTools: removes observers/interceptors and resets connection bookkeeping; it does not restore a previously saved application value.

Public DevToolsMethods lists connectDevTools/disconnectDevTools/exportDebugSession. No public exit/resume action that automatically restores hidden ordinary truth was found in these relevant definitions, handlers, tests and history. This is a scoped source conclusion, not proof that no application or external Redux UI could choose another snapshot to send.

Consequently, the sequence must name the exit action. Ending withWriteContext already exits its synchronous metadata scope; it does not revert99. Disconnecting or COMMIT leaves physical99. Jumping explicitly to a saved7 reinstalls7 as another inspection write. An imagined generic “exit restores latest authored truth” would be a new contract, not a valid unspoken oracle.

## Expected distinctions and unresolved premise

1. Ordinary authored7 -> inspect99 -> ordinary y(99): under current native equality policy the third call produces changed:false and no owned mutation/transaction contribution/publication revision. Native Link's eligible projection remains7. This is source-derived expected behavior, not freshly replayed here.
2. Replacing the third call with y(100) is an actual authored mutation; it must be classified independently and cannot be excluded merely because it follows inspection.
3. Wrapping equal y(99) in transact does not itself turn the unchanged value into a contribution. A no-op transaction still has lifecycle identity, but that differs from owning y. Confirm/rollback may settle that empty identity; neither implies Link should adopt inspected99. An exact public replay is still useful.
4. Authoritative Link acquisition of99 is different. link.ts484 sets eligible directly regardless of local value equality; P5 link-authority-carrier.spec.ts208–235 explicitly requires acquisition equal to inspected display to advance authority. That test cannot justify ordinary equal setters doing the same.
5. The proposal's “equal-value authored revisions still count” is valid for actual authored revision sequences such as42->99->42. It does not automatically prove that a setter suppressed before owned mutation created such a revision. If the intended promise is *every equal setter call explicitly adopts displayed inspection truth*, that exceeds the located native no-op rule and needs a concrete contract justification/owner decision before changing it.

No governing existing rule found requiring an ordinary equal setter after inspection to adopt99, nor a rule defining an automatic exit-to-live restoration. Preserve failed proposed expected[99] evidence as an unresolved/mismatched premise; do not relabel it a successful test or automatically call it a native corruption defect. Conversely, do not claim the notifier-only declaration implementation satisfies all equal-authorship use cases: the intrinsic attempt seam shows that “unobservable in JavaScript” is not the explanation.

Recommendation: finish the native/candidate public replay with explicitly named exit actions, report physical reads versus Link eligible/outbound and transaction effects separately, then decide whether the requested feature is already-realized ABA responsibility or a new equal-call authority transition. No runtime repair is justified from the ambiguous word “exit.”

## Concrete owner-decision boundary if equal-call adoption is desired

No located frozen rule determines what rejecting an equal-value adoption should restore when physical baseline is99 but ordinary eligible truth is7. Three distinct choices would result:

- Treat it as a physical value contribution based on displayed99: rollback returns99, which does not itself restore earlier eligible7.
- Treat it as an authority-only contribution: rollback restores eligible7 while leaving displayed inspection99; this requires representing/settling an effect distinct from value mutation.
- Treat ordinary7 as the replacement baseline and restore physical7: this overwrites the inspection display from a nonphysical authority baseline, unlike ordinary capture of current99.

The existing rule that inspection is unprotected permits legitimate restoration to overwrite it, but does not tell us which of these baselines a formerly no-op call newly owns. The later-authored-consequence pin concerns an actual changed operation and cannot select the answer. Therefore changing equal calls into adoption is an owner semantic decision, not a mechanically implied correction. Preserving current no-op treatment needs no new policy; a new declaration scope must honestly document its actual-revision limit rather than claim adoption it cannot supply.

## Final recommendation after root replay report

Root reports independently replaying nine baseline/candidate controls, including equal transaction after inspected99 producing changes[] and rollback leaving99 with no send, and an earlier pending0->7 followed by inspect99/equal ordinary99 rolling back to0 and sending0 in both arms. I did not independently run those nine controls in this review; these results are consistent with the inspected changed:false/no-contribution mechanism.

Recommend retaining native equal-setter no-op semantics and specifying the Link declaration as authorizing actual native authored revisions only. The approval decision should explicitly resolve the previous wording: a no-op equal call creates no adoption or publication authority; a net-equal ABA with real intermediate mutations remains a responsibility revision and must work. This is the smallest scope resolution that preserves frozen transaction/restoration behavior and does not manufacture a Link-only authority.

If owner instead requires equal-display adoption, do not implement a publication-only promotion. The owner must choose the authority/restoration baseline first—prior ordinary authority7 versus prior physical display99—and acceptance must include confirmation, rollback and restoration, not only outbound Link. There is no existing global ordinary7 baseline available to assume. Such a feature is materially broader than this Link declaration correction and should not be silently introduced here.

Final conclusion: no new native bug established by the equal-write witness under current contracts. The failed expected99 assertion exposes a proposal-contract ambiguity, not permission to weaken tests silently. Preserve it and obtain the narrow explicit no-op/adoption decision; no runtime correction is justified until then.
