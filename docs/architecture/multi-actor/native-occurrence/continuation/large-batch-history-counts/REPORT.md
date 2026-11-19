# C19 bounded history and size discriminator

Frozen for review. No new filter callsite or nonlinear filter-count phase appeared. Eight exact observed N128 sequences in one worker match a separate fresh worker's first N128 sequence; fresh N256 and N1024 also preserve every reached site's invocation count and predicate visits per row. The original130k qualification stall remains unexplained. No runtime changes, time-superiority claim, budget adjustment or130k replay.

## Results

Each sequence is initial setAll, disjoint replacement setAll, empty setAll, stop, destroy, then12 Promise.resolve continuations. Original imports and membership observer retained; NO intermediate tree reads/assertions between the three operations. Only final count/IDs are read. Sizes advanced sequentially only after completed source checks and normalized per-site comparison passed.

| Run | Actual worker PID | Counted sequences | N | Initial / replacement / clear visits | Stop / destroy / drain calls and visits |
|---|---|---|---|---|---|
|repeated128-warm-start|53413|8|128|768 /1536 /640, identical every iteration|0 /0 /0|
|fresh128|54833|1|128|768 /1536 /640|0 /0 /0|
|fresh256|55894|1|256|1536 /3072 /1280|0 /0 /0|
|fresh1024|56112|1|1024|6144 /12288 /5120|0 /0 /0|

All operation calls remain10/11/10; visits remain6N/12N/5N. COMPARISON.json and analyze.py compare each site's calls and visits/N against the prior frozen exact no-intermediate-read N128 result, aggregating duplicate stack labels at the same source location. All agree. No new phase needs source-body attribution: reached sites remain entity-signal.ts337–338, entity-mutation-frame.ts226, prepared-placement-visibility.ts21, entity-membership-inventory.ts183–184, lifecycle.ts154 and entity-signal.ts1692. Complete representative stacks are retained in each raw count record.

Four successful Nx runs each pass3 tests: native synchronous filter calibration, asynchronous filter calibration, and the bounded sequence test. That is12 passing test executions, containing11 instrumented tree lifecycles and4 uninstrumented parity lifecycles—not11 independently named Vitest tests. The repeated worker runs all8 counted sequences first; its uninstrumented parity lifecycle follows. The first counted sequence is therefore not preceded by another tree lifecycle in this spec. Calibration uses standalone arrays, not trees. Every run checks final count0/IDs[], exactly matching uninstrumented event totals/cleanup state, positive membership events, no events after stop/destroy/drain, and destroyed-reader refusal. It records3 membership events for every counted sequence.

## Memory and phase records

Each runs/<name>/tmp/phases.jsonl is append-only phase evidence, with iteration, PID, execArgv and process.memoryUsage before/after each operation and cleanup/drain. Iteration0 is the final uninstrumented parity lifecycle. A parity-passed record confirms assertions completed. history-filter-counts.json is written after each completed counted lifecycle, then at suite completion; each row includes counts/full stacks and boundary observations. No clock-derived performance inference is made.

For the8-repeat worker, the first pre-operation heapUsed was43980352 bytes and final post-drain heapUsed82114312; RSS124960768→191561728. These boundaries include effects of test/stack instrumentation, preserved result objects, runtime allocations and uncontrolled GC. The harness intentionally retains count/stack/boundary records through the test. This is not a retained-heap/leak measurement or reconstruction of the original worker's heap. Other fresh-worker boundaries are in COMPARISON.json; they are not normalized as performance comparisons. Boundary samples miss transient peaks. No forced GC, allocation profile, historical full-suite replay or extra repetitions were performed.

## Watchdog and preserved first failures

run.py launches each Nx command using start_new_session=True, records child PID/owned process-group ID and asserts equality, then waits at most60 seconds. On timeout it records the action and sends SIGKILL only to that owned process group. It never kills processes globally. Raw stdout/stderr and incremental phase/count files are retained even if termination occurs. Source hashing is outside the subprocess timeout and is not counted as workload duration.

1. runs/repeated128/SETUP-FAILURE.txt preserves an initial launcher error: EXPECTED-SITES.json was not yet available because verified copying had not finished. No child test process was started. The subsequent attempt used a new directory after setup completed.
2. runs/repeated128-ready preserves the actual60-second watchdog trigger, process group51106, exit-9, source unchanged. Nx/Vitest startup reached command launch but no workload phase/count artifact was produced. first.log includes Vite audit-fixture tsconfig resolution warnings; these do not establish the cause of startup delay. This is an infrastructure startup timeout, not a measured operation stall or failing runtime assertion. The complete original log is preserved.
3. One same-size retry, repeated128-warm-start, completed after the Nx workspace cache was populated. All further runs used fresh test worker PIDs and the same cap. No successful run triggered the watchdog. --skip-nx-cache remains set: test results were not restored from cache. No cap was increased.

## Source identity and replay

Own disposable copy of prior frozen cleanup packet manifest d0d48da4b42e5a0c682e1cb7750cd73b27f425531f12c2f652a4f859e5e63e1b (3067 paths), carrying exact C19 b8eace runtime and both earlier probes unchanged. Initial copy verified all input hashes. Each successful run's SOURCE-BEFORE equals that manifest plus only the new probe, and its after-source check is unchanged. SNAPSHOT.json, VERIFICATION.json, FINAL-probe.spec.ts and tests.patch freeze the new test-only addition. Earlier source/counters remain intact. No source/spec-type or full-suite qualification claimed.

Exact commands, sequentially from the runner (Node24.15.0/root installed tools):

```
python3 /private/tmp/st-c19-bounded-history-counts/run.py repeated128-warm-start 128 8
python3 /private/tmp/st-c19-bounded-history-counts/analyze.py repeated128-warm-start
python3 /private/tmp/st-c19-bounded-history-counts/run.py fresh128 128 1
python3 /private/tmp/st-c19-bounded-history-counts/analyze.py repeated128-warm-start fresh128
python3 /private/tmp/st-c19-bounded-history-counts/run.py fresh256 256 1
python3 /private/tmp/st-c19-bounded-history-counts/analyze.py repeated128-warm-start fresh128 fresh256
python3 /private/tmp/st-c19-bounded-history-counts/run.py fresh1024 1024 1
python3 /private/tmp/st-c19-bounded-history-counts/analyze.py repeated128-warm-start fresh128 fresh256 fresh1024
```

Each underlying command is `corepack pnpm nx test kernel large-batch-history-count-probe.spec.ts --skip-nx-cache --maxWorkers=1`; COMMAND.json records cwd, exact environment and watchdog parameters. Run names are exclusive output directories; use a new scratch/name for any independent replay. EXPECTED-SITES.json derives from the prior observed exact N128 trace. Per-stage count/call assertions and known-site assertions fail rather than proceeding silently after a divergence. analyze.py supplies the additional normalized per-site gate before each size advance.

## Bounded conclusion

These executions exclude increasing filter visits/call counts across the tested8-sequence history and the tested128/256/1024 sizes, for this exact plain-tree membership workload. They do not exclude large thresholds, non-filter work, transient allocation/GC/JIT effects, unrelated asynchronous scheduling beyond12 continuations, or different full-worker history. The full130k blocker remains unsupported/unresolved; no production repair is selected by this result. Stop here under the authorized bound.
