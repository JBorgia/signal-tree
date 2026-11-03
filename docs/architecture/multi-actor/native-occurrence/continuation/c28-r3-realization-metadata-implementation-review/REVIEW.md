# Independent implementation review — exact-attempt realization metadata

**No blocking finding in this isolated frozen repair. Suitable for Main’s bounded composition, conditional on forwarding the same helper at the separate dynamic ingress and qualifying that composition.** Not full compatibility or release acceptance. No source, assertion or oracle changes made.

## Identity and independent execution

Tesla explicitly handed off the freeze before execution. Verified all 3,097 candidate manifest files and all FREEZE hashes; independently verified the 3,095-file frozen R3 predecessor and the exact twelve changed paths (eleven runtime paths plus one new spec). Candidate MANIFEST SHA256 `0ececc2f73a615ecebe88b0d44113cae7555ba1d19beefc4cc53c4acfa1c1061`; runtime.patch `c520ba69f64b2a1593d12d1ec2be9800974ff8a7fde9fceb52ab5e94b9dacdbb`. All predecessor specs are byte-identical. Own copy and frozen input reverified after replay.

Sequential fresh Nx invocations, pinned Node24.15.0/pnpm10.17.0, root installed dependencies, separate caches/temp, 180-second owned-group cap, unchanged tests:

| Own run | Files | Unique cases | Result |
| --- | ---: | ---: | --- |
| runs/original-two-first | 2 | 66 | pass |
| runs/new-controls-first | 1 | 10 | pass |
| runs/publication-controls-first | 5 | 41 | pass |

**117 unique passing cases in eight files; no failures, skips or expected-failure cases in these selections.** Each directory preserves exact COMMAND, SOURCE, PROCESS, RESULT and first.log. All exits0, no timeout, sourceUnchanged. Inherited archived-tsconfig resolution warnings remain in raw logs; they did not prevent selected tests executing. No broad suite, memory or cost experiment. Author’s source/spec type commands/results and raw spec-ratchet output inspected, not independently rerun and not counted as our tests.

## Source conclusions

- `tree-scalar-slot-runtime.ts:205–229` reads the optional flag before callback-capable equality, attaches it to each exact staged mutation and preserves it in the publication spread. Nested ordinary calls construct their own unflagged mutations. Existing stale/reentry checks, phase seal/validate, physical installation, inspection shadow state and completion draining are unchanged. There is no new global context, source-keyed flag, late admission lookup, listener or compensation authority.
- Both neutral and native leaf orchestrators forward the field through **prepareCommit and commit**. Slot port, frame callbacks and commitSlots retain it. Ordinary commitSlotValue has no realized default. The private helper preserves all supplied metadata and mutation intent, overriding only participation for the flagged attempt; it never installs ambient context.
- Terminal ingress (`intercept-leaf-signals.ts:160+`) and selection (`transactions.ts:2876+`) agree on classification. Existing terminal guards refuse realized journal capture; the selection guard declines authored endpoint manufacture for that same attempt. Genuine authored admission still requires the precomputed scalarAdmission and has no permissive fallback. Unchanged endpoint selection, native authorship/support and inspection remain separate.
- All six identified direct producers are covered: four adapter frames plus transaction scalar compensation and restoration scalar compensation. All three adapter member routes and transaction/restoration member bindings explicitly forward the optional argument. Generic member calls retain absence behavior. This is complete for the reviewed realization/compensation inventory, not a claim that every arbitrary private frame should be realized.
- The dedup exemption is restricted to realized notifications. It retains authored installed-operation suppression while allowing actual external realized evidence. Original synchronous and queued ABA and outer A/realized B/outer C tests execute unchanged; the preserved assertions establish useful surviving state, not merely no exception.

## Callback and public/private distinctions

The original stale heterogeneous case injects an authored write through a **private frame.prepareCommit wrapper**. The failed ambient state-repair candidate lost that write’s history; this successor passes the unchanged case, including stale refusal, surviving other write, history increment and no-target-notification assertion. That is a valid private boundary regression and repair; it is not evidence that the injected seam is a public callback API.

The ten new controls directly exercise real neutral/native kernel carriers, both commit routes, same/other-source preparation reentry and thrown undefined equality. Reentry is triggered by proposed value7 independently of the new flag. They assert unchanged context identity, nested authored flags, exact surviving record/value, stale outer refusal and subsequent useful work. The native adapter is controlled test infrastructure, not framework scheduling evidence. The equality count assertion is deliberately coarse; these controls do not prove universal comparer invocation counts. The 41 unchanged publication/current-input/native certificate cases provide distinct pending-support and useful-delivery coverage. No receipt/public-policy relaxation was used.

Author’s first construction/type failures remain preserved. Baseline-controls-first used a test-local helper adaptation and an earlier trigger; its eight failures are transport/fixture discrimination, not eight demonstrated public runtime defects. The original B/ABA and private history failures remain the causal evidence.

## Declaration surface

Independently checked actual public package exports: root, adapter and internals. Archived bundles for those entries match byte-for-byte; reran the bundler in own scratch over copied emitted declaration trees and reproduced all three exact hashes in PUBLIC-BUNDLED-COMPARISON.json. No admissionParticipation occurs in those public bundles. Script uses installed rollup-plugin-dts and resolves local declaration dependencies; it does not hide local files as externals. Public export/barrel/package bytes are unchanged.

The raw 75-file transitive declaration closures are **not** identical: four private declarations differ, with no unresolved relative dependency reported. Do not describe the entire emitted graph as unchanged. Author’s inherited TS4111 declaration-build failures and subsequent scratch-config resolution failures remain preserved; successful scratch emission plus this bundle comparison is not a production package-build pass. We rebundled archived emission, not independently re-emitted TypeScript.

## Composition condition and limits

Main must use `scalarAdmissionMetadata(getActiveWriteContext(), mutation)` at the separate dynamic scalar-responsibility-attachment terminal ingress, preserving this exact mutation and its private flag. Ambient-only reconstruction there would break the agreement between terminal capture and scalar selection. This file is absent from this isolated R3 successor; the handoff is a real composition condition, not a missing patch within the reviewed base. No dynamic implementation was edited or accepted here. Combined ownership/callback/initialization cleanup replay remains Main’s responsibility.

No additional mechanism round is indicated by this bounded review. Retain failed state-repair and first fixture evidence. This verdict does not accept large-gate resources, remaining unrelated full-suite failures, arbitrary public reentry, or release readiness.
