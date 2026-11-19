# Bounded recipient-enrollment correction — frozen for independent review

Exact C12 base manifest: `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2` (3,053 paths verified before copying and again at freeze).
Frozen candidate: `candidate/`; `SNAPSHOT-ENROLLMENT.json` SHA-256 `ae2d5bb7b2be7fe06cadc5bd09c1bba531ca9e305739ca2d06fad238cd5b4378` (3,054 paths).
Runtime patch: `runtime.patch`, SHA-256 `1636a26aa6257c248f416f98f120ebbda9c7d24069d24f9663c51362c9843fa2`.
`FROM-C12.patch` includes the two runtime files and one new nine-case spec; `tests.patch` is separate. Applying the complete patch to clean affected C12 files reproduced all frozen changed hashes. Existing source/spec fixtures and ratchets are otherwise unchanged. No root writes, foreign scratch edits, composition, activation, equal-whole admission changes, or scalar fallback repair.

## Mechanism under review

`experimental-publication/lifecycle.ts:266`: an exact native requirement prevents missing recipient declaration ownership alone from creating an artificial recipient authorship window. Missing native evidence still creates that window; unobserved origin, invalid attribution, uncaptured updater input, incomplete declaration frames, and recipient domain uncertainty remain represented. The nonmatching recipient's initial proof preserves its actual uncertainty rather than forcing unknown solely for channel mismatch. The existing private composition still combines this proof with the live native requirement and complete selected occurrence support; no native D/I/V/W, readiness, activation, validation, terminal role, or ordinary support computation is removed.

`lifecycle.ts:311`: `hasDeclaration(channel, revision)` reads a preparation-time, revision-local `declared` flag set only by matching channel frames. It grants nothing by itself: the existing proof/readiness/currentness checks remain required. No declaration receipt or frame is assigned to other recipients.

`private.ts:449`: clean source proof alone is no longer sufficient for declared early admission. That route additionally requires the matching declaration flag. A nondeclaring recipient uses the existing ordinary admission callback and its surviving grant; existing `allowed`, `admit`, and `started` consume the private decision/grant normally. Acquisition `fact.clean` remains unchanged. Native requirement and scalar legacy projection implementations are unchanged.

## Executed evidence

Every run has `COMMAND.json`, `SOURCE-BEFORE.json`, `RESULT.json`, and raw `first.log`. Commands use pinned Node 24.15.0, pnpm 10.17.0, Nx, isolated cache/data/temp directories, and unset `ST_PREPARED_REVIEW_OUTPUT`. No bare Vitest, builds, or full suite. The runner was extended to hash the added fixture before baseline comparisons; initial candidate discriminator/source-type runs tracked all baseline paths, and the added fixture's content is preserved in the freeze. No runtime changes occurred after the first test run.

| Run | Actual result |
| --- | --- |
| `runs/original-enrollment` | Original 16 pass, including the six decisive before/during/updater enrollment cases and surviving-basis assertions |
| `runs/discriminators` | 27 pass: nine new controls plus unchanged native admission, footprint, aggregate-input and entity-input controls |
| `runs/uncertainty-horizon-retirement` | 16 pass across four unchanged uncertainty, horizon, terminal-consumer and proof-retirement files |
| `runs/source-types` | Pass |
| `runs/spec-types` | Pass, ratchet unchanged; reported three pre-existing improvements |
| `runs/retained-first-failures` | 11 fail / 3 pass; classification below, not an acceptance pass |
| `baseline/runs/original-six-plus-new-product-controls` | Exact C12 runtime: original six and the new progress/no-permission-transfer case fail; 12 pass, six new internal controls filtered |
| `baseline/runs/retained-first-failures` | Exact C12 runtime: 3 fail / 11 pass |

The new product controls assert useful delivery, not only absence: a declared source installation delivers to the other recipient under surviving basis, a subsequent unscoped write still waits for its foreign window, a whole projection retains an untouched pending destination owner, and already-enrolled recipients wait through an enclosing horizon and its invalidation until the owner settles. Additional internal controls keep each genuine uncertainty cause and missing-native fallback unknown; explicit activation before parent close still cannot finalize the native requirement, and parent error is observed upon close.

## First failures retained, not repaired or relabeled as passes

Three failures reproduce on both baseline and candidate:

1. `native-certificate-successor.spec.ts`: scalar parent invalidation with late enrollment leaks via the existing legacy fallback. This arm remains unsafe on that known witness. Tesla's separate source-support correction is required and has NOT been incorporated or independently assumed correct here.
2. The private composite-readiness fixture omits native activation. Its expectation is unchanged; the new separate control explicitly activates and distinguishes activation from horizon finalization.
3. Retained equal-whole collection restoration still fails. Owner decision is pending; no inference of whole-row reauthoring was applied.

Eight additional failures occur in unchanged `recipient-window-independent.spec.ts`: four mode/outcome cases, two remaining-owner cases, disposal, and later-preparer-owner case. All require the nondeclaring recipient to hold solely for the synthetic recipient window despite complete independent native source evidence; the candidate instead delivers the expected current value immediately through surviving admission. Their exact first failures are retained. They contradict the accepted six-case enrollment progress contract and require Main's explicit test-maintenance adjudication, not silent local rewriting. The one nested-complete-declarations case in that file still passes. Membership parent-invalidation and released-listener controls also pass.

## Required semantic merge and review limits

On composition with the scalar arm, `lifecycle.observeRevision` MUST initialize `declared:false`: observing source facts confers no declaration permission. A textual merge is insufficient. Review the observed fact through `private.allowed`, `admit`, and `started`: no declared fast path, no readiness/current-revision bypass, and actual ordinary admission must record surviving basis. Retain wake/retire dependencies for observed facts.

The composed candidate must jointly pass original scalar parent-invalid safety, the original six progress cases, the new no-permission-transfer/horizon/whole-support controls, source/spec types, and relevant observed-fact retirement controls. This report does not infer a composed pass from the separate arms. No four-framework rerun, full kernel, builds, cost qualification, or production acceptance was attempted. Independent review is pending.
