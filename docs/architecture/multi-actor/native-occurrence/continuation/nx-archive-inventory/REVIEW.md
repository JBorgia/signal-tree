# C20 archival Nx discovery inventory and minimal-ignore experiment

**Do not promote this as the observed startup correction.** Minimal `/docs/audits/` ignore preserves project/target names and actual inferred test-file discovery, but does not prevent the reported archive-tsconfig scan. Archived configs currently create **zero independent inferred Nx projects**. The warning is emitted by vite-tsconfig-paths while Nx loads live React configurations, not evidence of an archive being interpreted as a live project.

## Exact before / after

Source is an isolated copy of frozen /private/tmp/st-native-combined-c20/candidate; all manifest files verified while copying. The sole candidate edit is .nxignore: retain .angular, add an explanatory comment and anchored `/docs/audits/`. No root edits, no tools/experiments or docs/research exclusion, no test/config discovery patterns edited. Candidate/patch are frozen as a reviewed experiment, not an accepted fix.

Both graph runs use installed @nx/devkit createProjectGraphAsync, with NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, fresh independent Nx data/cache/temp directories, pinned Node24.15.0 and pnpm from C20. Exact commands/environments and raw graph/log outputs are in before/ and after/. No elapsed-time claim is made. See PROJECT-CONTRACTS.md for the ten projects and non-atomized targets. **Complete exact names/target lists** are before/projects-targets.json and after/projects-targets.json; complete target configurations are in raw graph.json. They compare equal, including options and configurations, not merely target counts.

Ten projects: @signaltree/source, angular, demo, demo-e2e, held-continuation-probe, kernel, react, react-reference, solid, vue. All explicit project contracts were separately inventoried in EXPLICIT-PROJECTS.json. No project root under docs/audits before or after. All package build/test/lint/publish, demo/e2e, root tooling and held-continuation-probe targets survive.

Vitest's inferred per-file targets are equal before/after: 1574 target occurrences across projects, not 1574 unique test files or executed tests. Exact lists in before/discovered-test-targets.json and after/discovered-test-targets.json. They include the same two archived specs inferred under the root project's broad include. Installed @nx/vitest uses createVitest(filesOnly:true) and getRelevantTestSpecifications with tinyglobby; it does not use .nxignore for that discovery. Root and all package Vitest include/exclude/config bytes and test-source bytes remain unchanged. No tests or builds executed; this is actual graph/test discovery evidence, not behavior validation.

## What archives do contribute

Archive has four tsconfig.json fixtures: workflow-adoption/{outbox,draft} and unknown-dynamic-access/{review,artifact-consumer}. No archived project.json, package.json, Vite/Vitest/Playwright/Rollup project config was found. A saved semantics-current-vitest.json is an output artifact, not a plugin config.

The before root project has static edges to react, vue and solid solely contributed by archived TypeScript fixtures. The broad archive ignore removes those three edges. All other dependency edges are unchanged. Exact removals in DEPENDENCY-DIFF.json; Nx file-map provenance in ARCHIVE-EDGE-SOURCES.json identifies reconciliation/k2-fixture.ts and artifact-consumer/{react,solid,vue}.ts. This is a real graph change and is not hidden by equal project/target names. It may be desirable to remove stale evidence coupling, but is distinct from fixing plugin startup and requires review of affected/cache behavior.

The root Vitest configuration still contributes two archived specs to inferred test-ci targets (the explicit root `test` target itself is a no-op echo):
- docs/audits/2026-10-17-incumbent-readiness/runtime-boundaries/compound-compensation-retry-readiness.spec.ts
- docs/audits/2026-10-17-incumbent-readiness/unknown-dynamic-access/st-unknown-access-original-typing.spec.ts

Ignoring their source files from Nx while retaining their Vitest discovery creates a cache/affected tracking concern. No stale-cache execution was attempted or demonstrated. Root no-op test target and the inferred test-ci / archived per-file target input configurations are preserved in ROOT-TEST-TARGET.json. Do not silently waive this concern by excluding those tests or claiming archives cannot affect a target. A config-only archival boundary is not automatically semantics-neutral merely because test discovery remains equal.

## Why .nxignore does not cure the reported scan

packages/react/vitest.config.ts:9 and apps/react-reference/vite.config.mts:31 instantiate tsconfigPaths() without a bounded projects/skip option. Installed vite-tsconfig-paths source selects the workspace root then tsconfck.findAll; its built-in exclusions are .git and node_modules plus any explicit plugin skip. It does not read .nxignore. The installed tsconfck findAll invokes skip with a directory BASENAME, not a full path: a naive exact `/docs/audits/` skip callback would not work, while skipping every `audits` basename is broader than an exact archival subtree.

Before and after logs both contain five tsconfig-paths error reports for the same archived review config extending a vanished /private/tmp/st-unknown-access-candidate path. The observation is unchanged even with clean per-run Nx storage. This disproves the proposed Nx-ignore-only remedy for that warning. It does not quantify how much startup work those scans cause or attribute the reported minutes to them.

## Recommendation / bounded next mechanism

The one-line anchored archive ignore is the minimal Nx directory boundary if Main wants to prevent future archived project configs being inferred; it is preserved in config.patch. **Hold promotion as a startup fix**: currently no such archive projects exist, the real plugin scan persists, and root graph/cache consequences need adjudication. No broader exclusion or dependency override added.

The actual scan seam is the two live tsconfigPaths plugin invocations. A follow-up should bound their tsconfig selection while retaining the real package/demo/tool resolver contracts, then repeat this exact project/target/test-file comparison and relevant alias-resolution checks. Do not suppress errors with ignoreConfigErrors or broadly drop tools/experiments. No additional mechanism is implemented here because it requires determining the actual resolver config set, not guessing from the Nx graph.

## Limits and artifacts

Build/declaration instructions and docs/review-contract.md read. No runtime/declaration/build ownership change, build or release verification. Before/after raw graph builds both exit0; warnings retained. Only .nxignore differs from C20. COMPARISON.json records exact comparisons including the non-equal dependency graph. SNAPSHOT.json/config.patch/FREEZE.json freeze this experiment for Main's review; no root files or external scratch edited.
