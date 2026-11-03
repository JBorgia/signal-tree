# R3 design checkpoint — no implementation authorization

## Decision

Stop at a design-only boundary. A confirmation predicate alone does not implement R2's existing historical-closure safeguard for late recipient operands. A complete witness for that safeguard needs exact aggregate proof-version provenance and transient prepared-sibling ancestry. Existing Fact/leaf metadata does not provide it.

However, **that safeguard has not been established as a mandatory public semantic**. The approved contract preserves current obligations, validation, pending captures, issued evidence and receipts. It does not explicitly require every old recipient comparison operand to have been closed at admission. Consequently neither a general support-index provenance extension nor relaxation to comparison-only projection is selected here. The narrower comparison-only proposition needs a safety argument or concrete counterexample before treating the larger representation as necessary.

No runtime, fixture, oracle, configuration or frozen input changed. No new tests executed. This document is not implementation GO.

## Evidence and identity

Inspected frozen R2 `/private/tmp/st-c28-r2-cutoff/candidate`; manifest SHA-256 `597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c` rechecked. Inspected its runtime.patch and relevant private/lifecycle/recipient-occurrence source. Repository HEAD `628d302dadb082a48c58528651c9088234d0a777`; unrelated dirty root files preserved. Read docs/review-contract.md and continuation/C28-AUTHORITY.md.

Independent premise: `/private/tmp/st-c28-r3-design-review/REVIEW.md`. Its exact-version and sibling objections are valid against an implementation claiming to preserve the R2 closure precondition. They do not by themselves prove that precondition is required for comparison-only equivalence.

Existing executed evidence, not rerun here: `/private/tmp/st-c28-r2-n2-trace/TRACE-REVIEW.md`, COMPARATOR-SUMMARY.json and N2-FIRST.jsonl. Second fresh declaration differs only by old confirmed a in x's recipient prior; source mask cannot name a. y's prior is tentative x, without finalized proof metadata at preparation. Original repeated-no-write oracle remains failed and unchanged. Separate observational terminal/disposal arms reached useful output and cleanup; they do not pass the original receipt oracle.

## Required semantics versus implementation safeguards

Required: validate authentic fresh inputs; retain captured-pending protection even if confirmation occurs inside invocation; preserve D/W/unclassified actual roles, rejection/unknown/unavailable flags, retirement obligations and destination ownership. Raw current work must complete and activate before comparison/projection. Old issued proofs and receipts must not be retargeted. Comparison equality must preserve useful pending work and exact eventual send attribution.

R2 safeguard: P/S/consumed history must already be ready at admission before historical cleanup. Its application to source normalization remains unchanged in either option below. Extending this safeguard to every late recipient aggregate is a proposed implementation condition, not an independently established owner requirement.

## Option 1: preserve that safeguard using private provenance summaries

Proposed metadata is private and immutable per produced proof version:

- Admission descriptor: local cutoff, captured-pending protection, and raw current invocation barrier. Source creates it independently of recipient enrollment.
- Owner confirmation metadata: weak identity-keyed, write-once marker on first pending-to-confirmed transition. Same terminal repeat must not restamp; rollback/abandon/unregister must not fabricate confirmation; absent/synthetic metadata is ineligible.
- Exact proof-version witness: known historical closure bound or unknown, plus transient current-producer lineage. A baseline empty proof is explicitly known closed. A Fact-wide closed bit is invalid.
- Pending Unit witness: designated preparation predecessor relation, historical fallback summary, and current producer's raw validation/activation barrier. A same-horizon label is insufficient. Surviving and collapsed outcomes must both have covered ancestry; genuinely open older contributors cannot borrow the sibling exemption.

A possible coherent local order uses monotonically increasing native admission IDs: confirmation/closure events record the current ID, an admission obtains the next ID, and eligibility requires event ID strictly below its cutoff. Recipient events only read this order, never advance native admission or influence source classification. This is a candidate ordering representation, **not an established closure witness**. It does not supply missing contributor provenance. No public sequence, authored priority or distributed authority is introduced.

Exact producer/consumer inventory that would have to change:

