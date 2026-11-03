# C7a bounded composition

C6 plus independently reviewed singleton ordinary-row reuse. FROM-C6.patch and SNAPSHOT-C7a.json reconstruct and identify the exact delta. Source/runtime semantics are unchanged from C7; only optional diagnostic file output in the allocation fixture differs.

Main replay: 104/104 focused controls pass across 15 files; source types passed on identical C7 runtime, and the unchanged spec-type ratchet passes on C7a. Separate measurement-output replay passes 5/5 (overlaps the 104). Every frozen source file remains unchanged. Exact commands/environment/logs are in runs.

First C7 run preserved 100 passes and four fixture failures: allocation output required an unset environment path. All useful-state checks occurred before that failing write. C7a makes only diagnostic output optional; calibration and value/work assertions always run. Both absent-output and configured-output execution pass. Original fixture and first failures remain in /private/tmp/st-native-combined-c7.

Actual constructor measurements per 200 writes: 5,000 Maps at both 2,000/20,000 populations; 1,600 copied entries for two fields and 25,600 for 32 fields. These reproduce the singleton component results. No CPU/heap claim follows.

The original unchanged point-work gate remains red: 15,400 versus less than 2,000; population independence passes before that assertion. Original calibration after the failed threshold is not claimed executed (separate constructor calibration passes). No cap changed.

Joint R3 and parent-snapshot freshness are not integrated. C6 independent composition review remains separate. This is not broad qualification, activation or release acceptance.
