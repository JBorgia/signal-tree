# An approved command across browser and backend failure

This Angular reference lets one authenticated account propose a dispatch change
and another approve it. The proposer can then deliver that exact command. The
screen separates the local preview, the last fetched server snapshot, unresolved
local operations, and bounded investigation evidence.

The backend owns authorization and durable outcomes. SignalTree owns local state,
entity lifetime, pending operation ownership and dependent publication. A native
transaction handle is not an authenticated approval or a durable receipt.

## Run the identified checks

Use Node 24.15.0 and the checkout's pinned pnpm dependencies. Build from an
identified `tools/agent-oversight-lab/prepare.mjs` packet configuration containing
the exact kernel and Angular archives, rather than workspace source aliases:

```sh
node tools/agent-oversight-lab/application/build.mjs PACKET_CONFIG NEW_BUILD_DIRECTORY
node tools/agent-oversight-lab/application/run.mjs NEW_BUILD_DIRECTORY/manifest.json NEW_BROWSER_RESULTS
node tools/agent-oversight-lab/application/controls.mjs NEW_BUILD_DIRECTORY/manifest.json NEW_CONTROL_RESULTS
```

Each output directory must be new. The build records strict Angular AOT,
installed package inventories, production bundle hashes and frozen inputs.
The browser runner starts a real child HTTP/SQLite authority per scenario. It
provisions independent test credentials over host IPC and places only the current
account's token in its browser context. Credentials are not embedded in the site.
The [authority API](../durable-authority/API.md) describes its trust boundary and
the separate backend functional and fault-control commands.

## What the scenarios establish

The twelve scenarios check an ordinary approved effect, reverse completion of
concurrent HTTP responses, revocation before delivery, proposal/refresh races,
old snapshots and duplicate responses, reload reconstruction, operations aged
out of recent review history, entity replacement and explicit recovery, actual
process death after commit, page close and session replacement, stopped work,
and redacted evidence with explicit history gaps.

Preparation and refresh cannot race to register owners, but independent command
deliveries remain concurrent. Recent review pages may omit old terminal records;
the browser retains unresolved ownership and looks up the exact command. A reload
may explicitly reconstruct a new local owner for an unchanged pending command.
It never claims that an old native handle survived navigation. Closing the
workspace invalidates its callbacks, and a new authenticated session does not
silently adopt an old session's operation.

Retry sends the original command identity and content. Receipt reconciliation
checks principal, scope, session, request and digest before settling the matching
owner. A changed entity lifetime can make native rollback unsafe; the reference
offers narrow, explicit recovery only after checking the authoritative replacement
and the absence of other pending local operations.

Three isolated mutations must fail useful browser assertions: false native
settlement, a hidden history gap and ignored entity lifetime. They do not alter
the production source or introduce public fault-control endpoints.

## What this does not establish

This is a local application proof, not a hosted product or an identity provider.
The identities are host-provisioned; an account called a reviewer does not prove
that a human operated it. Agent labels are declarations. The database effect and
receipt commit together; arbitrary external services and power loss are outside
this proof. Authentication, durable deduplication retention and deployment policy
remain application responsibilities.

Investigation events intentionally exclude tokens, patch values, notes, free-text
actor labels and raw errors. Caller-chosen identifiers can still contain sensitive
text, so applications need an identifier policy. The authority retains 256 event
records and the browser 64; missing history is visible, and exports describe the
window actually held in the browser. A current snapshot cannot fill missing
history or prove why an agent chose a command.

The [investigator task kit](INVESTIGATOR-TASKS.md) separates simulated-agent review
from real participants. Automated functional checks are not a human usability
study. Private Studio recording, sessions and query code remain in their separate
private workspace.
