# Ordering model: pre-execution expectations

Baseline: `1d5f8934cb07a5a8824ab9d5ccac3ebf620038f5`.
Written before model implementation/execution, October 17, 2026. This is an
isolated executable experiment, not a kernel implementation or contract change.

The current owner instruction requires pure-order confirmation to retire
superseded authority and release dependencies no surviving obligation needs.
That is an experimental acceptance target. It does not say that confirmation
releases every dependency, or that partial placement globally supersedes order.

| Case | Expected outcome before execution | Basis / limit |
| --- | --- | --- |
| Pending exact P=C,A,B then pending exact Q=B,C,A from A,B,C; reject Q | C,A,B; P remains pending; reject P yields A,B,C | Existing pending hiding contract |
| Same P/Q; confirm Q then reject P | B,C,A, no obsolete P authority; confirming older P must also preserve Q | Current experimental target for pure-order confirmation |
| Pending exact C,A,B then committed front B; reject exact | B,A,C | Unchanged public partial-placement discriminator |
| Pending exact C,A,B then committed append D; reject exact | A,B,C,D | Unchanged public append discriminator |
| Confirm order over pending-created C | Creator rejection refuses atomically while that order still needs C | Existing dependency contract; confirmation alone is not release |
| Reject dependent order, then creator | Useful settlement succeeds; C disappears; no residual semantic dependency | Existing dependency release control |
| Confirm newer full order over the same members | Earlier order's own dependency entries retire; newer entries remain; rejecting a required creator still refuses | Current pure-order target, discriminates release from blanket retention/deletion |
| Committed replacement B,A after confirmed C2,A,B over pending rekey | Reject rekey preserves B,A; detached C lifetime stays absent | Existing stale-order falsifier; key mechanics must be modeled or explicitly outside coverage |
| Recovery-only inverse retained across supersession | It may restore preparation context during calculation but cannot become published authority; final result follows surviving authorship | Current lifecycle target |
| Removed anchors in one settlement | Restore original surviving relative order while deleting created anchors; no arbitrary substitute neighbor | Existing removed-anchor replay |
| Pending remove B from A,B,C, then committed front C; reject removal | Atomic refusal preserves C,A and pending removal; see source-reviewed policy refinement below | Unresolved: do not silently choose C,A,B, C,B,A or refusal as established semantics |
| Repeated append/prepend of one selected lifetime | No previous dependency-map copying or whole-order capture at admission; count total admission work including preparation | Current sparse-admission requirement |
| Explicit full reorder of n named lifetimes | May process n subjects and affected older obligations | No constant-time promise |
| Failed preparation | Visible order, authority and dependencies unchanged; retry remains useful | Existing atomic refusal contract |
| Reclamation | After obligations drain, no obsolete ordering/recovery records; held identity does not retarget a replacement lifetime | Existing lifetime contract, model scope must be stated |

Unknown moved-anchor outcomes must be reported as unresolved even if a model
policy produces a plausible result. An exploratory policy can be executed and
labeled, but does not count as a contract pass. Payload fields are absent from this
experiment; the seventh kernel assertion remains outside established failures.

Preserve the existing terminal-order test and count-admission.mjs byte-for-byte.
Their old results remain falsifiers, not tests rewritten to fit this model. A
model analogue is supplementary, not a claim that the unchanged kernel replay
passes. Any full journal replay, retained history, or whole-order work in model
settlement must be counted/reported rather than called sparse by association.

## Source-reviewed refinements before model execution

Independent review identified a public target-preparation rule at
`packages/kernel/src/lib/internals/causal-runtime/target-transition.ts:865`:
contradictory surviving predecessor/successor anchors cause refusal. By contrast,
`physical/structural-store.spec.ts:272` tests successor preference in the lower-level
primitive. The latter is not the public settlement rule.

For the moved-anchor model case, use **atomic refusal**, preserving C,A and the
pending removal of B; a subsequent committed placement restoring compatible
anchor order A,C permits retry to A,B,C. This is a conservative, source-supported
experimental policy, not a claim that the current public transaction has been
executed or that successful intent-based rebasing is forbidden by all contracts.
The exact open question remains whether rollback may instead reinterpret inverse
anchors using later authored placement. No successful rebasing rule is selected.

For pure order-only confirmation, this model tests whole-fact supersession by a
newer confirmed **exact** order. It must retire the old dependency owner while
retaining dependencies of the new fact, even when the lifetime sets are identical.
A partial front/append is explicitly not global supersession. This defines the
model experiment, not final production semantics.
