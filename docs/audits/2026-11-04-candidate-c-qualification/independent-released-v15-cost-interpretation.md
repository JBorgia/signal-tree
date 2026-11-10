# Independent released-v15 / Candidate-C ordinary-cost interpretation

Disposition: this fresh comparison establishes a substantial observed ordinary-workload cost gap against the actual published15.4.4 kernel artifact. C is higher on the principal construction, point synchronous/total CPU, point wall and populated-live-heap metrics under the registered descriptive variability rule. This does not identify unavoidable semantic overhead, establish capability parity, create a production SLO or authorize adoption.

Read-only review. No workloads, tests, builds or profiler children executed. Lightweight offline verification read raw outputs, recomputed metrics and checked artifact/provenance hashes. No repository files changed. Only this requested review artifact is written; other reviewer verdicts were not used.

## Provenance and completion

- Registration SHA256 `d47a8e22a16ad84ba094a78ec11345c4e8b8cc57e03415182442f24ead88fafd`.
- Bindings SHA256 `1172dd43c3b043fbc13fde772ce381b6ed413790b7e78ac38952b22b1809bfd5`.
- Distributions SHA256 `d90d4c9a1f3f39003a0764f6ab22a7e1978402f1cbe8e97eb008b43be303dc80`.

The24 scheduled children all completed valid, with no failed profile, source/input mismatch or global stop. Each profile has two separate released-v15 A/A controls and three alternating A/C comparison pairs. This is three comparative samples per arm/profile, not eight per arm, and no old cost samples are pooled.

The retained arm is the original published npm `@signal-tree/kernel@15.4.4` tarball, not a checkout or local v15 build. Independently reverified its recorded SHA512 registry integrity, registry SHA1 and SHA256; all109 archived payloads match the extracted artifact manifest. The selection is tied to the preserved registry record/version identity. This review does not perform a new registry fetch or claim it independently authenticated npm's signing keys/attestations.

C is a fresh local build, bound to the actual final-clean-build command/result and source manifest, not a copied frozen-fe18 receipt. Those receipt hashes match, the build exits0 without source mismatches, and the qualification equivalence record matches all193 rebuilt package bytes/executable bits to retained Candidate C (`9aa20563b72ad73bc4a1ae736181ffebd73dc418`). Independently rehashed all109 retained and193 selected manifest files at their bound roots. Both harnesses and the analyzer/runner/schedule hashes agree with registration. The earlier launch-before-registration setup failure is separately preserved and records zero launched measurement children, so it is not a favorable retry of a measured sample.

`V15-REGISTRY.json` is a selected metadata/provenance record containing a hash of its original metadata response; it is not itself the original full response whose hash is quoted. Do not describe the selected-record file's bytes as that raw registry response. The tarball integrity/payload verification does not depend on confusing those two files.

## Workload meaning

- Construction is200 measured iterations after20 warmups. Each creates a fixture with16 scalar fields and100 three-field entity rows, checks row count100, then destroys the tree. `size:0` is dispatch metadata, not an empty tree or zero rows. Destruction/fixture setup allocations are part of this measured construction task; module import and initial runtime initialization precede timing.
- Point is2000 measured writes after200 warmups to the SAME warm row in a1000-row collection. Every timed write checks its resulting value. This is not the original work-counter workload of200 distinct subjects at2000/20000 rows, and these batch times cannot be attributed to that count gate directly.
- Populated heap holds ten unenhanced1000-row fixtures after equal population/read-count checks. It uses the corrected synchronous-scope heap harness and identical64KiB/three-stable/forty-turn protocol. There are no pending transactions in this profile.
- Node24.15.0, production `ngDevMode=false` before imports, common installed dependencies including tslib2.8.1, fresh processes and the same bodies/arguments are bound. The v15 package format and C's current package build are the actual compared artifacts; no source-rebuilt v15 normalization is claimed. C's193-file seal includes all facades, but this benchmark imports/times the kernel, not all five facades or an application render.

