# Independent allocation-oracle review

Disposition: the eight failures are genuine failures of inherited positive-allocation assertions, not runtime correctness passes to relabel. The assertions' historical purpose is probe non-vacuity/useful work, not a product contract requiring new Map allocation. A correction can preserve that purpose with an independent exact positive control for each patched invocation, while recording zero workload events without weakening a numerical ceiling.

## Evidence inspected

Read-only; no tests/builds were run and no repository files changed. Inspected the two current specs, their b0410dc05 source (byte-identical), the expanded-kernel raw log/receipt, linked C7a and singleton component reviews/results, and the current point constructor sites.

- Integration origin: `b0410dc05a503f8981011a80e9f1c838d3a7d6f8`.
- Expanded run receipt source-manifest SHA256: `c5aacadcc182dc445876304320137622073c94e2743c03a502e400158f7c999d`.
- Author-run log: `runs/expanded-kernel-suite/first.log`; 658 files, 7194 ordinary passes, 5 expected failures, 12 skips, 8 failures across the two allocation specs. Exit1; no timeout, guard stop, source mismatches or surviving owned processes.

- `packages/kernel/src/lib/point-result-allocation.spec.ts` SHA256 `83a7a55c64e442f7d4abe2530ea4762b3b38ee1f3c95566df5e3541bf0c2e0ec`.
- `packages/kernel/src/lib/singleton-row-allocation.spec.ts` SHA256 `b9505c0c7d9c57d893d28aae569dcd77736d4dc7ffede5352f5c80d0c7e39e25`.


Each failing cell populated the same width2/32 × size2000/20000 workload, ran200 updates, asserted every updated endpoint and untouched row201, then failed at `measured.containers > 0` with actual0. The following `entries > 0` assertion and optional diagnostic write were not reached. Both exact independent constructor-calibration tests passed, as the sole passing test in each five-test file. These are inspected author-run observations, not an independent execution.

## Historical intent is explicit

`combined-c6-independent/REVIEW.md:40` explicitly preserved the nonzero assertions for C7→C7a. That change was narrowly diagnostic-output hygiene: making a missing output path optional. Its acceptance is not permission to remove other assertions casually.

The same review immediately states at line42:

> The allocation assertions are calibration/useful-work checks, not a newly invented allocation ceiling

`singleton-independent/REVIEW.md`'s measurement interpretation and `singleton-ordinary-row/RESULTS.md`'s constructor-work section explain the actual evidence: proxy the real global Map constructor, count consumed iterable entries, independently calibrate empty/copy construction, keep seeding/assertions outside the200-update region, verify all200 values plus an untouched sentinel, and compare identical workloads/patches between source arms. The original `<2000` point-work gate remains separate and unchanged.

Thus the nonzero floors were deliberate sanity assumptions for an implementation known to allocate thousands of Maps. They helped establish that a probe was observing real constructor work and useful writes. They do not establish a promised minimum allocation count, required container representation, CPU lower bound or retained-heap contract. This conclusion uses the stated rationale and workload, not merely absence of a registry reference.

## Why zero is plausible but not self-validating

The current exact point path can reuse existing unescaped row Maps and avoid the generic constructor sites. Seeding creates retained Maps before the measured interval. Remaining COW/exposure/generic paths still use ordinary `new Map` construction; no cached native constructor alias was identified in the inspected entity implementation. This supports a plausible explanation of zero intercepted Map constructions in that narrow workload.

Zero alone would also be consistent with a disabled/incomplete probe or missing work, so performance intent cannot justify accepting it by assertion deletion. The existing exact calibration and200 endpoint/sentinel checks address two distinct failure modes already. A stronger local correction can maintain an exact positive calibration under the same installed patch in every workload invocation.

## Recommended correction

