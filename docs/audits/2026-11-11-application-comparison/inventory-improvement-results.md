# Matched application variants

Complete registered schedules, raw receipts, conformance, source bindings and served bytes passed offline validation. Values are median [min, max]. Repeated-stage latency uses independently recomputed child p95; late preview remains a single observation per child. Operations and timing/memory children are not pooled.

Command: `"/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node" "/Users/jonathanborgia/code/signaltree/.worktrees/application-comparison/tools/application-lab/analyze-variants.mjs" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-baseline-4" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-variant-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/paired-inventory-1" "/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/paired-inventory-analysis-1"`

## 1000 rows / CDP 1× / inventory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 0.2 [0.2, 0.3] (n=5) | 0.2 [0.1, 0.3] (n=5) | -2.38419e-7 [-0.0999999, 0.0999999] (n=5) | 0.999999 [0.500001, 1.5] (n=5) |
| startup.factory (ms) | 6.4 [6.2, 9.6] (n=5) | 6.5 [6, 7.1] (n=5) | 0 [-3.5, 0.9] (n=5) | 1 [0.635417, 1.14516] (n=5) |
| startup.bootstrapToLayout (ms) | 38.4 [36.1, 54.4] (n=5) | 34.6 [29.6, 36.1] (n=5) | -3.1 [-24.8, -0.2] (n=5) | 0.919271 [0.544118, 0.99449] (n=5) |
| startup.navigationToLayout (ms) | 52.6 [48.9, 85] (n=5) | 49.3 [41.6, 57.6] (n=5) | -2.4 [-43.1, 8.7] (n=5) | 0.953578 [0.492941, 1.17791] (n=5) |
| latency.filter.withinChildP95 (ms) | 10 [9.4, 13.3] (n=5) | 1.8 [1.7, 4.2] (n=5) | -8.3 [-9.6, -5.7] (n=5) | 0.183673 [0.150442, 0.393617] (n=5) |
| latency.toggle.withinChildP95 (ms) | 1.3 [1.2, 2.3] (n=5) | 1.6 [1.2, 2.4] (n=5) | 0.1 [-0.7, 0.7] (n=5) | 1.04348 [0.631579, 1.53846] (n=5) |
| latency.membershipRename.withinChildP95 (ms) | 1.1 [0.8, 2] (n=5) | 1.2 [1.1, 2.3] (n=5) | 0.1 [0, 1.5] (n=5) | 1.09091 [1, 2.875] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.postGC (bytes) | 3942940 [3941390, 3946540] (n=5) | 3776320 [3772030, 3776730] (n=5) | -169368 [-174108, -165068] (n=5) | 0.95708 [0.955883, 0.958119] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 3425460 [3423910, 3429070] (n=5) | 3258840 [3254550, 3259250] (n=5) | -169368 [-174108, -165068] (n=5) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 6904000 [6898610, 6915620] (n=5) | 5724840 [5721920, 5733520] (n=5) | -1181430 [-1191070, -1170220] (n=5) | 0.828862 [0.827771, 0.830463] (n=5) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 6386520 [6381140, 6398150] (n=5) | 5207370 [5204440, 5216040] (n=5) | -1181430 [-1191070, -1170220] (n=5) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 6991380 [6982320, 7000180] (n=5) | 5900610 [5899940, 5907650] (n=5) | -1087990 [-1100240, -1074670] (n=5) | 0.844381 [0.842827, 0.846087] (n=5) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 6473900 [6464850, 6482700] (n=5) | 5383130 [5382460, 5390180] (n=5) | -1087990 [-1100240, -1074670] (n=5) | unavailable |
| heap.after-destroy.postGC (bytes) | 5239090 [5231180, 5240350] (n=5) | 4291980 [4291400, 4294210] (n=5) | -945996 [-948376, -937740] (n=5) | 0.819381 [0.819024, 0.82074] (n=5) |
| heap.after-destroy.deltaFromBlank (bytes) | 4721610 [4713700, 4722880] (n=5) | 3774500 [3773920, 3776730] (n=5) | -945996 [-948376, -937740] (n=5) | unavailable |
| heap.agingGrowth200To400 (bytes) | 84324 [83544, 87380] (n=5) | 175384 [169868, 179264] (n=5) | 91840 [82488, 95552] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -1752290 [-1760600, -1750150] (n=5) | -1609080 [-1614210, -1607960] (n=5) | 143112 [136932, 152052] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 19128300 [18727400, 20141600] (n=5) | 22085100 [11508900, 24667000] (n=5) | 3031160 [-7619400, 4645580] (n=5) | 1.15908 [0.601669, 1.23203] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 0.2 [0.2, 0.2] (n=2) | 0.2 [0.2, 0.2] (n=2) | 0 [-2.38419e-7, 2.38419e-7] (n=2) | 1 [0.999999, 1] (n=2) |
| startup.factory (ms) | 3.9 [3.8, 4] (n=2) | 3.65 [3.4, 3.9] (n=2) | -0.25 [-0.4, -0.1] (n=2) | 0.934868 [0.894737, 0.975] (n=2) |
| startup.bootstrapToLayout (ms) | 13.8 [13.5, 14.1] (n=2) | 12.15 [11.8, 12.5] (n=2) | -1.65 [-1.7, -1.6] (n=2) | 0.880299 [0.874074, 0.886525] (n=2) |
| startup.navigationToLayout (ms) | 23.25 [22.1, 24.4] (n=2) | 27.15 [21.7, 32.6] (n=2) | 3.9 [-0.4, 8.2] (n=2) | 1.15898 [0.9819, 1.33607] (n=2) |
| latency.filter.withinChildP95 (ms) | 2.6 [2.5, 2.7] (n=2) | 2.85 [2.6, 3.1] (n=2) | 0.25 [-0.0999999, 0.6] (n=2) | 1.10148 [0.962963, 1.24] (n=2) |
| latency.toggle.withinChildP95 (ms) | 0.8 [0.8, 0.8] (n=2) | 0.75 [0.7, 0.8] (n=2) | -0.0499998 [-0.0999999, 2.38419e-7] (n=2) | 0.9375 [0.875, 1] (n=2) |
| latency.membershipRename.withinChildP95 (ms) | 0.75 [0.7, 0.8] (n=2) | 0.75 [0.7, 0.8] (n=2) | -1.19209e-7 [-2.38419e-7, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.postGC (bytes) | 2551700 [2551700, 2551700] (n=2) | 2551320 [2550940, 2551700] (n=2) | -380 [-760, 0] (n=2) | 0.999851 [0.999702, 1] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 2034220 [2034220, 2034220] (n=2) | 2033840 [2033460, 2034220] (n=2) | -380 [-760, 0] (n=2) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 4088170 [4088120, 4088220] (n=2) | 4088310 [4088220, 4088390] (n=2) | 134 [96, 172] (n=2) | 1.00003 [1.00002, 1.00004] (n=2) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 3570700 [3570650, 3570740] (n=2) | 3570830 [3570740, 3570920] (n=2) | 134 [96, 172] (n=2) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 4271260 [4271210, 4271300] (n=2) | 4271390 [4270930, 4271850] (n=2) | 134 [-376, 644] (n=2) | 1.00003 [0.999912, 1.00015] (n=2) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 3753780 [3753730, 3753830] (n=2) | 3753910 [3753450, 3754380] (n=2) | 134 [-376, 644] (n=2) | unavailable |
| heap.after-destroy.postGC (bytes) | 3371970 [3371900, 3372050] (n=2) | 3372250 [3372050, 3372450] (n=2) | 274 [148, 400] (n=2) | 1.00008 [1.00004, 1.00012] (n=2) |
| heap.after-destroy.deltaFromBlank (bytes) | 2854500 [2854420, 2854570] (n=2) | 2854770 [2854570, 2854970] (n=2) | 274 [148, 400] (n=2) | unavailable |
| heap.agingGrowth200To400 (bytes) | 183084 [183084, 183084] (n=2) | 183084 [182536, 183632] (n=2) | 0 [-548, 548] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -899282 [-899404, -899160] (n=2) | -899142 [-899404, -898880] (n=2) | 140 [-244, 524] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 8201910 [8184190, 8219630] (n=2) | 8094250 [8076680, 8111810] (n=2) | -107662 [-142948, -72376] (n=2) | 0.986883 [0.982609, 0.991157] (n=2) |

## 1000 rows / CDP 4× / inventory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 0.8 [0.8, 1] (n=5) | 0.9 [0.6, 1.3] (n=5) | 0 [-0.2, 0.5] (n=5) | 1 [0.75, 1.625] (n=5) |
| startup.factory (ms) | 24.8 [23.8, 26.2] (n=5) | 24.1 [23.1, 28.5] (n=5) | -1.2 [-2.1, 4.7] (n=5) | 0.950617 [0.919847, 1.19748] (n=5) |
| startup.bootstrapToLayout (ms) | 143.5 [126.7, 157.4] (n=5) | 128 [119.7, 139.5] (n=5) | -9.2 [-33.7, 1.3] (n=5) | 0.93813 [0.785896, 1.01026] (n=5) |
| startup.navigationToLayout (ms) | 167.7 [155.9, 191.1] (n=5) | 157.3 [147.6, 183.3] (n=5) | -8.3 [-33.8, 15.6] (n=5) | 0.946761 [0.823129, 1.09302] (n=5) |
| latency.filter.withinChildP95 (ms) | 37 [33.4, 38.9] (n=5) | 7.7 [7.4, 9.1] (n=5) | -29.6 [-31.2, -25.2] (n=5) | 0.2149 [0.197943, 0.245509] (n=5) |
| latency.toggle.withinChildP95 (ms) | 5.6 [4.7, 6.4] (n=5) | 5.9 [5.4, 7.1] (n=5) | 0.4 [-0.8, 2.4] (n=5) | 1.07843 [0.870968, 1.51064] (n=5) |
| latency.membershipRename.withinChildP95 (ms) | 3.8 [3.6, 4.1] (n=5) | 5.2 [4.8, 7.1] (n=5) | 1.6 [1, 3.2] (n=5) | 1.44444 [1.26316, 1.82051] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.postGC (bytes) | 3939260 [3938810, 3945920] (n=5) | 3771300 [3771070, 3772140] (n=5) | -167832 [-173804, -167148] (n=5) | 0.957393 [0.955953, 0.957569] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 3421790 [3421330, 3428440] (n=5) | 3253820 [3253590, 3254660] (n=5) | -167832 [-173804, -167148] (n=5) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 6906080 [6900830, 6910480] (n=5) | 5723110 [5722780, 5725640] (n=5) | -1183000 [-1186360, -1177760] (n=5) | 0.828766 [0.828324, 0.829331] (n=5) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 6388610 [6383350, 6393000] (n=5) | 5205630 [5205300, 5208170] (n=5) | -1183000 [-1186360, -1177760] (n=5) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 6996420 [6985660, 7003380] (n=5) | 5898680 [5897940, 5901270] (n=5) | -1097750 [-1105440, -1087620] (n=5) | 0.843099 [0.842156, 0.844307] (n=5) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 6478950 [6468180, 6485900] (n=5) | 5381200 [5380460, 5383800] (n=5) | -1097750 [-1105440, -1087620] (n=5) | unavailable |
| heap.after-destroy.postGC (bytes) | 5236460 [5235930, 5239860] (n=5) | 4290640 [4290440, 4291590] (n=5) | -945516 [-949420, -945408] (n=5) | 0.819438 [0.818808, 0.819458] (n=5) |
| heap.after-destroy.deltaFromBlank (bytes) | 4718980 [4718460, 4722380] (n=5) | 3773170 [3772960, 3774110] (n=5) | -945516 [-949420, -945408] (n=5) | unavailable |
| heap.agingGrowth200To400 (bytes) | 92516 [82128, 97292] (n=5) | 175156 [174908, 175628] (n=5) | 83112 [77864, 92780] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -1756560 [-1766920, -1749720] (n=5) | -1607510 [-1610630, -1606980] (n=5) | 148328 [142212, 159940] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 20143400 [19650900, 20743600] (n=5) | 19131700 [18931400, 22422000] (n=5) | -726436 [-1611850, 1863830] (n=5) | 0.963046 [0.922296, 1.09066] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 1.2 [1.2, 1.2] (n=2) | 0.9 [0.9, 0.9] (n=2) | -0.3 [-0.3, -0.3] (n=2) | 0.75 [0.75, 0.75] (n=2) |
| startup.factory (ms) | 14.3 [13.5, 15.1] (n=2) | 13.7 [12.5, 14.9] (n=2) | -0.6 [-1, -0.2] (n=2) | 0.95634 [0.925926, 0.986755] (n=2) |
| startup.bootstrapToLayout (ms) | 54.7 [51.6, 57.8] (n=2) | 54.4 [52.5, 56.3] (n=2) | -0.3 [-5.3, 4.7] (n=2) | 0.999695 [0.908304, 1.09109] (n=2) |
| startup.navigationToLayout (ms) | 82.25 [78.1, 86.4] (n=2) | 77.35 [73.7, 81] (n=2) | -4.9 [-5.4, -4.4] (n=2) | 0.940581 [0.9375, 0.943662] (n=2) |
| latency.filter.withinChildP95 (ms) | 10.15 [9.9, 10.4] (n=2) | 9.5 [7.6, 11.4] (n=2) | -0.65 [-2.8, 1.5] (n=2) | 0.941142 [0.730769, 1.15152] (n=2) |
| latency.toggle.withinChildP95 (ms) | 3.1 [2.9, 3.3] (n=2) | 2.9 [2.7, 3.1] (n=2) | -0.2 [-0.6, 0.2] (n=2) | 0.943574 [0.818182, 1.06897] (n=2) |
| latency.membershipRename.withinChildP95 (ms) | 3.75 [3.6, 3.9] (n=2) | 2.85 [2.8, 2.9] (n=2) | -0.9 [-1, -0.8] (n=2) | 0.760684 [0.74359, 0.777778] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.postGC (bytes) | 2552060 [2552060, 2552060] (n=2) | 2548700 [2545340, 2552060] (n=2) | -3360 [-6720, 0] (n=2) | 0.998683 [0.997367, 1] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 2034590 [2034590, 2034590] (n=2) | 2031230 [2027870, 2034590] (n=2) | -3360 [-6720, 0] (n=2) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 4092070 [4089940, 4094200] (n=2) | 4089980 [4088130, 4091830] (n=2) | -2090 [-2372, -1808] (n=2) | 0.999489 [0.999421, 0.999558] (n=2) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 3574600 [3572460, 3576730] (n=2) | 3572510 [3570660, 3574360] (n=2) | -2090 [-2372, -1808] (n=2) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 4265680 [4264920, 4266450] (n=2) | 4267260 [4265430, 4269100] (n=2) | 1580 [512, 2648] (n=2) | 1.00037 [1.00012, 1.00062] (n=2) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 3748210 [3747440, 3748970] (n=2) | 3749790 [3747960, 3751620] (n=2) | 1580 [512, 2648] (n=2) | unavailable |
| heap.after-destroy.postGC (bytes) | 3369140 [3365720, 3372560] (n=2) | 3371280 [3369910, 3372650] (n=2) | 2136 [-2652, 6924] (n=2) | 1.00064 [0.999214, 1.00206] (n=2) |
| heap.after-destroy.deltaFromBlank (bytes) | 2851670 [2848250, 2855090] (n=2) | 2853800 [2852440, 2855170] (n=2) | 2136 [-2652, 6924] (n=2) | unavailable |
| heap.agingGrowth200To400 (bytes) | 173612 [172244, 174980] (n=2) | 177282 [177264, 177300] (n=2) | 3670 [2320, 5020] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -896540 [-899196, -893884] (n=2) | -895984 [-899184, -892784] (n=2) | 556 [-5300, 6412] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 6944570 [5603110, 8286040] (n=2) | 8286710 [8279040, 8294380] (n=2) | 1342130 [8336, 2675930] (n=2) | 1.23929 [1.00101, 1.47758] (n=2) |

## 10000 rows / CDP 1× / inventory

### tanstack

after / before, matched arm, profile and round; difference = after - before

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 1.9 [1.6, 2.2] (n=5) | 1.9 [1.7, 1.9] (n=5) | -0.0999999 [-0.3, 0.2] (n=5) | 0.95 [0.863636, 1.125] (n=5) |
| startup.factory (ms) | 32.3 [31.3, 34.2] (n=5) | 31.6 [31.1, 36.9] (n=5) | 0.3 [-3, 4.8] (n=5) | 1.00958 [0.912281, 1.14953] (n=5) |
| startup.bootstrapToLayout (ms) | 138.7 [130.3, 146.9] (n=5) | 123.2 [121.1, 138.9] (n=5) | -15.4 [-15.9, 0.0999999] (n=5) | 0.891763 [0.887179, 1.00072] (n=5) |
| startup.navigationToLayout (ms) | 152.7 [142.7, 159] (n=5) | 137.9 [134.5, 152] (n=5) | -16.1 [-18.4, -0.7] (n=5) | 0.896855 [0.880752, 0.995416] (n=5) |
| latency.filter.withinChildP95 (ms) | 51.9 [48.3, 55.8] (n=5) | 2 [1.9, 2] (n=5) | -49.9 [-53.9, -46.3] (n=5) | 0.0385356 [0.0340502, 0.0414079] (n=5) |
| latency.toggle.withinChildP95 (ms) | 1.5 [1.3, 1.6] (n=5) | 5.1 [4.8, 7.2] (n=5) | 3.8 [3.2, 5.9] (n=5) | 3.92308 [3, 5.53846] (n=5) |
| latency.membershipRename.withinChildP95 (ms) | 1 [0.8, 1.2] (n=5) | 4.1 [4.1, 4.5] (n=5) | 3.3 [3, 3.7] (n=5) | 4.1 [3.72727, 5.625] (n=5) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=5) | 517476 [517476, 517476] (n=5) | 0 [0, 0] (n=5) | 1 [1, 1] (n=5) |
| heap.populated.postGC (bytes) | 11011100 [11005300, 11013200] (n=5) | 11971900 [11968300, 11976300] (n=5) | 958720 [957712, 971024] (n=5) | 1.08705 [1.08698, 1.08823] (n=5) |
| heap.populated.deltaFromBlank (bytes) | 10493600 [10487800, 10495800] (n=5) | 11454400 [11450800, 11458800] (n=5) | 958720 [957712, 971024] (n=5) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 14898800 [14830400, 14909300] (n=5) | 13883600 [13881600, 13886700] (n=5) | -1015810 [-1025680, -943676] (n=5) | 0.931819 [0.931205, 0.936369] (n=5) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 14381300 [14312900, 14391800] (n=5) | 13366100 [13364200, 13369200] (n=5) | -1015810 [-1025680, -943676] (n=5) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 15005400 [14994100, 15014500] (n=5) | 14060900 [14059100, 14064300] (n=5) | -946284 [-950216, -933204] (n=5) | 0.936937 [0.936713, 0.937762] (n=5) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 14487900 [14476600, 14497000] (n=5) | 13543400 [13541600, 13546800] (n=5) | -946284 [-950216, -933204] (n=5) | unavailable |
| heap.after-destroy.postGC (bytes) | 5260860 [5256550, 5263860] (n=5) | 4315790 [4314260, 4317130] (n=5) | -945068 [-946772, -941180] (n=5) | 0.820359 [0.820112, 0.820951] (n=5) |
| heap.after-destroy.deltaFromBlank (bytes) | 4743380 [4739080, 4746380] (n=5) | 3798310 [3796780, 3799660] (n=5) | -945068 [-946772, -941180] (n=5) | unavailable |
| heap.agingGrowth200To400 (bytes) | 105508 [84828, 184088] (n=5) | 177300 [176948, 177548] (n=5) | 71948 [-6540, 92472] (n=5) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -9744520 [-9750620, -9737550] (n=5) | -9745520 [-9747120, -9743310] (n=5) | 1216 [-7976, 3492] (n=5) | unavailable |
| heap.observedPreGCHighWater (bytes) | 61686200 [46982900, 170003000] (n=5) | 58499300 [56441400, 74882900] (n=5) | -5244780 [-104192000, 19095200] (n=5) | 0.914977 [0.379028, 1.34228] (n=5) |

