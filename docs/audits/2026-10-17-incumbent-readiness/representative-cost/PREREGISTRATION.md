# Representative incumbent/candidate cost preregistration

Registered October 18, 2026, before executing this study. Runtime remains frozen:
incumbent 8d220643e0d4e34cbdbc6e55e6ef692b25d5e023 versus candidate
9917c92fbbdc9dfdd14601f1f5fb7ce21799be71. Reuse identified built artifacts from
../artifact-cost; no new runtime changes and no B work. The updated measurement
contract acceptance policy governs this study (working-tree policy hash recorded
with results). Existing four failed artifact budgets remain release blockers.

## Profiles and provenance

These are synthetic, discriminating workloads, not measured application usage.
The workload-assumptions ledger motivates point reads and whole projections but
its historical counts do not establish current adoption or frequency weights.
No weighted overall score will be computed. Sizes 100, 1,000 and 10,000 rows span
two orders of magnitude; 10,000 is a stress size, not an ecosystem percentile.
Each row has string id/name and numeric value. All use neutral kernel production
mode. No application-owned computed values, framework rendering, network or DOM
latency claims. No optional history enhancer; default transaction history settings
are identical. Held handles are released before final destruction sampling.

- Bare control: 16 scalar fields; 20,000 checked point writes.
- Populated ordinary entities: each size, 2,000 checked point updates, 200
  update/whole-projection cycles, 500 add/remove cycles with held retired handle.
- Transaction-enabled populated entities: each size, 200 mixed scalar/entity
  confirmation cycles and 200 rejection cycles. Assert visible speculative and
  settled values, and pending authority counts. Capture drain measured separately.
- Overlap: 200 newer-first paired scalar transactions; require successful rollback
  revealing earlier contribution, then baseline. Older-first refusal and recovery
  are separate: 100 removal/replacement conflicts, unchanged refusal followed by
  conflict removal and successful retry. Never compare refusal with success.
- Bounded trees: 200 construct/populate/destroy cycles of 100 rows; 1,000 empty-tree
  construction/destruction controls. Report total cycle cost, not isolated creation.
- Heap: 100 empty trees (fixed overhead); 10 populated ordinary trees at each size;
  10 transaction-enabled trees at each size with 10 disjoint pending owners each.
  Record process baseline, live before drain, live after drain, post-settlement
  drain, and post-destruction drain. These are whole-process heapUsed differences,
  not dominator sizes or a universal leak proof. Per-size results are separate.
- Candidate-only capability: new-key whole-value write, rollback and preparation
  failure correctness probes. Incumbent does not promise this behavior; do not
  compare timings for unequal tasks or infer new overlap capability.

Failed-abort injection cost, optional history retention configurations, Link,
framework observers/rendering, startup/parse and browser/device heap are omitted.
Existing correctness evidence for those boundaries is not a performance result.
This bounded study cannot establish general production superiority.

## Execution and uncertainty

Node 24.15.0, production ngDevMode=false, --expose-gc. Reuse same dependencies and
built modules with hashes; importing full kernel for runtime is separate from
consumer bundle retention. Fresh child process for each arm/profile/size/sample.
Five samples per arm; AB/BA alternating order. Two baseline-labelled A/A control
samples per profile/size before the five pairs. No parallel benchmark workers.
Record wall and process CPU, load average, free memory, CPU and runtime versions.
Host is a developer machine, no calibrated throttling or exclusive-core claim.
Warm up timing operations for 10% of measured iterations; heap samples have no
operation warmup. Assertions remain inside timed loops identically in both arms.
Report checked-workload cost, not bare primitive latency. Report synchronous
loop time and subsequent two setImmediate boundaries separately; these drain
microtask work but do not prove arbitrary scheduler quiescence. Heap uses the
existing shared heap-quiescence protocol unchanged (64 KiB, 3 stable, max40).

Report every sample plus median, min/max, absolute delta and relative delta.
Five samples cannot establish tails or tight confidence intervals. A/A variability
is a noise diagnostic, not a confidence interval. Differences within observed
same-arm range, or with overlapping arm ranges, remain directionally unresolved.
No favorable retries. Harness/assertion failures are preserved; correct harness
mistakes explicitly before a fresh versioned campaign. Semantic failures stop
that profile's cost interpretation, not silently reduce its required behavior.

## Acceptance criteria established before the run

1. All measured work must satisfy unchanged public-state assertions; any semantic
   mismatch blocks interpretation as a correctness-equivalent comparison.
2. Four executable artifact ceilings remain binding, with no increase authorized.
3. No defensible application latency/heap SLO has been supplied. CPU/heap/growth
   results are therefore characterization, **not an invented numeric pass/fail**.
   Do not manufacture thresholds from results. Any performance acceptance needs
   owner approval naming absolute costs, beneficiaries, disadvantaged consumers
   and uncertainty. No automatic architecture rejection or release acceptance.
4. Expose size-dependent growth and post-drain residuals rather than hide them in
   averages. Non-convergent heap samples are unresolved, not retained-byte results.
5. Existing correctness/new-key benefit is separate from cost: ordinary consumers
   pay core footprint whether they use the capability; transaction users gain
   the tested capture safety, not a promise that every workload runs faster.

Independent review will challenge harness equivalence and interpretation. Source,
commands, artifact hashes, raw failures and results stay in this task record.
