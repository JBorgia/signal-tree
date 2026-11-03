# Entity-registration artifact gate: tooling handoff

Ready for Main's independent review and composition. No integration, push, or release approval is claimed.

## Candidate and patch

- Candidate: `/private/tmp/st-c28-r3-entity-artifact-gate-work/successor`
- Base: frozen `/private/tmp/st-c28-r3-registration-lint-combined/candidate`, manifest `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`.
- Successor source manifest: `26193d775b3e3f9c0ecc859de029dc20a1a591638730846ac0413bc1e89b6c1e` (`MANIFEST.json`, 3,122 tracked files).
- Patch: `tooling.patch`, SHA256 `e3a2db6c7191887f01d237d2eadcfc9722ecfa59ecc05223ca84a8d634df6d2e`.
- Full machine-readable identity: `IDENTITY.json`.

The patch contains exactly five paths: new gate tool, two new peer-fixture metadata files, existing gate registry, and existing experiment README. Only two existing source-manifest files changed. All runtime files, all shared 20-case fixtures, all entry programs, and the selective production bundler remain byte-identical to the frozen base. All 3,119 frozen manifest entries and all five original tarballs were rehashed unchanged at handoff. The diagnostic b4d66da3 candidate was neither used as a base nor modified. No root checkout edits were made.

## Cold-cache setup qualification

`qualify.py` documents the actual commands, cwd and bounded subprocess execution. Node 24.15.0 / npm 11.12.1 generated a peer-only lock using npm (no custom resolver). Eight direct peer versions/SRI records match the frozen canonical pnpm lock. The peer lock contains 32 registry dependency records with integrity.

Two independent empty caches (`cold-a-cache`, `cold-b-cache`) each completed npm ci and installation of the five frozen tarballs, exit 0. Every external package path/version/resolved URL/integrity stayed identical after tarball installation. Each supplied tarball's SHA512 SRI matched the installed npm lock. Both consumers passed installed original8 + lifecycle6 + receipt6, no-Link and facade controls, then all four production programs. Metafiles showed Link/entity-factory contributions in the Link workloads and neither in the no-Link workload; all bundle inputs resolved inside the respective isolated consumer. No workspace package linking or source aliases were used.

`QUALIFICATION.json`, `cold-a-*-command.json`, `cold-b-*-command.json`, and their result/log files retain the receipts. The initial sandbox DNS failure is retained in `lock-first.log`; approved setup dependency fetch succeeded. The cold-cache/offline negative control exited 1 as setup failure (`unavailable-ci.log`), never as a behavioral kill. Setup fetching is permitted; runtime workloads require no service/network dependency.

## Focused verification

Commands ran from the successor with pinned Node/pnpm. Registry runs used `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true` and the qualification npm cache. The registry built the successor's canonical five packages; the gate itself never builds or repairs dist.

| Command | Actual result / receipt |
| --- | --- |
| `node tools/verify-gates.mjs --only=entity-registration-artifacts,entity-registration-artifacts:self` | 2/2 passed; `registry-normal-first.log` |
| Same selection with `--self-test` | 2/2 proven (one via companion), zero unproven/blind/error; `registry-self-first.log` |
| `node tools/verify-gates.mjs --only=entity-registration-artifacts --artifact-integrity=<seal>` | 1/1 passed without build; `registry-sealed.log`, exact seal in `EXTRA-CHECKS.json` |
| Same with incorrect seal | Nonzero before gate; `registry-wrong-seal.log` |
| New tool `--self-test`, empty cache and `npm_config_offline=true` | Nonzero at baseline-ci, no runtime arms or mutation; `tool-empty-cache.log` and `EXTRA-CHECKS.json` |
| `pnpm nx test kernel src/lib/entity-registration-original.spec.ts src/lib/entity-registration-lifecycle.spec.ts src/lib/entity-registration-receipts.spec.ts --skip-nx-cache` | Exactly 3 files / 20 cases passed; `source-specs-first.log` |
| `node tools/verify-gates.mjs --only=spec-types` | 1/1 passed; `spec-types-first.log` |
| Syntax, parser selfchecks and staged diff check | Passed; parser checks execute inside companion selftest; no separate runtime fixture edits |

