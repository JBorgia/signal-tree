# F1 correction — independent bounded follow-up

**F1 is corrected in the inspected implementation. No new blocker demonstrated.** The full-registry offline failure no longer counts as proof, and the positive proof requires an invocation-bound witness after populated baseline, both mutant modes, controls, recovery and unchanged-input verification. This conclusion is bound to final source manifest `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333`, independently verified across all 3,124 listed files.

## Identity and authorized scope

Reviewed `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate` against prepared composition manifest `42280bba7bc92b75ae3f252742de5b7f78e4cce0b61c1d935212d7e438f2baf1` (candidate HEAD `b0cab6b`, prepared composition baseline). Independently compared every base-manifest path: only these three existing tooling files differ. Peer fixtures, runtime and shared cases are unchanged.

| File | Reviewed SHA-256 |
| --- | --- |
| tools/verify-entity-registration-artifacts.mjs | `a73bd9e58aeccee5cb5969432326b9de0e1b4025fc8f897b99ec61787732c828` |
| tools/verify-gates.mjs | `c5ce068a0c54d8b3353a6451bffcb5346d885639f68f58ce746dc8a35fb02ef9` |
| tools/experiments/entity-registration/README.md | `a1555012626ea1fc361b258654103bd6754caaf3a4492e769896cbbbfbb5a7bd` |

F1-IDENTITY.json records the final review identity. Only README wording changed after provisional review; both executable tool hashes remain identical. No worker/root source edits were made.

## Proof boundary and stale evidence

The registry opts only `entity-registration-artifacts:self` into `mutationProof: entity-registration-classifier-blindness-v1`. Its existing generic nonzero rule remains available to unrelated gates. Only a parent pointing to an opted-in companion takes the new deferred path; absent/invalid companion proof becomes an error rather than an indirect pass. This is the authorized bounded correction, not a general reinterpretation of all registry mutation semantics.

For each opted-in invocation the registry generates a new randomUUID and overrides the child token environment value. It accepts exit **42**, exactly one structured stdout/stderr witness line, the current token, correct kind, and the exact baseline/mutant/control/recovery/input fields. Wrong exit, malformed/duplicate/missing witness, unknown fields, mismatched fields or stale token cannot produce `proven`. It does not load a previous result.json as proof.

The tool independently requires raw classified behavioral failures in each mutant mode before consulting the intentionally blinded behavioralFailures filter. It records blindness for both modes, completes no-Link and other controls, replays clean recovery, and only afterward marks classifierBlindness. The final input/artifact check must succeed before emitting the witness. Setup, timeout, unknown runtime, recovery or integrity errors cannot take that witness branch. An actual surviving registration mutant without behavioral witnesses also errors instead of being mistaken for detector blindness.

Normal selftest retains its normal success behavior; under intended detector blindness the tool reports `passed:false` and exit 42, which the registry specifically recognizes as a successful *mutation proof*. These are distinct result levels, not a contradiction.

## Saved full-registry evidence checked

- **Offline negative:** registry-offline-negative exits 1, reports **0/2 proven, 2 errored**, and preserves baseline-ci failure. Referenced child `st-entity-artifact-eelcId/result.json` has no arms or proof, and unchanged inputs. The classifier mutation was active, so this directly falsifies the original F1 failure mode.
- **Normal selection:** registry-normal exits 0, **2/2 passed**. Child records d3NzhJ/kxYC90 show populated installed/production baseline passes; the companion additionally records behavioral mutant failures in both modes and passing clean recovery. No proof token is needed for ordinary pass.
- **Intended blindness positive:** registry-blindness-positive exits 0, **2/2 proven**; companion exit 42 is validated before the parent becomes proven. Child `st-entity-artifact-2oKvj7/result.json` contains passing baseline/recovery, both mutant modes classified behavioral, `blindModes: ['installed','production']`, controlsPassed and inputsUnchanged. Its mutated tool hash matches exactly the one filter-to-empty-array replacement. The current tool hash matches the restored hash in FOCUSED-RESULTS.json.
- **TMPDIR:** preflight receipt exits 1 with the specific workspace assertion before consumer creation. Source canonicalizes the temp root and walks ancestors for ROOT, pnpm-workspace.yaml or .git, covering an in-checkout path and canonical symlink escape back into a checkout. This preflight occurs before the evidence directory exists; its outer command/log receipt is therefore the evidence, not a missing child result file.

These full mutation/setup/recovery runs were inspected, not rerun by this reviewer, and identify Node 24.15.0/npm 11.12.1. A later npm 11.21.1 ordinary-gate smoke is separately qualified below; it does not extend mutation qualification to that npm version.

## Independent cheap falsifiers run

Extracted the actual validMutationProof function by AST and evaluated it in an isolated VM against the saved positive witness and adversarial variants. **23 checks passed:** valid current proof accepted; new-invocation token, explicit missing token, exit 0/1, no witness, duplicate line, truncated JSON, every missing required field, wrong semantic fields and extra field rejected. See f1-check.cjs / F1-CHECKS.json.

Preserved a reviewer-harness first failure: a default parameter accidentally replaced explicit undefined with the current token. Corrected only that harness defaulting and reran; no production assertion or worker source changed. f1-check-first.cjs and F1-CHECK-FIRST-FAILURE.md retain the mistake. It was not a validator defect.

Also independently verified Main's comparison: **192 regular dist files have identical paths and bytes** to the b4d66da3 diagnostic packet. This permits reuse only of evidence attached to those exact runtime outputs. It neither proves source freshness by itself nor substitutes for the new proof-boundary checks above.

## Handoff

Accept the bounded F1 correction at the final manifest and hashes above. The final freeze is bound to this review. Preserve 26193 and 42280 identities and first-failure evidence. No broad tests, builds, package installs or further semantic redesign were requested or performed. Existing diagnostic/demo/library budget failures and unqualified broader release scope remain unchanged.

## Final freeze and npm receipt reconciliation

Independently recomputed MANIFEST.json SHA-256 `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333`; all 3,124 listed source files match. Both patch hashes in the worker IDENTITY.json also match. The only change since this review's provisional hashes is the README's explicit npm qualification paragraph; no proof-token, classification, restoration or runtime code changed.

Read final IDENTITY.json, STATUS.md, NPM-QUALIFICATION.json, npm-11.21.1-smoke command/result/log, and the referenced actual gate result at `st-entity-artifact-VhXMvW/result.json`.

- **npm 11.12.1:** full focused ordinary/mutation, offline-negative, intended-blindness-positive and clean-recovery qualification described above.
- **npm 11.21.1:** one exact-version **normal sealed gate smoke**, exit 0; no rebuild or mutation flag. Actual child result identifies npm 11.21.1, a passing baseline with installed and production 8/6/6, unchanged inputs and no mutation record. The artifact seal is `sha256-f349d92ace4237eedf6822b515ceda8273acf3a3f0fbdaa6bb7df9d4fc496e1f`. This qualifies the recorded locked-peer setup and ordinary artifact cases on that exact npm version, not a second mutation campaign or future versions in the floating publish range.

STATUS.md retains earlier progress sentences (“no second version” / smoke “running”). Those are stale narrative checkpoints, superseded for this review by the completed NPM-QUALIFICATION.json, raw exit-0 smoke receipts and final README. They do not negate the recorded successful smoke or expand its scope.

This final binding used only hashes and existing receipts. No new gate, build, installation or verification campaign was run. F1 is closed; no additional blocker demonstrated within the bounded tooling scope.
