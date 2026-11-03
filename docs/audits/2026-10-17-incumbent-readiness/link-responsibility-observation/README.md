# Link responsibility observation: bounded correction

The private correction closes the original ABA failure in the tested scalar,
default-batched runtime. It does not qualify production Link or satisfy immediate
independent progress for writes authored while other owners are already pending.
Production retains its conservative hold. No API, runtime, budget or B work changed.

## Identity and mechanism

Checkout: `e488ca34e75a808f0f4dc26edfea5e7ea26fcaab`.
Production runtime checkpoint: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
The loader transforms only Link, PathNotifier and transaction lifecycle code in
memory. All 91 bundled original source hashes match the checkout. The archive
contains exact transformed hashes, executable bundles, specification and first runs.

Each authored scalar revision carries an immutable payload/responsibility receipt.
The captured notification batch completes its receipt frontier before callbacks,
including entries skipped by value equality. Link refreshes the payload and ticket
together; a physical read is only an additional consistency guard. Reentrant writes
invalidate prior tickets immediately but await their own batch completion. Ordinary
net-equal value notifications remain suppressed.

Cross-tree conservatism snapshots pending owners across registered trees, namespaced
by tree and transaction identity. Only actual confirmation releases those captured
blockers. Foreign rejection or destruction does not cleanse an old receipt. A fresh
ordinary overwrite follows approved surviving-write semantics. This bounds one fully
instrumented runtime; it does not authorize publishing unobserved external speculation.

## Executed results

| Evidence | Result |
| --- | --- |
| Unchanged owner-window controls, including original ABA | 46/46 |
| Added responsibility controls | First 14/14; final 16/16 |
| Historical delivery controls | 32/34; two preserved oracle differences |
| Independent mixed transaction/ordinary and realized/ordinary probes | Both pass |
| Strict private helper typecheck | Pass |

The final two added assertions cover next-batch event ordering and a later foreign
owner; no algorithm changed between the first and final added-control runs. Root
replayed frozen bundles independently. Independent review replayed the first controls
and challenged metadata coalescing. Default semantic boundaries separate incompatible
metadata; the hypothesized lost-stamp failure was not reproduced.

The two historical delivery assertions still demand no send and an unresolved waiter
after captured owners confirm. Actual results send 42 and resolve the waiter. They
remain unchanged failures against their old expected values, not reported as passes.
The original tree-destruction witness also remains archived: its no-send expectation
is stronger than established behavior. Tree destruction is not connection disposal;
the previously documented held-waiter lifecycle gap is not repaired here.

## Costs and limits

The final seven-scenario workload creates 14 transaction trees and records 30
notifications: 232 registered-source visits and 39 pending-owner visits. After
teardown, 14 source closures, 10 outcome maps, 30 receipts, 20 latest entries and
20 completed entries remain; listener maps are empty. This is unreclaimed research
metadata and whole-registry work, not a production cost or lifetime qualification.

Earlier work can publish after its captured owners confirm while later unrelated
owners remain pending. A genuinely independent write authored during existing
pending owners still waits. Full automatic independent progress remains release-blocking.
Entities, native framework projections, alternative/nonbatched modes, allocation
faults, cross-runtime sources and production integration remain unqualified. No CPU,
heap, bundle campaign or broad suites were run. The two entity-budget blockers remain
separate. No additional policy or architecture is selected by this result.

## Replay and evidence

[Evidence archive](evidence.tar.gz) preserves the private specification, worker result,
all first/final source and logs, independent premise/implementation reviews and root
verification. [Archive checksum](SHA256SUMS) identifies the archive; the extracted
worker directory includes a manifest of its uncompressed artifacts.

Extract into a temporary directory. Frozen bundles are standalone; use Node 24.15.0:

```sh
tar -xzf evidence.tar.gz -C /private/tmp
node --input-type=module -e 'const {run}=await import("/private/tmp/link-responsibility-path/first-window-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("/private/tmp/link-responsibility-path/final-extra-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("/private/tmp/link-responsibility-path/targeted-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
```

Use a fresh extraction location or preserve existing temporary evidence first.
Rebuilding via loader requires the recorded checkout paths and installed dependencies;
exact commands are in the archived `RESULT.md`. No completed broad verification is
inferred from these private replays.
