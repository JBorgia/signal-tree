# Cheap process/config recorder validation — C21

Completed the authorized two unchanged small files. The corrected recorder run passes14/14, captures14 append-only starts and14 ends, and finishes with no live observed descendants. A concrete instrumentation defect was found and corrected before this result: Nx puts the test command and workers in a different process group from the initial launcher. No130k case, full suite, runtime/test edits, composition or Main/root writes.

## Identity and executed commands

Fresh scratch candidate matches all3066 entries of C21 manifest73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27. Both source-before/after comparisons match it. Tests selected positionally through pinned Node24.15.0/pnpm10.17.0 Nx: src/lib/internals/diagnostics/owner-evidence-0.spec.ts and src/lib/internals/location-runtime.spec.ts, --skip-nx-cache --maxWorkers=1. Original sources and config unchanged; A optimization not applied. Existing isolated dependency store used; the inspected installed Nx/Vitest runtime files match the full-run store byte-for-byte (TOOL-IDENTITY.json).

Executed in this directory, in order:

1. `python3 prepare.py` — exact source copy and verification.
2. `python3 validate-controls.py` — two synthetic controls only: append-only case-start despite overwritten current record, then no-start startup deadline.
3. `python3 run-tests.py` — first two-file pass14/14; records the initial incomplete launcher-group census.
4. `python3 validate-detached.py` — corrected recorder, synthetic detached child; verifies signals to exactly its two owned groups and child exit-15.
5. `python3 run-tests-v2.py` — same two small files only, new process, corrected recorder;14/14 pass.
6. `python3 analyze.py` and `python3 analyze-v2.py` — independent raw-event/census summaries.

Each run/control has COMMAND.json, PROCESS.json, first.log, RESULT.json and raw append-only census/events where relevant. Synthetic controls use short1/1.5-second deadlines; real tests use180-second startup/no-progress and90-second active-case deadlines. No actual test timed out. Controls prove the recorder's deadline branches, not future arbitrary worker termination. The small replay was repeated only after the ownership defect was exposed; all first artifacts and original recorder files remain intact.

## Actual config, environment and workers

run-small-v2/events.jsonl resolved-config records pool=forks, isolate=true, maxWorkers=1, environment=happy-dom, project execArgv=[]. fileParallelism was undefined (omitted by JSON serialization), not forcibly changed; active-worker limit is explicitly1. CI and VITEST_MAX_WORKERS were absent in coordinator and worker startup environment, so no hidden override was observed. Worker NODE_ENV=test, coordinator NODE_ENV=development; NX_DAEMON/NX_ISOLATE_PLUGINS/NX_TUI=false. NODE_COMPILE_CACHE and UV_THREADPOOL_SIZE absent. Startup VITEST_POOL_ID/WORKER_ID are absent before Vitest initializes its worker; no later-value claim is made.

NODE_OPTIONS retains the diagnostic redirect with only its output destination relocated to scratch, and adds record-startup.cjs. Default and exact full-run progress reporters remain, plus the new recorder reporter. Relevant effective environment/argv are recorded per Node startup in nodes.jsonl and per command in COMMAND.json; no claim to have dumped the entire environment. Both actual workers report heap_size_limit4496293888 bytes, unchanged by this recorder. This is a configured limit, not measured allocation or memory sufficiency.

Observed file order: owner-evidence-0, then location-runtime; do not infer order from the specification listing/CLI order. Corrected run: launcher PGID92489; Nx command PGID92708; Vitest coordinator92753; first worker92789, second93118, both in92708. Startup, module-boundary census and exit records distinguish them. Among171 periodic census samples plus four module-boundary samples, at most one known fork worker was observed at a time. Final live observed descendant set is empty. These observations support fresh workers on this two-file lane, not absence of very short overlap or a proof about276 modules.

## Concrete first failure and corrected ownership

