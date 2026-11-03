# Slice 3 realization, hidden state and retirement

This is an isolated, bounded migration checkpoint. Production `87f6831fa60cafe87508f0ace84b7638698ca3b0` is unchanged; B remains closed. No activation, public API/semantic expansion, budget increase or release acceptance.

Parent: slice-2 evidence commit `5497ff365ab7da990fb4977be3550bf8a995754c`, source manifest `67869b6525433a7ad5fceb88042cf25b50d2d90d045408a249b2f673aae3caf9` (803 TS/TSX files). Final isolated source: `/private/tmp/restoration-install-successor/candidate`, manifest `6a43358ddc287d4b58b56a0bd5aa83440e901817520ea6c64690196de5e4e648` (805 files). Archive `final/SOURCE.json` identifies every source file; `final/PATCH.diff` and `final/overlay` reconstruct the five-file delta on that parent. `ARCHIVE.sha256` and `MEMBERS.sha256` identify the archive and contents.

## First failures and corrections

The unchanged initial 10-file restoration/hidden/claim vector passed 299 cases. Adding original jump/undo and hydrate controls produced 34 passes and six failures (two public sequences across three enhancer orders). Chained redo physically restored E but omitted ordinary E; the next redo correctly refused a field effect with `Ordinary field realization lacks its lifetime`. Combined jump alone passed and did not establish chained-redo correctness.

Restoration's raw-effect route did not invoke the existing private `prepareOrdinaryEffects` seam. It now prepares after existing hidden/conflict selection, then passes the exact paired array to validation and installation. Declarative restoration and external-conflict precedence are unchanged. This is an unmigrated W10 handoff, not a new authority or a guard removal. The original 40 cases then passed.

The first unchanged 130,000-row restoration run exposed a second defect: 260,000 value-store writes where the assertion requires 130,000. Its other truncation case passed. The paired route committed physical values, then its ordinary plan wrote the physical values again. Small unchanged-source controls at 3, 32 and 256 rows reproduced 2N writes. Source-owned ordinary realization now installs only ordinary value authority after the already installed physical unit; full value installers retain their previous behavior. Both production callers (heterogeneous frame and complete target) install physical state first. No equality guard, altered counter, skipped assertion or extra publication. Final small controls and both original 130,000-row cases pass. Their roughly 90-second runs establish no CPU improvement.

## Final checks

- Combined 78-file vector: **1,060 passes, one preserved adjudicated contract mismatch**, 1,061 cases. The original replacement/identity-updater no-send assertion remains unchanged and red; prior owner-approved adoption disposition remains separate.
- Separate original large-restoration file: **2 passes**, 130,000 rows. No size/timeout/assertion change.
- Typecheck and spec-types pass. Spec ratchet unchanged; three already improved files are reported separately.
- Changed/cumulative source lint: zero errors, three existing non-null warnings in entity-signal; no new warning.
- Source manifest verified after execution; runtime did not change during final checks.
- Independent source/caller review, exact-array probe, and mixed P99/O7 ordinary-publication/backing-identity probe pass. Root verified all 100 loaded-source hashes for each probe and replayed each.

These totals do not add overlapping intermediate runs. The 78-file vector includes the prior 61 plus the 16-file restoration vector and three small work controls. Four-framework/declaration/lifecycle composition remains slice 4; full suites, installed artifacts, retained-graph qualification and fresh cost acceptance remain slice 5 requirements as applicable. Prior 4N versus 2N snapshot cost remains unresolved.

## Test-premise and interpretation limits

New composition fixtures initially asserted an incorrect independent status for a callback write inside the same failing transaction, restoration outside the authored footprint, and an unreachable private fault hook. Original bodies and failures remain in `paired/composition`. The final three tests use owned callback rollback, an actually authored member replacement, and the existing prepared handoff with a reached fault and useful retry. These are corrected new harness premises, not three runtime defects repaired.

The closed construction type does not promise omitting its required collection member. The final runtime-omission control uses `Reflect.apply`, explicitly matching the existing runtime scenario without a cast or a new public typing promise. The original type diagnostic and unsuccessful optional-marker typing attempt are preserved; no types or spec budget changed.

Nested present-parent public mixed history was exercised independently and passes. A synthetic missing ordinary parent remains a conditional contract question; no absent-ancestor policy is inferred. Preparation tests concern supported controlled throws, not process-level OOM recovery. No general collectibility or arbitrary nested-path claim follows from this gate.

## Exact replay

Reconstruct the parent from its archive, apply `final/overlay`, and verify every entry in `final/SOURCE.json`. Use Node 24.15.0 and pinned pnpm 10.17.0. Existing local tree has the documented toolchain shim:

```sh
cd /private/tmp/restoration-install-successor/candidate
export PATH=/private/tmp/derive-placement-successor/toolchain:$PATH
export COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm exec nx test kernel --testFile=src/lib/restoration-paired-work.spec.ts --skip-nx-cache
corepack pnpm exec nx test kernel --testFile=src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts --skip-nx-cache
corepack pnpm run typecheck
node tools/check-spec-types.mjs
corepack pnpm exec eslint packages/kernel/src/lib/entity-signal.ts packages/kernel/src/lib/physical/entity-value-store.ts packages/kernel/src/enhancers/restoration/restoration.ts packages/kernel/src/lib/restoration-paired-composition.spec.ts packages/kernel/src/lib/restoration-paired-work.spec.ts
```

Run the combined vector as an argument array from `final/evidence/COMBINED-COMMAND.json` using a subprocess in that root; exit 1 includes the unchanged contract mismatch. Original red logs, commands, source identities, diagnostic trace scripts, reviews and final logs are in the archive. Diagnostic instrumentation is not candidate runtime. First failures remain reproducible on the parent/paired overlays; no previous source inherits a later result.
