# Matched application variants

Complete registered schedules, raw receipts, conformance, source bindings and served bytes passed offline validation. Values are median [min, max]. Repeated-stage latency uses independently recomputed child p95; late preview remains a single observation per child. Operations and timing/memory children are not pooled.

Command: `"/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node" "/Users/jonathanborgia/code/signaltree/.worktrees/application-comparison/tools/application-lab/analyze-variants.mjs" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-baseline-4" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-variant-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/paired-dispatch-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/paired-dispatch-analysis-1" "dispatch"`

## 1000 rows / CDP 1× / timing

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 1.3 [1.2, 4.1] (n=5) | 1.4 [1.1, 1.4] (n=5) | 0.1 [-2.9, 0.2] (n=5) | 1.07692 [0.292683, 1.16667] (n=5) |
| startup.factory (ms) | 6.5 [6, 7.5] (n=5) | 6 [5.8, 6.2] (n=5) | -0.5 [-1.3, 0] (n=5) | 0.923077 [0.826667, 1] (n=5) |
| startup.bootstrapToLayout (ms) | 20.4 [19.2, 36.3] (n=5) | 20.7 [18.9, 21.1] (n=5) | 0.3 [-17.4, 1.9] (n=5) | 1.01471 [0.520661, 1.09896] (n=5) |
| startup.navigationToLayout (ms) | 32.8 [32.2, 85.4] (n=5) | 32.8 [31.4, 33.7] (n=5) | 0 [-54, 1.2] (n=5) | 1 [0.367681, 1.03727] (n=5) |
| latency.assignStatus.withinChildP95 (ms) | 0.6 [0.6, 0.6] (n=5) | 0.7 [0.6, 0.7] (n=5) | 0.0999999 [0, 0.0999999] (n=5) | 1.16667 [1, 1.16667] (n=5) |
| latency.assignOwner.withinChildP95 (ms) | 0.9 [0.8, 1] (n=5) | 0.9 [0.9, 1.1] (n=5) | 0 [-0.1, 0.3] (n=5) | 1 [0.9, 1.375] (n=5) |
| latency.planRequest.withinChildP95 (ms) | 0.5 [0.5, 0.7] (n=5) | 0.5 [0.4, 0.6] (n=5) | -0.0999999 [-0.2, 0.1] (n=5) | 0.8 [0.714286, 1.2] (n=5) |
| latency.rejectStatus.withinChildP95 (ms) | 0.7 [0.6, 0.9] (n=5) | 0.7 [0.5, 0.7] (n=5) | 0 [-0.3, 0.1] (n=5) | 1 [0.666667, 1.16667] (n=5) |
| latency.acceptOwner.withinChildP95 (ms) | 2.7 [2.5, 3.2] (n=5) | 2.1 [2, 2.2] (n=5) | -0.6 [-1, -0.4] (n=5) | 0.777778 [0.6875, 0.84] (n=5) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 1.8 [1.7, 1.8] (n=5) | 0.5 [0.4, 0.5] (n=5) | -1.3 [-1.4, -1.2] (n=5) | 0.277778 [0.222222, 0.294118] (n=5) |
| latency.latePreview.singleObservation (ms) | 12.5 [11.4, 14.3] (n=5) | 11.8 [11.5, 12.3] (n=5) | -0.9 [-2.2, 0.9] (n=5) | 0.928 [0.846154, 1.07895] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 1.4 [1.3, 1.5] (n=2) | 1.4 [1.2, 1.6] (n=2) | 0 [-0.3, 0.3] (n=2) | 1.01538 [0.8, 1.23077] (n=2) |
| startup.factory (ms) | 4.9 [4.1, 5.7] (n=2) | 4.25 [4.2, 4.3] (n=2) | -0.65 [-1.4, 0.0999999] (n=2) | 0.889388 [0.754386, 1.02439] (n=2) |
| startup.bootstrapToLayout (ms) | 16.4 [15, 17.8] (n=2) | 17.25 [16.5, 18] (n=2) | 0.85 [-1.3, 3] (n=2) | 1.06348 [0.926966, 1.2] (n=2) |
| startup.navigationToLayout (ms) | 28.95 [27.1, 30.8] (n=2) | 28.9 [27.9, 29.9] (n=2) | -0.05 [-2.9, 2.8] (n=2) | 1.00458 [0.905844, 1.10332] (n=2) |
| latency.assignStatus.withinChildP95 (ms) | 0.65 [0.6, 0.7] (n=2) | 1 [0.9, 1.1] (n=2) | 0.35 [0.2, 0.5] (n=2) | 1.55952 [1.28571, 1.83333] (n=2) |
| latency.assignOwner.withinChildP95 (ms) | 1.05 [1, 1.1] (n=2) | 1.2 [1.2, 1.2] (n=2) | 0.15 [0.0999999, 0.2] (n=2) | 1.14545 [1.09091, 1.2] (n=2) |
| latency.planRequest.withinChildP95 (ms) | 0.3 [0.3, 0.3] (n=2) | 0.45 [0.4, 0.5] (n=2) | 0.15 [0.0999999, 0.2] (n=2) | 1.5 [1.33333, 1.66667] (n=2) |
| latency.rejectStatus.withinChildP95 (ms) | 0.75 [0.7, 0.8] (n=2) | 1 [0.9, 1.1] (n=2) | 0.25 [0.1, 0.4] (n=2) | 1.34821 [1.125, 1.57143] (n=2) |
| latency.acceptOwner.withinChildP95 (ms) | 1.4 [1.4, 1.4] (n=2) | 1.55 [1.5, 1.6] (n=2) | 0.15 [0.0999999, 0.2] (n=2) | 1.10714 [1.07143, 1.14286] (n=2) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 0.3 [0.3, 0.3] (n=2) | 0.35 [0.3, 0.4] (n=2) | 0.05 [0, 0.0999999] (n=2) | 1.16667 [1, 1.33333] (n=2) |
| latency.latePreview.singleObservation (ms) | 0.85 [0.8, 0.9] (n=2) | 0.95 [0.9, 1] (n=2) | 0.1 [0.1, 0.1] (n=2) | 1.11806 [1.11111, 1.125] (n=2) |