First run already passed14 tests and captured every start/end, but launcher-group-only census falsely omitted the actual workers: launcher89104, detached test group89426, workers89481/89511. The initial ANALYSIS.json's zero observed workers means incomplete census scope, not zero execution. Original raw files and helper source are preserved; no first result rewritten.

Installed Nx23.1.0 `dist/src/executors/run-commands/running-tasks.js:268–270` spawns the command with shell:true and detached:process.platform !== 'win32'. This matches observed ancestry. Nx also has its own killProcessTreeGraceful handling; its existence is not proof that every descendant exited after an external launcher-group signal. The old group-only kill remained restricted to an owned group, but neither that signal nor group disappearance alone establishes complete worker cleanup. This qualifies the prior source-only watchdog review with actual execution evidence; it does not retrospectively prove orphaned workers caused either stall.

ownership.py now observes parent-child ancestry across groups, retains PID/start-time identities across reparenting, and registers new groups only when their leader is a proven descendant. It checks a live birth-matched owned witness before signaling, sends TERM to descendant groups before launcher, and records the exact signal recipients. No process-name matching, unrelated group targeting, global termination or KILL escalation. The synthetic detached control records both registered groups, both TERM recipients, actual descendant exit-15 and an empty final set. This does not validate every possible daemonization pattern: processes that escape and exit/reparent between observations without a recorded lineage are outside demonstrated coverage. Recording Node startup identity supplements the census but does not make arbitrary unobserved processes owned.

## Observation limits

Read-only ps requires host access: authorized commands ran through automatic escalation to allow census. Sampler retains only owned/observed-descendant rows, not the global process inventory. It records PID/PPID/PGID/state/CPU/RSS/command/start identity; ps CPU is not a causal profile, RSS is not retained heap. Synchronous startup/boundary ps and JSON writes add overhead. Real runs had different elapsed times; no speed, contention, leak, resource-exhaustion or regression conclusion follows. Host pressure/swap and full-history coordinator resources were not measured here. The two cheap files cannot reproduce or absolve the original130k stall.

Append-only starts eliminate dependence on transient overwritten current.json and are read through partial-line-safe offsets. Deadline timestamps are based on recorded reporter events, not an assertion that worker-to-reporter IPC is instantaneous. Every14 small-case start matched a parent-observed start; every end closed its case. The synthetic current-file overwrite no longer loses the active deadline. Post-run source hashes and raw named14-pass output jointly rule out zero-test success.

## What the next full-context capture requires (not executed/authorized here)

Main should centrally review/adopt the corrected ownership/append-only recorder before a separately authorized full-context reproduction. Preserve exact source/config/test bodies, complete discovery, tool identities, preload behavior and existing isolation/maxWorkers; archive relevant resolved config/environment, source-before/after, cache/sequencer state and actual module order. Start recording before launch, not after the stall. Capture all proven descendant groups, coordinator plus worker birth/exit/RSS/CPU/state, coordinator boundary memory and heap limits, and host memory-pressure/swap observations on a fixed bounded cadence. Keep raw last case/module identity and append-only history at the first deadline; do not automatically repeat.

Preserve the full-run's explicitly selected180-second no-progress bound unless Main separately selects a different diagnostic ceiling. Do NOT copy this cheap lane's universal90-second active-case deadline blindly into the full suite: existing cases have longer intended timeouts. Test timeouts remain unchanged. Source hashing is outside execution deadlines. Require final descendant census and any remaining identities rather than a launcher-only group check. Synthetic controls cover the new ownership deadline; a future full capture still needs its own raw disposition.

If the full context reproduces, these records can distinguish a fresh worker under parent/host resource pressure from unexpected coexistence or altered config. They cannot by themselves identify a JS cause; any targeted stack/profile capture would need its own bounded scope tied to the observed worker. No pool switch, --no-isolate, forcedGC, raised heap limit, skipped test, budget waiver or runtime repair is supported by this validation.

Read docs/review-contract.md and prior source-only discriminator note. Main writes remain centralized; all recorder work/results are under this independent scratch directory. Bounded recorder validation complete, full-stall cause open.
