# F1 correction handoff

Correction implemented and the agreed focused checks passed. Independent review is underway with Main; no acceptance, integration, or release approval is claimed.

## Identity and scope

Candidate: `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate`.

Final source manifest: `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333` (3,124 files).

Base is the preserved composition `42280bba7bc92b75ae3f252742de5b7f78e4cce0b61c1d935212d7e438f2baf1`. Runtime is byte-identical to diagnostic source `b4d66da31a7927e0d255add68c424b50a99b8ece3a21a594f6ef2ecb57c982e6`: all 1,111 package files match, and all 14 entity-registration source/artifact fixture files match the composed base. Peer fixtures are unchanged. Both original tooling identity `26193d775b3e3f9c0ecc859de029dc20a1a591638730846ac0413bc1e89b6c1e` and composition identity `42280…` were fully hashed before and after this work and remain unchanged. Root was not edited.

Only three files changed relative to 42280: the gate tool, opt-in registry result boundary, and README. The complete tooling delta relative to diagnostic b4d66 remains exactly the original five paths. No runtime, package manifest, public API, shared fixture, bundler, workflow, or policy changes.

Artifacts:

- `IDENTITY.json`, `MANIFEST.json`, `BASE-IDENTITIES.json`, `UNCHANGED-RUNTIME-HASHES.json`.
- `F1-correction.patch`: three-file correction against 42280; SHA256 `c2f78333eed4547bd72eb5c81af19478764560b9364eeac7741bb04a2c7285c0`.
- `full-tooling.patch`: complete five-file patch against b4d66; SHA256 `a25c15af4659d7bf06e19d251a7c3d4a34a950e913f7946b818060ca657ae8f0`.
- Both patches passed read-only `git apply --check` against their specified unchanged bases; receipts in `PATCH-RECORD.json`.

## Corrected proof boundary

The companion alone opts into `mutationProof: 'entity-registration-classifier-blindness-v1'`. Its registry proof now requires exit 42 AND exactly one schema-checked witness with the registry's fresh per-run UUID token. A bare nonzero exit, missing/duplicate/wrong witness, or wrong token is an error/non-proof. The normal entity-artifact entry is deferred until this companion's validated proof succeeds. Setup failure therefore does not leave its parent silently marked indirectly proven.

The tool's witness is produced only after:

1. Complete passing baseline (same 8+6+6, installed and production).
2. Successful mutant pack/install/public-resolution/bundle setup and controls.
3. Recognized raw behavioral failures in BOTH mutant modes; the deliberately blinded detector misses them in both modes.
4. Passing selective no-Link runtime/graph controls.
5. Complete clean recovery (same original clean tarballs and 8+6+6 in both modes).
6. Final canonical build/input and installed-package/tarball integrity checks.

The tool no longer throws immediately on the first blinded mode. It collects the two identified blind modes, completes control/recovery checks, and emits the witness only after the finally-block checks. Setup, timeout, unexpected runtime, graph/control, or integrity failures cannot produce this witness. A mutation that fails to cause a raw behavioral witness is also an error, not proof.

Unrelated gates retain their existing generic nonzero and provenBy behavior. Only entries whose companion opts into mutationProof use deferred validation; no global gate semantics were changed.

TMPDIR hardening canonicalizes the temp root and rejects an in-workspace root/ancestor before creating anything. This is a verification-tool preflight, not a library/public-contract change.

## Actual focused results

Run from the new candidate using Node 24.15.0, npm 11.12.1, pinned pnpm, and existing canonical registry builds. The normal build path may use Nx cache; no forced-uncached-build claim is made.

| Check | Actual outcome | Receipt |
| --- | --- | --- |
| Full selected registry `--self-test`, empty npm cache + offline setup | Exit 1, **0/2 proven, 2 errored**; baseline-ci failed, parent proof withheld | `registry-offline-negative.log`, `evidence/offline-negative.json` |
| Full selected normal registry | Exit 0, **2/2 passed** | `registry-normal.log`, `evidence/normal-gate.json`, `evidence/normal-recovery.json` |
| Full selected registry `--self-test`, intended classifier blindness | Exit 0, **2/2 proven**, validated companion exit 42 before parent proof | `registry-blindness-positive.log`, `evidence/blindness-positive.json` |
| In-workspace TMPDIR | Nonzero before consumer creation | `tmpdir-preflight.log` |

The exact selection was `--only=entity-registration-artifacts,entity-registration-artifacts:self`. Commands, cwd, control environment and exits are retained in sibling `*-command.json` / `*-result.json`; `FOCUSED-RESULTS.json` records the restored tool hash.

The positive witness evidence contains populated passing baseline and recovery arms, both mutant modes marked blind, successful controls, no infrastructure classifications, and unchanged inputs. Baseline and recovery have identical classified 20-case results in each mode. The mutation yields the same existing fixture assertions: five original-case failures, four lifecycle-case failures, and the first receipt case's changed-write/no-write assertion in each mode. Later mutant receipt cases are not claimed to run after that unchanged runner throws. No test expectation was weakened.

Negative evidence contains no runtime arms, no mutation and no mutationProof. Its canonical inputs were restored/unchanged; registry output explicitly rejects the missing witness. This directly falsifies the reviewed F1 counterexample at the full-registry level.

`EVIDENCE-INDEX.json` maps each copied record to its original temp directory, version, hash and disposition. Focused first logs were retained; no corrective retry was needed for these four F1 checks. Earlier 26193 first failures remain in their original packet, not overwritten or reclassified.

## Preregistered npm-version reconciliation

Current root and this candidate have identical `.nvmrc` and validate/release/publish workflows (`NPM-WORKFLOW-INPUTS.json`). Validate/release use setup-node with `.nvmrc` = 24.15.0 and do not upgrade npm. The official Node release index, fetched from `https://nodejs.org/dist/index.json`, identifies npm **11.12.1** in Node 24.15.0 (`CI-NODE-RELEASE.json`; raw metadata retained). Thus the full F1 focused receipts above exercise the CI-bundled npm version.

Publish adds `npm install -g npm@^11.5.1 && npm --version`. This is NOT an exact 11.12.1 pin. The metadata lookup on 2026-11-03 found **11.21.1** as the highest published version matching that range (`publish-npm-range.json`). This is a current range-resolution inference, not a claim to have executed an actual CI publish job.

Installed exactly npm 11.21.1 under this packet's temporary directory (no global/root install) and ran ONE additional normal gate smoke:

`node tools/verify-gates.mjs --only=entity-registration-artifacts --artifact-integrity=<current-candidate-seal>`

It used a fresh npm consumer cache, fetched/installed the pinned peer lock and fresh local candidate tarballs, and passed 20 cases in installed and bundled modes plus facade/no-Link/graph controls. No rebuild or mutation campaign was performed for this second version. Actual tool evidence records npm 11.21.1 and unchanged inputs. Receipts: `npm-11.21.1-smoke-command.json`, `npm-11.21.1-smoke-result.json`, `npm-11.21.1-smoke.log`, `evidence/publish-npm-smoke.json`, `NPM-QUALIFICATION.json`.

Coverage is therefore explicit: **11.12.1 full F1 registry positive/negative/recovery; 11.21.1 one exact-version normal sealed setup/gate smoke**. No claim is made for mutation proofs on 11.21.1 or future versions allowed by the floating publish range. The README states these limits. No additional npm matrix or broader campaign was run.

## Review boundary

Main's independent review owns acceptance of the F1 correction and composition. This packet supersedes neither frozen base and contains no integration action. Main can review the three-file correction or apply the complete five-file tooling patch to the unchanged diagnostic runtime source.
