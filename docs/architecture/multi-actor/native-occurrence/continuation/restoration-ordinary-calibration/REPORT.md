# Ordinary restoration calibration — bounded successor

Ready for independent review. Final patch touches only the two original ordinary specs. Runtime/config/tooling and all other C21 inputs are unchanged. No diagnostic files are added and no output environment is required.

The patch preserves 3N/12N row ceilings and explicitly names separate costs: TEMPORAL_MANAGER_READS=1 for redo leaving the temporal view; READER_LIFECYCLE_READS=1 per operation when a restoration reader has been acquired. Paired undo remains 3N, paired redo is 12N+1. Reader-acquired undo is 3N+1, redo 12N+2. Comments explain the actual currentIndex and destroyed-state reads. All other assertions, sizes, imports, operations, resets and teardown remain intact, including the second large claim-release case. No artifact budget or point-work limit changed.

The original two files and original first failures are archived under originals/ and ORIGINAL-FAILURE-STACKS.txt. Earlier diagnostics and their first type failures remain in their frozen research packets; they are not reused or promoted. No mode-typing change was needed in this successor.

## Executed qualification

- Ordinary restoration-paired-work.spec.ts, original N3/32/256 cases: **3/3 pass**, no ST_TRACE_OUTPUT or ST_PREPARED_REVIEW_OUTPUT.
- Source types: **pass**, generated proof check and both source projects via pnpm run typecheck.
- Spec types: **pass**, unchanged tools/check-spec-types.mjs and ratchet.
- Actual repeated-validation mutant: **3/3 killed**, at the original ordinary undo dependency ceiling; observed reads18/192/1536 versus allowed9/96/768.
- Actual repeated-row-snapshot mutant: **3/3 killed**, at the calibrated ordinary redo dependency ceiling; observed reads61/641/5121 versus allowed37/385/3073.

Mutants are separate temporary changes to the already-reviewed reached runtime sites, never combined or shipped. Validation repeats canApplyEffect in buildPreparedRealizationContext; snapshot repeats rowNode() in snapshotCollectionEntityValue. Neither touches counters. Per-arm patches, commands, first logs and runtime before/during/restore hashes are preserved. Both restore exactly fd5795420a9ecb633b2269e3000aba192bf6c9ef90452bf4a63c0f5fbb862b50. No startup/type/semantic failure is being mislabeled as a work kill: each mutant reaches the ordinary numeric assertion and logs its expected additional work.

Ordinary hard assertions stop after the failing count; later assertions in those mutant executions are not claimed passed. In the snapshot mutant, undo row verification and redo tombstone verification are reached first; in validation, writes=N is reached first. Baseline completes every paired assertion. The previous research experiment's complete semantic/parity checks under mutants remain separate supporting evidence, not newly executed ordinary results.

## Unexecuted and review boundaries

Neither130k case ran. The large ordinary file was source/spec-type checked only. Reader-acquired constants rely on the independently reviewed N3/32/256 traces and source attribution; source/scaled extrapolation gives390001 undo and1560002 redo at130k, not a fresh pass. No argument-limit, truncated-turn, full-kernel, timing or release claim. Main must select any later isolated large execution.

Exact replayable calibration.patch and SNAPSHOT-CANDIDATE.json/ FREEZE.json identify the candidate. RESULTS.json and runs/* contain actual child exits (not just Python wrapper success). Final input hash comparison permits exactly the two test changes and verifies restored runtime. Independent review before composition; retain archived first bodies/failures in the durable evidence record. Private-counter optimization remains parked until kernel qualification.
