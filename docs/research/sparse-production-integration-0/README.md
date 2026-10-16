# Sparse production integration 0 — rejected checkpoint

This bounded integration is rejected. R3 remains a successful, separately frozen bridge experiment. Its acceptance does not extend to the wider transaction/restoration/Link surface exercised here. No release, API acceptance, fallback retirement, push, merge, tag or publication is authorized by these results.

## Identity and isolation

Baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Dedicated branch: `codex/sparse-ownership-integration`. The final checkpoint is the commit containing this record; obtain its full SHA with `git rev-parse HEAD`. `source-files.json` seals all 12 tested runtime/test/helper files; the commit adds evidence and documentation only after their final verification. First and final source archives and diff patches are inside `evidence.tar.xz`.

The main checkout remained `628d302dadb082a48c58528651c9088234d0a777`, with its preexisting untracked `frontier` preserved. The R3 research checkout remained untouched. `r3-frozen/` copies its exact archived source, receipts, replay and limitations; archive SHA-256 is `632685918a5c576dc0803c36cfb9b9793547d2b7f72d5247c3c181c09e23b876` (4,125,496 bytes). No historical research branch was merged wholesale. The prior owner authorization for complete v16 ordering before callback delivery remains in scope; no v15 changes were made.

## What was integrated, and what failed

The existing public `transactions()` route uses a strict TypeScript port of sparse contribution ownership. Sparse records determine accept/reject disposition and prepare indexed scalar/entity installation. The old compensation planner is not an alternative settlement route. Existing transaction journals remain for lifecycle, history and diagnostic capture. Dead old helpers are still present and cause lint failures: this is not a finished removal of incumbent machinery.

The smallest decisive ordinary-input counterexample is:

```
x = 1
undoable(() => x = 2)
undo()                         // x = 1, no pending transaction
p = transact(() => x = 3)      // x = 3
p.rollback()                   // baseline: 1; candidate: 2
p.rollback()                   // candidate stays 2
```

Restoration's physical scalar installation bypasses terminal responsibility capture. Sparse committed state therefore still contains 2 when the later contribution opens. Rejecting that contribution reinstates an already-undone value. This is ordinary public input, not fault injection. Independent review reproduced it on both first and final source; the root separately replayed it, then added `replay-restoration.mjs` with identical assertions against fresh built baseline and candidate. Baseline exits 0, candidate exits 1; the entity control returns 1 in both.

Entity restoration also exposes native/sparse lifetime disagreement: undo can revive native state while its sparse lifetime remains absent, then redo or later capture throws `Referenced lifetime is absent`. 400 original regressions share that exact throw. The shared error locates an admission boundary; it does not establish the identical causal sequence for every test.

Link provenance, persistence, notifications, inspection/refusal reasons, callback-error recovery, omitted branches and destruction all have preserved red assertions. A single independent inspection-authored write control passes, but does not qualify inspection generally. New recovery tests show a pending removal keeps its native backing through unrelated churn and restores the same held lifetime; they do not establish all restoration dependencies. The adapter deliberately bypasses its reclamation path on restoration-enhanced trees. Review also identifies a missing persistent reclamation-retry queue. Those two remaining source findings were not independently fault-tested here.

No equality guard, second compensation fallback, new SDK argument or broadened mutation-frame architecture was added to conceal these failures. Fixing the paired realization/ownership and event-provenance boundary requires a separately scoped correction, not accepting this checkpoint.

## Unchanged suites and verdicts

| Project | Baseline ordinary pass | Candidate ordinary pass | Candidate fail | Expected failures satisfied (both) | Skips (both) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kernel | 5745 | 5109 | 647 | 12 | 12 |
| Angular | 237 | 227 | 10 | 0 | 3 |
| React | 74 | 64 | 10 | 0 | 0 |
| Vue | 172 | 164 | 8 | 0 | 0 |
| Solid | 104 | 94 | 10 | 0 | 0 |

Candidate kernel includes 11 new public controls: 10 pass, 1 fails. Their unchanged baseline overlay gives 6 pass, 5 fail. Two overlap settlement gains and three obligation-free native churn gains are real; restoration undo/redo remains red. Full baseline counts above precede the new-test overlay.

