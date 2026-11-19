# Terminal identity consumers and dormant helper applicability

Source-only follow-up to the preserved C26 public history replay. No runtime edits, runs, compactor, or new terminal policy. Source paths below are relative to frozen C26 packages/kernel/src/lib. The2/2 passing replay and growing confirmed I/V identities remain unchanged.

## What still consumes identity

1. **Selected destination witness:** experimental-publication/private.ts:167–168 matches `predecessor.owner` to an exact registry/id cell in priorProof.destination, then checks confirmation. Removing confirmed D through compactTerminalProof while preserving the endpoint's numeric owner can make this lookup fail. That can suppress the approved terminal-owner possible-only refresh. This is a concrete source dependency on a bound destination witness, not a claim every old qi must remain.
2. **No-write/receipt disposition:** private.ts:71 compares exact cell sets for owners/D/I/V/W; :339–350 uses that equality to collapse no-write versus keep/supersede/select a revision. A compact future certificate compared with an old uncompact proof is unequal even if operational obligations are unchanged. Merely introducing representation cleanup must not create duplicate delivery, a new authorship receipt, or unintended supersession. This is a concrete consumer of identity sets, although not proof that current equality is an immutable product requirement.
3. **Occurrence and operation bookkeeping:** recipient-occurrence.ts:7–20,59–73 counts role contributions by exact cell and caches entry proof/counts. Lifecycle operation dependencies register exact cells and retire those same registrations. Replacing a current contribution through its established mechanism can update accounting; changing an aliased proof in place does not automatically repair cached counts/dependencies.
4. **Issued inputs and aliases:** captureNativeInput captures the then-unconfirmed owner list and the exact requirement. Later confirmation does not rewrite that issued capture. Saved snapshot views, selected inverse/effect endpoints, old recipient facts and delivery/receipt state may alias the old evidence. These are outside a future current-source certificate's rewrite authority.

For the particular CONFIRMED qi in the successful growth fixture, delivery readiness no longer needs qi to transition: private.decision and lifecycle.decision/refresh ask outcomes and role flags. New capture already omits confirmed actual owners. No additional public behavior in this audit demonstrates a need for each old confirmed qi's numeric identity after a genuinely new current-source certificate has been admitted. However, items2–4 explain why simply deleting those references from the existing object is not equivalent.

## compactTerminalProof: useful shape, not a completed mechanism

Search of all packages/*.ts finds production declaration only; calls occur in publication-proof-retirement.spec.ts and publication-terminal-consumer-independent.spec.ts. It remains dormant in production.

The helper makes a NEW frozen proof. Confirmed actual cells are removed. Rolled-back actual roles become D/I/V or unclassified-actual rejection bits; pending and abandoned cells remain exact. Closed possible cells are removed, preserving unknown and historical-window facts; it does not turn arbitrary unknown evidence into clean evidence. Its existing tests cover role rejection, issued capture preservation, pending/abandoned identity, and callback-error reporting. Those are inspected tests, not executed anew or general proof of boundary correctness.

Concrete insufficiencies at a future current-source boundary:

- It knows neither endpoint owner binding nor whether an exact destination witness is still needed (item1).
- It does not provide source/recipient installation, horizon/readiness checks, alias isolation, cached contribution replacement, operation dependency cleanup or no-write comparison semantics.
- It returns only Proof, not C26's separate retirement classification. Original retirement rejects any actual-role membership even if confirmed; removing those identities and recomputing classification could falsely make a formerly blocked leaf releasable. Preserve the prior retirement classification or separately establish authorized new-admission semantics. Do not infer provenance/retirement permission from the compact role set.
- It cannot reclaim references in issued snapshots/tickets, transaction effects, pending operation dependencies or old facts; local proof shrinkage alone is not an all-root bound.
- Rolled-back and abandoned behavior cannot be justified by the confirmed-only history experiment. Abandoned remains live/unavailable in the helper; rejected bits need their existing downstream contradiction and replacement rules. No terminal policy widening is inferred here.

## Next bounded mechanism to specify, not implement

The observed residual supports investigating a NEW per-source certificate for future selection, after validation and activation have finalized, which can summarize confirmed historical I/V while retaining the pending destination's exact witness and every pending/abandoned obligation. Preserve old certificates and their issued aliases. This is distinct from C26's in-place ancestry normalization, which leaves role sets exactly equal.

Before any implementation, identify the admission/installation boundary and prove how source selection and recipient contribution accounting advance together without granting a new declaration or changing useful no-write behavior. Preserve the selected endpoint/effect provenance independently where it remains needed. Do not automatically sweep all old proofs on owner confirmation or rewrite snapshot NativeView objects shared with issued snapshots.

Cheapest subsequent falsifiers, NOT RUN here: the existing0/1/2/4 confirmed-qi sequence with p pending and exact final confirmation/rollback; a held issued input captured before qi confirmation; terminal-p possible-only refresh after witness handling; equal declaration receipt/no-duplicate comparison across the new representation boundary; and original-versus-future retirement predicate equality. Confirmed-only I/V shrinkage is a narrower question than rejected-role compaction. Any later extension to rejected/abandoned inputs requires its own existing contract basis and tests.

Disposition: identity/history is not proven universally necessary, but specific identity consumers are demonstrated. The dormant helper supplies a candidate role encoding, not an applicable drop-in repair. Current-source boundary design and alias/bookkeeping semantics remain missing facts; no runtime change is recommended under the present read-only authorization.
