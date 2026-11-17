# Installed Angular browser → HTTP reference

This bounded integration reference joins production strict-AOT Angular, the
installed SignalTree Angular facade, a real browser fetch boundary, reviewed
commands and an in-memory loopback authority. It is a functional conformance
experiment, not a timing benchmark or a production service.

The UI intentionally permits one reviewed remote operation at a time, plus
independent human work and a second native owner. It does not demonstrate two
simultaneous remote approvals or parallel agents. Actor labels are declared or
unknown, never authenticated. Fixed fixture credentials are deliberately not a
security product. No database, durable receipt store, restart recovery, real
navigation guard or guarantee of unbounded retention is claimed.

## Inputs and boundary

Run `node tools/agent-collaboration-lab/http-browser/run.mjs CONFIG NEW_OUTPUT`.
CONFIG uses the existing public-workflow artifact configuration: artifact plan
path and SHA-256, exact kernel/Angular archives and SHA-512 integrities, source
identity, and limits. The runner admits each configured archive against that
same plan, installs identified packages and frozen local Angular peers, and
compiles with strict TypeScript, skipLibCheck=false and strict full AOT. A
production bundle must contain no source aliases, runtime compiler, server
fixture or backend authority. It records source, config, artifact, installed
payload, compiler and emitted bundle identities and preserves first failures.

State construction and mutation use only `@signal-tree/angular`. The existing
published read-only tooling export `@signal-tree/kernel/internals` supplies
native transaction IDs and terminal lifecycle observations. No private physical
module, source alias or new library export is used. The two roots resolve one
installed kernel. Existing coordinator, immutable capture, AG-UI parser,
DispatchBackend and reviewAuthority fixture sources are copied or imported
unchanged and hash-bound.

Only snapshots, exact review requests, commands and grant revocations cross
HTTP. A transport-authenticated review request only enters a pending queue. A
separate trusted server-host callback approves its immutable captured command;
no HTTP route or supplied actor/consent property can mint a grant. The browser
then checks review status. The harness invokes that host seam explicitly; this
is not proof of human presence or consent against arbitrary same-origin agents.
Review request IDs are chosen before transport, bound to exact command bytes,
and reused on retries; changed content under the same request ID is rejected.
An uncertain review request can therefore still be cancelled by its known ID.
Server-only host controls induce permission changes, capacity ABA,
entity replacement and acknowledgment loss; they are not browser endpoints.
An instance precondition supplements field revisions because replacement can
reuse a public key and reset its field revisions. Command receipts are deduped
before reevaluating current state; a retry cannot apply a second effect.

## Preregistered cases and oracles

1. Unknown actor proposal → immutable review → server grant → HTTP acceptance →
   native settlement. Before delivery: one pending native owner, zero server
   attempts/effects. After: correlated terminal receipt, observed native
   confirmation, one server attempt/effect, exact rendered value.
2. Cancel a deterministic producer before proposal: no owner, review, command or
   server effect; a late completion button is disabled.
3. Delayed producer observes capacity revision zero; host applies 5 then 10.
   Browser refreshes but proposal retains its original versions. Server rejects
   conflict, independent human note survives, and an independent declared Link
   publishes useful progress while the route owner remains pending.
4. Exact approved command tampering fails before backend application; the original
   command still succeeds. Permission revoked after approval rejects the genuine
   command with no effect and rolls back its native proposal.
5. Applied command with withheld application acknowledgment: same native owner and exact command
   remain; disposal is explicitly blocked. Same-command retry returns its receipt
   with two HTTP attempts and one effect, then native settlement and disposal work.
6. A newer overlapping native owner survives an accepted remote receipt. The
   older owner's observed disposition is recorded, never assumed to refuse.
   Resolving the newer owner and retrying local settlement sends no command again.
7. Same-key entity replacement uses external remove/add, not in-place setAll. A
   held old native row cannot retarget the replacement. Its old instance command
   is rejected even when field revisions match; replacement values survive.
   Authoritative replacement can make the old rollback unsafe. Verify the refusal
   leaves the old owner pending, then require a deliberate "Keep authoritative
   replacement" action. This confirms only the obsolete local ownership, observes
   its actual terminal event, preserves the replacement and independent note, and
   retains the rejected server receipt and failed remote outcome without resending.
8. Human rejection preserves an independent note and produces zero HTTP commands.
   Explicit disposal after all ownership is resolved destroys the tree once.
9. Transport-only browser requests cannot supply reviewer authority or apply an
   unapproved command. The pending review stays pending until the separate host
   callback approves it; that original command then works.
10. Lost grant-revocation responses, after both remote acceptance and unsent
    human rejection, leave an explicit cleanup job. Native settlement completes
    from the retained terminal decision before fallible cleanup. Cleanup retry
    never calls command delivery, and disposal stays blocked until its receipt.

The implementation splits the grouped cases above into twelve positive tests.
Grant cleanup is tracked separately by exact command/request identity. An
uncertain cleanup acknowledgment is not a loss of the terminal server receipt,
and neither cleanup retry nor local settlement retry resends that command.

Each case has a new server and browser page. Tests drive named DOM controls and
assert intermediate rendered state, exact native ID sets/lifecycle events,
server request bytes, attempt/effect counts and cleanup. Host diagnostics are
independent oracles, not client acknowledgments. The runner records all cases
without replacing failed attempts with retries. A failed case remains failed.

The first real-browser run exposed transparent browser retries after a socket was
destroyed: one client delivery produced two server requests and one applied effect.
The revised uncertainty injection returns HTTP 503 after applying a command or
revoking a grant, withholding the application receipt. Tests require that status,
one initial request and an explicit application retry. This deterministic gateway
failure is not proof of actual TCP-loss behavior. The first failed run is retained.

Replacement recovery is narrowly guarded: a terminal instance rejection, a
different authoritative replacement, a route-only obsolete proposal, matching
current replacement truth, exactly its one pending owner and no newer blocker.
The reference has no transaction-scoped persistence or dependent outgoing route
effect. Confirmation after refusal is an existing supported operation; broader
transactions require their own policy for current contributions and deferred
effects. No blanket catch-and-confirm behavior is introduced. Cleanup remains
separate and may still block disposal until its acknowledgment arrives.

Negative controls reuse the same named oracles: suppress native settlement while
claiming success, and suppress the server instance check after replacement.
Each must fail its relevant positive-case oracle. These are explicit fixture
faults, not alternative acceptable library behavior. Baseline and candidate
results remain separate, with identical application source hashes.

Source preparation precedes any build/test/browser execution. Measurements may
start only in the allocated exclusive slot. The public runtime and frozen v15
release artifacts are outside this directory's ownership.
