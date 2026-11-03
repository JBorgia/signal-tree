# Matched complete-candidate costs

Generated with `python3 render-cost-tables.py <evidence-directory>` from cost-final-8d/summary.json. Six timing rounds, three memory pairs, six construction pairs. All raw samples, protocol and qualifications remain authoritative.

| Checked timing workload | Baseline ns/op median of round means | Candidate ns/op median | Paired wall ratio median (range) | CPU ratio median | Baseline A/A range |
|---|---:|---:|---:|---:|---:|
| timing-scalar-L16 | 59.9 | 59.8 | 1.003 (0.914–1.033) | 0.974 | 0.917–1.065 |
| timing-scalar-L128 | 59.5 | 60.7 | 1.022 (0.910–1.237) | 0.990 | 0.696–1.185 |
| timing-derived-L16 | 226.7 | 231.2 | 1.010 (0.954–1.045) | 1.040 | 0.866–1.050 |
| timing-entity-L16 | 325.0 | 334.1 | 1.028 (0.905–1.078) | 1.015 | 0.943–1.132 |
| timing-tx-confirm-L16 | 18237.9 | 23154.5 | 1.252 (1.133–1.316) | 1.202 | 0.805–1.014 |
| timing-tx-rollback-L16 | 27868.8 | 34552.9 | 1.248 (1.220–1.366) | 1.212 | 0.946–1.104 |

| Heap fixture/checkpoint | Baseline median MB | Candidate median MB | Paired additional bytes median |
|---|---:|---:|---:|
| memory-memory-bare-L16-T32/idle | 1.517 | 1.525 | 8288 |
| memory-memory-bare-L16-T32/destroyed | 0.411 | 0.413 | 2008 |
| memory-memory-bare-L128-T32/idle | 7.850 | 7.859 | 8384 |
| memory-memory-bare-L128-T32/destroyed | 0.870 | 0.872 | 2104 |
| memory-memory-confirm-L16-T16/idle | 2.671 | 2.971 | 299824 |
| memory-memory-confirm-L16-T16/pending | 3.074 | 3.470 | 401888 |
| memory-memory-confirm-L16-T16/settled-handles-dropped | 3.084 | 3.478 | 394240 |
| memory-memory-confirm-L16-T16/cycles-1 | 3.624 | 4.087 | 463440 |
| memory-memory-confirm-L16-T16/cycles-2 | 3.684 | 4.077 | 393520 |
| memory-memory-confirm-L16-T16/destroyed | 1.546 | 1.720 | 174136 |
| memory-memory-confirm-L16-T64/idle | 8.207 | 9.172 | 965272 |
| memory-memory-confirm-L16-T64/pending | 8.929 | 10.118 | 1188888 |
| memory-memory-confirm-L16-T64/settled-handles-dropped | 8.741 | 9.870 | 1128568 |
| memory-memory-confirm-L16-T64/cycles-1 | 9.296 | 10.441 | 1145344 |
| memory-memory-confirm-L16-T64/cycles-2 | 9.378 | 10.502 | 1124320 |
| memory-memory-confirm-L16-T64/destroyed | 1.798 | 1.982 | 184528 |
| memory-memory-confirm-L128-T16/idle | 8.641 | 10.419 | 1777760 |
| memory-memory-confirm-L128-T16/pending | 9.028 | 10.916 | 1888360 |
| memory-memory-confirm-L128-T16/settled-handles-dropped | 8.995 | 10.917 | 1922304 |
| memory-memory-confirm-L128-T16/cycles-1 | 9.533 | 11.514 | 1980432 |
| memory-memory-confirm-L128-T16/cycles-2 | 9.599 | 11.509 | 1910864 |
| memory-memory-confirm-L128-T16/destroyed | 1.726 | 1.893 | 166816 |
| memory-memory-rollback-L16-T16/idle | 2.671 | 2.971 | 299824 |
| memory-memory-rollback-L16-T16/pending | 3.074 | 3.470 | 401888 |
| memory-memory-rollback-L16-T16/settled-handles-dropped | 3.383 | 3.826 | 442616 |
| memory-memory-rollback-L16-T16/cycles-1 | 4.154 | 4.666 | 511640 |
| memory-memory-rollback-L16-T16/cycles-2 | 4.225 | 4.685 | 460432 |
| memory-memory-rollback-L16-T16/destroyed | 2.003 | 2.209 | 206272 |
| memory-memory-rollback-L16-T64/idle | 8.207 | 9.172 | 965296 |
| memory-memory-rollback-L16-T64/pending | 8.929 | 10.118 | 1188912 |
| memory-memory-rollback-L16-T64/settled-handles-dropped | 9.043 | 10.237 | 1193704 |
| memory-memory-rollback-L16-T64/cycles-1 | 9.903 | 11.090 | 1186984 |
| memory-memory-rollback-L16-T64/cycles-2 | 9.922 | 11.094 | 1172016 |
| memory-memory-rollback-L16-T64/destroyed | 2.286 | 2.473 | 189304 |
| memory-memory-rollback-L128-T16/idle | 8.641 | 10.419 | 1777856 |
| memory-memory-rollback-L128-T16/pending | 9.028 | 10.916 | 1888360 |
| memory-memory-rollback-L128-T16/settled-handles-dropped | 9.275 | 11.265 | 1989368 |
| memory-memory-rollback-L128-T16/cycles-1 | 10.043 | 12.100 | 2056432 |
| memory-memory-rollback-L128-T16/cycles-2 | 10.120 | 12.118 | 1998720 |
| memory-memory-rollback-L128-T16/destroyed | 2.181 | 2.382 | 201144 |

| Construction fixture | Baseline µs/tree median | Candidate µs/tree median | Paired wall ratio median (range) | CPU ratio median | Blocks below 100 ms |
|---|---:|---:|---:|---:|---:|
| construct-bare-L16 | 47.62 | 52.29 | 1.104 (1.071–1.300) | 1.025 | 12/12 |
| construct-bare-L128 | 319.70 | 325.57 | 1.012 (0.883–1.040) | 1.313 | 12/12 |
| construct-transactions-L16 | 96.54 | 105.04 | 1.096 (1.045–1.164) | 1.047 | 12/12 |
| construct-transactions-L128 | 582.65 | 645.06 | 1.107 (1.085–1.902) | 1.032 | 11/12 |
