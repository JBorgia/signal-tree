# Permanent test routing proposal — no implementation

Recommend archiving only the two paired-recording diagnostics, keeping them executable and typechecked, and giving the unchanged forwarding GC probe its own nine-mode registered gate. No runtime, assertions, GC rounds, thresholds, or budgets change. No candidate was edited and no tests were run for this proposal.

## Evidence and classification

C10's `REPORTED-FAILURE-GROUPS.json` describes reported groups from an interrupted run, not completed suite totals. The two diagnostics account for 12 and 16 reported failures. On C11 their explicit replay exits zero with 28 unique records (seven modes × two routes × observe on/off). `EXTRA-ENV.json` supplies `ST_OBSERVATIONS`; the generic COMMAND.json alone does not capture that variable. These tests assert the initial value and empty sent list, then catch rollback errors into the record. Therefore 28 passes mean setup/recording completed, not that the recorded later values/errors satisfy a semantic contract.

The forwarding probe has substantive assertions: positive/negative GC controls, closed continuation non-replay, receiver/error collection, intentionally retained operation value, and eventual release. All nine C11 arms/scenarios pass with `NODE_OPTIONS=--expose-gc`, explicit mode and unique output. The original missing-GC/mode failure is an invocation failure, not leak evidence. Keep its original fail-without-GC/mode behavior.

## Exact proposed archive route

Move, preserving test bodies/assertions and changing only relative imports:

- `packages/kernel/src/lib/native-netzero-diagnostic.spec.ts` → `tools/experiments/native-publication-diagnostics/native-netzero-diagnostic.replay.ts`
- `packages/kernel/src/lib/native-equal-inverse-diagnostic.spec.ts` → `tools/experiments/native-publication-diagnostics/native-equal-inverse-diagnostic.replay.ts`

The `.replay.ts` extension matters: root `vitest.config.ts` also includes `**/*.spec.ts`; moving unchanged `.spec.ts` names outside the package alone would not exclude root discovery. Preserve original sources/hashes and first logs in the archive record. Do not convert either to skip/xfail or silently make its output optional.

Add exactly:

1. `tools/experiments/native-publication-diagnostics/replay.config.ts`: root at repository root; use kernel's existing aliases, happy-dom, `__DEV__`, globals and esbuild settings, but **replace** discovery with the two exact `.replay.ts` paths. One worker, file parallelism off. Do not merge the ordinary include array into this config.
2. `tools/experiments/native-publication-diagnostics/run.mjs`: create a fresh per-run output directory; set absolute `ST_OBSERVATIONS` to a new JSONL file; invoke installed Vitest using the pinned Node via `process.execPath` and `node_modules/vitest/vitest.mjs`, `run --config <replay.config.ts>`; preserve raw output, command/env, source hashes and exit status. Fail for runner failures, missing output, duplicate/missing mode-route-observe records, or an incomplete 28-record matrix. Those are **replay completeness** checks, not assertions about the recorded semantic outcome. Never reuse an old append sink to make an incomplete run look complete.
3. `tools/experiments/native-publication-diagnostics/README.md`: provenance, exact replay command, meaning/limits, paired observe variants and retained first-failure references.
4. `packages/kernel/project.json`: explicit uncached `diagnostic-replay` nx:run-commands target invoking that runner. It is not a dependency of ordinary `test`. Command: `pnpm nx run kernel:diagnostic-replay --skip-nx-cache` (runner prints its fresh artifact directory).
5. `tsconfig.typecheck-specs.json`: add the two exact archived `.replay.ts` paths to `include`. Existing checker accepts diagnostics for arbitrary included TS paths. Neither old file has a ratchet entry; keep `tools/spec-type-baseline.json` unchanged. This preserves compiler coverage despite moving outside `packages/*/src`.

No new semantic acceptance gate for these diagnostics. Existing substantive neighboring tests stay in ordinary discovery. If specific recorded observations are later promoted, give them independently reviewed assertions; this routing does not do that.

## Exact forwarding retention route

Keep `packages/kernel/src/lib/forwarding-retention-probe.spec.ts` unchanged in place. Satisfy the explicit THREE-place rule in the kernel config:

