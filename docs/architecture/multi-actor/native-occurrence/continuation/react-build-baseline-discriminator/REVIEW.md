# One unchanged-C20 React build discriminator

**Baseline build exited0; the idle boundary did not recur in this one run. No Node report was generated or requested.** This neither proves the resolver patch caused the earlier idle child nor establishes reproducible baseline idleness. No timing comparison or artifact acceptance.

## Exact input and invocation

Unchanged C20 source manifest SHA-256 `9f14f5a476482cca596528aaed18cbf6be17122f73261e0fa047be40b641e94c`; both original unbounded tsconfigPaths invocations and .nxignore retained. Every manifest file verified on copy and before/after execution; zero changed paths. Kernel prerequisite output was copied from the already completed identical-source kernel build; exact file hashes/provenance in KERNEL-PREREQUISITE.json. Those files are inputs to this discriminator, not accepted artifacts.

Command: `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/corepack pnpm nx build react --skip-nx-cache --excludeTaskDependencies`, cwd candidate. Nx target executes `rollup -c rollup.config.cjs`. No watch flag or config change. Node24.15.0; own Nx/cache/temp; daemon=false, isolate-plugins=false, TUI=false. Source-controlled configs are unchanged. Full permitted explicit command/settings in COMMAND.json; no environment dump.

Supervisor PID69724 launched owned session/process group69802 (corepack PID69802; Nx PID69812). React Rollup PID70455 is identified by Node's warning in the exact react:build output; its configured command is printed directly above it. By the first post-output process sample that child had already gone; do not misrepresent that sample as a live Rollup report target. PROCESS-EVENTS.json preserves selected owned-group processes and commands. No unrelated process is included or stopped.

## Report privacy and deadline

Verified `node --help` support for --report-on-signal, --report-signal, --report-directory, --report-exclude-env and --report-exclude-network. The exact verification lines are NODE-REPORT-FLAGS.txt. NODE_OPTIONS enabled reporting only on SIGUSR2 with both exclusions and an owned report directory. Supervisor required a unique own-group Rollup child, exact React cwd, emitted output and idle observations before signalling it.

External deadline180seconds applied after source verification and before subprocess start. The build exited before that deadline; externallyStoppedAtDeadline=false, oneReportRequested=false. REPORT-PRIVACY.json is empty and reports/ contains no files. Thus no report environment/network data was archived. first.log is the original build output, including the old archive-config warnings; no log rewriting or suppression.

Final owned-process census is empty. The supervisor also has a defensive residual-group cleanup after parent exit; that branch is not separately event-logged, so this record does not assert an exhaustive no-signal history beyond the explicit no-report/no-deadline-stop results. No residual owned process remains.

## Result and interpretation

Raw first.log records react:build, emitted React files and Nx successful completion; RESULT.json records exit0 and unchanged source. No repeated build or follow-up campaign was run. The earlier successor result remains an interrupted dependency build, with its original failure intact.

Comparison limits: the approved baseline isolates React using copied prerequisite kernel outputs, whereas the earlier successor used the ordinary dependency chain. This run adds privacy-safe diagnostic Node flags and an external supervisor. It ran with elevated tool permissions to inspect/control the owned process group; the earlier build ran under the normal sandbox. Both have identical React Rollup/source configs and selected Nx settings, but process history and permission context are not identical. Therefore the one successful baseline cannot attribute the successor's nonexit to its two Vite resolver changes, nor exclude an intermittent resource/teardown/environment issue.

No diagnostic report means no active-handle evidence identifying a watcher or closeBundle wait. The source-only conclusion remains: no configured watch; “created” precedes disposal; actual retained resource unresolved. Do not infer successful ordinary successor artifact qualification from this baseline result.