### v15 baseline A/A controls

Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval

| Metric (unit) | Before | After | Paired difference | Paired ratio |
| --- | ---: | ---: | ---: | ---: |
| startup.seed (ms) | 2.05 [1.7, 2.4] (n=2) | 1.85 [1.8, 1.9] (n=2) | -0.2 [-0.6, 0.2] (n=2) | 0.933824 [0.75, 1.11765] (n=2) |
| startup.factory (ms) | 10.05 [9.8, 10.3] (n=2) | 9.9 [9.6, 10.2] (n=2) | -0.15 [-0.2, -0.0999999] (n=2) | 0.984942 [0.979592, 0.990291] (n=2) |
| startup.bootstrapToLayout (ms) | 23.2 [22.4, 24] (n=2) | 22 [21.6, 22.4] (n=2) | -1.2 [-2.4, -2.38419e-7] (n=2) | 0.95 [0.9, 1] (n=2) |
| startup.navigationToLayout (ms) | 32.65 [31.2, 34.1] (n=2) | 31.1 [30.8, 31.4] (n=2) | -1.55 [-3.3, 0.2] (n=2) | 0.954818 [0.903226, 1.00641] (n=2) |
| latency.filter.withinChildP95 (ms) | 2.3 [2, 2.6] (n=2) | 2.1 [2, 2.2] (n=2) | -0.2 [-0.4, 0] (n=2) | 0.923077 [0.846154, 1] (n=2) |
| latency.toggle.withinChildP95 (ms) | 1.45 [1.4, 1.5] (n=2) | 1.35 [1.3, 1.4] (n=2) | -0.1 [-0.2, 0] (n=2) | 0.933333 [0.866667, 1] (n=2) |
| latency.membershipRename.withinChildP95 (ms) | 1.4 [1.2, 1.6] (n=2) | 1.15 [1.1, 1.2] (n=2) | -0.25 [-0.5, 0] (n=2) | 0.84375 [0.6875, 1] (n=2) |
| heap.blank.postGC (bytes) | 517476 [517476, 517476] (n=2) | 517476 [517476, 517476] (n=2) | 0 [0, 0] (n=2) | 1 [1, 1] (n=2) |
| heap.populated.postGC (bytes) | 6339730 [6339350, 6340110] (n=2) | 6341400 [6339670, 6343140] (n=2) | 1674 [320, 3028] (n=2) | 1.00026 [1.00005, 1.00048] (n=2) |
| heap.populated.deltaFromBlank (bytes) | 5822250 [5821870, 5822630] (n=2) | 5823930 [5822190, 5825660] (n=2) | 1674 [320, 3028] (n=2) | unavailable |
| heap.aging-plus-200.postGC (bytes) | 7869220 [7867820, 7870620] (n=2) | 7872930 [7872250, 7873620] (n=2) | 3718 [3004, 4432] (n=2) | 1.00047 [1.00038, 1.00056] (n=2) |
| heap.aging-plus-200.deltaFromBlank (bytes) | 7351740 [7350340, 7353140] (n=2) | 7355460 [7354770, 7356140] (n=2) | 3718 [3004, 4432] (n=2) | unavailable |
| heap.aging-plus-400.postGC (bytes) | 8040560 [8038040, 8043090] (n=2) | 8047230 [8044180, 8050280] (n=2) | 6662 [6140, 7184] (n=2) | 1.00083 [1.00076, 1.00089] (n=2) |
| heap.aging-plus-400.deltaFromBlank (bytes) | 7523090 [7520560, 7525620] (n=2) | 7529750 [7526700, 7532800] (n=2) | 6662 [6140, 7184] (n=2) | unavailable |
| heap.after-destroy.postGC (bytes) | 3364950 [3362260, 3367630] (n=2) | 3368780 [3368710, 3368850] (n=2) | 3834 [1220, 6448] (n=2) | 1.00114 [1.00036, 1.00192] (n=2) |
| heap.after-destroy.deltaFromBlank (bytes) | 2847470 [2844790, 2850150] (n=2) | 2851300 [2851240, 2851370] (n=2) | 3834 [1220, 6448] (n=2) | unavailable |
| heap.agingGrowth200To400 (bytes) | 171348 [170220, 172476] (n=2) | 174292 [171928, 176656] (n=2) | 2944 [1708, 4180] (n=2) | unavailable |
| heap.teardownDeltaFromAged (bytes) | -4675620 [-4675770, -4675460] (n=2) | -4678450 [-4681430, -4675460] (n=2) | -2828 [-5964, 308] (n=2) | unavailable |
| heap.observedPreGCHighWater (bytes) | 12076300 [11145900, 13006600] (n=2) | 11923600 [11842500, 12004700] (n=2) | -152640 [-1001860, 696576] (n=2) | 0.992735 [0.922973, 1.0625] (n=2) |

