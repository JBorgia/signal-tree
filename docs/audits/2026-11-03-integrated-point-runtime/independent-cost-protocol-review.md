# Independent cost protocol review

Reviewed prepare-cost.py, its referenced prior campaign.py, child.mjs, heap harness protocol, analyzer, schedule and bindings by source/receipt inspection only. No campaign preparation, children, tests or builds were executed by this reviewer. No repository files were changed.

Outcome: no protocol blocker demonstrated after the endpoint clarification below. Actual selected build-receipt verification remains pending after the build, as does inspection of generated bindings/schedule/preregistration before launch.

The initial decision text named pointCPU and populatedliveheap without exact analyzer metric names. This could permit selecting a favorable endpoint after results. The revised generator now explicitly requires point.sync_cpu_ms and heap-populated.live_minus_baseline_bytes, both selected-lower beyond registered variability, together with the unchanged point gate. It separately records the construction workload as 100-row fixtures, 200 measured iterations and 20 warmups. The original ambiguity is resolved in the reviewed generator; cost-intent.json also identifies synchronous CPU and live-minus-baseline.

Construction argv is correct: replacing the final kind/size arguments produces construction 0. Zero is the dispatch parameter, not an empty fixture. The unchanged harness constructs/populates 100 rows, checks count and destroys the tree in each iteration.

The copied retained corrected-five-build receipt describes frozen fe18 and is appropriate for this comparison. Exact retained artifact-map equality adds identity evidence. The selected prototype-five-build receipts were not yet available during the initial review; successful exit alone will not establish agreement with the final source/artifact binding. Inspect those actual receipts and generated maps before launch.

The proposed 48 children preserve two retained A/A controls plus five alternating pairs per profile, fresh serial processes, no favorable retries, resource/integrity guards and separate uncertainty classifications. Required endpoints are not confidence intervals or equivalence tests. Other dimensions must remain separately reported; no gain compensates for a regression or unresolved release cost.

This is a bounded screen, not full runtime-cost acceptance or adoption. Projection and confirmation/rollback timing are omitted; the heap-pending profile is not a substitute for those timing workloads. One populated size cannot establish scaling. Whole-process heap deltas do not attribute retained storage to a mechanism; finite WeakRef clearance does not prove universal collection. No v15 comparison, production SLO, allocation/dominator conclusion or release qualification follows from this packet. Semantic and absolute-work evidence remain independent of cost results.

## Generated-packet preflight addendum

Independently inspected the actual generated cost/BINDINGS.json, PREREGISTRATION.json and SCHEDULE.json and recomputed their registration hashes plus the campaign hash. A read-only Python verifier also reread both bound source manifests against current source files, both 193-file artifact maps against actual artifact file sets/content/executable bits, and build command/result hashes. No discrepancy was found. The retained artifact map equals the prior retained map exactly.

Selected prototype-five-build COMMAND and RESULT both bind source manifest 6a0a70ecea51e90a0b0bd8f5783f462e8c0ea0fd1258d220983fee724dc0f67c, matching the selected campaign source manifest. The build exits 0 with timeout false, no guard reason, no source mismatches and no remaining owned processes. Retained corrected-five-build binds its historical ab8cb3731fe647d220d03e988793889dbbaac9b2faefeba10ef13e4ded36333d build manifest and exits 0 with the same clean guard/drift/survivor fields; the current retained source manifest has a different record scope/hash, so those two full manifests are not claimed byte-identical. Prior frozen-artifact equality supplies the retained artifact continuity evidence.

The generated schedule contains exactly 48 distinct IDs, 12 each for construction, point, heap-populated and heap-pending. Every ID agrees with profile/size/arm/label, ordinals are sequential, and every argv selects its matching profile/size, arm artifact root and timing or corrected heap harness. Construction argv is construction 0, with its actual 100-row workload explicitly registered. Exact required metric names are present in the generated preregistration.

No concrete launch blocker demonstrated by this preflight. This addendum verifies packet identity and source/receipt structure, not measurement outcomes. No cost child, test or build was run by the reviewer. The controller-reported built point counts of 1800 at both sizes are not independently remeasured here. Per-child harness/dependency/resource checks remain the campaign runner's launch/runtime obligations. All bounded-screen and omitted-workload caveats above remain in force.
