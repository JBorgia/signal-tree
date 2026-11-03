# Structural-store preparation split: independent interpretation audit

**Worth preserving as a bounded reduction candidate, not as a completed budget fix or proven performance improvement.** The frozen comparison demonstrates a real **323-gzip-byte plain EntityMap reduction**, with the selected enhanced fixture effectively unchanged. The source split is narrow and leaves value preparation/installation ownership intact. Timing effects remain unresolved; small aggregate heap increases and all failing gates must stay visible. There is no ceiling approval in this assessment.

Read-only audit of `artifacts/store-preparation-split-2026-10-14`: scripts, bundle receipts/metafiles/saved bundles, both archived JS graphs, all 24 cost outputs, receipts/inventories/summary, validation logs, and scoped temporary source against clean `5c29bceb` in the capture-point-owner worktree. No tests, builds or measurements rerun; no production edits. Only this report written. Calculations/checks below used read-only JSON parsing, hashing and source diff inspection.

## What was actually changed

The temp source `/private/tmp/signaltree-store-preparation-20261014` changes `StructuralStore.prepareTarget` to pass its current lifetime/revision maps to an injected `prepareStructuralTarget` algorithm. The store imports its type only; optional `prepare-entity-target.ts` imports/passes the implementation. `installPreparedTarget` stays unchanged. **EntityValueStore is unchanged**, including its retained-value overlay preparation. Do not characterize this as extraction of both stores' preparation.

The extracted algorithm keeps duplicate-key/identity and order validation, inactive records, revision-default-zero arithmetic, replacement rather than mutation of changed records, fresh order nodes/indexes, and frontier identity. The bridge reads current maps on each call; it does not cache maps across installs. This addresses the earlier premise's main counterexamples without a new persistent authority or public API.

Source-level caveat: the helper receives map references once per invocation, whereas the old method repeatedly read `this.subjectStates`/`this.subjectRevisions`. A contrived reentrant direct internal target getter/iterator that swaps the store mid-preparation could distinguish them. The ordinary caller supplies mapped subject records and the established internal target order; this is not evidence of a supported-path regression. It does mean “equivalent for all imaginable internal inputs” is stronger than the review establishes. No new stale-plan or hostile-callback safety policy should be inferred.

## Matched emitted results

`compare-bundles.mjs` uses matching plain/enhanced workloads across arms, esbuild browser ESM/minification/tree shaking, `ngDevMode=false`, the same externalization settings, and gzip level 9.

| Fixture | Before raw / gzip B | After raw / gzip B | Change raw / gzip B |
|---|---:|---:|---:|
| Plain EntityMap | 87,504 / 26,447 | 86,390 / 26,124 | **−1,114 / −323** |
| Transactions + restoration | 254,188 / 74,292 | 254,182 / 74,287 | **−6 / −5** |

Plain gzip improves about **1.22%**. The enhanced −5 B is effectively neutral for this fixture/toolchain, not a meaningful general enhanced-size improvement.

Metafiles explain the result: StructuralStore's emitted contribution falls **8,489 → 7,375 raw B** in both fixtures. The optional helper contributes **1,105 raw B** only in after-enhanced; no positive helper contribution appears in after-plain. EntityValueStore remains **480 emitted B** throughout. Input/module raw contributions are not separately additive gzip savings.

The script's exclusion assertion checks this named helper's emitted contribution, not absence of every preparation facility. Store bridge/install methods, value preparation and other entity machinery remain. Browser-target bundles are smoke-executed in Node: both arms assert final IDs, one held row value and scalar after enhanced reorder rollback. Plain update repeats the existing value. These are useful behavior checks, not comprehensive observer/identity/exception or actual-browser coverage.

## Identity and provenance

- All four saved bundle hashes and every recorded input hash currently match their bundle receipts.
- Cost pre/post JS inventories match, and current frozen contents match them: **99 before files / 100 after files**. Only structural-store and prepare-entity-target JS change; prepare-structural-target JS is added.
- This experiment's entire before JS inventory equals the prior outer-split v2 candidate inventory. The bundle baseline is therefore the already-extracted outer algorithm, not the earlier unsplit entity implementation. Do not credit this experiment with the prior 500-B plain reduction.
- Driver and harness hashes match the cost protocol. All **24** successful receipts match the reconstructed seeded schedule and corresponding unique raw round/arm/mode outputs; commands target the recorded frozen arms. Outputs report production mode, 500 warmup, 5,000 iterations, and expected preparation counts. All cost stderr files are empty. Summary statistics reproduce exactly from raw values; completion records 24 runs and unchanged inputs.
- Recorded cost interval: **2026-10-15 04:09:40.069211–04:10:01.820725 UTC**. Timed blocks span **577–896 ms**.

