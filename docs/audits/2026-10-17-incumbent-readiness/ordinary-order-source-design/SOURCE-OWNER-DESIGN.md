# Source-owned ordinary placement — design for review, no native adoption

Scope: specify one native preservation owner against frozen source manifest
 d1ff7c33a380d578390879a79e142950d0655920710a818af7d49fe2a017521b.
Production87f6831f, slice1 checkpoint91058393, rejected combined successor and all
original assertions remain unchanged. This document grants no implementation,
public API, budget or release authority. Slices3–5 remain gated.

## Owner and authority

Assign current ordinary placement to the collection's existing source-owned
EntityOrdinaryTopology, coordinated by the entity source beside StructuralStore.
Extend that owner's internal remit from occupancy exceptions to certified ordinary
presence/key/placement. Do not create a Link-owned order, a history-owned order,
or a second ordinary store alongside an independently writable occupancy index.
The entity source is the only admission/installation coordinator. Existing
transaction/restoration authority decides which inverse may install; this owner
stores the current ordinary facts and supplies before/after facts, never decides
which foreign contribution to remove or which conflict to waive.

Ordinary placement is established at construction. While its links match physical
state, both can share physical storage. Retain distinctions before inspection
changes physical slots. No Link connection, transaction or optional history is
needed for current ordinary state to exist. Link's connection-local baseline
adoption and eligibility remain separate; this source design does not change them.

Sparse exceptions are the leading design hypothesis; the frozen snapshot remains
a reference control. Neither unchanged model is a native implementation. In
particular, their row records combine value/key/links for instrumentation. Native
placement should reference non-reused lifetime identity and ordinary occupancy;
existing EntityValueStore remains the ordinary payload owner. Do not copy full
payload graphs just to remember an ordering edge. Cross-record agreement must
remain atomic; splitting storage is not permission to split installation.

## Data and preparation contract

For each affected lifetime retain ordinary presence, key occupancy and previous /
next lifetime, with explicit ordinary head/tail. Distinguish ordinary absence from
missing override. A missing override permits physical fallback only under the
maintained agreement invariant. Key equality is not a placement certificate.

One private prepared source unit contains separately named facts:

- Physical before/after patch, including both reciprocal endpoints and head/tail.
- Ordinary before/after patch derived from ordinary state and authorized authored
  or realized intents, including displacement and absence.
- Ordered immutable capture records for the actual operation, not a reconstructed
  endpoint snapshot; final placement is part of add/prepend before capture.
- Revision validation, occupancy/lifetime/frontier preconditions, required
  responsibility installation and source invalidation/publication facts.

No new public type or exact private API syntax is selected. The invariant applies
whether instructions, prepared target or direct order is the low-level carrier.

Preparation order:

1. Run existing transforms/getters/interceptors at their established boundaries.
   Build complete physical target and explicit ordinary intents. A supplied row
   snapshot cannot implicitly adopt surrounding inspected order.
2. Derive a complete changed physical footprint privately. For sparse storage,
   preserve each ordinary answer whose physical fallback will change, including
   neighbors changed by removing/moving another member. Stage all ordinary intent
   effects in execution order. Explicit full order may inspect all its members;
   point work must not enumerate unrelated members.
3. Validate the complete proposed topology, destination/lifetime availability,
   execution dependencies and final placement constraints separately. Resolve
   approved successor/predecessor placement against this proposed topology,
   including members this same unit restores. No new anchor policy is supplied.
4. Derive capture records from that staged ordinary transition, with finalized
   compound placement. Prepare existing responsibility before admission. Any
   fallible preparation/reentry must invalidate or rebuild the entire stale unit,
   with no attempt-owned live state. Failed preparation cannot leave new slots,
   exceptions, indexes or leases reachable from the source.
5. Install physical state, ordinary state and existing responsibility as one
   callback-free source unit. The install section must use the established
   recoverable-install contract; this design does not claim universal OOM safety.
   If native preparation reveals user code or recoverable throws in this section,
   that must be resolved before adoption, not hidden behind a cleanup catch.
6. Make projections coherent, then deliver existing capture/publication/callback
   channels at their established boundaries. No delayed outer reorder may follow
   a callback-authored write. Inverse consumers use the prepared ordinary records;
   physical projection consumers retain their existing physical protocol.

