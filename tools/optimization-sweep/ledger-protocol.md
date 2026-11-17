# Isolated confirmed-ledger mechanism screen, version 1

This is a new preregistered neutral-kernel study. C1 is the unchanged v16
whole-input-capture baseline; L1 removes the discarded ordinary returned-record
clone, L2 preserves the sorted confirmed suffix without repeated whole-ledger
reconstruction, and L3 avoids materializing an ordinary record only when no
pending/history/existing-record obligation exists. These are three **isolated**
variants, not a cumulative release candidate. Final combined qualification is
separate. The source proposal hashes are in the configuration; no runtime code
is injected or reimplemented by this measurement tool.

## Admission and isolation

`ledger-run.mjs prepare CONFIG TOOLCHAIN OUT` verifies each exact kernel manifest,
all package payloads, successful unchanged-input build receipt, source snapshots,
build log and patch. The transaction source hash must match the explicitly
supplied proposal identity. Every other production/build source input must equal
C1. Test-only source differences are allowed; unrelated runtime mechanisms are
not. Package manifests and source receipts are inputs, not a HEAD-only claim.

Preparation freezes this runner, common definitions, workload and this protocol,
then bundles all four arms using the same esbuild binary/version/lockfile, target
Node 24, `ngDevMode:false` and `NODE_ENV:"production"`. All dependencies are
bundled; no framework peer is involved. Emitted metafile contributions must show
that the Link entity factory is absent. The directly imported private notifier
and runtime reader resolve to the same package/module authority as the public
`signalTree`, `transactions` and `/internals` reader exports. This is intentionally
a neutral ledger screen, not full native-Link coordination or application timing.

`plan PACKET_JSON cpu|heap|controls OUT` writes the exact schedule before any child
runs. `run PLAN_JSON` executes serial fresh Node 24.15.0 processes using the frozen
runner, with a separate JSON result/log/invocation receipt for every child. CPU
children do not expose GC. Memory children explicitly use `--expose-gc`. Outputs
must be new and outside bound input roots. Inputs are reverified before each
child and after the run. Unexpected first failure stops that schedule and is
preserved; fixes require a new packet/plan/output. No discarded warmup or selected
retry is part of this protocol.

## Workload and exact observable task

P denotes disjoint pending scalar transactions; H is the existing `history.retain`
value; E is the number of disjoint ordinary array-valued leaves changed per flush;
N is the number of confirmed ordinary flushes on one retained tree. Arrays provide
meaningful payload-identity/liveness probes while values remain independently
predictable. The transaction runtime is installed by `transactions()` in every
arm. Every ordinary step writes `[step, fieldIndex]` into each `wN` leaf and flushes
the exact built notifier synchronously. Each step must really change the values.

Payload preparation and every intermediate value assertion are outside the
individual mutation/flush timer. Each timer includes all E writes and their one
notifier flush. The episode reports the sum of these nonoverlapping measured
intervals on the **same** store, alongside every raw interval. It does not sum
percentiles from unrelated stores. Factory, initial pending setup, full settlement
plus asynchronous drain, and destroy are separate phases. No useful-state check
is intentionally inside these timers. Settling disjoint pending transactions must
preserve every later ordinary value. Four microtasks followed by one event-loop
job are drained, then the notifier must report no pending work. No GC is inside
CPU timers; background GC can still affect process CPU and elapsed time.

Outside timing, the public retained-reader view must contain exactly the expected
sorted IDs, E effects for each ordinary turn, one effect for each retained pending
turn after confirm, exact paths/owner paths, before/after values, no entity subject,
and stable distinct position IDs matching each record's position list. Pending
IDs/counts are checked before and after settlement. An additional **untimed**
disjoint probe transaction must receive ID P+N+1 and successfully roll back. This
makes ID progression observable even when H=0 produces an empty retained window.
The probe is dropped before memory checkpoints. Reader snapshots are consumed
synchronously and only primitive summaries survive; they do not pin payloads.

The current fractional behavior is preserved deliberately: `retain:0.5` uses
`slice(-0)` and retains all confirmed records. The study neither silently rounds
that contract to zero nor proposes a compatibility change. Truncation is tested
where the workload actually evicts ordinary records, not inferred from ID gaps.

