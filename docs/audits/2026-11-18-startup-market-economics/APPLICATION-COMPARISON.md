# Complete-application startup and live cost

Fresh current-to-successor production Angular cohort: five main samples per arm, workload and measurement kind, plus separate A/A controls for both release lines. CPU-facing browser measurements and forced-GC heap use separate fresh browser processes. These workload sizes do not represent sampled industries or device classes.

## Delivered application JavaScript

| Implementation | Raw JS bytes | Gzip bytes | Gzip difference from native |
| --- | ---: | ---: | ---: |
| Native Angular implementation | 126,404 | 41,969 | +0 |
| NgRx Signals | 132,442 | 43,736 | +1,767 |
| Current v15 baseline | 325,452 | 101,689 | +59,720 |
| Selected v15 | 325,398 | 101,661 | +59,692 |
| Current v16 baseline | 480,635 | 147,301 | +105,332 |
| Selected v16 | 481,410 | 147,481 | +105,512 |
| TanStack DB | 423,272 | 130,053 | +88,084 |
| TanStack application variant | 423,402 | 130,071 | +88,102 |

These are actual complete emitted application JavaScript files, not padded enterprise bundles or isolated package minima. Maps are excluded. Transfer floors in the machine-readable report are illustrative and omit request latency, caching, parse/execute time and non-JavaScript assets.

## 500 resident rows

| Implementation | Factory ms | Navigation-to-layout ms | Absolute app heap MB | Heap above blank MB | Additional pending-128 MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 1.2 | 26.1 | 2.395 | 1.877 | 0.521 |
| NgRx Signals | 0.9 | 23.3 | 2.132 | 1.614 | 0.553 |
| Selected v15 | 4.2 | 30.3 | 2.599 | 2.082 | 1.231 |
| Selected v16 | 13.8 | 42.6 | 2.912 | 2.394 | 1.562 |
| TanStack DB | 5.7 | 38.3 | 2.940 | 2.423 | 1.089 |
| TanStack application variant | 5.5 | 36.3 | 2.940 | 2.423 | 1.090 |

| Implementation | Full context repeated p95 ms | Optimistic user enqueue-to-layout p95 ms | Settle 128 responses ms | Complete 180 commands ms | Checked commands/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 0.20 | 11.90 | 231.2 | 847.3 | 212.4 |
| NgRx Signals | 0.20 | 11.80 | 230.8 | 863.8 | 208.4 |
| Selected v15 | 0.20 | 12.10 | 231.7 | 861.9 | 208.8 |
| Selected v16 | 0.20 | 12.30 | 230.8 | 842.8 | 213.6 |
| TanStack DB | 0.20 | 12.20 | 229.7 | 852.0 | 211.3 |
| TanStack application variant | 0.20 | 12.30 | 231.1 | 863.7 | 208.4 |

## 10,000 resident rows

| Implementation | Factory ms | Navigation-to-layout ms | Absolute app heap MB | Heap above blank MB | Additional pending-128 MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 7.1 | 40.1 | 11.356 | 10.838 | 0.521 |
| NgRx Signals | 4.7 | 36.7 | 5.704 | 5.187 | 0.553 |
| Selected v15 | 11.4 | 47.6 | 7.556 | 7.039 | 1.231 |
| Selected v16 | 133.0 | 171.6 | 8.170 | 7.653 | 1.564 |
| TanStack DB | 37.8 | 80.1 | 8.145 | 7.627 | 1.094 |
| TanStack application variant | 36.1 | 79.2 | 8.145 | 7.627 | 1.096 |

| Implementation | Full context repeated p95 ms | Optimistic user enqueue-to-layout p95 ms | Settle 128 responses ms | Complete 180 commands ms | Checked commands/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 3.70 | 12.20 | 232.0 | 834.4 | 215.7 |
| NgRx Signals | 4.70 | 11.20 | 264.2 | 834.8 | 215.6 |
| Selected v15 | 3.20 | 12.30 | 231.5 | 844.6 | 213.1 |
| Selected v16 | 3.30 | 12.60 | 230.8 | 856.7 | 210.1 |
| TanStack DB | 3.20 | 12.60 | 229.6 | 857.1 | 210.0 |
| TanStack application variant | 3.40 | 12.20 | 230.2 | 834.2 | 215.8 |

## 50,000 resident rows

| Implementation | Factory ms | Navigation-to-layout ms | Absolute app heap MB | Heap above blank MB | Additional pending-128 MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 27.9 | 99.1 | 48.626 | 48.109 | 0.521 |
| NgRx Signals | 22.1 | 96.0 | 21.105 | 20.588 | 0.553 |
| Selected v15 | 40.8 | 115.1 | 26.946 | 26.429 | 1.222 |
| Selected v16 | 638.7 | 722.3 | 31.338 | 30.820 | 1.562 |
| TanStack DB | 167.0 | 252.3 | 29.037 | 28.520 | 1.094 |
| TanStack application variant | 163.4 | 244.1 | 29.038 | 28.520 | 1.095 |

