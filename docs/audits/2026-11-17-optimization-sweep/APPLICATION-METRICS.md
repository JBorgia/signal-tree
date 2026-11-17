# Application comparison: expanded metrics

Final v16 source: `7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830`. The v15 candidate is `4d1142d61`.
These are the completed eight-implementation application results. Each normal
arm/size/kind has five fresh-browser samples, with rotated order. The 176
comparison children include separate v15 same-build controls. CPU-facing
timing and forced-GC heap cohorts remain separate. All 88 behavior controls,
32 context controls, 9 metric controls, 16 calibration children and 12
analysis-admission controls complete. The exact artifacts and limits are
described in [the report](README.md).

Times below are medians of per-child observations. Per-child p95s are
summarized across children, never pooled. Factory excludes seed generation.
Full contexts include serialization. Staging/settlement include asynchronous
fixture and service work. Throughput covers the entire checked 180-command
trace, not an isolated kernel update. User-to-layout is queued-input latency,
not INP. Heap is whole-application state, including framework and service
objects; after explicit destruction the application/service fixture remains.
It is not library-exclusive retained bytes or proof of a universal leak bound.

## 1,000 rows

| Implementation | Factory ms | First full context ms | Repeated full context p50 ms | User-to-layout p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 2.5 | 0.9 | 0.4 | 11.4 |
| NgRx | 1.2 | 0.7 | 0.4 | 11.0 |
| v15 before | 6.3 | 0.7 | 0.4 | 11.7 |
| v15 candidate | 9.5 | 0.9 | 0.3 | 11.8 |
| v16 C1 | 47.1 | 1.3 | 0.4 | 11.9 |
| v16 candidate | 33.3 | 1.1 | 0.4 | 12.5 |
| TanStack | 8.9 | 0.5 | 0.4 | 12.0 |
| TanStack alternative | 8.9 | 0.5 | 0.4 | 12.0 |

| Implementation | Stage 128 proposals ms | Settle 128 proposals ms | Checked commands/second |
| --- | ---: | ---: | ---: |
| Native Angular | 222.1 | 220.9 | 229.2 |
| NgRx | 229.9 | 233.2 | 238.6 |
| v15 before | 243.9 | 228.5 | 218.3 |
| v15 candidate | 232.3 | 231.4 | 222.2 |
| v16 C1 | 250.5 | 247.3 | 209.8 |
| v16 candidate | 252.9 | 241.2 | 214.3 |
| TanStack | 240.3 | 240.5 | 215.9 |
| TanStack alternative | 248.6 | 253.3 | 215.9 |

Heap uses decimal MB. Pending and settled columns are increments over
their immediately preceding populated checkpoint.

| Implementation | Populated above blank MB | Pending 128 increment MB | Settled 128 increment MB | Destroyed above blank MB |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 2.339 | 0.523 | 0.614 | 1.673 |
| NgRx | 1.802 | 0.553 | 0.665 | 1.695 |
| v15 before | 2.341 | 1.225 | 1.214 | 2.555 |
| v15 candidate | 2.341 | 1.225 | 1.214 | 2.556 |
| v16 C1 | 2.740 | 1.575 | 1.593 | 3.242 |
| v16 candidate | 2.741 | 1.568 | 1.575 | 3.235 |
| TanStack | 2.687 | 1.091 | 1.407 | 2.960 |
| TanStack alternative | 2.687 | 1.092 | 1.406 | 2.960 |

## 10,000 rows

| Implementation | Factory ms | First full context ms | Repeated full context p50 ms | User-to-layout p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 8.1 | 5.4 | 3.8 | 11.1 |
| NgRx | 4.7 | 3.7 | 3.3 | 10.5 |
| v15 before | 15.2 | 6.0 | 3.2 | 11.4 |
| v15 candidate | 13.3 | 6.1 | 3.5 | 12.0 |
| v16 C1 | 226.2 | 5.5 | 3.2 | 11.5 |
| v16 candidate | 228.9 | 5.6 | 3.4 | 11.6 |
| TanStack | 44.9 | 3.7 | 3.3 | 11.5 |
| TanStack alternative | 41.2 | 3.7 | 3.1 | 11.6 |

| Implementation | Stage 128 proposals ms | Settle 128 proposals ms | Checked commands/second |
| --- | ---: | ---: | ---: |
| Native Angular | 220.9 | 213.3 | 235.9 |
| NgRx | 227.9 | 283.1 | 206.8 |
| v15 before | 231.9 | 229.2 | 228.9 |
| v15 candidate | 231.0 | 231.8 | 219.2 |
| v16 C1 | 238.7 | 241.4 | 216.9 |
| v16 candidate | 242.8 | 237.5 | 215.2 |
| TanStack | 234.5 | 234.5 | 218.3 |
| TanStack alternative | 232.3 | 231.8 | 232.3 |

Heap uses decimal MB. Pending and settled columns are increments over
their immediately preceding populated checkpoint.

| Implementation | Populated above blank MB | Pending 128 increment MB | Settled 128 increment MB | Destroyed above blank MB |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 10.838 | 0.522 | 0.614 | 1.671 |
| NgRx | 5.187 | 0.555 | 0.665 | 1.695 |
| v15 before | 7.272 | 1.234 | 1.222 | 2.556 |
| v15 candidate | 7.272 | 1.234 | 1.223 | 2.556 |
| v16 C1 | 7.946 | 1.576 | 1.559 | 3.248 |
| v16 candidate | 7.944 | 1.568 | 1.539 | 3.240 |
| TanStack | 7.627 | 1.095 | 1.387 | 2.960 |
| TanStack alternative | 7.628 | 1.095 | 1.386 | 2.960 |

