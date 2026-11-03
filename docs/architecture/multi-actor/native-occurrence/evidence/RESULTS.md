# Frozen occurrence successor

Candidate: `/private/tmp/st-occurrence-successor`. Predecessor remains preserved at `/private/tmp/st-projection-certificate-successor`. Exact identities and changed-file list are in IDENTITY.json; SOURCE-SHA256.json covers 2918 source/configuration files inherited from the predecessor manifest plus kernel TypeScript sources. Patches are relative to the predecessor, not the baseline Git commit.

Status: frozen on a covered runtime recurrence. Not accepted; broader gates deferred. No runtime changes after 007-first-runtime.log. Main may commission Faraday against this exact freeze. No external review CLI used.

## Results

- 001-predecessor.log: unchanged predecessor focused baseline, 16 passed / 2 failed.
- 002-new-before.log: preregistered new suite could not import the not-yet-created implementation module. This is an import failure, not a behavioral red test.
- 007-first-runtime.log: first successor runtime run, 31 passed / 1 failed. New occurrence suite: all 12 passed. Unchanged native-certificate-successor restoration assertion fails at line 61: expected restored branch rows [{id:'a',x:7}] with other:2; latest delivery remains {other:1}. First omission now passes. This covered restoration failure triggered the freeze.
- 008-focused-regression.log: 36 passed, across five additional suites.
- Combined distinct focused runtime tests: 67 passed / 1 failed. Passing counts establish neither architectural acceptance nor complete required coverage.
- 009-source-types-final.log: source typecheck passed.
- 010-spec-types-final.log: spec gate failed with exactly two inherited diagnostics in core-independent-review.spec.ts:38,39. No diagnostics in new/changed fixtures or runtime.

Commands: Node 24.15.0; pinned pnpm 10.17.0; NX_DAEMON=false NX_ISOLATE_PLUGINS=false. Runtime runs used `corepack pnpm nx test kernel --skip-nx-cache` with the filenames recorded in each log. Source types: `corepack pnpm run typecheck:source`. Spec types: `node tools/verify-gates.mjs --only=spec-types`. See commands.env and logs for exact workload.

## Type and fixture preservation

Compared final spec diagnostics with predecessor evidence `/private/tmp/st-native-certificate-evidence/009-final-spec-types.log`: predecessor had the same two core-independent-review errors plus a private registerCollectionProjection call arity error. Final successor has only the same two core errors. This is verified no-added-errors relative to predecessor, not a clean spec gate. No ratchet allowance or public type was weakened.

The core-independent-review, collection-contributor-core and native-certificate-successor fixtures are byte-identical to predecessor. Original fixtures are also preserved under unchanged-fixtures/. The terminal-consumer fixture now supplies real native source/registry handles rather than synthetic unanchored bindings; its assertions remain unchanged. New fixture uses bounded Record<string,number> and a callable-node runtime guard; no all-any fixture. Initial typing failures remain in 004/006 logs and preregistered source.

## Implementation and observed limit

Private native occurrence capture verifies full root ancestry; RecipientOccurrences enrolls parent guards before slots, maintains selected proof counts and unresolved readiness incrementally, and centralizes replacement/disposal cancellation. Admission reduces completed membership/collection units before checking readiness. Link delivery uses the eligible projected payload when research publication is enabled. Public barrels and activation policy are unchanged.

Source inspection hypothesis for the remaining failure: experimental-publication/private.ts membership restoration applies ordinary.after then overlays retained collection.payload; restored payload and newly selected support are not proven to be paired by one native selection unit. The failing test demonstrates nondelivery, not a separately instrumented root-cause proof. No speculative repair was applied after recurrence.
