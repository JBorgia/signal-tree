# C11 targeted counterpart verification

All five sequential gates passed: source types, spec types, React 3/3, Vue 3/3, Solid 3/3. Each framework ran exactly one counterpart file (nine tests total), through its Nx target including target type checks. No skipped or failed counterpart tests.

Input: `/private/tmp/st-native-combined-c11/SNAPSHOT-COUNTERPARTS.json`, SHA-256 `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`. All 3,045 manifest entries matched before and after every gate and at completion. Compared with promoted C10, only the approved kernel whole-value oracle file and three counterpart files differ; runtime is identical. No source edits were made.

Environment: Node v24.15.0, pnpm 10.17.0, root node_modules with matching lock SHA-256 `5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`. ST_PREPARED_REVIEW_OUTPUT unset. Nx cache bypassed, daemon disabled, owned cache/log locations. Commands ran sequentially from `/private/tmp/st-native-combined-c11/candidate`:

```sh
corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-all.json
node tools/check-spec-types.mjs
corepack pnpm nx test react --skip-nx-cache parent-freshness-counterparts.spec.tsx --maxWorkers=1
corepack pnpm nx test vue --skip-nx-cache parent-freshness-counterparts.spec.ts --maxWorkers=1
corepack pnpm nx test solid --skip-nx-cache parent-freshness-counterparts.spec.ts --maxWorkers=1
```

The existing archived-fixture tsconfig-paths EXTENDS_RESOLVE diagnostic recurred in the React log: the archived audit configuration references missing `/private/tmp/st-unknown-access-candidate/tsconfig.typecheck-all.json`. It did not prevent target execution or passing tests. Raw output remains intact; nothing was suppressed or repaired. Spec types reported three existing ratchet improvements; no baseline update was made.

This establishes targeted corrected-counterpart composition, not full framework acceptance. No kernel, Angular, build, or full framework suites were repeated. Main's reported 26 kernel oracle passes were not rerun here. C10's six React and eight Solid failures remain preserved in `/private/tmp/st-c10-promoted-framework-verification/RESULTS.md` and its first logs; this run neither erases nor adjudicates them.

Evidence: `COMMANDS.json`, `BASE-VERIFIED.json`, `FROM-C10.json`, `FINAL-VERIFICATION.json`, `SUITE-SUMMARY.json`, and `runs/<gate>/first.log` with command/result records. No failed gate required a retry.

Final disposition: verification complete; no further tests pending authorization for the next bounded repair. Main reports its separate full-kernel run was canceled incomplete after 18m14s and confirmed the absent regression. This is coordination context supplied by Main, not a completed kernel result from this verification. Main also confirms all source unchanged.
