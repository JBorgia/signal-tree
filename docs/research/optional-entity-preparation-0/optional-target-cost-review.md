# Optional entity-target preparation: executed-evidence interpretation

**The dependency exclusion is demonstrated for the supplied plain fixture, with a measurable size tradeoff: −500 gzip bytes plain, +329 gzip bytes enhanced. The cost samples show no clear timing change, not proven cost neutrality.** Retention measurements are weaker and show a small consistent rollback increase. These facts support evaluating the split as a candidate; they do not determine adoption or certify budget/release compliance.

Read-only interpretation of `artifacts/entity-preparation-split-2026-10-14`: scripts, all 24 raw cost JSONs, summary/protocol, bundle receipts/metafiles/saved bundles, attribution fixtures and validation logs. No measurements, tests or builds rerun; no experiment/source edits. Only this report written. Numerical checks below used read-only Python JSON parsing, arithmetic and file hashing.

## Bundle result and controls

`compare-bundles.mjs` uses matching source workloads across arms, browser ESM/minification/tree shaking, `ngDevMode=false`, gzip level 9, and identical externalization settings.

| Fixture | Before raw / gzip B | After raw / gzip B | Change raw / gzip B |
|---|---:|---:|---:|
| Plain EntityMap | 89,245 / 26,947 | 87,504 / 26,447 | −1,741 / **−500** |
| Transactions + restoration | 253,619 / 73,963 | 254,188 / 74,292 | +569 / **+329** |

Plain gzip decreases about 1.86%; enhanced increases about 0.44%. This is not a universal bundle reduction. Enhanced consumers pay for the extracted implementation plus the indirection/dependency representation. Whether that exchange is worthwhile is the owner's decision, especially with budgets unchanged.

The after-plain metafile has no positive emitted contribution from `prepare-entity-target.js`; after-enhanced includes **2,424 raw emitted bytes** from it. Structural-store remains **8,489 emitted bytes** in all four fixtures. This confirms the bounded outer-algorithm exclusion, not removal of all prepared storage facilities. Input-file presence is distinct from emitted contribution: esbuild can parse a module and shake it out. The before arm's empty preparation list is expected because the implementation was inline, not evidence it previously had no preparation cost.

All four saved bundle hashes and all recorded input hashes currently match their receipts. Normalizing archived module paths, the before/after recorded runtime changes are entity-signal, target-transition and the added prepare-entity-target module; this supports a focused comparison. It is not an independent reproducible source/build attestation.

Behavior assertions run the browser-target bundles in Node, not a browser/framework runtime. They check restored IDs, one held row's value and scalar x after enhanced reorder rollback; plain update writes the existing value. Useful smoke coverage, but no assertion of pending counts, all row values, held object identity, observer ordering or public export equivalence. Sequential imports share one Node process, which is fine for these smoke assertions but is not isolation evidence. Full-suite evidence is separate.

## Original attribution fixtures are a separate comparison

The after `attribute.mjs` fixtures record bare **35,392 raw / 11,919 gzip B** and entities **87,406 raw / 26,396 gzip B**. Their workload definitions match the original attribution shape, but differ from the larger behavior-checking fixtures above. Do not mix their byte totals.

Relative to the earlier original attribution values (bare 11,930 / entities 27,431 gzip B), these are −11 / −1,035 B. Those earlier archives precede intervening reductions; **−1,035 B is not the isolated split saving**. The split-specific matched result is −500 B for the comparison's plain fixture. Fixture sizes are not by themselves an execution/pass of the authoritative bundle-budget gate or production demo build. No budget threshold is inferred here.

## CPU/wall evidence

I read every raw sample and reproduced all summary medians/minima/maxima and within-round ratios. There are exactly 24 unique samples: six rounds × before/after × rollback/confirm, Node v24.15.0, V8 13.6.233.17-node.48, Darwin arm64. Each process has 16 rows, 200 warmup and 2,000 timed operations. Timed blocks range **271–400 ms**. All recorded cost stderr files are empty.

| Mode | Median after/before wall ratio (range) | Median process CPU ratio (range) |
|---|---:|---:|
| Rollback | 0.9992 (0.9952–1.0143) | 0.9968 (0.9952–1.0156) |
| Confirm | 1.0000 (0.9861–1.0166) | 0.9995 (0.9877–1.0174) |

These are medians of within-round ratios, not ratios of arm medians. Values cross parity; neither speedup nor a small regression is resolved. “No clear timing difference in these samples” is justified; “zero overhead,” equivalence, or a confidence bound is not.

The workload does substantial checked work: reverse order, replace all 16 row values, mutate a scalar, settle, and assert IDs/scalar/row 0. Instrumentation counts **2,200 preparation calls per rollback process, zero for confirm**, validating that rollback exercises the moved binding and confirm does not. This is a useful negative-path comparison, **not A/A**: the two modes differ in work and state trajectory. Checks do not inspect pending-turn counts or every row value, though order rollback and preparation counts make a trivial no-op workload implausible.

