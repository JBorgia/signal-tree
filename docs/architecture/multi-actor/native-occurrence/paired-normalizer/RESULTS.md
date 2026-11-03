# Paired endpoint normalizer — separate model successor

Original /private/tmp/st-native-lossless-model preserved; original model.test.mjs (23 tests) and independent-review/adversarial.test.mjs (2 tests) copied byte-identically. No runtime patch. Final run: 33 pass, 0 fail: original23 + unchanged review2 + paired normalization7 + actual frozen-source differential1 (three scenarios).

Command: node --test model.test.mjs normalizer.test.mjs source-oracle.test.mjs independent-review/adversarial.test.mjs

## Certified absent endpoints

Rebind now attaches beforeEndpoint/afterEndpoint to each field effect. Present endpoint references its exact field selection; absent endpoint references the complete source row-domain certificate, field key and its existing dependency roles. This is derived absence, not a clean default. A partial row/projection cannot be supplied as a complete domain certificate. The model's selection(row) fixtures explicitly stand for complete source-issued ordinary row domains. Production must use native domain evidence; arbitrary consumer objects do not establish absence.

Raw before/after remain for compatibility with original23 scalar tests; certified endpoints carry presence independently. Inverse swaps certificates too and returns a certified absent selection when needed. The own-present-undefined case therefore remains distinct from absent. Added test carries q-bound absence through inverse and render, verifies no own x, and verifies the exact support selection survives. Inherited fields never certify own presence.

## Actual normalization producer

normalizePaired no longer takes a caller-supplied retained:q. Each effect carries paired before/after endpoints with ordinary value, presence, exact proof and optional child selections. It implements these frozen settleTurnMemberEffects steps:

1. Iterate member effects in first-occurrence order. For each present plain before-image, visit earlier non-entity set effects at strict descendant addresses. placePaired rewrites the same relative path in payload and selection tree; absent intermediates stay absent. Deleted leaf keeps its absent certificate while disappearing from payload. Entity-subject effects are excluded.
2. Refresh present membership after-images from the final completed ordinary endpoint captured with the native unwrap, validated against the same frontier revision. This is producer-time capture, not delivery-time reread. It includes writes absent from coalesced effect lists.
3. Apply the actual value/presence no-op filter, including absent-both member retention while a descendant remains. For effects removed by normalization, produce the retained endpoint from the now-normalized before endpoint before capture state clears; surviving effects use normalized after. Thus scalar7->11->7 derives q's captured baseline, not latest ambient r or a supplied retained result. This is bounded by existing native normalization/disposition; selective rollback/refusal contracts are unchanged.

Source hooks: transactions.ts enqueueEffect1934 still owns segment capture; settleTurnMemberEffects drains at1849/2694, before clearing capture state; plain-branch-membership.ts483–551 handles image transforms and553–578 filtering. Paired before/after edits must be installed alongside that producer's result, not reconstructed in toRollbackEffect3178. compileSelectedCompensation3208 still accepts only disposition-selected effects. ordinary-realization19 does not substitute physical payload authority.

source-oracle.test.mjs extracts and transpiles the exact frozen normalizer and image helpers, with only registry/member-address/storage ports stubbed. It compares selected native values against paired outputs for earlier-descendant rewrite, scalar netzero, and final after-image refresh. Additional tests assert proof identity and presence, exclusion, absent intermediate, stale frontier refusal and coalesced-write capture.

First differential harness failure is preserved in source-test.log and source-oracle-first.mjs: VM Object.prototype differed from the fixture realm, making the source isPlainImage reject fixture objects. The final harness shares Object with fixtures; no source algorithm or assertion was weakened. Earlier model logs are retained.

## Limits and next review

This is an executable private producer proposal, not production acceptance. Complete row-domain certificates and atomic paired final captures are required inputs. Exact frame/revision installation and existing native pruning must still be wired and tested in an authorized successor; no new global index, persistent root, observer snapshot or policy is introduced. Native12 outcomes, including later-confirmed refusal, remain unchanged. Main can send this frozen successor for narrow absent-endpoint/paired-normalization review before runtime authorization.