## Matched before/after changes

These are medians of matched differences and their observed ranges.
They need not equal differences between the group medians above.
Positive latency or heap means more cost; positive throughput means more
checked work per second. Five pairs are descriptive, not confidence intervals.

| Line | Rows | Metric | Unit | Paired median change | Observed range |
| --- | ---: | --- | --- | ---: | --- |
| v15 | 1000 | Factory | ms | -0.5 | -1.4 to 4.8 |
| v15 | 1000 | Repeated full context p50 | ms | 0.0 | -0.1 to 0.1 |
| v15 | 1000 | Stage 128 | ms | -12.6 | -22.0 to 6.1 |
| v15 | 1000 | Settle 128 | ms | -2.1 | -18.2 to 14.9 |
| v15 | 1000 | User-to-layout p95 | ms | 0.1 | -0.1 to 0.6 |
| v15 | 1000 | Trace throughput | commands/second | 4.4 | -8.9 to 13.3 |
| v16 | 1000 | Factory | ms | -8.4 | -17.6 to 15.0 |
| v16 | 1000 | Repeated full context p50 | ms | 0.0 | -0.1 to 0.1 |
| v16 | 1000 | Stage 128 | ms | 3.0 | -8.9 to 7.8 |
| v16 | 1000 | Settle 128 | ms | -0.7 | -11.9 to 24.6 |
| v16 | 1000 | User-to-layout p95 | ms | 0.4 | -0.3 to 0.7 |
| v16 | 1000 | Trace throughput | commands/second | 3.2 | -4.2 to 10.0 |
| v15 | 1000 | Populated above blank | bytes | 0 | -12 to 36 |
| v15 | 1000 | Pending 128 increment | bytes | -120 | -1780 to 120 |
| v15 | 1000 | Settled 128 increment | bytes | -212 | -2228 to 980 |
| v15 | 1000 | Destroyed above blank | bytes | -96 | -400 to 772 |
| v16 | 1000 | Populated above blank | bytes | 700 | -12 to 1204 |
| v16 | 1000 | Pending 128 increment | bytes | -7068 | -7636 to -3676 |
| v16 | 1000 | Settled 128 increment | bytes | -18804 | -19496 to -15888 |
| v16 | 1000 | Destroyed above blank | bytes | -6464 | -16904 to -4532 |
| v15 | 10000 | Factory | ms | -0.2 | -6.8 to 4.0 |
| v15 | 10000 | Repeated full context p50 | ms | 0.1 | -0.6 to 0.6 |
| v15 | 10000 | Stage 128 | ms | -0.9 | -8.8 to 15.3 |
| v15 | 10000 | Settle 128 | ms | 3.6 | -7.8 to 13.6 |
| v15 | 10000 | User-to-layout p95 | ms | 0.6 | -1.1 to 2.1 |
| v15 | 10000 | Trace throughput | commands/second | -12.3 | -18.2 to 7.6 |
| v16 | 10000 | Factory | ms | -8.3 | -17.2 to 26.0 |
| v16 | 10000 | Repeated full context p50 | ms | 0.1 | -0.4 to 0.2 |
| v16 | 10000 | Stage 128 | ms | 7.2 | -24.6 to 21.7 |
| v16 | 10000 | Settle 128 | ms | 2.2 | -12.6 to 13.8 |
| v16 | 10000 | User-to-layout p95 | ms | 0.0 | -1.2 to 0.4 |
| v16 | 10000 | Trace throughput | commands/second | 5.9 | -11.4 to 7.3 |
| v15 | 10000 | Populated above blank | bytes | 24 | -24 to 324 |
| v15 | 10000 | Pending 128 increment | bytes | 224 | -1556 to 1840 |
| v15 | 10000 | Settled 128 increment | bytes | 512 | -6480 to 2144 |
| v15 | 10000 | Destroyed above blank | bytes | 120 | -3296 to 584 |
| v16 | 10000 | Populated above blank | bytes | -816 | -1848 to -296 |
| v16 | 10000 | Pending 128 increment | bytes | -7736 | -9812 to 10692 |
| v16 | 10000 | Settled 128 increment | bytes | -19344 | -21656 to 28768 |
| v16 | 10000 | Destroyed above blank | bytes | -8176 | -9184 to 920 |

## Identity and replay

The fixed workload runs through `run-t-application-final.py` in the
frozen final-followthrough source1 packet. The numerical generator is
`tools/optimization-sweep/application/analyze.mjs`. This table renderer is:

```sh
python3 tools/optimization-sweep/application-report.py SUMMARY_JSON DRIVER_RESULTS_JSON NEW_OUTPUT_MD
```

- Summary SHA-256: `6731e2785686f070322ec5a6b285b36901eb47233a485a95cc2d6df3aef6181d`.
- Completed driver SHA-256: `d4aa85b62c9475744af90e26b1c0ef6dec2c5d2756e1023baff486d439869550`.
- Qualified package seal SHA-256: `45b30e08cc49a01e9f7dfd4abb64655e5eb1338d2e4ae6410fc9f0b74649c778`.

The evidence records contain the complete commands, exact package
membership, child metrics, A/A observations and independent recomputation.
The report retains host contention and implementation-scope limitations.
