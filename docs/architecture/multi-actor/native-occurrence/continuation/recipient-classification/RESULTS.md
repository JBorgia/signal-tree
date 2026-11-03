# Recipient-window classification successor

Frozen for independent review, not integrated or accepted. Base `/private/tmp/st-recipient-window-successor/candidate`; this successor is `/private/tmp/st-recipient-window-classification-successor/candidate`. No packet-index patch is included. All 2,968 predecessor manifest entries reverified unchanged.

## Authority and correction

Read Faraday's `/private/tmp/st-recipient-window-independent/CONTRACT-ADJUDICATION.md` and preserved exact authority text under `authority/`. 75c645eb AUTHORITY lines19–22 and POLICY-DECISION lines20–23 retain the explicit recipient-only exception. 247cfec7 PROPOSAL lines156–171 requires a contradictory independent declaration to throw the prescribed after-callback error with installed writes retained and no receipt returned. Owner explicitly authorized these bounded corrections in this task.

Two runtime files change relative to the frozen recipient-window candidate. `private.ts` now carries named preparation-site causes: write-context origin, invalid attribution, missing updater capture, and recipient input-domain mismatch. `beginBranchInput` labels domain mismatch explicitly. `lifecycle.ts` retains conservative unknown status for every cause, but captures a new fixed recipient window only for missing matching declaration, explicit unknown declaration, or unobserved authorship causes. Domain uncertainty alone with a matching declaration does not capture unrelated owners; ordinary fallback remains surviving, never declared permission. Native actual D/I/V, shared validation, inherited possible windows, finalization timing, projection recomposition and disposal are unchanged.

## Preserved fixtures and explicit historical oracle corrections

- All inherited tests except the two specifically authorized files are byte-identical. Full enrollment-invariance file (16 parameterized cases), predecessor nine window controls, immediate-fallback controls and all other selected inherited fixtures are unchanged. No enrollment case was removed.
- `aggregate-native-input-independent.spec.ts`: replaces only obsolete returned-conservative-receipt expectation with exact code/stage/reason and no-return assertions. Pair7, root7, unchanged transaction inspection and no pending delivery remain. Original retained in `originals/`.
- Main's `known-input-contract-review.spec.ts` copied byte-for-byte: both confirm and successful rollback preserve actual-input contradiction safety and useful pair7 terminal delivery without a new target write. Its hash matches the archived original.
- `aggregate-installed-publication.spec.ts`: historical wider recipient-only hold assertion corrected explicitly under 75c645eb. Requires useful immediate pair1 delivery with `basis: surviving`, preserves owner7 and post-rollback no-duplicate/useful settlement assertions. Original retained in `originals/`; this is an oracle correction, not an assertion that the old test passed unchanged.
- Faraday's nine review controls are included. The clean wider-input trace contained the same obsolete hold expectation, so that one arm now requires immediate surviving delivery; known-input arm retains contradiction/pending safety. Its trace instrumentation reads the new private cause object rather than treating any object as truthy coverage. Output redirected to this directory. Exact original archived.
- Six new cause controls: domain-only vs external-origin vs unknown-declaration, each confirm/rollback; undeclared secondary always holds until the original captured owner terminates. Assert useful target values, unchanged initial ownership, retained unknown proof, exact cause distinctions, surviving-only receipt, secondary useful wake, and exclusion of a later unrelated pending owner.

## Results and first failures

Final finite gate: **172 pass / 0 fail across 22 files**, `final-runtime.log`. Source typecheck and ratcheted spec-types both exit0 (`source-types-first.log`, `spec-types-first.log`); no ratchet edits. The ratcheted result does not assert absence of all inherited spec diagnostics.

Baseline original oracle replay in the new copy: **30 pass / 3 fail**, `before-change.log` (known-input obsolete receipt and both immediate fallback cases). Corrected oracles with predecessor runtime restored in separate `baseline-controls`: **30 pass / 3 fail**, `baseline-corrected-oracles.log`; known-input now passes, while all three useful immediate fallback expectations fail. Thus expectation correction alone does not produce the result.

First classification replay: **66 pass / 1 fail**, `first-classification.log`. The new test incorrectly expected a conservative receipt synchronously before scheduled validation; actual was validating. Preserved exact first test in `first-attempt/`. Corrected the newly introduced timing assertion to deny declared basis synchronously and require useful surviving delivery after flush, preserving the intended semantic gate. No runtime repair was needed. Cause-focused run: **21 pass**, `cause-first.log`.

One initial command accidentally used the predecessor cwd before rerunning in the new copy. Its log is preserved as `predecessor-inadvertent-replay.log`; it did not include the added Main controls and is not qualification evidence. No predecessor source edits occurred; manifest verification confirms every source entry unchanged (Nx cache may have been touched).

## Artifact identities and integration boundary

`VERIFICATION.json` records exact changes, original-control equality and all patch hashes. `runtime.patch` is the **two-file delta from the frozen recipient-window successor**, not from combined B. `source.patch` also includes the authorized test corrections/additions. `combined-B-runtime.patch` is the complete three-file recipient-window runtime patch relative to frozen combined B, supplied for unambiguous review; do not stack it on top of the predecessor patch. Neither patch includes packet indexing or any other worker's correction.

- Source manifest SHA256: `c374723071aa1aea781d1b2caf3c13c92d522a4c226831e2fb923a20e5c72147`.
- Delta runtime SHA256: `bc5ca4ccda1beb57bdf59b6a49c4c589f40b49893c82ff469bfde57217d5cce8`.
- Delta runtime+tests SHA256: `e3deb5c6299a1f5720a4588d6279612657840a6bed223ea642c826ead19cd03f`.

No new semantics, public exports, installed artifact qualification, release acceptance, full SDK pass, performance claim or native dependency downgrade is asserted. Main owns integration; independent implementation review is still needed on this changed classification.

## Exact replay

Cwd successor `candidate`; Node24.15.0, pnpm10.17.0; shared dependencies `/private/tmp/v16-transition-qualification/node_modules`.

```sh
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache recipient-cause-classification.spec.ts recipient-window-review.spec.ts known-input-contract-review.spec.ts recipient-window-independent.spec.ts publication-enrollment-invariance.spec.ts aggregate-independent-input.spec.ts aggregate-installed-publication.spec.ts a1-installed-publication.spec.ts publication-validation-window-audit.spec.ts publication-terminal-horizon-independent.spec.ts publication-terminal-consumer-independent.spec.ts publication-terminal-obligation.spec.ts declaration-extensibility-e5-fork.spec.ts a1-independent-review.spec.ts intrinsic-mutation-pay-for-use.spec.ts a1-publication-installation.spec.ts publication-membership-provenance.spec.ts publication-native-provenance.spec.ts publication-evidence-scope-controls.spec.ts publication-proof-retirement.spec.ts collection-contributor-core.spec.ts aggregate-native-input-independent.spec.ts --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
```

Baseline original/corrected selections use the five files `aggregate-native-input-independent.spec.ts aggregate-installed-publication.spec.ts publication-evidence-scope-controls.spec.ts collection-contributor-core.spec.ts known-input-contract-review.spec.ts`, same Nx flags. The latter runs only in `baseline-controls`; those runtime files were restored from the frozen predecessor. Trace logs append; use a fresh copy/path for independent evidence.
