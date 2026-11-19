# Final bounded ordinary restoration calibration review

**Accept for composition of this exact test-only patch. No blocker found.** This is not a 130k execution or release qualification pass.

Candidate manifest SHA-256: `6d71b9f34c0e9c97eef6059ed8b2d0bf36366fca335c4f108ae12aae8a7034bd`.
Patch SHA-256: `89a1676e9578af972c0d39ba5e78ca21457a706966243cc3b759214fd9d908bd`.

Independently verified all 3066 candidate file hashes and 37 evidence entries. Exactly the two original ordinary specs differ from C21; no additions/removals, runtime/config/tool changes or diagnostic promotion. Preserved originals match baseline hashes, and replaying calibration.patch against them in own scratch reproduces both final hashes. AUDIT.json records this check.

The diff matches the previously reviewed actual singleton attribution:

- No acquired reader: undo remains 3N; redo adds one named TEMPORAL_MANAGER_READS for currentIndex when leaving temporal view.
- Acquired restoration reader: undo adds one READER_LIFECYCLE_READS for the destroyed-state check; redo adds both constants, yielding 12N+2.

These are the exact source/stack-backed constants, not an arbitrary allowance. The 3N/12N per-row ceilings, sizes, imports, operation sequence, measurement/reset boundaries, writes/tombstones, row values/order/empty assertions, reader history/index checks, teardown and the second large truncated-turn claim-release case are unchanged. No artifact ceiling or point-work <2000 budget changes.

Inspected raw runs/commands/child exits: ordinary scaled cases pass 3/3; source and spec types pass with the unchanged ratchet. Both mutant patches are byte-identical to the previously independently reviewed reached real-work sites. The new ordinary logs kill all three cases for each mutant specifically at numeric work assertions: repeated validation 18/192/1536 > 9/96/768; repeated row snapshots 61/641/5121 > 37/385/3073. Runtime restoration hashes match the baseline. This is not a startup/type failure mislabeled as a kill. Later hard assertions after each failed budget are not claimed to have executed; the prior diagnostic semantic/parity evidence remains separately preserved.

The earlier diagnostic files with six TS2367 failures and mandatory ST_TRACE_OUTPUT are not included. Ordinary tests require no new diagnostic environment.

Neither 130k case was executed in this successor. The large file is source/spec-type checked only; acquired-reader constants rely on the prior scaled trace and source attribution. Preserve that limit after composition: no argument-limit, truncated-turn, full-kernel, timing or stalled-run closure follows.

Independent work here: hash audit, exact patch replay, source/diff comparison, raw command/log and mutant comparison. No runtime test rerun, heavy execution, source edit or root write.
