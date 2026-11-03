# Measured distributions

Five decision samples per arm; two extra incumbent A/A controls. Ranges are min–max, not confidence intervals. All timing includes checks. Deltas are candidate minus incumbent.

## Synchronous checked cycles

| Profile | Rows | Incumbent µs median [range] | Candidate µs median [range] | Delta µs | Delta % | Direction under preregistered rule |
|---|---:|---:|---:|---:|---:|---|

## Whole-process heap deltas in bytes

Empty controls hold 100 trees; populated/pending profiles hold 10 trees. Pending holds 10 owners per tree. No per-tree heap slope is assumed. Negative residuals can arise from process heap noise.

| Profile / checkpoint | Rows/tree | Incumbent median [range] | Candidate median [range] | Delta bytes | Direction |
|---|---:|---:|---:|---:|---|
| heap-empty / live_drained_delta_bytes | 0 | 1158768 [1158768, 1158840] | 1187816 [1187816, 1187816] | +29048 | candidate higher |
| heap-empty / destroyed_drained_delta_bytes | 0 | 307560 [307560, 307560] | 314208 [314208, 314208] | +6648 | candidate higher |
| heap-pending / live_drained_delta_bytes | 100 | 3581400 [3581400, 3581400] | 3588776 [3588776, 3588776] | +7376 | candidate higher |
| heap-pending / destroyed_drained_delta_bytes | 100 | 1782408 [1782408, 1782408] | 1787128 [1787128, 1787128] | +4720 | candidate higher |
| heap-pending / enhanced_idle_primed_delta_bytes | 100 | 2832000 [2832000, 2832000] | 2838720 [2838720, 2838720] | +6720 | candidate higher |
| heap-pending / pending_increment_drained_bytes | 100 | 749400 [749400, 749400] | 750056 [750056, 750056] | +656 | candidate higher |
| heap-pending / live_drained_delta_bytes | 1000 | 6715240 [6711520, 6715440] | 6721568 [6721552, 6721584] | +6328 | candidate higher |
| heap-pending / destroyed_drained_delta_bytes | 1000 | 1802040 [1801944, 1802656] | 1806400 [1806384, 1806496] | +4360 | candidate higher |
| heap-pending / enhanced_idle_primed_delta_bytes | 1000 | 6061528 [6060336, 6083384] | 6067144 [6067128, 6067160] | +5616 | unresolved |
| heap-pending / pending_increment_drained_bytes | 1000 | 653912 [628136, 654888] | 654424 [654424, 654424] | +512 | unresolved |
| heap-pending / live_drained_delta_bytes | 10000 | 49073192 [49070064, 49076832] | 49083320 [49077832, 49086576] | +10128 | candidate higher |
| heap-pending / destroyed_drained_delta_bytes | 10000 | 1812160 [1811680, 1815624] | 1819544 [1816760, 1821688] | +7384 | candidate higher |
| heap-pending / enhanced_idle_primed_delta_bytes | 10000 | 49118328 [49117968, 49120872] | 49126856 [49125080, 49129368] | +8528 | unresolved |
| heap-pending / pending_increment_drained_bytes | 10000 | -47072 [-47904, -44040] | -43320 [-47248, -42792] | +3752 | unresolved |
| heap-populated / live_drained_delta_bytes | 100 | 1637312 [1637312, 1637312] | 1642872 [1642872, 1642872] | +5560 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 100 | 640144 [640144, 640144] | 641544 [641544, 641544] | +1400 | candidate higher |
| heap-populated / live_drained_delta_bytes | 1000 | 4852488 [4851592, 4852632] | 4857408 [4857408, 4857408] | +4920 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 1000 | 645216 [644360, 645360] | 646144 [646144, 646144] | +928 | unresolved |
| heap-populated / live_drained_delta_bytes | 10000 | 47902776 [47900944, 47904752] | 47907920 [47907248, 47910344] | +5144 | candidate higher |
| heap-populated / destroyed_drained_delta_bytes | 10000 | 655472 [654640, 656136] | 657064 [656872, 657536] | +1592 | candidate higher |

CPU, batch-drain, pre-drain, settled and baseline distributions and A/A samples are in summary.json. Raw records retain environment/load observations.