## 1000 rows / CDP 1× / memory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=5) | 514092 [514092, 514092] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.preGC (bytes) | 4830860 [4810990, 4878800] (n=5) | 4828980 [4812380, 4870680] (n=5) | -6848 [-41440, 35048] (n=5) | 0.998582 [0.991506, 1.00725] (n=5) |
| heap.populated.postGC (bytes) | 3234430 [3232460, 3234500] (n=5) | 3234670 [3234630, 3234980] (n=5) | 288 [156, 2208] (n=5) | 1.00009 [1.00005, 1.00068] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 2716950 [2714980, 2717020] (n=5) | 2717190 [2717160, 2717500] (n=5) | 288 [156, 2208] (n=5) | unavailable |
| heap.pending-128.preGC (bytes) | 6344060 [6307040, 7900710] (n=5) | 7778760 [6342240, 7904200] (n=5) | 37140 [196, 1434690] (n=5) | 1.00589 [1.00003, 1.22615] (n=5) |
| heap.pending-128.postGC (bytes) | 5006430 [5006330, 5006460] (n=5) | 5006680 [5006560, 5007310] (n=5) | 268 [204, 880] (n=5) | 1.00005 [1.00004, 1.00018] (n=5) |
| heap.pending-128.deltaFromBlank (bytes) | 4488950 [4488850, 4488980] (n=5) | 4489210 [4489080, 4489840] (n=5) | 268 [204, 880] (n=5) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 6383460 [6379480, 6385200] (n=5) | 6384500 [6352800, 6416420] (n=5) | 184 [-26684, 31288] (n=5) | 1.00003 [0.995817, 1.0049] (n=5) |
| heap.pending-128-preview-open.postGC (bytes) | 5630850 [5630820, 5631240] (n=5) | 5631100 [5631050, 5631870] (n=5) | 204 [-144, 1044] (n=5) | 1.00004 [0.999974, 1.00019] (n=5) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 5113370 [5113350, 5113770] (n=5) | 5113620 [5113580, 5114390] (n=5) | 204 [-144, 1044] (n=5) | unavailable |
| heap.settled-pruned.preGC (bytes) | 7757470 [6897620, 10740300] (n=5) | 7814580 [7713120, 10795200] (n=5) | 57112 [-2082950, 2184760] (n=5) | 1.00736 [0.806063, 1.25373] (n=5) |
| heap.settled-pruned.postGC (bytes) | 5932170 [5928110, 5937660] (n=5) | 5932830 [5932310, 5937800] (n=5) | 940 [-4764, 4720] (n=5) | 1.00016 [0.999198, 1.0008] (n=5) |
| heap.settled-pruned.deltaFromBlank (bytes) | 5414700 [5410630, 5420190] (n=5) | 5415350 [5414830, 5420320] (n=5) | 940 [-4764, 4720] (n=5) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 13179700 [8490890, 14913800] (n=5) | 9613430 [8504850, 11348200] (n=5) | -3042980 [-5364040, 1181650] (n=5) | 0.75957 [0.64033, 1.13917] (n=5) |
| heap.settled-pruned-plus-100.postGC (bytes) | 6360760 [6357550, 6363710] (n=5) | 6364730 [6363510, 6365550] (n=5) | 3976 [560, 7968] (n=5) | 1.00063 [1.00009, 1.00125] (n=5) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 5843280 [5840080, 5846240] (n=5) | 5847260 [5846030, 5848070] (n=5) | 3976 [560, 7968] (n=5) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 12671400 [9086300, 14416900] (n=5) | 14361100 [10571600, 14441400] (n=5) | 1770090 [-3845330, 3903100] (n=5) | 1.13969 [0.733277, 1.42956] (n=5) |
| heap.settled-pruned-plus-200.postGC (bytes) | 6280530 [6277510, 6287920] (n=5) | 6281210 [6280270, 6288830] (n=5) | -264 [-6352, 9528] (n=5) | 0.999958 [0.99899, 1.00152] (n=5) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 5763060 [5760040, 5770450] (n=5) | 5763730 [5762790, 5771350] (n=5) | -264 [-6352, 9528] (n=5) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 7014140 [6991400, 7029230] (n=5) | 7015790 [6987620, 7036700] (n=5) | 444 [-6452, 7468] (n=5) | 1.00006 [0.999081, 1.00106] (n=5) |
| heap.before-pending-teardown.postGC (bytes) | 6269280 [6266260, 6276670] (n=5) | 6272200 [6269150, 6277710] (n=5) | -132 [-6220, 9660] (n=5) | 0.999979 [0.999009, 1.00154] (n=5) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 5751800 [5748780, 5759200] (n=5) | 5754720 [5751670, 5760230] (n=5) | -132 [-6220, 9660] (n=5) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 6404140 [6401120, 6411640] (n=5) | 6407120 [6404100, 6412660] (n=5) | -36 [-6136, 9756] (n=5) | 0.999994 [0.999043, 1.00152] (n=5) |
| heap.after-destroy-before-late.postGC (bytes) | 5405180 [5404670, 5406200] (n=5) | 5406670 [5406010, 5412420] (n=5) | 2004 [-160, 6224] (n=5) | 1.00037 [0.99997, 1.00115] (n=5) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 4887700 [4887190, 4888720] (n=5) | 4889200 [4888540, 4894950] (n=5) | 2004 [-160, 6224] (n=5) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 5430100 [5429580, 5431120] (n=5) | 5431590 [5430930, 5437340] (n=5) | 2004 [-160, 6224] (n=5) | 1.00037 [0.999971, 1.00115] (n=5) |
| heap.after-destroy-after-late.postGC (bytes) | 4223690 [4222490, 4225530] (n=5) | 4226430 [4225820, 4227010] (n=5) | 2508 [288, 3940] (n=5) | 1.00059 [1.00007, 1.00093] (n=5) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3706210 [3705020, 3708050] (n=5) | 3708960 [3708340, 3709530] (n=5) | 2508 [288, 3940] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 14222000 [12041700, 14913800] (n=5) | 14361100 [10571600, 14441400] (n=5) | 52804 [-4342190, 2319460] (n=5) | 1.00368 [0.708847, 1.19262] (n=5) |
| heap.agingGrowth100To200 (bytes) | -80040 [-84412, -71396] (n=5) | -84312 [-84464, -75444] (n=5) | -4272 [-8792, 8968] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -874472 [-882808, -871312] (n=5) | -874452 [-882592, -868784] (n=5) | 2528 [-8120, 8356] (n=5) | unavailable |
| heap.lateDeliveryDelta (bytes) | -1182480 [-1182690, -1179300] (n=5) | -1180420 [-1185460, -1179660] (n=5) | -80 [-2932, 2668] (n=5) | unavailable |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=2) | 514092 [514092, 514092] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.preGC (bytes) | 4031380 [4029200, 4033560] (n=2) | 4037100 [4024750, 4049450] (n=2) | 5716 [-8812, 20244] (n=2) | 1.00142 [0.997815, 1.00502] (n=2) |
| heap.populated.postGC (bytes) | 2881760 [2881760, 2881760] (n=2) | 2881760 [2881760, 2881760] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 2364290 [2364290, 2364290] (n=2) | 2364290 [2364290, 2364290] (n=2) | 0 [0, 0] (n=2) | unavailable |
| heap.pending-128.preGC (bytes) | 7028630 [6847880, 7209380] (n=2) | 7185630 [7161420, 7209840] (n=2) | 156998 [-47956, 361952] (n=2) | 1.0231 [0.993348, 1.05286] (n=2) |
| heap.pending-128.postGC (bytes) | 4777870 [4777870, 4777870] (n=2) | 4777870 [4777870, 4777870] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.pending-128.deltaFromBlank (bytes) | 4260390 [4260390, 4260390] (n=2) | 4260390 [4260390, 4260390] (n=2) | 0 [0, 0] (n=2) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 5233920 [5230370, 5237480] (n=2) | 5252650 [5240650, 5264640] (n=2) | 18724 [3172, 34276] (n=2) | 1.00358 [1.00061, 1.00655] (n=2) |
| heap.pending-128-preview-open.postGC (bytes) | 4837220 [4837220, 4837220] (n=2) | 4837220 [4837220, 4837220] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 4319740 [4319740, 4319740] (n=2) | 4319740 [4319740, 4319740] (n=2) | 0 [0, 0] (n=2) | unavailable |
| heap.settled-pruned.preGC (bytes) | 6826010 [6576370, 7075650] (n=2) | 5740330 [5715310, 5765340] (n=2) | -1085680 [-1360340, -811028] (n=2) | 0.84221 [0.807744, 0.876675] (n=2) |
| heap.settled-pruned.postGC (bytes) | 5184570 [5184150, 5184980] (n=2) | 5179250 [5174180, 5184330] (n=2) | -5314 [-9976, -652] (n=2) | 0.998975 [0.998076, 0.999874] (n=2) |
| heap.settled-pruned.deltaFromBlank (bytes) | 4667090 [4666680, 4667500] (n=2) | 4661780 [4656700, 4666850] (n=2) | -5314 [-9976, -652] (n=2) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 9429010 [9401240, 9456780] (n=2) | 8819790 [8193560, 9446020] (n=2) | -609214 [-1263210, 44784] (n=2) | 0.935593 [0.866423, 1.00476] (n=2) |
| heap.settled-pruned-plus-100.postGC (bytes) | 5620610 [5616490, 5624730] (n=2) | 5617810 [5611220, 5624400] (n=2) | -2802 [-5272, -332] (n=2) | 0.999501 [0.999061, 0.999941] (n=2) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 5103140 [5099020, 5107260] (n=2) | 5100330 [5093740, 5106920] (n=2) | -2802 [-5272, -332] (n=2) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 7484840 [6933720, 8035950] (n=2) | 7253170 [6470630, 8035720] (n=2) | -231666 [-463096, -236] (n=2) | 0.966591 [0.933211, 0.999971] (n=2) |
| heap.settled-pruned-plus-200.postGC (bytes) | 5867720 [5867140, 5868300] (n=2) | 5862060 [5857080, 5867040] (n=2) | -5656 [-11220, -92] (n=2) | 0.999036 [0.998088, 0.999984] (n=2) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 5350240 [5349660, 5350820] (n=2) | 5344580 [5339600, 5349570] (n=2) | -5656 [-11220, -92] (n=2) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 6697820 [6697040, 6698600] (n=2) | 6683150 [6675780, 6690510] (n=2) | -14672 [-21260, -8084] (n=2) | 0.997809 [0.996825, 0.998793] (n=2) |
| heap.before-pending-teardown.postGC (bytes) | 5874830 [5874490, 5875170] (n=2) | 5869330 [5864270, 5874400] (n=2) | -5496 [-10900, -92] (n=2) | 0.999065 [0.998145, 0.999984] (n=2) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 5357350 [5357010, 5357690] (n=2) | 5351860 [5346790, 5356920] (n=2) | -5496 [-10900, -92] (n=2) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 5969500 [5969160, 5969840] (n=2) | 5964000 [5958940, 5969060] (n=2) | -5496 [-10900, -92] (n=2) | 0.999079 [0.998174, 0.999985] (n=2) |
| heap.after-destroy-before-late.postGC (bytes) | 5274190 [5274150, 5274240] (n=2) | 5274260 [5274080, 5274440] (n=2) | 68 [-68, 204] (n=2) | 1.00001 [0.999987, 1.00004] (n=2) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 4756720 [4756670, 4756760] (n=2) | 4756780 [4756600, 4756960] (n=2) | 68 [-68, 204] (n=2) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 5299030 [5298990, 5299080] (n=2) | 5299100 [5298920, 5299280] (n=2) | 68 [-68, 204] (n=2) | 1.00001 [0.999987, 1.00004] (n=2) |
| heap.after-destroy-after-late.postGC (bytes) | 4212200 [4212160, 4212240] (n=2) | 4212270 [4212090, 4212450] (n=2) | 68 [-68, 204] (n=2) | 1.00002 [0.999984, 1.00005] (n=2) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3694720 [3694680, 3694770] (n=2) | 3694790 [3694610, 3694970] (n=2) | 68 [-68, 204] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 9429010 [9401240, 9456780] (n=2) | 8819790 [8193560, 9446020] (n=2) | -609214 [-1263210, 44784] (n=2) | 0.935593 [0.866423, 1.00476] (n=2) |
| heap.agingGrowth100To200 (bytes) | 247104 [242404, 251804] (n=2) | 244250 [242644, 245856] (n=2) | -2854 [-5948, 240] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -593524 [-594148, -592900] (n=2) | -587800 [-592604, -582996] (n=2) | 5724 [296, 11152] (n=2) | unavailable |
| heap.lateDeliveryDelta (bytes) | -1061990 [-1061990, -1061990] (n=2) | -1061990 [-1061990, -1061990] (n=2) | 0 [0, 0] (n=2) | unavailable |