There are 684 original pass-to-fail identities, plus 11 added identities. All changed original test files are byte-identical between arms. `verdicts.md` and archived `final-integration/verdict-analysis/verdict-diff.json` enumerate every changed identity, source assertion, exact error, hashes and classification. 400 share absent-lifetime admission; 26 change refusal reasons; 4 throw occupancy conflicts; 2 explicitly encode conservative refusal; 4 concern internal retention fixture preconditions; 248 other assertions retain unresolved individual causes. No category is silently converted to a pass. This is exhaustive verdict accounting, not complete causal reduction of 684 failures.

First full snapshot: kernel 5110 ordinary passes, 646 failures, 12 expected failures satisfied, 12 skips. Final retirement wiring repairs the three new churn controls but introduces four unchanged internal retention-fixture failures. These first reds and the seven first-to-final transitions are preserved. One fixture assumes no physical sink; three call a tombstone-only testing helper after automatic forgetting. They remain red, without claiming they independently prove public runtime bugs.

Supplemental matrices use the exact baseline frozen oracle and adapters in BOTH arms, with only runtime selection changed:

| Matrix | Baseline held/violated/unsupported/not exercised/error | Candidate |
| --- | --- | --- |
| Scalar | 25/9/1/0/0 | 30/1/1/1/2 |
| Structural | 135/48/24/0/0 | 135/8/24/0/40 |
| Composition | 28/10/133/0/0 | 28/8/133/0/2 |
| Authority | 0/1/10/0/0 | 0/1/10/0/0 |

Scalar has 9 violated-to-held gains but also 1 held-to-violated, 2 held-to-error and 1 held-to-not-exercised. Structural has 48 gains offset by 40 held-to-error and 8 held-to-violated. Composition's two reduced violations became errors. Unsupported observations remain unsupported, never successful runtime results. See `semantic-matrix.md` and archived traces.

## Types, builds and first failures

Both arms pass normal `typecheck` and `spec-types`. Exact baseline strict library compilation separately reproduces all 11 TS4111 index-signature diagnostics in semantic helper files. Candidate fixes those accesses with brackets, no casts/assertion changes; strict library compilation exits 0. Baseline Rollup reports those same 11 warnings; candidate package builds are successful. These are distinct checks, not a claim that the earlier differential result was already clean.

The mechanical oracle edits trip composition/authority frozen source guards. Those first guard failures are preserved; manifests were not changed. Supplemental execution selects the original baseline oracle in both arms and records every loaded source hash.

Baseline kernel lint passes (with the new test overlay present); candidate lint fails with 3 unused old-settlement bindings and 7 non-null-assertion warnings. No ceilings or lint rules were relaxed. The first capture/port type failure, first public retirement failures and measurement-harness error are archived separately. A wrong-host-pnpm launch failed before tests with EPERM and is recorded as not executed. There was no automatic approval-review rejection in this task. Dedicated GC suites and release/documentation sign-off gates were not run; this checkpoint is rejected, not release-ready.

## Matched artifact and cost screen

Node 24.15.0, pinned pnpm 10.17.0, fresh uncached package and production demo builds on exact baseline and final source. Complete emitted kernel dependency manifests (`measurements/baseline-kernel-files.json` and `candidate-kernel-files.json`) and commands are archived; the initial artifact-hashes.json covers only the identical index.js wrappers. No dependency/budget changes.

| Artifact | Baseline | Candidate | Increment |
| --- | ---: | ---: | ---: |
| Bare production gzip | 11.64 KB | 11.64 KB | 0.00 KB |
| Bare development gzip | 13.99 KB | 13.99 KB | 0.00 KB |
| Entities production gzip | 25.46 KB | 26.13 KB | +0.67 KB |
| Entities development gzip | 28.22 KB | 28.92 KB | +0.70 KB |
| Demo initial | 563.16 kB | 565.74 kB | +2.58 kB |

Baseline package budgets pass; candidate entities exceed 25.6/28.4 KB. Demo's existing 525 kB warning overage is 38.16 kB baseline and 40.74 kB candidate. Bare unchanged does not show an ownership-module leak. The entities fixture does not exercise transactions, so its cost reflects reachable entity/native plumbing, not the full ownership engine. These bundle figures are not a claim of net replacement savings.

`measure-common.mjs` runs the same useful public operation on each fresh built artifact: transact one scalar/row field, verify tentative value, rollback, verify restored value, inspect one change, retry rollback. 30 warmups, 500 measured cycles, 5 fresh processes per arm/workload, alternating arm order, 3 explicit GC calls before/after. Assertions and inspection are included; startup and tree construction are outside timed cycles. No application observers, Link or restoration. CPU is `process.cpuUsage` user+system; wall time is separately recorded.

