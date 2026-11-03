# Capture and publication cost qualification

Exact baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Preserved reviewed candidate/evidence: `4101f0858387ed051b7041ff60c9ec90a56318da`;
its runtime is `12a04f57bee4c90de1110eff7b72960fcd46059c`.

This investigation attributes incremental cost, measures equivalent workloads,
and tests a bounded allocation reduction. It does not reopen ownership design,
change public API, alter v15 or raise budgets. The baseline's own overages and
the candidate's increments are separate facts.

## Bundle attribution

The first copied-dist harness omitted package.json and its sideEffects:false.
It produced invalid apparent optional-feature retention. That first result is
preserved, explicitly rejected, and must not be interpreted as a runtime leak.
The corrected harness copies the complete package, verifies matching metadata
and 108 artifact file hashes per arm, extracts the unchanged executable budget
fixtures and uses identical production defines, peer externals and esbuild
options. Repeated bundles have identical hashes and reproduce the original gates.

| Production fixture | Incremental minified bytes | Incremental gzip bytes |
| --- | ---: | ---: |
| Bare | 1,800 | 445 |
| Entities | 4,812 | 1,237 |

Bare minified growth is scalar-slot runtime 1,124, intrinsic mutation 349,
scalar-leaf runtime 184 and location runtime 143 bytes. Entities additionally
concentrates growth in entity-signal (2,843) and entity mutation frames (155).
These module contributions are minified attribution, not additive gzip savings.
Unused transaction and restoration enhancer modules emit zero bytes in both
fixtures. Parsed import metadata alone is not retained code. The bare fixture
pays for the shared installation protocol; it does not retain the optional
transaction journal or restoration implementation.

## Bounded allocation hypothesis G1

Source registration added three accessor closures per observable mutation source.
The original candidate stays intact in Git. G1 replaces per-instance closures
with shared descriptor getter functions; mutable observer/preparer state stays on
each private source. Own property flags remain nonenumerable/nonconfigurable with
no setter. Late attachment, multiple listeners, release, preparation ownership
and independent sources keep the same ordinary property-read behavior.
Borrowing a descriptor getter and calling it with a different receiver would
differ; no public/source-consumer contract promises that private reflection use.
Independent review inspected actual consumers rather than asserting universal
JavaScript equivalence.

An isolated 10,000-source probe, three alternating fresh-process samples, measured
live whole-heap deltas approximately 1.728 MB baseline, 6.936 MB candidate and
1.728 MB shared-getter experiment. This is allocation attribution, not whole-tree
performance or retained journal size. Initial snapshots of 32 unenhanced mixed
trees with 128 scalar leaves each show 199 versus 12,784 closures named get;
the corresponding closure self-sizes are 11,280 versus 716,040 bytes. Names alone
do not identify every closure's owner; source and the isolated experiment support
the attribution. Self-size is not retained/dominator size.

## Measurement limits

Fresh child processes isolate each arm/sample. Timing workloads within a child
run in a fixed order with fresh fixtures and shared JIT history; intermediate and
settled-state checks are included in measured workload cost. Alternating arm order
and baseline/baseline controls expose some noise; they are not confidence intervals.
These are local development measurements, not calibrated device benchmarks.

Memory endpoints measure whole-process heap after quiescence with actual live
fixtures, then settlement and destroy/drop. Initial snapshot runs preserve a
harness-owned last-tree reference (two weak survivors); revised helper scopes
remove that reference. The first outputs remain preserved. Snapshot collection
occurs outside timing and those runs' later endpoints are excluded from pooled
memory results. WeakRef sentinels yield across jobs before observation. Finite
weak-sentinel collection does not establish universal leak freedom. Live-tree and
leaf scaling estimate scenario overhead; no journal dominator-size claim is made.

## G1 semantic and artifact verification

