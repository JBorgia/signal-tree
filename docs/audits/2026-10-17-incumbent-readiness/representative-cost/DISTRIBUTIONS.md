# Measured distributions

Five decision samples per arm; two extra incumbent A/A controls. Ranges are min–max, not confidence intervals. All timing includes checks. Deltas are candidate minus incumbent.

## Synchronous checked cycles

| Profile | Rows | Incumbent µs median [range] | Candidate µs median [range] | Delta µs | Delta % | Direction under preregistered rule |
|---|---:|---:|---:|---:|---:|---|
| bare | 0 | 0.16 [0.15, 0.17] | 0.15 [0.15, 0.16] | -0.00 | -2.9% | unresolved |
| churn | 100 | 42.52 [42.21, 49.07] | 44.22 [42.16, 47.30] | +1.70 | +4.0% | unresolved |
| churn | 1000 | 54.73 [53.55, 56.11] | 54.59 [54.31, 55.23] | -0.14 | -0.3% | unresolved |
| churn | 10000 | 86.15 [84.16, 87.75] | 84.28 [81.32, 87.57] | -1.88 | -2.2% | unresolved |
| confirm | 100 | 46.16 [45.37, 46.65] | 47.09 [45.23, 49.31] | +0.93 | +2.0% | unresolved |
| confirm | 1000 | 45.49 [43.23, 48.42] | 44.61 [44.49, 46.49] | -0.88 | -1.9% | unresolved |
| confirm | 10000 | 64.36 [61.76, 68.35] | 61.26 [50.05, 84.07] | -3.09 | -4.8% | unresolved |
| construction | 100 | 256.09 [248.58, 265.65] | 257.91 [252.20, 263.72] | +1.82 | +0.7% | unresolved |
| empty | 0 | 12.79 [12.11, 14.64] | 14.86 [12.62, 15.46] | +2.08 | +16.2% | unresolved |
| overlap | 100 | 61.11 [59.77, 64.74] | 61.49 [59.09, 62.67] | +0.38 | +0.6% | unresolved |
| point | 100 | 1.27 [1.20, 1.33] | 1.28 [1.24, 1.31] | +0.01 | +0.8% | unresolved |
| point | 1000 | 1.22 [1.21, 1.25] | 1.27 [1.26, 1.33] | +0.05 | +4.2% | unresolved |
| point | 10000 | 1.11 [1.07, 1.16] | 1.14 [1.09, 1.16] | +0.02 | +2.0% | unresolved |
| projection | 100 | 9.33 [9.06, 11.77] | 9.53 [9.43, 9.72] | +0.20 | +2.1% | unresolved |
| projection | 1000 | 28.26 [27.60, 28.66] | 28.05 [27.44, 29.22] | -0.22 | -0.8% | unresolved |
| projection | 10000 | 279.60 [259.49, 380.90] | 277.09 [260.50, 289.09] | -2.51 | -0.9% | unresolved |
| refusal | 100 | 280.78 [276.70, 288.07] | 285.81 [280.94, 298.61] | +5.03 | +1.8% | unresolved |
| rollback | 100 | 76.13 [74.37, 78.13] | 78.01 [76.39, 79.78] | +1.88 | +2.5% | unresolved |
| rollback | 1000 | 76.89 [72.05, 79.14] | 76.73 [75.69, 79.32] | -0.16 | -0.2% | unresolved |
| rollback | 10000 | 103.34 [76.61, 105.19] | 100.66 [99.28, 104.50] | -2.68 | -2.6% | unresolved |

## Whole-process heap deltas in bytes

Empty controls hold 100 trees; populated/pending profiles hold 10 trees. Pending holds 10 owners per tree. No per-tree heap slope is assumed. Negative residuals can arise from process heap noise.

| Profile / checkpoint | Rows/tree | Incumbent median [range] | Candidate median [range] | Delta bytes | Direction |
|---|---:|---:|---:|---:|---|
| heap-empty / live_drained_delta_bytes | 0 | 1177568 [1177568, 1177568] | 1206616 [1206616, 1206616] | +29048 | candidate higher |
| heap-empty / destroyed_drained_delta_bytes | 0 | 333136 [333136, 333136] | 340008 [340008, 340008] | +6872 | candidate higher |
| heap-pending / live_drained_delta_bytes | 100 | 3561856 [3561856, 3561952] | 3569232 [3568784, 3569304] | +7376 | candidate higher |
| heap-pending / destroyed_drained_delta_bytes | 100 | 2083480 [2083480, 2083576] | 2088616 [2088616, 2088688] | +5136 | candidate higher |
| heap-pending / enhanced_idle_primed_delta_bytes | 100 | 2826792 [2826792, 2826888] | 2833512 [2833512, 2855464] | +6720 | unresolved |
| heap-pending / pending_increment_drained_bytes | 100 | 735064 [735064, 735064] | 735720 [713320, 735720] | +656 | unresolved |
| heap-pending / live_drained_delta_bytes | 1000 | 6694296 [6694200, 6694568] | 6700192 [6698328, 6700784] | +5896 | candidate higher |
| heap-pending / destroyed_drained_delta_bytes | 1000 | 2435080 [2435024, 2435568] | 2439104 [2436280, 2439184] | +4024 | candidate higher |
| heap-pending / enhanced_idle_primed_delta_bytes | 1000 | 6056424 [6056104, 6057784] | 6061936 [6060976, 6063632] | +5512 | candidate higher |
| heap-pending / pending_increment_drained_bytes | 1000 | 638144 [636416, 638192] | 637352 [636496, 638848] | -792 | unresolved |
| heap-pending / live_drained_delta_bytes | 10000 | 49052336 [49050744, 49064160] | 49059248 [49058408, 49064552] | +6912 | unresolved |
| heap-pending / destroyed_drained_delta_bytes | 10000 | 6830816 [6827144, 6832968] | 6832984 [6830728, 6836792] | +2168 | unresolved |
| heap-pending / enhanced_idle_primed_delta_bytes | 10000 | 49115632 [49112944, 49117344] | 49120288 [49119904, 49123280] | +4656 | candidate higher |
| heap-pending / pending_increment_drained_bytes | 10000 | -62200 [-64064, -53184] | -61216 [-61496, -58728] | +984 | unresolved |
| heap-populated / live_drained_delta_bytes | 100 | 1631016 [1631016, 1631136] | 1636576 [1636576, 1636648] | +5560 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 100 | 774208 [774208, 774328] | 776024 [776024, 776096] | +1816 | candidate higher |
| heap-populated / live_drained_delta_bytes | 1000 | 4846192 [4846192, 4846192] | 4851112 [4851112, 4851112] | +4920 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 1000 | 1126304 [1126304, 1126304] | 1127480 [1127480, 1127480] | +1176 | candidate higher |
| heap-populated / live_drained_delta_bytes | 10000 | 47895360 [47894648, 47897880] | 47902096 [47901240, 47902904] | +6736 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 10000 | 5587144 [5586432, 5589664] | 5590136 [5589280, 5590944] | +2992 | unresolved |

CPU, batch-drain, pre-drain, settled and baseline distributions and A/A samples are in summary.json. Raw records retain environment/load observations.