| Existing seam | Required witness obligation |
| --- | --- |
| lifecycle.ownerTransition | Record first authentic confirmation only; preserve repeat, reversal and unavailable-source behavior. |
| Native scalar preparation / currentRelevance | Produce cutoff and L before callback-capable recipient preparation; keep source closure independent. |
| private.prepareScalar, publicationPredecessors | Capture tentative sibling lineage and fallback, not b.current alone; distinguish current C from open historical contributors. |
| private.installFact (211), nativeFact (457), enrollment callback (471) | Publish proof and witness atomically for every version; leaf witness alone cannot certify aggregate history. |
| RecipientOccurrences.replaceEntry (59–70), presence/enrollment/removal, proof (83) | Preserve provenance of untouched contributors as well as changed ones; readiness callbacks replace versions. Existing role counters and unresolved count lack admission-time lineage. |
| private.ready (346–354) | Cover actual selected prior version, including predecessor collapse; reject stale/missing witness without mutating old proof. |
| lifecycle.projectRevision (534+) | Derive witness through recipientProof/currentObligations and raw completion; do not stamp the transformed result as newly closed without its ancestry. |
| index wake / projected fact replacement (private 460–465) | Replace witness with proof; never carry a Fact-level stamp over a different aggregate. |
| ordinary observation (private 550–570) | Preserve unknown evidence; derive a complete witness or explicitly disable cleanup for that version. |
| refusal/disposal/noWrite completion | Release transient Unit/barrier references; retain no cumulative proof chain behind a summary token. |

**Scope conclusion:** this is broader than changing CurrentRelevance or adding a receipt field. It requires private metadata through existing aggregate support producers, potentially additive summaries on the existing support index. A new index topology/owner graph is not demonstrated necessary. Conversely, a private preparation/receipt-only summary is not yet proved sufficient because untouched aggregate contributors and later index callbacks can replace the comparison proof. The precise unresolved seam is propagation of historical versus designated-current provenance through those aggregate replacements, without retaining a historical chain. Do not implement a timestamp-only substitute.

## Option 2: comparison-only projection without historical recipient closure

Keep source normalization's R2 closure rule. At recipient no-write comparison only, provisionally project obsolete I/V from both exact operands using immutable confirmed-before-cutoff eligibility and captured-pending protection; preserve complete roles/flags, require raw current validation/completion, and never mutate issued certificates.

This is plausibly narrower: late discovery of old a need not enumerate history or certify old proof closure if the same owner cannot later acquire a relevant obligation that the projected comparison hides. **Sufficiency is unproved.** Full proof equality at a moment does not alone prove equality of future evolution or preservation of pending value-work/receipt responsibility when an old open aggregate later changes. Nor may comparison-only projection silently become authorization to clean op.native, dependencies or source history. Those roots require their own established conditions.

The decision question is concrete: can an already-confirmed eligible cell in an old open proof later gain D/W, invalidity, unavailable/rejected evidence, or different publication responsibility that is lost by collapsing the new op? If yes, preserve the counterexample and use a witnessed restriction. If exact existing lifecycle/recipient mechanisms necessarily retain those changes and old operation responsibility, document that argument and test it before selecting this narrower option. No such counterexample or complete proof was produced in this read-only pass. The independent review's closure argument is not itself one.

## Finite next discriminators (planned, not run)

1. Unchanged approved A/B and original repeated-no-write n1–n4 through both terminal/disposal assertions. Count current source, recipient, selected operation dependencies and issued/cached evidence separately.
2. Two sibling preparation orders, earlier sibling collapse versus meaningful retention; inspect actual final prior version. A genuinely open old contributor installed in the same outer horizon must remain distinguishable from designated fresh C.
3. Old aggregate open at cutoff, closes before reduction: vary whether completion adds only obsolete confirmed I/V or adds destination/possible ownership, invalid/rejected/unavailable evidence or pending value-work. Assert exact output and old/new receipt responsibility, not a private closure boolean as public policy.
4. Replace the same Fact's aggregate proof between preparation and comparison through an existing occurrence/readiness callback; preserve the original proof reference. Establish whether narrower comparison retains all future responsibilities or needs version provenance.
5. Confirm pending input inside callback; fresh authenticated confirmed validator with contradiction; opaque current-location plus saved-payload obligations; fresh cached-container reader safety. Existing protected controls remain unchanged.
6. Both completion orders, readiness/retirement blockers and errors/reentry. Confirmation repeats, rollback/abandon/source unregister and missing metadata must not create eligibility. Refusal/disposal must release transient references.

The cheapest next decision is premise adjudication of option 2 against exact open-proof evolution, then these finite paired controls if authorized. Do not expand to support-index implementation merely to satisfy an unproven internal precondition. If option 1 is selected, first require a concrete aggregate provenance propagation table for the seams above; this document deliberately does not claim that missing implementation is already safe.
