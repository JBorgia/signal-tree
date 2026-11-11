# Finite lifecycle diagnostics

Both twelve-child schedules, recorded bindings, raw children and ordered stage receipts passed offline validation. No timing or leak verdict is inferred.

Heap values below are MiB (1,048,576 bytes), median [minimum, maximum]. JSON preserves exact bytes, all three before/after/difference pairs for every metric and raw receipt identities.

Command: `"/Library/Frameworks/Python.framework/Versions/3.14/bin/python3" "/Users/jonathanborgia/code/signaltree/.worktrees/application-comparison/tools/application-lab/analyze-lifecycle.py" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/lifecycle-inventory-aging-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/lifecycle-publication-payloads-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/lifecycle-analysis-1"`

## inventory-aging / 1000 rows

| Checkpoint | Before heap | After heap | Paired difference | Three pairs, before → after |
| --- | ---: | ---: | ---: | --- |
| populated | 3.8327 [3.8312, 3.8343] | 3.6755 [3.6718, 3.6759] | -0.1587 [-0.1609, -0.1553] | r0: 3.8312 → 3.6759; r1: 3.8327 → 3.6718; r2: 3.8343 → 3.6755 |
| after-400-edits | 4.8266 [4.8255, 4.8292] | 4.6182 [4.6149, 4.6185] | -0.2110 [-0.2117, -0.2071] | r0: 4.8255 → 4.6185; r1: 4.8266 → 4.6149; r2: 4.8292 → 4.6182 |
| after-1200-edits | 5.1268 [5.1263, 5.1292] | 4.7647 [4.7604, 4.7651] | -0.3645 [-0.3663, -0.3611] | r0: 5.1263 → 4.7651; r1: 5.1268 → 4.7604; r2: 5.1292 → 4.7647 |
| after-2400-edits | 5.3165 [5.3116, 5.3195] | 4.8462 [4.8418, 4.8468] | -0.4698 [-0.4733, -0.4697] | r0: 5.3165 → 4.8468; r1: 5.3116 → 4.8418; r2: 5.3195 → 4.8462 |
| after-4800-edits | 5.2800 [5.2778, 5.2842] | 5.0594 [5.0566, 5.0601] | -0.2212 [-0.2248, -0.2200] | r0: 5.2800 → 5.0601; r1: 5.2778 → 5.0566; r2: 5.2842 → 5.0594 |
| after-destroy | 4.2385 [4.2364, 4.2386] | 3.9682 [3.9671, 3.9682] | -0.2705 [-0.2713, -0.2682] | r0: 4.2364 → 3.9682; r1: 4.2385 → 3.9671; r2: 4.2386 → 3.9682 |

## inventory-aging / 10000 rows

| Checkpoint | Before heap | After heap | Paired difference | Three pairs, before → after |
| --- | ---: | ---: | ---: | --- |
| populated | 10.5607 [10.5531, 10.5671] | 11.4849 [11.4846, 11.4851] | 0.9243 [0.9175, 0.9318] | r0: 10.5531 → 11.4849; r1: 10.5607 → 11.4851; r2: 10.5671 → 11.4846 |
| after-400-edits | 11.5011 [11.5004, 11.5123] | 12.3106 [12.2937, 12.3112] | 0.7983 [0.7926, 0.8108] | r0: 11.5004 → 12.3112; r1: 11.5011 → 12.2937; r2: 11.5123 → 12.3106 |
| after-1200-edits | 11.8029 [11.8012, 11.8151] | 12.6633 [12.6630, 12.6636] | 0.8607 [0.8478, 0.8620] | r0: 11.8029 → 12.6636; r1: 11.8012 → 12.6633; r2: 11.8151 → 12.6630 |
| after-2400-edits | 11.9815 [11.9805, 11.9932] | 12.5673 [12.5670, 12.5677] | 0.5862 [0.5739, 0.5867] | r0: 11.9815 → 12.5677; r1: 11.9805 → 12.5673; r2: 11.9932 → 12.5670 |
| after-4800-edits | 11.9618 [11.9584, 11.9729] | 12.7927 [12.7926, 12.7933] | 0.8315 [0.8198, 0.8343] | r0: 11.9618 → 12.7933; r1: 11.9584 → 12.7926; r2: 11.9729 → 12.7927 |
| after-destroy | 4.2570 [4.2558, 4.2573] | 3.9828 [3.9823, 3.9830] | -0.2742 [-0.2750, -0.2729] | r0: 4.2570 → 3.9828; r1: 4.2558 → 3.9830; r2: 4.2573 → 3.9823 |