The unchanged 37 portable controls and 36 positively instrumented work cases
pass on G1. Focused Nx batches pass 616 executions (overlap is intentional),
including the new source-isolation tests. Typecheck, spec-types, API/callable
inventories, documentation links and the global lint ratchet pass; lint retains
19 existing warnings and zero errors.

| Full Nx suite | Ordinary passes | Expected failures | Skips |
| --- | ---: | ---: | ---: |
| Kernel | 5,728 | 12 | 12 |
| Angular | 237 | 0 | 3 |
| React | 74 | 0 | 0 |
| Vue | 172 | 0 | 0 |
| Solid | 104 | 0 | 0 |

The kernel run completed on its first attempt in 398.517 seconds. This is not a
performance comparison with the previous 193.610-second run: snapshot compression
and host contention overlapped. The runtime measurements are separate runs after
verification released the CPU. The old-source negative control retains the new
tests and produces exactly one intended shared-getter identity failure (10 pass);
optimized source bytes are restored and verified afterward.

Fresh five-package builds succeed. G1 removes 19 minified bytes in each budget
fixture but adds 10/12 gzip bytes for bare production/development and 12/11 for
entities production/development relative to the original candidate. This is not
a bundle reduction; gzip contributions are non-additive. Fresh reported sizes are
11.65/14.00 KB bare and 26.79/29.58 KB entities. The demo initial output is 565.08 kB;
production build still exits nonzero at its unchanged 550 kB ceiling. All package
and demo ceilings remain unchanged and failing. No artifact acceptance is inferred.

Original runtime measurements used NODE_ENV=production and unbundled built ESM.
Some diagnostics also consult ngDevMode directly. The final three-arm comparison
sets ngDevMode=false before import in every arm and records that flag; the original
results and pre-flag harnesses remain preserved. These are production-runtime-flag
measurements of built modules, not compile-folded/minified consumer bundles.
Do not compare old and final samples as if only G1 changed their execution mode.


## Final three-arm results and disposition

Local experiment source commit: `272a4018eb169c734b14ea845128ca7d9f7af762` on
`codex/capture-cost-g1`. The original `codex/atomic-capture-proof` branch remains
at `4101f0858387ed051b7041ff60c9ec90a56318da`. No runtime merge occurred.

All 130 original, 156 final three-arm and 26 longer timing child processes
completed their useful assertions. Before/after runtime artifact hashes match.
All pooled watched tree/node WeakRefs clear after destruction; this remains a
finite collectability control rather than a universal memory-leak result.

Final live whole-process heap deltas (median bytes across three independent
processes per arm, production runtime flags):

| Fixture | Baseline | Original candidate | G1 |
| --- | ---: | ---: | ---: |
| Pure scalar: 32 trees, 128 leaves each | 7,849,224 | 9,989,688 | 7,855,144 |
| Mixed: 32 trees, 128 leaves plus 8 rows each | 9,042,896 | 11,274,776 | 9,089,832 |
| Idle transactions: 128 trees, 16 leaves plus 8 rows each | 15,706,728 | 19,236,832 | 17,655,608 |
| Pending mixed transaction: same 128-tree shape | 16,700,800 | 20,466,256 | 18,913,472 |

G1 removes most of the added idle scalar allocation. It does not remove all
transaction-enabled overhead: those live fixtures remain about 12–13% above the
baseline. After settlement the pending fixture medians are 16,588,592 / 20,264,744 /
18,688,472 bytes. Destroyed-process deltas remain nonzero despite all watched
objects clearing; these deltas include VM bookkeeping and are not library-owned
retained bytes. No subtraction is presented as exact journal ownership.

Timing does not establish an unconditional G1 cost improvement. The initial
original-candidate checked mixed transaction/rollback cycle took 1.69–1.89 times
baseline across three pairs, with baseline/baseline ratios 1.03–1.15. The final
short-block comparison was noisier, with host load reaching about 7.7; it remains
preserved rather than replaced. One fixed longer-block comparison increased
iteration/warmup counts for all three arms equally and reports wall and CPU time.
It produced these paired CPU ratios:

