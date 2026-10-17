# Selected-B full-suite interpretation

Independent bounded review; no runtime edits. Parent full-run artifacts report 354 B failures versus6 default failures. This is not a count of independent defects. No full sweep classification claimed.

## Demonstrated blocker: inspection participation admitted as ownership

Unchanged `packages/kernel/src/enhancers/devtools/devtools-jump-0-1.spec.ts` pins inspection participation explicitly, independently of whether a transaction callback is currently running. First case44–77 adds a speculative row, then writes scalar n=42 under `{intent:'system',origin:'devtools',participation:'inspection'}` inside the callback. Rejection must remove the row while preserving42. Selected B yields0. Driver preparation uses `active` owner directly (native-ownership-driver-experiment.ts:64), without participation discrimination. Thus physical installation is captured into pending contribution even though the declared participation excludes it.

A second case150–172 writes inspection fields onto a speculative row after callback completion. Rejection must remove that row; B leaves ['a']. Entity preparation uses author() directly (native-entity-ownership-experiment.ts:122) and treats the later inspection as a newer base/dependency. This is the same missing admission distinction at another timing boundary, not proof of a completely independent architecture flaw.

Independent replay: Nx selected-B config, unchanged file,4 failures /1pass. Raw `independent-devtools-b-replay.log`. Two failures above violate actual state assertions. The other two expect incumbent later-confirmed-dependency refusals and require separate capability interpretation; do not conflate successful useful ownership settlement with data-loss failures. Parent `full-default-kernel.json` shows all5 unchanged cases pass; inspected that record, not independently rerun default.

Command (worktree cwd):
PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /Users/jonathanborgia/.cache/node/corepack/v1/pnpm/10.17.0/bin/pnpm.cjs nx test kernel --command='pnpm exec vitest run --config docs/research/b-native-integration/qualification/harness/kernel.config.ts src/enhancers/devtools/devtools-jump-0-1.spec.ts --maxWorkers=2' --skip-nx-cache

Initial sandbox attempt did not execute tests: Nx Operation not permitted, raw independent-devtools-b.log. Approved escalation executed replay. This was not an approval-review rejection.

SHA256:
- spec81f1dbb66ca3396aba4b6fe6c1f8d10e6a53589139924196aa76c68a3e7e32d7
- driver a05b521f48a0400072f91bf33ddc204f03b563989c170a4fa4e91eb64db563fc
- entity module c627f6ee6e6ccdec4c2009e4c25e6367ab4d434a1039ce513712e6f4c91dbbe0

## Other classification cautions

Hard-coded PathNotifier subscription count+3 in enhancer-cleanup.spec.ts is implementation-coupled; B using2 is not itself lost behavior. Direct tests calling incumbent runtime methods cannot execute unchanged under one-authority replacement; classify fixture assumptions separately. However confirmedTurnReader(tree) is exported from internals and history was configured in active-transaction-context.spec.ts:34; its absence is an observation compatibility gap, not automatically an irrelevant private fixture.

Link inbound comparison is useful capability evidence: speculative7 followed by inbound external9; B successfully rejects7 and retains9; incumbent refuses and requires confirmation. Updated test preserves distinct verdicts, checks9 and no outbound7 and ordinary10 useful work. This is not equal settlement capability and should not be used as a matched rejection benchmark. Worker32 Link controls pass from source/log review, not independently replayed here. Two baseline-matching tree-only held waiter failures remain ordinary failures.

Dynamic entity materialization prediction did not reach an EntitySignal in the existing construction contract, including exact8d. Static registry limitation remains latent; unsupported fixture is not an established B mutation bypass. Existing-collection hydration is a different supported route.

## Cost qualification

Full-suite rejection does not invalidate measuring a specifically successful common subset. Both arms must assert the same intermediate and terminal native values, collection order/lifetime, publication observations and pending/terminal outcome for each timed operation; no safe-refusal versus success comparisons disguised as equivalent work. Explain which production obligations are absent (inspection participation, missing observation endpoints and other unresolved failures). Finite matched CPU/heap results can describe those workloads only; they cannot establish production superiority or whole-system equivalence. Actual benchmark script/results were not yet available for independent review here. Capture source/artifact hashes, isolated arms, warmup/repeats, destruction and GC method; distinguish retained-record counts from heap. See docs/performance/measurement-contract.md.

Conclusion: candidate is not production acceptable on unchanged inspection semantics. Focused earlier wins remain valid; no claim that all354 verdicts are defects or that contribution ownership is disproven.