This changes when internal facts are available, not when arbitrary application
computed values must reevaluate. Existing framework timing remains framework-owned.

## Operation obligations

Inspection: leave ordinary authority intact, preserve affected ordinary links
before physical installation, update only P. Inspection-only full reorder needs
complete preservation despite no membership mutations.

Ordinary field/rekey: author their declared field/key facts. An inspection-created
lifetime may need approved necessary existence adoption; that structural intent
must be explicit and uses the same owner. Neither a field nor key edit adopts
incidental neighboring order. Existing ordinary payload semantics remain separate.

Append/prepend: final insertion intent is known before responsibility capture.
Membership plus placement is the admitted unit; nested callback operations follow
it. No append-tail capture with a later move-to-front correction.

Removal: record O neighbors from the owner, P neighbors from physical storage;
splice each domain separately. Same-key new lifetime never substitutes for a
captured lifetime. Inversion preserves the approved P99/O7 relocation rule and
only reverses explicitly authorized fields.

Compound setAll: preserve operation order and membership intent; distinguish a
real explicit order operation from incidental surviving physical order. Complete
physical and ordinary target must be validated before capture. Do not force ABC
physical output in the preserved case: ABC is required ordinary output; CAB may
remain physical under the existing inspection footprint.

Rollback/redo: consume the same immutable ordinary facts under existing authority.
Do not reconstruct them from present physical neighbors or a whole saved baseline.
The approved intervening-full-order conflict continues to refuse atomically and
retain usable authority. This storage cannot authorize selective inversion that
that policy does not define.

Full target/hidden collection: enumerate genuinely complete targets where the
operation requires them; use explicit ordinary footprint and existing parent
membership authority. A physical target is not an ordinary-state oracle. Hidden
storage is not automatic authority to resurrect a parent or its order.

Retirement: inactive lifetime metadata/backing is reclaimable only after current
ordinary divergence and live restoration/history obligations are accounted for.
Held inert references retain identity isolation, not permission to retarget a
replacement. Destruction releases source-owned state under existing semantics.

## Cleanup and locality requirement

Keep three classes separate: current semantic divergence; immutable inverse facts
owned by live recovery/history; user-held references/receipts. Draining one lease
is not proof that current divergence vanished or another lease is dead.

The frozen sparse model scans every exception on every drain. Measurements now
separate genuine convergence (N visited, N released) from local retirement with
unchanged unrelated divergence (N visited, zero released). The latter work is
avoidable in principle because only install can change agreement, but no optimized
implementation is claimed here.

Proposed native requirement: the prepared unit identifies the union of changed
physical and ordinary adjacency/presence slots, including reciprocal neighbors.
Normalize agreement for that union at installation, or maintain an exact dirty
set with a defined bounded drain. Terminal lease release follows indexed lease
facts, not all current exceptions. Unchanged exceptions need no rescan merely
because an unrelated transaction settles. Head/tail are constant-size checks.
A genuinely full convergence may process N, as may full teardown. Explicit full
reorder can process its provided members; repeated fixed-local cycles should cost
proportional to cycles and touched/dependent facts, independent of untouched N.
This is a reviewable requirement, not a tested optimization or an accepted cost.

## Four preserved falsifiers and native acceptance gate

1. Compound ordinary leak: O ABC, inspected P CBX, own setAll CAX and rollback.
   Immutable ordinary removal of B must retain A/C before inversion, with ordinary
   publication ABC immediately and after a later B field write. Preserve old held
   identities and absence of the fresh rejected lifetime. Do not prescribe P ABC.
2. Prepend with onAdd flush: captured X-before-A; undo A; redo XA, not AX.
3. Prepend plus nested append Y: outer final XA precedes callback; later Y yields
   XAY; undo A; redo XAY, not AYX.
4. Prepend plus nested prepend Y: outer XA then callback YXA; undo A; redo YXA,
   not AYX. Callback history must not be recomputed from the final physical row.

These original native tests and logs are reused by exact identity, not reported
as rerun or repaired here. The isolated models' prior semantic success remains
representability evidence. Before any native adoption, all mapped installation
paths must satisfy the source invariant, unchanged four falsifiers must pass,
and fault/reentry/refusal, point-work, live-obligation and retained-reference
controls must pass independent review. The source/path inventory records exclusions
and unresolved compatibility obligations. No native candidate is accepted by this
specification and no later-slice gate is lifted.
