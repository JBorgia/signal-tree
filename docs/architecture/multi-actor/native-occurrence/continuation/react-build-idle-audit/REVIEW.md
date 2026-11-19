# Ordinary React build idle boundary — source-only audit

No new build or config/runtime change. **The stopped task was non-watch react:build; baseline recurrence and the retaining resource are not established.** “created” output is before Rollup's disposal boundary, so it cannot establish finished close hooks or successful process exit. Do not accept emitted artifacts on this evidence.

## Exact child / stop / runner chronology

Preserved COMMAND.json runs corepack pnpm nx build react-reference --skip-nx-cache in /private/tmp/st-c20-tsconfig-scan-successor/candidate. NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, own Nx/cache/temp; no watch flag. The Python runner uses subprocess.run and waits for the child command; it does not add a watchdog, shell background job or watch option. Its source hash pass after return is separate from the observed Rollup child.

Raw first.log identifies kernel:build completing runtime and declaration outputs, then react:build invoking `rollup -c rollup.config.cjs`; React log names node61119 and prints its two JS files and `created ../../dist/packages/react`. This resolves the earlier interim misidentification as kernel. The process-status observation before stopping showed node61119 under the authorized Nx invocation, command pointing through this scratch's node_modules/.bin; instantaneous CPU0.0 is an idle sample, not a continuous trace or proof of deadlock.

Only PID61119 received TERM. Nx then reported react:build failed and the outer runner exited130 (RESULT.json), with source unchanged. No original-source process was terminated. A current read-only ps query no longer lists61119. The direct reference-app build with excludeTaskDependencies subsequently passed in the separate existing run; it does not establish this ordinary dependency task's success.

## Configured watch vs retained resources

Exact baseline C20 and successor React rollup config/custom config/project.json/production tsconfig/shared build helper hashes match (SOURCE-IDENTITY.json). Both graph versions have the same build target command/options. React withNx options do not enable watch; shared createLibraryRollupConfig does not add it. Installed Rollup4.62.2 CLI enters the watcher only when command.watch is enabled (dist/bin/rollup:1842); otherwise it awaits each build once. The recorded argv has no -w/--watch.

Installed @nx/rollup23.1.0 nx-copy-assets-plugin only calls watchAndProcessOnAssetChange when this.meta.watchMode AND isDaemonEnabled() are true. Daemon was explicitly false. This is not evidence of an intended persistent asset watcher. withNx reads the cached Nx graph in the build process; it does not invoke asynchronous project-graph construction there.

@rollup/plugin-typescript internally uses a TypeScript watch program even for a one-shot build, but its non-watch buildEnd explicitly closes that program. The word “watch” in this implementation therefore does not establish a leaked watcher or configured watch build. The shared esbuild transform service explicitly unrefs its subprocess/streams when work is not referenced; merely finding an esbuild child is likewise insufficient. No retained-handle dump was taken before61119 stopped.

## Precise post-output boundary

Installed Rollup4.62.2 dist/bin/rollup:1702–1755 awaits output bundle.write, flushes warnings and prints “created”, THEN finally awaits __disposeResources. The bundle implements Symbol.asyncDispose by awaiting close(); close awaits all closeBundle hooks (dist/shared/rollup.js:24284–24293).

Consequences: seeing “created” bounds the unexplained interval to disposal/close hooks or later process liveness, not a missing output write. It does not distinguish a pending closeBundle operation from already-finished build work with a referenced resource. It also cannot be attributed to the parent's Python wait alone because the Rollup subprocess itself still existed.

Our shared finalize-publish-layout closeBundle hook reads package.json, conditionally resolves workspace specs/writes it, and conditionally copies llms.txt. These are finite operations in source, with no explicit watcher, timer or unbounded retry. They are concrete post-print awaits to discriminate; source inspection does not prove one was blocked. Analyzer size lines are renderChunk output, not completion signals. Nx asset copying occurs in writeBundle and thus precedes the printed completion line on the normal CLI route. No repair to any of these hooks is justified yet.

The two scan-patch files are live Vite/Vitest configs, not part of React's Rollup config import chain (rollup.config.cjs -> withNx + rollup.custom.mjs -> shared helper). Nx graph contracts/edges are unchanged. This makes direct watch-mode introduction by that patch unsupported, but does not by itself prove baseline process-exit behavior: graph/plugin loading, environment and handle history still need matched evidence.

## What baseline evidence actually exists

The earlier process inventory showed another Rollup command, PID59038, parent1, about four days old, CPU0.0 at observation. Read-only cwd inspection NOW identifies it as /Users/jonathanborgia/code/signaltree/packages/kernel, not React and not the exact C20 scratch. It was left untouched. Its source identity at launch, env, flags beyond the printed command and lifecycle state are unknown. It establishes only that a historical long-lived Rollup process exists elsewhere; it is NOT an exact-C20 React baseline reproduction or proof of the same watcher/idle cause.

Available C20 run directory contains recipient/spec-type checks, no matched baseline React-build completion/idle log. No assertion of “pre-existing React build hang” is warranted. The successor's emitted files do not close this gap.

## Cheapest next bounded discriminator — proposed, not run

After authorization, one fresh exact-C20 copy with BOTH original tsconfigPaths invocations unchanged, same installed dependency identities and matching pinned env. Reuse byte-identified kernel output from the already completed identical-source kernel build solely as prerequisite input (not artifact acceptance), so the command can isolate `pnpm nx build react --skip-nx-cache --excludeTaskDependencies` rather than rebuild the whole dependency chain. Keep normal Nx/rollup command and actual target options; do not enable watch or change Rollup config.

Use an external process supervisor to record parent/child PID, cwd, argv and exit, with a bounded deadline. Enable Node report-on-signal into that scratch via diagnostic NODE_OPTIONS only, and target the verified Rollup child if it remains alive after its own “created” line. Capture a report before termination: JS/native stack and libuv active/referenced handles, especially FS watchers, child-process/pipes and timers. Do not add a referenced timer inside the build process, force process.exit, disable plugins or call esbuild.stop; those would contaminate the exit discriminator. Preserve raw logs/report and any forced-stop result.

Interpretation: matching baseline nonexit establishes recurrence under the matched command, not causal identity. Clean baseline exit leaves successor/environment/history sensitivity open; it does not automatically condemn the resolver patch. A report showing an active pending FS operation vs only retained handles guides the next question. If the report cannot locate pending close work, only then propose a separate diagnostic harness with passthrough close-hook entry/exit markers; do not modify production configs or claim completion from a marker placed before disposal.

No repeated builds, no new experiment executed here, no baseline timing comparison or artifact acceptance. The source map is sufficient to design this one discriminator, not to select a runtime/config repair.
