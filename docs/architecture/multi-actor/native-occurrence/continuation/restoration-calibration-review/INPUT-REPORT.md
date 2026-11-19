# Restoration singleton calibration experiment

Ready for independent review; not composed. Exact C21 baseline, no runtime change in the final candidate. Original tests, first failures and artifact budgets remain unchanged. Expectations were hashed before execution in EXPECTATIONS.md. No private-counter experiment.

## Frozen counts and outcomes

| Scenario | Undo ceiling | Redo ceiling | Singleton attribution |
| --- | --- | --- | --- |
| No acquired restoration reader | 3N | 12N+1 | Undo none; redo currentIndex once |
| Acquired restoration reader, no subscribers | 3N+1 | 12N+2 | Destroyed-state read once per operation; redo also currentIndex |

N=3/32/256: six baseline tests pass. Each test runs fresh plain and traced trees, so twelve tree lifetimes per arm. Original writes=N, tombstones=N, row contents, order endpoints, reader history/index and empty result assertions remain. Counter snapshots precede intervening reads as in the originals. The diagnostic suite preserves the two import styles. The tracing setter changes only the stats object's numeric property; uninstrumented counts agree exactly. Exact singleton stack assertions distinguish the named sources from per-row work. The existing 3N/12N row ceilings are unchanged in the diagnostic assertions.

| Mode | N | Baseline undo / redo |
| --- | ---: | ---: |
| Paired | 3 | 9 / 37 |
| Paired | 32 | 96 / 385 |
| Paired | 256 | 768 / 3073 |
| Reader acquired | 3 | 10 / 38 |
| Reader acquired | 32 | 97 / 386 |
| Reader acquired | 256 | 769 / 3074 |

## Executed real-work mutants

V adds one actual canApplyEffect call in the reached buildPreparedRealizationContext effect loop. It doubles the validation work responsible for undo reads: 3N becomes 6N, with singleton counts unchanged. All six cases fail specifically the undo work assertions. Redo work stays unchanged.

S evaluates the actual rowNode snapshot twice in snapshotCollectionEntityValue and returns the second result. Redo row reads rise from 12N to 20N, singleton counts unchanged. All six cases fail specifically the redo work assertions. Undo work stays unchanged.

These are isolated temporary runtime mutants in this disposable scratch, not proposed runtime edits. Each arm's mutant.patch, raw stacks, exact commands, first.log, RESULT and RESTORED hashes are preserved under runs/. Neither modifies the stats implementation or injects increments. Raw stacks reach the added validation/snapshot source lines and show genuine location/epoch reads. All eighteen errors in each mutant run are expected work assertions (plain, traced, and attributed per-row for each case); no semantic, parity, or singleton assertion fails. Soft work assertions allow all hard semantic assertions and six raw observation files to complete. This is executed mutation proof for these two repeated-work regressions, not a claim to kill every possible scaling defect.

The runtime file returns after each arm to SHA256 fd5795420a9ecb633b2269e3000aba192bf6c9ef90452bf4a63c0f5fbb862b50. Final verification matches all 3066 frozen input file hashes, including both original specs. Only the two new diagnostic specs differ from the baseline inventory. SUMMARY.json verifies count formulas and records every result.

## Limits and proposed interpretation

This supports separately accounting for identified constant lifecycle/manager reads while keeping the original per-row ceiling and semantic assertions. It does not support a generic unexplained +1 allowance: reader-acquired redo needs two specifically attributed reads. No existing threshold was edited. diagnostic-tests.patch contains only the new experiment; output files require ST_TRACE_OUTPUT through run.py and are not a normal-test promotion proposal.

For N=130000, source extrapolation of the acquired-reader sequence is undo390001 and redo1560002. Neither was executed in this packet. The original reported undo390001 failure is preserved; original redo was blocked by it. Scaled qualification cannot establish the >call-argument-limit behavior, truncation/claim-release case, full kernel health or runtime performance.

All three Nx runs logged the inherited tsconfig resolver warnings about archived audit dependencies; baseline still completed six passing tests and both mutants completed their six intended failing tests. These warnings were not repaired and are not counted as mutant kills. No types/full-suite or timing superiority claims.

Review entry points: EXPECTATIONS.md; diagnostic-tests.patch; runs/*/mutant.patch; SUMMARY.json; raw observations and first logs; FINAL-IDENTITY.json. Independent interpretation review must precede any composition or ordinary-test calibration. Private-counter optimization remains documented future work until kernel qualification.
