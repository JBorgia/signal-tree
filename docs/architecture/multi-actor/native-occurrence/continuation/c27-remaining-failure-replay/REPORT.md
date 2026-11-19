# Current C27 nine-file replay — pass

**9 files / 59 tests passed, Nx exit0, first and only attempt.** Exact C27 manifest SHA-256 `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`. Every manifest entry was verified while copying, before execution, and against both the scratch and frozen input afterward: no mismatches. No runtime, source, fixture, oracle, config or budget edits.

The exact previous C23 nine-file selection was replayed through Nx with pinned Node24.15.0/Corepack pnpm, maxWorkers=1 and skip-nx-cache. TEST-IDENTITIES.json verifies all nine current files remain byte-identical to their executed C23 counterparts:

- recipient-progress-positive-counterparts: 12
- recipient-cause-classification: 4 retained guards
- publication-enrollment-adjudicated: 16
- recipient-source-permission: 9
- recipient-window-independent: 9
- heterogeneous-independent-invalidation: 1
- heterogeneous-invalidation-containment: 1
- restoration-paired-work: 3 (N3/32/256)
- public-selected-unit: 4

Counts total59; raw output reports all nine selected files passing, with no skipped/failed cases. This supplies current C27 execution for the recipient counterparts, corrected private forwarding, scaled restoration calibration and output-dependent public diagnostics. Archived obsolete assertions are not relabeled as passing.

## Reproducible evidence

[runs/composition/COMMAND.json](runs/composition/COMMAND.json) records exact argv/cwd and every task-set environment variable, including ST_PREPARED_REVIEW_OUTPUT, ST_PUBLIC_DIAGNOSTIC_OUTPUT and ST_C21_DIAGNOSTIC_OUTPUT. Inherited ST_* variables were removed first. The unchanged C23 redirect helper maps only known diagnostic paths into this scratch; its bytes are hashed. All four required public-observations artifacts were produced. No GC flag or retention routing modification was supplied.

[first.log](runs/composition/first.log) is the untouched first output; RESULT.json records exit0/no timeout/one attempt. SOURCE-BEFORE.json and SOURCE-AFTER.json bind execution to the exact manifest. PROCESS.json records the owned PID/group; GROUP-AFTER.json confirms the group absent. The external 180-second owned-group watchdog did not fire. No retry, suppressed test failure or causal repair occurred. Existing archived-tsconfig resolution warnings remain in raw output; the selected test target executed successfully.

## Limits

Held-continuation/GC was not replayed; its latest evidence remains the separate C23 gate. Neither130k restoration case ran. This is the requested focused composition only, not a full suite, current GC qualification, large-case completion, release sign-off or timing comparison. The earlier 17-case ledger remains historical; this packet adds current evidence only for the selected coverage. Main retains all repository writes.
