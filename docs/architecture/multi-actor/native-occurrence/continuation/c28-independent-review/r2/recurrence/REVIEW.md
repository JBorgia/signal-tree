# Independent R2 repeated-cleanup finding

Disposition: R2 fails the approved repeated fresh no-write qualification; do not accept on the strength of other green runtime/types runs. No policy change, oracle weakening or runtime repair is justified by this result. No new executions or edits to candidates performed.

Verified evidence: the repeated-no-write-roots.spec.ts SHA256 f5e8d8474b5cb13dc6c785ac7808b5e74e8ec1533a8380b0b96447f175bf56ff matches diagnostic/PREREGISTERED.json. Qualification private.ts/lifecycle.ts independently match exact frozen R2 hashes. Diagnostic overlay inspected: exports/root observations and a forwarding nativeInputs wrapper, no intentional decision change. IDENTITY.json records source, raw, fixture and overlay hashes. First log records both confirm/dispose-pending variants failing at line26, expected no-write versus conservative/unknown; 10 other tests pass. No n2 comparator trace exists in this packet.

## Fixture and contract

All state-changing calls use ordinary public operations. p writes pair.x7 and remains pending. The historical declaration genuinely consumes pending p/a; a then confirms. Each loop writes an unrelated q value, confirms that transaction BEFORE fresh root acquisition, and declares the equal pair with [p,current-confirmed-q]. Thus there is no newly pending q at capture. The fresh confirmed handle still requires authentic completeness validation, but approved relevance excludes obsolete already-confirmed I/V history from fresh equal no-write under unchanged current obligations. Changing confirmed identity is not a new pending ownership policy. This is a valid recurrence of the approved case, not a universally asserted no-write for arbitrary equal operations.

The first failing expectation is the public receipt result, before later private identity/lifetime assertions. Therefore concerns about requiring exact old operation/proof object identities cannot explain away this failure. Those private invariants are useful preservation controls but are not themselves a general public API promise. Both terminal branches fail before terminal actions: no useful final send, settlement or disposal cutoff was established for these two cases. Finally teardown is not a passed disposal test.

## Concrete verified state split and source mechanism

NO-WRITE-FIRST.jsonl records n0 and n1 for each variant. At n0 source/current recipient owners are p plus confirmed a. At n1 source and current recipient owners are only p; the old selected operation is still original, dependencies remain p,a, frames empty, invocation absent, mask empty. No pending units/listeners/normalization enrollment remain. The n1 fixture also passes equality checks preserving original operation proof/native identity and restoring binding.current to its original revision.

This is the intended separation between a cleaned current field certificate and the finite old operation that must still represent the send. It is not a leak solely because the active old operation retains a.

The actual source couples different evidence domains:

- lifecycle.ts:160–172 builds relevance only from current scalar P/S, current captured requirements and invocation C. It does not inspect the prior selected recipient fact.
- private.ts:377 captures the prior fact from publicationPredecessors or binding.current. At 347–350 reduction computes current aggregate support but compares it against proofs.get(unit.previous), using the new source-derived mask on both sides.
- private.ts:351–354 collapses successful no-write back to effectivePredecessor and restores binding.current. It preserves the earlier receipt rather than replacing its issued proof.

After n1, cleaned current source no longer needs to carry historical a. Restoring the old recipient revision nevertheless makes its prior comparison evidence reachable for the next admission. A mask derived solely from cleaned current source/current invocation need not contain a. It therefore cannot remove that old confirmed I/V identity from the prior side, despite the current side already having discharged it. This is a concrete missing comparison-boundary input in the implementation. Reintroducing a into current source merely to make future comparisons work would defeat the approved cleanup.

The measured recurrence plus this source chain support a stale historical comparison mismatch, not a newly demonstrated current obligation. However, do not report “n2 differs only by a” as measured: the packet records no n2 mask, prior/effective roles, flags or readiness. Source/observations establish the domain mismatch; its exact failing field and full comparator delta still require the bounded trace below. In particular, old operation.proof and private proofs.get(previous) are distinct stores, so unchanged operation proof identity alone is not an executed observation of the latter.

## Scope and next falsifier

Retaining earlier receipt/dependency evidence remains required; it does not make every historical identity relevant to every subsequent current no-write comparison. Conversely, correcting comparison must not grant declaration permission, project an unresolved predecessor, drop pending-at-capture facts, or mutate old issued proof/ticket/snapshot objects. The earlier R2 P/S/C closure repair did not establish closure/eligibility for a different prior recipient certificate encountered during reduction.

Cheapest causal completion is a separate read-only observation overlay on the preserved n2 sequence: record unit.previous identity, proofs.get(previous), prior source P/S and readiness, fixed relevance/protected cells, changed/clean conditions, current field/aggregate effective proof, and sameProof result, before and after sibling reductions. Stop after first n2 comparison failure; no retry or repair. Expected falsifiable lead: confirmed a appears only on the old prior side, is absent from the source-derived mask, while all true current obligations/flags agree. If flags, pending roles or readiness differ, revise this attribution rather than suppress them.

A successor design must distinguish comparison eligibility for the actual historical recipient prior from source normalization eligibility, without using the former to rewrite old evidence or weaken raw current validation. No specific implementation selected here. Broader 147/type results do not discharge this verified second-invocation failure.
