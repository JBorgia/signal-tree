# Cold baseline and oracle calibration

Input identity 8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333; all 3124 input files byte-matched in frozen input and isolated baseline after focused executions. Root dirty paths preserved. Added only two diagnostic specs in isolated baseline.

`runs/cold-first`: 1/2 passed, rollback-send expectation failed. Original fixture preserved there. `cold-calibrated`: 2/2 passed, exit0. The pending-leak assertion remained `[]`. Later explicit receipts show initial-settled=[], pending=[], rollback=[original payload]. Rollback emission is not a leaked pending value or delayed initial send.

Cold replacement rows c/d each started node=false, fields=[]; after undo each node=true, fields=[id,n]. Cold pending inspection contained four useful changes and left c/d node=false, fields=[]; rollback produced node=true, fields=[id,n]. All fields report shared collection position [2], with separate subject lifetimes. These establish construction occurrence, not construction necessity. Later public field/Link undo verifies usable bindings after preparation.

`comparison-first`: four baseline fixture/oracle failures preserved. `comparison-calibrated`: two remaining failures preserved. `comparison-discriminator`: missing-backing setup fixed by retained tombstone; native undo still failed, physical rows actually empty, so this was not evidence of restored physical data with stale observation. `comparison-capture`: 9 passed/1 candidate-only skipped, both files passed. Established `getPathNotifier().flushSync()` (joint-atomic-preparation.spec.ts convention) separates prior seed activity from removal capture. Receipt has historyBefore=0, one removal turn, canUndo=true, then physical [z payload n2,a payload n9], canRedo=true, tracked a payload n9. Root undo has void return; disposition is exact physical restoration plus redo availability, not invented boolean return.

Lazy owner: one registry allocation on row read before any inventory. Without enhancers diagnostic field position metadata is absent; private entity location binding retains that owner. With restoration/transactions, cold fixtures assert shared diagnostic owner metadata.

P callbacks run at retained deepClone, not a facade spy. Both nonthrowing committed reentry and throwing callback refuse before row installation and fresh preparation succeeds. R callbacks also reach retained deepClone. Existing deepClone catches structuredClone errors and preserves accessors in fallback, so R first validate returns and stale admission refuses subsequent validate/apply. Fresh admission succeeds. No runtime utility or guard is changed to make these assertions pass.

`spec-types-first`: exit0, no new baseline; unrelated existing improvements not applied. Historical tsconfig-path warnings are logged, not classified as assertion failures or nonzero exits.

Original P spy instrumentation and C unsupported historical oracle untouched. No performance, size, OOM, or broad signoff claim.

Calibration contract: packages/kernel/README.md:212 says undoable designates the current synchronous authored turn and history records when the turn settles, with undo from a later action. restoration.ts:1040 describes whole-flush/turn effects. The initial fixture mixed seeded/prelude activity with marked removal; explicit notifier flush separates those turns. comparison-capture's physical and observer results establish no new native defect. canUndo and a distinct populated removal history entry remain asserted before undo.
