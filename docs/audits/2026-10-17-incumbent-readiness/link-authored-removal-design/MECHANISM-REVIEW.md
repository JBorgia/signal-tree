# Independent mechanism review

2026-10-27. Design-only review of DESIGN-FIRST.md. No runtime/test edits or runs. Source inspected at clean f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d in `/private/tmp/link-entity-obligation-integration`; predecessor 0135ef18567573fec627667fc58bc3e7819cc29e. Read the scoped adversarial-confirmation protocol and repository contracts. Did not read other reviewer verdicts. Final architectural writes remain with the parent.

## Narrow disposition

The ordered paired semantic footprint is a coherent bounded candidate for the two observed ordinary-removal regressions. I found no design counterexample requiring its rejection. Its positive capability is concrete: carry an accepted removal of lifetime X through preparation even when source O already lacks X, then subtract X from each recipient's own eligible baseline. That operation needs neither X's inspected payload nor a source ordinary membership insertion.

This is support for the mechanism, not runtime acceptance or authority to implement. One acceptance-scope dependency needs to be explicit: no-Link negative-proof survival cannot be qualified while the current retirement deletion remains unchanged. Selected-unit atomic admission likewise remains blocked on its separate preparation gate. A successor may test the bounded hypothesis while preserving those failures, but cannot declare the complete acceptance list passed by excluding them as unrelated.

## Premises checked

At 4ed3b6094404f59b940e601626408dbbadbec588, `link-a0-operation-contract/A0.md` says:

> The relationship creation baseline stays relationship-relative; it is not a new native ordinary store.

> It has an immutable identity and sequence, exact authored footprint, separate physical P and ordinary O changes, participation/origin, selected inverse identity when applicable, and an optional prepared publication-support edit.

> Install absence support for the addressed membership/lifetime.

> Realization is not a new independent declaration or ownership engine.

The same source's installation step 5 says:

> apply its exact O delta to each relevant relationship in installed sequence.

The proposed clarification is substantively necessary: reading that last sentence as source-O-delta-only conflicts with the retained relationship baseline and the observed existing removal behavior. The correction must remain limited to the actual authored footprint, not authorize arbitrary replay of physical effects.

At 392fcf46bb0cfa2e2a77dd6c4cae36c477331d6f, `link-membership-successor-contract/SPEC.md` says:

> Superseding a negative fact retires only its current reference; historical inputs, inverse/recovery and in-flight obligations keep their exact versions.

At dabd8880, `link-evidence-combination-review/SPEC.md` says:

> Known write ownership cannot remove input dependencies or possible-owner obligations. Each obligation needs its own justified discharge.

## Evidence and causal connection

The unchanged `ordinary-order-source-boundaries.spec.ts:58–95` creates early baseline [A], inspection-created X, then late baseline [A,X]. Removal must leave early sends empty and publish [A] to late. Raw 018 predecessor log reports this five-test file passing, alongside four failures elsewhere. Raw 020 reports both collection/nested variants failing at line 77 with undefined instead of [A]. Their subsequent adoption assertions did not execute. The file has no diff between predecessor and f7a0ffd9.

Source corroborates the cause, independently of those results:

- `entity-signal.ts:1212` preserves the explicit tombstone's subject and key in physical changes. `prepareOrdinaryTopology` at 967–970 emits no ordinary remove if the subject is already O-absent. `byStep` preserves the source-change grouping.
- Publication construction at 1320 supplies flattened physical and ordinary lists. `entity-egress-projection.ts:184–190` applies physical effects as inspection and eligible effects only from ordinary. `link.ts:582–584` likewise visits only ordinary edits for held row/field recipients; line 622 suppresses already-marked notification delivery.
- The native requirement builder in `experimental-publication/entity.ts` distinguishes physical visible support from ordinary membership support. A physical removal certificate alone does not establish the ordinary negative membership used by `support()`.

