# Application comparison: expanded metrics

Current v16 source: `5801008ea4ca591b3be483e8bbb0aa02e15f59ed`. Selected v15 source: `4e791f32238fa7bdde480c5408a23dc4a4bca804`.
These are the completed eight-implementation application results. Each normal
arm/size/kind has five fresh-browser samples, with rotated order. The 176
comparison children include separate v15 same-build controls. CPU-facing
timing and forced-GC heap cohorts remain separate. All 88 behavior controls,
32 context controls, 9 metric controls, 16 calibration children and 12
analysis-admission controls complete. The exact artifacts and limits are
identified by this run’s plan.json and package-identities.json.

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
| Native Angular | 1.2 | 0.7 | 0.3 | 12.1 |
| NgRx | 1.2 | 0.5 | 0.3 | 11.2 |
| v15 before | 4.5 | 0.6 | 0.3 | 11.8 |
| v15 candidate | 4.6 | 0.7 | 0.3 | 11.4 |
| v16 frozen baseline | 25.4 | 0.6 | 0.3 | 12.2 |
| v16 candidate | 25.8 | 0.7 | 0.2 | 12.3 |
| TanStack | 7.1 | 0.5 | 0.3 | 12.1 |
| TanStack alternative | 7.0 | 0.5 | 0.3 | 12.2 |

| Implementation | Stage 128 proposals ms | Settle 128 proposals ms | Checked commands/second |
| --- | ---: | ---: | ---: |
| Native Angular | 220.3 | 229.5 | 214.1 |
| NgRx | 222.0 | 227.9 | 218.2 |
| v15 before | 230.0 | 231.2 | 220.3 |
| v15 candidate | 225.8 | 231.7 | 215.4 |
| v16 frozen baseline | 230.2 | 230.3 | 218.4 |
| v16 candidate | 231.2 | 229.9 | 220.6 |
| TanStack | 228.0 | 229.4 | 215.7 |
| TanStack alternative | 226.8 | 230.4 | 211.4 |

Heap uses decimal MB. Pending and settled columns are increments over
their immediately preceding populated checkpoint.

| Implementation | Populated above blank MB | Pending 128 increment MB | Settled 128 increment MB | Destroyed above blank MB |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 2.339 | 0.521 | 0.613 | 1.673 |
| NgRx | 1.802 | 0.553 | 0.660 | 1.696 |
| v15 before | 2.341 | 1.223 | 1.213 | 2.565 |
| v15 candidate | 2.338 | 1.226 | 1.214 | 2.563 |
| v16 frozen baseline | 2.741 | 1.575 | 1.593 | 3.242 |
| v16 candidate | 2.742 | 1.569 | 1.575 | 3.246 |
| TanStack | 2.687 | 1.093 | 1.406 | 2.959 |
| TanStack alternative | 2.687 | 1.091 | 1.406 | 2.960 |

## 10,000 rows

| Implementation | Factory ms | First full context ms | Repeated full context p50 ms | User-to-layout p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 6.8 | 4.7 | 3.1 | 11.9 |
| NgRx | 4.6 | 3.5 | 2.8 | 11.6 |
| v15 before | 11.7 | 5.4 | 2.8 | 12.6 |
| v15 candidate | 11.8 | 5.4 | 2.8 | 12.6 |
| v16 frozen baseline | 171.2 | 5.1 | 2.9 | 13.0 |
| v16 candidate | 167.0 | 4.8 | 2.8 | 12.7 |
| TanStack | 38.2 | 3.6 | 2.9 | 12.4 |
| TanStack alternative | 36.5 | 3.6 | 2.9 | 12.3 |

| Implementation | Stage 128 proposals ms | Settle 128 proposals ms | Checked commands/second |
| --- | ---: | ---: | ---: |
| Native Angular | 222.6 | 227.8 | 212.4 |
| NgRx | 229.2 | 265.4 | 207.3 |
| v15 before | 226.8 | 230.1 | 213.0 |
| v15 candidate | 231.0 | 232.5 | 209.4 |
| v16 frozen baseline | 231.2 | 228.9 | 208.7 |
| v16 candidate | 227.0 | 230.1 | 211.2 |
| TanStack | 227.3 | 230.5 | 215.0 |
| TanStack alternative | 230.0 | 230.2 | 218.2 |

Heap uses decimal MB. Pending and settled columns are increments over
their immediately preceding populated checkpoint.

| Implementation | Populated above blank MB | Pending 128 increment MB | Settled 128 increment MB | Destroyed above blank MB |
| --- | ---: | ---: | ---: | ---: |
| Native Angular | 10.838 | 0.522 | 0.614 | 1.670 |
| NgRx | 5.187 | 0.554 | 0.665 | 1.695 |
| v15 before | 7.272 | 1.233 | 1.223 | 2.556 |
| v15 candidate | 7.269 | 1.233 | 1.222 | 2.555 |
| v16 frozen baseline | 7.946 | 1.576 | 1.559 | 3.248 |
| v16 candidate | 7.946 | 1.569 | 1.541 | 3.243 |
| TanStack | 7.627 | 1.093 | 1.388 | 2.960 |
| TanStack alternative | 7.627 | 1.094 | 1.388 | 2.960 |

## Matched before/after changes

These are medians of matched differences and their observed ranges.
They need not equal differences between the group medians above.
Positive latency or heap means more cost; positive throughput means more
checked work per second. Five pairs are descriptive, not confidence intervals.