1. Preserve both specs' widths, populations, initial values,200 update operations, measured interval and all200 endpoint/untouched-sentinel assertions. Do not change the point-work counter or `<2000` threshold. Keep original failed source/logs bound to c5.
2. In each helper, snapshot workload counters immediately after the unchanged `run()` returns. Those exact counters remain the reported `measured` record; do not subtract planted charges from a combined total.
3. With the SAME Map/Array.map interception still installed, reset or switch to a separate calibration counter bucket and execute a known copied Map plus empty Map. Use a known two-entry source created outside the measured workload. Assert exact calibration2 constructors/2 consumed entries and copied/empty contents after restoring patches. For the Array.map helper, independently calibrate one map call with three output entries as before. Assertions themselves must not run under interception and contaminate counts.
4. Return/report workload and calibration counters separately. Replace the two workload positive floors with diagnostic-domain validity checks (finite nonnegative integers; copied entries cannot appear with zero constructors under this helper). The independent exact controls provide positivity; workload values may be zero or positive. Do not invent a new zero-allocation release ceiling merely to match this source.
5. Keep exact positive standalone calibration too, `finally` restoration of global Map/Array.map, tree teardown, optional output semantics and failure for an explicitly invalid output path. Calibration failure must still fail each workload invocation.
6. Focused validation should show every cell passes with genuine zero workload counts and exact positive calibration, while useful state assertions still run. Demonstrate that disabling the constructor interception fails the exact calibration; a no-op update implementation must still fail the existing endpoint assertions. No broad mutation campaign is needed for this diagnostic fix.

This is a change to an incidental diagnostic assumption, but its purpose must be preserved rather than weakened. Do not silently recast the original expanded run as passing: preserve7194/8 first, then identify the corrected-fixture source and focused rerun separately. If runtime source remains identical, that equivalence may be recorded; final aggregate qualification still must distinguish the original full run from any later focused result.

## Limits

The harness sees intercepted JavaScript Map constructor events and iterable entries, plus selected Array.map results in one helper. It does not see all object/array/Set/WeakMap allocations, copied bytes, peak allocation, live heap, CPU or framework stabilization. Zero new measured Maps is neither zero allocation nor a cost-acceptance conclusion. Existing cost cohorts and all production semantic/budget gates remain independently binding.

## Concrete correction review

Read the actual two-spec diff after the preceding recommendation. No execution was performed. No concrete calibration-contamination or oracle-weakening blocker demonstrated within this diagnostic scope.

- `packages/kernel/src/lib/point-result-allocation.spec.ts` inspected SHA256 `83a7a55c64e442f7d4abe2530ea4762b3b38ee1f3c95566df5e3541bf0c2e0ec`.
- `packages/kernel/src/lib/singleton-row-allocation.spec.ts` inspected SHA256 `b9505c0c7d9c57d893d28aae569dcd77736d4dc7ffede5352f5c80d0c7e39e25`.

Both helpers now snapshot the original workload counts immediately after `run()`. They then seed a two-entry Map through the saved original constructor, create an empty and copied Map through the still-installed global constructor, and verify exact constructor/entry deltas plus empty/copy contents. The point-result helper likewise verifies one Array.map result with three entries and exact mapped contents under the same installed Array.map interception.

Although the control checks use differences against the snapshot, those differences are used ONLY to validate the synthetic probe. The helper returns the original snapshot unchanged. It does not subtract planted charges from a mixed workload total or report synthetic constructions as production work. Seed construction uses the saved original constructor, and every diagnostic assertion/output/endpoint check remains outside the intercepted workload. Native Map construction and seed iteration add no Array.map callback in the helper; the explicit mapped control is the one expected Array.map event.

The standalone exact calibrations remain unchanged. The three new removal controls explicitly restore either global Map or Array.map from inside the workload and demand the in-window positive-probe error. Thus the same zero workload count cannot be accepted after a workload disables the interception. Existing `finally` restoration still executes on probe failure; the new controls also check restoration identities. These are source-based observations, not claimed passing runs.

All four width/population cells in each file keep identical seeding,200 updates, all200 updated-value checks, untouched row201, teardown and optional JSONL output. Positive floors alone become safe-integer/nonnegative diagnostic-domain checks. There is no zero-allocation ceiling, no increased upper budget and no change to the original point-work test. Exact control deltas are enforced rather than emitted in JSONL; this is sufficient for the bounded probe-liveness assertion, but do not claim separately recorded raw calibration measurements where the files only report workload counts.

The current runtime entity source and original point-work spec match their c5 manifest entries byte-for-byte at this inspection. Consequently, any forthcoming fixture rerun must be reported as corrected diagnostic source over the same runtime, preserving the prior full run's eight original failures. It cannot retroactively convert that raw run to a passing invocation.
