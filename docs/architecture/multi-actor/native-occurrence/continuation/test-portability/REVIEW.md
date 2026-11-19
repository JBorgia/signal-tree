# Bounded test-only portability overlay

Ready for Main review and later Nx execution. Nothing applied to the shared candidate or repository root. Source is user-designated frozen8bd at `/private/tmp/st-v16-integration-candidate`; this directory has no Git metadata, so commit/branch/dirty status cannot be independently established. All 38 classification inventory SHA-256 values matched before and after preparation.

## Deliverables

- `overlay/`: exactly 13 modified mandatory ordinary specs plus the new helper and kernel helper spec (15 files).
- `before/`: byte-preserved originals of the 13 modified specs.
- `portability.patch`: unified patch, applicable at repository root with `git apply`; additions use `/dev/null`.
- `HASHES.json`: per-file before/overlay SHA-256 plus patch SHA-256.
- `inventory-baseline.json`: all 38 classification baseline identities.
- `check.cjs`, `CHECKS.txt`: cheap TypeScript parse and normalized AST preservation checks.
- `prepare.py`, `package.py`: reproducible overlay transformation and patch/hash packaging.
- `later-nx-command.txt`: prepared focused Nx command for Main/Noether; NOT executed.

## Exact edit rationale

All existing JSON.stringify expressions remain eager call arguments at their original persistence checkpoints, including newline, indentation and Set replacer. No payload read, record argument, assertion, case, cleanup, control, drain or scenario is gated on a sink. Existing append/replace modes are retained. Only missing-output prerequisite throws and filesystem persistence dependence are removed. The six new diagnosticDirectory declarations follow imports.

Paths below are relative to `packages/kernel/src/lib/` and retain `.spec.ts`.

| Spec | Destination change and preserved sensitive evaluation |
| --- | --- |
| rich-source-preparation-boundary | Hardcoded path becomes optional ST_JOINT_PHASE_OUTPUT/preparation-scalar.jsonl; n()/ids() and serialization remain eager. |
| rich-capture-getter-boundary | Optional ST_JOINT_PHASE_OUTPUT/getter.jsonl; armed=false, drain, reads/partial/error and ids() remain in order. |
| rich-capture-participant-boundary | Optional ST_JOINT_PHASE_OUTPUT/participant.jsonl; ids() and serialization still precede expect(seen). |
| internals/causal-runtime/rich-source-completion-boundary | Optional ST_JOINT_PHASE_OUTPUT/completion.jsonl; observed.push and serialization still precede the callback write777, which stays unconditional. |
| recipient-window-review | Optional ST_JOINT_PHASE_OUTPUT/recipient-traces.jsonl; both receipt checkpoints, error projection and native-proof spy preserved. |
| fixed-window-retirement | Optional ST_FIXED_WINDOW_OUTPUT/provenance-${cause}.json; nativeProof evaluation and Set-to-array replacer preserved. |
| independent-dynamic-enrollment | Existing ST_PREPARED_REVIEW_OUTPUT directory becomes optional; independent.jsonl construction guarded, eager record payload unchanged. |
| independent-occurrence-terminal | Same existing optional directory semantics for terminal.jsonl; terminal assertions unchanged. |
| independent-prepared-unit | Remove missing-directory throw; guard existing per-case filenames; all eager record arguments and serialization unchanged. |
| independent-prepared-boundary | Guard existing directory paths for field-order.json, packet-${order}.json and absence-${mode}.json; packet/inspection/value evaluation unchanged. |
| approved-current-obligation | Remove missing-output throw; ST_TWO_HISTORY_OUTPUT remains an optional FILE; all tree, receipt and pending inspection reads retained. |
| public-selected-unit | Remove missing-directory throw; ST_PUBLIC_DIAGNOSTIC_OUTPUT retains order-followup filenames; result and before/after inspection strings unchanged. |
| equal-owner-retention-diagnostic | Remove missing-trace throw; ST_EQUAL_OWNER_TRACE remains an optional FILE; structure recursion, proof/readiness evaluation and forwarding witness unchanged. |

`tools/testing/optional-diagnostic.ts` accepts `(file: string | undefined, text: string, append = false)`. Missing/empty file returns before filesystem calls. Explicit sinks create `dirname(file)` recursively, then append or replace exact supplied bytes. No catch: mkdir/write failures propagate. Callers serialize before entering the helper, so serialization failures remain visible even with no sink. No callback/lazy serialization API was introduced.

`packages/kernel/src/lib/optional-diagnostic.spec.ts` adds three focused tests: missing/empty sinks call none of mkdir/write/append; nested creation and append/replace preserve exact bytes; real mkdir, append and replace failures propagate. Filesystem wrappers call real implementations for positive/error cases. Temporary fixtures are removed in afterEach. These tests have NOT run.

## Verification and boundaries

Executed only cheap source/patch checks:

1. `python3 /private/tmp/st-test-sink-cleanup/prepare.py`: all 38 inventory hashes match; copy 13 originals and generate bounded changes.
2. `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-test-sink-cleanup/check.cjs`: parse all 15 TypeScript files; normalized printed syntax trees for all 13 original specs match after excluding only filesystem/helper imports, six directory declarations, four missing-output throws, sink destination expressions, and the persistence API/mode representation. Payloads, JSON serialization, assertions, cases, comments and sequence remain represented in the comparison. Imports resolve to the shared test-only helper.
3. `python3 /private/tmp/st-test-sink-cleanup/package.py`: recheck 38 source hashes, enforce 15 overlay files, generate unified patch and per-file hashes.
4. `git -C /private/tmp/st-test-sink-cleanup/before apply --check /private/tmp/st-test-sink-cleanup/portability.patch`: passed; no application performed.
5. Read-only search of candidate packages/tools excluding specs found no existing optional-diagnostic reference. Patch adds helper imports only to specs; no production file or export changes.

Existing 16 optional specs, GC/performance/fault controls, runtime, contracts, configuration and budgets are untouched. No heavy tests, types, builds, GC or performance runs; Noether retains the sole heavy slot. Parse/AST checks are not TypeScript checking or runtime qualification.

## Later qualification

Main should check before hashes against the composed target before applying. Use pinned Node 24.15.0 and checkout-pinned pnpm. `later-nx-command.txt` selects the 13 changed specs and the helper spec through the existing Nx runner, unsets the six affected diagnostic sinks plus listed GC/perf/fault controls, and disables Nx cache. Clear any additional ambient diagnostic variables in the broad harness as appropriate; no scaffold or historical directories are required.

After no-sink qualification, repeat completion/getter and repeated-inspection-sensitive cases (approved-current-obligation/public-selected-unit) with explicitly unique diagnostic directories/files, comparing existing assertions and case counts. Run the separate spec-types gate later to qualify cross-directory helper imports. Main owns independent normalization replay and review. No suite pass or release sign-off is claimed here.