| Workload | CPU µs/cycle baseline → candidate (median) | Wall µs/cycle baseline → candidate (median) | Post-GC live-process heap bytes baseline → candidate (median) |
| --- | --- | --- | --- |
| Scalar | 64.446 → 65.908 | 28.959 → 31.289 | 7,309,400 → 7,208,352 |
| One field, 32 rows | 91.854 → 155.914 | 42.063 → 78.066 | 7,771,800 → 8,357,304 |
| One field, 1024 rows | 87.644 → 151.874 | 43.053 → 82.057 | 8,128,536 → 11,508,472 |

All 30 samples satisfy the common workload. Repeated same-arm samples and min/max are in `measurements/summary.json`; first wall-only measurement and corrected harness are retained separately. Entity cycles cost more in this candidate. Point-cycle time changes little across these two collection sizes, but that is not an asymptotic proof. Whole-process heap includes V8/JIT/module storage, active tree state and retained runtime records; it is not a dominator-based ownership-retention measurement. CPU can exceed elapsed time because process CPU includes concurrent runtime threads. The harness still holds tree/held references after destroy; heapAfterDestroy is not a reclamation proof. No confidence intervals, production speed claim, equal-capability ranking or general heap superiority is warranted. Production obligations are demonstrably unequal; only this subset is matched.

## Review disposition and next boundary

Independent review's ordinary restoration finding was verified, preserved and accepted as a blocker. No destructive cleanup was demonstrated; untested reclamation retry/restoration-map risks remain explicit. Premise review of the sparse core preceded implementation, but that reviewer then authored the port and is not an independent reviewer of its final code. Final review was performed separately against sealed source and unchanged tests. Independent final interpretation review verified all suite counts, matrix classifications and 30 cost samples; its wrapper-only identity caveat was corrected by adding full dependency manifests.

R3's installation/terminality/publication/reclamation ordering regressions stay in its frozen packet as integration requirements. Passing that packet cannot replace the failed production suite. This experiment supports neither retiring the incumbent nor rejecting contribution ownership as a possibility. Any next correction must cover all physical realization routes and their provenance before claiming one coherent authority. It should retain the public counterexamples here unchanged.

## Replay

From this checkpoint (Node from `.nvmrc`, pinned pnpm from `package.json`):

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=true
corepack pnpm run build:all --skip-nx-cache
node docs/research/sparse-production-integration-0/replay-restoration.mjs "$PWD"
corepack pnpm nx test kernel --run --maxWorkers=2 --skip-nx-cache
corepack pnpm nx test angular --run --maxWorkers=2 --skip-nx-cache
corepack pnpm nx test react --run --maxWorkers=2 --skip-nx-cache
corepack pnpm nx test vue --run --maxWorkers=2 --skip-nx-cache
corepack pnpm nx test solid --run --maxWorkers=2 --skip-nx-cache
corepack pnpm run typecheck
node tools/check-spec-types.mjs
corepack pnpm exec tsc -p packages/kernel/tsconfig.lib.json --noEmit --incremental false
corepack pnpm nx lint kernel --skip-nx-cache
corepack pnpm run build:demo:prod --skip-nx-cache
node tools/check-bundle-budget.mjs
node --expose-gc docs/research/sparse-production-integration-0/measure-common.mjs "$PWD" scalar 500 0
node --expose-gc docs/research/sparse-production-integration-0/measure-common.mjs "$PWD" entity 500 32
node --expose-gc docs/research/sparse-production-integration-0/measure-common.mjs "$PWD" entity 500 1024
```

The restoration replay is intentionally red here. Run the SAME script against a freshly built exact baseline directory by passing that directory instead; it is green. Tests intentionally remain red. Do not use shell `&&` to let the first expected red suppress remaining checks.

For exact original raw runs, extract `evidence.tar.xz` into `/private/tmp/st-sparse-integration-20261016`. First/final `source.tar.gz` overlays apply to an archive of baseline8d. The archived full-logs/run.py, semantic-matrices/run.py and run-measurements.py contain exact commands, tool paths and output names; use fresh output names for matrix replay (existing evidence is protected). The frozen matrix runner uses `/private/tmp/st-sparse-integration-baseline-8d220643` for oracle sources, `SEMANTICS_RUNTIME_ROOT` for runtime and the existing repository's esbuild. Keep those paths or change only path configuration. Do not use its historical `baseline` mode as a substitute for exact8d. R3 has its separate sealed replay.py and original review-failure evidence.
