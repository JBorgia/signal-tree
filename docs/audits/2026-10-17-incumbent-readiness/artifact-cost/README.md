# New-key artifact cost decision

October 18, 2026. **Bounded cost attribution is complete. One small reduction is
verified; four budgets remain failed. No ceiling or release acceptance is implied.**

The passing correctness checkpoint `89bfca62` and evidence `96a54e6a` are preserved.
The separately verified optimization is `9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`.
B remains closed. Other v16 open-key, restoration and semantic-scope items remain
in the readiness controller.

## Exact matched results

All values below are **gzip bytes at level 9**, not rounded KB. Columns identify
exact source snapshots: incumbent `8d220643`, pre-paired repair `add49efa`, passing
repair `89bfca62`, optimized `9917c92f`.

| Fixture | Incumbent | Before paired repair | Passing repair | Optimized | Optimized minus incumbent | Budget excess |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare production | 11,919 | 12,474 | 12,612 | **12,592** | +673 | **560** |
| Bare development | 14,325 | 14,890 | 15,061 | **15,028** | +703 | **590** |
| Entities production | 26,074 | 26,647 | 26,763 | **26,640** | +566 | **426** |
| Entities development | 28,902 | 29,487 | 29,600 | **29,495** | +593 | **414** |

The particular paired installation repair contributed **138/171 bytes** to bare
production/development and **116/113 bytes** to entities. It is not responsible
for the entire cumulative increase. Before that repair, new-key construction and
observation already added 555/565 bare bytes and 573/585 entity bytes.

Unchanged budgets allow integer-byte maxima of **12,032 / 14,438 / 26,214 / 29,081**
(the tool compares gzip bytes / 1024 against 11.75 / 14.1 / 25.6 / 28.4).
Incumbent headroom was 113 / 113 / 140 / 179 bytes. Optimized headroom is now
**−560 / −590 / −426 / −414 bytes**. There is no remaining headroom to spend.

## What is retained

The bare fixture retains 33 library modules plus its entry; entities retain 43
plus entry. Retained module identities are unchanged across all four arms.
Transaction and restoration enhancer implementations are absent. The optional
`prepareMemberResponsibility` call does not pull in its transaction implementation.
Materialization and error-reporting modules were already retained by the incumbent.
No accidentally added optional subsystem or obsolete alternate ownership path was
identified by the module graph and targeted source review.

Primary production minified-byte contributions, passing repair minus incumbent:

| Module | Bare delta | Entities delta | Explanation |
| --- | ---: | ---: | --- |
| signal-tree | +1,484 | +1,498 | Private new-member descriptions, deferred canonical construction, validated construction mode, installation and exit delivery |
| materialize-markers | +260 | +261 | Shared member installer and paired record installation |
| observation-substrate | +86 | +86 | Active observation scope enrollment for later-added members |
| leaf | +71 | +71 | Terminal wrapper construction retained by private preparation |
| member-membership | +59 | +56 | Membership linking needed for new children |

These are **minified, uncompressed module contributions**, not separable gzip
costs. Compression is global, and identifier allocation causes small changes in
otherwise unchanged modules. The total gzip deltas are measured directly; they
are not sums of per-module gzip estimates. Normalized entry paths avoid counting
the same fixture as a new module in each arm.

Bare stores pay because ordinary whole-value new-key writes are an authorized
core capability, even when a particular fixture does not exercise that route.
The constructor retains that route; esbuild does not specialize it away from the
literal initial shape. Removing preparation, observation enrollment or exception
publication would remove behavior defended by the new regression tests.

## One measured reduction

Four copies of the internal prepared-record map-write/set-add loops now use one
`installTerminalRecord` helper. Call sites retain their guards and exact physical
installation positions. All map writes still precede all set additions; no user
callback, new authority or public API was introduced.

Measured savings from the passing repair: **20 / 33 / 123 / 105 gzip bytes** in the
four table rows. Minified savings are 65 bytes for bare and 353 for entities.
Some duplicated loops predate the new-key work: this is a shared implementation
reduction, not evidence that all removed cost originated in the paired repair.

A second source-level suggestion, factoring member-effect construction in the
transactions path, cannot address these four fixture budgets because that
implementation is not retained. It was not pursued. No other reduction was shown
safe and useful in this bounded audit. This is not a proof of global minimality
or a claim that every remaining byte is theoretically unavoidable.

## Independent verification and limits

`readiness_contract_review` independently checked the retained modules, helper
call sites, build settings, and all 16 measured bundle hashes/lengths/gzip sizes.
No supported semantic difference was identified. The initial and subsequent
measurements of the three frozen arms produced identical bundle hashes and byte
counts; no favorable sample selection occurred.

The optimized source ran its **own** full qualification, not inherited results:

