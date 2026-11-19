# Comparative operation references

This directory owns C0 ordinary application glue and C3 TanStack DB application
glue. It imports the existing parent coordinator/backend only for the C2 arm.
Nothing here is a public package, SignalTree runtime integration or native gate.

## Result

On Node v24.15.0 with installed `@tanstack/db@1.0.0-rc.1`, all 27 checks passed:
nine identical observable scenarios for each of C0, C2 and C3. No skips.
See `evidence/run-01.txt`, `evidence/runtime.json` and `SHA256SUMS`.
No test failure occurred. The first sandboxed registry request failed with
ENOTFOUND and is preserved in `evidence/registry-attempt.txt`. An approved network
retry resolved npm's version to 1.0.0-rc.1; installation output is in
`evidence/install.txt`. npm lifecycle scripts were disabled.

For this bounded proposal workflow, there is no demonstrated capability advantage
for C2. C0 and C3 independently meet the same observable results. This does not
establish comparative DX, production readiness, native composition equivalence,
reactivity equivalence, or a performance ranking. Runner timings are incidental.

## Reproduce

From the repository root, with Node 24.15.0:

```sh
cd tools/experiments/multi-actor-operations/comparison
npm ci --ignore-scripts --no-audit --no-fund
node --test comparison.test.mjs
shasum -a 256 -c SHA256SUMS
```

The lockfile pins the actual installed dependency tree and registry integrity.
Network access is necessary for a clean install unless the npm cache contains
those exact artifacts. No root manifest or lockfile is changed. `node_modules/`
is excluded by this directory's `.gitignore`.

## Arms and ownership

| Arm | Implementation | State/application authority |
| --- | --- | --- |
| C0 | `c0.mjs`, ordinary Map store and explicit application workflow | `reference-server.mjs` owns accepted entities, versions, idempotency and receipts |
| C2 | Parent `OperationCoordinator` and `DispatchBackend`, unchanged | Existing parent backend; this coordinator still has no ST integration |
| C3 | `c3.mjs`, actual TanStack local-only proposal collection plus manual transactions | Same independent reference server as C0; collection owns local proposal rows only |

C0 and C3 import no C2 implementation. They share only a JSON data-copy helper
and the external server fixture. Their review/delivery glue is independently
implemented. C3 does not wrap C0 or C2. It uses `createCollection`,
`localOnlyCollectionOptions`, `insert`, `update`, `get`, `createTransaction`,
`mutate`, `commit` and `cleanup` from the installed package.

C3's manual transaction optimistically marks an operation delivering. A rejected
or thrown backend call rolls back that local marker, then application glue records
failed or uncertain. It never treats optimistic rollback as proof that a remote
command did not apply. Separate immutable proposals avoid competing speculative
writes to accepted entities. The C3 pattern deliberately does not test rollback
of overlapping optimistic edits to the same accepted row.

All arms get the same declared patch/read footprint, correlation envelope,
conditional-apply behavior, uncertainty injection and idempotency contract.
Backend representations differ but are exercised by the same scenario assertions.
No arm is required to expose SignalTree ordinary/physical state or Link semantics.

## Shared fixture contract

One delivery has `route`, `note`, `window`, `capacity`, with a separate monotonically
increasing version per field. A proposal contains entity ID, patch and expected
versions covering all written fields plus explicitly supplied input fields.
Proposals are separate from accepted entity state. There are no implicit reads.

- Review binds immutable proposal content and operation revision. A local binding
  from an earlier revision cannot approve revised content.
- The backend checks relevant versions immediately before application; even an
  ABA value restoration changes the version and rejects stale review evidence.
- Two agents and a human may submit separate changes on one entity. Independent
  fields progress while another proposal is unresolved. Rejecting the unresolved
  proposal leaves the later accepted changes intact.
- Changed declared read inputs block application. Unknown/UI actor attribution
  remains unknown rather than inferred from input modality.
- Correlated success means this fixture applied the command. Definitive rejection
  means no installation and is terminal. Transport failure means uncertain.
- Lost acknowledgment retries the same command content/key with a new attempt ID;
  the backend returns the recorded result and does not repeat its effect.
- Async completions may arrive out of order. Same-operation concurrent delivery
  shares one promise. Unrelated acknowledgments cannot mark success.

The nine scenarios are immutable review/application; revised review; backend
version/ABA; independent progress/rejection; explicit read invalidation; lost-ack
retry; persistence rejection; async correlation/unknown actor; unrelated receipt.
The oracle asserts accepted values and commit counts as well as operation outcomes.

## Evidence limits

Backend application and receipt recording are synchronous in-memory steps in both
fixtures. Neither is a real database or crash-safe idempotency store. No network,
Electric sync, IndexedDB, durable outbox, auth provider, domain compensation,
entity lifetime/rekey, native rollback, or browser rendering is exercised.
Approval tokens are local object bindings, not security credentials. Operation IDs
must remain unique across sessions in the application/backend idempotency domain.

C3's collection is real but LocalOnly: accepted values are read from the server
fixture, not replicated into a server-synced TanStack collection. Thus these
results do not establish sync/ack read-back guarantees for an Electric or Query
adapter. Application glue supplies conditional approval, correlation and retry;
TanStack supplies the local collection and transaction machinery.

The tests cover independent later work, not automatic retention/rebase of work
dependent on a rejected proposal. Permission, cleanup/dispose, hostile data,
unbounded retention and all supported native combinations are outside this shared
comparison. C3 cleanup is called by the harness to release its collection.

## Primary API sources

Consulted October 29, 2026; living docs may change. Installed package source/types
and lockfile identify the APIs actually executed.

- [TanStack mutations](https://tanstack.com/db/latest/docs/guides/mutations): manual transactions, settlement and optimistic updates. Backend confirmation requires a handler that actually awaits backend evidence.
- [LocalOnly collections](https://tanstack.com/db/latest/docs/collections/local-only-collection): in-memory collections and local mutation behavior; not automatic server synchronization.
- [Transaction API](https://tanstack.com/db/latest/docs/reference/interfaces/Transaction): commit/rollback API; overlapping rollback should not be assumed selectively independent.

The evidence does not select a SignalTree release mechanism or alter its controller.