Timing covers synchronous checked loops, including incidental GC, assertions and the instrumentation wrapper. Setup, fixed warmup, explicit GC, postloop task flush and destruction are outside it. It is not isolated planner cost or full lifecycle CPU. Process CPU includes runtime/background threads, so it can exceed wall time. A 16-row aggregate transaction can dilute a small bridge cost; one shape says little about construction, plain EntityMap throughput, larger targets, many owners, failures or native scheduling.

Fresh processes and seeded shuffled order reduce carryover/order bias. Six rounds, one seed and no A/A control cannot establish quiet-host noise or significance. The protocol's statement “run after builds/tests complete” is a recorded claim, not independently verified host evidence. No quiet-host certificate is assumed.

## Heap: report the increase without attributing a leak

Rollback whole-process heap deltas: before median **479,876 B**, after **484,796 B**. The difference of medians is +4,920 B; median paired increase is **+4,640 B**, with all six paired increases between +3,808 and +7,568 B. Absolute postloop heap is also higher after by roughly 12.7–16.3 KB; warmup baselines already differ. These are observations worth retaining, not “no memory tradeoff.”

Confirm delta medians differ by +764 B, but after round 5 is **451,976 B** versus before **390,960 B**, a +61,016-B paired outlier. Keep it in the evidence; do not silently discard it or describe every sample as identical.

The protocol uses one task boundary and three synchronous forced GCs at each endpoint, not convergence-based quiescence. It samples before tree destruction, has no WeakRefs/retainer paths, only one workload length, and no repeated batches within a process. Module loading, JIT/caches, deferred finalization and heap bookkeeping can contribute. The deltas neither establish terminal retention nor isolate per-operation allocation, peak memory, host-object size or leak growth. Dividing these differences by 2,000 would not yield a defensible per-transaction retained cost.

## Reproducibility and validation qualifications

- Bundle provenance is better recorded than cost provenance. `measure.py` does not persist exact command/exit receipts, artifact or harness hashes, per-sample timestamps, the realized schedule, or pre/post input inventories. It imports the live after dist path. Current bundle hashes agree, and the cost script points at those same archives, but there is no timing-window attestation that their bytes never changed. Seed/script reconstruct the intended order, not actual timestamps. It inherits environment, including NODE_ENV, rather than pinning/recording it.
- Raw files are protected against overwrite and subprocess errors abort. However there is no timeout, complete-run receipt or explicit finite-output validation. The present 24 raw files and reproducible summary mitigate missing-output concerns for this run; they do not repair the provenance omissions.
- `full-suites.log` reports successful tests for all five projects: 5,741 + 74 + 237 + 172 + 104 passed, with recorded expected failures/skips. `late-tap.log` reports two focused files/eight tests passed. These are inspected existing logs, not new runs or proof of every behavior.
- Preserve the initial failure: `typecheck-first.log` rejects a readonly number-array return where mutable `number[]` is required. The subsequent typecheck log has no errors, and `spec-types.log` reports OK under its existing ratchet. The stated fix to the actual mutable return is consistent with addressing that mismatch, not a reason to erase first-failure evidence. The logs do not independently tie every later source formatting/test change to the exact measured artifact.

Adoption remains open. The strongest supported claim is: **the selected plain fixture excludes the extracted algorithm and saves 500 gzip bytes; the selected enhanced fixture grows 329 gzip bytes; a checked 16-row reorder workload shows no clear timing shift, with limited whole-process heap increases requiring cautious interpretation.**

---

## Addendum: cost-v2, reviewed independently of v1

V1 findings above are preserved as findings about that run. **Do not pool v1 and v2:** v2 changes warmup, measured iterations, pending-turn assertions, all-row reads and environment controls. Its stronger provenance supports interpreting its own results; it does not retroactively repair v1 or make their absolute timings/heap deltas comparable.

### Provenance verification

Read `cost-v2/{cost.mjs,measure.py,cost-protocol.json,inputs-before.json,inputs-after.json,receipts.jsonl,complete.json,cost-summary.json}` and every one of the 24 raw sample files. No child process, benchmark, build or test was run. Independent read-only parsing/hashing found:

- Harness and driver hashes match the protocol. Before/after inventories are equal, and current archived contents match them exactly: **98 before JS files, 99 after JS files**.
- The recorded archived JS files used by the earlier enhanced bundle receipts also match these v2 inventories. No mismatches found for those receipt inputs. This connects the cost arms to the documented bundle tradeoff substantially better than v1's live temporary output path did.
- All **24** zero-exit receipts match the reconstructed seeded schedule and corresponding unique round/arm/mode outputs. Recorded commands target the declared archived arm. Raw child timestamps fall within their subprocess receipt intervals; all outputs report production NODE_ENV, 500 warmup, 5,000 measured operations and the expected preparation count. All cost stderr files are empty.
- Recomputed every summary median/minimum/maximum, paired timing ratio and median ratio; all agree with `cost-summary.json`. `complete.json` records 24 runs, exit 0 and unchanged inputs.
- Receipt interval: **2026-10-15 03:59:47.615501–04:00:08.828391 UTC**. Timed blocks span **566–853 ms**.

