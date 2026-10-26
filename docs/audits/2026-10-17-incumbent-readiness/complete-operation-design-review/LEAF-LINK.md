# Leaf Link: missing publication receipt, not an order diagnosis

## Scope and identity

Read-only source/design review of frozen `f01ed39a7df8a5de185ebec0773e09e36537dacb` at `/private/tmp/v16-transition-qualification`, compared with `git show 87f6831f:packages/kernel/src/lib/link.ts`. No tests, probes, builds, models, or runtime changes executed for this task. Read `docs/review-contract.md`; existing execution evidence is `/private/tmp/slice5-qualification/REGISTRY-CURRENT-PLAIN.log` and unchanged `packages/kernel/src/lib/link-absent-locations.spec.ts`.

SHA256: link.ts `f74fa84fb70f2de16ec4e445e0d69d88e695ecadb6dedc59074acfd413cfa8c2`; experimental-publication/projection.ts `af3dcb643f07869d83c9d5b284e32456c66be32ad591585ad5e26dfd08a941b8`; experimental-publication/private.ts `626f7cca8b77aeeb8d9ecb4f6169bf0d76bbef4b0b42f289af7d89c7f50af611`; internals/plain-branch-membership.ts `4116ebdd4e7d300bf47e6f14260c914e6698116f6fbae3a30279fd7aceec12d7`; path-notifier.ts `445c22fcd15b413631c7ca8852773698a2029e6f332c52fd88e4298caf1c043c`.

The registry records seven leaf-source timeouts across ordinary omission/re-add, restoration, and rollback variants; branch/collection variants do not establish leaf liveness. Those timeouts do not themselves locate the awaited step. The causal chain below is source-derived, separately from that executed regression. No entity-order hypothesis is required.

## First missing handoff

1. `internals/plain-branch-membership.ts:145–194` captures changed presence with the real branch object, literal member keys, before/after exposed values, and member positions where available. The native notification intentionally carries undefined/undefined values: allocating a new position on a previously bare branch would be too late. This is a real membership operation, not an empty observation ping.
2. `link.ts:585–659` recognizes membership, validates registry ownership, rejects inspection/entity-location handling here, and uses structured node addresses to locate this source relative to the changed branch. For a leaf below an omitted member it correctly derives `eligible = undefined`; re-add derives the captured member's exposed value. It sets dirty, observes, and returns. It never supplies the new projected payload to `research.project`, nor replaces `researchFact`.
3. Independently, `projection.ts:12–24` marks undefined/undefined as `ping` and excludes pings from matching channels. Matching also requires the bound source position, whereas ancestor membership can have a different or absent position. Thus this event does not admit a new affected-leaf publication fact. `private.ts:34` consequently does not attach this operation's source revision/dependencies to the leaf channel.
4. Flush scheduling can still occur. `private.ts:admit` falls back to the original durable scheduler when no fact is supplied; its run wrapper grants only `if(fact)`. `link.ts:796–850` subsequently requires `research.allowed(ticket,...)`; for a supported source and undefined ticket, `private.ts:45` returns false. `researchHold` (`link.ts:773`) creates a relationship-owned unresolved promise. `settled()` waits that held promise after the serial chain and pending flush drain.

The missing information is the exact association between **this structural membership operation, this observed leaf's projected payload, and its publication revision/dependencies**. The payload and structured source address already exist. A wake-up alone cannot create that association: refresh only returns a previously projected latest receipt. Bare ordinary absence can therefore fail even without any pending rollback owner. This is not evidence that conservative holding itself should be removed.

There is also a source-level safety obligation, not an executed new counterexample: membership leaves an old researchFact intact. If that old fact remains latest and granted/clean, reusing it could authorize a different membership payload without its new dependencies. A correction must supersede stale evidence, not merely fix undefined-ticket liveness.

## Baseline and lifecycle boundaries

Baseline87 has the same native membership-to-eligible projection. Its flush/send use the original durable scheduler without the added research.allowed receipt check. The new obligation was introduced by experimental publication eligibility; the membership producer/projection was not migrated to provide it. This comparison is source evidence, not a newly run baseline result.

Omission and re-add must each advance exact source evidence, including same-value/ABA outcomes. PathNotifier's membership chronological barrier must remain intact; reconstructing payload later from live state would lose the committed event snapshot. `projection.completeSource` can associate an event with a previously completed fact, so adding only a project call is insufficient unless a new affected-source admission is guaranteed first.

In-flight sends capture their ticket and payload, acknowledge knownY, then reconcile the latest eligible value serially. A prior send's permission or acknowledgement cannot authorize a later omission/re-add. A new receipt must survive this existing sequencing without widening rollback ownership. Disposal already withdraws both local consequence keys, removes the research binding/subscriptions, and resolves held, sending, settlement, retrieval and order waiters before user cleanup (`link.ts:1054–1089`). It must continue to prevent new endpoint calls; it does not cancel an endpoint request already in flight.

## Minimal coherent successor obligations

Existing facts appear sufficient without a new public API or policy, but the missing structural-to-leaf join is substantive and must be explicit:

- Admit the actual membership operation to affected supported leaf publication sources using registry plus structured source/branch identity and member keys. Do not invent a branch position or match by display-path strings. Exclude foreign trees, unrelated siblings and entity-lifetime namespaces.
- Capture revision, participation and dependencies at the native operation boundary, before reentry; distinguish a real membership transition from a generic undefined/undefined ping. Preserve chronological delivery and supersession even for equal payload/ABA.
- Pair the exact admitted event with the exact native projected exposed value. Do not reuse a previous completed event's receipt as proof for a new payload.
- Keep default unknown/conservative holding. A bare ordinary omission must progress through the existing durable scheduler's release/grant on its own new fact, not by declaring it independent or clean. Keep authoritative ingress's existing exact-address, consume-once constraints.
- Publication dependencies remain publication facts only: no extra rollback owner, history entry, transaction authority, or changed restoration/inspection semantics. Keep latest-ticket validation, reentry checks, serial acknowledgement and disposal cleanup.

A one-line wake-up or unconditional permission would violate these obligations. Conversely, the current source evidence does not demonstrate a need for a new authority-selection engine or changed public semantics. Runtime work should remain stopped until the proposed handoff identifies how these existing facts join.

## Later finite falsifiers (not run here)

The cheapest acceptance vector is unchanged bare leaf omit/re-add with useful undefined/value sends and settled completion; then prior-granted receipt followed by pending omission (no early send), confirm/reject recovery, omit/re-add ABA, in-flight omission followed by re-add, ancestor versus unrelated literal-key sibling/tree, inspection-only omission exclusion, and disposal releasing local waiters without starting another send. Include publication provenance and unchanged pending inspect/rollback ownership assertions. Restoration and rollback variants must exercise the same exact handoff, rather than special-case origins. These checks are needed before claiming a repair; no new pass or implementation approval is asserted by this design review.
