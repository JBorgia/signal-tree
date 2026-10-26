# Native updater input versus relationship uncertainty

This is a bounded source/contract interpretation following the preserved first run in `INDEPENDENT-INPUT-REVIEW.md`. It uses that report's frozen source copies and hashes. No new runtime change or test was made. The same-unit frame overwrite is a separate composition defect and is not part of this premise decision.

## Entailed distinction

A native updater receives a concrete source value at a concrete source/lifetime revision. Its actual native input dependencies cannot be erased by an independent declaration. But a relationship's inability to establish its creation baseline is evidence unavailable to that relationship, not a native write, a new owner of the value, or a fact that all other relationships have also lost their evidence.

The exact counterexample isolates these: c1's known baseline and local native input never change; only c2's enrollment moves across unrelated p's creation. The contract allows c2 to remain unknown while c1 usefully publishes. Applying c2's initialization unknown to c1 turns an observer enrollment into a new source dependency. That is not entailed by the authored-input lower-bound rule.

The converse matters equally: c1's available baseline does not give c2 an available baseline or an independent publication grant. Selecting the cleanest relationship's proof globally would be the opposite error. No union-all or best-proof selection across relationship channels follows from the approved contract.

## What can be captured without borrowing a grant

Within c1, capture the pre-callback support associated with the exact native facts that the updater receives, using c1's own value/field/presence evidence and source identity. Preserve its known transaction owners, unresolved or invalid input status, lifetime prerequisites that actually determine the input, and shared active validation horizons. An independent label contributes no declared owners; it does not clear any of these lower bounds. Mere `allowed`, `started`, a surviving-send grant, a clean-ingress flag belonging to another connection, or another relationship's receipt is not input provenance for c1.

Actual native ownership, source/lifetime identity, ordinary input revision and installation facts can be shared as source facts when their provenance is independent of a relationship's permission. By contrast, a foreign Fact's `ownProofs` entry cannot simply be relabeled native authority. In the frozen implementation `private.ts:14–27` stores only owners/unknown/invalid on proofs, and `own` at line 52 resolves a relationship-associated fact. `lifecycle.ts:85–100` includes connection matching and active declaration responsibility in those proofs. The representation does not label which unknown came only from foreign baseline enrollment versus an actual unsupported/invalid source input. That distinction cannot safely be reconstructed by stripping unknown or retaining only an owner list.

An application-hidden input still needs a truthful declaration. A native root/branch updater's supplied current argument is not such an unobservable hidden input: the runtime knows it supplied the value. Relabeling that entire argument as hidden in order to avoid native capture would weaken the approved rule.

## Required noninterference invariant

Fix c1's enrollment history, exact native source/lifetime revisions, actual updater input, declaration, and active enclosing validation horizons. Adding or removing c2 without a native write, settlement, ingress, or relevant active validation must not change c1's captured input evidence or eligibility. c2's own eligibility may differ because its creation history differs. Any additional known native owner introduced by an actual source write must still affect the appropriate recipient even if that owner was first observed through another relationship.

This invariant excludes no required cross-connection validation: an explicitly nested declaration or a write during its validation is not passive enrollment. It also does not permit c1 to use old evidence after the source changed. A captured snapshot must refer to the input revision actually supplied before callback, with installation/reentry validation retained.

## Can the existing representation serve the bounded case?

Yes, it has the information for the demonstrated full-source case without creating a second source-owned proof authority. Each Binding already owns fieldFacts, presence, baselineStructure, source/address and current support. `captureValueInput` at private.ts:144 already captures a recipient's own scalar/field input. The intrinsic source fan-out also already carries input snapshots keyed by recipient preparer (`intrinsic-mutation.ts:274–282`). The new branch stack instead flattens all recipients into one `Fact[]` (`private.ts:66–76`), and `prepareScalar:154–158` consumes that same list for everyone. Keeping immutable branch-input evidence associated with its recipient and coverage can express the required c1/c2 distinction. This is a representational correction; it does not require assigning c1's grant to c2.

That is not proof that a simple filter covers every supported composition. When the updater is on an ancestor root but a recipient observes only a descendant, that recipient's field table may not cover the entire native argument. When an input revision predates enrollment, the binding may genuinely lack its proof. When inspection and ordinary state differ, input evidence must describe the actual supplied input, not merely assume a relationship's ordinary projected value was the native argument. The frozen flat list has no explicit coverage/revision certificate resolving those cases. Using one foreign complete binding to fill the gap risks importing relationship permission; ignoring uncovered input risks discarding native lower bounds.

The contract permits unavailable evidence to remain unknown, but unknown is not a passing useful-progress result for an acceptance case that requires useful publication. Thus the smallest bounded correction can use per-recipient evidence where coverage is established and keep genuinely uncovered cases conservative. If the authorized acceptance requires useful progress over wider input domains absent from the recipient's evidence, it needs a concrete source-owned native-input evidence port or an equivalent explicit recipient annotation of those source facts. A global source proof store is not logically required by the four-case finding, and introducing one is not a mechanical consequence of it.

A0 already contemplates per-connection annotations on captured/history inputs and unknown when evidence predates a connection (A0:151–157). This supports recipient-scoped input evidence; it does not authorize global reuse of one relationship's declaration as another's permission. The central mechanism must specify coverage and provenance for any expanded input port before treating that expansion as implemented or verified.

## Precise result

The tested root failure is an implementation breach of passive-relationship noninterference, not evidence that the owner must choose weaker input safety. Existing per-binding evidence can express the bounded full-source correction. General source-owned proof is neither established as necessary nor supplied by the current flat representation. The unresolved boundary is exact input coverage and provenance for compositions beyond a recipient's recorded domain, not whether unknown may be silently ignored.
