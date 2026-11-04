# v16 candidate improvement and qualification

**Disposition: HOLD for runtime-cost and point-work acceptance.** Production/package size has owner disposition; its numerical gates remain reported without changing ceilings. No activation or publication is authorized.

Runtime/tool checkpoint: `fe18a8e1c1f3da42727341d6c6fa30a407c1461e`. Five-package artifact seal: `sha256-7892fe8daaff3c11fce09d3d5f2a4614ad5cadb45bdb0b8369ab94450a7940d9`. The clean rebuild after all 24 companion checker controls reproduces all 193 stage artifacts. Before arm: sealed pre-trial v16 `c2127a34b2fdd162ea1bd7bb2000f4815a2d8461`. This is not a newly sampled v15 comparison.

## What changed

The finite work closes lint and benchmark hygiene and implements three reviewed local reductions: omit preliminary native proof when no captured frame consumes it; specialize native-only publication composition; reuse ordinary row maps only for subjects unique in the complete admitted sequence. The final correction avoids allocating a repeated-subject Set for singleton packets. Native owner-window sampling, enrollment/sealing/installation/completion guards, physical snapshots and repeated-subject images remain intact.

Lint now covers five packages, both applications and tooling: nine configured scopes. Its ratchet is tightened from 19 to 11 existing warnings, with no errors. White-box imports and the four intentional finally throws have exact-line explanations. Inert fixtures are explicit; fixture presence checks preserve receivers and generic typing. Runtime narrowing/overloads preserve strict public types.

Benchmark stores are destroyed, randomized workload data is seeded, construction is timed separately from verification/teardown, root replacement is named accurately, and fake random memory readings are removed. No work or timing threshold was raised.

## Fresh before/after costs

Generating commands: `python3 cost-final/campaign.py`, then `python3 cost-final/analyze.py`, under `/private/tmp/st-v16-improvement`. The copied harness, source/artifact/dependency hashes, schedule, environment and all receipts are in the evidence archive. Each profile uses two before-arm A/A controls and five alternating before/after pairs in fresh Node 24.15.0 processes: 84 checked children, no failures/retries/mismatches. Assertions remain inside timed loops; setup/import/build are outside.

| Workload | Before wall ms | Final wall ms | Before CPU ms | Final CPU ms | Registered interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| bare | 51.968 | 47.268 | 107.386 | 107.346 | wall selected-lower; CPU unresolved |
| point | 32.864 | 31.032 | 69.989 | 66.082 | wall unresolved; CPU unresolved |
| projection | 15.640 | 13.690 | 21.403 | 19.338 | wall unresolved; CPU unresolved |
| confirm | 23.449 | 22.739 | 36.094 | 35.513 | wall unresolved; CPU unresolved |
| rollback | 40.501 | 40.396 | 66.061 | 68.234 | wall unresolved; CPU unresolved |

Workloads: bare = 20,000 scalar write/read steps across a 16-field store; point = 2,000 single-row update/read steps in a 1,000-row collection; projection = 200 update/all steps; confirm/rollback = 200 checked mixed scalar/entity turns. Full distributions and every scalar metric are retained; medians alone do not establish significance. The registered overlap/same-arm-variability rule is not a confidence interval. The one supported wall-time reduction does not establish a CPU reduction, per-trial attribution, a production SLO or runtime-cost acceptance.

- heap-populated, live_minus_baseline_bytes: 17,747,408 → 17,757,208 bytes; selected-higher.
- heap-pending, live_minus_baseline_bytes: 20,471,488 → 20,480,024 bytes; unresolved.
- heap-pending, pending_live_minus_idle_bytes: 1,029,000 → 1,033,568 bytes; unresolved.
- heap-pending, settled_minus_baseline_bytes: 20,381,296 → 20,395,800 bytes; selected-higher.

