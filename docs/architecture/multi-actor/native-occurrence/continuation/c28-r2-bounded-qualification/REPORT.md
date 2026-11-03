# Exact C28-R2 bounded qualification — all requested gates pass

**147 unique runtime cases in22 distinct files pass; source, public and unchanged spec-type gates all exit0.** First attempt for each of nine sequential commands. No failure, retry, repair, source/test/oracle edit, public-type expansion or budget change.

Exact frozen manifest: `597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c`, from /private/tmp/st-c28-r2-cutoff/candidate. All3,093 entries verified during copy and before execution. Candidate and frozen input remain byte-identical afterward (FINAL-IDENTITY.json). Every selected test is byte-identical to its archived C27/C26 test file (TEST-IDENTITIES.json).

| Archived selection / unchanged gate | Result |
| --- | --- |
| C27 focused-first: eight kernel files | 54/54 pass |
| C27 remaining-failure replay: nine kernel files | 59/59 pass |
| Source: tsc --noEmit -p tsconfig.typecheck-all.json | exit0 |
| Public: tsc --noEmit -p packages/kernel/tsconfig.typecheck.json | exit0 |
| Spec: node tools/check-spec-types.mjs | exit0 |
| C26 Angular facade controls | 8/8 pass |
| C26 React facade controls, existing target typecheck included | 8/8 pass |
| C26 Vue facade controls | 8/8 pass |
| C26 Solid facade + saved-snapshot controls | 10/10 pass |

Thus113 kernel cases plus34 framework cases, with no repeated runtime file between selections. Counts do not include types as tests or any author's results. The six author19 files and additional root/retention/invalidity experiments were not runtime-replayed; SCOPE.json gives the exact selection and exclusions. Their files participate in the ordinary spec-type gate only. No old approved-policy-mismatch or new runtime assertion failure occurred in this selected scope.

The R1 first compiler failures remain preserved in /private/tmp/st-c28-r1-bounded-qualification. This separate R2 run uses the supplied fixture corrections without local edits. Spec types reports three existing baseline improvements; no --update or ratchet change was performed.

## Exact evidence and limits

Each runs/<gate>/COMMAND.json preserves original command provenance, exact argv/cwd and every task-set environment variable. Pinned Node24.15.0/Corepack pnpm; own Nx cache/data/TMPDIR; sequential Nx workers with maxWorkers1. Inherited ST_* settings were removed and ST_PREPARED_REVIEW_OUTPUT, ST_PUBLIC_DIAGNOSTIC_OUTPUT, ST_C21_DIAGNOSTIC_OUTPUT explicitly point to each run's outputs. The unchanged diagnostic redirect helper is hashed. Raw first.log files retain existing startup warnings; no output was filtered or overwritten.

Each run records PID/group, child exit, manifest identity, post-run source check and absence of its owned process group. External180-second owned-group caps did not fire. RESULTS.json contains exact counts/exits; EVIDENCE-SNAPSHOT.json hashes commands, logs, identities and report.

No full suite, build, cost measurement, GC,130k restoration, author A/B or retention/root/invalidity replay. This is bounded current R2 qualification, not release or general architecture acceptance. Main retains composition authority.
