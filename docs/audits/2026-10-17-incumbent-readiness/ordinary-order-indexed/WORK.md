# Prepend traversal control

Node24.15.0 source bundles, control frozen predecessor and fifth frozen execution overlay, no worker edits. BEFORE.json hashes complete copied package TS and first harness before execution; CORRECTED-BEFORE.sha256 hashes corrected harness. esbuild tsconfig warnings do not prevent bundle execution. Commands: node control.mjs; node fifth.mjs.

Measured capture-enabled transact callback only, no observers, population/flushing/assertions/confirmation/destruction excluded. Existing StructuralStore.snapshotActiveOrder wrapper counts calls and copied subject entries; production structuralActiveKeyEntriesVisited reported separately.

For both arms, fixed one prependMany(...,{mode:overwrite}):
- N16 fresh:2 calls/33 entries; existing:2/32.
- N256 fresh:2/513; existing:2/512.
- N1024 fresh:2/2049; existing:2/2048.
- Named active-key enumeration counter zero in every measured case.

Thus 2N+1 fresh and2N existing snapshot work is inherited for this prependMany route, not introduced by fifth. Zero active-key stats alone misses this existing linear traversal. No CPU/allocation/whole-product conclusion and no mandate to optimize it automatically.

First harness used prependOne on existing key; it correctly throws existing-id. First source/logs preserved. Its fresh prependOne N16 control/fifth both0 snapshot calls/entries. Corrected named workload uses supported overwrite-mode prependMany, explicitly not pretending existing-key prependOne is supported. No native owner counters measured; snapshot numbers do not establish total owner cost.

## Sixth deterministic rerun

Frozen sixth reconstructed from frozen fifth plus execution-sixth/source/packages overlay. Runtime TS files all match execution-sixth/SOURCE.json. One unrelated test indexed-source-owner-prepend.spec.ts differs in copied snapshot; it is not imported into bundle, so do not claim complete package test-source identity. Harness sixth.ts hash SIXTH-BEFORE.sha256. Command node sixth.mjs.

N16/256/1024 fresh overwrite prependMany: physical snapshot calls0/entries0; EntityPlacementStage.read26 at every size; stage.snapshot calls0/entries0; named active-key entries0. Existing-key overwrite prependMany: physical snapshot calls2/entries2N; stage.read19 every size; stage.snapshot calls0/entries0; named active-key entries0.

Thus fresh-only snapshot work removed without moving it to measured O snapshot traversal; existing-prefix 2N capture remains inherited. Ordinary stage snapshot is the current full endpoint traversal method (entity-placement-stage.ts26); wrapper counts its returned entries and stage.read counts its traversal reads. These are namespaced sixth-only counters, not cross-arm equal metrics. Other direct arrays/loops/allocations remain outside these counters; no CPU claim.

Static cleanup review: EntityOrdinaryTopology.prepareInstall iterates union of ordinary.patch and physical.patch, updates displaced membership locally and normalizes head/tail. clear is intentionally whole-owner destruction. This supports local-index update structure, not proof every caller produces a local patch; full authored reorder legitimately snapshots/iterates N and existing-key prepend retains N physical snapshots.

## Tenth frozen rerun

All reconstructed package TS entries match execution-tenth/SOURCE.json (no mismatches); TENTH-BEFORE.json and TENTH-HARNESS.sha256 preserve input identity. node tenth.mjs executes same workloads/counters as sixth.

Fresh N16/256/1024: stage reads23 each; physical snapshot0, ordinary snapshot0, active-key entries0. Existing prefix: physical snapshot0; ordinary snapshots6 calls and6N entries (96/1536/6144); stage reads184/2824/11272 (=11N+8), active-key entries0.

Existing prefix linear cost is not eliminated: complete ordinary endpoint capture now traverses six snapshots versus prior two physical snapshots. This records deterministic named work regression/shift, not CPU or allocation attribution. Fresh one-member prefix remains sparse in these counters. Do not report zero physical snapshots as zero collection work.

### Attribution correction (source verified, no rerun)

Raw counter names `ordinarySnapshotCalls`/`ordinarySnapshotEntries` are misleading: wrapper intercepts **all EntityPlacementStage.snapshot**, shared by physical and ordinary stages. Retain raw logs unchanged. Correct tenth existing-prefix interpretation is SIX shared placement-stage snapshots /6N total entries, not six ordinary-only traversals.

Frozen tenth source trace: entity-mutation-frame.preparePlacement140–160 takes physical base before at153, physical stage after/domain at157, physical after/capture at160 (3P). entity-signal.prepareOrdinaryTopology723 snapshots ordinary before; EntityPlacementStage.orderDomain30 snapshots current ordinary sequence; source826 snapshots ordinary after (3O). In measured P=O=N workload, total3N P+3N O=6N. Stage.read totals also combine P/O and other stage helpers. Zero StructuralStore.snapshotActiveOrder remains accurately zero for tenth, but does not mean physical stage traversal is absent.

Earlier paragraphs' 'ordinary snapshots6' wording is corrected by this explicit attribution; deterministic counts and conclusion of retained existing-prefix linear work stand. No runtime/source change or repeated measurement required for correcting wrapper interpretation.
