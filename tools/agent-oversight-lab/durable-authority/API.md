# Durable authority reference API

Local test reference; the SQLite-owned entity update and receipt are one atomic
transaction. This does not promise exactly-once execution of arbitrary external
services or power-loss behavior. Node 24.15.0 `node:sqlite` is used through its
[versioned documentation](https://nodejs.org/download/release/v24.15.0/docs/api/sqlite.html).

`startAuthorityProcess({ database, outputDirectory?, siteDirectory?, port? })`
from `process.mjs` starts a real child. It returns `url`, `pid`, `host(action,
payload)`, `waitForEvent(predicate)`, `stop()` and `kill()`. `GET /` and `/app.js`
serve the optional static site without injecting credentials. All `/api/` calls
require `Authorization: Bearer <token>`; use same-origin browser fetch. No CORS
or cookie authentication is enabled.

Host-only IPC `host('create-session', {principal, tenant, role, destinations})`
returns `{token, sessionId, epoch, principal, tenant, role, destinations, stopped}`.
Roles are `proposer` and `reviewer`. Defaults: destinations `['dispatch']`.
The random token is returned only over IPC and stored hashed. A newly issued
session stops older sessions of that same principal/tenant and increments epoch.
It seeds `delivery-1` independently in each permitted destination if absent.
Host bootstrap is test setup, not a public sign-in or identity-provider claim.

`GET /api/session` returns the same object **without token**. `POST
/api/session/stop` with `{}` stops new work for the authenticated session. Old
exact commands can retrieve their recorded receipts; pending unsent commands
are refused. New sessions do not automatically adopt old operations.

The remaining routes use `/api/:tenant/:destination/` with URL-encoded segments.
The server derives principal and role from the token and enforces both scope
segments. All errors are `{error: fixedCode}` with a non-2xx status; no raw errors,
tokens or command payloads appear in error responses.

## Snapshot and proposal

`GET snapshot` returns:

```json
{ "entityId": "delivery-1", "instance": "uuid", "values": { "route": "north", "note": "", "window": "09:00", "capacity": 10 }, "versions": { "route": 0, "note": 0, "window": 0, "capacity": 0 } }
```

A command is immutable JSON data with this exact shape:

```json
{ "commandId": "unique-command", "operationId": "local-operation", "sessionId": "issued-session", "sessionEpoch": 1, "actor": { "kind": "declared", "label": "dispatch-agent" }, "proposal": { "entityId": "delivery-1", "expectedInstance": "snapshot-instance", "patch": { "route": "west" }, "expected": { "route": 0, "capacity": 0 } } }
```

Actor may instead be `{"kind":"unknown"}`. Actor labels are declarations, not
authentication. Every written field requires an expected revision; optional
additional read dependencies must retain the original observed revisions.

## Review and execution

- `POST reviews` body `{requestId, command}` → review object (202). Proposer only.
- `GET reviews` → `{reviews: Review[], retention:{terminalLimit:64,
terminalTruncated:boolean}}`. Returns all active reviews (bounded by admission)
  plus the newest 64 terminal reviews. Proposer sees **current session/epoch
  only**; reviewer sees the tenant/destination queue. Older terminal records are
  still durable and accessible explicitly by ID; the list does not silently
  claim complete history.
- `GET reviews/:requestId` → `Review` with the same visibility rule.
- `POST reviews/:requestId/decision` body `{decision:'approve'|'reject'|'revoke',
expectedDigest: review.digest}` → `Review`. Independent reviewer only. A reviewer
  with the same principal as the proposer cannot approve. Digest mismatch fails.
- `POST commands` body `{requestId, command}` → `Receipt`. Proposer only; binds
  request, digest, authenticated principal, tenant, destination and session/epoch.
  A valid but stale/revoked command gets a durable **rejected receipt**, not a
  fictional success. Reusing command identity with changed contents fails.
- `GET receipts/:commandId` → `Receipt`, limited to authenticated principal and
  scope, including older sessions. This is explicit recovery, not review adoption.
- `POST sessions/:sessionId/stop` body `{}` → stopped session. Reviewer only,
  within the target session's authorized tenant/destination scope.

`Review` is `{requestId, principal, sessionId, sessionEpoch, command, digest,
status, reviewer: string|null, decisionAt: string|null}`. Statuses are `pending`,
`approved`, `rejected`, `revoked`, `applied`. A rejected/revoked review does not
imply a command was delivered; inspect its receipt explicitly when necessary.
Approvals are durable decisions: reviewer logout or credential revocation does
not itself revoke a past approval. Explicit review revocation or proposer stop
blocks a subsequent effect. Revoking a token blocks every future authenticated
request, including receipt queries; stopping a session preserves read recovery.

`Receipt` is `{commandId, operationId, sessionId, sessionEpoch, principal, tenant,
destination, requestId, commandDigest, status:'applied'|'rejected', reason?,
effectSequence, instance, timestamp}`. Reasons include `conflict`, `instance`,
`session-stopped`, and `approval-pending|rejected|revoked`. Receipt lookup returns
404 when no receipt exists; a network failure is not a definitive no-effect result.

## Metadata-only event feed

`GET events?after=0&limit=100` returns `{events, retention:
{firstAvailableSequence, latestSequence, truncated}, nextCursor, hasMore}`.
Sequence is monotonic per tenant/destination, not global across inaccessible
scopes. The default retention window is 256 events. `truncated` means requested
history starts before available evidence; current state cannot fill that gap.

Events have `{sequence,tenant,destination,kind,timestamp}` plus an explicit subset
of `{principal,reviewer,sessionId,epoch,operationId,commandId,requestId,status,
reason,instance,digest}`. Tokens, patches, note values, arbitrary actor labels,
prompts and raw errors are excluded as payload fields. Command, operation and
request identifiers are caller-selected; principal identifiers are host-selected.
Any of these identifiers could themselves contain sensitive text. Applications
must use opaque IDs and an appropriate identifier policy; an allowlist is not
arbitrary-secret detection. Authenticated principals may still be personal data.
This is a bounded metadata policy, not a complete organizational redaction product.

`session-stopped` means all still-pending/approved reviews for that session were
revoked atomically with the stop. `session-created` starts a higher epoch and
atomically stops older sessions for that principal/tenant and revokes their
pending/approved reviews. These are batch semantics represented by the session
event, rather than a separate event per review. Existing applied receipts remain.

## Host controls and failure schedules

- `diagnostics` → `{database:{sqliteVersion,journalMode,synchronous,foreignKeys},
entities:[{tenant,destination,entityId,instance,values,versions,effects,hostEffects}],
receipts, sessions}`; no raw tokens.
- `patch` `{tenant,destination,patch}` changes a host input/revision atomically.
- `replace-entity` `{tenant,destination,patch?}` changes instance, resets revisions.
- `stop-session` / `revoke-session` `{sessionId}`.
- `crash-before-commit` / `crash-after-commit` `{commandId}` arms one actual
  SIGKILL at the named boundary. Child emits `fault-reached` before killing itself.
- `hold-response` `{commandId}` holds the real HTTP response after durable commit.
- `release-response` `{commandId}` releases held responses, enabling reverse
  browser completion order without synthetic browser-side promise gates.

Controls are reachable only through child IPC, never an HTTP endpoint. Reopen
the same database through a new child to test restart; do not reset/copy only the
database file during an active transaction. The store uses DELETE journaling
and synchronous FULL and reports actual SQLite settings in diagnostics.
The host receives `authenticated-upload-started` metadata before command body
parsing, allowing a deterministic revocation-during-upload test. Host diagnostics
may enumerate all durable history; they are a trusted test seam, not a browser
polling endpoint. Receipt and review storage requires a production retention and
archival policy; deduplication records are never silently evicted by this fixture.

## Verification

Using the pinned Node 24.15.0 executable, run:

```sh
node tools/agent-oversight-lab/durable-authority/run-tests.mjs NEW_EVIDENCE_DIRECTORY
node tools/agent-oversight-lab/durable-authority/run-controls.mjs NEW_CONTROL_DIRECTORY
```

Each directory must be new. The functional runner preserves raw test/process
logs, exact commands, runtime identity and source hashes. The controls runner
copies source into isolated directories and plants reviewer-role bypass and
duplicate-effect defects. Both unmodified controls must pass; both planted
defects must fail named assertions against actual SQLite effect counts. The
original source is never modified by the controls runner.