## Served JavaScript

Sum of all served .js files, default Node gzip per file; includes framework/application/dependency code. Maps, CSS and HTML are excluded from byte totals but remain hash-bound.

| Variant | Scenario | Arm | Raw bytes | Gzip bytes |
| --- | --- | --- | ---: | ---: |
| before | inventory | native | 114139 | 38359 |
| before | inventory | ngrx | 119589 | 40117 |
| before | inventory | tanstack | 410825 | 126564 |
| before | inventory | v15 | 203587 | 65391 |
| before | inventory | v16 | 277674 | 86549 |
| before | dispatch | native | 125991 | 41857 |
| before | dispatch | ngrx | 131872 | 43562 |
| before | dispatch | tanstack | 422810 | 129926 |
| before | dispatch | v15 | 322611 | 100862 |
| before | dispatch | v16 | 475837 | 145968 |
| after | inventory | native | 114139 | 38359 |
| after | inventory | ngrx | 119589 | 40117 |
| after | inventory | tanstack | 410171 | 126399 |
| after | inventory | v15 | 203587 | 65391 |
| after | inventory | v16 | 277674 | 86549 |
| after | dispatch | native | 125991 | 41857 |
| after | dispatch | ngrx | 131872 | 43562 |
| after | dispatch | tanstack | 422940 | 129930 |
| after | dispatch | v15 | 322611 | 100862 |
| after | dispatch | v16 | 475837 | 145968 |