## 1000 rows / CDP 4× / timing

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 5.2 [4.6, 6] (n=5) | 4.5 [4, 5.3] (n=5) | -0.6 [-1.7, 0.0999999] (n=5) | 0.869565 [0.701754, 1.01923] (n=5) |
| startup.factory (ms) | 30.6 [23.2, 36.8] (n=5) | 26.8 [23.4, 29] (n=5) | -1.6 [-10.3, 1.8] (n=5) | 0.947712 [0.720109, 1.072] (n=5) |
| startup.bootstrapToLayout (ms) | 103 [75.9, 118.5] (n=5) | 92.9 [79.2, 99.6] (n=5) | -3.4 [-31.4, 5.9] (n=5) | 0.96699 [0.735021, 1.06705] (n=5) |
| startup.navigationToLayout (ms) | 141.2 [105.2, 158.4] (n=5) | 118.1 [106.5, 142.4] (n=5) | -0.4 [-48.9, 12.9] (n=5) | 0.996258 [0.691288, 1.12262] (n=5) |
| latency.assignStatus.withinChildP95 (ms) | 2.9 [2.5, 3.5] (n=5) | 3.3 [2.7, 4.1] (n=5) | 0.2 [0, 0.6] (n=5) | 1.08 [1, 1.17143] (n=5) |
| latency.assignOwner.withinChildP95 (ms) | 4.1 [3.8, 5.7] (n=5) | 4.6 [4, 5.9] (n=5) | 0.2 [-1.1, 1.1] (n=5) | 1.05263 [0.807018, 1.28205] (n=5) |
| latency.planRequest.withinChildP95 (ms) | 2.6 [2, 3.3] (n=5) | 2.8 [2.2, 3.1] (n=5) | 2.38419e-7 [-0.4, 0.8] (n=5) | 1 [0.846154, 1.4] (n=5) |
| latency.rejectStatus.withinChildP95 (ms) | 3 [2.8, 4.3] (n=5) | 3.2 [3, 4.1] (n=5) | 0.2 [-1.1, 0.2] (n=5) | 1.06667 [0.744186, 1.07143] (n=5) |
| latency.acceptOwner.withinChildP95 (ms) | 11.3 [10.6, 14.3] (n=5) | 11 [9, 11.6] (n=5) | -1.7 [-3.1, 0] (n=5) | 0.849558 [0.783217, 1] (n=5) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 7.4 [7, 8.3] (n=5) | 2.1 [2, 2.8] (n=5) | -5.4 [-5.8, -4.8] (n=5) | 0.285714 [0.265823, 0.337349] (n=5) |
| latency.latePreview.singleObservation (ms) | 51.4 [47.3, 58.3] (n=5) | 50.2 [47.6, 61.4] (n=5) | 1.3 [-8.1, 14.1] (n=5) | 1.02697 [0.854578, 1.2981] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 6.3 [4.8, 7.8] (n=2) | 4.95 [4.8, 5.1] (n=2) | -1.35 [-3, 0.3] (n=2) | 0.838942 [0.615385, 1.0625] (n=2) |
| startup.factory (ms) | 17.35 [16.4, 18.3] (n=2) | 15.8 [15.5, 16.1] (n=2) | -1.55 [-2.8, -0.3] (n=2) | 0.914351 [0.846995, 0.981707] (n=2) |
| startup.bootstrapToLayout (ms) | 71 [67.4, 74.6] (n=2) | 60.15 [59.4, 60.9] (n=2) | -10.85 [-15.2, -6.5] (n=2) | 0.849904 [0.796247, 0.903561] (n=2) |
| startup.navigationToLayout (ms) | 88.8 [85, 92.6] (n=2) | 89.25 [88.8, 89.7] (n=2) | 0.45 [-2.9, 3.8] (n=2) | 1.00669 [0.968683, 1.04471] (n=2) |
| latency.assignStatus.withinChildP95 (ms) | 2.85 [2.7, 3] (n=2) | 3.35 [3.1, 3.6] (n=2) | 0.5 [0.0999999, 0.9] (n=2) | 1.18333 [1.03333, 1.33333] (n=2) |
| latency.assignOwner.withinChildP95 (ms) | 4.45 [4.1, 4.8] (n=2) | 4.2 [4, 4.4] (n=2) | -0.25 [-0.4, -0.0999999] (n=2) | 0.946138 [0.916667, 0.97561] (n=2) |
| latency.planRequest.withinChildP95 (ms) | 1.75 [1.6, 1.9] (n=2) | 1.8 [1.8, 1.8] (n=2) | 0.05 [-0.1, 0.2] (n=2) | 1.03618 [0.947368, 1.125] (n=2) |
| latency.rejectStatus.withinChildP95 (ms) | 3.9 [3.9, 3.9] (n=2) | 3.7 [3.7, 3.7] (n=2) | -0.2 [-0.2, -0.2] (n=2) | 0.948718 [0.948718, 0.948718] (n=2) |
| latency.acceptOwner.withinChildP95 (ms) | 6.55 [6.1, 7] (n=2) | 6.5 [6.3, 6.7] (n=2) | -0.05 [-0.7, 0.6] (n=2) | 0.99918 [0.9, 1.09836] (n=2) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 1.3 [1.2, 1.4] (n=2) | 1.2 [1.1, 1.3] (n=2) | -0.1 [-0.3, 0.0999999] (n=2) | 0.934524 [0.785714, 1.08333] (n=2) |
| latency.latePreview.singleObservation (ms) | 3.4 [3.4, 3.4] (n=2) | 4.7 [3.7, 5.7] (n=2) | 1.3 [0.3, 2.3] (n=2) | 1.38235 [1.08824, 1.67647] (n=2) |

