# Direct whole entity-input capture

This experiment measures `EntityPublicationSource.captureInput()` directly on an
installed neutral kernel. It does not measure application startup, root snapshot
reads, root updater capture, Link enrollment, rendering, or HTTP workflows.

The baseline is `5d04ff65d2eaab1986ed1b420cbc013edc01542b`. Its exact retired
facts are already stored in runs, but whole input capture expands those runs
into one visible and placement View per entity lifetime before deduplicating
requirement references. The selected implementation visits each run once and
selects references into an ordered Set. Ordinary facets and active fields keep
their first-occurrence order. All references are selected before fresh native
inputs sample owner outcomes; every call still issues distinct frozen inputs
and owner arrays. Addressed capture, `captureViews`, and the original point-work
witness remain unchanged.

`inputFactVisits` continues to count executed View visits. The separate private
`wholeInputFactsRepresented` counter records the logical coverage of whole input
capture. Tests independently intercept the actual expanded iterator, with an
expanded positive control; changing a diagnostic counter alone cannot satisfy
the work bound. The preserved baseline fails at 120 executed visits versus 6
and 60 expanded subject yields versus 0 for 60 retired subjects in three runs.

## Reproduce against the sealed artifacts

Restore the baseline and candidate package directories with their adjacent
`bindings.json` receipts. The generator rejects different receipt versions,
source identities, package inventories, or payload hashes. Use Node 24.15.0 and
the repository's pinned pnpm for builds and source tests.

```sh
node tools/experiments/entity-whole-input-capture/capture-cost.mjs plan BASELINE_PACKAGE CANDIDATE_PACKAGE NEW_OUTPUT tiny-calibration
node tools/experiments/entity-whole-input-capture/capture-cost.mjs run NEW_OUTPUT/plan.json
python3 tools/experiments/entity-whole-input-capture/analyze.py NEW_OUTPUT NEW_ANALYSIS.json
```

Omit `tiny-calibration` to register the three-profile main comparison. Each plan
binds the generator, protocol, Node executable, receipts, source identities, and
every installed payload before execution. Keep the original main comparison;
do not overwrite it or pool it with later calibration or tracing runs.

The main study has 42 normal children and three planted controls; the separate
tiny-history calibration has 14 normal children and three planted controls.
Both include alternating baseline/candidate pairs and same-arm variation
controls. Assertions check exact requirement and OwnerCell identity/order,
proof roles and flags, fresh frozen capture objects, meaningful writes, logical
coverage, and independently observed iterator work. Missing captures and
same-cardinality requirement/owner substitutions must fail their named oracles.

## Candidate history and measurement limits

Candidate 1 uses direct ordered Set selection. Candidate 2 added an original
array-path fallback without packed history. Candidate 3 retained the original
ordinary array/spread traversal everywhere and compacted only historical run
pairs. The runtime was restored exactly to candidate 1 after reviewing the cost
interpretation; the stronger ordinary-capture test added later remains.

The November 11 qualification and comparison outputs were stored in temporary
directories. Cleanup removed their regular files before work resumed on
November 16. The selected source, tests, and versioned generators remain in this
checkout; historical summaries alone are not fresh verification or recoverable
raw evidence. New runs must use persistent output directories, newly bound
artifact receipts, and separate plans. Preserve the existing generator version
and its historical receipt pins when updating admission for those fresh runs.

The historical workloads show less executed work and lower CPU for candidate
1. Its no-history elapsed samples also improve, while process-CPU differences
remain within the same-arm variation in that cohort. This is not a universal
speedup or a startup result. The private whole-capture helper does not optimize
other callers that intentionally expand `captureViews`.

Immediate heap-used delta is a collection-sensitive proxy, not total allocated
bytes or peak memory. Candidate 1's higher immediate no-history reading did not
persist at the post-GC checkpoints. A separately registered four-child
`--trace-gc-nvp` diagnostic observed fewer allocated-field bytes and no automatic
collection in candidate 1's capture interval, while baseline and candidate 3
each had an automatic collection. A retained-array positive control verified
that the observed fields detect added allocation. This supports a concrete GC
timing explanation for the proxy discrepancy; it does not recover the GC
schedule of earlier uninstrumented children or identify an allocation site.
No timing claim comes from the instrumented diagnostic.

The strict point-work bound, full source/framework verification, package gates,
and production demo build are recorded separately from these comparisons.
Existing numerical bundle and demo budget failures remain failures; this
experiment does not change their ceilings or grant release approval.
