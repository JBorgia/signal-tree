# Accountable application changes

This is guidance for the experimental [reference implementation](../../../tools/experiments/multi-actor-operations/README.md), not a newly published SignalTree API. The [coverage ledger](COVERAGE.md) distinguishes implemented examples from production requirements.

## Start with the application operation

Represent the requested business change separately from the mechanism that suggested it. A dispatcher, an embedded assistant, and a browser tool can all propose changing a delivery route. Each proposal needs an operation identity, its intended changes, and the input versions on which it depends.

Use the application's framework facade for state. Keep a proposal separate from live state when review-before-save is the intended experience. Live speculative transactions remain useful when immediate shared preview is needed, but bring rollback, dependency and publication obligations. Do not infer that approval of a proposal makes every currently visible value safe to send.

The reference uses an optional coordinator for proposal revisions and remote outcomes. It does not own SignalTree values or roll them back. SignalTree's native transaction remains the local settlement authority. The server remains the authority for permissions and durable business changes.

## Keep these identities separate

| Identity | Meaning | Does not establish |
| --- | --- | --- |
| Agent run or browser session | Transport/session correlation | Authenticated permission to change data |
| Application operation | One reviewed business intention | Complete knowledge of hidden inputs |
| Local transaction | Pending native contributions and settlement authority | Server acceptance |
| Command | Stable server idempotency identity | Successful delivery |
| Delivery attempt | One transmission of that command | A new business operation |

Application-owned operation IDs must be unique for the backend's idempotency domain, including after local records are forgotten. The reference's actor label is declared attribution, not a credential. Preserve `unknown` when the application cannot establish who caused a DOM event. A machine agent using a browser cannot reliably be identified from a click alone.

## Review and execute

1. Capture the data/version observation supplied to the producer, then bind the proposed changes to it. Include write preconditions as well as inputs used to decide the change. Fetching newer versions when a delayed tool response arrives does not make that response current; recompute against the new data or preserve the original preconditions.
2. Present an immutable review. Revising the proposal invalidates that review.
3. Record local consent for that exact revision. Model output and protocol completion cannot grant consent.
4. Submit a stable command identity to an authenticated backend. The backend checks current permission, domain rules and version preconditions atomically with application.
5. Handle definitive acceptance, definitive rejection and unknown delivery separately. A network error after transmission is not proof of rejection.
6. Settle local state explicitly. Server rejection can require a local rollback that safely refuses; keep its usable recovery authority. A remote command that already succeeded cannot be undone by pretending a local rollback reversed the server.

The reference backend demonstrates per-field version checking and same-command retry. It is in memory: it supplies no durable restart recovery or production authentication. Applications must implement those guarantees in their existing backend. The HTTP fixture's bearer token is a test credential, not an authentication design.

If a product requires server-verifiable review consent, backend permission alone is insufficient. The separate experimental review-authority fixture binds a host-authorized grant to exact command content. The bounded fixture passes independent browser and HTTP composition reviews; it does not provide production authentication or durable grants. A client `approved` flag is not evidence. See the [current walkthrough](../../../tools/experiments/multi-actor-operations/WALKTHROUGH.md) for the implemented sequence.

## Handle uncertain delivery honestly

Retry the same command after lost acknowledgment. Do not mint a fresh business command merely because an attempt timed out. A definitive rejection is terminal for that command; changed input requires a new proposal/review/command. An unresolved operation prevents disposal in the reference coordinator. Applications must retain it, transfer responsibility to a longer-lived owner, or resolve it through their backend before teardown.

Local terminality and callback delivery are distinct. An observer may throw after native settlement became terminal. Inspect public lifecycle/recovery information rather than blindly retrying or issuing compensation. The installed settlement examples cover both retryable overlap refusal and a post-install observer error.

## Protocol and UI boundaries

The narrow AG-UI consumer translates streamed tool arguments into a draft. It cannot approve, deliver, confirm a transaction, or treat `RUN_FINISHED` as business success. Host code supplies the proposal builder and declared attribution. Browser automation should use the same review and backend validation path as a person.

Explicit publication declarations are still experimental native work. They describe publication dependencies, not permission and not rollback ownership. Omitting a hidden input can make a declaration wrong. The production conservative Link hold has not been replaced by these examples.

An equal write is a useful example of that distinction. If transaction q owns a
value of 7, writing another 7 may leave q's rollback authority intact. Declaring
the new write's inputs independent does not make q's contribution committed or
safe to publish. The native settlement facts must determine that separately.

## What belongs where

- **SignalTree kernel:** values, entity lifetimes, membership/order, ordinary versus inspected state, native responsibility, coherent settlement and publication.
- **Framework facade:** native carriers, observation timing and teardown.
- **Optional operation layer:** review identity, revision changes, attempts and remote outcomes.
- **Protocol adapter:** translate messages without inventing authority.
- **Application/backend:** authentication, authorization, complete declared inputs, domain validation, durable idempotency and remote compensation.
- **Studio:** explain and inspect available facts; correctness cannot depend on a diagnostic recording being enabled.

Do not build a second native rollback ledger in application glue. Do not label a store's local sequence as a server revision or confuse arrival order with authority order. Read the [implementation record](IMPLEMENTATION.md) before relying on an experimental capability.
