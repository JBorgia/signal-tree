# Application comparison

All admitted schedules, conformance receipts, child results and recorded file bindings passed offline validation. These are descriptive measurements, not significance tests.

Cells show median [minimum, maximum] across five independent children. Heap table values are MiB (1,048,576 bytes); JSON preserves exact bytes and all metrics. Latency entries summarize each child’s own p95; operations are never pooled across children.

Command: `"/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node" "/Users/jonathanborgia/code/signaltree/.worktrees/application-comparison/tools/application-lab/analyze.mjs" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-baseline-4" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/inventory-comparison-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/dispatch-comparison-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/baseline-comparison-analysis-1"`

## inventory / combined — 1000 rows, CDP 1×

| Arm | Navigation (ms) | Filter p95 (ms) | Toggle p95 (ms) | Populated (MiB) | After destroy (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 32.6 [28.8, 72.4] | 5 [3.6, 5.3] | 1.5 [1.2, 2] | 2.2535 [2.2529, 2.2585] | 2.7725 [2.772, 2.7755] |
| ngrx | 36.9 [23.7, 49.5] | 4.3 [3.6, 5.1] | 1.6 [1.1, 1.7] | 2.0609 [2.0609, 2.0639] | 2.807 [2.8056, 2.8082] |
| tanstack | 73.9 [63.4, 93.4] | 12.6 [10.4, 13.7] | 2.9 [1.8, 3] | 3.7619 [3.761, 3.7639] | 4.8875 [4.8849, 4.8892] |
| v15 | 39.9 [36.3, 45.7] | 4.2 [4, 5] | 1.2 [1.1, 1.5] | 2.4335 [2.4328, 2.4335] | 3.1156 [3.1127, 3.1156] |
| v16 | 70.3 [59, 110.2] | 4.9 [3.2, 5.2] | 1.8 [1.1, 2.7] | 2.8037 [2.803, 2.806] | 3.4843 [3.4807, 3.4846] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 1.6642 [1.5818, 2.4114] (valid n=5/5) | 0.74467 [0.7125, 0.77684] (valid n=2/2) |
| Filter p95 (ms) | 0.98 [0.78049, 1.2381] (valid n=5/5) | 0.84191 [0.625, 1.0588] (valid n=2/2) |
| Toggle p95 (ms) | 1.3846 [0.91667, 2.25] (valid n=5/5) | 0.89286 [0.78571, 1] (valid n=2/2) |
| Populated (MiB) | 1.1521 [1.1518, 1.1531] (valid n=5/5) | 1.0006 [0.99988, 1.0012] (valid n=2/2) |
| After destroy (MiB) | 1.1183 [1.1173, 1.1195] (valid n=5/5) | 0.99943 [0.99934, 0.99953] (valid n=2/2) |

## inventory / combined — 1000 rows, CDP 4×

| Arm | Navigation (ms) | Filter p95 (ms) | Toggle p95 (ms) | Populated (MiB) | After destroy (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 98 [92, 114.7] | 13.1 [12.3, 16.5] | 4.2 [3.5, 5.6] | 2.2535 [2.2528, 2.2568] | 2.7697 [2.7696, 2.7752] |
| ngrx | 100.3 [88.7, 118.7] | 12.6 [12.2, 13.4] | 5.2 [4.3, 6.3] | 2.0611 [2.0609, 2.0641] | 2.8043 [2.8036, 2.8058] |
| tanstack | 259.7 [241.7, 304] | 49.2 [48, 51.3] | 10.1 [8.7, 12] | 3.7564 [3.7555, 3.7592] | 4.8872 [4.8819, 4.8902] |
| v15 | 134.7 [111.4, 167] | 14.1 [11.3, 19.5] | 5.5 [4.1, 6.3] | 2.4331 [2.4292, 2.4358] | 3.1116 [3.1096, 3.1133] |
| v16 | 237.5 [225, 268.9] | 13.2 [11.6, 16.1] | 5.7 [5.4, 7.6] | 2.8034 [2.8022, 2.8047] | 3.4795 [3.4784, 3.4804] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 1.9963 [1.3725, 2.1746] (valid n=5/5) | 0.98701 [0.83774, 1.1363] (valid n=2/2) |
| Filter p95 (ms) | 1.1348 [0.59487, 1.1926] (valid n=5/5) | 1.0124 [0.98347, 1.0413] (valid n=2/2) |
| Toggle p95 (ms) | 1.2391 [0.85714, 1.3818] (valid n=5/5) | 1.0302 [0.78947, 1.2708] (valid n=2/2) |
| Populated (MiB) | 1.1521 [1.1504, 1.1546] (valid n=5/5) | 1.0013 [0.99954, 1.0031] (valid n=2/2) |
| After destroy (MiB) | 1.1182 [1.1179, 1.119] (valid n=5/5) | 0.99988 [0.99946, 1.0003] (valid n=2/2) |

## inventory / combined — 10000 rows, CDP 1×

| Arm | Navigation (ms) | Filter p95 (ms) | Toggle p95 (ms) | Populated (MiB) | After destroy (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 57.1 [31.4, 63.8] | 6.9 [3.9, 8.7] | 3.2 [2.1, 3.8] | 6.3214 [6.3191, 6.3216] | 2.7715 [2.7704, 2.7728] |
| ngrx | 40.6 [31.4, 55.3] | 4.4 [3.4, 7.4] | 4.7 [3.7, 6.8] | 4.1641 [4.1634, 4.1643] | 2.8061 [2.8056, 2.8081] |
| tanstack | 201.7 [185.1, 291.9] | 71.2 [62.6, 97.1] | 2.9 [2.8, 3.2] | 10.491 [10.481, 10.496] | 4.9038 [4.9025, 4.915] |
| v15 | 45.5 [42.1, 58.2] | 4.5 [3.2, 6.6] | 3 [2, 3.4] | 6.0467 [6.0464, 6.0493] | 3.1131 [3.1125, 3.1169] |
| v16 | 285 [273.8, 293.5] | 4.9 [3.7, 7.1] | 4.9 [2.6, 5.3] | 6.9963 [6.9953, 6.9987] | 3.4864 [3.4843, 3.4889] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 6.1495 [4.9948, 6.7696] (valid n=5/5) | 1.0055 [0.92086, 1.0901] (valid n=2/2) |
| Filter p95 (ms) | 1.0758 [0.82222, 1.5312] (valid n=5/5) | 1.0969 [0.85, 1.3437] (valid n=2/2) |
| Toggle p95 (ms) | 1.4412 [1.3, 1.8929] (valid n=5/5) | 0.92766 [0.80769, 1.0476] (valid n=2/2) |
| Populated (MiB) | 1.1569 [1.1564, 1.1575] (valid n=5/5) | 1 [0.99996, 1.0001] (valid n=2/2) |
| After destroy (MiB) | 1.1199 [1.1179, 1.1209] (valid n=5/5) | 0.99965 [0.99963, 0.99966] (valid n=2/2) |

## dispatch / timing — 1000 rows, CDP 1×

| Arm | Navigation (ms) | Assign owner p95 (ms) | Reject status p95 (ms) | Accept owner p95 (ms) | Ack processing p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 43.5 [34.9, 105.6] | 1.7 [1, 2.2] | 0.9 [0.8, 1.1] | 2.2 [1.5, 3.1] | 0.5 [0.4, 0.5] |
| ngrx | 35 [33.2, 168.9] | 1.7 [1.2, 2.7] | 1.3 [1.1, 1.9] | 3.2 [1.8, 3.8] | 0.4 [0.4, 0.4] |
| tanstack | 56.1 [42.5, 162.8] | 1.6 [1.3, 2.7] | 1.5 [1.3, 1.7] | 4.7 [3.8, 6.3] | 3.8 [3.6, 4.3] |
| v15 | 61.4 [34.3, 153.9] | 1.3 [1.2, 2.7] | 1.3 [0.9, 2] | 2.2 [1.6, 3.4] | 0.5 [0.4, 0.5] |
| v16 | 134.3 [58.6, 213] | 2.2 [1.8, 2.9] | 2.5 [2.2, 3.6] | 3.7 [2.2, 4.2] | 0.6 [0.4, 0.7] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 2.0612 [0.63557, 3.4974] (valid n=5/5) | 1.9005 [1.2998, 2.5013] (valid n=2/2) |
| Assign owner p95 (ms) | 1.3846 [1.0741, 2.25] (valid n=5/5) | 0.99819 [0.91304, 1.0833] (valid n=2/2) |
| Reject status p95 (ms) | 2 [1.25, 2.4444] (valid n=5/5) | 0.8913 [0.78261, 1] (valid n=2/2) |
| Accept owner p95 (ms) | 1.16 [1, 2.4706] (valid n=5/5) | 0.93103 [0.86207, 1] (valid n=2/2) |
| Ack processing p95 (ms) | 1.2 [0.8, 1.5] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |

## dispatch / memory — 1000 rows, CDP 1×

| Arm | Populated (MiB) | Pending (MiB) | Preview (MiB) | After late reply (MiB) | Growth +100→+200 (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 2.7496 [2.7495, 2.7516] | 3.9042 [3.9042, 3.9064] | 4.1009 [4.1009, 4.1031] | 2.8784 [2.8782, 2.8788] | 0.09407 [0.093704, 0.095451] |
| ngrx | 2.2387 [2.2386, 2.2389] | 3.4394 [3.4324, 3.4397] | 3.7512 [3.7438, 3.7541] | 2.9062 [2.9059, 2.9073] | 0.096962 [0.094051, 0.097191] |
| tanstack | 3.0827 [3.076, 3.085] | 4.7744 [4.7743, 4.7754] | 5.3702 [5.3699, 5.3711] | 4.0265 [4.0217, 4.03] | -0.083672 [-0.084419, -0.072281] |
| v15 | 2.7483 [2.7483, 2.7486] | 4.5566 [4.5545, 4.5572] | 4.6132 [4.6121, 4.6137] | 4.0169 [4.0146, 4.017] | 0.23663 [0.22048, 0.24289] |
| v16 | 3.1285 [3.1281, 3.1288] | 5.2657 [5.2647, 5.2665] | 5.3342 [5.3331, 5.335] | 4.8487 [4.8474, 4.8497] | 0.21291 [0.20803, 0.2254] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Populated (MiB) | 1.1382 [1.1382, 1.1384] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |
| Pending (MiB) | 1.1557 [1.1556, 1.1559] (valid n=5/5) | 0.99999 [0.99998, 1] (valid n=2/2) |
| Preview (MiB) | 1.1563 [1.1561, 1.1564] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |
| After late reply (MiB) | 1.2071 [1.2067, 1.208] (valid n=5/5) | 0.99967 [0.99945, 0.99989] (valid n=2/2) |
| Growth +100→+200 (MiB) | 0.90851 [0.87657, 0.95252] (valid n=5/5) | 0.97369 [0.92932, 1.0181] (valid n=2/2) |

## dispatch / timing — 1000 rows, CDP 4×

| Arm | Navigation (ms) | Assign owner p95 (ms) | Reject status p95 (ms) | Accept owner p95 (ms) | Ack processing p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 96.5 [70.5, 114.2] | 4.5 [3.4, 4.9] | 3 [2.2, 3.1] | 6.4 [5.4, 6.7] | 1.4 [1, 1.8] |
| ngrx | 111.4 [99.8, 123.4] | 5.1 [4.9, 5.8] | 4.2 [3.8, 4.7] | 8 [6.7, 9.1] | 1.6 [1.3, 1.9] |
| tanstack | 159 [115.7, 161.5] | 5.6 [5.4, 6.2] | 4.4 [3.4, 4.5] | 14.4 [12.9, 16.5] | 8.9 [8.5, 9.5] |
| v15 | 117.6 [91.6, 120.9] | 5.5 [4, 5.7] | 4.9 [3.5, 6] | 7.7 [5.9, 8.7] | 1.8 [1.2, 2.3] |
| v16 | 186.6 [168.1, 249.8] | 5.6 [5, 7.8] | 5.4 [4.8, 7.1] | 8.1 [7.5, 10.9] | 1.4 [1.2, 2.2] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 1.8238 [1.5473, 2.1241] (valid n=5/5) | 1.0718 [0.98677, 1.1568] (valid n=2/2) |
| Assign owner p95 (ms) | 1.25 [1, 1.4182] (valid n=5/5) | 1.0641 [1.0351, 1.093] (valid n=2/2) |
| Reject status p95 (ms) | 1.2 [1.0167, 1.5429] (valid n=5/5) | 0.8388 [0.44231, 1.2353] (valid n=2/2) |
| Accept owner p95 (ms) | 1.2529 [0.96203, 1.3117] (valid n=5/5) | 0.97046 [0.8764, 1.0645] (valid n=2/2) |
| Ack processing p95 (ms) | 0.8 [0.77778, 1.0476] (valid n=5/5) | 0.95085 [0.84615, 1.0556] (valid n=2/2) |

## dispatch / memory — 1000 rows, CDP 4×

| Arm | Populated (MiB) | Pending (MiB) | Preview (MiB) | After late reply (MiB) | Growth +100→+200 (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 2.7498 [2.7495, 2.7498] | 3.9046 [3.9043, 3.9047] | 4.0999 [4.0995, 4.1012] | 2.8789 [2.8783, 2.8792] | 0.09515 [0.093494, 0.095715] |
| ngrx | 2.2387 [2.2386, 2.2389] | 3.4394 [3.4393, 3.4398] | 3.7508 [3.7508, 3.7545] | 2.9074 [2.9039, 2.9077] | 0.094791 [0.094791, 0.095173] |
| tanstack | 3.0842 [3.0842, 3.0843] | 4.7749 [4.7748, 4.775] | 5.3695 [5.3694, 5.3703] | 4.0292 [4.0283, 4.0299] | -0.073624 [-0.076935, -0.069218] |
| v15 | 2.7478 [2.7446, 2.7487] | 4.5566 [4.5552, 4.5575] | 4.6131 [4.6117, 4.614] | 4.0178 [4.0173, 4.0185] | 0.23996 [0.23345, 0.2436] |
| v16 | 3.1281 [3.128, 3.1286] | 5.2654 [5.2642, 5.2663] | 5.3341 [5.3335, 5.335] | 4.8457 [4.8428, 4.8499] | 0.21257 [0.2064, 0.23734] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Populated (MiB) | 1.1384 [1.138, 1.1397] (valid n=5/5) | 0.99934 [0.99867, 1] (valid n=2/2) |
| Pending (MiB) | 1.1554 [1.1552, 1.156] (valid n=5/5) | 0.99969 [0.9996, 0.99979] (valid n=2/2) |
| Preview (MiB) | 1.1564 [1.1559, 1.1567] (valid n=5/5) | 0.99988 [0.9996, 1.0002] (valid n=2/2) |
| After late reply (MiB) | 1.206 [1.2051, 1.2072] (valid n=5/5) | 0.99961 [0.99916, 1.0001] (valid n=2/2) |
| Growth +100→+200 (MiB) | 0.89287 [0.86303, 0.9743] (valid n=5/5) | 1.0379 [1.0143, 1.0615] (valid n=2/2) |

## dispatch / timing — 10000 rows, CDP 1×

| Arm | Navigation (ms) | Assign owner p95 (ms) | Reject status p95 (ms) | Accept owner p95 (ms) | Ack processing p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 47.1 [37.3, 54.1] | 3.2 [2.3, 3.5] | 2.1 [1.4, 2.5] | 12.3 [10.5, 14] | 0.4 [0.3, 0.4] |
| ngrx | 45.7 [34.1, 57.9] | 4.7 [3.8, 5.8] | 8.6 [6.3, 9.5] | 15.6 [13.4, 20.7] | 0.4 [0.4, 0.5] |
| tanstack | 101.4 [71.5, 104.2] | 1.6 [1.2, 2.9] | 1.9 [1.1, 2.1] | 25.5 [19.1, 34.8] | 22.1 [16.6, 29.3] |
| v15 | 59.4 [45.3, 62] | 2.3 [1.4, 3.8] | 2.9 [1.8, 3.9] | 12.8 [8.7, 14.2] | 0.5 [0.3, 0.6] |
| v16 | 292.8 [256.8, 322.9] | 3.5 [2.6, 4.3] | 5.5 [3, 6.8] | 15.2 [11.6, 19.7] | 0.6 [0.5, 0.6] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Navigation (ms) | 4.9697 [4.1694, 7.128] (valid n=5/5) | 0.87047 [0.74761, 0.99333] (valid n=2/2) |
| Assign owner p95 (ms) | 1.2647 [1, 2.5] (valid n=5/5) | 1.0157 [0.84615, 1.1852] (valid n=2/2) |
| Reject status p95 (ms) | 1.6667 [1.0345, 3.5] (valid n=5/5) | 0.91035 [0.88889, 0.93182] (valid n=2/2) |
| Accept owner p95 (ms) | 1.2969 [0.90625, 1.7471] (valid n=5/5) | 1.0543 [0.88281, 1.2258] (valid n=2/2) |
| Ack processing p95 (ms) | 1.2 [1, 2] (valid n=5/5) | 0.91667 [0.83333, 1] (valid n=2/2) |

## dispatch / memory — 10000 rows, CDP 1×

| Arm | Populated (MiB) | Pending (MiB) | Preview (MiB) | After late reply (MiB) | Growth +100→+200 (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| native | 10.856 [10.856, 10.859] | 12.01 [12.01, 12.01] | 13.546 [13.546, 13.547] | 2.8771 [2.8768, 2.8796] | 0.09708 [0.096157, 0.097157] |
| ngrx | 5.4664 [5.4664, 5.4664] | 6.6669 [6.6657, 6.6669] | 9.805 [9.8018, 9.8079] | 2.7981 [2.7971, 2.7984] | -0.020195 [-0.020561, -0.016422] |
| tanstack | 7.7965 [7.7959, 7.7969] | 9.4899 [9.4858, 9.4907] | 14.366 [14.36, 14.371] | 4.0425 [4.0414, 4.0437] | 0.12363 [0.12307, 0.13114] |
| v15 | 7.4505 [7.4505, 7.4532] | 9.2672 [9.2662, 9.2673] | 9.4247 [9.4243, 9.4247] | 4.013 [4.0118, 4.0132] | 0.2215 [0.21845, 0.22194] |
| v16 | 8.0925 [8.0917, 8.0932] | 10.231 [10.23, 10.232] | 10.511 [10.51, 10.512] | 4.8567 [4.6732, 4.8608] | 0.21122 [0.056595, 0.22592] |

Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.

| Metric | v16/v15, five pairs | v15 A/A, two pairs |
| --- | ---: | ---: |
| Populated (MiB) | 1.0861 [1.0859, 1.0862] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |
| Pending (MiB) | 1.104 [1.1039, 1.1042] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |
| Preview (MiB) | 1.1153 [1.1152, 1.1154] (valid n=5/5) | 1 [1, 1] (valid n=2/2) |
| After late reply (MiB) | 1.2105 [1.1645, 1.2114] (valid n=5/5) | 1.0001 [0.99949, 1.0008] (valid n=2/2) |
| Growth +100→+200 (MiB) | 0.95296 [0.25908, 1.02] (valid n=5/5) | 0.99419 [0.98767, 1.0007] (valid n=2/2) |

## Served JavaScript

Full served application JavaScript, including bundled dependencies. CSS/HTML and a library-only partition are excluded. Gzip is summed per file.

| Scenario | Arm | Raw bytes | Gzip bytes |
| --- | --- | ---: | ---: |
| inventory | native | 114139 | 38359 |
| inventory | ngrx | 119589 | 40117 |
| inventory | tanstack | 410825 | 126564 |
| inventory | v15 | 203587 | 65391 |
| inventory | v16 | 277674 | 86549 |
| dispatch | native | 125991 | 41857 |
| dispatch | ngrx | 131872 | 43562 |
| dispatch | tanstack | 422810 | 129926 |
| dispatch | v15 | 322611 | 100862 |
| dispatch | v16 | 475837 | 145968 |

## Limits

- Five independent main samples per arm/profile; extrema and medians are descriptive. Within-child p95 is not a population tail. No significance or confidence-interval claim.
- v16/v15 ratios use matched rounds, not ratios of pooled operations. A/A duplicate ratios are separate observations of repeatability, not a confidence interval. Non-positive denominators or negative heap-delta numerators have no ratio; signed differences remain available.
- Synthetic event/response to Angular stabilization and forced layout is not INP. Local acknowledgement processing excludes network delay. Startup stages can overlap and must not be added together.
- Shared host and CDP throttling do not establish calibrated-device performance. Timing and memory are separate dispatch children; memory-child elapsed time supplies no latency evidence.
- Heap checkpoints use forced GC. Observed pre-GC high water is not a true peak or allocation measurement. Finite aging does not prove unlimited boundedness; signed heap growth alone does not establish a leak.
- Dispatch heap includes the application and deterministic service request/application/publication logs plus reserved command/intent IDs. The before-late teardown checkpoint intentionally retains the old backend; it is released after late delivery. This is not library-only retained memory.
- Payload totals cover served JavaScript, including framework/application dependencies, and gzip each file separately. Hash checks bind recorded files and receipts; they are not signed provenance or proof of real-world backend behavior.
- No human productivity, comprehension, adoption or financial ROI measurement. No workload-independent winner or production SLO is inferred.

The JSON contains every startup stage, heap checkpoint/delta, raw child references, paired values/differences and A/A ratios. No aggregate winner is selected.
