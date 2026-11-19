# Independent restoration singleton calibration review

**Verdict: bounded calibration premise supported; do not compose diagnostic-tests.patch unchanged.** The attributed constants and executed real-work mutation sensitivity are credible. The two experimental specs have a reproduced spec-type regression and require a diagnostic output environment; the author's report explicitly says they are not an ordinary-test promotion proposal. A separate ordinary calibration diff still needs review. No existing test ceiling or runtime was changed by this review.

Input SNAPSHOT.json SHA-256 `41ef5af291b8cb669ca2e91b4725693b43c4f6c9ec647c927068def2747b4531`. Independently verified all 43 artifact manifest entries and all 3066 C21 baseline candidate files. Both original specs and runtime are byte-identical to exact C21 manifest `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`. Original first failures remain preserved in INPUT-ORIGINAL-FAILURE-STACKS.txt. Review contract applied; no root edits.

## Count premise and original semantics

Original paired cases assert writes=N, complete restored row array with row0.n=-1, tombstones=N and empty final array; all remain in the paired diagnostic. The reader-acquired large-sequence diagnostic preserves the original history length/current index, ID count/first/last, row0 value, writes, tombstones and empty-count assertions at scaled N. It does not claim a stronger all-row-value check than that original. The original 130k truncated-turn/claim-release case is outside this diagnostic and remains unqualified by it.

The stats boundary remains installation/jump work: counts are copied immediately after jumpTo, before value/order verification; reset occurs after those reads and before redo. Soft budget checks do not bypass semantic checks: all hard semantics run, and all six observation files are written for each mutant only after hard parity checks. No original semantic assertion was weakened to make the calibration pass.

Raw singleton stacks identify:

- **Redo currentIndex once:** restoration.ts:1489 in restoreVisibleStateToConfirmed reads this.currentIndex; :568–569 calls indexSignal. This executes when leaving the temporal view established by the preceding jumpTo(0), not once per row. Initial undo lacks this singleton in these workloads.
- **Acquired-reader lifetime once per operation:** restoration.ts:694 invokes the acquired observer operation; restoration-reader.ts:159 -> publish:111 -> live:83 -> tooling-tree.ts:28 reads tree.destroyed. The lifetime check precedes even the no-subscriber return, and sequence still advances for a live acquired reader. No reader acquisition means no such singleton.
- Both reach location-runtime.ts:303 trackDependency's actual publicationDependencyReads instrumentation. These are real source reads serving manager/lifetime behavior, not injected numerical increments. This does not prove their accounting is globally minimal or authorize moving them outside instrumentation.

Independent recalculation of all **36 phases** (three arms x two modes x three sizes x two jumps) confirms exact plain/traced parity, sum of stack buckets equals total, and exact disjoint singleton counts. At N=3/32/256, no-reader undo=3N, redo=12N+1; acquired-reader undo=3N+1, redo=12N+2. No events were in both singleton categories. AUDIT.json preserves the calculations.

The tracing property setter stores the same numeric value and records deltas only while a jump is active. It does not change the stat recorder or inject increments. Error-stack and plain object bookkeeping do not themselves call SignalTree dependency tracking; plain/traced equality in every arm supports that interpretation. This is a private instrumentation work counter, not all JS execution, allocation, wall time or a release size budget. The original per-row ceilings remain 3N/12N; the two specifically identified constants are separate. An unexplained generic +1, or changing the point-work <2000 budget, is not supported.

## Real-work mutant reach and kills

Reconstructed each mutant's runtime bytes in memory from original source plus the saved patch and matched RESULT.json's during hash. All RESTORED hashes match original `fd5795420a9ecb633b2269e3000aba192bf6c9ef90452bf4a63c0f5fbb862b50`.

- Validation mutant adds an actual canApplyEffect call in buildPreparedRealizationContext's reached effect loop. Raw traces distinguish the added call at mutated :2483 from the original :2485, through real collection occupancy/dependency reads. Undo row counts double 3N -> 6N; redo and singleton counts are unchanged. All six tests fail work checks.
- Snapshot mutant calls the actual rowNode snapshot again in snapshotCollectionEntityValue. Raw traces distinguish added :2296 from retained :2297 through real snapshot/dependency reads. Redo row counts rise 12N -> 20N; undo and singleton counts are unchanged. All six tests fail work checks.

Each mutant log contains 18 budget assertion errors (plain, traced and singleton-subtracted row bound for six cases), with the six raw observation files present. Independent parsing found no semantic/parity/singleton failure. Baseline raw log has six passes; mutant logs each have six failures, rather than startup/no-files errors. MUTANT-AUDIT.json records exact mutation hash checks and assertion summaries. These are meaningful sensitivity controls against two repeated-work regressions, not an exhaustive proof of all collection-size scaling defects. No independent rerun of the runtime/mutants was necessary after verifying this raw evidence.

## Promotion blockers / limits

1. **Reproduced spec-type regression in the exact diagnostic patch.** In an independently copied candidate, pinned `corepack pnpm exec node tools/check-spec-types.mjs` exits 1: two TS2367 errors at restoration-calibrated-large-sequence.spec.ts:25/27, four at restoration-calibrated-paired.spec.ts:15/26/26/41. Constant `mode` literals are compared with disjoint literals. Original first diagnostic files/logs remain untouched. A promoted typed helper with a real mode parameter, or mode-specific fixtures without impossible branches, must preserve the assertions and undergo a fresh spec-type check. Do not weaken the type ratchet. This does not invalidate the executed numerical observations; it blocks composing these exact specs into ordinary source verification.
2. Both new files unconditionally write to `process.env.ST_TRACE_OUTPUT + '/...'`. run.py creates that directory for the experiment, but ordinary Nx discovery does not provide it. They cannot be added as ordinary tests unchanged. Keep them in an explicit diagnostic gate or supply an appropriate portable harness / promotion design, preserving raw output. This gap is source-inspected, not reproduced by another runtime run.
3. Existing original ceilings remain unchanged and still fail; the packet is supporting evidence, not an implemented oracle correction. Any future change should explicitly distinguish no-reader versus acquired-reader constants, retain 3N/12N row ceilings, preserve semantic controls and mutation sensitivity, and avoid claiming that an unexecuted large case passed.

**130k was not run.** 390001 undo / 1560002 redo for the acquired-reader sequence are source/scaled extrapolations only. The preserved original 390001 failure is actual evidence; its later redo assertions were blocked. This review does not close call-argument-limit, truncation/claim-release, full-kernel, stalled-130k, or production-cost qualification.

## Independent checks run / not run

Run: artifact/baseline SHA verification; raw 36-phase recalculation; saved mutant application/hash reconstruction; log/assertion classification; spec-type check in own full copied C21+diagnostics. Command/log/exit are spec-types-command.json, spec-types.log, spec-types-exit.json (child exit 1; wrapper exit is not the gate status).

Not run: six runtime baseline cases again, either runtime mutant again, 130k, any full suite, timings, source modification or original oracle correction. All review artifacts are in /private/tmp/st-restoration-singleton-independent-review.
