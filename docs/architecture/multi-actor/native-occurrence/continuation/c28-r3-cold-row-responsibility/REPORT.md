# Isolated preparation-reader prototype — ready for independent review

Candidate: `/private/tmp/st-c28-r3-cold-row-responsibility/candidate`
Source identity: `812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302` (SHA-256 of CANDIDATE-FIRST-MANIFEST.json, 3127 files).
Base: `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate`, `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333` (3124 files).
Patch: `candidate.patch`, SHA-256 `97ab8d89b8f2e3635f467b759af41e222482417658b45892e5a1759278347305`.
Status: focused qualification passes; independent interpretation review pending. Not activated or integrated. No public API, root, frozen input, package manifest, build, budget, or gate changes.

## Bounded change

Five paths: two diagnostic specs; new internal `entity-preparation-reader.ts`; reader registration in `entity-signal.ts`; import plus two dispatch lines in `snapshotCollectionEntityValue` in `tree-realization-adapter.ts`.

Module-private Symbol follows existing proxy-forwarded capability convention. Reader preserves initial absence/active-key gate and ids dependency, initial subject epoch/backing read, current subject/lifetime acquisition, lazy shared collection owner initialization, activation read, acquired lifetime resolution, final current-key epoch/visibility read. No payload enumeration, clone, public type/export, cache, or publication input scope inside the reader. Initial absence throws existing errors; post-acquisition disappearance returns undefined. Rekey follows acquired lifetime, never key replacement. Absent capability retains exact receiver-preserving callable-or-value fallback; present errors propagate and present undefined never falls back.

Adapter source compared mechanically after removing only the new import and dispatch lines: byte-equal to base. All four callsites and surrounding clone/reference, refusal, installation and publication logic therefore remain unchanged.

## Execution evidence

Node24.15.0 and pinned pnpm10.17.0; explicit root dependency symlink only. Manifest-file copy excluded git/cache/generated archives and did not blindly copy node_modules. Each run records argv/cwd/environment, exact spec snapshots, raw log, EXIT and observations under `runs/`.

- `comparison-capture`: 9 pass / 1 explicitly skipped candidate-only case, exit0. Includes both cold probes and then-current comparison file.
- `comparison-reference`: 8 pass / 1 candidate-only skip, exit0, final comparison spec including removal-reference discriminator. Cold spec unchanged from comparison-capture.
- `candidate-first`: **11 pass / 0 skip**, exit0. Command: `corepack pnpm nx test kernel preparation-reader-comparison cold-row-responsibility --skip-nx-cache --maxWorkers=1`.
- `candidate-types`: `node tools/check-spec-types.mjs`, exit0. Existing unrelated type-count improvements left untouched. Baseline spec-types-first also exit0.

Final spec bytes were frozen in FROZEN-ORACLES.json before candidate copy/runtime change and unchanged through candidate execution. No candidate failure was patched around. Historical tsconfig warnings are preserved and not misclassified as failures.

## What the comparisons establish

Cold rows were acquired through private lifetime handles, not byId setup. Populated transaction inspection leaves facades cold in both runs. Baseline undo/redo and rollback materialize c/d row facades and id/n fields; candidate keeps both rows at node=false, fields=[] through those phases. Collection owner remains shared [2], not distinct per-field positions. Lazy owner allocation is separately observed before inventory, which itself initializes position metadata. Later real field binding, selected restoration and Link output remain useful.

FACADE-COMPARISON.json records baseline snapshot-stack byIdOrFail calls 16 for restoration fixture (including later field exercise), 6 for transaction; candidate 0 for each. These are bounded facade-avoidance observations, not allocation totals, speed, memory or budget claims. Publication arrays and later field Link `[10,8]` match. Pending transaction output stays `[]`; rollback emits restored original payload once.

Native tracked reads update for value change, rekey, key reuse, removal and useful restoration. Activation initialization reentry follows a rekey and refuses to retarget after remove/re-add; post-acquisition removal yields undefined. Initial epoch initialization removal/backing retirement produces original not-found error. Private window reads require same registry and tap depth; nested/foreign/closed windows remain absent. Genuine capability-absent structural double verifies fallback receiver and no payload enumeration; candidate-present sentinel and undefined verify no fallback.

P/R callbacks occur on actual backing getters at retained deepClone, not facade spies. P preserves nonthrowing committed-reentry refusal and throwing sentinel behavior with no partial row install, followed by fresh useful preparation. R preserves deepClone's existing structuredClone-error catch/manual accessor fallback and stale-admission refusal; fresh admission restores placement/lifetime and useful field writes. Separate removal tests show no live payload enumeration, exact live identity from read, and prepared clone preference when placement precedes removal.

## Preserved baseline failures and calibration

BASELINE-REPORT.md and runs/cold-first, comparison-first, comparison-calibrated, comparison-discriminator preserve first fixtures/logs; no failure erased. Initial cold failure expected no rollback send; pending leak assertion was already passing and remains unchanged. Phase receipts show initial-settled=[], pending=[], then rollback=[original payload].

Native undo setup originally mixed prelude/seed writes into the same flush. packages/kernel/README.md:212 explicitly defines undoable as current synchronous authored turn, recorded when it settles, with undo in a later action; restoration.ts:1040 describes whole-flush effects. Established getPathNotifier().flushSync() separates prelude from marked removal. Final oracle asserts canUndo=true and exactly one new populated removal turn before undo; root undo returns void, so useful disposition is exact restored physical rows plus canRedo=true, then tracked-read equality. Comparison-capture and candidate show physical and tracked restoration; no new native defect claimed. Earlier physical-empty failure remains recorded, not relabeled a stale-reader counterexample.

Original P spy baseline and unsupported C oracle remain at their historical paths untouched. No broad campaign, 130k workload, performance or OOM claim. Independent review questions and raw paths are in REVIEW-REQUEST.md; Main retains integration/activation authority.

Final preservation check: PRESERVATION.json verifies frozen8f9 3124/3124, isolated baseline input 3124/3124, candidate 3127/3127 with zero hash mismatches. Exactly the two existing runtime files changed and three declared files added; frozen test hashes unchanged. Root git status retains the same unrelated dirty paths.
