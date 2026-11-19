# Independent packet admission review

## Bounded disposition

No new public-producer correctness blocker was demonstrated in the exercised admission paths. Stable metadata admission survives actual producer mutation, finalizer/reentry, edit-identity and held-proof controls. This supports the narrow source-issued metadata mechanism, not activation, full integration, or a point-work acceptance claim.

The `Object.isFrozen(edit)` branch does **not** establish ownership of nested shared metadata. I reproduced its in-place freeze, but only with a separately constructed private frozen shell. Current inspected production constructors issue mutable shells; measured native producer traffic confirms that in the tested paths. Do not report this private counterexample as a demonstrated public regression. Do not infer a general ownership-transfer contract from its absence in those paths either.

Bounded recommendation: previously admitted weak-marked edits can be reused; ordinary source-issued mutable shells can retain identity while receiving copied metadata as now. For a previously unowned shallow-frozen shell with mutable nested fields/descriptor, refuse before touching shared nested objects, or require producer-owned immutable metadata established before shell freeze. Object.isFrozen alone is not that provenance. This narrower private boundary avoids introducing a clone/alias registry merely to accommodate an unsupported shell. Main owns the disposition; no runtime correction made here.

## Source identity and scope

Author candidate `/private/tmp/st-packet-index-admission-r1/candidate`; source manifest SHA-256 `9863ad3f6955407e79e2663c4060f505b5f71c6f49cd96bc6e492335b09cd464`, runtime delta `dc5b423bf82f7495047ee6ef227b0f81011ca8e83419b17b2f9af79672f59bda` against packet-index successor (not frozen B). Fresh execution copy `/private/tmp/st-packet-admission-independent/candidate`. All 2,970 manifest files match in both author and review copies; only the new independent test is added. No runtime, author, root, baseline or oracle edits.

Reviewed raw source, runtime/tests patches, requested original fixtures and source protocol. Did not read Faraday's cost investigation or a preferred review verdict. No performance, broader suite, SDK or activation run.

Load-bearing task premise: “stable metadata admission temporary mutators/finalizer/forEditidentity/proof lifetime” and “Object.isFrozen(edit) branch freezing nested shared structural descriptor in place vs approved ownership boundary.” Code comment at entity-publication49–51 says “metadata is source-owned, row payloads and proof objects are not.” The frozen-shell branch's inference exceeds what Object.isFrozen proves.

## Producer trace, not an invented packet regression

Entity-signal is the production packet constructor (prepareEntityPublication2336–2338). Structural frame1410–1419, ordinary realization940–941, selected-point and direct-point2376–2377 build fresh mutable edit objects using literals/spreads. They can refer to an existing structuralRecord, which is why copying that descriptor matters. Admission edit56–70 replaces descriptor/fields on a mutable shell before freezing that same shell. It does not freeze payload rows or proof cells. preparePoint209 admits fragments before queueing; combined preparation316–320 reuses their identities and the same source admission WeakSets.

The independent spy records actual source entry on setAll, two-field pending writes and rollback, remove/restore, prependMany: **26 first-seen edits, 15 structural, zero first-seen frozen shells**. It verifies every original shared descriptor's frozen state remains unchanged, admitted descriptor identity differs, and all admitted shells become frozen. Values and restored lifetime ordering are asserted afterward. This is finite producer evidence, not exhaustive reachability proof.

A separate explicitly private test constructs Object.freeze(edit) around a still-mutable shared descriptor. Admission66–67 freezes that original descriptor in place. The result demonstrates the ownership side effect only; it does not manufacture a public producer path. Arrays/packets are private membership containers; the reviewed user payload control confirms public input rows/nested arrays stay mutable.

## Admission and identity findings

- Metadata is locked before native preparation, responsibility preparation and recipient callbacks (prepare217 onward), so an attempted temporary mutation cannot make native and later recipients see different subject/kind/order. Public add tests cover escaping mutation during both preparation and finalization: TypeError, old public state unchanged, no delivery, then successful retry after unsubscribe. The actual add temporary-kind control catches Reflect.set=false twice and verifies the later participant sees the same admitted edit and completed row.
- Native `entityPublicationOrdinary` uses steps when present; the packet index preserves ordered edits and uses last occurrence only for proposal lookup. Admission copies step shells/footprints but preserves edit identity. Native selectedAt is keyed by those edits (experimental-publication/entity103–170); egress uses the same helper and forEdit at entity-egress-projection210/231. The actual pending-field control verifies edit-specific evidence, pending owner identity, mutable requirement cell, rollback to1 and the retained owner's transition to rolled-back.
- Source finalize validates recipient/retirement state, invokes finalizers, and detects source revision changes. Actual nested field write99 during outer finalizer refuses stale outer7 and preserves99. This is a real public producer using an existing private subscription seam, not a fabricated alternate planner.
- WeakSets contain identity membership only and do not strongly retain keys. They are not proof-normalization authority. Proof cells and restoredFields contents are deliberately not recursively frozen. No heap-retention conclusion or blanket protection against arbitrary payload/proof mutation is implied.

## Exact execution

Pinned Node24.15.0/pnpm10.17.0, Nx skip-cache maxWorkers1. Each run directory contains exact COMMAND.json, first.log, RESULT.json and unique observations.

| Run | Result |
|---|---|
| author-eight | 8 passed |
| unchanged-focused | 61 passed, 10 failed, matching author full identities |
| independent-producers-final | 7 passed |
| final-spec-types | 202 preserved diagnostics; no independent fixture error |

The author-eight8 are included in unchanged-focused71; do not add them twice as unique tests. Five original independent controls passed first. Adding two controls initially produced6pass1fail because my structural forEdit assertion used packet.ordinary's top-level fallback edit while steps supplied the admitted sequence. `first-producer-fixture.ts` and independent-producers-complete preserve that exact error. The final test uses entityPublicationOrdinary(packet), exactly like the native and egress consumers, retains the nonfallback identity assertion, and passes. This was an invalid review oracle, not a repaired runtime failure.

The ten unchanged failures remain visible, not silently waived:

- two assert the old “admission structure changed” string, now receiving TypeError at the forbidden mutation;
- two expect a throw after ignored Reflect.set calls, but mutation is refused (false) and unchanged admission can proceed;
- one expects to reach finalize after recipient preparation mutates an array, now throws during prepare;
- one mutates a held array after retirement without catching the intentional refusal;
- one diagnostic expects stale native acceptance after finalizer mutation, now stops at TypeError;
- three structural-admission-sequence cases fail structural-drift validation. They match the supplied historical inventory and author replay. This task did not replay their distant production baseline and does not reclassify them as fixed.

The unresolved point gate is not rerun or accepted. A local reduction against packet-index predecessor must not be presented as better than B or as meeting the point ceiling; the supplied B-worse15,800 observation stays unresolved and is outside this semantics review.

## Limits

No claim that every private frozen-shell producer is impossible, no new policy for arbitrary private packets, no endpoint leak demonstrated, no broad native phase qualification. Main can use the producer evidence to constrain the admission boundary and independently resolve remaining joint-phase and work findings before integration.