## 1000 rows / CDP 4× / memory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=5) | 514092 [514092, 514092] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.preGC (bytes) | 4828350 [4812380, 4862470] (n=5) | 4828030 [4804480, 4838940] (n=5) | -8356 [-34436, 5272] (n=5) | 0.998276 [0.992918, 1.00109] (n=5) |
| heap.populated.postGC (bytes) | 3234060 [3234000, 3234380] (n=5) | 3234190 [3234170, 3234590] (n=5) | 132 [-216, 588] (n=5) | 1.00004 [0.999933, 1.00018] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 2716580 [2716520, 2716910] (n=5) | 2716720 [2716690, 2717110] (n=5) | 132 [-216, 588] (n=5) | unavailable |
| heap.pending-128.preGC (bytes) | 6347540 [6312210, 7903510] (n=5) | 6345070 [6311560, 6347000] (n=5) | -2464 [-1591950, 32936] (n=5) | 0.999612 [0.798577, 1.00522] (n=5) |
| heap.pending-128.postGC (bytes) | 5006730 [5006270, 5007610] (n=5) | 5007060 [5006710, 5008070] (n=5) | 636 [-632, 1004] (n=5) | 1.00013 [0.999874, 1.0002] (n=5) |
| heap.pending-128.deltaFromBlank (bytes) | 4489260 [4488800, 4490140] (n=5) | 4489580 [4489230, 4490600] (n=5) | 636 [-632, 1004] (n=5) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 6387910 [6350920, 6417380] (n=5) | 6383290 [6381330, 6387320] (n=5) | -4616 [-32808, 36404] (n=5) | 0.999277 [0.994888, 1.00573] (n=5) |
| heap.pending-128-preview-open.postGC (bytes) | 5631080 [5629830, 5631230] (n=5) | 5630370 [5630290, 5631270] (n=5) | -204 [-908, 924] (n=5) | 0.999964 [0.999839, 1.00016] (n=5) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 5113610 [5112360, 5113760] (n=5) | 5112900 [5112810, 5113800] (n=5) | -204 [-908, 924] (n=5) | unavailable |
| heap.settled-pruned.preGC (bytes) | 7752180 [6947850, 10832500] (n=5) | 7822840 [6926760, 10830900] (n=5) | 18116 [-83864, 3040060] (n=5) | 1.00261 [0.988038, 1.39021] (n=5) |
| heap.settled-pruned.postGC (bytes) | 5938760 [5926950, 5942020] (n=5) | 5938610 [5927600, 5942600] (n=5) | 580 [-11608, 12484] (n=5) | 1.0001 [0.998046, 1.00211] (n=5) |
| heap.settled-pruned.deltaFromBlank (bytes) | 5421280 [5409480, 5424540] (n=5) | 5421130 [5410130, 5425120] (n=5) | 580 [-11608, 12484] (n=5) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 11206400 [8657900, 14670000] (n=5) | 9634060 [8681220, 14678800] (n=5) | 8780 [-4954160, 3236870] (n=5) | 1.0006 [0.660304, 1.32741] (n=5) |
| heap.settled-pruned-plus-100.postGC (bytes) | 6365980 [6360690, 6376700] (n=5) | 6367420 [6365780, 6378500] (n=5) | 1232 [-10928, 17808] (n=5) | 1.00019 [0.998286, 1.0028] (n=5) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 5848500 [5843210, 5859230] (n=5) | 5849940 [5848300, 5861020] (n=5) | 1232 [-10928, 17808] (n=5) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 12658800 [10421300, 14959700] (n=5) | 12710700 [9001870, 14424000] (n=5) | 66080 [-5957860, 3845200] (n=5) | 1.0046 [0.60174, 1.36369] (n=5) |
| heap.settled-pruned-plus-200.postGC (bytes) | 6291720 [6288510, 6299200] (n=5) | 6293780 [6288610, 6301250] (n=5) | 2076 [-7724, 11356] (n=5) | 1.00033 [0.998773, 1.00181] (n=5) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 5774240 [5771040, 5781720] (n=5) | 5776300 [5771140, 5783780] (n=5) | 2076 [-7724, 11356] (n=5) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 7005560 [7001590, 7046660] (n=5) | 7013380 [7002110, 7022800] (n=5) | 856 [-44548, 20596] (n=5) | 1.00012 [0.993678, 1.00294] (n=5) |
| heap.before-pending-teardown.postGC (bytes) | 6280470 [6277260, 6287950] (n=5) | 6283160 [6282180, 6290130] (n=5) | 2208 [-5772, 11488] (n=5) | 1.00035 [0.999082, 1.00183] (n=5) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 5762990 [5759780, 5770470] (n=5) | 5765680 [5764700, 5772660] (n=5) | 2208 [-5772, 11488] (n=5) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 6415330 [6412120, 6422810] (n=5) | 6418120 [6417130, 6425090] (n=5) | 2304 [-5676, 11584] (n=5) | 1.00036 [0.999116, 1.00181] (n=5) |
| heap.after-destroy-before-late.postGC (bytes) | 5405640 [5402590, 5408850] (n=5) | 5410450 [5406190, 5411690] (n=5) | 2096 [-1284, 9100] (n=5) | 1.00039 [0.999763, 1.00168] (n=5) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 4888170 [4885110, 4891380] (n=5) | 4892970 [4888710, 4894210] (n=5) | 2096 [-1284, 9100] (n=5) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 5430560 [5427500, 5433770] (n=5) | 5435360 [5431100, 5436600] (n=5) | 2096 [-1284, 9100] (n=5) | 1.00039 [0.999764, 1.00168] (n=5) |
| heap.after-destroy-after-late.postGC (bytes) | 4225010 [4222170, 4225700] (n=5) | 4226740 [4225270, 4227410] (n=5) | 1920 [684, 3096] (n=5) | 1.00045 [1.00016, 1.00073] (n=5) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3707540 [3704700, 3708230] (n=5) | 3709260 [3707790, 3709940] (n=5) | 1920 [684, 3096] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 14584100 [10421300, 14959700] (n=5) | 13123200 [12693800, 14678800] (n=5) | 8780 [-1836540, 2272490] (n=5) | 1.0006 [0.877235, 1.21806] (n=5) |
| heap.agingGrowth100To200 (bytes) | -77384 [-80368, -68968] (n=5) | -77164 [-77368, -72764] (n=5) | 844 [-8276, 3260] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -882868 [-893748, -882868] (n=5) | -882848 [-893684, -876924] (n=5) | 20 [-10816, 16824] (n=5) | unavailable |
| heap.lateDeliveryDelta (bytes) | -1180660 [-1183340, -1180420] (n=5) | -1183520 [-1186420, -1180520] (n=5) | -176 [-6004, 2316] (n=5) | unavailable |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=2) | 514092 [514092, 514092] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.preGC (bytes) | 4032780 [4017140, 4048430] (n=2) | 4031210 [4012820, 4049600] (n=2) | -1576 [-4320, 1168] (n=2) | 0.999607 [0.998925, 1.00029] (n=2) |
| heap.populated.postGC (bytes) | 2881690 [2881570, 2881810] (n=2) | 2881810 [2881800, 2881810] (n=2) | 114 [-12, 240] (n=2) | 1.00004 [0.999996, 1.00008] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 2364220 [2364100, 2364340] (n=2) | 2364330 [2364320, 2364340] (n=2) | 114 [-12, 240] (n=2) | unavailable |
| heap.pending-128.preGC (bytes) | 7013030 [6835430, 7190630] (n=2) | 6668990 [6507100, 6830870] (n=2) | -344042 [-359756, -328328] (n=2) | 0.950968 [0.949969, 0.951967] (n=2) |
| heap.pending-128.postGC (bytes) | 4777280 [4776040, 4778520] (n=2) | 4777990 [4777980, 4777990] (n=2) | 702 [-532, 1936] (n=2) | 1.00015 [0.999889, 1.00041] (n=2) |
| heap.pending-128.deltaFromBlank (bytes) | 4259810 [4258570, 4261050] (n=2) | 4260510 [4260500, 4260520] (n=2) | 702 [-532, 1936] (n=2) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 5251040 [5245860, 5256220] (n=2) | 5231900 [5231630, 5232180] (n=2) | -19132 [-24040, -14224] (n=2) | 0.996357 [0.995426, 0.997289] (n=2) |
| heap.pending-128-preview-open.postGC (bytes) | 4836530 [4835290, 4837770] (n=2) | 4837230 [4837230, 4837240] (n=2) | 702 [-532, 1936] (n=2) | 1.00015 [0.99989, 1.0004] (n=2) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 4319060 [4317820, 4320300] (n=2) | 4319760 [4319750, 4319760] (n=2) | 702 [-532, 1936] (n=2) | unavailable |
| heap.settled-pruned.preGC (bytes) | 6032030 [5887480, 6176580] (n=2) | 6937010 [6656530, 7217490] (n=2) | 904980 [769048, 1040910] (n=2) | 1.14957 [1.13062, 1.16853] (n=2) |
| heap.settled-pruned.postGC (bytes) | 5180130 [5177520, 5182730] (n=2) | 5184350 [5184300, 5184400] (n=2) | 4222 [1664, 6780] (n=2) | 1.00082 [1.00032, 1.00131] (n=2) |
| heap.settled-pruned.deltaFromBlank (bytes) | 4662650 [4660050, 4665260] (n=2) | 4666870 [4666830, 4666920] (n=2) | 4222 [1664, 6780] (n=2) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 6686210 [6203800, 7168620] (n=2) | 9212840 [9001100, 9424580] (n=2) | 2526630 [1832470, 3220780] (n=2) | 1.38739 [1.25562, 1.51916] (n=2) |
| heap.settled-pruned-plus-100.postGC (bytes) | 5608690 [5601830, 5615560] (n=2) | 5611560 [5600820, 5622310] (n=2) | 2872 [-14740, 20484] (n=2) | 1.00052 [0.997375, 1.00366] (n=2) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 5091220 [5084350, 5098080] (n=2) | 5094090 [5083340, 5104840] (n=2) | 2872 [-14740, 20484] (n=2) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 7322230 [6521230, 8123220] (n=2) | 7347360 [6578160, 8116560] (n=2) | 25136 [-6660, 56932] (n=2) | 1.00396 [0.99918, 1.00873] (n=2) |
| heap.settled-pruned-plus-200.postGC (bytes) | 5860170 [5855770, 5864580] (n=2) | 5870690 [5866150, 5875220] (n=2) | 10512 [1572, 19452] (n=2) | 1.00179 [1.00027, 1.00332] (n=2) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 5342700 [5338290, 5347100] (n=2) | 5353210 [5348680, 5357740] (n=2) | 10512 [1572, 19452] (n=2) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 6669360 [6654500, 6684220] (n=2) | 6679720 [6657640, 6701800] (n=2) | 10356 [3140, 17572] (n=2) | 1.00155 [1.00047, 1.00263] (n=2) |
| heap.before-pending-teardown.postGC (bytes) | 5864810 [5858480, 5871130] (n=2) | 5876040 [5871340, 5880730] (n=2) | 11232 [212, 22252] (n=2) | 1.00192 [1.00004, 1.0038] (n=2) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 5347330 [5341000, 5353660] (n=2) | 5358560 [5353870, 5363260] (n=2) | 11232 [212, 22252] (n=2) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 5958120 [5950320, 5965910] (n=2) | 5969290 [5963180, 5975400] (n=2) | 11176 [-2728, 25080] (n=2) | 1.00188 [0.999543, 1.00421] (n=2) |
| heap.after-destroy-before-late.postGC (bytes) | 5271290 [5269740, 5272830] (n=2) | 5273220 [5272040, 5274390] (n=2) | 1930 [1560, 2300] (n=2) | 1.00037 [1.0003, 1.00044] (n=2) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 4753810 [4752260, 4755360] (n=2) | 4755740 [4754560, 4756920] (n=2) | 1930 [1560, 2300] (n=2) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 5296130 [5294580, 5297670] (n=2) | 5298060 [5296880, 5299230] (n=2) | 1930 [1560, 2300] (n=2) | 1.00036 [1.00029, 1.00043] (n=2) |
| heap.after-destroy-after-late.postGC (bytes) | 4211650 [4209660, 4213640] (n=2) | 4212620 [4212400, 4212850] (n=2) | 972 [-1240, 3184] (n=2) | 1.00023 [0.999706, 1.00076] (n=2) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3694180 [3692190, 3696160] (n=2) | 3695150 [3694920, 3695370] (n=2) | 972 [-1240, 3184] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 7479330 [6835430, 8123220] (n=2) | 9212840 [9001100, 9424580] (n=2) | 1733510 [877872, 2589150] (n=2) | 1.24343 [1.10807, 1.37878] (n=2) |
| heap.agingGrowth100To200 (bytes) | 251482 [249024, 253940] (n=2) | 259122 [252908, 265336] (n=2) | 7640 [-1032, 16312] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -588888 [-594840, -582936] (n=2) | -597470 [-600828, -594112] (n=2) | -8582 [-17892, 728] (n=2) | unavailable |
| heap.lateDeliveryDelta (bytes) | -1059630 [-1060080, -1059190] (n=2) | -1060590 [-1061990, -1059190] (n=2) | -958 [-2800, 884] (n=2) | unavailable |

