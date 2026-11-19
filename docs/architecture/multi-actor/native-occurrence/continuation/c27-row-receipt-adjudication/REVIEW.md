# ROW23 rollback receipt: independent bounded adjudication

**The original exact started expectation is not justified by useful restored delivery/settlement. Superseded is consistent with—and the result of preserving—the existing final-relevant-revision semantics for this exact sequence. No runtime defect is demonstrated by this receipt mismatch.** This is not a rule that every rollback must produce superseded.

Inputs: frozen C27 manifestbc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd; original ROW23 SHA256b8c6ec372e915a1b1fbec181dcffb072e6c02607274d499177045e834ba1c841. Read packet REPORT, original test, TESTS.patch, raw first failure and source. Exact inputs hashed in IDENTITY.json. No runtime/oracle edits or new executions.

## Authority before observation

Root declare-api-scope-review/AUTHORITY.md authorizes implementation and qualification under PROPOSAL.md for existing owned source kinds, explicitly without relaxed qualification. PROPOSAL.md:38 preserves final relevant revision/receipt fallback semantics and says later undeclared writes remain independently governed. Its :42 defines started as endpoint invocation beginning, not acknowledgment, and makes terminal states sticky. A declaration receipt therefore is not a connection-wide “some later send finished” certificate. settled() separately tracks transport completion.

Those clauses supply the normative distinction. Neither the observed word superseded nor the restored payload alone establishes which revision started. The revision trace below provides that missing fact.

## Exact trace

1. Original actual-owner rollback case creates pending p writing row.x7. Its equal independent whole-row declaration returns a receipt. The test reaches no equal notification, unchanged p.inspect(), sent=[], held/conservative receipt and unsettled waiter. Hence the declaration has not invoked the endpoint before rollback. A synchronous set would append immediately to sent.
2. private.prepareSourceProjection delegates to prepareScalar, which creates a fresh Fact/operation for installed projection work (:379–387). prepareRevision attaches the declaration's view only to matching active frames (lifecycle.ts:310–338). Final/fallback views stay associated with those operations, not future operations outside the declaration.
3. p.rollback performs later changed source work, restoring7→0 outside that declaration. private.ready installs/project-selects its fact and payload. Because this unit changed, it cannot use the unchanged/no-write collapse condition (:339–350); it keeps the new revision and supersedes the predecessor. The no-write fallback mechanism is for tentative same-declaration revisions, not a rule transferring a completed declaration receipt to later rollback work.
4. selectProjection/selectedReceipt (:35–44) pairs payload with its exact current fact. Link.sendEligible captures researchTicket from the selected fact (:872); after rechecking admission it invokes research.started(ticket,channel) immediately before endpoint.set(now) (:929–930). lifecycle.started updates views attached to THAT operation only (:385–388). Thus the one endpoint invocation carrying row0 belongs to the later rollback-selected revision. It is not an invocation of the old equal-row7 declaration revision merely because both use the same Link.
5. lifecycle.supersede (:390–394) closes an unsent predecessor, and sticky state guards prevent later rewriting it. Original raw first.log reaches exact row0, UI0, one row0 output, settled=true and await wait before failing solely on “receipt must be started.” It does not instrument private ticket identities; ticket attribution here is source trace corroborated by those public assertions, not a claimed execution trace of private IDs.

## Disposition and lower bounds

Preserve the original6-case body and5pass/1fail raw result as an oracle-premise mismatch. The premise conflates rollback delivery completion with the declaration revision beginning endpoint invocation. Keeping the existing revision semantics supports superseded for this exact unsent-declaration/later-changed-rollback path; no new owner decision is required merely to observe that distinction.

The prose contract does not specify a complete transition table for every equal-row decomposition. A future implementation could legitimately decide a genuinely no-authorship declaration as no-write at its own boundary, subject to the approved fallback semantics. This does not make no-write/started/superseded interchangeable in THIS traced implementation, or allow arbitrary status unions to substitute for qualification. Nor may rollback overwrite an already-started terminal receipt: if the declared revision had actually invoked earlier, started must remain sticky.

Concrete normative lower bounds for a test-only counterpart:

- No disposed status before actual connection disposal; rollback is not disposal. The packet's explicit `not.toBe('disposed')` is meaningful even though its terminal-category switch also lists disposed.
- Restored payload, useful settled completion and no duplicate remain independent assertions; receipt interpretation must not remove them.
- Once terminal, immutable detached receipt/status remains unchanged through later disposal, same-key lifetime replacement and subsequent writes.
- Do not mark the old declaration started solely because the later rollback invocation completed. Exact started requires attribution to its relevant revision/fallback.

The broader terminal-category check in the three-case packet is partial coverage, not an exact rollback-status oracle. The original later immutability/disposal/lifetime assertions were unreached after its failure; separate packet execution supplies its own evidence, not retroactive passes for the original. No shipping qualification, runtime change or new receipt policy is inferred here.