## publication-payloads / 1000 rows

| Checkpoint | Before heap | After heap | Paired difference | Three pairs, before → after |
| --- | ---: | ---: | ---: | --- |
| populated | 3.1414 [3.1414, 3.1415] | 3.1415 [3.1415, 3.1415] | 0.0000 [0.0000, 0.0001] | r0: 3.1414 → 3.1415; r1: 3.1415 → 3.1415; r2: 3.1414 → 3.1415 |
| 8-total-started-held | 6.2347 [6.2346, 6.2358] | 5.7357 [5.7357, 5.7365] | -0.4989 [-0.5001, -0.4982] | r0: 6.2347 → 5.7365; r1: 6.2358 → 5.7357; r2: 6.2346 → 5.7357 |
| 8-total-acknowledged | 5.7656 [5.7655, 5.7656] | 5.7624 [5.7624, 5.7633] | -0.0031 [-0.0032, -0.0022] | r0: 5.7655 → 5.7633; r1: 5.7656 → 5.7624; r2: 5.7656 → 5.7624 |
| 8-total-pruned | 5.3189 [5.3115, 5.3190] | 5.3143 [5.3142, 5.3151] | -0.0038 [-0.0048, 0.0028] | r0: 5.3189 → 5.3151; r1: 5.3115 → 5.3143; r2: 5.3190 → 5.3142 |
| 16-total-started-held | 7.7350 [7.7349, 7.7392] | 7.2352 [7.2352, 7.2361] | -0.4999 [-0.5040, -0.4989] | r0: 7.7349 → 7.2361; r1: 7.7392 → 7.2352; r2: 7.7350 → 7.2352 |
| 16-total-acknowledged | 7.2521 [7.2519, 7.2522] | 7.2495 [7.2494, 7.2503] | -0.0025 [-0.0027, -0.0018] | r0: 7.2521 → 7.2503; r1: 7.2519 → 7.2494; r2: 7.2522 → 7.2495 |
| 16-total-pruned | 6.7666 [6.7664, 6.7667] | 6.7621 [6.7620, 6.7630] | -0.0043 [-0.0046, -0.0036] | r0: 6.7666 → 6.7630; r1: 6.7664 → 6.7621; r2: 6.7667 → 6.7620 |
| before-pending-teardown | 6.7714 [6.7712, 6.7715] | 6.7719 [6.7718, 6.7727] | 0.0006 [0.0003, 0.0013] | r0: 6.7714 → 6.7727; r1: 6.7712 → 6.7719; r2: 6.7715 → 6.7718 |
| after-destroy-before-late | 6.9983 [6.9981, 6.9984] | 6.9960 [6.9960, 6.9969] | -0.0020 [-0.0024, -0.0014] | r0: 6.9983 → 6.9969; r1: 6.9981 → 6.9960; r2: 6.9984 → 6.9960 |
| after-destroy-after-late | 3.8286 [3.8283, 3.8286] | 3.8262 [3.8262, 3.8262] | -0.0024 [-0.0024, -0.0021] | r0: 3.8286 → 3.8262; r1: 3.8283 → 3.8262; r2: 3.8286 → 3.8262 |

## publication-payloads / 10000 rows