## 10000 rows / CDP 1× / timing

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 8.5 [7.5, 9.4] (n=5) | 7.7 [7.3, 9.1] (n=5) | -0.3 [-1.8, 1.3] (n=5) | 0.966667 [0.808511, 1.16667] (n=5) |
| startup.factory (ms) | 37.1 [33, 46.2] (n=5) | 35.1 [33.6, 41.6] (n=5) | 0.6 [-11.1, 1.7] (n=5) | 1.01818 [0.75974, 1.0467] (n=5) |
| startup.bootstrapToLayout (ms) | 61.5 [56.5, 73.8] (n=5) | 60.3 [56.5, 69.4] (n=5) | 0.7 [-13.5, 4.3] (n=5) | 1.01239 [0.817073, 1.07131] (n=5) |
| startup.navigationToLayout (ms) | 81.5 [68.2, 91.2] (n=5) | 72.8 [68.6, 83.9] (n=5) | 0.4 [-18.4, 7.1] (n=5) | 1.00587 [0.798246, 1.0982] (n=5) |
| latency.assignStatus.withinChildP95 (ms) | 1.1 [1, 1.1] (n=5) | 1.1 [1.1, 1.3] (n=5) | 2.38419e-7 [-2.38419e-7, 0.2] (n=5) | 1 [1, 1.2] (n=5) |
| latency.assignOwner.withinChildP95 (ms) | 1.4 [1.2, 1.5] (n=5) | 1.5 [1.3, 1.5] (n=5) | 0.0999999 [-0.2, 0.3] (n=5) | 1.07143 [0.866667, 1.25] (n=5) |
| latency.planRequest.withinChildP95 (ms) | 0.6 [0.5, 0.9] (n=5) | 0.6 [0.5, 1] (n=5) | 0 [-0.4, 0.3] (n=5) | 1 [0.555555, 1.42857] (n=5) |
| latency.rejectStatus.withinChildP95 (ms) | 1.1 [1, 1.5] (n=5) | 1.2 [1.1, 1.5] (n=5) | 0.1 [-0.4, 0.3] (n=5) | 1.09091 [0.733333, 1.3] (n=5) |
| latency.acceptOwner.withinChildP95 (ms) | 22.3 [19.8, 24] (n=5) | 16 [14.5, 16.5] (n=5) | -6 [-8.2, -5.3] (n=5) | 0.728507 [0.658333, 0.73991] (n=5) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 16.2 [15.1, 18.3] (n=5) | 0.6 [0.5, 0.6] (n=5) | -15.6 [-17.8, -14.5] (n=5) | 0.037037 [0.0273224, 0.0397351] (n=5) |
| latency.latePreview.singleObservation (ms) | 86.1 [79.5, 99.3] (n=5) | 85.1 [78.2, 95.2] (n=5) | -1.3 [-15.3, 1.8] (n=5) | 0.983648 [0.84243, 1.02161] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 7.15 [7.1, 7.2] (n=2) | 7.7 [7.7, 7.7] (n=2) | 0.55 [0.5, 0.6] (n=2) | 1.07698 [1.06944, 1.08451] (n=2) |
| startup.factory (ms) | 11.1 [10.9, 11.3] (n=2) | 11.4 [11, 11.8] (n=2) | 0.3 [-0.3, 0.9] (n=2) | 1.02801 [0.973451, 1.08257] (n=2) |
| startup.bootstrapToLayout (ms) | 32.55 [32.4, 32.7] (n=2) | 34.2 [34.2, 34.2] (n=2) | 1.65 [1.5, 1.8] (n=2) | 1.05071 [1.04587, 1.05556] (n=2) |
| startup.navigationToLayout (ms) | 44.6 [44, 45.2] (n=2) | 48 [47.3, 48.7] (n=2) | 3.4 [2.1, 4.7] (n=2) | 1.07664 [1.04646, 1.10682] (n=2) |
| latency.assignStatus.withinChildP95 (ms) | 1.4 [1.4, 1.4] (n=2) | 1.9 [1.5, 2.3] (n=2) | 0.5 [0.0999999, 0.9] (n=2) | 1.35714 [1.07143, 1.64286] (n=2) |
| latency.assignOwner.withinChildP95 (ms) | 1.6 [1.6, 1.6] (n=2) | 1.55 [1.5, 1.6] (n=2) | -0.0499998 [-0.0999999, 2.38419e-7] (n=2) | 0.96875 [0.9375, 1] (n=2) |
| latency.planRequest.withinChildP95 (ms) | 0.4 [0.4, 0.4] (n=2) | 0.5 [0.4, 0.6] (n=2) | 0.1 [0, 0.2] (n=2) | 1.25 [1, 1.5] (n=2) |
| latency.rejectStatus.withinChildP95 (ms) | 2.05 [1.9, 2.2] (n=2) | 2.5 [2.1, 2.9] (n=2) | 0.45 [0.2, 0.7] (n=2) | 1.21172 [1.10526, 1.31818] (n=2) |
| latency.acceptOwner.withinChildP95 (ms) | 10 [9.7, 10.3] (n=2) | 11.45 [9.5, 13.4] (n=2) | 1.45 [-0.2, 3.1] (n=2) | 1.14018 [0.979381, 1.30097] (n=2) |
| latency.acknowledgeProcessing.withinChildP95 (ms) | 0.4 [0.4, 0.4] (n=2) | 0.4 [0.4, 0.4] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| latency.latePreview.singleObservation (ms) | 2.8 [2.5, 3.1] (n=2) | 2.65 [2.5, 2.8] (n=2) | -0.15 [-0.3, 0] (n=2) | 0.951613 [0.903226, 1] (n=2) |

