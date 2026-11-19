# Independent R3 premise review: option B closure witness

Decision: a private bounded experiment is justified, conditional on implementing a proof-version closure witness in addition to confirmation eligibility. ALTERNATIVES.md describes B's confirmation predicate sufficiently to investigate, but does not yet specify that witness completely. No concrete contradiction with approved semantics is established. B alone as a timestamp/predicate substitution is not implementation-complete. No runtime edits, executions or policy selection here.

Reviewed /private/tmp/st-c28-r2-n2-trace/ALTERNATIVES.md and exact frozen R2 source, particularly private.ts:347–354,377–393,453–471; lifecycle.ts:122–123,160–172, ownerTransition and completion; tree-scalar-slot-runtime.ts:212–240. The prior independently parsed n2 trace establishes old closed x-prior8 and tentative y-prior12, followed by x meaningful/y no-write. Approved A/B and repeated no-write remain fixed.

## Concrete gap

B answers whether a cell confirmed before admission even if encountered later. It does not answer whether the proof carrying that cell was closed history at admission. The source P/S/input closure checks do not cover a different old recipient aggregate. Nor is factRequirements.get(previous) necessarily that aggregate: installFact records a field requirement, then private.ready overwrites proofs.get(unit.fact) with aggregate support. The occurrence callback at private.ts:460–465 can also replace a projected fact's proof. Consequently a ready leaf requirement or one permanent “fact closed” bit is not a complete witness for every version of proofs.get(fact).

Tentative sibling identity creates a second concrete gap. publicationPredecessors links prepared units before reduction. Whether an earlier unit collapses to an older issued fact is decided later. A y check that accepts “same horizon” can wrongly admit a genuinely unresolved old contributor installed earlier in that outer horizon. A check that demands every tentative prior was already ready at y admission instead rejects the useful same-operation sibling case. Neither is a complete classification.

## Minimal sufficient witness to prototype

One feasible companion mechanism, not a selected implementation, is a private certificate for the exact aggregate comparison proof version with two separate parts:

1. A historical-closure summary: whether ALL historical contributors are accounted for, and when their readiness/activation closure was established. The summary must be identity-bound to the proof version, not merely the fact or one leaf requirement. A maximum local closure ordinal plus an unknown/ineligible bit can summarize conjunction of known historical closure events; no owner enumeration is inherently required. The admission cutoff must use a coherent local order for the events it compares. A baseline empty proof has an explicit known-closed witness, not a missing-metadata default.
2. A transient producer classification for newly prepared contributions: exact membership in the existing prepared-unit predecessor relation and completion/validation barriers. Their C is permitted to be unfinished at admission but must be raw and validated before projection. This classification does not turn an unrelated earlier open source requirement into current C.

At preparation, each unit derives a conservative eligibility summary for both potential prior outcomes: the earlier unit's effective old fallback and its newly produced aggregate. Include the historical summary of the previous aggregate, retained/consumed old support, and all untouched aggregate contributors. Do not merely tag the changed leaf. Earlier unit C contributes its genuine current barrier/protection, not a fabricated historical closure event. Propagate the summary through the existing preparation order; it need not retain a cumulative owner list or a new permanent predecessor graph. At reduction, compare only against an actual prior version covered by this witnessed lineage. If metadata is missing, changed by reentry, or includes history closing after the current admission cutoff, decline cleanup for that admission.

When a unit collapses, the effective predecessor must retain the witness associated with its actual old proof version. When it survives, the newly composed aggregate receives the correct derived witness. Any callback/occurrence path replacing a proof version must derive/update the witness or invalidate it, never silently reuse stale closure metadata. Failed/uninstalled preparation must not publish the witness. No new fallible work may be inserted after installation to retrospectively guess ownership.

These are concrete sufficient obligations for the experiment, not a demand for a general new causal model. A conservative union of the two outcome summaries may decline cleanup unnecessarily; then it cannot claim the corresponding progress case passes. Closure witness scalars/booleans can avoid historical owner lists, while temporary C/unit references already have bounded completion/disposal lifetimes. Retaining a whole old proof chain behind a compact-looking token would not satisfy that claim.

## Why this distinguishes closure from validation

For n2 old a: its exact issued aggregate was closed before admission, so its existing confirmation fact can qualify even though source P no longer mentions a. For the tentative x contribution seen by y: closed historical ancestry is inherited through a witnessed prepared-unit relation; x's fresh raw validation remains a barrier until completed. For a genuinely open old input: its historical closure time exceeds the admission cutoff or has no valid witness, so it cannot become eligible merely by closing before reduction. An owner's confirmation time does not substitute for any of these certificate facts.

All per-cell rules remain mandatory: pending-at-capture/frame-entry protection, D/W/unclassified roles, invalid/unknown/unavailable/rejection flags, authentic current validation and unprojected retirement classification. Comparison eligibility is not permission to normalize an issued old proof, delete an old operation's dependencies, or declare independence. Source normalization must stay source-owned and cannot depend on Link enrollment.

## Cheapest falsifiers and scope

- Preserve original repeated-no-write through n4 and terminal/disposal assertions. It tests the old closed proof absent from current source.
- In the same two-sibling preparation, exercise both earlier-unit collapse and earlier-unit meaningful outcomes, and reverse sibling order. Assert that the actual final prior proof/version is covered, not only that the receipt happens to match.
- An old contributor installed earlier within the SAME outer horizon stays unresolved at the next admission, then closes before reduction. Cleanup must remain ineligible for that admission; distinguish it from the designated fresh sibling C. This defeats a same-horizon shortcut.
- One callback-capable preparation/occurrence update replaces the prospective aggregate proof after witness capture. A stale witness must invalidate or follow the new exact version; no post-cutoff confirmation may become eligible.
- Retain pending-captured-then-confirmed, confirmed nested-validator contradiction, opaque dual obligations and both completion orders. Observe release of witness/descriptor/producer references, not only visible role counts.

A can avoid confirmation metadata but has the same version/lineage completeness problem and additionally must enumerate confirmed candidates before callback-capable preparation. B removes owner-list enumeration, not that provenance obligation. The proposed witness above makes a bounded B experiment technically meaningful; ALTERNATIVES alone does not establish it already exists. Acceptance requires the concrete implementation and finite witnesses, not generic “ready” naming or a timestamp-only model.
