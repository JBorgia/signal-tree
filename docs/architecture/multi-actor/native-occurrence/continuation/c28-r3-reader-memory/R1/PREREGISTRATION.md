# R1 — fresh separately authorized campaign

Registered before R1 execution: 2026-11-03T16:17:04.766258+00:00

Restart reasons: C0 had one Nx command administratively cancelled after Main reported an overlapping job, with zero test events/memory samples. C0 first receipts and original controller092d450b/preregistration remain unchanged. Independent review then demonstrated overlay-drift and incomplete/wrong-size receipt acceptance defects. Reviewed controller1d79497f closes both; independent verdict is pinned in IDENTITY.json. This is an explicit new R1, not a replacement/retry of C0 or a favorable measurement retry. Main cleared heavy jobs and authorized this separate R1.

Maximum eight NEW invocations, stop on first failure; no reruns. Separate R1/runs directories. Same identified baseline8f902607 versus reader812a3ad5 frozen inputs; measurement reader selection42b24d55 excludes only the two packet diagnostic specs, preserving runtime and original workload. Source inputs and all exact commands/overlay hashes are in R1/IDENTITY.json and R1/COMMANDS.json. Runtime imports resolve from each arm's source cwd and shared installed tools as declared; no source aliases redirect to another candidate. No broad test suite or build.

Controller: /private/tmp/st-c28-r3-reader-memory/run-r1.py
SHA256: 1d79497f61728e1f33ec300d05058cc2399f568eec71680226d0dd8034eb0344
Supervisor command: `python3 /private/tmp/st-c28-r3-reader-memory/run-r1.py` with narrowly escalated process census/birth-matched cleanup. Child argv/cwd/environment are recorded per invocation. Existing Node24.15.0/pnpm10.17.0 pins, inherited PATH after pinned Node prefix; child ST_*, NODE_OPTIONS and NODE_PATH scrubbed before explicit settings.

# First matched memory experiment — eight invocations maximum

Only authorized first boundary-sample experiment. Schedule: baseline128,reader128,reader512,baseline512,baseline2048,reader2048,reader512replicate,baseline512replicate. Fresh Nx/Vitest worker per invocation, sequential; original membership case then original replace-every-row restoration case in same worker, same imports/assertions/timeouts, only LARGE changed. No second instrumentation/profile/GC expansion.

Output-only standalone stage calls plus one final12-microtask drain after restoration destruction. Inverse removal recovers exact original source. Membership case remains synchronous. No intermediate extra tree read, filter wrapper, proof walk or retained object record. Memory rows are boundary samples, not peaks/retained bytes. Runtime arms differ only by the three private-reader runtime paths in IDENTITY.json. The reader measurement selection excludes its two packet diagnostic specs; neither frozen source is edited. Imports resolve from each identified arm working directory; no runtime aliases are redirected.

Stop on first command/assertion/resource failure, timeout, source drift or missing/extra selected cases. No escalation if any boundary heapUsed exceeds512MiB; also stop when net positive boundary heap growth above initial membership-before-create is >64MiB AND >8 times preceding smaller-N same-arm growth (successive N ratio4). These are conservative experimental stop rules, not altered product budgets or proof of bad asymptotic behavior. GC noise can trigger a stop, never a favorable retry. Same-size512 replicate stays distinct. No heap-limit flags. External180s startup/no-progress and360s absolute cap, birth-matched owned cleanup.

Require actual fresh worker PID distinct from every earlier invocation, same heap-size limit, exact two selected tests passing. Other cases in original file are name-filtered, recorded skipped, not claimed tested. Preserve every first outcome, both frozen inputs, per-arm runtime, test-overlay bytes and source identity before/after. No130k, cost/timing ranking, heapdump or production mutation.


Acceptance also requires exact complete ordered30-stage sequence, finite numeric boundary fields, N matching every row, original case order, and overlay matching both run snapshot and preregistered hash. No changed instrumentation/assertions/imports. R1 outputs remain boundary samples, not peaks/retained bytes or CPU claims.

Main's prior checks remain separate: Angular4/2files, React3/1file, Vue4/2files, Solid4/2files =15 framework cases; kernel93/4files; full source typecheck exit0. Main composed no-sink diagnostics repeat11/11 across2files exit0, first setup failure preserved in its own packet. These do not add measurement executions or qualify frozen packet diagnostics for arbitrary suite composition.
