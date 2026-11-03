# Ordinary occupancy account: proposed replacement for structural admission

Design investigation after rejected6bd4ee8a; no runtime modification or successor acceptance. Governing plan f80645c8 and owner decisions remain. Slice1 checkpoint91058393 is unchanged. This is a proposed common operation model, not another settlement engine or reopening B.

## Facts and authoritative boundaries

Physical P and ordinary O each map a key to at most one non-reused entity lifetime, and each present lifetime to exactly one key. Existence is explicit: an ordinary-absent marker is not an omitted shadow entry. Values, key occupancy and order are distinct facts. A key is not an identity; a row payload's id is not the storage key. A held reference resolves by lifetime only.

O means participating state, including installed pending contributions; it is not a committed-only snapshot or permission for Link to publish. Publication eligibility remains a separate existing responsibility decision.

P stays in native storage. O is read through sparse divergence: absent/present overrides and bidirectional ordinary key/lifetime exceptions, with an explicit no-override sentinel. No-override means use P only when the indexes establish that they agree. Inspection must prepare divergence before changing P; otherwise ordinary truth cannot be reconstructed afterward. The index is an access path to the same divergence facts, not another independently writable canonical store.

Each semantic fact records origin/participation and operation revision. Physical order frontier retains its current meaning. Ordinary-only adoption must not fabricate a physical frontier; its installed responsibility is identified by the existing authored operation/transaction and explicit membership facts. The representation must validate that existing settlement bookkeeping can consume these without a new frontier authority.

## One occupancy primitive, not per-writer displacement handling

Every authored operation first states its actual intents. The occupancy compiler consumes only two primitives, in authored operation order:

- Bind(lifetime,key): ensure that lifetime occupies the authored ordinary key.
- Unbind(lifetime): remove that lifetime's ordinary occupancy if present.

No writer supplies its own displacement compensation. Bind uses the same staged bidirectional lookup regardless of whether its caller is creation, necessary-existence adoption, or rekey:

1. Read lifetime's current ordinary key and destination's ordinary occupant from the staged operation view.
2. Record prior facts for both affected keys and every affected lifetime exactly once for the operation's before-set, retaining chronological edits separately.
3. Remove the lifetime's former ordinary binding, if different.
4. Remove the destination's different ordinary occupant, if any.
5. Install the binding and both staged indexes together.

Unbind reads the staged ordinary subject binding, records its prior facts and removes both directions. An already ordinary-absent lifetime produces no ordinary removal, even when a physical removal occurs. Every later operation within the same frame reads the staged index, not the old committed vacancy index. Operation observation and surviving compensation are separate products. Preserve incumbent cancellation, genuine no-op and terminal behavior when normalization nets operations out. A responsibility-observation revision may change without creating a nonempty rollback contribution; no new contribution is inferred from ABA alone.

Normalization table:

| Entry | Occupancy intent | Value/order intent |
| --- | --- | --- |
| Creation/add/prepend | Bind fresh lifetime to supplied key | Explicit supplied value; append/prepend order intent |
| Existing ordinary field update | None | Only approved authored fields |
| Field adoption of ordinary-absent inspected lifetime | Bind that lifetime to its physical key | Existing approved necessary-existence/payload adoption rule; never infer unrelated neighbor adoption |
| Rekey | Bind source lifetime to destination key | No incidental field or order adoption; retain existing payload update behavior separately |
| Removal | Unbind target lifetime | No inferred ordinary inverse for inspection-only existence |
| Mixed upsert/setAll | Ordered normalized operations for actual matched lifetimes | Partial versus replacement/full-order intent remains explicit |
| Inspection | No O intent | Prepare P changes while retaining prior O facts/indexes |

Ordinary destination presence is never inferred from physical vacancy. Multiple structural operations may read or write the same key; preparation resolves them against one staged view. Existing public guards (duplicate physical key, invalid lifetime, occupied physical destination) remain; this compiler does not grant a new supported operation.

## Prepared result and capture

Prepare a single immutable operation record containing: physical target/instructions; ordinary occupancy before/after facts; ordered occupancy edits; separate approved value and placement edits; participation; exact lifetime identities; required validation revisions; and retained recovery obligations. Preparation enumerates affected keys/lifetimes/dependencies, not unrelated collection members. A requested complete target may retain its existing collection-wide work.

Paired capture is installed with the operation before user delivery. Inspection chronology, transaction responsibility and ordinary publication select the same ordinary facts. Native subscribers/taps select physical facts. An explicit empty ordinary list is affirmative evidence, not permission to fall back to the physical structural record. Existing queued/delivered consumers may not reconstruct or multiply the record. Failure-prone getters/equality/cloning/index preparation precede installation, with final reentry validation. This is not a process-OOM recovery guarantee.

The old conditional record('remove') versus record('rekey') code is not the authority. Lowering to existing incumbent effects occurs from the complete recorded occupancy changes and lifetime identities, with one consistency check that the resulting inverse accounts for every changed ordinary binding. If the current effect vocabulary cannot express that account without changing semantics, report that specific architecture boundary before implementation.

## Inverse: reconcile target facts with current physical identity

Settlement first obtains the authorized ordinary target from existing transaction ownership/validation. It must not blindly reverse physical callbacks. Build a bounded physical realization plan by joining those target bindings with current P by both key and lifetime:

- Target lifetime absent physically: restore that exact lifetime using retained authorized value/placement facts.
- Target lifetime active at another physical key: transfer that lifetime; do not add it again.
- Target key contains a lifetime the same settlement removes/transfers: resolve the dependency as one complete prepared unit, retaining the current same-key full-target guard.
- A target conflicts with unrelated surviving authored truth: apply the established atomic refusal/validation contract. No overwrite, arbitrary alternate neighbor or manufactured success.

