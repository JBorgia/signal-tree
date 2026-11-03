# C12 independent type and framework verification

**All requested gates passed.** This is exact-source verification, not release acceptance or closure of the pending enrollment classifications.

Verified SHA-256 of `/private/tmp/st-native-combined-c12/SNAPSHOT-C12.json` against the supplied `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2`. Verified every one of its **3,053 entries**, copied them into this directory, and verified the copy. Rechecked every manifest-listed file after each gate, and both original and copy after completion: **unchanged**. No test/source edits, fixture changes, retries or weakened assertions.

| Gate | Result |
| --- | --- |
| Source types | Passed |
| Spec-types ratchet | Passed, ratchet unchanged |
| Full configured Angular suite | 294 passed, 3 skipped; 50 files passed, 1 skipped |
| Full configured React suite | 94 passed; 17 files |
| Full configured Vue suite | 215 passed; 33 files |
| Full configured Solid suite | 126 passed; 20 files |

Framework total: **729 passed, 3 skipped**. Angular's skipped file is the existing opt-in `kernel-comparison.benchmark.spec.ts`, gated by `ST_PERF === '1'`; this review did not enable timing benchmarks. Test discovery/exclusions are the unchanged configured project targets. React/Vue/Solid targets also run their spec TypeScript checks before Vitest.

## Commands and environment

Executed sequentially, in the table's order:

```
corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-all.json
node tools/check-spec-types.mjs
corepack pnpm nx test angular --skip-nx-cache --maxWorkers=1
corepack pnpm nx test react --skip-nx-cache --maxWorkers=1
corepack pnpm nx test vue --skip-nx-cache --maxWorkers=1
corepack pnpm nx test solid --skip-nx-cache --maxWorkers=1
```

Actual versions verified: **Node v24.15.0 / pnpm 10.17.0**, matching C12 pins. `ST_PREPARED_REVIEW_OUTPUT` was unset for every gate. Nx daemon/plugin isolation/TUI disabled; caches, workspace data, temporary directory and npm cache are under this review directory. Dependencies are read through links to the previously working private dependency tree, with matching lock hash and private command shims. No installation or package-source edit was performed.

Each `runs/<gate>/` preserves exact command, full first log, before-source hashes and result including unchanged-source verification. `ENVIRONMENT.json`, `VERIFIED-INPUT.json` and `FINAL-VERIFICATION.json` identify the environment and complete manifest checks. The execution script is `verify.py`.

The existing archived audit tsconfig-extends warning appears in Nx discovery; it did not prevent the successful targets. Routine environment/deprecation messages remain in raw logs. Spec types reports three existing ratchet improvements; the ratchet was not updated.

## Scope

Inspected C12 composition records and its diff against the independently reviewed presence candidate. That delta lists packet-pair indexing, its three tests, reviewed test reconciliation and current-reader guidance; it is preserved in `DIFF-AGAINST-REVIEWED-PRESENCE.json` and `PAIR-INDEX-DIFF.patch`. This verification does not replace Main's independent pair-index review or re-adjudicate those test corrections.

Root HEAD inspected: `628d302dadb082a48c58528651c9088234d0a777`. Its unrelated dirty work was not changed or used as test source. No full kernel suite, builds, demo/browser gates, performance/allocation measurement, or enrollment/occupancy classification was run. C12's earlier 321-test kernel selection remains Main's separate evidence; it is not counted in the totals above.
