# Narrow independent mechanism verdict

**Bounded mechanism acceptance for a disposable native experiment, subject to Main's explicit authorization.** No remaining blocker found in the corrected earliest-before/latest-after pairing. This is model/mechanism acceptance, not native runtime or release acceptance.

Reviewed model SHA-256: `5560e6e08ebee27f15107be58400169629ba96caf7db2b0e6c662bea94f786e0`. Verified all eleven frozen author artifact hashes, all five test files byte-identical to the predecessor/reviewer inputs, and predecessor freeze/review/failure-log identities. Prior failures remain preserved.

Node v24.15.0 independent replay, working directory `/private/tmp/st-native-endpoint-composition`:

`node --test model.test.mjs normalizer.test.mjs source-oracle.test.mjs independent-review/adversarial.test.mjs reviewer-replay/composition.test.mjs composition-controls.test.mjs`

Result: **39 passed, 0 failed**, including both unchanged reviewer composition falsifiers. Raw output: replay-39.log. This includes the three-scenario frozen-normalizer differential, not a native integration suite.

## Correction audit

- append and continuous structural compileSelected share composeEndpoints. Raw before, key, certificate and explicit field presence all come from the earliest selected effect; the after tuple comes from the latest selected effect.
- Endpoint-free first/last inputs do not accidentally inherit another effect's certificate. Missing evidence remains missing.
- rebindFields carries own-field presence with the certified endpoints. inverse swaps presence and certificates with their corresponding endpoints.
- Paired member-image normalization and recipient eligible-slot join are unchanged by this correction; earlier bounded acceptance of those algorithms remains applicable.
- Source audit confirms the documented composePlainBranchMemberEffect reactivation exception: when native composition replaces a preliminary scalar before with the incoming absent-member baseline, metadata must follow that chosen baseline. The generic earliest-before helper is not a replacement for this native decision.
- Source occupancy composition retains first removal, latestRemoval and addition contexts separately. Their metadata must follow the actual chosen native image/context during integration, as specified in RESULTS.md. No new disposition or rollback policy follows from the model helper.

## Acceptance boundary

Proceeding to the bounded native experiment is technically justified; Main retains authorization. Carry the already-agreed exact producer binding, normalization/realization, callback/revision guards, no-observer work, request-local retention and materialization accounting into that experiment. These remain existing integration gates, not new prerequisites for another model review. Preserve the original restoration assertion and the separate wider-updater oracle conflict. Later-confirmed refusal remains refusal; model conditional omission does not authorize new native selective rollback.

No native runtime or author model files edited. No persistent root, global responsibility index or expanded public semantics selected.
