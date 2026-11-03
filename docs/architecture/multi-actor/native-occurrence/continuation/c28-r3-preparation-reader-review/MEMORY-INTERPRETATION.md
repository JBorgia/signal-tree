# R1 independent memory interpretation

**R1 stopped correctly on a startup/no-progress timeout in its fifth invocation. The four completed invocations provide two small matched pairs with mixed boundary-heap results; they do not establish a general memory reduction.** No further measurements or retries were run by this reviewer. This interpretation is independent of Main's CSV/interpretation and the worker's final report.

## Stop classification and campaign accounting

Baseline2048 `WATCHDOG.json` records `no-progress180s`, `lastRecord:null`. There is no events.jsonl or memory.jsonl, no reported test-case result, and no sampled worker heap. The log reaches the Nx kernel command and child startup warnings, but no Vitest run/test progress record. The supervisor's SIGNALS.jsonl documents birth-matched SIGTERM, followed by SIGKILL for remaining observed processes; RESULT.json records exit-15 and no remaining owned processes.

This is a **startup/pre-reporter progress-watchdog stop**, not a failed workload assertion, observed OOM,512MiB crossing or steep-growth trigger. It does not identify the underlying cause of slow startup or prove the absence of resource pressure outside the sampled worker. The result's zero heap fields are missing-data defaults, **not measurements of zero memory**. Nx's eventual failed-target text is consistent with the termination and is not evidence that an entity test asserted unsuccessfully.

R1 contains five invocation directories: baseline128,reader128,reader512,baseline512,baseline2048. The first four passed the two selected logical tests (nine unrelated cases skipped in each); the fifth is invalid. Reader2048 and both512 repeats were never invoked. The controller stopped before the next scheduled command; no favorable retry or larger comparison exists. C0 remains a separate administratively cancelled startup with zero events/samples and is not folded into these pairs.

## Independent validity checks

Recomputed from raw memory.jsonl, events.jsonl, commands, run snapshots and controller results, using analyze-memory-r1.py. Four valid runs each have the exact30-stage sequence, requested N, finite numeric samples, expected selected case names/order, and matching preregistered test hashes. Their120 boundary samples are correlated phases within four invocations, not120 independent replications.

Sampled worker PIDs are distinct:40667,42727,43928,44609 in schedule order. All report Nodev24.15.0 and heap-size limit4,496,293,888 bytes with identical execArgv and no heap-limit override. These are source Nx/Vitest runs using its recorded development conditions, not production-package heap measurements. The shared installed tool dependencies were declared; runtime inputs came from isolated arm sources. Controller records report clean owned-process completion and unchanged runtime/overlay checks for each valid invocation. There is no absolute or steep-growth stop among them: every sampled maximum is below512MiB and every positive start-relative growth is below64MiB, so the second stop rule's threshold conjunction is false.

Independently rehashed both frozen inputs and both measurement selections after the stop: baseline frozen3124, reader frozen3127, baseline measurement3123 non-overlay files, reader measurement3124 non-overlay files; **zero mismatches**. Both overlays match the last corresponding run snapshots. Their identities remain8f902607 /812a3ad5; reader measurement manifest42b24d55 excludes only the two packet diagnostics. Evidence: MEMORY-R1-SOURCE-CHECK.json. This agrees with the subsequently available worker frozen-input record, without relying on it for the independent hash result.

## Paired observations

MiB below means bytes/1,048,576, rounded to two decimals. “Maximum” means the largest of the30 sampled boundaries, **not process peak**. Growth is max(0, maximum minus that run's membership-before-create sample).

| N | Arm | Initial heap | Maximum sampled heap | Positive boundary growth | Final drain heap |
| --- | --- | ---: | ---: | ---: | ---: |
|128|baseline|42.17|58.68|16.52|58.68|
|128|reader|37.14|59.45|22.31|59.45|
|512|baseline|42.25|73.18|30.94|73.18|
|512|reader|37.18|62.91|25.73|60.94|

The reader starts about5MiB lower in both pairs. At128 its maximum is0.77MiB higher and its positive growth5.79MiB higher. At512 its maximum is10.28MiB lower and positive growth5.21MiB lower. Those are observations of these invocations, not effect estimates or proof that construction avoidance caused the differences.

Matched restoration boundaries show why neither the final sample nor one aggregate is sufficient:

| N | Boundary | Baseline heap | Reader heap | Baseline delta from initial | Reader delta from initial |
| --- | --- | ---: | ---: | ---: | ---: |
|128|after replacement|45.21|40.32|3.05|3.18|
|128|after undo|46.31|49.44|4.15|12.30|
|128|after redo|56.22|57.32|14.05|20.18|
|128|after final drain|58.68|59.45|16.52|22.31|
|512|after replacement|55.38|47.93|13.13|10.75|
|512|after undo|50.14|49.15|7.89|11.97|
|512|after redo|62.58|51.53|20.33|14.35|
|512|after final drain|73.18|60.94|30.94|23.76|

At512, for example, the reader's after-undo absolute heap is lower but its start-relative delta is higher. Across all30 matched boundaries, reader-minus-baseline absolute differences change sign at both sizes. Full ordered phase values and both delta definitions are in MEMORY-R1-MATCHED-PHASES.json; the duplicated “after-original-drain” labels remain separate indexed boundaries. No phase was discarded to improve the comparison.

There are no same-size512 replicate results, so this campaign cannot estimate within-arm repeat variability, a noise band, a distribution of independent effects, or significance. Heap samples rise and fall across phases, consistent with unobserved GC/allocation history; the records do not measure GC or isolate its contribution. The membership case precedes restoration in the same worker, so restoration inherits that heap history. Subtracting an initial sample helps describe the run but does not remove this confounding.

The final drain is twelve microtasks after destruction, without forced GC. Its heapUsed is neither retained/dominator memory nor a leak test. Boundary maxima can miss inter-boundary peaks. These data establish no OOM resolution,130k behavior, asymptotic improvement, zero performance impact, allocation-byte saving or CPU result. The independently reviewed reader semantics and cold-facade observations remain separate evidence; accepting those semantics does not require inventing a heap benefit from R1.

## Evidence and limits

Saved independent calculations: MEMORY-R1-INDEPENDENT-CALCULATION.json (including the invalid stop), MEMORY-R1-MATCHED-PHASES.json and MEMORY-R1-SOURCE-CHECK.json. Source scripts are adjacent. Reviewed controller remains1d79497f; original092d450b findings and C0 first outcome remain preserved. Only receipt parsing/calculation and source hashing ran during this interpretation. No new workload, retry, profiler, timing test or source edit.
