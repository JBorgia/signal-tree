# Rejected core successor handoff

2026-10-29. Frozen by root after covered recurrence. Do not patch or run further gates without a new explicit instruction.

Worktree `/private/tmp/link-collection-proof-successor`; branch `codex/link-collection-proof-successor`; base `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`. Original predecessor preserved. Final source/test hashes: `009-core-frozen.json`; tracked diff: `009-core-frozen.diff`. No commit made by this worker.

## Files changed by this worker

- `packages/kernel/src/lib/internals/entity-publication.ts`: opaque native fact selectors, explicit physical steps, source/enrollment revision tokens, private prepared-seed request/packet.
- `packages/kernel/src/lib/experimental-publication/entity.ts`: sparse P/O evidence lookup, per-step physical correspondence, mapping certificates, exclusion seed evidence; native unavailable helper supplied by root.
- `packages/kernel/src/lib/internals/entity-egress-projection.ts`: contributor slot edits emitted by actual payload branches, retained untouched support, negative slots, authored-order support, prepared seed installation.
- `packages/kernel/src/lib/experimental-publication/private.ts`: typed collection summaries, authored versus selected proof separation, per-role/provenance/terminal-bit counts, mandatory eligibility, baseline/acquisition helpers, collection completion.
- `packages/kernel/src/lib/experimental-publication/lifecycle.ts`: only composition-readiness changes (`Operation.projectionPending`, prepare/refresh/decision/projectRevision guards). Root owns uncertainty and terminal-marker additions elsewhere in this shared file.
- `packages/kernel/src/lib/entity-signal.ts`: physical step pairing, actual prepared P images distinct from O, exact acquisition seed from the existing prepared physical placement/value results.
- `packages/kernel/src/lib/link.ts`: enabled collection admission, contributor binding, pure-order/support-only receipts, coherent seed revision check, source-unit acquisition seed instead of post-write collection reseed.
- New `packages/kernel/src/lib/collection-contributor-core.spec.ts`: 11 useful controls, including own/nested immediate held receipts, pending positive/negative seeds, pure order, bare point work, full/equal incoming authority, reentry, equal support replacement and the separately named historical ancestor companion.

Independently owned additions are identified in the final manifest: `core-independent-review.spec.ts`, `publication-terminal-consumer-independent.spec.ts`, root uncertainty/terminal tests and `proof-retirement.ts`. Do not attribute these to this worker or alter them.

## Commands and vectors

Common prefix, run from the worktree unless noted:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_NO_CLOUD=true pnpm nx test kernel --skip-nx-cache
```

Append one `--testFile=src/lib/NAME.spec.ts` for each named file below. The emitted exact command is also in each raw log.

| Log | Vector | Result |
| --- | --- | --- |
| `001-core-baseline.log` | `collection-contributor-core` (original 4), `authored-removal-obligations` | 3 pass / 6 fail on unchanged754 runtime |
| `002-core-first.log` | same original 9 tests | 9 pass, intermediate draft |
| `004-core-adversarial.log` | core (5), `authored-removal-contract`, `authored-removal-independent`, `authored-removal-obligations`, `ordinary-order-source-boundaries` | 31 pass, intermediate draft |
| `005-negative-seed-first.log` | core (6) | 5 pass / 1 fail; first negative-seed red retained |
| `006-core-seed-aggregate.log` | previous five-file vector with core (6), plus `aggregate-installed-publication` | 46 pass / 1 unchanged historical failure |
| `007-aggregate-frozen-baseline.log` | `aggregate-installed-publication`, run in `/private/tmp/link-authored-removal-successor` | identical historical failure, 14 pass / 1 fail |
| `008-acquire-first.log` | core (11) | 9 pass / 2 fail; acquisition first reds |
| `core-independent/first.log` | independent `core-independent-review` (2) | both fail; reviewer preserved identical runtime before/after manifests |

Original four-test baseline source: `001-core-prewritten.spec.ts`, SHA-256 `a119d98ffc8bde57f3fad2a8fa165708e15796899f857e39f7ed5e16bf9f7830`. First implementation source diff is `002-core-first.diff` (includes the subsequently corrected whole-map-copy draft).

`003-core-types.log` used the pinned Node prefix with `pnpm exec tsc --project packages/kernel/tsconfig.lib.json --noEmit`. It failed on the existing transaction-semantics index-signature diagnostics, with none in then-changed files. This was before later acquisition edits: final source types have not been checked. It is not a successful gate.

The independent terminal-consumer worker also reported 27/27 across its five-file bounded vector with equal before/after manifests; that worker/root owns the exact evidence. No claim here upgrades that result to collection qualification.

## First failures that triggered the stop

- **Acquisition identity (`008`)**: both full and equal incoming values are sent to another connection while q remains pending. `acquiringCollection` matches owner/position, so every connection to the same source obtains the supposed recipient-local baseline. Exact acquiring channel identity is required; no repair was attempted after the stop.
- **Open-horizon enrollment (independent first red)**: creating a recipient while source validation is unfinished lets baseline normalization erase that reference and freezes a clean seed summary. After outer failure, independent y sends x7/y8 as `started/declared` while q remains pending. Covered seed/horizon invariant failed.
- **Hidden collection domain (independent first red)**: an omitted ancestor's collection summary still gates root `{other:1}`. Payload masking and contributor participation diverge. Covered aggregate-domain invariant failed.

The ancestor-updater no-send assertion in the original aggregate file remains unchanged and red on754 as well as the candidate. Root adjudicated its historical contract separately and requested a companion; the new companion passed with `started/surviving` and the foreign owner unchanged. No original assertion was weakened.

## Explicit limits

Core is rejected and unqualified despite earlier green vectors. Source retirement/terminal compaction transfer is not wired. Whole selected-inverse preparation is unchanged. Combined point preparation still needs constituent admission-context transport at that selected-unit boundary; existing membership-notification reseed paths need qualification with the new contributor index. Final source types and original scalar/entity groups were not run after the recurrence stop.

No broad suite, framework qualification, production benchmark/full-cost measurement, budget change, public API/export, activation, push, tag or release occurred. Root owns rejection archival and any next authorization.