- Kernel: **5,777 ordinary passes, 11 expected failures, 12 skips**.
- Angular 77 passes; React 240 passes / 3 skips; Vue 107; Solid 175.
- Runtime typecheck, spec-types and affected kernel lint pass. No type baseline
  was updated. The unchanged framework warning inventory is in the prior record.
- Fresh package builds, production demo, declaration documentation and packed
  consumer checks pass. Bundler and node16 consumers and facade identity checks
  are included.
- Four bundle budgets fail as shown above. Fresh optimized demo initial is
  **565.09 kB**, estimated transfer **144.48 kB**; this is not a matched incumbent
  demo comparison and is not used to attribute the four fixture costs.

Tests/builds ran in an isolated source snapshot. The five changed files were
verified byte-identical before applying the patch to the managed worktree; all
other runtime/configuration source matches `89bfca62`. Evidence and artifact
hashes identify that isolated output. The managed worktree's older `dist` was not
silently relabeled or copied over.

First failures are preserved: initial experiment setup called git archive outside
a repository and did not create a candidate; corrected setup used the managed
repository. The first restricted demo run failed without a build diagnostic;
the permitted verbose run passed. Consumer packing initially failed with EPERM
writing the default npm cache; a retry using a task-local cache passed. No ownership
repair or sudo command was applied to the user's npm cache. These are distinct
from semantic results and the four actual budget failures.

Build logs retain the existing research TS4111 diagnostic warnings; passing the
package build is not a claim that every research source is type-clean. Dedicated
runtime/spec-type gates passed. CPU, heap and application startup were not measured;
a smaller bundle is not evidence that the helper makes execution faster.

## Production decision

The residual production cost relative to exact incumbent is **673 compressed
bytes for bare stores** and **566 for entities**, for the measured neutral-kernel
fixtures. Production implications are a modest additional transfer/parse footprint
and core new-key support; framework application totals depend on their retained
features. Existing budgets explicitly reject this footprint.

Owner decision remains whether to accept this measured residual cost for the
already-authorized behavior, with a separately chosen headroom policy, or retain
the artifact block. The measured minima are the optimized bytes above; merely
setting a ceiling to those exact values leaves zero headroom. **No ceiling increase
has been made or assumed.** Correctness acceptance, artifact acceptance and v16
readiness remain separate. Further substantial reduction would require a new
specific hypothesis, not reopening B or deleting required safeguards.

## Reproduction

Node **24.15.0**, pnpm **10.17.0**, esbuild **0.25.12**. All arms use the same existing
node_modules directory, not independently resolved dependencies. The authoritative
budget script is byte-identical in the three original arms, SHA-256
`0ee05f69355c6f085096735333c88b6b5ff568df2604b2d34a0833a78e8de944`.
Bundling: ESM/browser, minified, tree shaking, no legal comments, external
`@angular/*`, `rxjs`, `rxjs/*`, `tslib`; production defines `ngDevMode:false`,
development leaves it undefined. Metafiles add measurement only. Both unchanged
fixtures execute and assert their actual result in every arm.

```sh
# Run from this repository; destination must not exist.
python3 docs/audits/2026-10-17-incumbent-readiness/artifact-cost/setup.py "$PWD" /private/tmp/st-cost-replay "$PWD/node_modules"
# Node/pnpm versions above must be on PATH.
(cd /private/tmp/st-cost-replay/incumbent && NX_DAEMON=false pnpm nx build kernel --skip-nx-cache)
(cd /private/tmp/st-cost-replay/prepair && NX_DAEMON=false pnpm nx build kernel --skip-nx-cache)
(cd /private/tmp/st-cost-replay/paired && NX_DAEMON=false pnpm nx build kernel --skip-nx-cache)
(cd /private/tmp/st-cost-replay/shared && NX_DAEMON=false pnpm nx build kernel --skip-nx-cache)
node docs/audits/2026-10-17-incumbent-readiness/artifact-cost/measure.mjs /private/tmp/st-cost-replay shared
```

Optimization qualification commands, from the shared arm:
`pnpm nx run-many -t test --projects=kernel,angular,react,vue,solid --skip-nx-cache`,
`pnpm run typecheck`, `node tools/check-spec-types.mjs`, `pnpm nx lint kernel --skip-nx-cache`,
`pnpm run build:all`, `pnpm run build:demo:prod`, `node tools/check-bundle-budget.mjs`,
`node tools/verify-consumer-typecheck.mjs`, `node tools/check-declaration-docs.mjs`.
Set NX_DAEMON=false; for packing use a writable task-local npm_config_cache.
The budget command is expected to fail. `evidence.tar.xz`, `results.json`, and
`manifest.json` preserve raw builds, tests, probes, output bundles/metafiles and hashes.