1. `packages/kernel/vitest.config.ts`: add only `**/forwarding-retention-probe.spec.ts` to its named GC exclusions.
2. `packages/kernel/vitest.retention.config.ts`: add only `src/lib/forwarding-retention-probe.spec.ts` to explicit includes.
3. `tools/verify-gates.mjs`:
   - Preserve existing `retention-gc`, its env, and its Link disposal mutation. Give its command explicit positional filters for its **three existing files**: `src/lib/internals/diagnostics/diag-journal-1-eviction.spec.ts`, `src/lib/link-lifetime.spec.ts`, `src/lib/internals/location-runtime-retention.spec.ts`. Otherwise adding the new include would make that old gate invoke an unconfigured probe.
   - Register `forwarding-retention-gc`, command `node tools/check-forwarding-retention.mjs`, `env: { NODE_OPTIONS: '--expose-gc' }`. Covers only the nine original forwarding collectibility fixtures and their controls. No build prerequisite, release-only deferral, or automatic skip.
   - Clarify `test:all.covers`: ordinary suites; dedicated retention gates and diagnostic recording replay are separately routed. Keep its command and existing React mutation unchanged.

Add `tools/check-forwarding-retention.mjs`: fixed 3×3 matrix (`hold-proceed`, `drop-proceed`, `hold-value` × `success`, `skip`, `caught`), sequential fresh Vitest processes. Each child runs `run --root packages/kernel --config vitest.retention.config.ts src/lib/forwarding-retention-probe.spec.ts --maxWorkers=1`, with `NODE_OPTIONS=--expose-gc` propagated to workers and explicit ST_GC_ARM / ST_GC_SCENARIO / fresh ST_GC_OUTPUT. Use installed Vitest and pinned Node; no fetch. Keep all nine logs/results and fail the aggregate on any failed/unexecuted child, missing/mismatched artifact, or incomplete matrix. Do not offer a partial-matrix mode under the registered gate. Preserve existing 12 held/12 released sampling rounds and all assertions unchanged. Never pass `--passWithNoTests`.

**Additional discovery trap:** root `vitest.config.ts` has its own broad spec glob and does not inherit kernel exclusions. Add an exact forwarding-probe exclusion there too, retaining Vitest's default exclusions (spread `configDefaults.exclude`). The three-location rule is necessary but not sufficient for that separate entry point. This narrow extra exclusion makes the routing honest for root discovery too; it does not claim to fix root routing of other pre-existing GC specs.

## Mutation implications and acceptance of routing

The existing Link disposal mutant does not prove the new forwarding matrix. Give `forwarding-retention-gc` its own mutation on the **probe**, not permanent runtime source:

- File: `packages/kernel/src/lib/forwarding-retention-probe.spec.ts`
- Exact find: ` tree.destroy();await flush();`
- Replace: ` tree.destroy();Object.assign(box,{__gateRetainedTree:tree});await flush();`

This deliberately holds a destroyed tree through the sampled lifetime; the unchanged tree WeakRef assertions should fail. It tests actual retention detection rather than injecting an unconditional false assertion. The gate's existing apply/run/finally-restore/hash verification must restore the probe. This mutant is proposed, **not executed or proven**. Do not borrow `provenBy` from the old retention gate. If the mutant survives or the new runner is unproven, routing acceptance remains blocked; no budget relaxation.

After authorized implementation in a new disposable checkout, narrowly verify: ordinary discovery excludes exactly the three rerouted files; replay executes both paired matrices with 28 unique records; all nine GC modes execute and pass; original three retention files still run through `retention-gc`; forwarding and existing retention mutation checks fail for the intended reasons and restore bytes; affected source/spec types pass. Run no mutation check against a frozen candidate. No full-suite acceptance follows from these checks.

## Remaining reported failures

`REPORTED-DISPOSITION.json` keeps every original group and its reported counts. The separate effective-presence successor replays absent-collection successfully but is pending independent review; Main's approved C11 equality-oracle replay is separate evidence. The other twelve reported groups are unsupported by this routing task and remain unresolved here, not passed. Diagnostic replay does not adjudicate its recorded outcomes. Unreported/unexecuted remainder of the interrupted full run has no verdict. No totals or clean full-kernel claim are inferred.
