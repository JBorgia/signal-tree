# Bounded dynamic-admission repair checkpoint

Frozen for independent review; no integration or general acceptance claimed. Per-unit realization/state changes are not composed.

## Mechanism and scope

The existing scalar responsibility producer is moved unchanged onto the tree-local capture runtime. `PRODUCER-EQUALITY.json` records exact function-text equality. A shared private attachment helper serves initial enhancer traversal and dynamic owned-leaf creation. No provider means no terminal slot reservation. Dynamic attachment checks allocation activity and forwards mutation intent. Partial attachment failures unwind observers and earlier attachments; releases and provider cleanup are idempotent and identity-local. Existing single terminal-owner enforcement remains.

Runtime delta is limited to transactions.ts, intercept-leaf-signals.ts, mutation-capture-runtime.ts, owned-mutation.ts and new scalar-responsibility-attachment.ts. No public API, comparator, entity completion, facade, activation or budget changes. Baseline paths outside the intended delta are checked in UNCHANGED-SOURCE.json. Patch applicability was checked against frozen R3 without applying to it.

## Evidence

Original failures are retained under baseline/ and indexed in BASELINE-EVIDENCE.json. They demonstrate missing prepared scalarAdmission for dynamic/reentrant ordinary members, while the static sibling has a terminal preparer. Production and transparent diagnostics agree; this is not a facade-specific repair.

All runs used pinned tools, Nx for tests, explicit files, one worker and owned bounded process groups. Exact commands and raw output are retained under runs/. Every recorded run reports sourceUnchanged:true and no timeout.

| Run | Result |
| --- | --- |
| kernel-first: unchanged whole-value-new-keys plus minimal static/dynamic pair | 28/28 |
| lifecycle-first: attachment witnesses and unchanged cleanup/admission controls | 28/28 |
| angular-first, react-first, vue-first, solid-first: entire unchanged whole-value-new-keys files | 3/3 each |
| source-types-first | exit 0 |
| public-types-first | exit 0 |
| spec-types-first | exit 1, preserved fixture errors |
| fixture-types-corrected: both added fixtures | 9/9, overlapping prior coverage |
| spec-types-final | exit 0 |

The first spec-type failure contained 13 errors in the two new fixtures: unchecked dynamic installed shapes and literal-zero inference. Original files and compiler output remain preserved. Only fixture installed-shape assertions and explicit numeric type parameters were corrected; behavioral assertions remain. fixture-type-correction.patch records the correction. No API/type-ratchet widening or suppression was introduced. Runtime identity did not change.

Lifecycle witnesses cover absent-provider bare/capture-only trees, one producer per changed write, mutation intent, equal-write behavior, duplicate terminal ownership, atomic initial/dynamic attachment unwind, provider identity-local cleanup, provisional allocation activation/cancellation, and destruction cleanup. These are behavioral tests, not heap-retention claims. Historical archived-tsconfig warnings remain in raw logs.

## Identity and limits

Baseline manifest: e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3.

Final manifest: 905af11731583b81a9690e2fdaf8a2e0cc71fad4d375f0f5ec1d7a944a012816.

Runtime manifest: ed9ba57cef9d7d571215972e05a7752b2ab8af36dc474f0f37ce1fc705613c45.

Runtime patch: 60618b8a84caebf0e22ded45c538d446528577c0e94c9a5280cfa74763870e67.

Tests patch: 4cc9ce95f82a87c95a4584e5ad65b1b995d2b35a880de8b23b2b46eed9828b27.

No observed blocker in this finite selection. Independent source review remains required. No full suites, builds, cost/performance tests or release verification were run. This packet addresses the three kernel and four framework dynamic-admission failures; it does not dispose of other full-characterization failures or incomplete large tests.
