# Independent browser grant integration/security review

**No blocker demonstrated within the declared same-browser-realm, trusted-host, in-memory fixture boundary.** This is not production authentication, remote server enforcement, durable recovery, or general browser/release acceptance.

## Scope and identity

Reviewed `installed/browser/app.ts`, `authority-review/identities.json`, `independent-review/AUTHORITY-INTEGRATION.md`, `checks.mjs`, and the relevant coordinator, review-authority and AG-UI command paths. Read repository review contract and authority README. Inspected the complete app/checks diff against `history/pre-server-review`; the experiment is untracked at checkout HEAD `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`, so these are working-file additions rather than a tracked HEAD patch. Did not read other reviewers' reports.

Executed against the existing full-AOT artifact `/private/tmp/st-p4-browser-lAvjkb/site/app.js`, not a rebuild or source substitution. The runner verified every entry in `authority-review/identities.json`, including app/checks/run/declaration, both pinned tarballs, copied gate/coordinator/backend and bundle. It also verified app.ts against the copied consumer input. The manifest's package-source identity `5727cd8fcf701128358674411400c019b137a5e4` is distinct from the current checkout HEAD.

- app.ts SHA-256: `e208e0254919feeebe95384b21aa5302baf1937de495e13dbc03f04129d51c8a`
- checks.mjs SHA-256: `1438d339d257dec60ff725daa2fc3fbb872bf59bfd768e222c1ac02cee65eafe`
- site/app.js SHA-256: `0b30206e925cddeda9772030c81f34b002d005d2f16904d76784ea0dcc9c8a70`
- copied gate SHA-256: `653ae035ff584c4832b7b817431c5dd314920b75890de937e8e54d8ba287326f`

Only added `installed/browser/independent-review/authority-security-checks.mjs` in the repository. No implementation/docs edits or external CLI transmission.

## Bounded evidence

### Command binding and host authorization

`app.ts:115–125` retains the coordinator's immutable review binding. Its command constructor uses the same spread order and JSON `[operationId, revision]` identifier as `OperationCoordinator.approve` (`coordinator.mjs:98–107`). The gate grant therefore covers actor, proposal, revision, operation ID and command ID, not only a route or client consent flag. `app.ts:69–73` passes the coordinator command through `gate.apply` before backend installation; there is no dispatcher backend shortcut there.

The trusted context is a frozen host-held object, checked by identity at `app.ts:64–66`. Issuance occurs at explicit Apply; Review and AG-UI proposal consumption alone do not issue a grant. If coordinator approval fails, `app.ts:124–128` revokes the newly acquired grant. Normal delivery immediately sets delivering/busy before yielding (`156–159`); phase/current guards prevent replacing the owner while the command is in flight or uncertain. This is source inspection of the synchronous fixture, not a claim about an arbitrary asynchronous identity provider.

**Run falsifiers:** DOM forged protocol fields and a lookalike reviewer context are rejected, missing grant blocks backend application, legitimate Apply succeeds afterward. Independently repeated these controls three times: commits, deliveries and retained-grant diagnostics remain zero; subsequent reject/dispose completes cleanly. The isolated authority suite also passed command/revision/operation/patch/version mutations, strict host authorization and reentry controls. Browser-level mutation of a live private binding/token was not injected; exact constructor agreement is source-verified and successful gated execution exercises the matching case.

### Uncertain outcome, revocation and local recovery

`app.ts:161–167` returns on uncertainty before grant revocation; a terminal validated coordinator receipt is stored and the grant revoked before local settlement. `170–193` retries local settlement from the retained receipt/native handle without calling deliver. `223–230` refuses disposal while uncertain, busy, locally pending or overlapped. This preserves responsibility in the live fixture; it does not prevent tab closure or supply navigation recovery.

**Run falsifiers:** existing lost-success-acknowledgment case retains one grant, rejects an extra grant at the actual cap, refuses disposal, retries the same command with one backend commit, releases capacity and permits a new operation. Existing rejected receipt/local rollback refusal retains local responsibility with zero grant and one delivery.

**Added independent combined scenario:** create overlapping local work; force backend rejection; lose its acknowledgment twice. Observed uncertainty with zero commits, one retained grant and a capacity error. Disposal remained refused. Third delivery recovered the cached rejected receipt and entered local-pending with zero grant. A failed local retry and eventual overlap resolution/local retry kept transport calls at three and commits at zero. A subsequent new operation applied with one commit, demonstrating released capacity rather than only trusting the grant-count display. Final disposal closed the gate.

These observations support retaining grants until terminal receipt, then revoking independently of local completion. They do not establish the untested success/confirm-throw branch; the handoff explicitly leaves that unestablished.

### Forgery-control strength and production boundary

Protocol top-level fields are allowlisted in `protocol/ag-ui.mjs`; event completion creates a proposal and never grants consent. `app.ts:130–153` separately exercises protocol-field rejection, a forged host context, a missing grant and capacity exhaustion. Tests assert the error identities plus backend commits/outcomes, not merely that a diagnostic button was clicked. Counters remain diagnostics: actual cap/revocation comes from the gate Map. A counter-only assertion would be insufficient; successful receipt recovery/capacity reuse and direct gate tests supply additional evidence.

`app.ts:13–14` visibly describes in-browser, non-durable trusted-host authorization and excludes production identity. AUTHORITY-INTEGRATION.md explicitly excludes protection against code controlling that realm. TypeScript `private` fields are not an isolation boundary. The fixture cannot establish authenticated human presence, secure storage, server enforcement against a malicious browser, or reload recovery, and does not claim those properties. Tokens/context are not interpolated into the DOM or read from tool arguments. The external capacity service (`215–219`) deliberately invokes its separate backend fixture directly; it is not evidence that dispatcher consent is bypassed by protocol input.

No false production-authentication claim found in the reviewed UI/handoff. The authority README's standalone integration-pending wording is historical scope language, not a runtime guarantee or an independent reason to reject this integration.

## Commands, results and limits

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node tools/experiments/multi-actor-operations/installed/browser/independent-review/authority-security-checks.mjs
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --test tools/experiments/multi-actor-operations/authority/review-fixture.test.mjs tools/experiments/multi-actor-operations/authority/independent-review.test.mjs
```

- Browser: 12 existing cases + 2 independent scenarios passed; zero page errors. Fresh result and artifact identities: `/private/tmp/st-authority-security-yUw0jk/result.json`.
- Gate: 12 tests passed, zero failures/skips.
- First browser attempt failed before tests because the sandbox denied loopback listen (`EPERM`). Preserved at `/private/tmp/st-authority-security-KZZk0u/failure.txt`. The identical authorized local command then ran with sandbox escalation; this was not a failing semantic test or a weakened assertion.
- Source app/checks identities and HEAD rechecked at completion. Existing AOT/packaging logs were inspected; AOT and package builds were not rerun.

Not run: general browser audit, other frameworks/browser engines, forced private-object tampering in the trusted realm, remote identity/security testing, success/confirm-throw fault injection, reload/process-loss recovery, performance/leak tests, or production/release gates. No results are inferred for those scopes. The review demonstrates the tested in-session fixture boundary, not a new production security architecture.
