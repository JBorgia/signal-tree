# Independent row-source admission review and controls

Bounded finding: no blocker demonstrated for the reviewed private admission correction. Corrected independent controls pass 6/6 on the row-source successor; the entity-anchor predecessor fails 4/6 with eight uncaught `Support has no enrolled occurrence` errors. No Main original27 replay or broad suite was run here; those belong to Main. No release/activation or general integration acceptance is inferred.

All writes and test execution stayed under `/private/tmp/st-row-source-independent`. Both input trees and production/root were untouched. Disposable sources have no `.git`; attempted source status reports “not a git repository”, so identity is by file manifests, not an invented branch/commit.

## Exact identity and delta

- Successor input: `/private/tmp/st-row-source-successor/candidate`; copied manifest SHA256 `a801391e26f62d725a99bda9deb1267020482604d67202e810687811fb017b38`.
- Predecessor input: `/private/tmp/st-entity-anchor-successor/candidate`; copied manifest SHA256 `9603fac79e7c39ddd1a28bc1d52c3b02b952258ff954377ba170496ee82332a8`.
- Corrected independent spec SHA256 `2fb4d898962a899945bb5d24031368899f9b059a3ff84cc143802b57dacdf50c`.
- `IDENTITY.json` verifies all 2943 copied source files per tree after runtime execution, with zero mismatches. These are this review's manifests, not Main-issued freeze identifiers. `prepare.py` records copy coverage: retained predecessor manifest paths plus current package TypeScript paths, excluding dependency trees.
- `DELTA.json` and `reviewed-source.patch`: sole copied source difference is `packages/kernel/src/lib/link.ts`, before `6a5f67b2fe97dd276ccf2fef98c231704357125a249aa13d06267c17348fb51f`, after `1e9b0a856eb980edaf0f07afe2d0189b3cdcf2d3e636e33c2faa07cf6c340dc4`.

## Source review: identity enrollment, not permission

Read the approved `/private/tmp/st-row-source-admission-review.md`, contributor/review contracts, the actual delta, native occurrence capture, recipient enrollment, binding implementation and eligibility decision. Conclusions below are source inspection unless paired with a control below.

1. `link.ts:555–563` moves resolution of `ownEntitySource` before `research.bindSource` and includes that binding in `supported`. Existing collection/location/node/root classifications remain. It adds no general callable case, public API or mutable-key lookup. Owned registry and structured-address/entity-location admission at approximately 293–317 remain intact.
2. `experimental-publication/private.ts:350` still enrolls via `RecipientOccurrences.enroll`, and `internals/native-occurrence.ts:25–48` still requires registered root/address, exact own data-property ancestry, final anchor identity and subject-bound source edge. `recipient-occurrence.ts:34–41` still checks issued occurrence, root identity and ancestry. Those files are byte-identical across snapshots. `installFact:151` retains its missing-enrollment error. No readiness-time fallback or proof substitution was added.
3. Publication eligibility remains separately decided by proof state (`private.ts`, `decision`): invalid/unknown/rejected roles and pending owners do not become confirmed by this admission predicate. The two pending controls execute that distinction: pending values are locally readable but absent from row/field endpoints; confirm publishes, rollback never publishes the rejected value, and subsequent ordinary work remains useful.
4. Recipient registration at `link.ts:578–579` still re-reads the binding rather than accepting `ownEntitySource` as an argument. This is not literally one lookup across both stages. For supported source-issued nodes, `defineEntityPublicationBinding` installs a non-writable/non-configurable data property with `Object.defineProperty`; there is no changed identity-producing path between these reads in this delta. No demonstrated blocker from the repeated lookup. This is not a claim that private metadata is an unforgeable hostile-input capability.
5. Field selection still checks `binding.field !== undefined`; empty string is distinct from whole-row selection. Executed row/n/empty-string tests confirm distinct delivery. Subject comparisons and remove handling remain unchanged. Rekey changes the storage key, not necessarily the entity's own `id` value; no new key-to-subject resolution was introduced.