| Line | Rows | Metric | Unit | Paired median change | Observed range |
| --- | ---: | --- | --- | ---: | --- |
| v15 | 1000 | Factory | ms | 0.0 | -0.3 to 0.4 |
| v15 | 1000 | Repeated full context p50 | ms | 0.0 | -0.1 to 0.1 |
| v15 | 1000 | Stage 128 | ms | -0.5 | -10.2 to 4.7 |
| v15 | 1000 | Settle 128 | ms | -0.5 | -8.7 to 1.8 |
| v15 | 1000 | User-to-layout p95 | ms | -0.2 | -1.0 to 0.5 |
| v15 | 1000 | Trace throughput | commands/second | -0.1 | -13.0 to 5.9 |
| v16 | 1000 | Factory | ms | 0.5 | -6.3 to 1.1 |
| v16 | 1000 | Repeated full context p50 | ms | -0.1 | -0.1 to 0.0 |
| v16 | 1000 | Stage 128 | ms | 4.9 | -7.1 to 8.0 |
| v16 | 1000 | Settle 128 | ms | -0.5 | -2.4 to 8.2 |
| v16 | 1000 | User-to-layout p95 | ms | 0.1 | -0.8 to 1.4 |
| v16 | 1000 | Trace throughput | commands/second | 2.2 | -0.2 to 12.3 |
| v15 | 1000 | Populated above blank | bytes | -3188 | -3224 to -3164 |
| v15 | 1000 | Pending 128 increment | bytes | 2420 | -1128 to 2504 |
| v15 | 1000 | Settled 128 increment | bytes | 1976 | -580 to 4616 |
| v15 | 1000 | Destroyed above blank | bytes | -2500 | -11148 to 7700 |
| v16 | 1000 | Populated above blank | bytes | 1320 | 80 to 1744 |
| v16 | 1000 | Pending 128 increment | bytes | -6452 | -6784 to -4676 |
| v16 | 1000 | Settled 128 increment | bytes | -18208 | -19620 to -13276 |
| v16 | 1000 | Destroyed above blank | bytes | -3588 | -5800 to 5100 |
| v15 | 10000 | Factory | ms | 0.3 | -0.8 to 0.9 |
| v15 | 10000 | Repeated full context p50 | ms | -0.1 | -0.1 to 0.0 |
| v15 | 10000 | Stage 128 | ms | 6.3 | -9.2 to 9.6 |
| v15 | 10000 | Settle 128 | ms | 0.7 | -0.4 to 4.2 |
| v15 | 10000 | User-to-layout p95 | ms | 0.2 | -0.8 to 0.6 |
| v15 | 10000 | Trace throughput | commands/second | -1.8 | -10.0 to 13.7 |
| v16 | 10000 | Factory | ms | -4.4 | -14.9 to -0.1 |
| v16 | 10000 | Repeated full context p50 | ms | -0.1 | -0.1 to 0.1 |
| v16 | 10000 | Stage 128 | ms | -2.3 | -11.8 to 2.8 |
| v16 | 10000 | Settle 128 | ms | 0.9 | -5.2 to 2.7 |
| v16 | 10000 | User-to-layout p95 | ms | -0.3 | -0.7 to 0.0 |
| v16 | 10000 | Trace throughput | commands/second | 2.6 | -4.2 to 16.9 |
| v15 | 10000 | Populated above blank | bytes | -3188 | -3488 to -2936 |
| v15 | 10000 | Pending 128 increment | bytes | 320 | -1208 to 2444 |
| v15 | 10000 | Settled 128 increment | bytes | -344 | -7464 to 3280 |
| v15 | 10000 | Destroyed above blank | bytes | -1612 | -3696 to -872 |
| v16 | 10000 | Populated above blank | bytes | 396 | -448 to 1328 |
| v16 | 10000 | Pending 128 increment | bytes | -7052 | -7860 to -5856 |
| v16 | 10000 | Settled 128 increment | bytes | -18344 | -19260 to -9588 |
| v16 | 10000 | Destroyed above blank | bytes | -5308 | -5568 to -4292 |

## Identity and replay

The fixed workload runs through `tools/oversight-peer-refresh/refresh.py`
with unchanged pinned peer strategies. The numerical generator is
`tools/optimization-sweep/application/analyze.mjs`. The base numerical table
source is `tools/optimization-sweep/application-report.py`.
`tools/oversight-peer-refresh/render.py` applied the recorded identity-only
substitutions; its actual command and derivation are preserved in the evidence.
After extracting that archive into the working directory, regenerate the tables
with the preserved derived renderer (choose a new output file):

```sh
python3 runs/oversight-peer-refresh-run-1/renderer/application-report-identified.py SUMMARY_JSON DRIVER_RESULTS_JSON NEW_OUTPUT_MD
```

- Summary SHA-256: `04120ea97b5a9057981802e92ae0141c4633eb2d12373ba49d3b78a713b5c19b`.
- Completed driver SHA-256: `04f1d9d90498afbb7a8b9ca9dc19f9240f7c31b4546f2d1d282d9ed10d8b7292`.
- Selected package identity seal SHA-256: `30296a47fffee96e7768ebc08ceb48d310e539105b0ffa5a539da11a4cd66698`.

The evidence archive preserves the complete commands, exact package
membership, child metrics, A/A observations and independent recomputation.
The report retains host contention and implementation-scope limitations.