These are meaningful common ordinary outcomes. They do not exercise full construction contents, lifetime/structural restoration, pending ownership, late consumers, publication, framework rendering, backend authority or advanced capability equivalence. Count-only construction/population checks are narrower than a complete semantic-conformance suite. No invalid comparison is demonstrated for the stated ordinary baseline question; broader capability or necessity claims would exceed it.

## Independent raw recomputation

Recomputed all26 metric summaries/classifications from each child's raw `stdout.json`: same sample membership, medians, differences, A/A ranges, range-overlap and direction, with no discrepancy. The registered rule requires nonoverlapping sample ranges AND absolute median difference above the maximum same-arm/A/A range. It is descriptive, not a confidence interval, p-value or equivalence test.

| Metric | Released15.4.4 median | C median | C/released median ratio | Registered direction |
| --- | ---: | ---: | ---: | --- |
| Construction synchronous wall, ms /200 fixtures | 65.801917 | 547.886667 | 8.33× | Higher |
| Construction synchronous CPU, ms /200 fixtures | 101.742 | 767.993 | 7.55× | Higher |
| Construction total CPU through two drain turns, ms | 102.011 | 789.166 | 7.74× | Higher |
| Point synchronous wall, ms /2000 writes | 6.608333 | 34.070625 | 5.16× | Higher |
| Point synchronous CPU, ms /2000 writes | 13.100 | 55.844 | 4.26× | Higher |
| Point total CPU through two drain turns, ms | 13.444 | 55.972 | 4.16× | Higher |
| Populated live minus process baseline, bytes /10 fixtures | 4,725,192 | 17,724,528 | 3.75× | Higher |
| Populated settled minus process baseline, bytes /10 fixtures | 4,752,968 | 17,752,304 | 3.73× | Higher |

For scale, the observed point synchronous CPU gap is42.744ms over2000 measured updates; the construction synchronous CPU gap is666.251ms over200 measured create/populate/check/destroy tasks. These are batch process-CPU differences, not isolated setter latency or a per-frame rendering budget. Process CPU can exceed wall time because it includes process activity beyond a single synchronous instruction stream.

Construction drain median is0.37775→6.445ms, but ranges overlap and C's14.167332ms same-arm range exceeds its6.06725ms median change: unresolved. Point drain median is0.27275→0.180708ms; even with nonoverlapping ranges, the0.092042ms median difference is smaller than the0.115ms observed same-arm range: unresolved. Do not report either drain change as established, and do not use them to replace the previous C/frozen-v16 diagnostic/cost results.

The populated live-minus-baseline gap is12,999,336 bytes over ten1000-row fixtures. This is a whole-process delta, not13MB of identified native history objects or a derived universal per-row slope. The destroyed-minus-baseline tail is599,184→1,443,984 bytes, while all eight heap children report zero of their10 sampled live tree WeakRefs. Tail heap and tree collection are different observations; a retained-tree leak is not demonstrated by that residual. Imports, warmed runtime/code state and other process effects limit object attribution.

## Practical interpretation and limits

C's ordinary costs remain multiple times those of the released v15 artifact on these specific checked workloads, despite its improvement over frozenfe18 in another separately bound cohort. It would be incorrect to infer v15 parity from passing C's absolute point-work gate or from its small populated saving against fe18. Conversely, this comparison cannot prove that the entire gap is implementation waste: v16's added responsibilities are not capability-matched or isolated here.

The raw records show Apple M4 and substantial host load in both arms. One heavy slot and abort thresholds are operational controls, not exclusive-core/unloaded-machine guarantees. The large gaps exceed this cohort's registered variability threshold, but absolute times/ratios should not be generalized to other hardware, row widths, store counts, cold/hot patterns, frameworks or real applications. Three samples per arm and two A/A controls are limited descriptive evidence.

The two pinned artifacts answer a useful product question: what ordinary workload cost does Candidate C currently impose compared with the actual released baseline? They do not answer the value of the extra guarantees, whether those guarantees could be implemented more cheaply, whether v15 can satisfy the full native overlap contract, or whether an explicit owner cost exception is appropriate. No budget change, semantic reset, architecture selection, promotion or release authority follows. Pending/drain HOLD remains independently open.
