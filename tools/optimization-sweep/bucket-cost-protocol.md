# Pending capture bucket cost screen — source proposal, v1

Question: price isolated O (unused v16 ownerPaths set removal) and K (lazy
entity-only capture containers) against their own exact release-line baseline.
This is deliberately separate from the confirmed-ledger P/H/E study.

## Work and admission

Five arms: C1/O16/K16 and V15/K15. C1/O16/K16 use identified builds, complete
package inventories, successful source-unchanged build receipts and immutable
source snapshots. They differ only in transactions.ts and test-only inputs.
V15 is the prior canonical qualified package, joined to the canonical receipt,
archive hash and successful build receipt. K15 has a fresh identified build;
every package payload except transactions.js must match the V15 canonical
package exactly. This checks actual emitted authority without inventing a new
baseline source receipt. It does not assign K's later documentation HEAD to the
prior artifact. Configuration pins manifest hashes and candidate source hashes.

Production esbuild bundles import named signalTree/entityMap/transactions
exports plus exact same-package internal read-only runtime/notifier inspectors.
ngDevMode=false and NODE_ENV=production are folded. Metafiles must show the
transaction module emitted and the Link entity factory omitted, with no second
runtime authority. This measures optional transaction use, not full native
publication/recipient coordination or an Angular application.

Each fresh process owns one tree. Scalar profile has128 distinct array leaves;
transaction i writes [i+1,3i] to si. Entity profile starts empty and transaction i
adds one distinct row {id:ri,value:i+1,label:value-i}. All128 transactions are held
pending, then either all confirmed or all rolled back, in reverse creation
order. Entity keys are distinct but share collection order; the tested reverse
order respects that structural dependency. No same-location conflicting writes
or overlap-refusal benchmark is substituted for useful work.

CPU schedule: four profiles (two shapes ×two settlements), five arms, three
rotated rounds =60 primary children. Add one C1 and one V15 A/A pair for each
shape's rollback =8; total68. Fresh child processes prevent runtime-history
sharing; no claim of physical-device isolation. Module import is outside the
measured episode. Phases are factory, openAll, openDrain, settlementCalls,
settlementDrain and destroy. The settlementCalls interval is the sum of128
individual calls. Exact full values/order, pending IDs and retained-snapshot
checks run after each stopped timer. Thus settlementWithDrain and
measuredPhaseSum exclude oracle gaps and are not uninterrupted wall-clock user
latency. Immediate memory deltas are not collected as allocated-byte estimates.

## Useful checks and controls

Before opening: pending/confirmed counts0 and exact empty values. After opening:
IDs1..128, count128, every value, every row key/order and exact snapshot digest.
After every reverse settlement: IDs1..remaining, correct values/order and the
unchanged full held snapshot. After async drain: pending0, confirmed0 under
history.retain0, exact final values (all for confirm, original empty for rollback),
held snapshot unchanged. Destroy must report true. Results retain primitives,
not tree payloads, transaction handles, or projected effects.

Controls use8 transactions on both baselines. Normal scalar-confirm and
entity-rollback cases pass. Three planted faults must fail distinct named useful
oracles: wrong scalar value (value-oracle), first two entity inserts swapped while
all entity values remain present (order-oracle), last settlement skipped
(pending-oracle). Positive heap controls deliberately pin the actual tree and
actual first owned payload until helper-return, then release both. Total12
control children. Comparison planning requires a completely admitted controls
run on the same frozen packet. First unexpected failure stops and stays saved.
Undefined/non-Error thrown values are serialized without replacing the primary
error; cleanup failures are separate and reject admission.

## Separate finite heap assay

Four profiles ×five arms =20 primary children, plus one entity-rollback A/A pair
on each baseline =4; total24. They alone receive --expose-gc and report no CPU
figures. Checkpoints: moduleReady, empty tree, pending, settled, destroyedHeld,
helperReturned. Each checkpoint uses three explicitGCs separated by
setImmediate boundaries. Pending owns the full snapshot intentionally as a
semantic control; that snapshot and handles are dropped before settled.

The payload sample is taken from the actual tree result and identity checked
against the held snapshot, not a detached construction input. Empty through
destroyedHeld must keep the deliberately held tree alive. Pending must keep the
actual payload alive. Settled/destroyedHeld payload reachability is recorded,
not required to disappear while the async helper is active. Helper-return must
release both tree and payload except explicit pins; pin release must be
observable. This avoids interpreting a dead local/async-frame survivor as a
proven library root without diagnosis. A failure remains a failure. No fixed GC
count proves collection for every workload, and whole heap is not per-bucket
retained size or a dominator measurement.

## Commands (Node24.15.0; root owns execution slot)

1. `node bucket-cost-run.mjs prepare CONFIG TOOLCHAIN NEW_PACKET`
2. Use `NEW_PACKET/tools/bucket-cost-run.mjs` for every subsequent command.
3. `node FROZEN_RUNNER plan PACKET_JSON controls NEW_CONTROLS`
4. `node FROZEN_RUNNER run NEW_CONTROLS/plan.json`
5. `node FROZEN_ANALYZER NEW_CONTROLS/execution/results.json NEW_CONTROLS/analysis.json`
6. `node FROZEN_RUNNER plan PACKET_JSON cpu NEW_CPU CONTROLS_RESULTS_JSON`
7. `node FROZEN_RUNNER run NEW_CPU/plan.json` then frozen analyzer.
8. Repeat step6/7 with heap and a new output directory, after CPU completion.

All files are exclusive-created. Runner source, protocol, Node binary, esbuild
JS/native binary/lockfile, all package/source payloads, bundles and metadata are
bound before timing. Every process gets a separate invocation/log/result. Offline
admission verifies the exact schedule, command, PID, errors, result hashes,
oracle digests, raw metric sums and complete source/artifact closure. A/A bands
are variability observations, not confidence intervals. Candidate adoption and
full release qualification are outside this screen.
