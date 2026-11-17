# v15 L2 diagnostic-prefix CPU screen

This separate, CPU-only study compares the prepared v15 runtime with one private
change to `releaseConfirmedBeyondObligation`: discover the diagnostic suffix
boundary before scanning the potentially evictable prefix. v15 already contains
the discarded-clone, sorted-insertion and quiet-ordinary improvements. This is
not a port of v16 confirmation stamps, a public policy change, or a release.

The exact two `identified-built-kernel-v1` manifests and transaction source hashes
are pinned by `ledger-config.json`. The baseline is the full-source identified
build of prepared v15 `4c59a7993ffaf61181429a4b946088adb788a3ee`; L2 has that
HEAD plus the recorded isolated source patch. Admission verifies all109 package
payloads, successful unchanged-input build receipts, frozen source snapshots,
source patches and build logs. All non-test build/production sources except
`transactions.ts` must be identical. Source identity and package identity are
recorded separately; no inference that HEAD alone contains a private prototype.

## Isolation and source admission

`ledger-run.mjs prepare CONFIG TOOLCHAIN OUT` freezes these seven tool/protocol
files. Both arms use one exact esbuild binary/JS package, lock, Node24.15.0 binary,
production defines (`ngDevMode:false`, `NODE_ENV:"production"`), target node24,
fully bundled dependencies and no framework peers. The public `signalTree` and
`transactions`, `/internals` confirmed reader, and private transaction-runtime
reader/notifier are bundled from the same package authority. A metafile check
excludes the native Link entity factory. This neutral ledger workload does not
exercise v16 native publication or an Angular application.

The packet contains both arms' provenance. Every fresh child reads the same
packet and hashes the complete both-arm binding union before either selected
bundle is imported, then again after work. Thus added candidate test provenance
is shared prehistory, not selected-arm-only hashing/retained metadata. No other
benchmark/build may run concurrently. Each child is a new serial Node process;
CPU children have no explicit GC. Host identity/load is recorded, not used to
select results. Ambient/background GC can affect CPU and elapsed time.

`plan` freezes the schedule before any child runs. Each invocation has command,
stdout/stderr, result and sidecar receipts; first unexpected failure stops and
remains preserved. All outputs must be new and outside input roots. No discarded
warmup or selected retry. CPU plans require the complete14-child control receipt
for the same packet, and admission rechecks all raw control results. The analyzer
requires exact schedule completeness, binding union, actual command/sidecar,
child hashes and PIDs, useful outcomes and finite complete timing fields.
Synthetic helper controls separately falsify omitted metrics/intervals, falsey
cleanup/admission errors, incorrect history/truncation/ID, joint binding omission,
changed invocation and missing child. They are not runtime evidence.

## Work and CPU boundaries

P disjoint pending scalar transactions, H diagnostic `history.retain`, E ordinary
array-valued leaves and N confirmed ordinary flushes share one tree per child.
Use v15 `tree.transaction`, never the v16 `transact` name. Pending leaves become1.
At each ordinary step, every wJ receives `[step,J]`; payload creation happens
before the timer. The interval measures all E writes and one exact built
notifier `flushSync`. Every useful value is checked after that interval. Record
all N raw intervals and their exact CPU/elapsed sums. Factory, pending creation,
settlement plus four-microtask/one-job drain, and destroy have separate timings.
Their sum is only a sum of these nonoverlapping intervals, not total process
wall time. Untimed assertions, payload preparation and intervening work are
excluded; no measure combines CPU with heap or browser responsiveness.

Before ordinary work the actual runtime and confirmed reader must have no
confirmed records and exactly IDs1..P pending. At step1, N, H and H+1 (the latter
two only for integer-floor H>=1 within N), untimed retained-reader checks inspect
exact IDs/order, effects/paths/owner paths, scalar subject absence, actual before
and after values, stable distinct positions and exact truncation. The actual
runtime IDs must equal the reader. These deterministic checks can influence
later JIT/GC history; both arms execute them, and these results must not be pooled
with the predecessor ledger study's different untimed scaffolding.