## Registered CPU schedule: 92 children

All seven profiles run C1/L1/L2/L3 in three deterministic rotating/reversing rounds
(84 primary children). Two separate C1/C1 pairs for pending-long and wide add
eight A/A children. A/A variation is diagnostic, not a confidence interval.

| Profile | P | H | E | N |
| --- | ---: | ---: | ---: | ---: |
| quiet | 0 | 0 | 1 | 256 |
| pending | 1 | 0 | 1 | 256 |
| pending-long | 1 | 0 | 1 | 1024 |
| pending-many | 32 | 0 | 1 | 256 |
| history | 0 | 32 | 1 | 256 |
| wide | 0 | 0 | 32 | 256 |
| fractional-history | 0 | 0.5 | 1 | 256 |

These bounded scaling contrasts target clone width, growing correctness history,
P-dependent minimum discovery and requested history. They are not a full P/H/E
Cartesian exploration. Three rounds support an exploratory distribution only;
no significance or generalized application-speed claim is made.

## Registered memory schedule: 18 children, separate from CPU

Each cell runs four arms once (16 children); a separate C1/C1 pair repeats the
pending-wide-rollback cell (two children). There is no timing claim from these
GC-instrumented runs.

| Cell | P | H | E | N | Settlement |
| --- | ---: | ---: | ---: | ---: | --- |
| pending-wide-confirm | 1 | 0 | 32 | 256 | confirm |
| pending-wide-rollback | 1 | 0 | 32 | 256 | rollback |
| history-wide | 0 | 32 | 32 | 256 | none |
| fractional-history | 0 | 0.5 | 1 | 256 | none |

Checkpoints are module-ready, held ledger/pending tree, settled tree, destroyed
but still-held tree, and helper-returned/tree-released. Each uses three explicit
GCs separated by event-loop jobs. Read weak targets only after GC; a new job is
entered before the next GC, so WeakRef's same-job keepalive does not masquerade
as ownership. First and current payloads are sampled from the actual tree leaf,
not an unattached input copy. The first payload's actual identity is also checked
against raw retained effect values where the ledger must own it. The current
payload must stay alive while the tree is live. First payload expectations follow
exact retained IDs; a finite failure is preserved rather than retried away.
After the helper returns, the tree and current payload must collect. A separate
explicit first-payload pin/release control demonstrates positive reachability
and the ability to observe its later collection. Destroyed-but-held whole heap is
reported without claiming that every tree field must disappear at destroy.

Whole `heapUsed` at these checkpoints is not object self-size, dominator memory
or universal leak proof. An immediate before/after ordinary-episode heap proxy is
recorded separately, includes untimed checks, and can reflect GC scheduling; it
is neither allocated bytes nor retained memory. Finite P/H/N samples cannot
establish a universal bound or price every lifecycle configuration.

## Controls, failure behavior and interpretation

Before comparisons, the seven-child control schedule uses C1 only:

1. Small normal P=1/H=2/E=2/N=4 workload.
2. Omit one useful write: `value-oracle` must fail.
3. Omit one detached record before validation: `ledger-ids-oracle` must fail.
4. Swap detached effect payloads while retaining counts/paths:
   `effect-value-oracle` must fail.
5. Skip settlement: `pending-oracle` must fail.
6. Two overlapping pending writes: earlier rollback must refuse with the current
   v16 `later-confirmed-dependency` cause, preserve value 2 and both pending
   owners; reverse rollback must yield 1 then 0 and no pending owners.
7. Separate memory pin/release positive control.

Expected planted failures are explicitly named, use their first execution and
are excluded from performance. Unknown errors, including `throw undefined`, are
serialized distinctly; cleanup failure never silently replaces the first error.
A getter or lifecycle exception is a failure, not an empty successful sample.

Analyze complete bound results, retain all raw rounds, and compare each candidate
with its same-profile/same-round C1 result. Report phase distributions and paired
deltas plus A/A differences separately. Do not pool CPU and GC cohorts, isolated
and cumulative variants, or different histories. Report failures and adverse
cells alongside improvements. Source/functional claims and measured claims remain
distinct; no size-budget change or final adoption is authorized by this screen.
