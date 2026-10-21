# Independent slice2 design premise review

Read-only against the frozen slice1-based candidate, design.md, 80e6095e prerequisites and existing capture/target source. No runtime edits or probes executed.

## Disposition

The proposed sparse ordinary presence/key/lifetime divergence plus prepared plural ordinary facts fits the approved shared-transition migration. It does not inherently introduce a second settlement engine or a permanent canonical mirror. C1–C3 outcomes are already owner-authorized; their currently absent representation is an implementation requirement, not a reason to reopen policy. However, the design is not yet an implemented/general proof, and the frontier and complete-target joins below need explicit preservation.

## Existing machinery and necessary distinctions

1. `CommittedEntityCapture.changes` and `prepareEntityResponsibility` already admit multiple ordered records before installation. That is an implementable foundation for C2's ordinary removal of old A plus addition of fresh A. The rich notifier route must carry the same prepared ordinary sequence, including an explicit empty sequence for C3. Missing evidence must not mean empty; physical singular structuralEffect remains for physical callbacks. Consumers must not both process the physical record and the ordinary list.
2. C1 physical-existing field adoption requires ordinary add responsibility, but no physical add. Current fast field path only captures value and the frame derives structural records from physical mutations. A shared prepared result must therefore govern those two lists separately; simply bolting an ordinary add onto a physical callback would reopen capture atomicity.
3. C2 needs a retained prior ordinary identity/key/value/placement obligation even before a new transaction exists. Current tombstone retains only active/restoreAllowed lifetime state; transactional retention can preserve backing but does not preserve the lost ordinary key/provenance. A sparse displaced-key index is appropriate if it tracks exact non-reused subjects and is updated with the divergence record atomically. It must not borrow a Link projection or count lack of pending transactions as proof of reclaimability.
4. `undefined` ordinary value is not a sufficient absence sentinel. Explicit ordinary presence is necessary. C3's physical removal with ordinary empty effects must still deliver physical taps/projections without creating an inverse add.

## Frontier join

Existing structuralFrontier intervals describe physical order versions. `transactions.ts:2676` ignores intervals whose endpoints are equal; compensation validates intervals and only restores applicable prior frontiers. Therefore do not manufacture a distinct physical frontier for C1 merely to trigger structural listeners, nor claim equal endpoints describe an ordinary order transition.

Ordinary structural effects and physical frontier evidence can coexist as different facts. C1 may carry ordinary existence responsibility with no changed physical interval, and its later inverse physically removes the adopted lifetime. That inverse must produce its real physical frontier and preserve retry/history continuity. Conversely C3 may change physical order with no ordinary inverse. The design should test this separation directly, including a later operation and useful rollback retry; existing source does not prove it merely because both fields can fit in a record. This is an internal mechanism qualification requirement, not an unresolved public semantic decision.

## C2 complete-target dependency

The existing same-key vacate/occupy guard in target-transition.ts238–282 returns true, and transactions.ts3108 onward selects rollbackPendingTarget before point realization. Preserve it. The current prepare-entity-target installs a complete valueTarget and publishes physical differences, which cannot infer which untouched inspected subjects should retain divergence.

Carrying the already-admitted ordered reversal footprint alongside that existing complete physical target, and applying ordinary discharge only to the footprint's subjects/facts, is a defensible **narrow dependency necessary for C2**, not automatically a wholesale slice3 migration. Use the original generic admitted facts, not a special C2 boolean or a target diff. Mixed effects in the same admitted operation must all remain accounted for; forwarding only removeFresh/restoreOld while dropping an accompanying field reversal would not qualify C2 composition.

This remains within the prerequisite's allowance only if the physical target admission/installation contract stays unchanged, unaffected subjects retain their ordinary divergence, and the extension does not require redesigning full-target realization semantics. If those conditions fail, stop at the concrete cross-slice dependency. Do not bypass the guard or claim C2 on confirmation alone.

## Bounded acceptance concerns

- No-Link and Link C1–C3; old/fresh held references; ordinary publication after rollback and terminal retry.
- Plural ordinary records captured once, ordered consistently through prepared and rich capture, even when physical notifications coalesce.
- Inspection-only placement/selection neighbors never become ordinary intent by observation. Actual prepend/append/order authoring retains approved complete-install-before-callback semantics; the five newly failing prepend controls are real unmigrated writer failures, not authority to relax callback ordering.
- Preparation validates prior identity/key/ordinary-index revision after getters/reentry; index installation and terminal responsibility precede any callback. Failure may preserve independently authored reentry but must not partially install the outer attempt.
- Complete-target C2 retains unrelated inspected C and old lifetime's required facts until inverse/confirmation releases them. Final reclamation qualification remains separate, but known live obligations cannot be dropped during this slice.
- Sparse point work must not enumerate unrelated members to discover ordinary vacancy or position. Full-target work already mandated by the unchanged guard is a distinct existing cost, not permission to move scans into ordinary point admission.

No public API expansion or additional owner policy is established as necessary by this review. No implementation acceptance follows; the proposed internal seam is plausible under these concrete obligations.
