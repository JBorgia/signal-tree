# Independent lazy-owner review

No bounded implementation blocker found. Main retains integration authority. Fresh review copy only; author/A/B/root untouched. No external review CLI or source transmission.

## Identity

Author `/private/tmp/st-lazy-capture-owner/candidate`; review `/private/tmp/st-lazy-capture-independent-review/candidate`.
All 2967 entries verified against author's actual-authority-controls source manifest before copying and again after testing.
Candidate manifest SHA256: `58f7e3c4d53679da5b4fef9aa4b1f9345a63dd4c27a2f0f8637589b712f34ed9`.
Runtime patch SHA256: `f8725e1f78b17b897a61fceb0c13d42a008165175ef3fafc7b4e1ee259005814`.
Predecessor manifest SHA256: `6630a74c965b1f414eae5105c3eb3bb3ea09ba9b89f57f81149eee52086af1fd`.
Reviewer fixture SHA256: `32536876cb60b4369048d901abad13408d77976e9ab7f9bf05c1cfdf32b54e98`.
See COPY-VERIFIED.json, FINAL-VERIFIED.json, reviewer-tests.patch. Predecessor reconstructed by reverse-applying runtime.patch in a separate copy and verifying all predecessor entries; no frozen edits.

## Commands and raw results

Each run preserves COMMAND.json (argv/cwd/env), SOURCE-BEFORE.json, first.log, RESULT.json and SOURCE-AFTER.json. Runner uses Node24.15.0, corepack/pnpm, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false, fresh ST_PREPARED_REVIEW_OUTPUT. No dependency installation or budget overrides.
Common Nx prefix: `corepack pnpm nx test kernel --skip-nx-cache`; suffix: `--maxWorkers=1`.

| Run | Filters/command | Independent result |
| --- | --- | --- |
| predecessor/runs/original-audit | audit-entity-projection.spec.ts | exit1, 1 failed / 3 passed; reproduced original premature allocation |
| runs/authority | committed-entity-capture.spec.ts entity-field-presence-capture.spec.ts entity-membership-capture.spec.ts audit-entity-projection.spec.ts | exit0, 31 passed / 4 files |
| runs/transaction-authority | transactions.spec.ts native-foreign-disposition-matrix.spec.ts rollback-refusal-scope.spec.ts recovery-handle-0.spec.ts entity-realization-handoff.spec.ts | exit0, 62 passed / 6 files |
| runs/independent-native | lazy-capture-independent.spec.ts link-commit-boundary-carrier.spec.ts pending-footprint-v16-controls.spec.ts | exit1, reviewer probe failed / 15 unchanged tests passed |
| runs/isolated-write-laziness | lazy-capture-independent.spec.ts native-admission-segments.spec.ts | exit0, 4 passed / 2 files |
| runs/final-independent | lazy-capture-independent.spec.ts | exit0, final 2 reviewer controls passed |
| runs/source-types | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.typecheck-all.json | exit0 |
| runs/spec-types | node tools/check-spec-types.mjs | exit1, reviewer fixture optional-result comparison error |
| runs/final-spec-types | node tools/check-spec-types.mjs | exit0, ratchet unchanged |

The first reviewer probe incorrectly asserted no allocation after requesting `byIdOrFail(1).n()`. That access creates bound row metadata and legitimately requests the collection position (`entity-signal.ts:3384`). Original fixture saved as first-reviewer-fixture.ts; first failure/log retained. Moving the write-only assertion before row access passes; a second control explicitly proves row access allocates exactly once. The spec-type failure was TS18048 on the optional spy result length; fixed with `?? 0`, without a cast or baseline relaxation. No runtime edits were needed.

Author first-failure and actual-authority-controls folders copied separately. The earlier author lazy-and-authority run with missing filters is NOT wider evidence. Repeated passes are not extra distinct tests. All runs report unchanged source during execution.

## Source reasoning and executed boundaries

- The two changed call sites still invoke `prepareEntityPublication` unconditionally. Only construction of its optional responsibility capture is gated. `EntityPublicationSource.prepare` still prepares native authority and recipients; its neutral fallback still invokes responsibility when native authority is absent. The patch does not alter either branch.
- `prepareResponsibilityCapture` checks method availability, not whether a callback currently appears active. Thus installed transaction responsibility remains eligible to evaluate pending/foreign owners itself. `transactions.ts:2378` retains its own inspection/restoration/realized and pending-owner decisions. This deliberately does not promise zero allocation for every enhanced tree.
- Owner attribution is unchanged: capture uses collection position, while publication packet owner and ambient metadata retain the owning tree identity. No owner is replaced by a global or foreign active owner.
- `committedEntityObserver` still independently requests the collection position when rich or structural observers need capture. The 31-test authority run executes capture and the original laziness oracle; required capture is not disabled to obtain a pass.
- Reviewer control spies through the real `EntityPublicationSource.prepare`. Bare `setAll` and `updateOne` allocate no collection position yet return nonempty prepared publication records; their optional responsibility callbacks are absent. Explicit metadata demand then allocates once. This verifies publication is still entered and produces work, not merely that values change.
- Transaction run covers ordinary settlement, foreign rekey/replacement refusal and recovery, held refusal, callback-failure recovery handles, getter throws/reentry and continued settlement. The three native-admission controls also passed, including aborted foreign preparation without installing segment/dependency evidence.
- Foreign pending-owner control in link-commit-boundary-carrier passed: a surviving write waits for a foreign pending owner then wakes on rejection. Collection pending-footprint controls passed, including observer installation/removal across pending owners. The cross-tree Link case is scalar; this is not a claim that every dynamic collection-enrollment combination was tested.

No full suite, public API/build/declarations, peer matrix, retention or performance qualification. No integration with placement/scalar corrections was attempted. Exact patch is suitable for Main's bounded integration consideration, subject to its composition gates.
