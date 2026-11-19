# First matched memory experiment — eight invocations maximum

Only authorized first boundary-sample experiment. Schedule: baseline128,reader128,reader512,baseline512,baseline2048,reader2048,reader512replicate,baseline512replicate. Fresh Nx/Vitest worker per invocation, sequential; original membership case then original replace-every-row restoration case in same worker, same imports/assertions/timeouts, only LARGE changed. No second instrumentation/profile/GC expansion.

Output-only standalone stage calls plus one final12-microtask drain after restoration destruction. Inverse removal recovers exact original source. Membership case remains synchronous. No intermediate extra tree read, filter wrapper, proof walk or retained object record. Memory rows are boundary samples, not peaks/retained bytes. Runtime arms differ only by the three private-reader runtime paths in IDENTITY.json. The reader measurement selection excludes its two packet diagnostic specs; neither frozen source is edited. Imports resolve from each identified arm working directory; no runtime aliases are redirected.

Stop on first command/assertion/resource failure, timeout, source drift or missing/extra selected cases. No escalation if any boundary heapUsed exceeds512MiB; also stop when net positive boundary heap growth above initial membership-before-create is >64MiB AND >8 times preceding smaller-N same-arm growth (successive N ratio4). These are conservative experimental stop rules, not altered product budgets or proof of bad asymptotic behavior. GC noise can trigger a stop, never a favorable retry. Same-size512 replicate stays distinct. No heap-limit flags. External180s startup/no-progress and360s absolute cap, birth-matched owned cleanup.

Require actual fresh worker PID distinct from every earlier invocation, same heap-size limit, exact two selected tests passing. Other cases in original file are name-filtered, recorded skipped, not claimed tested. Preserve every first outcome, both frozen inputs, per-arm runtime, test-overlay bytes and source identity before/after. No130k, cost/timing ranking, heapdump or production mutation.

## Fresh source and command registration

Registered before any Nx measurement: 2026-11-03T16:09:42.563190+00:00

Baseline frozen/selected manifest: 8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333 (3124 files). Reader frozen: 812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302 (3127 files); selected measurement map: 42b24d55377490c7c51cf552004cd9141584d8ec8bfad075e2724afd6a55cfed (3125 files, only two packet diagnostic specs excluded). Explicit shared installed node_modules symlink; no caches or archives copied. Source Nx/Vitest experiment, not package-build qualification.

COMMANDS.json contains all eight exact argv/cwd/overlay hashes; runner checks them before launching. Node24.15.0/pnpm10.17.0. Existing run.py reused with arm/path changes, command binding, exact case-name/numeric sample validation and live enforcement of the same steep-growth rule. No new workload or instrumentation. Original test and instrumentation template are byte-identical to the earlier protocol.

Preregistered hashes:
- IDENTITY.json: 976c3fadb50b47dd4917cd1389f55285f99d5199ff6d25816cb6bac29ba642fe
- COMMANDS.json: c9b3bdb144cfd485eb16d74065b34444c612829003dcc033981804197960d747
- run.py: 092d450bc1e0a380b05dd60f0344700949fc21ad88559ac739ce89754e4504d7
- INSTRUMENTED-TEMPLATE.spec.ts: eead720778660ef1e0b0270299e5d19c1c464bedc2e1462759c7d8d6bbff38dd
- full-reporter.mjs: 7139f0a808104be6cd10b49c92889026925d08840f014cd1c65d6f43f633c977

Composition caveat tracked: excluded cold-row-responsibility.spec.ts and preparation-reader-comparison.spec.ts require packet ST_* output variables. Frozen specs retained unchanged. This exclusion resolves measurement selection only; future broad-suite composition still needs handling.

Prior Main runs, separately verified from logs: Angular4/2files, React3/1file, Vue4/2files, Solid4/2files =15 framework cases; kernel93/4files; full source typecheck exit0. These are prior correctness checks, not memory invocations. No broad rerun.
