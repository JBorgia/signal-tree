# Bounded in-memory dispatch outbox adoption result

Eight headless checks pass against unchanged kernel HEAD
676ecb7955c6a0af6898bb17225d68060692fc95 (runtime history 87f6831f).
This demonstrates a constrained command service, not a production Link replacement
or an ordinary facade-only application recipe. The service depends on the existing
versioned tooling `/internals` entry point for lifecycle truth and callback identity.
No production files changed; pre-existing dirty AGENTS.md and measurement contract
remain untouched. `git diff --exit-code HEAD -- packages/kernel/src` passed.

## Behavior observed

- Shipment S-104 has pending truck T-7 and dock 4 approvals. An independently
authored manifest audit sends while the dispatch command remains queued. Confirming
only truck is insufficient; confirming dock permits exactly the captured complete
command. A rejected T-UNAPPROVED command and its deferred copy never send.
- Explicit supersession suppresses an obsolete unsent entry; replacement sends.
- Concurrent drain callers share a single worker. Endpoint applies one audit and
loses its acknowledgement: entry becomes `uncertain`, ordinary drain does not retry,
and explicit retry sends the same command a second time. This is a demonstrated
duplicate application, not exactly-once delivery or idempotency.
- Destroy abandons queued commands and leaves the started request uncertain. A late
successful acknowledgement does not rewrite that disposition. New admission fails.
- Actual rollback refusal leaves the owner pending and blocks its command. Later
rollback succeeds. Neutral leaf subscriber failure is contained and compensation
still becomes rejected.
- A **test-only private internal consequence injection** makes actual confirm throw
after terminal confirmation. The lifecycle reader records confirmed, snapshot has no
pending owner, and its command sends. This tests reconciliation of a genuine thrown
terminal boundary; it is not ordinary endpoint-error behavior.
- Negative control intentionally omits the owner and sends T-SPECULATIVE before
approval. Correct labels are required; the queue does not infer provenance.

## Authority and first failures

`PendingTransaction` exposes inspect/confirm/rollback, no status or handle ID.
`inspect()` reports contributions, not settlement status. Public exported tooling
`activeTransactionContext()` supplies exact callback identity; the subscribed
`transactionLifecycleReader()` supplies terminal facts. Snapshot absence alone is
never confirmation: absent without observed terminal evidence becomes unknown/held.
This tooling dependency is a product-scope limitation, not a new public API proposal.

First-run expected a leaf subscriber error to make rollback throw; it did not.
Second-run expected throwing Link.set to make confirm throw; it did not. Independent
review confirmed containment in location-runtime.ts235–254 and link.ts796–853.
Both failed assertions and source versions are preserved, not counted as passes.
The final terminal-throw control uses the existing descriptor-retention.spec.ts
fault-injection pattern with `deferOperationConsequence` in test.ts only.

The initial ID heuristic required exactly one opened lifecycle event. The final
suite preserves a concrete counterexample using application-first.ts: an opened
observer starts another transaction, initial begin throws after returning from
transact, and the outer pending handle is lost until whole-tree destruction.
The corrected service captures its callback ID directly, retains the returned handle,
and both reentrant transactions settle with the original shipment restored.
Third-run first tried nesting inside the callback; the kernel already rejects that
with `Nested transaction is not supported`. The failure is preserved; the concrete
counterexample instead uses the supported reentrant opened-observer boundary.

Strict TypeScript initially rejected a trace.push after assert.deepEqual(trace, [])
narrowed it to never[]. Changed absence assertion to trace.length === 0; retained
first compiler output. Final strict noEmit succeeds; no explicit any in app/test.

## Application burden and remaining limits

Counted application.ts: **97 nonblank lines** (100 total), separate from test.ts
143 nonblank lines and runner 15. Counts describe these files only, not complexity,
performance, product preference or a production budget. SHA-256 in burden.json;
actual bundled kernel input hashes and bundle identity in source-receipt.json.

Application code locations:

- lines 4–10 define command schema, owner states, entry dispositions and attempt/error
records. lines 14–25 retain domain tree, lifecycle observer, owner registry, begin
reentrancy guard, closed flag, worker and command Map.
- lines 27–50 bind transaction identity and reconcile settlement. Domain callbacks
must be synchronous; no automatic async effect scope. A callback throwing with a
recoverable automatic compensation refusal has no registered wrapper owner or app
recovery workflow here; the kernel error can propagate but this service cannot
adopt its recovery handle. That remains unsupported.
- lines 52–57 require explicit command ID, frozen payload and complete owner list
at every enqueue. Caller can omit a contributor or call speculative data independent;
negative control demonstrates resulting publication. Raw tree transactions bypass
owner registration. Owner.state, Entry.status and the public Map are mutable trusted
bookkeeping; this research sample does not encapsulate them against accidental edits.
- lines 59–68 require explicit supersession and retry. Retry authorizes possible
remote duplicate application. No automatic protocol inference or compensation.
- lines 70–89 serialize local attempts, skip unresolved owners and cancel rejected
ones. Once an endpoint is awaited, it blocks subsequent independent entries until
completion; pending-owner bypass does not imply arbitrary network-independent progress.
- lines 91–98 unsubscribe/destroy the tree and classify queued/in-flight work.
Entry records deliberately remain available for inspection and retain owner/handle
references. Clearing owners Map does not prove reclamation; a long-lived production
service needs pruning and retention policy. Destroy does not abort or undo remote I/O.

The exercised narrative explicitly authors three owner declarations and commands
for dispatch, audit, rejected/deferred copies and replacement, plus separate endpoint
failure/retry/teardown cases. This is author ceremony evidence, not a UX study.
No persistence, crash recovery, endpoint idempotency, backend atomicity, general
nested/recovery policy, browser/UI behavior, four-framework integration, leak or
performance claim follows. Controlled endpoint completion is a process-local promise.

## Replay and evidence

Prerequisites: existing checkout dependencies; Node v24.15.0 from .nvmrc. No install.

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/node_modules/typescript/bin/tsc -p /private/tmp/link-adoption-outbox/tsconfig.json
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/link-adoption-outbox/run.mjs
```

`final-run.log` and `results.json` contain outcomes and complete endpoint traces.
`typecheck-final.log` is empty on successful exit. `PLAN.md` and
`plan-before-run.sha256` preserve preregistration. `first-run.log`, `second-run.log`,
`third-run.log`, `typecheck-first.log`, first/second/third source snapshots and
source-receipt-first.json retain failures. First-run stack uses a large data URL;
runner was changed to write bundle.mjs so subsequent stacks are readable.

Count generation (run by Python over application.ts, test.ts, run.mjs, PLAN.md,
tsconfig.json): `sum(bool(line.strip()) for line in path.read_text().splitlines())`;
SHA-256 is `hashlib.sha256(path.read_bytes()).hexdigest()`. Exact output burden.json.
Independent review findings about tooling dependency, callback recovery, mutable
bookkeeping, retention and network head-of-line blocking are included above.
