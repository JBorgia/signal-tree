# Bounded diagnostic reduction — artifact reduction verified; release gates still fail

Base: frozen combined source 89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84. Candidate manifest b4d66da31a7927e0d255add68c424b50a99b8ece3a21a594f6ef2ecb57c982e6, 3,121 files. Production and all predecessor source remain unchanged.

## Changes and contracts

The predicate-churn warning implementation is a private factory, lazily created once per collection inside the existing development guards. Original shared where/find state, thresholds, windows, message and query-cache behavior are preserved. The wrong-method development guard precedes its private hint lookup and lazily initializes its per-collection warning Set. Numeric bracket routing and ordinary/symbol/accessor reads retain their original path. The message constant selects one frozen object directly; its former two branches aliased that same object. Removing incidental process/environment/flag reads is intentional, not universal side-effect equivalence under instrumented globals.

The folding gate now includes ST2026. It failed against unchanged predecessor artifacts before any runtime repair; the successor passes. No global console stripping, package sideEffects override, public export, error-message removal or budget change.

## Executed checks

- Original diagnostics: 18 passes before and after. Three added flag-transition/accessor/message cases pass on both arms; 21 unique successor Nx cases, not repeated counts.
- Source and spec types pass with unchanged ratchet. Graph-backed affected lint passes, zero errors and seven existing warnings; no skipped module-boundary rule.
- Five canonical package builds pass. The folding gate and its mutation/self-tests pass; built guard consumers for all five facades retain development warnings and readable required errors, with production advisories removed under explicit ngDevMode=false.
- Nine paired message environments (18 arm executions) preserve exact keys, values and Object.freeze. Four separate accessor observations show the intentional removed environment reads. First host-context getter fixture failure and its corrected actual-globalThis version remain preserved; independent review reproduced both.
- Fresh tarballs installed from a copied local npm cache: 188 packed files match installed bytes, all 25 shipped declaration files match the preceding candidate exactly. Same 20 logical entity/lifecycle/receipt cases pass installed and production-bundled; separate no-Link useful transaction and facade-identity controls pass. No multiplication across routes.

## Fresh matched artifact measurement

Node24.15.0, pinned esbuild, exact saved budget entry shapes, browser ESM/minify/treeShaking, gzip level9, explicit ngDevMode=false only for production. Both arms freshly consumer-bundled from identified canonical package builds in measure.mjs. Raw outputs, metafiles and MEASUREMENTS.json are retained.

| Fixture | Baseline gzip bytes | Candidate gzip bytes | Delta |
|---|---:|---:|---:|
| Bare production | 18344 | 18267 | -77 |
| Bare development | 20745 | 20648 | -97 |
| Entities production | 44764 | 43953 | -811 |
| Entities development | 47756 | 47629 | -127 |

Independent artifact review rehashed graphs and reproduced all eight gzip counts. Production no longer includes the warning factory, allocated diagnostic state or hint table; a dead uninitialized local binding remains. Development still contains the diagnostics. These are whole-output results for these fixtures, not per-module gzip, CPU, heap or universal application savings.

All four unchanged absolute bundle ceilings still fail. The production demo first run aborted in node.napi.node native allocator cleanup (pid56375); exact crash evidence and source identity are preserved. The unchanged unsandboxed repeat completed bundle generation and failed the initial-size error budget: 682.62 kB against 570 kB (warning threshold 525 kB). Its result records sourceUnchanged=true; this is a budget failure, not a TypeScript/compiler error. Earlier point-work and large-workload failures remain separate. No full suites, broad performance campaign, activation, merge, push or release.

## Evidence and limits

runtime.patch and qualification.patch isolate changes. Exact commands/environment/source hashes are in runs and top-level artifact records; declaration/installed agreement is ARTIFACT-AGREEMENT.json. Temporary graph lint launcher is preserved as lint-executed.cjs outside candidate. A publisher-runner invocation initially stopped before execution because its manifest was not yet written; it ran successfully after source freeze. Neither fixture/setup failure was counted as a product failure or mutation kill.

Independent premise, implementation and artifact reviews are in /private/tmp/st-c28-r3-diagnostic-reduction-premise. All 3,121 manifest files were independently rehashed after the demo repeat and remain unchanged. Final independent review verified all 3,121 source files, 192 artifact hashes, five tarballs, all 188 packed/installed files, unchanged declarations and matching case records. No bounded blocker was found; failed release budgets remain. This does not establish release readiness.