## 10000 rows / CDP 1× / memory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=5) | 514092 [514092, 514092] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.preGC (bytes) | 15366500 [15280400, 15447000] (n=5) | 15404600 [15311000, 15480500] (n=5) | 36628 [-55500, 116548] (n=5) | 1.00238 [0.996388, 1.00759] (n=5) |
| heap.populated.postGC (bytes) | 8175210 [8175120, 8175680] (n=5) | 8175370 [8175280, 8175830] (n=5) | 156 [-264, 252] (n=5) | 1.00002 [0.999968, 1.00003] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 7657740 [7657640, 7658210] (n=5) | 7657890 [7657810, 7658350] (n=5) | 156 [-264, 252] (n=5) | unavailable |
| heap.pending-128.preGC (bytes) | 11287400 [11223000, 12837100] (n=5) | 11285200 [11253500, 12724200] (n=5) | -2064 [-1581100, 1435980] (n=5) | 0.999817 [0.876833, 1.12721] (n=5) |
| heap.pending-128.postGC (bytes) | 9950800 [9948080, 9951680] (n=5) | 9951040 [9950960, 9952020] (n=5) | 448 [-628, 2944] (n=5) | 1.00005 [0.999937, 1.0003] (n=5) |
| heap.pending-128.deltaFromBlank (bytes) | 9433320 [9430600, 9434200] (n=5) | 9433560 [9433490, 9434540] (n=5) | 448 [-628, 2944] (n=5) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 28493500 [21563500, 28728300] (n=5) | 28552800 [22001800, 28706000] (n=5) | 212504 [-6726510, 6989340] (n=5) | 1.00746 [0.765858, 1.32413] (n=5) |
| heap.pending-128-preview-open.postGC (bytes) | 15066200 [15058500, 15070600] (n=5) | 15069900 [15057600, 15070300] (n=5) | 3696 [-932, 4104] (n=5) | 1.00025 [0.999938, 1.00027] (n=5) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 14548700 [14541100, 14553100] (n=5) | 14552500 [14540100, 14552800] (n=5) | 3696 [-932, 4104] (n=5) | unavailable |
| heap.settled-pruned.preGC (bytes) | 45632500 [42783800, 49749800] (n=5) | 45438700 [33936000, 49752700] (n=5) | 1568 [-11505700, 174608] (n=5) | 1.00003 [0.746804, 1.00408] (n=5) |
| heap.settled-pruned.postGC (bytes) | 15312800 [15305400, 15315400] (n=5) | 15314000 [15304700, 15314700] (n=5) | 112 [-760, 1204] (n=5) | 1.00001 [0.99995, 1.00008] (n=5) |
| heap.settled-pruned.deltaFromBlank (bytes) | 14795300 [14788000, 14797900] (n=5) | 14796500 [14787200, 14797200] (n=5) | 112 [-760, 1204] (n=5) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 31288000 [16955000, 39084000] (n=5) | 25102400 [18798400, 44022100] (n=5) | -12489600 [-20271800, 27067100] (n=5) | 0.665379 [0.481327, 2.59641] (n=5) |
| heap.settled-pruned-plus-100.postGC (bytes) | 15539700 [15531100, 15541000] (n=5) | 15541300 [15531200, 15542100] (n=5) | 840 [-1328, 3256] (n=5) | 1.00005 [0.999915, 1.00021] (n=5) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 15022200 [15013700, 15023600] (n=5) | 15023900 [15013700, 15024700] (n=5) | 840 [-1328, 3256] (n=5) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 34177500 [23206700, 40031000] (n=5) | 38080300 [23260900, 44295900] (n=5) | 3160160 [-10916600, 14873600] (n=5) | 1.09007 [0.680592, 1.64092] (n=5) |
| heap.settled-pruned-plus-200.postGC (bytes) | 15669000 [15660800, 15669600] (n=5) | 15671700 [15660200, 15675700] (n=5) | 3004 [-624, 6672] (n=5) | 1.00019 [0.99996, 1.00043] (n=5) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 15151500 [15143400, 15152100] (n=5) | 15154200 [15142700, 15158200] (n=5) | 3004 [-624, 6672] (n=5) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 17388800 [17381100, 17391300] (n=5) | 17391500 [17349300, 17397300] (n=5) | 2576 [-31824, 8532] (n=5) | 1.00015 [0.998169, 1.00049] (n=5) |
| heap.before-pending-teardown.postGC (bytes) | 15655500 [15647400, 15656100] (n=5) | 15658300 [15646900, 15662300] (n=5) | 3136 [-492, 6804] (n=5) | 1.0002 [0.999969, 1.00043] (n=5) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 15138100 [15129900, 15138600] (n=5) | 15140800 [15129400, 15144900] (n=5) | 3136 [-492, 6804] (n=5) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 15788000 [15782200, 15791000] (n=5) | 15793300 [15782100, 15797300] (n=5) | 3412 [-120, 7700] (n=5) | 1.00022 [0.999992, 1.00049] (n=5) |
| heap.after-destroy-before-late.postGC (bytes) | 11276400 [11270700, 11279100] (n=5) | 11279400 [11270400, 11281700] (n=5) | 2036 [-708, 7492] (n=5) | 1.00018 [0.999937, 1.00066] (n=5) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 10759000 [10753200, 10761700] (n=5) | 10761900 [10752900, 10764200] (n=5) | 2036 [-708, 7492] (n=5) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 11301400 [11295600, 11304000] (n=5) | 11304300 [11295300, 11306600] (n=5) | 2036 [-708, 7492] (n=5) | 1.00018 [0.999937, 1.00066] (n=5) |
| heap.after-destroy-after-late.postGC (bytes) | 4237500 [4234910, 4240820] (n=5) | 4240020 [4238440, 4242280] (n=5) | 1812 [-1292, 7364] (n=5) | 1.00043 [0.999695, 1.00174] (n=5) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3720020 [3717440, 3723350] (n=5) | 3722550 [3720960, 3724800] (n=5) | 1812 [-1292, 7364] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 45632500 [42783800, 49749800] (n=5) | 45438700 [38080300, 49752700] (n=5) | 1568 [-7361420, 174608] (n=5) | 1.00003 [0.838003, 1.00408] (n=5) |
| heap.agingGrowth100To200 (bytes) | 128868 [128116, 129680] (n=5) | 129520 [128468, 137276] (n=5) | 652 [-632, 8000] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -4390450 [-4394980, -4390180] (n=5) | -4390490 [-4397930, -4389850] (n=5) | -40 [-7380, 4488] (n=5) | unavailable |
| heap.lateDeliveryDelta (bytes) | -7039180 [-7040950, -7029830] (n=5) | -7039360 [-7039400, -7030820] (n=5) | -224 [-992, 1648] (n=5) | unavailable |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| heap.blank.preGC (bytes) | 514092 [514092, 514092] (n=2) | 514092 [514092, 514092] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.preGC (bytes) | 10468700 [10358300, 10579100] (n=2) | 10156600 [10156200, 10157000] (n=2) | -312082 [-422064, -202100] (n=2) | 0.970296 [0.960104, 0.980489] (n=2) |
| heap.populated.postGC (bytes) | 7812420 [7812420, 7812420] (n=2) | 7812620 [7812430, 7812800] (n=2) | 200 [16, 384] (n=2) | 1.00003 [1, 1.00005] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 7294940 [7294940, 7294940] (n=2) | 7295140 [7294960, 7295320] (n=2) | 200 [16, 384] (n=2) | unavailable |
| heap.pending-128.preGC (bytes) | 11963900 [11773500, 12154300] (n=2) | 11960500 [11761500, 12159600] (n=2) | -3398 [-12088, 5292] (n=2) | 0.999704 [0.998973, 1.00044] (n=2) |
| heap.pending-128.postGC (bytes) | 9717400 [9717400, 9717400] (n=2) | 9717850 [9717450, 9718240] (n=2) | 444 [48, 840] (n=2) | 1.00005 [1, 1.00009] (n=2) |
| heap.pending-128.deltaFromBlank (bytes) | 9199930 [9199930, 9199930] (n=2) | 9200370 [9199980, 9200770] (n=2) | 444 [48, 840] (n=2) | unavailable |
| heap.pending-128-preview-open.preGC (bytes) | 10136700 [10136600, 10136700] (n=2) | 10120800 [10104800, 10136800] (n=2) | -15848 [-31824, 128] (n=2) | 0.998437 [0.996861, 1.00001] (n=2) |
| heap.pending-128-preview-open.postGC (bytes) | 9882540 [9882540, 9882540] (n=2) | 9882990 [9882590, 9883380] (n=2) | 444 [48, 840] (n=2) | 1.00004 [1, 1.00008] (n=2) |
| heap.pending-128-preview-open.deltaFromBlank (bytes) | 9365070 [9365070, 9365070] (n=2) | 9365510 [9365120, 9365910] (n=2) | 444 [48, 840] (n=2) | unavailable |
| heap.settled-pruned.preGC (bytes) | 12700900 [12700500, 12701300] (n=2) | 14508700 [14282600, 14734700] (n=2) | 1807730 [1581290, 2034170] (n=2) | 1.14233 [1.1245, 1.16016] (n=2) |
| heap.settled-pruned.postGC (bytes) | 10215600 [10213500, 10217600] (n=2) | 10225000 [10224500, 10225400] (n=2) | 9360 [6880, 11840] (n=2) | 1.00092 [1.00067, 1.00116] (n=2) |
| heap.settled-pruned.deltaFromBlank (bytes) | 9698120 [9696070, 9700170] (n=2) | 9707480 [9707050, 9707910] (n=2) | 9360 [6880, 11840] (n=2) | unavailable |
| heap.settled-pruned-plus-100.preGC (bytes) | 17759500 [17717300, 17801700] (n=2) | 13943600 [12775200, 15111900] (n=2) | -3815960 [-4942100, -2689820] (n=2) | 0.78498 [0.721059, 0.848901] (n=2) |
| heap.settled-pruned-plus-100.postGC (bytes) | 10653700 [10651600, 10655700] (n=2) | 10654500 [10642700, 10666400] (n=2) | 892 [-12968, 14752] (n=2) | 1.00008 [0.998783, 1.00138] (n=2) |
| heap.settled-pruned-plus-100.deltaFromBlank (bytes) | 10136200 [10134100, 10138200] (n=2) | 10137100 [10125300, 10148900] (n=2) | 892 [-12968, 14752] (n=2) | unavailable |
| heap.settled-pruned-plus-200.preGC (bytes) | 16131000 [16089100, 16172800] (n=2) | 17242500 [15844400, 18640600] (n=2) | 1111520 [-328424, 2551460] (n=2) | 1.06914 [0.979693, 1.15858] (n=2) |
| heap.settled-pruned-plus-200.postGC (bytes) | 10882200 [10880000, 10884400] (n=2) | 10892100 [10885800, 10898400] (n=2) | 9914 [5808, 14020] (n=2) | 1.00091 [1.00053, 1.00129] (n=2) |
| heap.settled-pruned-plus-200.deltaFromBlank (bytes) | 10364700 [10362500, 10366900] (n=2) | 10374700 [10368300, 10381000] (n=2) | 9914 [5808, 14020] (n=2) | unavailable |
| heap.before-pending-teardown.preGC (bytes) | 12031000 [12026700, 12035400] (n=2) | 12045000 [12039500, 12050500] (n=2) | 13946 [12844, 15048] (n=2) | 1.00116 [1.00107, 1.00125] (n=2) |
| heap.before-pending-teardown.postGC (bytes) | 10884900 [10882700, 10887100] (n=2) | 10898400 [10895700, 10901100] (n=2) | 13502 [12984, 14020] (n=2) | 1.00124 [1.00119, 1.00129] (n=2) |
| heap.before-pending-teardown.deltaFromBlank (bytes) | 10367400 [10365200, 10369600] (n=2) | 10380900 [10378200, 10383700] (n=2) | 13502 [12984, 14020] (n=2) | unavailable |
| heap.after-destroy-before-late.preGC (bytes) | 10977500 [10975800, 10979100] (n=2) | 10994300 [10991600, 10997000] (n=2) | 16822 [15724, 17920] (n=2) | 1.00153 [1.00143, 1.00163] (n=2) |
| heap.after-destroy-before-late.postGC (bytes) | 9708990 [9707420, 9710570] (n=2) | 9711800 [9711740, 9711860] (n=2) | 2806 [1292, 4320] (n=2) | 1.00029 [1.00013, 1.00045] (n=2) |
| heap.after-destroy-before-late.deltaFromBlank (bytes) | 9191520 [9189940, 9193090] (n=2) | 9194320 [9194260, 9194380] (n=2) | 2806 [1292, 4320] (n=2) | unavailable |
| heap.after-destroy-after-late.preGC (bytes) | 9733830 [9732260, 9735410] (n=2) | 9736640 [9736580, 9736700] (n=2) | 2806 [1292, 4320] (n=2) | 1.00029 [1.00013, 1.00044] (n=2) |
| heap.after-destroy-after-late.postGC (bytes) | 4208410 [4206840, 4209990] (n=2) | 4208450 [4208410, 4208500] (n=2) | 42 [-1492, 1576] (n=2) | 1.00001 [0.999646, 1.00037] (n=2) |
| heap.after-destroy-after-late.deltaFromBlank (bytes) | 3690940 [3689360, 3692510] (n=2) | 3690980 [3690940, 3691020] (n=2) | 42 [-1492, 1576] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 17759500 [17717300, 17801700] (n=2) | 17242500 [15844400, 18640600] (n=2) | -517064 [-1957360, 923236] (n=2) | 0.971078 [0.890046, 1.05211] (n=2) |
| heap.agingGrowth100To200 (bytes) | 228558 [224308, 232808] (n=2) | 237580 [232076, 243084] (n=2) | 9022 [-732, 18776] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -1173220 [-1177000, -1169440] (n=2) | -1180330 [-1186700, -1173960] (n=2) | -7108 [-9700, -4516] (n=2) | unavailable |
| heap.lateDeliveryDelta (bytes) | -5500580 [-5500580, -5500580] (n=2) | -5503340 [-5503360, -5503320] (n=2) | -2764 [-2784, -2744] (n=2) | unavailable |

