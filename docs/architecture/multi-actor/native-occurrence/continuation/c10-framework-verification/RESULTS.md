# Exact C10 promoted verification — completed, not green

Manifest SHA-256: `de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4`. All 3,042 listed files verified before testing, after every command, and finally: zero differences. Candidate: `/private/tmp/st-native-combined-c10-promoted/candidate`.

| Gate | Result |
| --- | --- |
| Source types | pass |
| Spec-types ratchet | pass; no baseline update |
| Angular | 281 passed / 3 skipped; 48 passed files / 1 skipped |
| React | 85 passed / 6 failed; 15 passed files / 1 failed |
| Vue | 212 passed; 32 files |
| Solid | 115 passed / 8 failed; 18 passed files / 1 failed |

React and Solid each completed their target TypeScript precheck before running tests. The Angular skips are the existing opt-in RUN_TIMING benchmark suite; no skip/xfail added.

All 14 behavioral failures are in the existing React/Solid absent-collection tests: after row-adding reactivation, the whole-tree snapshot contains an empty collection wrapper while the direct collection reader contains the new row. Both enhancer orders reproduce them. Solid additionally fails the tap-driven re-add case. The first failed checks occur before undo/rollback where those are named in the test. Exact names, assertion lines and expected/actual traces are retained in FIRST-FAILURES.md, SUITE-SUMMARY.json and the raw first logs; no repair/root-cause attribution is claimed.

Non-fatal tsconfig-paths diagnostics report an archived audit tsconfig extending a missing old temporary path. Tests proceed; this diagnostic is separate from assertion failures and was not suppressed. Routine color/npm configuration warnings are also preserved.

Environment: Node v24.15.0, pnpm 10.17.0, existing root node_modules, matching lock SHA-256 `5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`. ST_PREPARED_REVIEW_OUTPUT explicitly unset. Commands execute source-types → spec-types → Angular → React → Vue → Solid sequentially. Framework targets run through Nx with --skip-nx-cache --maxWorkers=1. No kernel target, builds, installs, source changes, test edits or reruns. Nx caches/logs are in this verification directory.

Scope is the promoted suite inventory. Separately preserved, unadjudicated private-hook framework falsifiers were not added, deleted, weakened or resolved here. These results are not release acceptance. COMMANDS.json and per-run COMMAND.json retain exact argv/cwd/environment; first.log retains all first failures. FINAL-VERIFICATION.json attests unchanged input.