- Pure scalar G1/original: 1.049–1.381, median 1.120; baseline A/A 0.972–1.048.
- Pure scalar G1/baseline: 0.927–1.452, median 1.150.
- Mixed transaction/rollback G1/baseline: 0.727–1.879, median 1.730; baseline A/A
  0.995–1.043. One baseline trial was much slower than the other two.
- Mixed transaction/rollback G1/original: 0.841–1.013; no clean CPU speedup claim.

These include authored writes, capture, reads/assertions and settlement; they are
not isolated rollback-primitive timings. Scalar/existing-row blocks still lasted
15–43 ms, and pure scalar 14.6–23.4 ms, despite increased fixed counts; the
intended >50 ms target was achieved only for churn/transaction blocks. No further
favorable retries were selected. The scalar G1/original results are a possible
small-write CPU tradeoff, not evidence of timing neutrality. All samples and A/A
controls are retained; none supplies a confidence interval or calibrated device
prediction.

Independent review accepts the source correctness within the tested contracts
and the measured memory benefit. It explicitly withholds unconditional cost,
artifact and release acceptance. Root verified source hashes, raw distributions,
fixture assertions, emitted module attribution and the review's limits. G1 stays
an experimental local branch: it is not substituted for the preserved reviewed
candidate. The evidence does not require an ownership-architecture direction
change, but it also does not justify raising ceilings. The retained runtime cost
and potential scalar-write tradeoff remain qualification limits.

## Exact replay and artifacts

`initial-cost-evidence.json.xz` and `st-cost-final-evidence.json.xz` preserve
commands, environments, source/artifact hashes, raw results, the invalid first
bundle harness, the expected allocation-regression red, and all timing samples.
The final archive is an object keyed by original paths under `entries`; every
entry stores UTF-8 text and its SHA-256. The two initial snapshots and separate
optimized snapshot are losslessly compressed. Snapshot flags differ across the
initial/final collections; do not calculate exact-condition snapshot ratios.

The small package archive contains complete baseline/original/optimized kernel
runtime and declaration graphs plus their package metadata. Hashes are in the
receipt; these are reproducibility artifacts, not packages authorized to publish.
The replay wrappers are path-parameterized copies of the executed orchestrators;
only syntax was checked for these portable wrappers. Their underlying workloads
ran as recorded. Wrappers fail if a child fails or artifact bytes change.

From the repository root, Node 24.15.0:

```sh
mkdir /private/tmp/capture-cost-replay-packages
tar -xJf docs/research/capture-cost-0/st-cost-final-packages.tar.xz -C /private/tmp/capture-cost-replay-packages
node docs/research/capture-cost-0/replay/g1-comparison/replay.mjs --baseline-package /private/tmp/capture-cost-replay-packages/baseline/kernel --original-package /private/tmp/capture-cost-replay-packages/original/kernel --optimized-package /private/tmp/capture-cost-replay-packages/optimized/kernel --output /private/tmp/capture-cost-replay-matrix
node docs/research/capture-cost-0/replay/g1-long-timing/replay.mjs --baseline-package /private/tmp/capture-cost-replay-packages/baseline/kernel --original-package /private/tmp/capture-cost-replay-packages/original/kernel --optimized-package /private/tmp/capture-cost-replay-packages/optimized/kernel --output /private/tmp/capture-cost-replay-long
```

Use fresh output directories and run sequentially without concurrent benchmarks.
For source verification on G1, the preceding member-point-composition packet
lists the exact Nx/type/build/budget commands; this packet's validation archive
contains G1's unchanged-control runner, appended runtime patch, positive work
instrumentation, and all executed command arguments. Budget commands still fail
at the recorded sizes. No new API, v15 changes, ceiling changes, merge, push, tag
or publication occurred.