The affected closure includes the current physical key of every lifetime the authorized target rebinds. That movement is required to restore one lifetime's identity; it does not adopt its incidental displayed values or authorize changes to unrelated lifetimes. Ordinary presence/value/order targets remain separate from the physical target. Pass original ordered realized edits through every private handoff, including the existing complete-target route, so unrelated inspected divergence survives. Do not derive ordinary authority by diffing the physical target.

Validate the complete key/lifetime occupancy result, permitted placement and revisions before installing any inverse component. After installation update projections, then settle authority and deliver under the existing publication/error contract. Physical inverse operations record actual physical frontier transitions. Retry after refusal uses unchanged responsibility; successful settlement is terminal and repeated settlement follows existing behavior.

## One private preparation boundary before physical validation

This proposal requires more than modifying the occupancy table or installer. Existing `validateEffects` rejects restoration of an active lifetime before apply; complete-target derivation independently rejects it. Both guards are correct for physical add instructions. Do not relax them globally.

The private prepared record must separate three products:

1. **Ordinary inverse evidence:** the incumbent-admitted inverse, including normalized lifetime/key/value/presence and placement facts. This remains the input to responsibility, inspection and ordinary publication; it must never be rewritten to match a convenient physical instruction.
2. **Physical realization:** instructions or target obtained by joining that authorized target with current physical identity. It may remove fresh A and transfer old B to A even though the ordinary inverse expresses restore-old-A. Unrelated displayed field differences are not ordinary authority. Exact approved value edits are separate from identity transfer; a retained full-row recovery value cannot automatically overwrite un-authored fields on an already-active lifetime.
3. **Validation certificate:** source revisions and the prepared complete occupancy/placement result. Validation and installation consume the same record; synchronous reentry invalidates the record and uses existing refusal/retry semantics, rather than independently translating a new state during apply.

Required ordering is incumbent admission → ordinary inverse normalization → common physical identity/value/placement join → physical validation → existing discard preparation → atomic installation → projection coherence → existing terminal/publication handling. The common join must also precede the same-key complete-target route's construction; route selection cannot bypass it. Point and S5 preparation consume the same distinctions. This is a coordinated private preparation change, not permission to add a second ownership/admission engine or an ordinary order frontier.

For inactive old lifetimes, retained authorized facts supply revival. For active old lifetimes, current displayed fields survive except for explicit authorized field reversals; ordinary values are restored separately. The owner approved this field interpretation on October 22, 2026: preserve inspected display99 while restoring ordinary7 in the specified active-old case. The minimal unchanged witness still does not test that payload distinction; it needs its own regression. Placement remains an explicit input: transfer does not imply preserving current position, and ordinary restoration does not imply arbitrary chronological replay. Apply the already-approved lifetime-sensitive successor/predecessor rule to the proposed complete topology, including anchors removed by this unit. If that rule does not determine the combined case, stop that case for a concrete contract decision.

Before runtime implementation, check that the existing normalization retains the before-facts needed for repeated same-key operations and that the physical planner can express required narrow placement without inventing authority. Merely testing Bind/Unbind in a standalone map cannot establish either property. The proposed common boundary remains unproved at those joins.

## Supersession and lifecycle

- Pending overlap remains subject to the incumbent's validated newest-open-first workflow. This model does not promise arbitrary-order successful rollback.
- A newer valid authored operation updates O through the same compiler. Existing transaction authority determines which older inverse remains admissible; retained recovery facts are not read as current O after supersession.
- Current-divergence storage and retained inverse facts have different roles. Normalizing an override after P/O agreement must not drop payload/identity still held by existing pending/recovery obligations; conversely recovery-only facts cannot supply current O after supersession.
- Confirmation discharges that transaction's recovery claims, not another transaction's claims or live P/O divergence. No confirmation rewrites the already-installed ordinary occupancy.
- Rejection changes O only through the validated inverse target. Failed settlement retires neither responsibility nor required identity/value/placement facts.
- Inspection-only mutations maintain O but may change which divergence facts must be retained. Inspection roundtrips remove overrides only after P and O occupancy/value/order agree and all indexes are normalized.
- A lifetime backing record is reclaimable only when no physical membership, live ordinary divergence, pending/recovery/history obligation or supported subscription requirement needs it. History retention is not a substitute for pending responsibility. Held references keep non-reused identity and detached behavior, not authority to retain or retarget a replacement lifetime.
- Terminal receipts/results must not retain tree/connection/payload graphs beyond their supported result lifetime. Tree destruction releases indexes and subscriptions under existing destroy semantics; no unproved GC claim.

## Required discriminators before a successor

Preserve exact original C1–C3, rekey-vacancy recurrence and active-old safe-refusal witnesses. Their rejected-runtime results remain failures, not converted into model passes. A new representation must express:

1. Bind fresh/adopted/rekeyed source into physical-vacant but ordinary-occupied destination through the same displacement rule.
2. Inverse restore when old ordinary lifetime is physically absent versus physically active at another key.
3. Multiple same-key operations within one preparation, repeated writes and prior staged displacements.
4. Ordinary-neutral removal, confirmation/supersession, failed inverse/retry, and index rollback on preparation failure.
5. Same-key new lifetimes, unaffected inspected siblings, explicit ordering and no automatic payload adoption.
6. Divergence roundtrip cleanup and live-recovery retention, with point work proportional to affected dependencies.

A table or extra passing count is insufficient. Independent review must challenge whether normalization, lowering and realization jointly cover all these cases without a writer-specific exception. Nested object-parent construction remains outside this occupancy model. If a supported path reaches that ambiguity, preserve its provenance and ask the owner before choosing semantics. No activation, integration, later-slice resume or cost acceptance follows from this design alone.
