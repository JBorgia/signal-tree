# Current-to-successor native workflow comparison

This reuses the prior native workload without changing its operations or counts. It compares the exact new selected v16 artifact with the current qualified November 17 baseline, both with the
full native guarantees. It does not compare native guarantees with ordinary peer
applications or introduce a runtime configuration. The final application packet
does not yet exist when this method is authored: the config example deliberately
has non-hash placeholders. Fill those from the frozen plan and dispatch build.

## Admission and execution

Use Node 24.15.0. `prepare.mjs CONFIG NEW_PACKET` verifies the complete original
application plan inputs, dispatch build/plan join, both v16 before/after source
identities, matching application context strategies, and all installed kernel
and Angular payloads. It copies both archives, checks their complete tar member
lists, extracts and compares every payload, then builds two strict production
neutral fixtures using the same installed esbuild. Metafiles must show the native
entity-publication factory emitted, with no runtime source alias or second kernel.
The exact Node, bundler, source files, original provenance and browser execution
closure are bound. A native-specific helper resolves Playwright from the exact
workflow workspace, then resolves its required core and optional fsevents from
that installed Playwright package. It neither requires pnpm to hoist core nor
substitutes another application toolchain. An unresolved optional fsevents is
recorded explicitly only when neither its manifest nor entry resolves. A usable
entry without a manifest is rejected rather than omitted from the closure;
missing required core, broken exports and version mismatch
remain failures. The selected browser registry is also rechecked on verification.
The existing shared application execution helper stays unchanged and bound as a
reference. Installed build/test package dependencies and present peers are
resolved recursively from each owning package; this includes the actual Babel
core resolved from Angular compiler-cli. Missing required dependencies fail
preparation; unavailable optional dependencies are recorded. Browser closure is
verified before and after the functional cohort, and its observed browser version
must match the frozen selected browser. The minimal arm plan views change only artifact names for the
old HTTP runner; their provenance joins the original plan and selected arm.

Preparation writes a frozen runner and equal two-arm execution manifest. Each
fresh child hashes **both** kernel archives, all kernel payloads and both bundles
in the same order, verifies the Node executable and frozen tools, then imports its
selected runtime. Large shared provenance is verified by the parent before each
child, not asymmetrically in child prehistory. Functional children additionally
use the unchanged old installed workflows. The parent rechecks all inputs after
execution. Old source files and receipts are not changed.

Commands after preparation:

```text
node PACKET/tools/run.mjs plan PACKET/packet.json controls NEW_CONTROLS_PLAN
node PACKET/tools/run.mjs run NEW_CONTROLS_PLAN/plan.json
node PACKET/tools/run.mjs plan PACKET/packet.json functional NEW_FUNCTIONAL_PLAN
node PACKET/tools/run.mjs run NEW_FUNCTIONAL_PLAN/plan.json
node PACKET/tools/run.mjs plan PACKET/packet.json cpu NEW_CPU_PLAN CONTROLS/execution/results.json
node PACKET/tools/run.mjs run NEW_CPU_PLAN/plan.json
node PACKET/tools/run.mjs plan PACKET/packet.json heap NEW_HEAP_PLAN CONTROLS/execution/results.json
node PACKET/tools/run.mjs run NEW_HEAP_PLAN/plan.json
node PACKET/tools/analyze.mjs CPU/execution/results.json HEAP/execution/results.json FUNCTIONAL/execution/results.json NEW_ANALYSIS
```

Every output must be fresh and outside the source checkout, packet and protected
input paths. Serial children preserve logs, actual commands, process IDs, exit
status/signals, source/artifact joins and complete raw results. The runner stops
on the first unexpected failure. There is no favorable-sample replacement. An
expected planted failure passes only its named oracle; other errors fail. Falsey
throws are recorded rather than assumed to have `.stack`.
Offline admission rejoins the result kind, packet, output path and exact child
invocation, replays the controls receipt, and requires the complete named phase,
CPU-component, heap-checkpoint, resource and sampled-object schemas. The source-only
`helper.mjs NEW_RESULT` checks synthetic positive rows and rejected missing/corrupt
measurement fields; it does not substitute for the ten actual workload controls.

## Unchanged functional workloads: 12 children

