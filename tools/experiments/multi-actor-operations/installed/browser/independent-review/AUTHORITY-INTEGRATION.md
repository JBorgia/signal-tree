# Browser authority integration ready for independent review

The browser worker has stopped editing app.ts/checks.mjs/run.mjs. Final hashes are
in ../authority-review/identities.json; current manifest/results/input snapshots
are in ../evidence. Prior sources/evidence remain in ../history/pre-server-review.
No external review CLI was used. This is an implementation handoff, not a review
verdict or whole-framework/release acceptance.

Review targets: explicit Apply constructs exactly the coordinator command from
its immutable binding and JSON [operationId, revision] ID; host-only context
mints the grant; transport passes it to the separate authority fixture before
backend validation. Unknown actor attribution is unchanged. No protocol consent
field, model output or backend permission boolean substitutes for this grant.

Grant lifecycle: capacity one; keep grant while delivery is uncertain; terminal
remote receipt revokes it before local settlement. Recovery uses the retained
native handle and receipt, never resends a terminal command. Disposal refuses
uncertain, overlapping and locally pending work before clearing either owner.
Grant counters are fixture diagnostics; the actual cap/revocation enforcement
is the unchanged review authority Map. Tokens and trusted context are not shown
in DOM and are not sourced from tool arguments.

Executed: full strict AOT; 12 DOM cases, 0 page errors; nine previous cases
unchanged; isolated authority tests 12/12. No new failure occurred in this run.
The three added tests cover missing grant/transport forgery, uncertain retention
and cap/retry/reuse, and terminal rejection with grant revoked while local-only
recovery still owns work. All historical first failures remain preserved.

Source fixture hash matches Hume's independently reviewed source. That prior
review is archived in ../authority-review/prior-independent-review.md and does
not itself approve browser integration. The host and backend are in the same
browser realm as explicit stand-ins; this is not production authentication or
protection against code controlling that realm. External capacity commands use
the separate service fixture directly, not the dispatcher consent path.

Current run: /private/tmp/st-p4-browser-lAvjkb. Same pinned kernel/Angular
artifacts. No kernel/native successor/API changes. Success/confirm-throw remains
unestablished as recorded in the previous recovery handoff.