The unbound negative control actively asserts both native capture rejection and Link construction rejection. It is not merely a zero-endpoint assertion. Wrong-ancestry/root and hidden-source capture guards were inspected as unchanged, not independently executed in this new suite; Main's native controls remain separate evidence.

## Executed six controls

1. Simultaneous row, `n` field and empty-string field Links: unrelated row writes deliver nothing; sibling-only edit reaches row only; selected-field edit reaches row plus selected field; empty-string edit reaches row plus empty-string field. Full payloads and counts asserted.
2. Pending transaction then confirm: no early row/field endpoint, exact confirmed values, then exact ordinary delivery.
3. Pending transaction then rollback (rejection): no early/rejected-value delivery, restored local value, then useful exact ordinary delivery. Existing contract does not require zero compensating sends, so no such new assertion was invented.
4. Retained row/field follow the same subject through rekey; removal delivers absence; remove/readd and later writes at reused key do not revive old Links. New subject identity and value independently asserted.
5. Dispose both Links after write but before queued completion: no endpoint call, local write remains, original and subsequent settled waits finish. No uncaught errors in successor run. This is not a GC/retention benchmark or in-flight network cancellation test.
6. Unbound callable fails native occurrence capture and Link construction with owned-source errors; no mutation or endpoint invocation.

All endpoint callbacks only record values. Assertions execute outside callbacks. Trees and Links are disposed in finally blocks. Settlement helper checks resolution after the existing native-address fixture's 120 microtask drain, then awaits the promises; it does not increase timeout or silently bypass a pending wait.

## First failures preserved

- `FIRST-row-source-independent.spec.ts`, `first-candidate.*`: 5 passed / 1 failed. Test incorrectly expected `changeId('a','new')` to rewrite payload `id` to `new`; observed `a`. Existing `entity-signal.spec.ts:2426` explicitly asserts that structural rekey may retain the old stored id. This was a test-premise failure, not a runtime counterexample. Later remove/readd assertions did not run in that first case.
- `first-predecessor.*`: 4 failed / 2 passed, eight uncaught missing-occurrence errors. First synchronous mismatches were unresolved row settlement, with queued `installFact`/`ready` stacks preserved.
- `PREREGISTRATION.md`: original hypotheses and exact correction. Only the rekey payload expectation was corrected to `a`, with an additional `row.id()` assertion. No source change or other assertion weakening.
- `corrected-candidate.*`: exit 0, 6 passed, no uncaught error report.
- `corrected-predecessor.*`: exit 1, 4 failed / 2 passed, eight uncaught missing-occurrence errors. Disposal and negative admission pass on both; those are boundary controls, not discriminators of the patch.

## Commands, types and replay

Each execution has raw `.log`, `.exit`, and `.command.json` containing exact cwd/argv. Runner pins Node v24.15.0 PATH and NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. Dependencies use the input's existing node_modules via symlink. No network source transfer or external reviewer CLI.

```sh
python3 /private/tmp/st-row-source-independent/run.py corrected-candidate corepack pnpm nx test kernel --skip-nx-cache row-source-independent.spec.ts --maxWorkers=1
CONTROL_COPY=predecessor python3 /private/tmp/st-row-source-independent/run.py corrected-predecessor corepack pnpm nx test kernel --skip-nx-cache row-source-independent.spec.ts --maxWorkers=1
python3 /private/tmp/st-row-source-independent/run.py final-spec-types node tools/check-spec-types.mjs
```

Use fresh log names for replay: runner refuses to overwrite evidence. The handoff spec is `row-source-independent.spec.ts`; executable copies are at `packages/kernel/src/lib/row-source-independent.spec.ts` in each disposable tree, using public `../index` plus the explicitly internal native-capture diagnostic. No type casts, public type weakening or baseline changes. `first-spec-types` passed for original spec. Final spec-type result is recorded below. Repository spec-types is a ratchet; a new spec must have zero diagnostics. No runtime source edits were made and no independent source-build claim is made.

Final spec-types: exit 0 for corrected successor spec (`final-spec-types.log`). Existing ratchet improvements only; no baseline update. No separate predecessor type rerun claimed.
