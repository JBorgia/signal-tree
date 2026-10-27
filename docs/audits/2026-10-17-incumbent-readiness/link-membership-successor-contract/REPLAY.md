# Exact replay

Tests were run with Node24.15.0 and Corepack pnpm10.17.0. The isolated checkout is
`/private/tmp/link-membership-successor-contract`, clean at
`2d24966cc457529f876b06d950dd181acb5bfb69`. Its runtime parent is
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`.

```sh
cd /private/tmp/link-membership-successor-contract
git rev-parse HEAD
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/membership-input-contract.spec.ts --testFile=packages/kernel/src/lib/possible-owner-window-contract.spec.ts --testFile=packages/kernel/src/lib/separate-boundary-contract.spec.ts --testFile=packages/kernel/src/lib/publication-independent-isolated-omission-input.spec.ts --skip-nx-cache
node tools/check-spec-types.mjs
COREPACK_ENABLE_NETWORK=0 corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json
```

Expected final baseline: Nx exits1 with28 ordinary passes/53 failures; spec-types
ratchet exits0; source types exit0. The source type result was obtained in FIRST
and reused because only tests changed. Do not infer that later statements inside
a test executed after an earlier failing assertion.

`tests.patch` reproduces the three added test files on frozen2dacae7b without
runtime changes. `tests.bundle` preserves the incremental local commit and requires
that parent. FIRST and REVISED source snapshots/logs are historical; FINAL contains
the exact final pre-execution hashes and logs. SHA256SUMS covers the archived files.

The inherited acceptance files in TESTS.md must remain unchanged in a successor;
this command is the current minimal baseline packet, not their complete replay or
release verification. No dependency install or network access was performed.
