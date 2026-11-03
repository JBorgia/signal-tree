# Remaining point-work threshold — independent validity audit

**The no-collection-rebuild obligation remains justified. The exact `<2000` value remains an active failing test, but the inspected history does not establish it as a derived absolute cost requirement for today's publication semantics.** This is a reason to resolve the threshold premise explicitly, not permission to change it or label the qualification green. Equal counts do not establish zero performance impact.

Scope: source/history/record inspection only; no runtime, oracle or budget edits, CPU test, attribution rerun or overlapping memory workload. Read the existing c28-r3-point-work-design/REPORT.md and c28-r3-work-attribution/REPORT.md; their completed site attribution is not repeated here. Also read point-work/ANALYSIS.md, review/contributor/support and measurement contracts. Frozen8f9 and812 contain identical granular spec bytes, SHA-256 `83365544bcb4a572988125141bab0c28786a54b5a2279522f3eed0d9b7d9e872`. Root HEAD628d302 retains the older timed variant, so the current counter was inspected in the identified frozen candidate rather than assumed from root.

## What the current failure actually means

`packages/kernel/src/lib/entity-granular-reactivity.spec.ts:184–215` contains two distinct assertions after200 literal writes to distinct rows:

- Line214 requires exactly equal charged visits at2,000 and20,000 resident rows. This targets collection-size-dependent scans/copies for the fixed-width, fixed-write workload.
- Line215 independently requires fewer than2,000 total charges, i.e. fewer than10 charged visits/write on average. Equality alone cannot imply this bound.

The retained R3 attribution log fails at13,000<2,000 after equality passes; the two distributions agree. Thus this is a real absolute proxy-ceiling failure, not demonstrated O(N) collection rebuilding. It is also not a fresh independent812 measurement: no such execution was made here. The later positive calibration in that original test was not reached. Prior separate calibrations and the checked identical histograms are useful evidence without rewriting that fact.

The proxy intentionally counts copy and iteration separately and charges entire array receiver lengths even for early exits or bounded slices. It omits indexed loops, flatMap and much other work/allocation. A number in these units cannot be converted into milliseconds, bytes, predicate executions or a universal operation count. Nor does equality at two populations establish all-size O(1), or independence from field width, history, owners or recipients. It does provide useful discrimination against collection-size scans at its counted sites.

The source graph imports entityMap through the public index, which statically reaches Link registration, although it constructs no Link instance or transaction enhancer. Current native publication preparation is therefore part of this measured graph. Removing those imports to get green would change the workload. The separate no-Link production-bundle control is not interchangeable with it.

## Historical evidence for the threshold

1. Before commit `ef1631b0e6fde99193c5c6b0b8c7f01af300d051`, the test timed200 writes at20,000 rows and asserted `<0.05ms/update`. Its comments expressly called this a loose complexity guard against three whole-collection copies, not a machine-specific service-level target.
2. That commit (2026-10-06) replaced timing with counted work, introduced the2k/20k equality check **and** `<2000`, and added a positive copy calibration. Its rationale describes eliminating load-sensitive timing while detecting O(size) walks/copies. No separate derivation, measured headroom policy or present-day semantic cost allowance for the value2,000 appears in that patch/message.
3. `eb259b3a529f78154727b438fd111654a2769a8f` expanded the counter to searches and Object enumeration because previous mutations escaped it. Its message records killed search/key-listing mutations; it leaves the numeric ceiling unchanged. This supports the counter's complexity-detection purpose, not a calibrated mapping to runtime cost.
4. The earlier integration progress record identifies the timed guards as load-sensitive and due for deterministic replacement. Existing R3 design review explicitly found no contemporaneous passing800-count baseline log. Historical mentions of800 cannot supply a newly verified absolute budget.
5. Current continuation records preserve the absolute failure and explicitly withhold ceiling adjustment. That makes it an operative qualification requirement; it does not retroactively supply the missing derivation.

I found evidence that the proxy's primary historical purpose was complexity detection and that native publication changed constant work. I did **not** find evidence proving either that2,000 remains achievable under all required current semantics or that the entire excess is unavoidable. The earlier concrete reduction options are not such proofs. Calling the number definitively obsolete, or treating the whole excess as mandatory correctness cost, would both outrun this record.

## Options and decision evidence

1. **Retain the existing absolute ceiling and pursue real reductions.** This preserves qualification policy. Existing attribution gives candidates, but no bounded option presently demonstrates enough reduction to meet the ceiling. Keep the failure explicit; do not conceal charges with uncounted syntax or disable support merely because no recipient is installed.
2. **Authorize a separate contract review of the absolute ceiling.** Keep the size-scaling obligation and its counterexample controls distinct from an explicit absolute-cost policy. A replacement absolute guard needs named units/workload, provenance for its allowance, representative evidence for the current semantics and mutation checks that catch additional fixed overhead as well as scans. Do not set a new number just above13,000 because that is the failing result. This would be a deliberate oracle/budget change, not a harmless test repair or retroactive pass.
3. **Defer absolute acceptance explicitly.** Record that the sampled collection-size guard passes while the inherited absolute qualification is unresolved. This is an honest intermediate status, not release sign-off or evidence of acceptable CPU/heap cost.

Recommendation: resolve the absolute-ceiling contract separately before claiming that small representation reductions can close it. Preserve the current red result meanwhile. The evidence supports auditing/re-specifying its rationale, not unilaterally deleting the bound. If the existing requirement is reaffirmed, actual measured work reduction must satisfy it; if changed through the normal authorized process, retain old failures and demonstrate that the replacement catches both scaling regressions and unwanted constant overhead.

Falsifiers: historical commit/test comparisons and frozen-spec hash checks **performed**. Existing raw13,000 failure inspected, not rerun. No new complexity mutation, calibration, CPU timing, allocation measurement or native-semantic lower-bound experiment performed. Any later performance claim requires its own qualified measurements after the serial memory campaign, not inference from this review.