The full held and settled views receive the same checks. Retain0 with pending
owners retains all later ordinary records until settlement; quietretain0 retains
none. Fractional0.5 deliberately preserves v15 `slice(-0)` behavior: all confirmed
records remain. A separate untimed disjoint probe must receive ID P+N+1 and roll
back, so an empty retained window cannot hide broken ID progression. Reverse
settlement must leave all ordinary values intact and remove all pending owners.
Cleanup destroys the tree and requires the notifier to finish draining. No heap,
GC, weak-reference, allocation or retained-memory measurements are made here.

## Registered CPU schedule:64 children

Three matched rounds per profile, alternating arm order by round/profile, give
48 primary children. Odd three-round sampling means within-profile positional
balance is partial (2/1); complementary profile indices balance aggregate order.
One separate baseline/baseline pair per profile gives16 A/A children, after that
profile's primary rounds. A/A is a descriptive noise check, not a confidence
interval. Report all paired differences and adverse cells, never best cases.

| Profile | P | H | E | N |
| --- | ---: | ---: | ---: | ---: |
| quiet | 0 | 0 | 1 | 256 |
| pending-one | 1 | 0 | 1 | 256 |
| pending-32 | 32 | 0 | 1 | 256 |
| history-32 | 0 | 32 | 1 | 256 |
| history-256 | 0 | 256 | 1 | 512 |
| fractional-history | 0 | 0.5 | 1 | 256 |
| wide-ordinary | 0 | 0 | 32 | 256 |
| pending-1024 | 1024 | 0 | 1 | 256 |

History256 actually fills and trims a256-record window: exact step256 IDs1..256,
step257 IDs2..257, final IDs257..512. Its full512 sum remains primary; separately
report the preregistered fill1..256 and trim257..512 windows, retaining every first
interval. The1024 profile means1024 concurrent pending transactions, not1024
ordinary writes. This is a bounded mechanism screen, not a full Cartesian design.

## Fourteen actual controls, both artifacts

Each arm runs normal P1/H2/E2/N4 rollback, dropped useful write (`value-oracle`),
dropped detached retained record (`ledger-ids-oracle`), swapped detached effects
with unchanged counts/paths (`effect-value-oracle`), skipped settlement
(`pending-oracle`), and P2/H16/E2/N4 reverse confirmation preserving sorted IDs
including older pending IDs inserted at the front. Each also runs two overlapping
pending writes: earlier rollback must refuse with v15 `later-pending-dependency`,
leave value2 and both pending owners, then reverse rollback produces1,0 and no
pending owners. Control faults affect oracle input/work only, never runtime bytes.
No expected fault or unknown/falsey exception may conceal cleanup failure.

The change adds no retained representation, but this does not make a heap
improvement claim. The exact candidate's retention gate and final application
comparisons remain required for adoption, alongside broader combined qualification.
This screen alone cannot authorize release or establish application benefit.

## Commands (absolute packet/tool paths in actual receipts)

Run with pinned Node24.15.0 and the parent-controlled exclusive heavy slot:

```text
node ledger-helper.mjs NEW_HELPER_OUT
node ledger-run.mjs prepare ledger-config.json EXACT_TOOLCHAIN NEW_PACKET
node NEW_PACKET/tools/ledger-run.mjs plan NEW_PACKET/packet.json controls NEW_CONTROLS
node NEW_PACKET/tools/ledger-run.mjs run NEW_CONTROLS/plan.json
node NEW_PACKET/tools/ledger-analyze.mjs NEW_CONTROLS/execution/results.json NEW_CONTROL_ANALYSIS.json
node NEW_PACKET/tools/ledger-run.mjs plan NEW_PACKET/packet.json cpu NEW_CPU NEW_CONTROLS/execution/results.json
node NEW_PACKET/tools/ledger-run.mjs run NEW_CPU/plan.json
node NEW_PACKET/tools/ledger-analyze.mjs NEW_CPU/execution/results.json NEW_CPU_ANALYSIS.json
```
