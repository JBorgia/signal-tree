# Bounded representation options — not implemented

These are source-level optimization proposals, not acceptance of a new authority or proof policy. Preserve the point count's 22 setup-only visits explanation; changing iteration syntax to avoid the existing counter is not work reduction.

## First eliminate repeated proposal materialization within one packet

Concrete measured problem: experimental-publication/entity.ts proposal() calls entityPublicationOrdinary(packet), spreads its result, reverses it, and finds a subject for each authored field. With N fresh two-field rows this creates 2N full-batch copies, in addition to 2N+1 flatMap results. Retirement does not change this path.

Candidate: compute the ordered admitted-edit sequence once for the exact prepared packet before invoking responsibility selection, preserving authoredRemoval inclusion and ordinal ordering. Build an exact subject→last-edit lookup from that same sequence once, preserving the current reverse/find selection semantics. Reuse the sequence for that packet's ordinary loop. No global cache and no persistent collection representation. Do not use a point-only edit as a substitute for the current packet selection if it would change which endpoint wins. Duplicate subject steps, removals, full/partial/equal authored footprints, absent endpoints and restoredFields precedence are mandatory semantic comparisons.

This removes real intermediate arrays and repeated search rather than evading the counter. Source revision validation must still reject callback/reentry that invalidates the preparation. If caller-owned packet mutation is accepted during the callback, eager reuse changes semantics: seal/capture the prepared packet at its existing ownership boundary or refuse this option. Do not silently treat a mutable packet identity as a version.

## Ordinary point: neutral certificate reuse

Separate proof payload sharing from lifecycle-token sharing. A NativeRequirement is mutable through finalize and frame completion; a neutral-looking current proof does not license reusing its requirement across writes. finalizeNativeRequirement samples pending owners after callback-capable preparation, and earlier captured inputs may carry a foreign possible window. An initial empty proof is not equivalent to a completed historicalWindow proof.

Smallest candidate: within one finalized, installed authority version, intern/reuse the immutable closed proof payload only when all semantic fields are identical (including historicalWindow, absent versus present optional fields, unknown/invalid/unavailable/rejected markers and every role). Keep the current write's acquisition/finalization and source revision; never let interned proof mutation affect an old receipt. The allocation runs do not measure proof objects, so no savings claim for this option is established.

For measured per-row map copies, use one read-only row certificate per exact tuple (collection source, subject lifetime, preparation/step identity, physical-or-ordinary version). Two consumers may share only if the row's endpoints and support version are identical, with no later set or requirement-cell mutation visible through that certificate. Point writes can still share unaffected immutable entries, but the changed field needs the current unit's selected endpoint. Physical and ordinary maps cannot be merged just because numeric payloads match. Existing equal-value code mutates previous.requirement; replacing map copies by aliases without addressing that identity is unsafe.

Across ordinary point units, owner-free at entry is insufficient. A new pending owner or callback changes the publication-input window. There is no approved reuse of a source certificate across a changed authority version, and no omission of source evidence when there are no recipients. Gates: callback opens a foreign owner before finalize, late enrollment after pending omission, equal physical/different ordinary support, retained receipt across subsequent write, and reentry that invalidates a prepared source version.

## Final placement: one shared enumeration

The current stage is mutable: EntityPlacementStage.patch, head, and tail can change through insert/remove/rekey/order. Object identity alone is not a version. The earlier key-lookup enumeration in EntityMutationFrame.preparePlacement precedes final ordering and cannot be reused as if it were final.

Candidate: after the physical stage's last mutation, produce one owned immutable enumeration at the existing preparation boundary. In that single pass collect (a) frozen before/after interval endpoints and (b) present physical adjacency entries for the visibility index. Both must reference the same sealed stage generation and base frontier. Visibility overrides remain separate ordinary-selection state; never overwrite captured physical adjacency with an ordinary override. Keep the original early key-resolution pass where it is needed.

Pass these prepared products to prepareInterval and createPreparedPlacementVisibility rather than letting each iterate physical.patch independently. There must be no callback-capable gap that permits mutation without revision rejection. Either make stage sealing explicit internally or validate an actual mutation version; do not merely label an object “final.” The products die with that preparation. Do not materialize a collection-wide root, scan unrelated committed rows, or disable future enrollment support.

Expected bounded target: reduce the three physical-patch passes to two in the existing setAll/prependMany control. This target is not yet measured. Gates: unchanged 2N counter and useful ids, final-front/order rearrangement, ordinary/physical divergence, invisible-neighbor runs, excluded subject, cyclic fallback, same-key new lifetime, and preparation reentry invalidation. A shared array still has construction cost; measure allocation totals alongside the original counter rather than hiding subsequent array walks from its Map-only spy.