## Limits

- Five fresh-browser children before and five after per selected arm/profile, matched by round. Min/median/max and ratios are descriptive; no significance, population tail, confidence interval or winner claim.
- A/A uses two separate v15 baseline pairs per profile and is not pooled with main samples. A ratio is after/before only for nonsigned metrics with a positive denominator; signed checkpoint deltas always retain differences without ratios.
- Synthetic DOM event through Angular stabilization and forced layout is not INP. Rename input preparation is outside the timer. Initial iterations are retained; startup stages overlap and must not be added.
- Heap is whole-application JS used bytes at forced-GC checkpoints. Observed pre-GC high water is not a true peak or allocation total. Finite aging/teardown does not establish leak freedom or unlimited boundedness.
- Both variants include the new 30-action membership rename trace. Heap/aging results are not pooled with the original inventory cohort.
- Shared-host contention and CDP throttling are limitations; factors are not calibrated device classes. Child host observations are preserved, not corrected into fictional uncontended timings.
- Production served JavaScript includes bundled framework/application dependencies. Gzip uses this analyzer Node version and default per-file compression. Source inventory counts UTF-8 bytes and physical/nonblank lines including comments/types/imports; it does not measure complexity, productivity or human effort.
- Hash/receipt checks establish internal evidence consistency, not signed provenance or proof that every possible trace was exercised. Unrecorded intermediate states cannot be reconstructed from timings; the bound runner supplies the stage assertions.

JSON preserves individual matched values, differences, ratio availability, raw receipt hashes, host observations and source inventory.
