# Independent two-history/no-write contract adjudication

**The proposed A/B pair distinguishes C27's exact internal comparator. It does not, by itself, prove that the approved public contract requires distinguishing those historical confirmed identities.** Public reachability and receipt effects await the author's separate raw replay. No policy selection, runtime edit, model or duplicate test run here.

## Counterexample checked

Hold the same flags, cleanliness, value, D={p}, W={p}, and retirement blocker. A has I/V={p,a}; B has I/V={p,b}; a and b are distinct confirmed cells. The new invocation captures I={p} and explicitly declares V={p,a}.

C27 combineProofs unions per-role identities. A's resulting sets are unchanged. B gains a in V and owners (not in I). private.ts:71 therefore returns sameProof=true for A and false for B, assuming these are the exact prior/effective proofs compared by the reducer. Erasing historical confirmed a/b from both predecessors maps them to the same representation, so a stateless downstream function cannot reproduce BOTH original identity-sensitive answers for the same invocation. The mathematical claim is valid.

This is conditional on the public setup realizing these complete reducer inputs: sibling contributions, recipient-domain flags, selected revision/fallback, and previous proof all matter. Source construction and the prior growth trace make it plausible; they do not substitute for the pending public A/B replay. Neither boolean alone predicts an exact full receipt/basis or endpoint call.

## What authority actually says

AUTHORITY.md approves qualification under PROPOSAL.md, not relaxed qualification. PROPOSAL.md:36 says handles are dependency references, authenticated without ownership transfer; confirmed cases require explicit qualification. :38 preserves no-relevant-authorship → no-write, native obligations, nested validation and final relevant revision/receipt fallback. :42 defines started by endpoint invocation and sticky terminal states. CURRENT-SPEC.md:40–48 retains these principles. None explicitly promises that historical confirmed I/V identity membership defines relevant authorship, or that re-listing confirmed a must be no-write only if the predecessor once included a.

Conversely, none explicitly licenses changing a public receipt transition merely because the identity is terminal. “Relevant authorship” is not a complete mathematical equivalence relation in these records. “Final relevant revision semantics remain” protects revision attribution/fallback and forbids treating later connection delivery as the declaration's start; it does not on its own enumerate which past confirmed identities make a NEW equal operation relevant.

Thus exact-history preservation is a property of current source, not an independently established normative requirement from these clauses. A new receipt discrepancy on public replay would be concrete compatibility evidence to adjudicate, not automatic proof either that the comparator is normative or that the discrepancy may be discarded.

## Fresh confirmed handle remains distinct from historical support

lifecycle.runDeclaration:440–446 accepts authentic confirmed handles, rejects rolled-back/abandoned ones, and retains explicit owners in frame.declaredOwners/frame.owners. prepareRevision:318,325 and native preparation validate actual input/shared-frame lower bounds against those declarations. Already-confirmed a explicitly supplied NOW is new validation evidence at this invocation boundary; it must not be silently removed from current-frame validation or nested contradiction checks under the guise of historical cleanup.

That obligation does not establish whether the resulting relevant revision should differ between A and B after identical new validation. Both statements can hold: preserve current a validation faithfully, while the contract still lacks a rule requiring the old a-versus-b distinction in the public no-write oracle. Public types expose states, not proof-role identities; types alone neither require nor authorize such a semantic choice.

## Bounded disposition pending raw evidence

Do not characterize the design's boolean counterexample as an established public incompatibility. It refutes exact stateless preservation of the current comparator, and identifies a finite public falsifier. Await A/B receipt histories, endpoint invocation/payload, settled behavior, predecessor receipt effects and disposal; retain first results unchanged. Ensure genuine explicit confirmed-handle validation and currently pending p are exercised identically.

If public results differ, distinguish observational compatibility from a promised contract before choosing a policy. If they do not differ, investigate masking/fallback rather than asserting the comparator is irrelevant. This review selects neither preserve-history nor outcome-equivalent no-write semantics and grants no runtime/oracle change.
