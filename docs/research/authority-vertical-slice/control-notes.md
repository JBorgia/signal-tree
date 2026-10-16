# Repaired incumbent control

Runtime is the fresh built artifact of exact8d220643e0d4e34cbdbc6e55e6ef692b25d5e023 in `/private/tmp/st-sparse-integration-baseline-8d220643`. No production edit, interception patch, alternate settlement or helper authority. `control.mjs` imports real kernel index, adapter SDK owner invalidation, and read-only transaction lifecycle feed from that build. Source/build hashes are `control-seal.json`.

## Translation and limits

Cells are a finite predeclared native branch: x,y,u,branch (initially omitted), with branch.member seeded for optional removal/reappearance. This reflects existing schema contracts; arbitrary unseeded cell names throw UNSUPPORTED. Scalar fields write directly; introducing/removing cells uses real branch replacement. Fresh reads enumerate present facade properties and invoke native leaves, avoiding cached branch aggregation during grouped writes. An initial control translation using the aggregate snapshot returned old x inside a transaction; the first common run is preserved and this **adapter defect** was fixed. No production assertion was weakened.

Entity records now use natural native rows `{key,...payloadFields}`; `key` is a reserved control schema field and payloads containing it throw UNSUPPORTED. Property descriptors transfer without evaluating getters in the shim, so the native installer sees getter reentry. `replaceOne` implements complete payload replacement, including omitted-field removal. Output strips only key; no deep clone is added. Prior nested-record translation is preserved in `control-nested-record-preserved.mjs`; it was inappropriate for comparing direct flat entity fields. Reference ids are per-store adapter ordinals keyed by actual native row reference in WeakMap; no retired native row is retained by an adapter Map. `read` uses the held row; stale writes explicitly reject before entering native write, as required by slice interface. Same lifetime restoration reuses exact wrapper; replacement uses a new wrapper. No tombstone count is asserted: native reclamation counters are unavailable in this adapter.

`accept/reject` call real confirm/rollback. `state()` checks actual pending lifecycle id and reports attempted outcome only after owner authority retires. This supports terminality observations during delivery without marking a failed refusal terminal. Empty transactions have no pending id and use handle completion state. No compensating implementation exists in this adapter.

Restoration uses real undoable/undo and one-step history. History recording is scheduled: caller must await flush after undoable before undo, matching existing tests. Immediate undo can legitimately see no history; it is not evidence of stale ownership. The original restoration sequence passes when scheduled history is drained. Nested transactions remain the real incumbent's explicit runtime refusal, not fabricated support.

Observers use existing SDK `observeOwnerInvalidation`; SDK scheduling and cardinality remain unchanged. Callback exceptions are caught **by the harness subscriber** and reported via `takeErrors()`; this tests later delivery/reentry without pretending the kernel has a takeErrors API. State snapshots are read on real invalidation, never generated from writes. `flush` drains microtasks and one setImmediate. Snapshot output enumeration and wrapper costs are included in any timed workload; there are no engine allocation counters.

`supportsFault=false`, `failNextPreparation`, stats/resetStats explicitly UNSUPPORTED. Existing realization validation seams do not cover ordinary writes and settlement as one identical-error preinstall boundary, so instrumenting them would not implement this contract. Such cases must be preflighted and classified unsupported, including fault injection inside a callback. No whole-contract equivalent-cost claim is warranted.

## Focused evidence

`control-probe.mjs` directly checks restoration, conservative overlap refusal with retained/retryable authority, undefined/absence, lifetime restoration/replacement and terminal owner invalidation with reentry. Six checks pass, including one assertion that the fault mode is unsupported (not a fault-safety pass). Common root tests remain the comparative acceptance source. First/second common runs preserve actual refusal/error verdicts.

Replay: `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node control-probe.mjs`.

## Getter reentry evidence

`control-getter-update.mjs` / `.json` replay the natural replaceOne path: getter executes three times, x becomes9, row becomes n1, and no exception occurs. Thus the model policy that all preparation getter reentry must reject is stronger than demonstrated incumbent behavior. No runtime regression conclusion follows from this discriminator alone. The callback-authored x9 survives. Nested object alias probes were outside the declared flat-payload scope and remained unchanged in `control-flat-record-first.json`; root owns any scope-corrected acceptance matrix.
