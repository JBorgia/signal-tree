# C20 bounded tsconfig resolver scan successor

Ready for Main review with a dependency-build qualification limit. The actual archive scan is eliminated without .nxignore or test-discovery changes. Only packages/react/vitest.config.ts and apps/react-reference/vite.config.mts change. Exact C20 manifest copied and verified; all other baseline files remain identical after checks.

## Mechanism and preservation

Use vite-tsconfig-paths projects to parse only actual importing projects. React tests select their tsconfig.json and its lib/spec references. The reference app selects its own tsconfig.json (app/spec references) plus the React facade's tsconfig.json because it imports that facade's source. Paths are anchored with fileURLToPath/new URL against import.meta.url, so Nx invocation cwd cannot broaden discovery. Installed plugin follows references/extends. Existing explicit kernel source aliases remain intact, including adapter resolution ahead of the package root alias. No ignoreConfigErrors, skip-directory workaround, inferred config guessing, archived file removal or runtime edits.

RESOLVER-SCOPE.md records installed-source reasoning. config.patch and SNAPSHOT.json identify the exact two-file successor. .nxignore stays exactly `.angular`; the prior archival ignore experiment was not carried over. tools/experiments and every package/demo/tool contract remain visible.

## Graph and discovery proof

Before graph/warnings preserved from the unmodified exact C20 graph run: BEFORE-GRAPH.json / BEFORE-WARNINGS.log. New graph in GRAPH.json and runs/graph. GRAPH-COMPARISON.json compares after normalizing only the isolated checkout prefix:

- All 10 project names and roots identical.
- Complete target definitions, including options/configurations/inputs, identical.
- All dependency edges identical, including root-to-react/vue/solid archive-derived edges that the rejected .nxignore experiment removed.
- All 1574 inferred per-file test target occurrences identical. These are target occurrences, not unique tests or test execution counts. Exact targets in PROJECT-TARGETS.json and DISCOVERED-TEST-TARGETS.json; archived root test-ci fixtures remain discovered.
- Before had five archived-tsconfig error reports; new graph has zero. DEBUG=vite-tsconfig-paths log explicitly records the bounded config paths and referenced lib/app/spec parsing. No archived config path occurs in the new graph log. This verifies scan selection, not merely silenced warnings.

## Executed validation

| Run | Result and scope |
| --- | --- |
| graph | Pass; exact graph comparison above |
| react-tests | `pnpm nx test react --skip-nx-cache --maxWorkers=1`: existing React spec-type check plus 94 tests / 17 files pass |
| reference-tests | `pnpm nx test react-reference --skip-nx-cache --run --maxWorkers=1`: 26 tests / 2 files pass |
| alias-resolution and alias-resolution-no-hmr | Seven actual Vite resolveId assertions pass against exact expected source paths in both configurations; ALIAS-RESULTS.json |
| reference-build | Ordinary Nx dependency build incomplete: kernel build completed; react:build emitted files but child remained alive/idle. Only the verified isolated child was terminated; Nx reports react:build failure, exit130. Raw first log retained. No claim this is a config regression or an established baseline failure. |
| reference-build-direct | `pnpm nx build react-reference --skip-nx-cache --excludeTaskDependencies`: pass; directly bundles actual app and framework/kernel source with changed Vite config. Does NOT replace a successful ordinary dependency build. |

The live alias assertions cover app @signal-tree/react, app @signal-tree/kernel and /adapter, and React facade/kernel adapter imports under both configs. This is useful source-resolution evidence beyond graph generation. The reference-app build and both test targets give real execution/bundling checks.

Standalone alias harness created a Vite middleware server and logged sandbox-denied HMR websocket attempts. Assertions completed and both runs exited0; setting hmr:false in the SECOND harness did not remove the Vite socket warnings. Both logs and FIRST-resolve-aliases.cjs/FIRST-ALIAS-RESULTS.json preserved. This is a harness/server-start limitation, not a clean server-start test. No sandbox permission was requested to open a listener. No production config changed to suppress it.

An interim progress message misidentified the idle Rollup process as kernel; the final Nx log resolves it as react:build. Kernel runtime/declarations completed; React files emitted before termination. The authoritative classification here is the raw final task log. No process outside this scratch was stopped. Unchanged kernel type and circular-dependency warning text remains preserved; it was not repaired or asserted to be a new failure of these plugin settings.

## Freeze and limits

Every run retains command/env, first.log, result and before-source identity; source remained unchanged during all checks. Pinned Node24.15.0/pnpm10.17.0, own Nx/cache/temp and local Vite cache directories. Dependency packages are linked read-only by local node_modules entries; build artifacts stay in this scratch. ST_PREPARED_REVIEW_OUTPUT unset. No root edits, no broad suites, no timing/speed claim, no performance budget or test maintenance.

The configuration mechanism and targeted tests/direct app build are qualified for independent review. Ordinary dependency-build completion remains unqualified; baseline attribution of the idle React build would be separate bounded work. No release/build-pipeline acceptance or composition assumed. Main review before composition.