| Checkpoint | Before heap | After heap | Paired difference | Three pairs, before → after |
| --- | ---: | ---: | ---: | --- |
| populated | 7.8532 [7.8531, 7.8535] | 7.8535 [7.8533, 7.8542] | 0.0005 [-0.0002, 0.0010] | r0: 7.8532 → 7.8542; r1: 7.8535 → 7.8533; r2: 7.8531 → 7.8535 |
| 8-total-started-held | 32.1502 [32.1502, 32.1528] | 27.2584 [27.2574, 27.2591] | -4.8929 [-4.8937, -4.8918] | r0: 32.1502 → 27.2574; r1: 32.1528 → 27.2591; r2: 32.1502 → 27.2584 |
| 8-total-acknowledged | 27.2885 [27.2873, 27.2885] | 27.2856 [27.2849, 27.2858] | -0.0027 [-0.0036, -0.0018] | r0: 27.2885 → 27.2858; r1: 27.2873 → 27.2856; r2: 27.2885 → 27.2849 |
| 8-total-pruned | 22.4478 [22.4478, 22.4494] | 22.4430 [22.4422, 22.4431] | -0.0056 [-0.0064, -0.0047] | r0: 22.4478 → 22.4431; r1: 22.4494 → 22.4430; r2: 22.4478 → 22.4422 |
| 16-total-started-held | 46.2945 [46.2911, 46.2951] | 41.3937 [41.3929, 41.3961] | -4.8989 [-4.9016, -4.8974] | r0: 46.2951 → 41.3961; r1: 46.2911 → 41.3937; r2: 46.2945 → 41.3929 |
| 16-total-acknowledged | 41.4156 [41.4122, 41.4166] | 41.4072 [41.4036, 41.4080] | -0.0084 [-0.0130, -0.0042] | r0: 41.4166 → 41.4036; r1: 41.4122 → 41.4080; r2: 41.4156 → 41.4072 |
| 16-total-pruned | 36.5354 [36.5320, 36.5364] | 36.5260 [36.5252, 36.5260] | -0.0102 [-0.0104, -0.0060] | r0: 36.5364 → 36.5260; r1: 36.5320 → 36.5260; r2: 36.5354 → 36.5252 |
| before-pending-teardown | 36.5402 [36.5369, 36.5413] | 36.5358 [36.5350, 36.5358] | -0.0053 [-0.0055, -0.0011] | r0: 36.5413 → 36.5358; r1: 36.5369 → 36.5358; r2: 36.5402 → 36.5350 |
| after-destroy-before-late | 34.7796 [34.7763, 34.7807] | 34.7725 [34.7717, 34.7725] | -0.0079 [-0.0082, -0.0038] | r0: 34.7807 → 34.7725; r1: 34.7763 → 34.7725; r2: 34.7796 → 34.7717 |
| after-destroy-after-late | 3.8335 [3.8327, 3.8336] | 3.8296 [3.8295, 3.8304] | -0.0031 [-0.0041, -0.0031] | r0: 3.8336 → 3.8295; r1: 3.8335 → 3.8304; r2: 3.8327 → 3.8296 |

## Final weak-reference observations

| Mode | Rows | Round | Variant | Tracked | Alive | Collected | Snapshot |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| inventory-aging | 1000 | 0 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 1000 | 0 | after | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 1000 | 1 | after | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 1000 | 1 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 1000 | 2 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 1000 | 2 | after | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 0 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 0 | after | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 1 | after | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 1 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 2 | before | 4800 | 0 | 4800 | Not triggered |
| inventory-aging | 10000 | 2 | after | 4800 | 0 | 4800 | Not triggered |
| publication-payloads | 1000 | 0 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 1000 | 0 | after | 16 | 0 | 16 | Not triggered |
| publication-payloads | 1000 | 1 | after | 16 | 0 | 16 | Not triggered |
| publication-payloads | 1000 | 1 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 1000 | 2 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 1000 | 2 | after | 16 | 0 | 16 | Not triggered |
| publication-payloads | 10000 | 0 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 10000 | 0 | after | 16 | 0 | 16 | Not triggered |
| publication-payloads | 10000 | 1 | after | 16 | 0 | 16 | Not triggered |
| publication-payloads | 10000 | 1 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 10000 | 2 | before | 32 | 0 | 32 | Not triggered |
| publication-payloads | 10000 | 2 | after | 16 | 0 | 16 | Not triggered |

## Limits

- Three matched fresh-browser pairs per size/mode; no A/A controls. All individual pairs and min/median/max are descriptive; no ratios, latency, significance, noise-band or winner claims.
- Heap is whole-application forced-GC JS used bytes, including diagnostic WeakRefs/metadata and warmed framework/library state. Publication mode retains common backend history until final late delivery releases the old backend reference.
- Heap is sampled before post-GC weak-reference inspection. Current-identity getter reads can materialize objects during inspection. Observed public identities do not enumerate every internal allocation or retained path.
- WeakRef survival is not a leak verdict, and collection of sampled targets does not establish universal leak freedom or unlimited boundedness. Final survivors require the recorded complete heap snapshot for later retaining-path attribution.
- The bound browser helper asserted full payload equality/digests in-page and each checked edit. Raw receipts preserve compact stage evidence, not every full historical payload or intermediate DOM state; this analyzer does not replay the browser.
- Hash checks establish consistency with included bindings, not authenticity or comprehensive reproducibility. Source/library versions, workload and host observations remain attached to the raw receipts.
