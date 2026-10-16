# Independent interpretation review

Reviewed 2026-10-16. Scope: causes.md/JSON, inventory.md, cost.md, classification/profile/instrumentation scripts, preserved raw evidence, and selected candidate source. Candidate HEAD independently verified as 9b9b0b35a7dd207df366047ef5c9621168a2b405 with clean status. No runtime or documentation edits. This is a bounded evidence review, not release acceptance or a full-suite rerun.

## Verdict

No material overclaim blocking use of the report **with its stated limits**. The evidence establishes a rejected incomplete production integration, several concrete missing state/publication translations, and a substantial sampled ownership-computation cost center in the particular successful entity rollback workload. It does not establish that sparse ownership is intrinsically incompatible with the library or select an alternative architecture. The report preserves that distinction.

## Independent checks

- Counted 684 unique original identities in causes.json; family totals reproduce 400/105/14/34/44/35/8/6/38. Its input SHA-256 matches the preserved verdict-diff input. Classification is predominantly filename/stack classification, not 684 first-divergence traces; the report explicitly says so.
- Independently recomputed time-delta weighted exclusive and inclusive shares from all 12 raw CPU profiles. All published rounded shares reproduce, including candidate core-inclusive 52.7%/56.4%. Verified all 12 recorded executions exited 0. Median process CPU/cycle reproduces 54.5334/89.4892 us at 32 and 52.8467/94.6241 us at 1024.
- Rehashed all 100 baseline and 102 candidate package JavaScript artifacts against artifact-hashes.json; no mismatches. This verifies current artifact integrity against the manifest, not an independent rebuild/source-to-output proof.
- Examined the profiling harness and instrumentation wrappers. The profile workload keeps the intermediate visible-value, successful rollback, inspection, and retry obligations. Setup and 31 cycles occur before profiling. The counter wrapper resets after warmup and retains the same cycle. Preserved inner counters match the published 697/86 and associated work figures; selected core source verifies entityView cloning, unconditional affected-entity occupancy processing, and export preparation. No counter-run timing is used as benchmark evidence.
- Executed the existing publication-replay.mjs with Node 24.15.0 for both preserved bundles. Baseline exits 0 with [1,0]; candidate exits 1 with [1]. Both read direct 0 immediately after rollback; only baseline subsequently delivers path/owner 0 during the same eight-microtask flush. This is an actual reproduced event-publication divergence with unchanged original assertions, not a stale-computed inference.
- Inspected scalar seeding/settlement and entity capture source. Scalar seeding happens once; settlement trusts sparse targets; the capture builder lacks restore-subject translation. Preserved scalar restoration logs show baseline undo1/reject1 versus candidate undo1/reject2, while the entity variant remains1 in both. This supports the narrower scalar counterexample and guards against generalizing it to every restoration route. I did not independently rerun that restoration probe.

## Interpretation boundaries to retain

1. The 400 group is a common detection guard, not a demonstrated common originating event. The absent restore-subject case is a source-proven omission; the report correctly refuses to assign all 400 to it. Likewise the 105 presence group is not 105 independent causal reproductions.
2. CPU percentages are separate-denominator sampled main-thread residency. They cannot be multiplied by the process-CPU regression to produce causal regression shares. Core-inclusive overlaps persistent-map/clone self shares. The report correctly separates these and acknowledges profiling overhead and concurrent GC limits.
3. The measured cycle is one field in one entity, one live owner, no application observers, with steady-state rollback. It says little about initialization, retained-history growth, wide/nested entities, active-observer delivery, or multiple overlapping owners. Candidate correctness elsewhere remains rejected. Ordinary scalar performance and comparative corrected designs are not established here.
4. The inventory supplies necessary coverage questions, not proof that every listed bypass is publicly reachable or that both proposed authority arrangements are feasible under all existing contracts. It correctly labels selection, private fallback, and some composition issues unresolved. No architecture winner follows from these observations.

## Minor wording precision

The JSON field firstDivergenceOrHypothesis for every unsupported-member-presence row says “First missing fact is presence,” although its causalStatus correctly says provisional and the prose qualifies the grouping. For standalone machine consumption, change that sentence to “Missing presence translation is a source-established candidate mechanism; this identity's first divergence remains untraced.” This is a local labeling refinement, not a reason to reject the aggregate analysis.

“artifact-hashes.json hashes every loaded package JS artifact” is defensible as coverage because it hashes all JS in the package output, but the script does not trace actual module loading. “Hashes every package JS artifact in each profiled output directory” is the exact reproducible claim.
