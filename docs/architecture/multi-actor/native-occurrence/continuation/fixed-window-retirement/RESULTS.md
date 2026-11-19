# Fixed-window source retirement successor

Frozen for a different reviewer's exact implementation review. Not integrated, independently accepted, activated or release-qualified.

Fresh copy of C1 `/private/tmp/st-native-combined-c1/candidate`, manifest `bac3ad33b8eee7bd0e5851461de9b95fd3144d26e3f6db70d84193a70c76179f`. All 2,974 C1 manifest entries reverified unchanged. Candidate has 2,975 manifest files; three runtime files change and one 14-test file is added. No root or other author edits. Root context HEAD `628d302dadb082a48c58528651c9088234d0a777` was inspected; unrelated dirty work untouched.

Candidate manifest: `05daee5c1db9478e3cdad0bbda8216bbc7f6fd10305622d3c3f2cf895a2bd022`.
Runtime patch: `0c54641f0e4b1ace74d08f9a8bea5faa322cf94db680f5e3382d6a017a35550b`.

## Mechanism

Native preparation records readonly `retirementOwnWindowOnly` provenance only for no explicit unknown cause, no actual known owner, no supplied input and no active declaration frame. Source release never reconstructs this classification from the aggregate unknown bit or cleared input arrays. This deliberately excludes broader confirmed-actual and inherited-input retirement.

Exact OwnerCell subscriptions are private, queued and cancellable. Terminal transitions or source disappearance notify only registered observers of those cells. Disappearance does not settle cells. Registration after terminality covers a subscribe/recheck race; cancellation clears already queued callbacks. There is no global tree scan, fake recipient operation or readiness change.

Source retirement assesses all eight exact-subject map entries. Existing neutral facts remain eligible. A non-neutral fact is additionally eligible only for classified own-W uncertainty with no actual-role, rejected-role, invalid or unavailable lower bound, and only after all its possible cells authentically confirm or successfully roll back. While eligible cells remain pending and registered, the existing installed-forget request retains their exact subscriptions. Unavailable/abandoned or other ineligible proofs stay stored without a dead subscription request. Composite requirements must qualify constituent-by-constituent.

Deletion stays queued behind synchronous completion/reentry and rechecks the original kernel eligibility, exact map snapshots and source revision. Existing retirement updates both source revisions. Issued requirements, recipient snapshots and recovery records are not rewritten; old proof remains unknown/historical even after source entries are removed. Local recovery and actual rejected input controls retain evidence.

The private plan field is now `canRetire` rather than `neutral` because discharged W is not a newly clean proof. INTERFACE-HANDOFF.md specifies this field, owner subscription contract, provenance transfer and merge boundaries with Heisenberg. This patch changes no source sealing, readiness activation, native timing, public API/export or recipient-window classification.

## Independent-review inputs and expectation disposition

Owner instruction authorizes this bounded successor, not broad all-terminal cleanup. The raw policy exception for recipient-only uncertainty is not used to clear source uncertainty. The prior source review and first failures remain in `/private/tmp/st-foreign-owner-retirement-independent`.

All supplied tests remain byte-identical. originals/ archives the original two-failure fixture, pending/naive negative control and historical boundary tests. The original two drain expectations now pass without changes. The historical foreign-callback tests remain retained-proof cases: exact provenance shows rawUnknown=true, retirementOwnWindowOnly=false. They still pass unchanged. New own-W tests explicitly assert terminal-only drain. See TERMINAL-EXPECTATIONS.md; no broader expectation was silently revised.

## Commands and execution

Node24.15.0, pnpm10.17.0. All tests use Nx with skip-nx-cache/maxWorkers=1 and NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false. Cwd is candidate/. FINAL-COMMANDS.json records the final finite selection and exits; run-final.py reproduces it. No ratchet changes.

- baseline-first.log: unchanged C1, **2 failed / 22 passed**. Exactly the confirm/reject negativePresence drain failures; pending hold and terminal useful-send assertions remain reached and preserved.
- first-runtime.log: **24 passed**, same four files, no inherited test edits.
- own-controls-first.log: initial **11 passed**. Later controls added local recovery, inherited unknown and actual rejected input; no newly introduced failure was removed.
- focused-final.log: **109 passed** with the then-current12 new controls.
- final-runtime.log: **110 passed** with13 new controls.
- own-controls-complete.log: **14 passed** including the added actual rejected-input control.
- freeze-runtime.log: final exact source/test selection **111 passed across12 files**.
- source-types-final.log: `corepack pnpm run typecheck:source` passes on final runtime.
- freeze-spec-types.log: `node tools/check-spec-types.mjs` passes after the final added test, with unchanged existing ratchet.
- naive-negative.log and naive-negative-frozen.log: expected **1 failed / 8 skipped**. The unchanged test-only naive-retire injection produces the forbidden early collection send while the foreign owner is pending. This remains a failing negative control, not a suite acceptance failure.

Final finite selection:

```sh
corepack pnpm nx test kernel --skip-nx-cache fixed-window-retirement.spec.ts entity-negative-publication-retirement.spec.ts publication-retirement-acceptance.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts entity-lifetime-ledger-null.spec.ts entity-selection-lifetime.spec.ts subject-reclamation-coordinator.spec.ts reclamation-eligibility.spec.ts publication-proof-retirement.spec.ts publication-terminal-obligation.spec.ts publication-native-provenance.spec.ts --maxWorkers=1
```

Negative mutation:

```sh
ST_RETIREMENT_FAULT=naive-retire corepack pnpm nx test kernel --skip-nx-cache publication-retirement-acceptance.spec.ts --testNamePattern='foreign pending exclusion' --maxWorkers=1
```

## Limits and next gate

No whole-kernel/framework/SDK matrix, GC or performance measurement was run. No universal heap guarantee; pending obligations can legitimately retain source work until settlement or explicit disposal. No cost claim beyond source inspection that new work is exact-subject requirements and captured-cell subscriptions, without a scan of trees or new global pending-owner sampling.

Independent review is still required before integration. REVIEW-REQUEST.md supplies focused questions and raw reproduction paths. Main owns selection and integration; the author does not mark its own implementation independently approved. Preserve exact source identities when merging with the separately evolving joint-phase work.