Per arm: the existing public Node suite (62 useful tests) and full-AOT production
DOM suite (15 cases); the real-loopback HTTP suite (12 cases); each of its existing
`skip-native-settlement` and `ignore-instance` controls; the unchanged coordination
child with 1,000 rows and 20 episodes; and that child's existing early-send fault.
The coordination cases preserve declared dependent/independent delivery, refusal
of an overlapping rollback, same-key retirement and late readers, pre-enrollment
history, observer reentry and explicit recovery, then 128 simultaneous pending
inverses and exact drain. Normal phase counts and the real fault assertion are
checked. Public installed payloads receive an additional post-run inventory check;
the HTTP runner already performs that check. HTTP receipt uncertainty is an
explicit post-effect HTTP503 without an application receipt, not proof of actual
TCP-loss behavior. Original functional timers mix oracles/GC and are **not** used
as comparative CPU measurements. Current strict point-work tests and broader
release qualification remain separate parent-owned evidence.

## Retained-store workload and useful oracles

An enhanced empty tree and active collection Link remain alive for ten cycles.
Each cycle creates 1,000 or 10,000 rows with an id and eight numeric fields, using
fresh `R-cycle-index` keys and fresh values. The transaction clones the rows then
calls `setAll`. Every populated value and exact row order are checked while one
owner is pending; no outbound delivery is allowed. Confirmation keeps the full
new rows, replacing the previous cycle. Rollback returns the exact empty store.
Every settlement reaches zero pending owners and a fixed microtask/Link drain.
Full values/order and SHA256 sink payload traces are verified. Confirmation must
deliver exactly once per cycle. First rollback must actually deliver `[]`; later
identical empty deliveries may coalesce. All delivered payloads are checked, and
the complete trace must agree across paired arms. A no-op or dropped-work result
cannot pass on an empty endpoint alone.

CPU has 24 primary children (2 sizes × 2 settlements × 3 alternating paired rounds
× 2 arms), plus 8 baseline A/A children, 32 total. It has **no explicit GC**. Factory,
Link attachment, population and synchronous settlement are recorded separately.
Settlement including drain starts before settlement and ends after fixed draining
and `Link.settled`; it includes useful sink hashing. It contains synchronous
settlement and must not be added to that subset. Setup rows, pending-state checks,
and post-settlement value oracles are outside those timers. All cycles and raw
variation are retained; three rounds and A/A are not significance evidence.

Heap has 8 primary children (the same four profiles × 2 arms), plus one extra
baseline child per profile, 12 total. Its GC schedule and timing are kept separate
from CPU. Three job-separated GCs precede each whole-heap checkpoint: before tree,
empty active Link, pending, settled handle held, handle dropped, cycle helper
returned, Link disposed, destroyed tree deliberately held, and owner helper
returned. Current-cycle IDs and at most the previous cycle's IDs/one weak payload
are retained for inspection; no cumulative all-history numeric list grows.
Retired physical lifetimes/value backings must disappear, with zero acquired row
facades. Current confirmed rows remain active. The actual stored first payload
and transaction handle are sampled via WeakRef. The payload identity is asserted
while the store actually owns it. Handle-drop and payload-collection assertions
are made after helper return and GC, not from a still-live local input copy.
The pending/settled-handle-held/handle-dropped checkpoints intentionally still
include the cycle helper's expected input rows and numeric IDs; they are not
isolated store-size estimates. `helperReturned` removes those input-row locals
and is the primary retained-store checkpoint. The main heap cohort records the
post-owner-helper tree WeakRef outcome as a Boolean observation; the separate
pin/release control requires collection after release.
Unexpected retention remains a first failure to investigate, not automatically a
library leak. Finite whole-heap results cannot prove universal boundedness; exact
terminal publication facts can legitimately remain after physical reclamation.

## Ten controls, separate from comparisons

Each arm has one positive ten-cycle confirm workload; three one-cycle rollback
faults (inject premature delivery → `pending-delivery`, alter v7 →
`populated-values`, skip settlement → `settled-pending`); and one heap pin/release
control. The latter holds the actual rolled-back stored payload deliberately,
requires it alive while pinned, releases it and requires collection, and likewise
checks that a deliberately held destroyed tree stays alive before helper return
and collects after release. Successful exact-packet controls are required before
CPU or heap plans. Cleanup keeps the first failure and records any separate
rollback/dispose/destroy error; no child with a cleanup error is accepted.

## Limits

This is a finite exploratory screen on a shared development host, not throughput,
cross-framework equivalence, production authentication/security approval, durable
recovery or a universal leak claim. Heap checkpoints are not total allocation or
peak memory. Package sizes and application/startup/rendering studies are separate.
Any actual final artifact correction requires a new packet and fresh plans.
