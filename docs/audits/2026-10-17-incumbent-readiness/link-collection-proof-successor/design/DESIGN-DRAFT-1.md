# Collection binding correction — review draft 1

2026-10-29. Runtime frozen75416029. User approved the full production-route plan, retaining recurrence and semantic stops. This draft is not a cleared runtime gate.

## Frozen premises

Aggregate authority at3c8bbaff: “Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.”
Removal design at3c8bbaff: “Point row/field recipients use the same lifetime removal and become absent; collection/root/nested projections reduce that same stream, not separate per-connection removal rules.”
Evidence combination: “Known write ownership cannot remove input dependencies or possible-owner obligations. Each obligation needs its own justified discharge.”
Existing C1–C14 assertions/outcomes and earlier scalar controls remain unchanged. Production87f6831f and B closure remain unchanged. No public API or policy expansion is proposed.

## Current loss

link.ts classifies own collection and branch/root containing collections as unsupported declaration sources. private.allowed/admit use that capability flag to skip eligibility altogether. An unsupported declaration therefore accidentally selects weaker delivery.

Separately whole collection prepareSourceProjection without a field is completed into completedValueFact; aggregate projectionSupport omits it. Adding that single fact to the aggregate is insufficient: the current source-wide support getter is not the exact set of facts selected by a recipient's relationship-relative payload. Replacing an entire collection proof with the latest author's proof would discard untouched contributions.

The egress projection already owns the payload and its eligibility participation. It must expose contributor edits from the same reduction, rather than a second pass guessing provenance from before/after row equality.

## Proposed internal representation

Keep existing native state and existing relationship-relative payload owner. Add support references to its already-prepared selection, not another state/settlement store.

1. Source-owned support addresses are qualified by source identity, lifetime identity and semantic dimension: member existence, field presence/value, key mapping where consumed, and placement/order. Each address points to the immutable requirement identity captured for that authored fact. Terminal owner outcomes may resolve; the consumed fact identity and captured possible-owner window do not change.
2. A recipient contribution entry records which support identity produced an eligible field, existence decision or placement decision in its existing egress projection. It stores no additional row values. Point, row, collection and nested aggregate projections select different domains from this same source evidence.
3. The egress reducer returns one prepared result: physical topology update; eligible payload edits; contributor add/replace/remove edits; installed revision identity. This is prepared with native source support and installed in the existing combined terminal record. Never install payload first and then allocate its proof record.
4. private Binding reduces explicit contribution slots for every projection shape. Scalar value is one slot, nested collection is a composed slot with its own indexed summary, and an own collection uses the same composition rather than the scalar completedValueFact special route. Its installed revision refers to payload AND reduced proof. A slot is not replaced wholesale by the author of one row field.
5. Aggregate summaries count obligations by role/identity. Replacing one contributor subtracts its old proof and adds its new proof; it does not remove another contributor with the same owner. Source native evidence remains independent of recipient enrollment. Disposal releases that recipient's references only.

No public export, new public configuration, alternate settlement engine or direct native-write mirror follows from this representation.

## Exact reduction rules

- Existing-row field update: replace only authored field presence/value support; preserve lifetime/member prerequisites, other fields and eligible placement. Explicit absent-versus-present-undefined remains separate from value equality.
- Full row replacement: replace its specified field domain including deleted fields. Preserve or replace structural prerequisites only when the operation actually authors them. Unknown authored footprint must not be guessed from a physical row.
- Add/adoption: attach source support for each fact actually selected. Adoption from inspection may select a larger row than an explicit field edit; those selected values need their own native/unknown evidence, not the declaration permission for the one changed field. Keep that requirement distinct from ownership of the authored field.
- Remove: delete the removed row's live payload contributors; install the authored absence requirement as a negative contributor when that removal changes the recipient's membership. The D/I/W/V of this absence gates the new collection even though the removed row has no output value. O-neutral authored removal still changes a recipient that previously adopted the lifetime. A recipient that never included it need not acquire a new payload fact solely because another recipient did.
- Same-key replacement/re-add: non-reused lifetime identity separates old negative/existence facts from new live contributors. Do not infer supersession merely from key equality; use the reducer's actual selected occupancy and order effects.
- Rekey: Row[] does not expose storage keys; the existing reducer says rekey does not change payload or order. Do not turn every rekey into a collection value dependency. Key evidence remains required for native key lookup/enumeration, occupancy resolution and any projection that actually consumes that mapping. Its transport must be demonstrated, not assumed because collection rows compare equal.
- Reorder: reducer supplies the exact eligible domain and actual placement changes. Its existing algorithm preserves eligible lifetimes excluded from the source's current ordinary domain. Source packet ordinaryOrder is an input, not permission to replace proof for every eligible row. Preserve unaffected placement requirements; explicit complete reorder can touch its full specified domain.
- Inspection: update physical topology/certificates only. Eligible payload and ordinary support remain unchanged unless a subsequent authored operation adopts facts. Exiting inspection alone is not new authorship.
- Selected inverse: consumes the selected ordinary inverse footprint and physical realization separately, using the same reducer; it must not fabricate new authored removal responsibility from a physical-only removal. Whole selected unit must prepare before callback-capable capture/publication; the existing selected-unit failure is still a separate gate.
- External ingress: use the existing relationship-authoritative acquisition and reseed boundary. Rebind the exact acquired payload's support under its existing authority; do not retain obsolete old-recipient grants or assume ingress universally confirms native pending owners.