These provide strong experiment-byte identity, not a complete source-to-build attestation. The source diff matches the changed-module scope, but no independent rebuild was performed. Hashes cover dist JS, not every dependency, package metadata, toolchain or environmental setting; endpoint equality is not continuous filesystem monitoring. Logs and later test edits are not automatically tied to the exact measured build by source receipts.

## Timing and memory tradeoff

The six fresh-process pairs per mode execute 16-row reverse-order setAll plus a scalar transaction. Each iteration checks pending count 1→0, IDs/scalar and every post-settlement row value. Binding instrumentation counts **5,500 preparations including warmup for rollback**, **zero for confirm**. This verifies the intended exercised path. Confirm is a non-preparation path, **not A/A**.

| Mode | Median paired after/before wall ratio (range) | Median paired process CPU ratio (range) |
|---|---:|---:|
| Rollback | 0.9976 (0.9761–1.0129) | 0.9964 (0.9677–1.0476) |
| Confirm | 1.0005 (0.9485–1.0513) | 0.9886 (0.9585–1.0487) |

These are medians of within-round ratios, not ratios of arm medians. All ranges cross parity. Rollback wall pairs split three faster/three slower. Confirmation's apparent CPU benefit cannot be attributed to executing the extracted helper, because it never calls it. No clear material timing shift is resolved; neither zero overhead nor a measured speedup is established. Do not select favorable medians while ignoring roughly ±5% pair excursions.

Rollback heap-delta medians: **268,904 → 272,828 B**, +3,924 B. Paired differences: **−3,008, +42,944, +6,944, −13,344, −568, +16,512 B**, median **+3,188 B**. Confirm medians: **230,152 → 230,496 B**, +344 B; paired differences **+928, −2,072, +7,416, +216, −50,728, +50,224 B**, median **+572 B**. These are variable whole-process observations, not zero memory cost or evidence of a leak.

Limits remain: synchronous checked work includes assertions, row materialization/access, instrumentation, settlement and incidental GC, but excludes setup, warmup, deferred flush, explicit GC and destroy. Process CPU can include multiple runtime threads. One task boundary plus three forced GCs is not convergence or object-collection proof. Only one row count, operation count and serial successful workload is measured; no construction/ordinary mutation benchmark, heap paths, multiple retained batches, framework scheduling or failure-path timing. No quiet-host certificate, A/A or confidence/equivalence bound exists. Even with the same child hash as the previous experiment, do not pool its host run or infer that it cancels the earlier experiment's unfavorable observations.

## Validation: preserve successes and failures separately

- `full-suites.log`: all five project test targets succeed. Recorded pass counts are kernel **5,742**, then **74 / 237 / 172 / 104** for the other project runs, with expected failures/skips retained in the log.
- `store-controls.log`: three focused tests pass. Inspection confirms they exercise inactive/restorable/nonrestorable records, revision preservation, typed keys, frontier identity, no preparation mutation, current maps after install and allocator preservation. The malformed-target cases cover duplicate subjects, unknown/nonrestorable subjects and bad order; they do not individually exhaust every validation branch, such as two distinct valid subjects sharing one key. Do not call them exhaustive.
- Source typecheck log has no reported errors; spec-types reports OK under its existing ratchet. Lint reports 19 warnings matching its baseline, zero errors. Public API and invocation inventories match, the latter with **237 entries**. These are inspected recorded results, not reruns.
- **Package budget fails:** production bare **11.64 / 10.25 KB**, entities **25.46 / 22.6 KB**; development bare **13.99 / 12.45 KB**, entities **28.22 / 25.25 KB** (displayed values from the gate). Matched fixture reduction does not convert this result into a pass.
- **Production demo also fails its initial-bundle budget:** **563.16 kB** against the **550 kB** error ceiling, **13.16 kB over**. It additionally exceeds the 525-kB warning threshold. Do not describe the demo as green because chunks were emitted.
- **Built-package dev-mode check remains unqualified:** `check-4.log` first fails for missing Angular dist. Separate `devmode-source.log` passes explicitly labeled source probes for five packages and neutral no-process behavior; it explicitly does not qualify built packages or NODE_ENV-only automatic removal. It is narrower evidence, not a replacement pass for the failed gate.

## Preservation recommendation and limits

Preserve the narrow structural split as an independently reviewable candidate: it cuts the intended emitted dependency, saves 323 gzip bytes on a matched plain fixture, and adds no meaningful size penalty in the selected enhanced fixture. The source boundary is small; leaving the tiny value preparation method intact avoids an unproven extra seam. Existing semantic/test evidence is favorable, with no supported-path blocker identified by this interpretation audit.

That recommendation is **not** authority to integrate, publish, raise ceilings, declare runtime equivalence, or dismiss the budget/demo/dev-mode failures. The reduction is modest and insufficient to meet current ceilings. Keeping the original implementation remains reasonable if the owner values its tighter encapsulation above these bytes. Preserve the experiment's raw evidence and unfavorable observations whichever implementation is chosen; no further scope expansion follows from this result.
