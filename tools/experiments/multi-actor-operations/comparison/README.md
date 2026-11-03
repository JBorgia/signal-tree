# Comparative operation references

This directory owns C0 ordinary, C1 installed SignalTree, and C3 TanStack DB
application glue. The current four-arm result is 44/44; see the extension below. It imports the existing parent coordinator/backend only for the C2 arm.
Nothing here is a public package, SignalTree runtime integration or native gate.

## Preserved initial three-arm result

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

## Historical three-arm command (use four-arm instructions below)

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

## Four-arm extension: installed SignalTree C1

The final common comparison is **36/36 passing**, nine unchanged scenario bodies
across C0/C1/C2/C3, plus **8/8 lifecycle checks** (44 total). The original 27-test
output remains byte-for-byte at `evidence/run-01.txt`; first-round source and README
are preserved under `evidence/first-27/`. Final replay output is `evidence/run-05-independent-final.txt`; prior output remains
at `evidence/run-04-final.txt`.
No test failure occurred in this extension. Earlier three-arm sections describe
that preserved first round; this section governs the current four-arm harness.

C1 is independent application glue in `c1.mts`, compiled to `c1.mjs`. It imports
only the public `@signal-tree/kernel` export and the shared data-copy helper, never
the coordinator or repository runtime source. The actual installed artifact is:
`/private/tmp/st-installed-review-6wmzqU/consumer/node_modules/@signal-tree/kernel`.
`link-installed.mjs` creates a comparison-local package symlink to that exact
installation; it refuses to replace an unrelated package. It does not substitute
current checkout code. `evidence/runtime-four-arms.json` records the resolved entry,
package version, entry/declaration hashes and TypeScript version. The artifact is
16.0.0-dev; a version string alone does not establish equivalence to other builds.

C1 uses public EntityMap add/read/update/remove and tree destruction for operation
rows. Review binding, workflow statuses, conditional backend commands, retries and
correlation remain explicit application glue. No transaction enhancer, restoration,
Link conditional publication, computed scheduling, or rollback parity is claimed.
C3 likewise does not qualify server-synced collection or overlapping native rollback
contracts. Native gates belong to separate work; these common tests neither replace
nor privilege them. There is no demonstrated common-outcome superiority for any arm.

Reproduce the current four-arm checks from this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node link-installed.mjs
node node_modules/typescript/bin/tsc -p tsconfig.c1.json
node node_modules/typescript/bin/tsc -p tsconfig.consumer.json
node --test comparison.test.mjs lifecycle.test.mjs
node burden.mjs
```

The supplied installed artifact must still exist. The C1 runtime and consumer
checks use strict NodeNext TypeScript with `skipLibCheck: false`; negative controls
verify wrong entity field values, wrong key types and unsupported actor claims
are rejected. `consumer-types.mts` is compile-only and is never run.

Lifecycle checks create 32 reviewed operations per arm, deliver 16 and reject 16,
forget all, retain external review bindings, reject old binding reuse, and close the
app. They also refuse disposal/forget during active and uncertain delivery, then
resolve through an idempotent retry and successfully tear down. Common-scenario
cleanup rejects unsent proposals or authoritatively retries uncertain commands
*after outcome assertions*, forgets all IDs and disposes each app. This cleanup
recovery is not counted as a scenario success. C1 destroys its actual tree; C3
cleans up its actual collection and local maps; C0/C2 release their records.
These are observable logical-retention and lifecycle assertions, not heap/GC leak
proofs. The backend's in-memory receipt retention is intentionally outside app
teardown and remains unbounded in these fixtures.

`evidence/burden.json` contains physical/nonblank line and byte counts with source
hashes, generated by `node burden.mjs`. Counts include types and comments. C1's
generated JS is excluded, helpers/backends are listed separately, and C2 has broader
validation features. These counts describe code inventory, not development effort,
API quality, timing, memory or a superiority ranking.

Final source/test rereview: the nine scenario bodies are byte-for-byte unchanged
(checked in runtime evidence). Assertions check accepted state/commit counts,
not merely lack of exceptions; completion gates assert both callbacks were reached;
no skipped/conditional-pass cases exist. Source review prompted C0 to retain only
small review-ticket identity metadata after forgetting records and C3 to close its
admission flag before asynchronous cleanup. Final checks passed after those changes.

Independent final replay after the browser-review pause: strict C1 compilation,
strict consumer negative controls, and all 44 tests passed. Final source inventory
is `evidence/burden-final.json`; earlier inventory remains preserved. No common
scenario body or acceptance assertion was changed for this replay. Local approval
is not server-verified review authorization. Input observation capture before a
long-running agent starts is not exercised: these fixtures construct proposals
from an observation at preparation time. The host-observation change under review
elsewhere is not qualified by these results.