## Initialization and unobservable evidence

Creation must bind the exact relationship seed, not reconstruct source ordinary rows in place of it. Ordinary seed facts with native evidence inherit that evidence, including pending obligations. Inspection-only seed facts remain explicitly distinguishable from ordinary facts. The relationship's adopted starting payload is not evidence that a pending native owner confirmed.

Where native input evidence is unavailable, unknown never creates declared permission. A later authored operation captures its fixed possible-owner window before installation under the approved policy. Do not create or erase native obligations merely by enrolling another recipient. Existing source seeding and any inspection-only baseline interpretation require discriminating controls before the initialization gate can close.

No sources/recipients discovered after authorship may extend the fixed possible-owner set. Missing coverage is a conservative outcome, not permission to reconstruct a speculative payload at notification time.

## Admission, enforcement and completion

Declaration admission checks whether the requested callback/source surface is implemented, declaration data is valid and the connection is live. This is distinct from mandatory eligibility enforcement for all experiment-enrolled outgoing revisions.

Every outbound route, including collection order listeners and ordinary fallback, must consult its installed binding revision. A missing proof or unfinished unit is held; unsupported declaration capability cannot route around it. The production disabled-experiment path remains separate and unchanged.

Validation horizons span relevant nested connections. No early eligibility until all enclosing validation completes. Recipient-specific uncertainty cannot enter another recipient's proof or native source evidence.

A declaration can execute successfully and receive held status while untouched contributors remain pending. Completing p discharges only p's actual role; q's possible/input/structural role remains. Complete all captured obligations, then wake fresh ordinary participating evaluation without another setter. Rejected input invalidates old declared permission; current surviving-write fallback follows approved rules and never reads inspection display.

An installed support change wakes eligibility even if payload equality suppresses the public value event. Terminal receipts never revive. The queued sender binds an exact payload/proof revision; supersede it before start if stale. Already-started requests retain existing serialized corrective-delivery behavior.

## Work, lifetime and cleanup gates

Point edits should update the affected contribution slots and dependent recipient summaries. Full requested serialization may enumerate the output. No scan of unrelated registered trees or whole-collection support rebuild for each field update. Explicit full reorder may inspect its specified members. Counters must separate preparation, proof composition, payload serialization and cleanup.

A negative contributor is not automatically obsolete when its author is terminal. Native current absence, held input snapshots, pending delivery and selected recovery are distinct obligations. Source explicit forget and automatic retirement must use the same obligation accounting. Keep only live support references; retained receipt result must not keep its tree or historical payload graph accidentally.

This draft does not equate unknown with initial known support to pass a zero-count assertion. Whether settled native absence can compact into ordinary initial support must be justified from existing surviving-write rules and source data. If current absence requires an explicit unknown marker, its semantic lifetime and bounded storage must be specified before retirement gate acceptance.

## Replacement map

- Replace supported-source bypass in allowed/admit with mandatory experiment binding enforcement; declaration capability remains solely admission capability.
- Replace own-collection completedValueFact omission and nested fake-leaf whole-source proof with explicit contribution composition from the shared egress reducer.
- Replace source support(subject,field) catch-all usage for recipients with exact selected contributor references. Retain native captureInput for reads and no-recipient safety.
- Preserve prepared native requirements, owner cells, fixed windows, validation horizons, receipt terminality and serialized delivery. Change shared lifecycle only for an independently demonstrated contract gap.
- Keep optional production paths disabled until complete qualification and owner acceptance. Remove obsolete experimental paths only after replacement tests pass, preserving source history.

## Acceptance / stop

C1–C14 plus unchanged scalar225/historical2 accounting, original entity controls and framework timing controls. In particular: p-first hold/q-first hold/eventual send; independent declaration actually executes; untouched structural contributor; mixed-source same-owner roles; inspected unavailable input window; selected inverse; both retirement routes; no-obligation churn; pure order; negative membership; enrollment; receipt disposal; queued and in-flight correction.

Additional discriminators needed: initial connection created during pending facts; inspection-only seed with later partial ordinary adoption; rekey-only Row[] versus key-consuming lookup; ordinary order domain excluding an eligible inspected-away row. These are finite mapping cases, not blanket new architectural research.

Before runtime, review must resolve whether the reducer can produce exact contributor edits with existing prepared facts, whether initialization/negative-retirement semantics are already governed, and whether complete selected inverse preparation is feasible within existing operation boundaries. An unresolved public rule or requirement for a new authority blocks that dependent part. Passing a core collection mechanism cannot conceal any outstanding gate or permit broad release verification.
