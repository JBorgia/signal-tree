# F1 correction — independent bounded follow-up

**F1 is corrected in the inspected implementation. No new blocker demonstrated.** The full-registry offline failure no longer counts as proof, and the positive proof requires an invocation-bound witness after populated baseline, both mutant modes, controls, recovery and unchanged-input verification. This conclusion is bound to the hashes below; final worker freeze/report identity remains pending.

## Identity and authorized scope

Reviewed `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate` against prepared composition manifest `42280bba7bc92b75ae3f252742de5b7f78e4cce0b61c1d935212d7e438f2baf1` (candidate HEAD `b0cab6b`, prepared composition baseline). Independently compared every base-manifest path: only these three existing tooling files differ. Peer fixtures, runtime and shared cases are unchanged.

| File | Reviewed SHA-256 |
| --- | --- |
| tools/verify-entity-registration-artifacts.mjs | `a73bd9e58aeccee5cb5969432326b9de0e1b4025fc8f897b99ec61787732c828` |
| tools/verify-gates.mjs | `c5ce068a0c54d8b3353a6451bffcb5346d885639f68f58ce746dc8a35fb02ef9` |
| tools/experiments/entity-registration/README.md | `adbcf2e7f0c8e2b867569d3452712d60b25bb004ac80a10f1aa20ff017101b49` |

F1-IDENTITY.json records this provisional identity. No worker/root source edits were made.

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

These full runs were inspected, not rerun by this reviewer. They identify Node 24.15.0/npm 11.12.1 only; the README now explicitly preserves the unqualified second-npm-version limit.

## Independent cheap falsifiers run

Extracted the actual validMutationProof function by AST and evaluated it in an isolated VM against the saved positive witness and adversarial variants. **23 checks passed:** valid current proof accepted; new-invocation token, explicit missing token, exit 0/1, no witness, duplicate line, truncated JSON, every missing required field, wrong semantic fields and extra field rejected. See f1-check.cjs / F1-CHECKS.json.

Preserved a reviewer-harness first failure: a default parameter accidentally replaced explicit undefined with the current token. Corrected only that harness defaulting and reran; no production assertion or worker source changed. f1-check-first.cjs and F1-CHECK-FIRST-FAILURE.md retain the mistake. It was not a validator defect.

Also independently verified Main's comparison: **192 regular dist files have identical paths and bytes** to the b4d66da3 diagnostic packet. This permits reuse only of evidence attached to those exact runtime outputs. It neither proves source freshness by itself nor substitutes for the new proof-boundary checks above.

## Handoff

Accept the bounded F1 correction at these inspected hashes, subject to binding the worker's final freeze/report to them. Preserve 26193 and 42280 identities and first-failure evidence. No broad tests, builds, package installs or further semantic redesign were requested or performed. Existing diagnostic/demo/library budget failures and unqualified broader release scope remain unchanged.
