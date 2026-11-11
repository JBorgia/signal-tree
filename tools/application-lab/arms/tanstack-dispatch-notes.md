# TanStack coordinated dispatch arm

This is an application implementation using `@tanstack/angular-db@0.2.12` and
its pinned `@tanstack/db@0.15.2`, not a claim that the library natively implements
the full business protocol. The root's production build passed; full scenario
execution remains subject to shared serial qualification. This authoring pass
read the installed version's source/types and existing probe receipts; it ran
no production builds or browser comparisons.

## State and application responsibilities

Four native local-only collections own accepted jobs, accepted capacity,
independently keyed command records, and publication records. Native live queries
order the operation/publication presentation and acquire the ordered job preview
when it is opened. Direct collection reads plus native change subscriptions drive
point presentation reads without copying every job into an Angular signal.

The application supplies the backend protocol and reconciliation: expected
field revisions, instance checks, pending/unknown outcomes, ordered absolute
assignment projection, same-command retry, captured publication dependencies,
detached publication payloads, acknowledgement state and lifetime cleanup. A
pending-command lookup indexes command IDs by subject; it is not another accepted
row store. No coordinator from another arm is imported.

The command collection preserves rejected/conflicting proposed values separately
from accepted values. An unresolved proposal is displayed only for the current
entity instance and only while its expected field revision is at least the
observed accepted revision. Newer authoritative owner replies do not replace a
row's unrelated fields. An older success cannot overwrite a newer field revision.
A response to an old entity can settle that command's outcome but cannot update
its replacement, even when the conflict reply names the replacement's instance.

The service is an explicit command/decision protocol, so this arm uses local
collections as application caches and installs the returned authoritative field
decision once. It does not add a second QueryClient/refetch acceptance path.
Results for this fixture therefore are not a claim about a QueryCollection
refetch workload, offline persistence, server durability or arbitrary rebasing.

## Domain projections

Pinned DB `src/collection/index.ts` returns `WithVirtualProps` from `get()`.
`src/virtual-props.ts` documents that these enumerable `$` fields are included
when spreading a row. The first dispatch calibration exposed this fixture's
missing domain projection: `dispatch-calibration-1/004-tanstack-timing.json`
failed exact capacity equality at `round-0-accept-owner`. Its capacity view,
preview and plan payload included `$hasPendingWrites`, `$synced`, `$origin`,
`$key` and `$collectionId`; operation presentation included the same metadata.
The receipt reported no browser errors. Earlier value-only assertions did not
detect that envelope mismatch, so their passes did not establish exact shape.

Capacity presentation and plan serialization now enumerate only `instance`,
`value` and `revision`. A cached Angular computed projects operation records to
the six command fields plus `order` and `outcome`. Job and publication records
are stored under a wrapper's nested `value`; their existing projections expose
that domain value and leave the wrapper metadata outside it. Command transport
and progress payloads already enumerate their protocol fields. No generic
metadata stripping, private API, source-row mutation or oracle relaxation is
used. This is an adapter boundary correction, not a DB defect or a performance
result. Fresh production build and strengthened conformance remain required.

## Publication and lifetime

A plan captures unresolved commands affecting its current jobs or capacity.
A progress intent captures only the selected instance's status commands and
sends only status and its revision. Neither unrelated owner drafts nor capacity
drafts block that progress publication. After captured outcomes become known,
the application freezes current accepted values into the outgoing payload.

Publication state changes to `started` before invoking transport. A stable
waiting-record snapshot and a reentry drain flag allow the transport callback
to synchronously submit further actions/intents without losing or repeating an
intent. Actual promise resolution changes `started` to `acknowledged`. This arm
allows concurrently started distinct intents; the shared contract also permits
serialized implementations and must not require the second start before the
first acknowledgement.

`dismissSettled()` drops known command payloads unless a waiting publication
still references them, and drops acknowledged publication payloads. Per-session
sets reserve used command/intent ID strings so dismissal cannot enable reuse and
duplicate sending. Those ID sets grow with unique IDs: measure and disclose that
application deduplication cost separately from released payloads. No unlimited
constant-space claim is made. Destroy clears these sets and pending indexes,
disables actions/callbacks, unsubscribes point observers, and returns awaited
cleanup of all owned collections and current live-query collections. The host
first destroys its per-session Angular injector, synchronously detaching query
observers before the arm's later registered cleanup hook runs. The arm then
awaits native live-query cleanup before starting source-collection cleanup;
the host awaits the arm's idempotent completion promise. Dispatch query configs
have no changing filter parameters: its optional preview is created once when
opened, so its three current resources cover the query generations it owns.

This ordered cleanup also addresses the ownership risk exposed in the ordinary
inventory arm's second baseline: DB error 152 means a source was manually
cleaned while a live query still depended on it. Dispatch had started query and
source cleanup together. No dispatch occurrence of error 152 is claimed from
that inventory receipt. This is a fixture lifecycle correction, uses public
completion boundaries, and does not suppress errors or add timer delays.

## Why commands are separate records

The root's executed `tanstack-overlap.mjs` probe is a narrow Node native-API test
with local-only persistence. On both DB 0.15.2 and the separately labeled
1.0.0-rc.1.4 probe, its single-operation control passes. Its older-status rejection
while a newer owner edit remains persisting leaves the rejected status visible
at the intermediate checkpoint. Rolling back one uncommitted draft also fails
the requirement that the other draft survive. This is not an Angular test or a
QueryCollection refetch test; in particular, the probe's terminal local-only
result must not be generalized to other persistence configurations.

Receipts are the root's `tanstack-stable-bound.json` and `tanstack-rc-bound.json`,
bound to runner SHA-256
`764f382b0a8cf9bb4366626de7291d90403a3a5079925d0b29fcad3b3c3a29de`,
separate package locks, registry integrity and loaded module hashes. The full
comparison audit owns their durable disposition. These observations justify
testing separate proposal records; they do not establish this arm's correctness
or a competitor performance ranking.