| Implementation | Full context repeated p95 ms | Optimistic user enqueue-to-layout p95 ms | Settle 128 responses ms | Complete 180 commands ms | Checked commands/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 17.90 | 12.00 | 228.7 | 802.4 | 224.3 |
| NgRx Signals | 16.60 | 0.90 | 1310.1 | 2008.6 | 89.6 |
| Selected v15 | 17.20 | 12.60 | 230.4 | 853.9 | 210.8 |
| Selected v16 | 20.40 | 12.40 | 228.8 | 833.5 | 216.0 |
| TanStack DB | 18.70 | 12.10 | 230.2 | 851.2 | 211.5 |
| TanStack application variant | 19.30 | 12.00 | 231.3 | 839.3 | 214.5 |

## Matched changes and observed A/A variation

| Rows | Candidate vs its current baseline | Factory paired median [min, max] ms | Same-candidate A/A range ms | Populated heap paired median bytes |
| ---: | --- | ---: | ---: | ---: |
| 500 | v15 | -0.20 [-0.30, -0.10] | [-0.50, +0.10] | -7,768 |
| 500 | v16 | -3.10 [-5.00, -1.10] | [-4.10, +2.00] | -68,312 |
| 10,000 | v15 | -0.40 [-0.60, +0.20] | [-0.20, +0.40] | -230,020 |
| 10,000 | v16 | -37.90 [-68.80, -31.80] | [-2.80, -0.70] | -293,036 |
| 50,000 | v15 | -4.00 [-5.90, -1.20] | [-0.90, +3.30] | -917,956 |
| 50,000 | v16 | -201.60 [-253.00, -199.40] | [-70.90, -27.90] | -982,204 |

| Rows | Line | Settle-128 paired median [range] ms | Absolute settled-128 heap difference B | Settled-minus-populated increment difference B | Destroyed-minus-blank difference B |
| ---: | --- | ---: | ---: | ---: | ---: |
| 500 | v15 | +0.70 [-4.70, +5.60] | -9,880 | -2,112 | -1,444 |
| 500 | v16 | -0.10 [-0.30, +3.00] | -25,952 | +42,220 | -15,552 |
| 10,000 | v15 | -0.40 [-2.40, +2.10] | -229,520 | +348 | -220 |
| 10,000 | v16 | +1.10 [+0.80, +5.30] | -252,940 | +41,852 | -20,244 |
| 50,000 | v15 | +0.60 [-1.30, +7.90] | -919,700 | -1,668 | -364 |
| 50,000 | v16 | -1.40 [-2.10, +0.10] | -934,832 | +45,900 | -16,976 |

The v16 settled-minus-populated increment grows by roughly 42–46 KB even while its absolute settled heap is lower than its current baseline. At 10,000 rows its 128-response elapsed time increases in all five pairs. These adverse observations remain; startup/allocation improvements do not establish a general active-work win. Destroyed-minus-blank is signed whole-process residual heap, not proof of retained trees or universally zero residual cost.

A/A comprises two pairs per line/workload/kind and is descriptive, not a confidence interval or proof of equivalence. Small rankings require their paired variation and host load to be considered. No sample is dropped.

## Interpretation limits

Heap includes Angular, application, selected library and in-memory service state. Pending growth includes retained receipts/logs. Full-context demand follows UI and selected-context reads; it is not an untouched-store first read. Per-child p95s are summarized across children, never pooled. The 180-command throughput includes asynchronous validation and service work. Synthetic enqueue timing is not real-user INP. Nested intervals and browser-duration categories must not be added.

Optimistic UI latency samples one synthetic human action at each round's start; authoritative responses follow after that sample. Next-round human arrival waits for settlement, so latency is schedule-dependent and does not estimate independently arriving input during response work. Settlement and complete checked throughput expose that omitted cost; neither layout completion nor rAF gaps measure INP or paint. Settlement-128 includes serial processing, stabilization and individual decision checks, stopping before subsequent aggregate assertions and dismissal. Complete-180 also includes checks, logs, dismissal and yields.

At 50,000 rows, NgRx's small optimistic UI interval coexists with slower complete-command throughput and response settlement. The inspected implementation patches a small operation list for optimistic registration but calls NgRx updateEntity for authoritative receipts; that implementation copies the entity map and ID array. This is a source-supported explanation for a scaling cost, not a CPU-profile attribution of its exact share. Timer/frame alignment also affects the narrow UI interval; the recordings do not establish its exact causal contribution or a missed-frame catastrophe.

The common application outcome checks do not reproduce every v16 native guarantee in peer libraries. Native ownership/publication, retirement, reentry and the point-work bound require the separate runtime and installed-application evidence. Construction may be one-time for a long-lived store, but this experiment does not establish a universal later-performance crossover.

The accompanying capacity envelopes and delay-money scenarios are explicit assumptions, not new release gates. The base economics assigns no cash value to browser heap or fractional-second delays.
