# Independent final candidate cost interpretation

Reviewed raw artifacts in `/Users/jonathanborgia/code/signaltree/artifacts/v16-acceptance-20261014/cost-final-8d`. No measurements rerun. Conclusion: **the bounded experiment is completed and interpretable, with real observed transaction and enhanced-fixture heap costs. It does not support performance equivalence or a cost-neutral candidate.** Small ordinary-write shifts and short construction blocks require more cautious interpretation than the transaction results.

## Evidence identity and integrity

Baseline `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`; candidate `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Final input seal SHA-256 `fc921e38091bdcb0555e44d9b38425da82d4b3e29a66625cf516b32521624c6f`, matching the recorded invocation. The source/install lock identity and e467 install origin remain separately represented. Baseline build receipt runs `pnpm nx build kernel --skip-nx-cache`; candidate runs the five-package serial build with cache skipped, after certified mutation completion. Their artifacts are compared as built, not inferred solely from source labels.

The generating command is environment.json's Node24.15.0 invocation of `/private/tmp/v16-acceptance-cost-plan-20261014-r5/run.mjs`, with `--inputs .../cost-inputs-8d.json --output .../cost-final-8d --input-seal .../cost-final-input-seal-8d.json --input-seal-sha256 fc921e...`. Measured 2026-10-15 05:19:37–05:20:48 UTC on a 10-core Apple M4, macOS/Darwin25.2.0 arm64, V8 13.6, NODE_ENV=production/ngDevMode=false, no NODE_OPTIONS.

Independently checked: 204 validated samples exactly match the preregistered schedule; every raw stdout JSON matches its validated row; receipts contain 204 exit0 and eight exit1 controls. All eight control stderr files contain their specified AssertionError, including actual held handles and skipped repeated rollback cycles. Recomputed timing/construction ratio arrays and memory paired-difference arrays exactly match summary.json. Plan hashes match the seal. All 108 baseline and 110 candidate staged package file hashes match inventories; before/after recorded original and staged inventories agree. finished.json records complete, 212 children, no failure, identitiesUnchanged=true. This is consistency/provenance verification, not independent attestation of every earlier build operation.

The reported 84/84 gates, 84/84 proofs, 136/136 browser checks and fresh consumer checks are separate correctness evidence. They neither erase measured costs nor convert the 68 violated/168 unsupported supplemental semantic cases into green. This review did not re-audit all those gate logs.

## Checked synchronous operation costs

All ratios below are medians of six same-round candidate / arithmetic-mean(baseline-A, baseline-B) ratios. Wall and process CPU are separate metrics. Work includes assertions, demanded reads and settlement; excludes setup/warmup/explicit GC/destruction and later deferred flush. Incidental GC is included. These are unbundled kernel ESM workloads, not browser render or primitive-write latency.

| Workload | Count per sample | Wall ratio | Process CPU ratio | Wall B/A range |
|---|---:|---:|---:|---:|
| Scalar, 16 leaves | 3,000,000 | 1.003 | 0.974 | 0.917–1.065 |
| Scalar, 128 leaves | 3,000,000 | 1.022 | 0.990 | 0.696–1.185 |
| Demanded derived, 16 leaves | 1,000,000 | 1.010 | 1.040 | 0.866–1.050 |
| Entity update, 16 leaves | 300,000 | 1.028 | 1.015 | 0.943–1.132 |
| Mixed scalar/entity confirm | 12,000 | 1.252 | 1.202 | 0.805–1.014 |
| Mixed scalar/entity rollback | 12,000 | 1.248 | 1.212 | 0.946–1.104 |

**Transactions:** all six rounds exceed both baseline replicates in wall and CPU metrics. Confirm paired wall ratios span 1.133–1.316 and CPU 1.081–1.249; rollback spans 1.220–1.366 and 1.161–1.271. This supports a material observed whole-candidate cost, approximately +25% wall and +20–21% process CPU at the registered medians. It is not credible to dismiss this consistent result merely because the host was busy. Nor does it isolate which of D2/G1/lookup/planner changes causes the cost. Report the measured distributions, not an exact portable surcharge or a formal statistically significant estimate.

**Ordinary writes:** medians are near baseline relative to the observed A/A scatter. This run does not resolve a small scalar/derived/entity regression or improvement reliably, and does not prove neutrality. Scalar128 has especially poor baseline repeatability. Derived CPU +4% is a descriptive observation, not a certified regression threshold crossing. Entity blocks span about92–108ms, with 11/18 below the preregistered100ms flag. Preserve all rounds; do not select the favorable baseline or omit a noisy round.

A/A ranges are diagnostic observations, not confidence intervals or acceptance bands. There is no preregistered equivalence margin or hypothesis-test verdict.

## Construction: measured, but precision is limited

128 fresh scalar trees retained simultaneously per child, after32 warmups, with unique prebuilt inputs. Creation and enhancer construction are timed; leaf materialization/checks, independence writes and teardown are outside. All validation passed. This is warmed construction, not fully realized startup or entity population.

| Configuration | Median wall ratio | Median CPU ratio | Block range | Under100ms |
|---|---:|---:|---:|---:|
| Bare16 | 1.104 | 1.025 | 5.9–8.2ms | 12/12 |
| Bare128 | 1.012 | 1.313 | 37.5–42.7ms | 12/12 |
| Transactions16 | 1.096 | 1.047 | 12.1–16.4ms | 12/12 |
| Transactions128 | 1.107 | 1.032 | 74.2–143.3ms | 11/12 |

47/48 blocks are short. Three configurations have candidate wall cost higher in all six pairs, so the directional observation should remain visible; it is not a settled precise startup penalty. Bare128 CPU's +31% with wall near +1% particularly forbids collapsing CPU and wall into one conclusion. Process CPU includes work across process threads and can exceed elapsed wall time. No construction A/A exists; a busy heterogeneous host, incidental GC and short blocks prevent an equivalence or robust fine-grained magnitude claim. The 1.90x transactions128 wall outlier remains part of the recorded range, not grounds for a favorable retry.

## Whole-process post-GC heap

Three pairs per configuration. Table shows median paired candidate-minus-baseline KiB; it is not journal attribution or retained-size analysis.

| Fixture | Idle | Settled handles dropped | Second cycle block | Destroyed |
|---|---:|---:|---:|---:|
| Bare32 trees/16 leaves | +8.1 | — | — | +2.0 |
| Bare32 trees/128 leaves | +8.2 | — | — | +2.1 |
| Confirm16 trees/16 leaves | +292.8 | +385.0 | +384.3 | +170.1 |
| Confirm64 trees/16 leaves | +942.6 | +1102.1 | +1098.0 | +180.2 |
| Confirm16 trees/128 leaves | +1736.1 | +1877.2 | +1866.1 | +162.9 |
| Rollback16 trees/16 leaves | +292.8 | +432.2 | +449.6 | +201.4 |
| Rollback64 trees/16 leaves | +942.7 | +1165.7 | +1144.5 | +184.9 |
| Rollback16 trees/128 leaves | +1736.2 | +1942.7 | +1951.9 | +196.4 |

Enhanced heap deltas are consistently higher, with spreads generally much smaller than the observed differences. These are substantial observed process-footprint costs, present even before transactions at the idle checkpoint; do not describe them as memory-neutral or erase them with isolated earlier reductions. More trees/leaves show larger differences, but these configurations do not by themselves yield a causal per-tree/per-leaf allocation formula. Bare/enhanced shapes differ (enhanced includes rows), so their subtraction does not isolate enhancer cost.

All48 memory children report watched trees/handles collected after destruction; checkpoints converge in3–7 rounds. This supports finite collection of those sentinels and correct exercised pending/settlement behavior. It does not prove every internal object collects, bounded growth forever, or zero leaks. Positive destroyed-process deltas coexist with dead sentinels because heapUsed includes runtime/JIT/harness/checkpoint state; neither declare those residuals leaked trees nor claim they are conclusively harmless. Two finite cycle blocks cannot settle asymptotic retention. The shared convergence heuristic does not certify every deferred consequence completed.

## Host conditions and recommendation

The coordinator reports Defender occupying approximately one core. The saved environment records load averages rising from about2.43 to3.90 (one-minute values), but does not attribute CPU by process; treat the Defender attribution as a supplied host observation, not something established by these samples. This is busy-host development evidence, not a quiet-machine certification. Fresh serial children and interleaved A/A reduce some confounding; they cannot remove scheduling/frequency/cache effects. Process CPU is less directly sensitive to waiting than wall time but is not immune to host effects. Do not apply a guessed correction factor or subtract Defender from timings.

**Recommendation:** retain this as completed exact-artifact evidence of a bounded matrix, and make any adoption decision with the transaction CPU and enhanced process-heap increases explicit. Approved bundle ceilings and passing correctness gates do not constitute runtime-cost acceptance. No preregistered runtime budget authorizes an automatic performance pass/fail, so I do not invent one. If adopted, say the candidate has measured transaction/heap costs in exchange for its established behavior; do not claim performance equivalence, universal memory safety, or that all overhead was eliminated. The data supply no reason to reopen settled semantics merely to make timings green. Future precision work, if separately warranted, should be a new preserved preregistration rather than replacement of this run. No rerun is needed to honestly report these present findings.
