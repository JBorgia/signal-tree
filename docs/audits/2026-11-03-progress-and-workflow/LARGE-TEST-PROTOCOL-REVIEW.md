# Bounded integration cleanup / next execution

Read-only review; no tests, builds, cache preparation or measurements executed. Root HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777; root dirty coordination files left untouched. Current RELEASE-CURRENT selects `/private/tmp/st-v16-integration-candidate`, manifest 8bd6920bb81f676466a1c7d12d61395766694d881fcf2aa8c2dcdd35b5dce670. This review read selected source but did not independently recompute that manifest. Main/Noether must bind execution to its verified identity. No new review cycle is required for the proposal below.

## Exact outstanding coverage

The two files contain 13 tests, not 13 large workloads:

| File / case | Obligation | Existing timeout |
| --- | --- | --- |
| `packages/kernel/src/lib/entity-large-batches.spec.ts`: `setAll, replace and clear with membership observed` | 130,000-row initial/disjoint replacement/empty replacement, membership delivery, final empty collection | 60s |
| same: `undo and redo of a setAll that replaced every row` | 130,000-row disjoint replacement followed by undo/redo, count and first-key restoration | 120s |
| same: nine smaller cases | findIndex instrumentation calibration plus 256/1,024 replacement/clear in plain and restoration-observed modes; predicate work bounds and collection order | Preserve source defaults |
| `packages/kernel/src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts`: `jumps across a turn that cleared more rows than the argument limit` | 130,000-row clear, two history entries, directed jumps both ways, row/order/value and publication-work assertions | 120s |
| same: `releases the claims of a truncated turn that cleared more rows than the argument limit` | 130,000-row clear under maxHistorySize:1, truncation by subsequent add, remaining undo/history behavior | 120s |

These are different operation paths. The restoration clear fixture deliberately avoids the larger disjoint-replacement workload; its own comment explains that distinction. Passing it cannot substitute for replacement undo/redo. Likewise the separate entity-v16 controls exercise notifier delivery and transaction rollback/key reuse (with and without restoration), rather than membership-reader observation or directed history jumps. Similar row builders do not establish redundant assertions.

A focused argument-expansion unit test could cheaply catch a spread-call regression, but cannot replace these end-to-end 130k obligations. A smaller N is only a safety/setup discriminator. Neither existing first-key checks nor this review proves every payload or arbitrary-scale support; preserve the present assertions rather than enlarging their claims.

## Finite next execution, owned by Noether

Use the selected candidate only, not another baseline/candidate comparison. Preserve C0/R1 unchanged. This is functional qualification, not a new heap-benefit campaign. No 512 repeats, profiler, timing comparison or forced GC.

1. Verify selected manifest, lockfile/dependency identity, Node24.15.0/pnpm10.17.0, and available host memory. Ensure no other heavy job. Save commands, versions, environment, source hashes and first results in a new packet. Ensure `pnpm` is on PATH for the wrapper's spawnSync, not just corepack availability.
2. Prepare graph separately with the exact candidate cwd and a private graph directory. Use this environment for preparation and every subsequent invocation (replace packet paths once, record literal resolved values):

```sh
export NX_DAEMON=false NX_NO_CLOUD=true
export NX_WORKSPACE_DATA_DIRECTORY=/private/tmp/st-large-qualification/graph
corepack pnpm nx show project kernel --json
```

Bound preparation to 180s wall time. Capture full output and resolved test target; failure/timeout stops this protocol as setup failure. Require owned preparation descendants gone. Recheck source/config hashes. Reuse only this graph directory, allowing normal Nx invalidation. Do not force stale graph validity, transplant another checkout's graph, or alter plugin discovery to suppress warnings.

3. Launch each command below separately with a fresh process and unique `NX_CACHE_DIRECTORY` and `TMPDIR` (create directories first). Use `--skip-nx-cache`, verify an actual new Vitest worker PID, retain worker isolation, and wait for all owned descendants to exit before the next command. The existing wrapper accepts these file/name flags and invokes Vitest from packages/kernel.

