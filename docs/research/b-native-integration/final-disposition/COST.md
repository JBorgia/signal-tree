# Fresh matched-subset costs

Candidate `fdfefaa2889877bedd3e0d93f27f0fa9bac1e1b9`; exact incumbent
`8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Fresh uncached five-package production
builds, source and emitted-file hashes recorded. Baseline has three preserved
untracked research test fixtures and no tracked runtime edits; manifest discloses
them. They do not enter the production package build. Candidate runtime was clean.

## Fixed campaign

One90-sample campaign,0failed matched samples. Ten workloads, three samples per
baseline/A-A/B arm, alternating fresh processes. No favorable retries. Test/build
and reviewer diagnostic work completed before sampling. Node24.15.0, arm64,10CPU
host; load samples recorded, unrelated host activity uncontrolled. Assertions check
each useful operation. Explicit GC is outside CPU timing; final capture/maintenance
drain is included below. Construction includes population and destruction.

| Workload | Count | Rows | Paired CPU B/incumbent median | B range | A/A range |
| --- | ---: | ---: | ---: | --- | --- |
| ordinary-scalar | 2000 | 32 | 0.850 | 0.837–0.862 | 0.993–1.056 |
| ordinary-entity | 1000 | 32 | 1.049 | 1.031–1.069 | 0.987–1.064 |
| rollback | 500 | 32 | 0.604 | 0.596–0.610 | 0.991–1.024 |
| rollback | 500 | 1024 | 0.594 | 0.592–0.601 | 0.972–0.998 |
| confirm | 500 | 32 | 0.821 | 0.774–0.844 | 0.935–1.032 |
| refusal-recovery | 200 | 32 | 0.872 | 0.871–0.938 | 0.950–1.018 |
| churn | 500 | 32 | 1.488 | 1.469–1.544 | 0.970–1.009 |
| construct | 200 | 32 | 2.572 | 2.397–2.879 | 0.979–0.999 |

Rollback improvements and churn/construction penalties exceed observed A/A
variation across all three pairs. Ordinary entity difference overlaps A/A noise.
No architecture-level causal share is inferred from these timings. No active
application observers, restoration history or inspection-only writes are timed.
Known failures elsewhere mean these are matched successful-subset obligations,
not complete production equivalence. Useful overlap separately succeeds in B and
refuses in the incumbent; it is excluded from throughput comparisons.

## Post-drain heap

| Held retired references | Incumbent median delta bytes | B median delta bytes | Native candidates incumbent/B |
| --- | ---: | ---: | --- |
| 100 | 2,502,704 | 2,178,072 | 100/0 |
| 1000 | 13,025,832 | 11,691,168 | 1000/0 |

Whole-process heapUsed deltas after three capture-drain/explicit-GC turns; not
dominator retained bytes. Fixtures deliberately hold retired references. Lower
B heap is not bounded total growth or universal leak freedom. Independent installed
ordinary churn8/128 also preserves held-reference isolation and reclaims backing.

## Executed consumer bundles

| Gzip fixture | Incumbent bytes | B bytes | Increase |
| --- | ---: | ---: | --- |
| bare | 11,919 | 12,138 | +219 / 1.84% |
| entities | 26,074 | 28,143 | +2,069 / 7.94% |
| transaction | 60,154 | 70,151 | +9,997 / 16.62% |

Browser ESM, esbuild minification/tree shaking, ngDevMode=false; Angular/RxJS/tslib
external, gzip level9. Both arms execute checked fixture behavior. The transaction
fixture retains both selectable implementation graphs, although only B executes.
This measures the current artifact, not the size of a hypothetical complete
replacement. Removing the incumbent graph cannot be assumed to fix runtime cost.

Fresh exact incumbent bare/entity production/development budgets pass. B fails all
four. Both used the byte-identical budget tool. Demo initial563.16→572.74kB
(+9.58kB): incumbent exceeds525kB warning, B also exceeds570kB error ceiling.
No ceilings changed. These fresh results supersede any assumption that current
package overages are inherited from an already-failing exact incumbent.

The unchanged operation counter still reports8,256/32,896/131,328 Map input
entries for128/256/512 same-author one-subject appends: n(n+1)/2. This is a
constructor-input work count, not CPU or total heap. Sparse admission remains
unestablished; the stale-authority repair did not solve it.

## Independent review and limits

The cost reviewer independently recomputed all paired medians and inspected the
transaction metafile confirming both retained graphs. It supports rejecting the
current candidate for adoption, without disproving pending-only ownership or
claiming a separately packaged narrow scope. Raw samples, all A/A results, load
samples, source/artifact manifests, budgets and failures remain sealed. Three
samples per arm are limited evidence, not confidence intervals or calibrated
hardware benchmarking. No second campaign was run.
