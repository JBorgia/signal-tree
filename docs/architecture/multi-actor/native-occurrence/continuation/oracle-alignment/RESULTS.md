# Oracle alignment — tests only, runtime remains unqualified

Candidate: `/private/tmp/st-oracle-alignment/candidate`, copied from `/private/tmp/st-row-source-successor/candidate` before editing. Only four existing spec files changed and one independent spec was added. All 943 other baseline package files are byte-identical to the copied source. No runtime correction, Main candidate edit, or SDK integration claim.

## Exact patch and identities

- `oracle-only.patch`: SHA256 `6eb43bc480c57ebce0932997c84f8e40e9f2e66d64b629953635892adace1472` (four corrected spec files plus independent spec).
- `PREREGISTERED.json`: all five test hashes written before execution. Final hashes match; no assertion was changed after results.
- `BASELINE.json` / `FINAL-IDENTITY.json`: complete package baseline and final verification/log hashes.
- Runtime entity-signal.ts SHA256 `a2319dec7f66aa7f33f8a89a27951946553f50771496a3ceaf77ad7590c15ef9`.
- Exact original files in `original-fixtures/`; copied predecessor run archive in `original-runs/`. Original entity oracle first red remains in `original-runs/entity-enrollment-family/first.log`.
- The four original fixtures were additionally replayed unchanged on this same frozen runtime, then the exact preregistered corrected files restored. `original-oracles-replay.log`: 57 passed / 5 failed, exit1. This new replay is not mislabeled as the earlier first run.

## Results kept separate

| Gate | Actual result |
|---|---|
| Six-file aligned union, including unchanged derive/adoption files | 87 passed / 1 failed; exit1 |
| Nine new independent controls | 8 passed / 1 failed; exit1 |
| Focused types for all five changed/new specs | exit0, no diagnostics |
| Four exact original fixtures replay | 57 passed / 5 failed; exit1 |

The type gate extends repository strict spec configuration, including inherited skipLibCheck=true. No new any, ambient declarations, type suppression, or ratchet weakening. This is focused fixture typing, not full source/spec/framework qualification. The first independent Nx startup log retains inherited archived-doc tsconfig resolution warnings; the selected test file actually executed.

## Superseded oracles (four original failures)

1. Combined `row(row()); row(c=>c)` empty-send expectation: now requires adopted99. Isolated same-reference and same-fields identity updater tests still require empty transaction/no send. Both independently passed; subsequent real adoption then rollback proves ordinary7 was not lost. Separate replacement transaction requires x contribution, no pending send, rollback7, and genuine equal-ordinary replacement empty.
2. Explicit branch `{name:'Inspected'}` replacement: now requires supplied name adoption. Adjacent inspection-only age omission followed by name Grace remains byte-identical and passed in this copied runtime. No blanket branch-oracle relaxation.
3–4. Cross-tree immediate send: now require preterminal hold followed by useful post-confirm/post-rejection publication. The independent controls additionally pass pending settled-state checks, exact coherent payloads, no rejected foreign payload, no extra target write, fixed-window exclusion of a later owner (both confirm/reject), and continued hold until both captured owners terminate.

These corrected tests pass. Their passing does not conceal the genuine failures below.

## Genuine failures, assertions preserved

**New rejection-safety counterexample:** `oracle-alignment-independent.spec.ts:26-32`, “branch supplied-name adoption with omission rolls back both to ordinary baseline.” Ordinary `{name:'Ada',age:42}`, inspect name→Inspected, transact branch `{name:'Inspected'}`. The test confirms a captured name change and no send while pending. Rollback restores physical `{name:'Ada',age:42}` (assertion passed), but after flushing the endpoint trace contains `Inspected`; the final forbidden-payload assertion fails. Raw first run: `independent-first.log`. This is not the superseded outgoing-Ada oracle: it is rejected adoption leaking after rollback. No runtime repair attempted.

**Inherited current failure:** `branch-omission-correctness.spec.ts:239-256`, “same-turn removal and reintroduction ends absent at Link.” Ordinary sequence omits age, reintroduces age8, omits age again. Endpoint retains `{name:'Ada',age:8}` instead of `{name:'Ada'}`. Same unchanged failure appears in original replay and aligned run (`aligned-first.log`). No approved oracle correction covers this.

The earlier reported adjacent age42 failure did not reproduce in this source snapshot. The exact assertion remains unchanged and passed; this does not explain or overwrite its historical failure.

## Commands

Cwd `/private/tmp/st-oracle-alignment/candidate`, pinned Node24.15.0/Corepack pnpm. Each Nx invocation used `NX_DAEMON=false NX_ISOLATE_PLUGINS=false` and `--maxWorkers=1 --skip-nx-cache`.

    corepack pnpm nx test kernel --testFile=oracle-alignment-independent.spec.ts --maxWorkers=1 --skip-nx-cache

    corepack pnpm nx test kernel --testFile=entity-egress-footprint.spec.ts branch-omission-correctness.spec.ts link-commit-ordering.spec.ts link-commit-boundary-carrier.spec.ts derive-footprint.spec.ts entity-semantic-transition.spec.ts --maxWorkers=1 --skip-nx-cache

    node node_modules/typescript/bin/tsc -p tsconfig.oracle-review.json

`replay-originals.py` records the exact original replay command and uses finally to restore preregistered files. It should run only when no other test process uses this scratch copy. `finalize-evidence.py` verifies restored hashes, unchanged runtime, exact adjacent age42 body and emits the patch. First logs were never overwritten.

## Prior anchor implementation review — requested handoff

Final report: `/private/tmp/st-anchor-independent-oo7vdnvz/RESULTS.md`.
Fixture patch: `/private/tmp/st-anchor-independent-oo7vdnvz/fixture-only.patch`.
Source/control identities: `/private/tmp/st-anchor-independent-oo7vdnvz/IDENTITIES.json`.

Status: exact collection-binding move independently reviewed; 7/7 focused identity/nested literal-key/cross-tree/standalone-rejection controls passed and focused strict fixture typecheck passed (repository skipLibCheck=true). Main candidate remained untouched. This is implementation review evidence, distinct from `/private/tmp/st-entity-anchor-design-review.md`, and does not resolve all inherited lifecycle failures.
