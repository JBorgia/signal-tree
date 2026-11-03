# Tool startup versus workload — read-only discrimination

**The2048 stop is not evidence of a library workload failure. A separately preregistered graph-preparation/reuse protocol is technically defensible without task-result reuse or Vitest-worker reuse.** This is a proposal only: no command execution, cache changes, source changes, R1 extension or retry. R1 remains stopped/invalid at its fifth invocation.

## Facts versus inference

`R1/runs/baseline-2048-r1/OWNED.json` records root45004 born09:42:24, child45024 at09:42:29, descendant45138 at09:43:28, direct child45806 of45024 at09:45:16, then45831 at09:45:17 and45852 at09:45:19. The warning lines identify the latter two as Node processes. The root-to45806 interval is172 seconds, roughly96% of the180-second startup/no-progress allowance. Birth timestamps have second-level precision; census discovery is periodic.

The raw log begins with project-graph node creation and plugin names, then historical tsconfig-path warnings. Only near its end does it print `nx run kernel:test` and `node tools/run-core-vitest.mjs`, followed by those Node warnings and failed-target output. The target's reported duration is8.2s. This agrees with the late child-launch chronology, but is not independent precise phase timing.

The configured kernel target is nx:run-commands invoking tools/run-core-vitest.mjs, whose child is `pnpm exec vitest run ...`. That source/log/process combination supports classifying45806 as part of the target launch chain. OWNED contains PID/PPID/birth, **not executable/argv**, and the log lacks per-line timestamps. Therefore “most of the allowance elapsed before the target-launch chain” is well-supported inference; “all172s was spent computing the graph” is not established. Corepack/pnpm startup, plugin/config loading, filesystem work, process scheduling and any waits are not separately attributed. The intermediate45138 process cannot be named from its birth record alone.

The watchdog says no-progress180s with lastRecord:null. No reporter events or heap samples exist. It watches structured test/memory progress, not console log activity, so the graph warnings do not reset it. Signals/exit-15 document supervisor termination, not a library assertion. There is no sampled heap ceiling or growth violation, and no evidence establishing OOM. External contention/resource pressure is not excluded merely because no heap sample exists.

## Installed tooling boundary

Inspected installed Nx23.1.0 source, not guessed CLI semantics:

- `dist/src/utils/cache-directory.js:37–43,82–85` separates NX_CACHE_DIRECTORY (task cache) from NX_WORKSPACE_DATA_DIRECTORY (workspace/project-graph data; legacy graph-directory variable is a fallback).
- `project-graph/project-graph.js:110–145` reads file-map cache and writes graph/source-map caches unless NX_CACHE_PROJECT_GRAPH is false. With daemon disabled, lines299+ still call the graph-building path under a workspace-data lock. Cached data can reduce repeated work; it does **not** guarantee all plugin/configuration work is skipped.
- `tasks-runner/task-orchestrator.js:121–122` independently uses skipNxCache to control task-cache use. Graph-cache reuse is not equivalent to replaying a cached passing test.
- `command-line/show/project.js:14` calls createProjectGraphAsync; its JSON branch prints resolved project data, without scheduling kernel tests. Thus `corepack pnpm nx show project kernel --json` is a plausible graph-only preparation command for this installed version, not a test warmup. No such command was run here.

R1 assigned a new NX_WORKSPACE_DATA_DIRECTORY to every invocation. That deliberately prevented reuse of earlier per-arm graph data, and repeated graph/plugin logs corroborate repeated setup. It does not quantify how much of the startup delay reuse would remove.

## Minimal defensible new protocol

Prefer **explicit graph-only preparation on each exact upcoming overlay, backed by one private workspace-data directory per arm**, over silently reusing arbitrary old caches. A new protocol could do the following:

1. Start with new identified measurement copies/cache directories; preserve C0/R1. Bind each arm's source manifest, absolute cwd, lockfile, tool versions, nx/project/plugin/Vitest configs, relevant environment and installed dependency identity. Never share graph state between arms or transplant a graph generated at another checkout path.
2. Install the already registered N-specific test overlay, verify its hash, then run the graph-only preparation in a separate short-lived process with the same graph environment/directory the upcoming Nx command will use. Capture its command, exit, full output, resolved kernel target and cache inventory/provenance. Require successful completion and cleanup. Treat preparation failure as infrastructure failure and stop; do not hide favorable retries. Apply the same procedure/order policy to both arms.
3. Hash runtime/config/overlay inputs again. A source/config/dependency or declared environment change invalidates the graph-preparation provenance; let Nx normally revalidate its cache rather than forcing stale graph acceptance. N changes alter the spec file, so prepare/revalidate after each overlay, not solely before the first arm run. Do not edit plugin/config discovery just to suppress historical warnings.
4. Launch the ordinary Nx test command in a **new process**, keep `--skip-nx-cache`, daemon disabled, no cloud reuse and fresh per-invocation task-cache/TMPDIR paths. Reuse only the arm's graph-data directory. Still require exact cases/stages/size, source/overlay hashes, fresh sampled Vitest PID, equal heap limits and complete teardown. No source alias changes, preexecuted tests, retained application tree, forced GC or heap-limit change.
5. Preserve independent bounded setup and workload/startup dispositions. The simplest first proposal can retain the existing180s/360s command caps after graph preparation, merely recording preparation separately. If instead introducing a task-start phase marker or separate deadlines, preregister and review those tooling changes explicitly. Do not reset a deadline because harmless log text arrives, remove an overall cap, or relabel the old failed invocation as successful.

Preparation is excluded from the worker boundary-heap workload, but **not erased from end-to-end operational records**. Its separate process cannot contribute a retained JS heap to a fresh Vitest worker; it may still warm OS/filesystem/tool caches or affect host load. Equal preparation policy, source validation, closed setup processes and transparent reporting are therefore required. Neither cache warming nor this source inspection establishes zero measurement impact or guaranteed speedup.

Alternative: reuse per-arm graph data without a standalone preparation command while retaining all invocation caps. This preserves fresh workers and may reduce setup, but separates startup less clearly and still permits a cold first-arm failure. A public graph cache is not a substitute for the actual fresh-run receipts.

## Disposition

Supported proposal: separate identified graph/config preparation from the library workload while preserving fresh workers and disabled task-result reuse. Unsupported conclusion: R1 proves baseline2048 library failure, or that Nx graph construction alone caused every second of delay. Any future execution is a new authorized/preregistered protocol with its own first outcomes; none is authorized by this review itself.

Evidence hashes are in EVIDENCE.json. Only source, existing logs and process receipts were read/hashed. No startup probe, preparation command, benchmark, retry, cache mutation or production edit was performed.
