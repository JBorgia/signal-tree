# Bounded equal-owner premise review

**Decision: eligible for a small source-owned selection prototype, but not an unconditional “unchanged + previous D means retain” patch.** No full scalar journaling rewrite is justified. Preserve/use the existing ordinary requirement; obtain only the missing current-selection fact from existing admission/folding. The proposed general endpoint port is not yet proven necessary in its full form. Restoration handoff remains explicitly unproved. No runtime patch or new execution performed here.

Source: frozen C23 `bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b`. Paths below are under its candidate/packages/kernel/src. Independently inspected source before reading author DESIGN.md; no preferred verdict exchanged. Authority: EQUAL-WHOLE-AUTHORITY preserves actual pending destination ownership and permits fresh evidence for supplied unowned fields only.

## What is sound

For an ordinary value whose **selected current requirement** still owns destination p, an equal replacement must preserve that **whole source requirement**, including q and inherited uncertainty/readiness—not just destination p. Combine it with current preparation/validation while preserving D/I/V/W roles. Do not call `captureNativeInput(previous)` merely to retain it: lifecycle.ts:152–173 deliberately converts consumed destination obligations into inputs. Retention is not consumption. Actual updater inputs still use their existing capture-before-updater path.

Use `nativeValues`, not recipient `Fact`/permission and not physical `nativeViews`. private.ts:93–152 distinguishes ordinary support from inspection physical certificates. Retain selection only for unchanged ordinary semantics; genuinely changed admission chooses the new requirement rather than unioning every historical destination. Unchanged writes must not manufacture destination ownership from ambient transaction metadata. Note: the current factory skips a plain nonvalidating no-op; false D creation needs its validating/branch-input path, not every no-op transaction.

Main's ten-case baseline file and before/first.log were read: four actual-owner leaf/whole cases and two inherited-q cases fail before terminal actions; four unowned progress cases pass. The q fixture explicitly declares q around p's write. In implementation terms q can be carried as validation support, not necessarily the `input` array. Preserving the complete requirement avoids losing either representation. Those failures do not execute their later p/q settlement assertions.

## Concrete limitation of previous D as current selection

My initial sufficiency statement applied only if nativeValues already denotes current selected ordinary ownership. C23 does not maintain that invariant across net-turn folding. This is a source-supported rival, not a newly executed progress result:

1. transactions.ts:4252–4277 combines x's writes into before0/after0 and journals them; the bucket itself need not immediately delete x.
2. The LIVE `drainCaptureBucket` at1840–1860 calls `settleTurnMemberEffects`. `plain-branch-membership.ts:441–446` recognizes equal scalar values as no-op; lines556–566 filter them out. `foldOperationDisposition` at2704–2723 uses the same settlement.
3. `materializePendingTransaction`:3067–3101 drains/folds and explicitly prunes independently journaled scalar positions absent from net effects/dispositions. Thus p can remain pending for z while x0→7→0 has no net x claim. This is not the dormant greenfield normalizer.
4. private.ts:133–152 nevertheless installed D=p on the last changed x write; neither map update there receives the later net-position pruning.

Therefore previous D can be noncurrent without the unchanged-write false-D bug. The proposed public diagnostic should verify p.inspect/net responsibility and required publication behavior before treating its progress expectation as executed contract evidence. The source chain establishes the missing selection correlation; it does not independently establish that every net-zero history permits immediate publication.

A narrow admission/fold update of the existing source record can address this fact. Do not infer ownership from all pending owners or erase debt just because p confirmed. Terminal-owner historical guards and q obligations require their existing dispositions.

## Implementation boundaries / unproved hooks

- Leaf `commitRecorded`:308–349 and frame `prepareSlots`:205–267 distinguish ordinary equality from physical change using inspectionBaseline. Returning an inspection overlay to ordinary value may be ordinary-equal but physically changed. Do not relabel an old physical snapshot's unavailable certificate as the retained ordinary requirement. Preserve existing adoption behavior.
- Keep membership/presence and entity lifetime support separate; an equal leaf value does not certify unchanged membership. Do not copy support by path/business key.
- Preserve current validation and readiness: finalize/activate the newly prepared component, not merely a composite wrapper. A composite's readiness depends on its children. Retention must not leave the new child permanently unactivated or accumulate unlimited historical wrappers.
- Existing physical revision checks do not catch all support-only changes. A captured source requirement/view-requirement identity check must reach pre-install validation. `intrinsic-mutation.ts:330–345` currently checks preparer enrollment, not a native selection validator. Exact propagation and public reentry behavior are prototype obligations, not proven hooks.
- Rollback context (`transactions.ts:3763–3778`) carries transactionId but intentionally no transactionOwner; nativeAuthorship can still find that cell while marking attribution unknown. Do not reinterpret that D as authenticated new ownership. Exact restoration of surviving ordinary support is unproved; an expanded historical endpoint model is not approved merely to solve it.

## Required bounded falsifiers

Keep Main's ten cases and original React failures; require useful confirm/rollback/no-duplicate/settled assertions to execute. Add no-op transaction ownership, the preregistered net-zero diagnostic, real newer-owner replacement, p-confirmed/q-pending repeated equality, and selected-owner restoration controls. Exercise direct leaf and whole frame, inspection adoption/return, and supported comparer/updater reentry with unchanged first-error/no-retry behavior. Preserve unowned progress; “always hold” is not a repair.

No new tests ran here. Prototype eligibility is not mechanism acceptance: current-selection reconciliation and restoration must be demonstrated before composition. No API, authority, budget or activation change follows.