Heap workloads hold ten 1,000-row trees. These are whole-process post-quiescence deltas, not dominator attribution or per-row growth measurements. Populated/pending pre-drain process heap is lower, while persistent populated heap is not recovered. All 24 heap children clear sampled tree WeakRefs after teardown; finite collection evidence does not establish universal absence of leaks. Forced-GC convergence is 64 KiB / three stable samples / at most 40 rounds.

Operational protocol: serial fresh processes, 180 seconds per cost child, sampled 4 GiB owned-RSS stop and macOS memory_pressure free percentage floor 25%. There is no exclusive-core or calibrated production-device claim. The first d343 cohort remains separately preserved under `cost/`; it is not pooled with the corrected cohort.

## Causes and remaining decision

Ordinary writes still prepare native publication support, requirements, records, finalization and completion so later consumers can read truthful history. Per-row ordinary/physical support maps remain live with the tree. The source identifies plausible mechanisms; these measurements do not numerically attribute bytes or CPU to individual components. The local reductions do not remove that persistent responsibility model.

The point-work check still counts 13,000 visits across 200 updates at both 2,000 and 20,000 rows, versus its unchanged `<2,000` bound. Tested size independence passes. This instrumentation charges array/collection traversal representations; it is not a CPU-instruction or application-latency counter. The absolute bound remains a failure requiring reduction or explicit owner disposition.

## Qualification scope

Fresh seven-project ordinary tests are partitioned into explicit Nx invocations after a combined invocation crossed the unchanged 4 GiB guard. The kernel serial run completes below 3 GiB, with 7,184 ordinary passes, five expected failures, 12 skips and the one point-work failure. Angular/React/Vue/Solid/reference app pass; demo has 175 passes and four skips. No code-coverage percentage is claimed.

The changed lint gate has a fresh outer mutation proof. All 24 registry companion checker controls pass; they run before the final clean artifact rebuild. Predecessor full outer mutation evidence remains bound to its original source, and is not described as fresh proof for this candidate. No full release-green invocation is claimed.

Current results are recorded in [QUALIFICATION.json](QUALIFICATION.json): 85 of 86 explicit registry baselines pass; the numerical bundle-budget failure has owner disposition. The separately completed seven-project behavior scope retains the point-work failure. Installed tarball, strict bundler/Node16-resolution and Angular production-AOT consumers pass. The production-built demo passes all 28 browser checks without skips/flaky/unexpected results. Production review builds use the committed production options with only budget diagnostics overridden to an empty list under the owner’s size disposition. Committed budget ceilings remain unchanged. The browser exercise covers inventory CRUD/query/held-reference/teardown and independent publication while a proposal is pending, followed by rollback and confirmation. This is the production-built demo application, not a backend-authentication or external production deployment proof.

A final source/document identity and durable evidence index accompany this record. The current controller is the sole acceptance ledger; historical first failures and sealed predecessors are preserved.

## Durable evidence

- [Archive identity](ARCHIVE.json) and [replay evidence](qualification-evidence.tar.gz).
- [Member index](EVIDENCE-INDEX.json), including exact before/final package bytes and production-demo bytes. Dependencies and regenerable caches are excluded.
- [Cost distributions](COST-DISTRIBUTIONS.json), [protocol](COST-PROTOCOL.json) and [source/artifact bindings](COST-BINDINGS.json).
- [Independent reviews](INDEPENDENT-REVIEW.md) and [final process census](FINAL-PROCESS-CENSUS.json).
- [Production demo artifact hashes](PRODUCTION-DEMO-ARTIFACTS.json).

First failures are retained: initial lint diagnostics, rejected fixture typing, the combined test invocation’s sampled resource stop, both separate cost cohorts, numerical bundle failures and the temporary production-wrapper setup error. The corrected production review build succeeds with the same source; the wrapper setup error occurred before compilation. No passing result is inferred from an aborted invocation.

The bounded improvement phase is complete. A controlled pilot is supported by the exercised behavior; general production signoff remains on hold for the point-work and runtime-cost decision. A future release still needs the complete current outer mutation proof and authorized release preparation.