Normal runtime evidence is 20 logical cases replayed in two modes, not 40 distinct semantics. Installed facade identity is an extra control, not additional entity cases. This focused run is not release sign-off and does not waive existing budget failures.

## Mutation classification and recovery

Authoritative accepted record: `evidence/registration-mutation.json` (copied from the actual successful registry companion run). It records tool/input hashes, canonical build seal, packed and installed file hashes, argv, results, bundle hashes, and graph controls. Child stdout/stderr and command records remain in its referenced evidence directory; mutant behavioral logs are also copied under `evidence/`.

Only the disposable kernel package copy changed: exactly one `registerEntityPublicationFactory(createEntityPublicationParticipant);` call in built `dist/lib/link.js` became `void 0;`. All five disposable packages were freshly packed and installed with the same pinned peer lock. No source, canonical dist, clean tarball or clean consumer was mutated.

Both installed and production mutant arms reached the behavior probes with successful setup/import/bundle controls and reported:

- Original-eight: five named assertion failures (collection useful output and foreign-dependency hold/delivery).
- Lifecycle-six: four named assertion failures (collection terminal delivery).
- Receipt-six: first case threw `changed write must not return no-write`. The unchanged receipt runner stops there; later receipt cases are NOT claimed to have executed on the mutant.

All three suite results classify as behavioral failures in each mode, not syntax/resolution/timeout/integrity/setup failures. The no-Link runtime and selective graph controls passed for the mutant. The normal tool does not require an exact mutation failure count; it requires recognized behavioral witnesses in each mode and rejects infrastructure errors.

Clean baseline and clean recovery each passed 8+6+6 in both modes with identical classified results, using the original clean tarballs and unchanged fixture hashes. All gate input hashes and canonical build seal remained unchanged. The selftest never counts a graph-only failure as proof of missing-registration behavior.

The registry's detector-blindness mutation replaced only the classifier's behavioral-failure filter with `[]`. Its baseline still passed all cases, then it failed specifically with `registration mutant survived behavioral detection`; `evidence/classifier-blindness.json` retains that record. The registry restored and hash-verified the tool. This is evidence that detector blindness is caught, not an install failure inverted into a green selftest.

## Preserved first failures and limits

- `tool-first.log`: macOS `/var` versus `/private/var` canonicalization caused an isolation assertion. Corrected by canonicalizing the temp root.
- `tool-second.log`: piped Node stderr truncated an uncaught minified-bundle assertion before the Error line. Corrected with file-backed child output descriptors; no semantic criterion was weakened.
- `tool-third.log`: formatting overlapped verification, and the input-hash guard correctly rejected the run. Formatting completed before subsequent accepted runs; the rejected run is not acceptance evidence.
- `RUN-INDEX.json` distinguishes these from accepted normal/selftest/sealed runs and intentional classifier/setup failures.

Independent review is now assigned by Main before composition, per the final steering instruction. No independent approval is claimed. The local Claude review attempt was logged out. An ephemeral read-only Codex review was subsequently rejected by automatic approval review because it would send an unreleased patch to an external reviewer without destination-specific approval. No workaround or further reviewer dispatch was attempted. Those attempts are retained separately from test evidence and do not block delivery of this reviewable patch to Main.

## Composition boundary

Apply/review only `tooling.patch` against Main's chosen combined successor. Retain the frozen original case definitions and bundler. Recheck the focused gate on the composed source/artifact identity; this candidate's evidence does not certify the separate diagnostic-runtime candidate. No new campaigns, runtime redesign, package API change, or cache provisioning infrastructure are part of this handoff.