## Served JavaScript

Sum of all served .js files, default Node gzip per file; includes framework/application/dependency code. Maps, CSS and HTML are excluded from byte totals but remain hash-bound.

| Variant | Scenario | Arm | Raw bytes | Gzip bytes |
| --- | --- | --- | ---: | ---: |
| before | dispatch | native | 125991 | 41857 |
| before | dispatch | ngrx | 131872 | 43562 |
| before | dispatch | tanstack | 422810 | 129926 |
| before | dispatch | v15 | 322611 | 100862 |
| before | dispatch | v16 | 475837 | 145968 |
| before | inventory | native | 114139 | 38359 |
| before | inventory | ngrx | 119589 | 40117 |
| before | inventory | tanstack | 410825 | 126564 |
| before | inventory | v15 | 203587 | 65391 |
| before | inventory | v16 | 277674 | 86549 |
| after | dispatch | native | 125991 | 41857 |
| after | dispatch | ngrx | 131872 | 43562 |
| after | dispatch | tanstack | 422940 | 129930 |
| after | dispatch | v15 | 322611 | 100862 |
| after | dispatch | v16 | 475837 | 145968 |
| after | inventory | native | 114139 | 38359 |
| after | inventory | ngrx | 119589 | 40117 |
| after | inventory | tanstack | 410171 | 126399 |
| after | inventory | v15 | 203587 | 65391 |
| after | inventory | v16 | 277674 | 86549 |

