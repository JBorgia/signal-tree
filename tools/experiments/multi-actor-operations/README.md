# Multi-actor operation reference prototype

Experimental application integration, not a public package. Start with the
[current consumer walkthrough](WALKTHROUGH.md) and [verification ledger](VERIFICATION.md).
The standalone coordinator needs no dependencies; installed Angular/browser, HTTP
and comparison consumers have their own pinned runners. Native conditional-Link
integration remains unaccepted.
Use the repository's Node version (24.15.0 in `.nvmrc`). From the repository root:

```sh
node --test tools/experiments/multi-actor-operations/*.test.mjs
```

`coordinator.mjs` holds operation proposals, revisions, immutable review bindings,
explicit unknown/declared actor context, delivery attempts and correlated receipts.
`dispatch-fixture.mjs` is the authoritative in-memory backend for one delivery's
route, note, time window and capacity. Tests are the runnable deterministic app
scenarios; no UI, runtime imports, dependencies or package installation is needed.
`review.test.mjs` contains the driver's independent review tests, unchanged here.

## Standalone coordinator workflow

1. Capture `observed = backend.snapshot()` before supplying inputs to a producer.
   Use `backend.proposal(patch, reads, observed)` when it completes. The proposal
   includes the observed versions of written fields and declared read dependencies.
2. Call `coordinator.create(applicationOperationId, proposal, actor)`; actor
   defaults to `{ kind: 'unknown' }`. `{ kind: 'declared', label: 'agent-a' }`
   records a declaration, not authentication or verified identity.
3. `review(id)` returns a detached, recursively frozen binding. `revise(id, proposal)`
   invalidates previous reviews. `approve(binding)` accepts only a current binding
   issued by that coordinator. This object identity check is local consent wiring,
   not a security boundary or portable approval credential.
4. `deliver(id)` calls `adapter.apply(command, context)`. The backend validates
   permissions and expected field versions at application time. A correlated
   `applied` receipt yields `succeeded`; a definitive `rejected` receipt yields
   `failed`. A thrown error or invalid receipt yields `uncertain`, even if the
   backend may already have applied the command. Retry an uncertain operation
   using `deliver(id)`; command identity and content stay fixed, attempt ID changes.
5. `reject(id)` withdraws an unsent proposal without changing accepted entities.
   `forget(id)` removes terminal succeeded/failed/rejected records. `dispose()`
   releases all records only when every operation is terminal, then closes the
   coordinator. Draft, reviewed, approved, delivering and uncertain operations
   prevent forgetting/disposal. Reject unsent proposals first. Uncertain work
   requires authoritative resolution; there is no force-drop or cancellation API.

Repeated concurrent delivery and adapter reentry share the same in-flight promise.
Operation, revision, command and attempt identities remain explicit across awaits.
The coordinator owns no accepted entity replica, inverse operations, native effect
ledger or rollback engine. Independent proposal rejection cannot erase accepted
later work. This does not implement rejection of already-applied external effects.

## Data and identity contracts

Proposals are detached before recording. Supported data is finite JSON-like
primitives, plain objects (including null-prototype input objects), and dense
ordinary arrays. Cycles, Maps, Dates, class instances, undefined, functions, symbols,
bigints, non-finite numbers, accessors, hidden properties and decorated/sparse
arrays are rejected. This is an in-process data contract, not a hostile-proxy or
resource-exhaustion security boundary. The dispatch adapter additionally validates
its domain shape before applying it.

Operation IDs are APPLICATION-OWNED and must be globally unique within the backend's
idempotency domain, including across coordinator instances, sessions, restarts and
forgotten records. The coordinator detects only currently retained duplicate IDs.
Command IDs encode `[operationId, revision]`; attempt IDs also include a local
attempt count. Attempt IDs are not globally unique across restarted coordinators.
Never reuse an operation ID after forgetting it. Reusing a command key with changed
content is rejected by the fixture; identical content returns the cached outcome.

## Limits

- The backend stores entities and idempotency receipts only in memory. It has no
  disk persistence, durable audit, retention policy or crash recovery. Its receipt
  map grows with commands. Coordinator terminal records require explicit cleanup.
- Fixture application is a synchronous atomic step. Production storage must
  atomically enforce conditional mutation and idempotency recording. The injected
  persistence rejection proves no installation in this fixture, not database
  crash consistency. Definitive failures are terminal and cached; submit a new
  operation and review for a fresh attempt after resolving the cause.
- Read dependencies are explicit, not inferred. Field versions catch stale/ABA
  writes and declared input changes; omitted dependencies cannot be detected.
- Permission control is a fixture switch. No authenticated actor identity,
  distributed locks or production authorization framework exists. Separate browser
  and HTTP fixtures demonstrate exact-command review grants; they do not supply
  production identity or durable credentials.
- The standalone coordinator implements no native rollback or Link publication.
  Installed native settlement and browser consumers are separate compositions,
  documented in the current walkthrough. No durable outbox, external compensation,
  restart reconciliation or performance superiority is claimed. A never-settling
  adapter promise remains delivering; the HTTP fixture has a bounded fetch timeout.

## Evidence

`test-output.txt` preserves the initial nine-test run. `test-output-final.txt`
preserves the twelve-test correction run. `test-output-reviewed.txt` records the
combined final run including four driver-written independent tests. No coordinator test failed in those initial implementation runs; injected
failures there were passing assertions. A later retained-adapter failure and its
correction are preserved under [lifecycle evidence](lifecycle/README.md).
The displayed timings are runner output, not benchmark results.

`test-output-integrated.txt` records the 18-test final run, including cleanup regressions.

`SHA256SUMS` preserves the initial integration checkpoint hashes. It is not a
manifest of the subsequently changed working sources. Later reviewed compositions
carry their own exact identities alongside their results; use the current
verification ledger to select the matching checkpoint.

## Public SignalTree source integration

```sh
node tools/experiments/multi-actor-operations/native-probe/run.mjs /path/to/identified/readiness/checkout
node tools/experiments/multi-actor-operations/native-probe/run.mjs /path/to/identified/readiness/checkout --workflow
```

The runner pins HEAD `5727cd8fcf701128358674411400c019b137a5e4` and refuses
modified package sources. It imports only public kernel/tooling barrels, bundled
with root esbuild. Six probes record correlation, current-value review validation,
revision-observation limitations and failed Link completion. A passing limitation
probe does not satisfy the stronger capability.

Three workflow checks compose this coordinator/backend fixture with actual native
transactions: accepted command/local confirmation, input-version ABA rejection with
rollback preserving an independent note, and uncertain delivery retaining local
settlement until an idempotent retry. No conditional Link implementation is used.

`native-probe/first-failures/` preserves the initial workflow harness and output:
it incorrectly accessed inspection `.contributions` instead of public `.changes`;
cleanup refusal masked that assertion error. This is a harness defect, not a
SignalTree runtime regression. The corrected source uses the existing public
shape. Source bundling is not a typecheck; strict installed-consumer qualification is separately recorded under `installed/`. Independent review then exposed a weak pending-authority assertion and cleanup masking. The corrected workflow checks public pending lifecycle, kills premature confirmation, and uses `withCleanup` to preserve primary failures. Final combined tests: 18; native workflows: 3.
