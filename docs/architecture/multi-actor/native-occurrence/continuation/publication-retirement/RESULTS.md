# Bounded publication retirement successor

Candidate: `/private/tmp/st-publication-retirement-successor/candidate`, copied from the frozen row-source successor. No root checkout or predecessor runtime edits. Hume's `/private/tmp/st-retirement-mechanism-review.md` was read in full before implementation. This is a narrow implementation handoff for independent review, not overall native integration acceptance.

## Implemented mechanism

- `entity-signal.ts`: the shared frame commit tracks actual installation. Source completions and membership delivery are attempted after installation; the first thrown value is preserved. An installed forget-lifetime frame requests publication retirement. Installed tombstones also reach the existing no-owner physical reclamation gate even when completion throws. Prepared and automatic reclamation therefore converge without per-writer publication cleanup exceptions. Requests recheck that the exact authorized forgotten subject remains absent and ordinary topology does not retain it; arbitrary missing identity is not a reclamation request.
- `internals/entity-publication.ts`: source-owned exact-subject requests queue a microtask, so readiness notification cannot erase pre-install evidence or preempt synchronous outer completion/reentry. Requests own cancellable readiness subscriptions and drop them on release, replacement, ineligibility or source disposal. A ready non-neutral record retains its evidence while its request is dropped. There is no global scan, owner-transition listener, fake operation, or recipient-count permission.
- `experimental-publication/entity.ts`: collect only stored requirements across all eight subject maps. Release requires readiness, owner-free proof in every actual role, zero possible owners, and no unknown/invalid/unavailable/rejected bits. `historicalWindow` alone is not rejected. Snapshot exact map entries and recheck them plus source revision immediately before deleting all eight entries. `inspect` now includes both mapping counters. Requirement objects and recipient/receipt snapshots are not mutated by retirement.
- Prepared readers keep the existing full source-revision check around preparation. Finalization checks a source-local retirement revision and recipient revision before/after callbacks, plus the full source revision across those callbacks. Retirement advances both revisions. The separate retirement revision is necessary because existing physical and ordinary compensation units intentionally install sequentially on the same source; ordinary installation must not masquerade as evidence deletion. Queued retirement cannot interleave their synchronous installation stack. Stale readers crossing an actual retirement refuse finalization.
- Root materialization disposal wires collection source cancellation to tree destruction. This is a root-owned callback set, not a global retirement index. It adds no public export or runtime package API.

The sufficient condition is intentionally narrower than “all owners confirmed.” Readiness is not an owner-settlement signal. Evidence blocked by foreign windows, unknown/rejected facts or owner roles is retained; no new supersession policy is implemented.

## Final verification

Node24.15.0, pnpm10.17.0, installed local dependencies. From the candidate:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache publication-retirement-acceptance.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts entity-lifetime-ledger-null.spec.ts entity-selection-lifetime.spec.ts subject-reclamation-coordinator.spec.ts reclamation-eligibility.spec.ts entity-signal.spec.ts entity-mutation-frame.spec.ts
```

**125 pass across 9 files**, `final-runtime.log`. Includes the unchanged acceptance nine and original lifetime three; ten new bounded controls cover key-evidence identity release, caught completion error inside an open horizon, stale-reader refusal, queued disposal, preserved foreign source facts after confirm/rollback, readiness cancellation on ready/dispose/replacement, and finalization reentry. Readiness scheduler tests explicitly mock the existing readiness seam to exercise cancellation; they are not owner-settlement simulations. Public horizon tests use the real declaration lifecycle.

Link GC configuration (the default suite excludes this file):

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NODE_OPTIONS=--expose-gc corepack pnpm exec vitest run --root packages/kernel --config vitest.retention.config.ts link-lifetime.spec.ts
```

**5 pass**, `link-lifetime-gc-final.log`.

Types:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH node tools/check-spec-types.mjs
```

Both pass (`source-types-final.log`, `spec-types-final-2.log`). No baseline changes.

Unchanged negative mutation:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false ST_RETIREMENT_FAULT=naive-retire corepack pnpm nx test kernel --skip-nx-cache publication-retirement-acceptance.spec.ts --testNamePattern='foreign pending exclusion'
```

Expected **1 fail, 8 skipped**, `naive-cleanup-final-2.log`: injected raw retirement permits b=2 publication while foreign owner is pending, and the unchanged assertion catches it. Raw `retire` remains the low-level destructive primitive used by this diagnostic; runtime reclamation uses the obligation-aware request.

## Preserved failures and qualifications

1. `first-runtime.log`: initial implementation 11 pass/1 fail. Comparing the full publication revision from prepare through finalize incorrectly rejected the existing physical-then-ordinary rollback sequence. `first-source-publication.ts` preserves that implementation; `implement.py` preserves its generation. Correction introduced the per-source retirement revision while retaining full checks around callback-capable phases. No control was weakened.
2. `lifetime-first.log`, `boundaries-first.spec.ts`: two new late-link assertions failed. Running those exact assertions against the frozen predecessor also failed (`predecessor-foreign-first.log`, `predecessor-check/`). Existing `baselineEntityEvidence` intentionally grants relationship-local baseline after possible owners confirm/rollback; this is separate from source evidence deletion. Original assertions/failures remain preserved. The final source-retention controls assert that the exact unknown source fact/exclusion survives settlement, without imposing a new relationship-baseline policy. The supplied pending-owner acceptance test remains unchanged.
3. Prior reports, diagnostic probes, first failures and `/private/tmp/st-publication-retirement-controls` are untouched. `VERIFICATION.json` verifies all 2,943 predecessor source files unchanged and supplied control identities unchanged.

`runtime.patch` contains six runtime files; `source.patch` additionally contains the copied acceptance test and new boundary test. `SOURCE-SHA256.json` and `FREEZE.json` identify this handoff. No performance ranking, general eventual reclamation after owner settlement, universal leak-freedom, public package release, or complete native qualification is claimed.