```sh
corepack pnpm nx test kernel --skip-nx-cache --maxWorkers=1 --testFile=src/lib/entity-large-batches.spec.ts --testNamePattern='setAll removal neighbour search work'
corepack pnpm nx test kernel --skip-nx-cache --maxWorkers=1 --testFile=src/lib/entity-large-batches.spec.ts --testNamePattern='^entity batches larger than the argument limit setAll, replace and clear with membership observed$'
corepack pnpm nx test kernel --skip-nx-cache --maxWorkers=1 --testFile=src/lib/entity-large-batches.spec.ts --testNamePattern='^entity batches larger than the argument limit undo and redo of a setAll that replaced every row$'
corepack pnpm nx test kernel --skip-nx-cache --maxWorkers=1 --testFile=src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts --testNamePattern='^v16 restoration of turns larger than the argument limit jumps across a turn that cleared more rows than the argument limit$'
corepack pnpm nx test kernel --skip-nx-cache --maxWorkers=1 --testFile=src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts --testNamePattern='^v16 restoration of turns larger than the argument limit releases the claims of a truncated turn that cleared more rows than the argument limit$'
```

Require nine selected passes for command1 and exactly one selected pass for each other command; skipped nonselected tests are expected, zero selection is failure. Name filters are source-derived, not executed here. If ordinary exact-candidate qualification already covers those same nine cases, reuse its receipt and omit command1. Do not rerun the four large cases again merely to obtain a whole-file receipt: record the exact disjoint partition and source identity in the qualification matrix.

4. Safety escalation: because original 130k work remains unqualified, first run the four large bodies once at N=2,048 in an isolated scratch copy, changing only the LARGE declaration in these two files. Use the same four case commands, assertions and per-case isolation, preserving both overlay and originals. Graph-prepare that scratch cwd separately. This is at most four screening invocations, then the four original 130k invocations on untouched selected source; no intermediate-size ladder or retries. Stop at the first failure. A successful screen permits attempting 130k, not claiming it passed. If current resource evidence already makes 130k unsafe, do not launch it; record unqualified/resource-limited and return to implementation reduction. Do not silently lower LARGE or raise timeouts.

5. Supervisory bounds: retain each test's existing 60/120s timeout. After separate graph preparation, cap each complete Nx invocation at 360s, with 180s without structured test progress; ordinary log chatter must not reset it. Log monotonic launch/target/test-start/test-end times where available. Use birth-matched owned-process cleanup on abort and record survivors. A synchronous hung test needs the external watchdog even if Vitest's timer cannot fire. Set a conservative host safety guard before launch: proposed aggregate owned-process RSS ceiling 2GiB and minimum 4GiB host available-memory floor. These are abort policies, not library budgets or expected memory use; Noether must record the host's actual available-memory metric and effective caps before execution. If the host cannot supply reliable telemetry, do not treat sparse heap samples as a replacement safety guard. Stop on resource guard, assertion failure, source drift, missing selection or cleanup failure; preserve first evidence. Do not adjust a failed guard and retry within this protocol.

Outcome classes must distinguish graph/setup failure, worker-start failure, assertion/test timeout, external no-progress termination, resource-policy abort, and selected-case pass. Report end-to-end startup separately from test execution. R1's fifth run had no events/samples and a late target-launch chain; it does not establish a library failure at2,048 or prove all prior delay was graph computation. Graph preparation may help but is not a guaranteed fix.

## Safe setup consolidation

Safe candidates: pure Row/rows(count,offset) helpers; the exact twelve-microtask drain; common command/environment receipt and fresh-process cleanup machinery. Keep rows newly allocated per case, enhancer instances and trees local, subscriptions stopped and trees destroyed in finally. A shared helper must not cache arrays, trees, entity facades, histories or instrumentation state. Preserve flush counts and placement; replacing them with a generic eventual-success loop changes test meaning.

Do not merge the four large cases into one reused tree/worker: fresh per-case process exit addresses cross-case retention without asserting GC timing. Do not collapse membership and notifier subscriptions, replacement and clear, undo/redo and jumpTo, truncation and rollback, plain and observed, or transactions-only and transactions+restoration. Prototype find/findIndex instrumentation and production-substrate counters need their existing exact restoration/reset and calibration assertions; a shared wrapper must retain these checks and avoid concurrent instrumented execution. No deletion is justified by this bounded inspection.

## Limits / remaining work

Inspected contracts, current controller, exact spec bodies, target/wrapper, and prior startup source/log review. No executable falsifier ran; no new runtime, size, performance, OOM-resolution or universal allocation claim. No full test-suite redundancy audit or independent final source-manifest verification was performed. Main's active-controller/TODO consolidation supersedes the stale-queue finding; this report does not reopen it. The proposed finite run can qualify current large cases or produce a precisely classified stop; it cannot guarantee their feasibility. Remaining original 130k failures require actual implementation work or an explicit supported-contract disposition, not smaller replacement tests.
