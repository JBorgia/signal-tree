# Frozen explicit entity registration review

Bounded accept: no blocker demonstrated in the two-file registration delta. This is source/artifact evidence review, not independent runtime replay or release acceptance.

Identity: MANIFEST.json b0e09d16858ce67143ed08b3b2d159831ab96ddcb1d989a1d50d5ce880d04b2d; runtime.patch 2daa5b09c2b98e817b270522ec798705fdba91b3e7289a02cd7fc43ce128f6b1. Independently hashed all 3104 frozen files, zero mismatches. Base comparison shows exactly two runtime changes and two added qualification specs. IMPLEMENTATION-IDENTITY.json records these checks and emitted graph observations. Root HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777. No root/candidate edits.

## Mechanism

experimental-publication/entity.ts:60 now exports its existing participant factory as a private value; the factory body is unchanged. link.ts:64 consumes it with registerEntityPublicationFactory at module evaluation, rather than on each link() call. internals/entity-publication.ts:130–134 remains unchanged: one registry, competing registration throws, no alternative authority. Existing per-source lazy participant construction remains unchanged; registration does not allocate participant maps or traverse/write trees. No public barrel, package sideEffects, build configuration, publication decisions or transaction policy changed.

Prior dependency inspection (MODULE-GRAPH.json / LINK-MODULE-GRAPH.json and EXPLICIT-VALUE-PREMISE.md) found no entity-to-Link backpath or top-level application tree writes requiring the factory before this registration. This patch does not alter that dependency closure beyond the consumed value edge. Module evaluation happens before application use in the tested static entry graph. This is not a promise to reconstruct publication history when a genuinely new factory is first registered after prior writes.

## Evidence and falsifiers

The unchanged original eight public counterexamples assert actual sends, held dependent inputs, useful confirmation delivery and settlement. Author raw original8-first.log and production8-first.log each show 8/8; lifecycle6-first.log and production-lifecycle6-first.log each show 6/6. Source-first also executes the source counterparts. Canonical five-package build command and exit are preserved in BUILD-COMMAND.json / BUILD-RESULT.json (Node24.15.0, pnpm10.17.0, Nx sequential run-many, skip cache, stream); source unchanged. These are inspected author executions, not independently rerun builds/tests.

Lifecycle controls cover pending writes before Link construction, confirm/rollback, later collection creation, multiple recipients, useful payload, settlement and teardown. Pre-Link confirmation adopts the current baseline without an initial send, then a later independent write proves delivery. The preserved earlier expectation of an initial confirmation send was a fixture error, not a repair accomplishment. Do not count corrected fixtures as unchanged controls.

Independently inspected esbuild metafiles retain experimental-publication/entity.js in both actual Link consumer outputs (9015 attributed bytes each). The separate no-Link transaction output has no retained factory module; production-no-link-first.log asserts inspection, confirmation and rollback. This demonstrates the tested optional reachability boundary, not universal dead-code or allocation guarantees. Facade-imports log checks all five facades share Link/error identity and the private factory is absent from public exports.

split/early.mjs and split/late.mjs both import chunk-43EKSJS2.mjs, which contains the factory. split-first-first.log correctly reports actualDynamicImport:true, firstRegistrationLate:false. Thus late Link import is tested; genuinely late FIRST registration is not. No public shared-instance path reaching that stronger boundary was demonstrated. A future such path must test pending history/rollback without inventing private deep imports or duplicate authorities.

## Exclusions

No independent runtime replay in this review. No blanket package/artifact acceptance, performance conclusion, new API activation or release authorization. graph-first.log and budget-first.log remain exit1: all four current bundle ceilings fail. Source/lifecycle success does not override those gates. The smallest repair regression gate remains the original eight source/installed/production cases plus pre-Link pending confirm/rollback and no-Link transaction controls; these ran in the author packet. A genuinely late-first-registration falsifier did not run because the split graph did not reach that state. Combined lint+registration composition is a separate identity and still needs Main replay.
