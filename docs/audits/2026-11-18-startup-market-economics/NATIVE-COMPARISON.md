# Full native v16 retained-store comparison

This is a separate comparison of qualified current `5801008ea4ca591b3be483e8bbb0aa02e15f59ed`
and successor `f8cf26e50193ca8aa5580da15b739129313f256e`. It uses the unchanged
native workflow, ten cycles per retained store, actual active Links and native
transactions. The ordinary peer application does not substitute for this scope.
[Raw reduced results](NATIVE-RESULTS.json) retain all observations and source joins.

The registered run completes 10 fault controls, 12 functional children, 32 CPU
children and 12 separate heap children. The functional suite includes public
Node/AOT behavior, HTTP authority and repeated coordination; native runtime
qualification separately covers the original point-work bound. No positive child
or adverse sample is discarded. Baseline and candidate delivery traces match.

## CPU and elapsed time

Three paired rounds per profile plus one baseline A/A pair are exploratory.
The following are **cumulative differences across ten cycles**, after minus
before, in milliseconds. Ranges show all three pairs. CPU is measured process
user+system time, not browser elapsed time; these are distinct metrics.

| Rows / settlement | Population CPU median [range] | Population elapsed median [range] | Settlement including drain CPU median [range] | Settlement including drain elapsed median [range] |
| --- | ---: | ---: | ---: | ---: |
| 1,000 / confirm | +32.20 [−104.50, +158.91] | −60.55 [−103.23, +136.04] | +2.73 [−23.99, +35.39] | +19.57 [−89.15, +58.93] |
| 1,000 / rollback | −90.60 [−95.46, +11.81] | −72.07 [−74.39, +84.52] | +130.09 [+20.02, +217.93] | +53.71 [+7.89, +149.29] |
| 10,000 / confirm | +64.87 [−473.52, +508.70] | −278.16 [−700.20, +905.54] | +98.80 [−71.51, +170.72] | +131.54 [−40.42, +248.88] |
| 10,000 / rollback | +63.91 [−1,834.51, +403.25] | +546.00 [−2,091.72, +731.20] | +776.61 [−2,385.29, +917.16] | −550.77 [−2,719.79, +1,773.87] |

The native active-store results are mixed and sometimes adverse. In particular,
1,000-row rollback settlement including drain is slower in all three elapsed and
CPU pairs. Synchronous 10,000-row confirmation also increases in all three pairs:
elapsed median +69.19 ms and CPU +76.94 ms across ten cycles. Preserve those costs;
the common application's startup gain does not establish an active-path speedup
or nonregression.

A/A differences are substantial. For settlement including drain, the single
baseline A/A elapsed differences are −30.67, +268.66, −428.62 and +518.96 ms in
table order; CPU differences are −14.26, +186.87, −266.90 and +1,093.44 ms.
They describe observed variability; they are not confidence intervals and do not
turn adverse signs into equivalence. The larger rollback result also illustrates
why a lower elapsed median cannot be labeled lower CPU.

Population includes transaction opening, row copying and population. Settlement
including drain contains synchronous settlement, fixed microtask draining and
useful sink hashing. The synchronous interval is nested: do not add it. These
phases omit some lifecycle/setup/disposal work and are not total lifetime cost.

## Live and retired heap

There is one baseline/candidate pair plus one extra baseline child per profile,
with fixed job-separated forced GCs. This is descriptive retained-process heap,
not a statistical heap estimate, allocation traffic, peak memory or a cloud bill.
The ten-cycle workflow creates new entity lifetimes; retained terminal evidence
can legitimately grow while the store remains alive.

| Rows / settlement | Cycle 10 pending bytes, baseline → successor | Cycle 10 after operation helper, difference | After owner helper returns, difference | Owner-return baseline A/A difference |
| --- | ---: | ---: | ---: | ---: |
| 1,000 / confirm | 18,679,344 → 18,698,416 | −47,008 | +47,072 | −6,496 |
| 1,000 / rollback | 17,318,016 → 17,313,432 | +25,096 | +17,872 | +2,768 |
| 10,000 / confirm | 109,593,704 → 109,172,976 | −873,040 | +49,600 | +6,808 |
| 10,000 / rollback | 85,854,320 → 85,422,136 | +83,336 | +70,688 | +5,912 |

All twelve observed tree WeakRefs clear after the owner helper returns. Sampled
transactions and retired prior payloads clear; a current confirmed payload remains
live as expected. The ordinary heap runner records collection rather than using
it as a required pass condition; the separate pin/release control asserts that
sensitivity. Do not upgrade an observation to a universal collection guarantee.
Whole-process residual differences remain positive after owner return in all four
pairs. This does not establish retained trees, but neither is it zero residual cost.

At 10,000 rows, selected confirm history after the operation helper grows from
51,842,600 bytes at cycle 1 to 71,269,232 at cycle 10; rollback grows from 16,290,496
to 30,194,264. Cleanup after the whole owner scope returns falls to 8,521,360 and
10,318,384 bytes respectively. Retirement checks report no lingering retired
value backings or reclamation candidates. Finite physical payload reclamation
does not authorize erasing exact terminal proof facts or establish a universal
history bound.

## Disposition

Retain the selected correctness and startup/allocation changes with these active
costs visible. No full-native CPU improvement is established by this cohort.
The required ordering repair and unchanged point-work checks remain separate
correctness evidence; small sample counts and A/A variation limit causal timing
claims. No new weaker publication mode or configuration is justified by these
results. Public/HTTP fixtures do not establish production authentication, durable
recovery or human comprehension; the installed durable application is a separate
proof.