## Limits

- Five fresh-browser children before and five after per selected arm/profile, matched by round. Min/median/max and ratios are descriptive; no significance, population tail, confidence interval or winner claim.
- A/A uses two separate v15 baseline pairs per profile and is not pooled with main samples. A ratio is after/before only for nonsigned metrics with a positive denominator; signed checkpoint deltas always retain differences without ratios.
- Unchanged baseline dispatch child: 20 workflow rounds, repeated-stage p95 and one late-preview observation. Synthetic events/service replies/local acknowledgement through stabilization/layout are not INP or network latency. Timing and memory use separate fresh browser children; memory-child duration is not timing evidence. Startup stages overlap.
- Heap is whole-application JS used bytes at forced-GC checkpoints. Observed pre-GC high water is not a true peak or allocation total. Finite aging/teardown does not establish leak freedom or unlimited boundedness.
- Dispatch heap includes deterministic service logs and used-ID strings. The after-destroy-before-late checkpoint retains the old backend intentionally; late delivery releases it. State/checkpoint witnesses verify no late publication, not general unlimited retention.
- Shared-host contention and CDP throttling are limitations; factors are not calibrated device classes. Child host observations are preserved, not corrected into fictional uncontended timings.
- Production served JavaScript includes bundled framework/application dependencies. Gzip uses this analyzer Node version and default per-file compression. Source inventory counts UTF-8 bytes and physical/nonblank lines including comments/types/imports; it does not measure complexity, productivity or human effort.
- Hash/receipt checks establish internal evidence consistency, not signed provenance or proof that every possible trace was exercised. Unrecorded intermediate states cannot be reconstructed from timings; the bound runner supplies the stage assertions.

JSON preserves individual matched values, differences, ratio availability, raw receipt hashes, host observations and source inventory.
