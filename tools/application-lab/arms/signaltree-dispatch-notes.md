# SignalTree coordinated dispatch arm

This private application arm uses the Angular facade throughout. Accepted jobs
and capacity live in one SignalTree; a second tree owns immutable proposal
entities keyed by command ID. Every proposal is added inside its own native
pending transaction. Native transactions therefore own distinct proposals,
not competing optimistic writes to the same accepted field.

The generated `../st-open.ts` calls the exact release line's public method:
`transaction` for v15 and `transact` for v16. It accepts a structural tree with
that method and returns the facade's public `PendingTransaction`. There is no
runtime version detection, private import or shared application coordinator.

## Native ownership and application reconciliation

An applied proposal is confirmed and then removed. A rejected or conflicting
proposal is rolled back. Proposal fields are never changed after their pending
creation. Transport outcomes, unknown status, ordering and retained rejected
values belong to separate application records, so a transport update cannot
change the entity that its transaction may need to undo.

Angular computed presentation groups live native proposals by subject and
selects the latest unresolved absolute assignment for the current entity
instance whose expected field revision is at least the observed accepted
revision. A reply installs only its authoritative field and revision, inside
`external()`, and cannot lower the current revision or cross entity instances.
Rejected and conflicting replies may still provide newer authoritative state.
An older success cannot replace that newer state. Timeout changes an operation
to unknown; retry sends its unchanged command envelope.

The application supplies command idempotency, expected revisions, projection,
outcome metadata, captured publication inputs and acknowledgement handling.
These are counted application responsibilities; the native transaction does
not establish server durability or implement the complete dispatch protocol.
This fixture deliberately does not use Link or declaration as a request/ack
wrapper.

## Publication and lifetime

A plan captures unresolved commands relevant to current jobs and capacity.
A progress intent captures only the selected instance's status commands and
its payload contains only status and revision. Each intent waits for known
outcomes of its captured commands and successful native retirement, then
freezes current accepted values into a detached payload.

The application serializes started publications until actual acknowledgement.
A waiting dependent plan does not prevent an independently ready progress
intent from starting. Selection uses a stable record snapshot; the selected
intent is marked started before calling transport, and a reentry guard protects
the invocation. Synchronous callback actions can enqueue another intent, which
starts after the actual acknowledgement. No queued record is labeled delivered.

Replacement rolls back proposals for the retiring row instance, newest first,
then removes the old row and appends its replacement. The remote operation
remains unresolved until its real outcome arrives; a retired proposal no
longer changes presentation. A retained editor uses its native row handle and
captured instance, so it cannot follow a reused business ID to the replacement.

Destroy disables actions and response/publication callbacks before rolling back
remaining native handles, newest first. A rollback refusal propagates and keeps
its handle registered; cleanup is never reported successful through a `finally`
clear. A later destroy may retry. After successful retirement both trees and
application records are released. The host also destroys its session injector.

`dismissSettled()` releases known operation payloads unless waiting publication
inputs or live native handles retain them, and removes acknowledged publication
payloads. Per-session command/intent ID string sets survive dismissal to prevent
reuse and duplicate transport calls. These sets grow with unique IDs and are
cleared at teardown. Their cost must be reported separately from released
payloads; this is not an unlimited constant-space claim.

## Evidence and boundaries

The root executed `signaltree-proposals.mjs` against built v15.4.7 and qualified
v16 artifacts before full application admission. Both receipts show all eight
unique-proposal combinations passing: every pair of confirm/rollback outcomes,
both resolution orders, and immediate assertions of the remaining proposal's
membership and payload. Confirm includes subsequent removal. The receipts are
`v15-native-proposals-first.json` and `v16-native-proposals-first.json`, bound to
all loaded package payload hashes and runner SHA-256
`1e523a6d158632654a16218c02da46379c29710d477b7fc0c73615f73db86776`.
The audit owns durable receipt disposition and the fresh v15 registry rerun.
These are native capability controls, not full application or Angular results.

This authoring pass inspected public types and source from the clean
`v15-release-ci` and `v16-followthrough` checkouts, and read the above receipts.
It ran no builds, tests, installs or benchmarks. The shared serial typecheck and
registered browser traces remain required before admission or comparison.

The registered bounded traces add no new relevant edit before a waiting
publication starts. Queuing progress, replacing its subject before it starts,
and choosing whether that intent should cancel or follow the new instance is
outside this fixture's qualified semantics. The implementation currently reads
the then-current subject when it starts. Publication transport rejection also
has no recovery policy in this fixture: a failed start/ack stays incomplete and
surfaces failure instead of claiming acknowledgement. Neither boundary is
covered by the native proposal control or claimed as a production guarantee.
