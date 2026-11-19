# One full-context C22 five-package build diagnostic

PASS for the exact five-package normal-build invocation: all five emitted fresh artifacts and Nx exited0 normally. No report was requested/generated, no no-progress deadline fired, and no observed descendants remained. This qualifies this bounded build run, not a repeatability claim, causal explanation of previous non-exits, or release/tarball/consumer sign-off.

## Exact inputs and context

C22 manifest SHA2569ed147cfe0b48c0287c38a20a86a84a825b41741d1e5ea5daa2b917af3633d5d. All3066 source entries verified during copy and before/after build. run/SOURCE-BEFORE.json equals run/SOURCE-AFTER.json and the frozen manifest; zero changed source paths. Root/C22 sources and configs not edited.

Fresh independent scratch candidate, caches/workspace-data/tmp/observation/report/output paths. Crucially candidate/node_modules is the SAME link as Main's C22: /Users/jonathanborgia/code/signaltree/node_modules. Its workspace kernel link consequently resolves to /Users/jonathanborgia/code/signaltree/packages/kernel, exactly matching Main's linkage; no copied dependency store or link repair substituted. PREPARED.json records this explicit context. No initial dist/packages directory or copied prerequisite output: all five package outputs came from this invocation.

Main's diagnostic-redirect.cjs interception behavior is preserved. Only its diagnostic destination changes from Main's recipient-traces.jsonl to our scratch; both hashes recorded. NODE_OPTIONS adds Node24 report-on-SIGUSR2, exclude-env, exclude-network, owned report directory and a read-only startup attestation preload. That preload records only PID/PPID/cwd/argv/Node/report configuration, never a full environment dump. No source/config patches, force process.exit, plugin disable, esbuild stop, automatic retry or extra build command.

## Executed command and real process identities

`python3 /private/tmp/st-parent-freshness-implementation-independent/c22-full-build-diagnostic/prepare.py`

`python3 /private/tmp/st-parent-freshness-implementation-independent/c22-full-build-diagnostic/supervise.py`

The latter invokes pinned Node24.15.0 corepack/pnpm10.17.0:

`pnpm nx run-many -t build --projects=kernel,angular,react,vue,solid --parallel=1 --skip-nx-cache --outputStyle=stream`

run/COMMAND.json records argv/cwd/explicit environment and deadline policy. One invocation only. No excludeTaskDependencies. Streamed build order was kernel, React, Angular, Vue, Solid. Actual cwd and report-flag attestation came from each live child; ancestry census independently captured all five detached groups. Launcher10799, Nx10802; Rollup child/group IDs11333(kernel),11868(React),11885(Angular),11916(Vue),11945(Solid), each parent10802. VERIFIED-SUMMARY.json and raw node-ready/ownership records preserve the evidence. Package attribution does not rely on the last buffered log line.

The lsof cwd recheck belongs to the report-signal branch and was not needed/executed because none was signaled. Actual-child process.cwd startup attestation plus observed ancestry is the cwd/process evidence for this normal run; no invented OS-lsof observation.

## Outcome, hashes and artifacts

run/first.log includes each package emission and `Successfully ran target build for 5 projects`. run/RESULT.json records exit0, normalFullChainExit=true, allFiveEmitted=true, allFiveHaveArtifacts=true, sourceUnchanged=true, no timeout, zero report requests, empty reports and no live observed descendants. End-of-run ancestry census is empty. No termination signal was sent; no SIGNALS.json or WATCHDOG.json was produced.

run/ARTIFACT-IDENTITY.json hashes every emitted file by package: kernel134, React10, Angular17, Vue13, Solid13 files. Each includes its package.json; identities summarized in VERIFIED-SUMMARY.json. These counts are artifact inventory, not size/performance figures. No tarballs, export-condition consumers, Angular AOT consumer or production demo gates were executed; output identity plus normal build completion is the bounded accepted result.

## Deadline/report policy and evidence limits

The external180-second deadline measures absence of streamed build progress, not total chain duration. It resets on changed nonempty build output, explicitly ignoring Node report-writing/completion messages; report creation cannot extend its own deadline. Each package emission is tracked separately. A report would require30 seconds after the matching emission,30 seconds without build progress, a30-second CPU window with at most0.2 seconds process CPU increase, attested exclusion flags, live birth-matched ancestry and lsof exact cwd verification. At most one report per PID/birth. If Rollup is gone but an owned Nx coordinator remains after emission, it is separately identified as coordinator rather than mislabeled package worker. No such branch triggered.

On timeout, only registered descendant groups with live birth-matched witnesses and the owned launcher would receive TERM. This helper accounts for Nx detached groups; it does not reuse the earlier group-only supervisor. All report files would be checked for unexpected environment/network fields before any report contents are surfaced. In this run reports/ and REPORT-PRIVACY.json are empty: there is no Node report, environmental secret dump, network report, retaining-resource observation or signal effect to interpret. Reporting and timeout branches were not newly exercised here; prior synthetic deadline/ownership controls remain separate evidence.

Ancestry tracking covers observed descendants. It is not a proof about every theoretically unobserved short-lived daemonization pattern. Sampling/preload/flags and source-copy/caches can affect scheduling; no timing comparison is made. Logged warnings about historical tsconfig resolution remain in the raw log, not suppressed or repaired. They did not prevent this chain's normal completion.

## Comparison and disposition

Main's preserved C22 package attempt ended130 after manual stops. PACKAGE-ATTRIBUTION-CORRECTION identifies the first post-emission child as React393, not kernel; Angular2756 was then separately cwd-verified and stopped. Original correction/stop/result copies archived beside this review. The earlier isolated React pass used a copied dependency store; this full-chain run deliberately restores Main's root linkage and full dependency/history scope. It still differs in scratch paths, cold own caches, stream output and diagnostic instrumentation.

All five normal builds completed here, so this is more than an archive-only or single-package result. It provides a new successful exact five-package build receipt for Main's qualification record. It neither rewrites the interrupted runs nor proves why they stalled. With no reproduced non-exit/report, no specific retaining resource, plugin, source change, closeBundle wait, esbuild service or resource-pressure cause can be attributed. No hypothesis-driven repair follows.

Read docs/review-contract.md, the build contract and current release controller. This checkout remains16.0.0-dev/non-release-candidate under that controller; full release acceptance requires its remaining gates and authority. Main owns composition and qualification aggregation. All new files are in this independent scratch; no external submission or runtime/test change.
