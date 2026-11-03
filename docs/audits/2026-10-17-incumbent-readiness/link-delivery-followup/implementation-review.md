# Independent bounded delivery implementation review

Reviewed `/private/tmp/link-delivery-followup` loader, private policy, first-source, frozen prior witness, targeted harness and raw logs. Source baseline is `65dd717fcda88663d0200c5b254784aec37f9239`. Reviewer changed no implementation or production source. Final ticket immutability correction is pending at this initial review point; see addendum for final identity.

## Independent execution

Executed both generated modules directly with Node ESM, importing `run` from `targeted-bundle.mjs` and `bundle.mjs`. This does not rebuild or rewrite worker artifacts. Targeted replay produced 32 checks, zero failed checks and zero harness errors. Frozen prior-witness replay retained unrelated control rejection/tree-destroy findings while the transformed bridge no longer sent stale42 after observer replacement and delivered42 then9 in the previously wedged held-inflight case. Authoritative ingress remained42 then7 before unrelated x settlement.

## Contract-specific assessment

- **D8 held visibility:** source researchHold adds a promise to actual Link's held set, not a separate private map. Denied send attempts resolve to let Link's existing chain drain while that actual held promise remains. The tested eligible correction flush reuses/releases the hold. Targeted held-inflight observes settled false during unknown and true after correction; disposal releases the wait. Equality correction also passes: acknowledged42, unknown7, authoritative42 produces no duplicate42 request and resolves held settlement. This is useful non-vacuous coverage of the acceptance concern.
- **Revision at invocation:** captured researchTicket is rechecked after observeLink against latest enqueue receipt identity and clean fact. Synchronous observer writes therefore invalidate the selected ticket before queued projection delivery. Both unknown and eligible observer replacement tests pass: obsolete42 never starts, later/current9 progresses. The actual Link projection, queue and knownY remain the source machinery; no parallel payload projection was introduced.
- **Started requests:** held-inflight and eligible-inflight retain maxActive1 and exact42→9 order. Actual completion acknowledges the bytes sent, then Link's loop reconciles the next revision. No cancellation of already-started bytes is claimed.
- **Observer throw:** one-shot sending-observer throw restores sending=false, sends no42, and later9 progresses. The loader catch resets sending then propagates through existing Link reporting. First targeted harness did not assert actual onTreeError delivery; reviewer requested a narrow D9/D10 reporting assertion to close this acceptance evidence gap without altering the algorithm.
- **Unknown evidence:** direct/captured work remains unknown even after unrelated confirmation. This intentionally remains an unmet automatic-progress requirement; the corrected queue does not fix evidence absence.
- **Tree destruction:** prior witness still sends42 in original/control and transformed bridge, followed by separate confirm-on-destroyed-tree harness error. This inherited D11 remains unresolved, as required by the preregistered scope. It prevents lifetime qualification, not honest reporting of the bounded delivery results.

## Scope and preserved failure

First-source retains mutable private ticket facts inherited from the prior bridge. Because notifier metadata exposes the same fact reference, changing its clean field could otherwise change authority. The parent authorized completing the already-specified immutability obligation by freezing the exact ticket, with raw pre-fix attack preserved and no delivery algorithm revision. Final assessment requires reviewing that narrow correction and replay. Immutable scalar tickets do not establish immutable arbitrary-container payloads or automatic causal discovery.

The private held map is now unused by admission; heldCount0 alone is therefore not cleanup evidence. Actual settled/dispose tests carry the relevant behavioral evidence. latest/receipts retention remains unqualified. No framework/entity/record integration, generic callback capture, public API, performance or release acceptance is inferred.

## Final immutable-ticket and reporting addendum

Independently replayed final targeted bundle: 34 checks, zero failed checks, zero harness errors. Added D9/D10 checks observe the real onTreeError records with operation `link:set`, path `y`, and respectively `Error: targeted endpoint failure` / `Error: targeted observer failure`. This closes the initial reporting verification omission. D8 equality correction and all previously described targeted controls still pass.

Reviewed private.ts diff against first-source: only Fact fields become readonly and the created fact is wrapped in Object.freeze. No admission/delivery algorithm changed. Preserved first-attack-traces.json records mutation of an unknown ticket to clean succeeded and sent7. Final attack independently replayed as `{"sent":[],"events":[{"threw":true,"clean":false,"frozen":true}],"immutableTicketSafety":true}`. The omitted runtime immutability was therefore a concrete first failure, now corrected within the declared evidence contract. It is not concealed by the passing final result.

Independently replayed final frozen prior-witness bundle too: stale-reentry now sends nothing, held-inflight sends42 then9, and inherited tree-destroy and control rejected-copy failures remain visible with the separate destroyed-tree confirmation error. No blanket all-green claim is justified.

Final executable identities:

- private.ts `07cd2fc9c68c469a05d0cd5b6b143d916bf1ae0f61cf399053fc44a3747ca453`
- loader.mjs `8d061e7d7d5576a18bd78ecc09ed62dfdf171eb4e86da5ab41288a0c09c4ff31`
- bundle.mjs `052133d9cc0484623521d7ed2e069f9b17a5922287d5ebdd38ca0a033be1b8af`
- targeted-bundle.mjs `6eab06c845a3a0c680ba6a20e35cae2a272208af3ae2289f5040a18c35156a62`
- attack-bundle.mjs `4732002b9c19a632cc19cefe04f829d0a3bf90b32826680e1c87b7593a63c4bf`

Final disposition: the bounded scalar delivery revision satisfies its tested scheduling, final-revision revalidation, actual settled visibility, error recovery and explicit-disposal obligations. The frozen evidence attack is closed. Automatic eligibility for ordinary writes remains unmet; tree destruction remains inherited/unresolved. These finite results do not qualify all publication/evidence/lifetime behavior or authorize production integration. Stop the bounded experiment here; no further delivery redesign is called for by this review.