These address v1's principal missing command/environment/completion/input-identity records. Remaining provenance limits are narrower: inventories cover dist JavaScript, not a full source/build/toolchain or dependency/environment attestation; equal endpoint hashes are not continuous filesystem monitoring. The runner records harness/driver hashes initially, not a second postrun script inventory, although their current bytes match. There is no quiet-host certificate or A/A control, and none is inferred from the short completed interval.

### V2 results, including unfavorable observations

Ratios below are **medians of within-round after/before ratios**, not ratios of arm medians. Six sequential pairs per mode remain descriptive samples.

| Mode | Wall median ratio (paired range) | Process CPU median ratio (paired range) |
|---|---:|---:|
| Rollback | **1.0049** (0.9955–1.0182) | **1.0013** (0.9818–1.0346) |
| Confirm | **1.0161** (0.9867–1.0485) | **1.0184** (0.9891–1.0376) |

Observed medians lean slower: about **0.49% wall / 0.13% CPU rollback**, **1.61% wall / 1.84% CPU confirmation**. Four of six wall pairs are slower in each mode; rollback CPU splits three slower/three faster, confirmation CPU four slower/two faster. Confirmation's first four round ratios are above parity and last two below on both metrics. Preserve that variation rather than reducing the result to “unchanged” or a universal regression percentage.

Confirmation invokes preparation **zero** times; rollback invokes it **5,500** times including warmup. Therefore confirmation's slower median cannot specifically measure the extracted preparer invocation cost. Code-layout/runtime effects, other retained representation changes and host variability remain possible explanations; the data do not distinguish them. Confirmation is still a different workload, not A/A. Six pairs on one host/seed establish neither significance nor an equivalence bound. The appropriate statement is that this run's medians lean slower, with mixed paired outcomes and unresolved attribution.

Rollback heap-delta medians rise **191,432 → 210,776 B** (+19,344 B, difference of medians). Paired increases are **−7,912, +79,648, −34,752, +16,192, +28,112, +99,600 B**; their median is **+22,152 B**. This is an unfavorable aggregate observation with substantial variation, not a uniform per-process increase.

Confirmation heap-delta medians are **223,500 → 226,320 B** (+2,820 B). The median paired difference is only **+44 B**, with paired differences **+1,632, −1,544, −52,168, +10,152, +4,008, −1,840 B**. Both estimands are valid descriptive summaries but answer different questions; do not present the difference of medians as the typical paired increase.

### Harness improvements and remaining measurement limits

The child now checks pending responsibility **1 before settlement → 0 afterward**, expected order/scalar values, and **every row's post-settlement value**. Rollback's preparation-call count verifies use of the intended path. Optimistic pre-settlement checks cover order/scalar/pending, not every optimistic row value; this is a coverage boundary, not evidence of a broken sample. All-row reads materialize/access more row state than v1 and are included in timing, another reason not to pool runs.

Timing remains synchronous checked-operation cost: reads/assertions, runtime lookup, wrapper counting, settlement and incidental GC count; setup, warmup, explicit GC, deferred task flush and destruction do not. Longer fixed warmup is not proof of steady state. The workload still has only one shape: 16 rows, one collection plus scalar, successful serial reorder transactions. It measures neither general application throughput nor isolated callback-injection overhead.

Heap sampling is unchanged in principle: one task boundary plus three synchronous forced GCs, at endpoints while the tree lives. No convergence criterion, weak-target collection checks, retainer paths, multiple operation-count scales or repeated within-process batches. Differences can include runtime/JIT/cache and finalization behavior. V2's smaller absolute deltas than v1 are not evidence of better retention because the harness and warmup changed. Neither version supports leak or per-operation retained-byte claims.

**Concrete metadata flaw:** the v2 protocol/driver's `heap` description still says “after 2000 operations.” Actual `count`, harness and all raw outputs consistently say **5000**, with **500** warmup. Treat this as a stale descriptive label; use 5,000 when citing v2. Preserve the original hashed record rather than silently changing its historical contents.

The runner's 60-second timeout and finite assertions are useful. They check finiteness of wallNs/cpuNs/heapDelta, not a complete output schema or positivity; the reviewed outputs nevertheless reconcile with protocol and receipts. On a timeout, `subprocess.run` raises before the receipt-writing block, so the driver would not record a normal per-attempt exit receipt for that failure. No timeout occurred in this completed run. These do not invalidate the present 24 samples.

V2 strengthens provenance and behavioral workload checks, while retaining real size tradeoffs and unresolved timing/heap attribution. This addendum supplies no acceptance/adoption verdict and leaves the earlier bundle and test-log findings intact.