Thus merely resuming old notifications could recover the two visible outputs but would leave the source proof omission and bypass the prepared admission boundary. Source-O snapshot replacement would remove legitimate relationship differences. Treating every physical removal as authored would exceed selected inverse/maintenance authority. The paired footprint supplies the missing fact without those expansions.

## Boundaries the candidate gets right

The unit/step/lifetime identity is essential. Deduplicating a removal against its same-step O representation is safe; deduplicating by key across a remove/re-add sequence is not. Keeping inferred O displacement and explicit order domains in sequence avoids using the extra removal as an excuse to normalize the entire operation.

Existing selected realization already separates explicit `effects` from `physicalEffects`: `entity-signal.ts:688–725` builds ordinary removals from the former, while publication at 853 carries the latter separately. The design preserves that boundary. O-neutral authored removal need not enter `prepareEntityResponsibility` as a fabricated ordinary contribution. Publication dependency on a transaction does not imply transaction-owned native undo work.

The same lifetime subtraction can drive collection and point recipients. A point leaf already equal to undefined can still require support revision; `link.ts:595` currently gates receipt preparation on value/projection change, so a successor must implement the design's proof-only path rather than merely adding one more ordinary-looking edit. This is an identified implementation requirement, not a new product premise.

Clear currently enumerates active lifetimes at `entity-signal.ts:4417–4444`; removeWhere selects IDs before removeMany. The proposed scope does not turn either into an endpoint-wide deletion of unrelated recipient-latent lifetimes. Whole branch omission remains a separate producer.

## Concrete acceptance dependency and remaining unknowns

At `entity-signal.ts:3277`, forgetting a physical lifetime calls `entityPublication.retire`. At `experimental-publication/entity.ts:119`, that call deletes members, visible support and all other proof maps unconditionally. Therefore a correctly prepared O-neutral negative fact can still disappear before a later native snapshot consumer reads it. No-Link negative-support survival across this retirement boundary is therefore blocked; an R18 fixture that never exercises explicit retirement would not establish R19. It must not be advertised as independently satisfiable while retirement is explicitly excluded. The second route, `reclaimRetiredSubjectsWithoutOwner` at 3357–3391, physically forgets lifetimes without calling this support retirement hook. Its retained support is not proof of an obligation-aware lifecycle either: it can mask the complementary retention failure. Both routes require the same obligation-aware boundary for a native survival/lifecycle claim. This does not require folding the full compaction design into the removal patch: preserve the first failure and label the dependent acceptance unqualified until a separately authorized correction lands.

Similarly, design steps 7–8 correctly require revision validation, callback-free installation and rejection of stale completion. They do not establish that the current subscriber iteration and prepared records implement those requirements. Recipient disposal/enrollment, onRemove reentry, aggregate sibling updates, selected rich-capture failure, old queued versus already-started delivery and proof-only revisions remain unexecuted discriminators here. Existing failed selected preparation and owner-window gates cannot be counted as supplied infrastructure.

No new public policy decision is necessary to remove the explicitly addressed active lifetime from a relationship that adopted it. Broader setter domains, latent-row deletion commands, lifetime restoration after O-neutral rejection, or stronger destruction guarantees would need separate authority; this candidate properly avoids claiming them.

A reviewable successor should state: bounded forward-removal/proof-preparation experiment only; original assertions unchanged; no blanket removal or invented O contribution; selected and retirement-dependent cases retained with their actual results; no entity-integration, B, production or release qualification. The acceptance list remains obligations to demonstrate, not evidence already obtained.

## CASES.md follow-up

Inspected the proposed R1–R21 matrix after completing the independent source review. The closing statement that a removal-only successor could establish R1–R18 while still failing selected-unit preparation is too broad: R7 and R14–R16 directly exercise selected authority/preparation/reentry, and R18 alone cannot establish negative-proof survival through the retirement routes covered by R19. Replace that blanket range with named capabilities actually observed. R18/R19 native survival needs obligation-aware retirement protection; R20 compaction remains separately unqualified. None of these corrections authorizes implementation or requires resolving general GC to establish the narrow removal representation.
