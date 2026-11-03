# P4 Angular DOM reference — bounded independent review passed

Fifteen real browser scenarios pass against the previously packed kernel and Angular
artifacts from active source `5727cd8fcf701128358674411400c019b137a5e4`.
Independent replay passes those 15 scenarios plus four additional controls.
This is bounded reference-workflow evidence, not production authentication,
navigation recovery, durable handoff or release acceptance. See
[exact identities](convergence-review/identities.json) and
[final review](independent-review/CONVERGENCE-FINAL.md).

## Executed surface

- Angular 22.0.7, full `ngc` AOT with strict templates/types and `skipLibCheck: false`.
- Real `bootstrapApplication`, zoneless change detection, standalone component,
  rendered template/buttons/input and public Angular facade `.set` writes.
- Canonical Angular linker for partially compiled Angular dependencies; no JIT
  fallback or runtime compiler import. Bundle input checks reject source imports
  and `@angular/compiler` runtime inclusion.
- Playwright 1.56.1, installed Chromium 141.0.7390.37, localhost HTTP static server.
- Exact locally packed/installed SignalTree artifacts; no source aliases,
  annotation overrides, private imports or package declaration edits.
- Narrow AG-UI tool-event adapter from `protocol/ag-ui.mjs`, unchanged by this
  worker. Stream completion creates a draft only; review/apply remain explicit.
- An explicitly labeled **in-browser, in-memory backend stand-in** implements
  version checks, permission switch, conditional mutation and idempotent receipts.
  The HTTP server serves static assets only; it is not a real persistence API.

## Browser falsifiers

See [raw results](evidence/browser-results.json) and
[accepted-state screenshot](evidence/accepted.png).

| Scenario | Required observation | Result |
| --- | --- | --- |
| AG-UI proposal → review → apply | No pre-approval server commit; unknown executor; pending native work; accepted receipt before local confirmation | Pass |
| Review → reject with independent note | Native route restored; note survives; zero server commits | Pass |
| Capacity 10 → 5 → 10 after review | Revision advances twice; stale command rejected; route rolls back; independent note survives | Pass |
| Definitive persistence rejection | No server commit; local proposal rolled back; failure displayed | Pass |
| Lost acknowledgment | Same pending native ID retained; disposal refuses; retry uses same command and server commits once | Pass |
| Dispose unsent draft | Proposal rejected, no server command, one tree cleanup callback, mutation controls unavailable | Pass |
| Dispose settled session | One cleanup callback; accepted server state retained | Pass |

No page errors were recorded. Tests operate through DOM locators and controls,
not direct JavaScript calls to application business methods. Backend diagnostic
state is visibly labeled as test-authority instrumentation, not a client receipt.
Native pending IDs come from the versioned public tooling lifecycle reader;
private Studio is not involved.

Disposal evidence covers the explicit session-disposal control. It does not prove
crash/reload recovery, durable outbox semantics, arbitrary route destruction with
unresolved commands, or cancellation of external effects. Refusing disposal
while uncertain is demonstrated; persistence across browser destruction is not.

## Reproduce and identify

From the repository root, Node 24.15.0:

```sh
node tools/experiments/multi-actor-operations/installed/browser/run.mjs
```

The runner creates a fresh `/private/tmp/st-p4-browser-*` directory, verifies the
archived SignalTree tarball hashes, packs locally available Angular peers, installs
offline, compiles AOT, links/bundles, serves localhost and runs Chromium. Local
listener/browser permissions are required. Every run has a unique evidence folder;
failing logs and screenshots remain there.

Current recorded directory: `/private/tmp/st-p4-browser-fLlJQx`.
The earlier disposal checkpoint is `/private/tmp/st-p4-browser-lAvjkb`.
The previous snapshot is retained in `history/pre-adapter-release/`; its library
artifacts and original coordinator evidence remain historical evidence.
See [independent disposal replay and handoff](lifecycle-review/REVIEW.md).
[Manifest](evidence/manifest.json) pins commands, versions, copied fixture bytes,
package tarballs and final browser bundle. Consumer input snapshots and generated
AOT output are archived alongside it. Peer versions beyond Angular 22.0.7 and the
other three SignalTree facades are **not** qualified by this run.

Corrected adapter SHA-256:
`e6b3ccd93c9b2019e46e0bface3dc2812218bfe3e293c1258665f1d417870aef`.
All ten current protocol tests pass, including disposal/reentry controls; see
[protocol log](evidence/protocol-tests.log). The original seven-pass/two-fail
protocol result is retained under `first-failures/`. The other worker corrected
that adapter; this browser harness did not patch its namespace.

## Preserved failures and review boundary

The first sandboxed run compiled and linked, then failed binding localhost with
`EPERM`. It is preserved under `first-failures/localhost-sandbox.log`. The authorized
local-server escalation allowed subsequent browser execution without changing
application semantics.

A fresh Claude CLI reviewer could not authenticate. A fresh Codex CLI reviewer
could not initialize inside the parent sandbox; its elevated launch, while still
requesting a read-only child sandbox, was rejected by automatic approval review
because destination-specific private-code egress approval was absent. Raw attempts
and the stated rejection are under `independent-review/`. No reviewer findings or
approval were fabricated. The existing Faraday reviewer will review this slice through shared files;
no further external reviewer CLI is authorized or needed.

Requested review payload: these browser source/declaration/runner/test files,
the coordinator/backend/AG-UI fixture source and their narrow declarations, and
synthetic run manifests/results/AOT/bundle evidence. No credentials, real customer
data, unrelated repository history or private Studio code is needed.

## Local settlement recovery correction

See [Faraday review handoff](independent-review/RECOVERY-REVIEW.md) for exact source
identities, preserved failures, test commands and limits. The original seven DOM
cases remain unchanged. Added cases cover terminal server rejection with refused
local rollback and useful local-only retry, and an actual post-terminal removal
observer error. Nine browser cases pass; all 28 core/protocol controls pass.

Backend outcome and local settlement are displayed separately. Retry local
settlement never transmits a terminal command again. Unresolved ngOnDestroy
retains responsibility without claiming cleanup or a durable handoff. A real
success/confirm-throw case was not established through the tested public observers.
The backend's observation packet is captured before constructing the tool stream.
At that checkpoint backend enforcement of review approval was separate and unimplemented; the bounded fixture integration below now exercises that boundary.

## Separate in-memory review authority

The browser now transports commands through the unchanged reviewed
`authority/review-fixture.mjs`. Explicit Apply mints a grant for the exact immutable
review binding plus `JSON.stringify([operationId, revision])` command ID. The
reviewer context is held by the host and never supplied in protocol arguments.
This is an in-memory trusted-host authorization fixture, not production identity,
a secure browser trust boundary, a durable grant store, or backend permission
masquerading as review approval.

Lost acknowledgment retains the grant for same-command receipt retry. A terminal
remote receipt revokes it; native recovery thereafter is local only. Capacity is
one retained grant in this single-operation reference. Uncertain or locally
unsettled work prevents owner/gate disposal. Backend permission, input versions
and idempotency remain separate checks after the review gate.

All nine previous DOM cases remain unchanged. Three added cases pass: forged
protocol/context consent plus missing-grant rejection; capacity and grant retention
across uncertain retry; and revoked grant with useful local-only recovery.
Twelve DOM cases pass with no page errors; the twelve isolated authority tests
also pass. Strict full AOT uses a narrow fixture declaration with no any or package
stubs. The SignalTree library tarballs were not rebuilt or changed.

Previous evidence/source copies are in `history/pre-server-review`. See
[independent-review handoff](independent-review/AUTHORITY-INTEGRATION.md) and
[exact identities](authority-review/identities.json). The prior isolated authority
review is not an independent verdict on this browser integration.

## Earlier independent composition review

The pre-convergence 12 DOM cases pass a fresh main replay. Independent general review
passes those 12 plus five probes; separate security review passes those 12 plus
two probes. These counts overlap. See [general review](independent-review/AUTHORITY-INDEPENDENT-FINAL.md)
and [security review](independent-review/AUTHORITY-SECURITY-REVIEW.md).
The production identity, durable recovery and actual-navigation limitations above
remain; passing the fixture does not supply those application services.
