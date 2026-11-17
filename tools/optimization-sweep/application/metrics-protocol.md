# Optimization comparison extension

This version compares eight arms: pinned native/NgRx/TanStack/TanStack variant, and before/after v15/v16. All four SignalTree apps use the keyed asMap context strategy. NgRx uses its accepted entity map plus the same factored application projection without filling lazy point-reader caches. Native reuses existing eager record views, and both TanStack arms use direct collection get plus their existing projection; constructing an additional full collection-state Map would wrap those same get calls. All eight declare a required contextRows method; no silent point fallback is admitted. Selected50-row contexts remain point reads. Five rotated rounds ×8arms ×2sizes ×2kinds plus16v15 A/A children =176children. Calibration16; metric controls9; unchanged dispatch controls88. Before/after pairs isolate runtime changes under the same application strategy. Full native coordination is tested separately.

Thirty-two keyed-context controls (eight ordinary workflows and twenty-four planted failures) are mandatory before measurement, in addition to the common nine metric controls. Controls include independent expected values for same-subject operation order, unknown outcomes, revision suppression and replacement while an old command is unresolved, plus old-context and destroyed-store checks. Peer overlay base/source/receipt hashes are pinned in config and preparation inputs. Node, Playwright and the selected browser distribution are pinned. No early sample is removed.

The context API compares ordered values, missing sentinels and duplicate positions, not cached result-object identity or arbitrary reentrant ID-array getters. NgRx pending bulk projections can be freshly allocated while its point reader remains cached. These peer overlays are application-strategy changes; historical point-peer measurements remain separate and cannot be attributed solely to library changes. No performance benefit is inferred before execution.

# Additional application metrics

This supplements the existing coordinated-dispatch outcome oracle. It does not
replace the stronger native v16 or reviewed-operation/HTTP conformance checks.
Use the same production Angular applications and deterministic command service.
Admit only exact builds already passing all dispatch controls; bind source,
packages, served files, toolchain, this protocol and the runner before execution.

## Registered workload

- Arms: native Angular, NgRx SignalStore, before/after v15, before/after v16, TanStack original, and the
  separately labelled private TanStack application variant. Library versions stay
  pinned to the completed study; successor SignalTree artifacts are separate.
- Profiles: 1,000 and 10,000 dispatch rows; no CPU throttling. Display forty rows.
- Calibration: one fresh browser per arm and measurement kind at 1,000 rows
  (16 children). No calibration sample is
  included in comparison. Freeze any correction before comparative execution.
- Comparison: five rounds per profile, rotated arm order. Timing and memory use
  separate fresh Chromium processes. Two additional v15 A/A pairs per profile
  expose same-build noise; do not pool them with main samples. Total 176 children:
  160 main and 16 A/A. Five rotations give partial, not complete, positional balance.
- Startup: retain seed generation, store factory, bootstrap-to-layout and
  navigation-to-layout from the unchanged application's existing instrumentation.
  Summarize timing children separately from forced-GC memory children. These
  intervals overlap and must not be added together.
- Context: materialize the first 50 rows and all rows, then JSON serialize each.
  Record each context's first demand in this script and twenty subsequent
  repetitions separately. Initial UI already reads 40 rows; the full context
  follows 21 selected-context reads in timing children; memory children make one
  selected and one full read. Neither is labelled a cold-store demand. Check exact
  row count, IDs, values and byte identity; report bytes, not tokens/model cost.
- Pending pressure: independent owner assignments on 8, 32 and 128 distinct
  rows. Each level starts a new document/store session in the same child browser;
  navigation is outside phase timings and avoids the reset driver's deliberately
  retained previous service. Stage all commands, check every
  optimistic value and unresolved outcome, accept each once, check every accepted
  value/revision, then dismiss settled records. Dismissing while commands are
  pending must preserve every unresolved operation. Include the test service's retained
  logs/receipts in whole-app heap and identify that limitation.
- Interleaved work: twenty rounds. Each round schedules eight distinct agent
  proposals and one synthetic human form/assignment action on the event loop.
  All 180 commands must complete with 180 accepted effects; all 180 server decisions and final values must
  agree. User action enqueue-to-handler delay and handler-to-stable-layout time
  are separate. This is scripted local responsiveness, not real-user INP. No LLM
  inference or network delay is attributed to a state library.
- Sample requestAnimationFrame gaps while that useful work executes. Report
  sample count and maximum/p95 with the refresh interval and foreground status;
  do not call a callback gap a measured dropped frame. CDP task/script/layout
  duration deltas are browser telemetry, not process CPU time. Twelve warm-up
  callbacks establish the observed refresh interval; active callback gaps exclude
  warm-up/cool-down. Throughput and CDP duration cover the complete driver trace,
  including deterministic oracles and service work, not isolated library CPU.
- Memory children collect three times with host-task boundaries at blank,
  populated, after both contexts, each fresh populated/pending/settled level and
  final destruction. Capture contexts are dropped before collection; this measures
  any retained reader caches, not held context or peak allocation. Include their
  materialization timing separately. Report signed deltas, never a ratio of a
  negative retention delta. These finite checkpoints do not prove leak freedom.

## Falsifiers and interpretation

Existing planted dispatch defects must remain rejected. New controls must prove
that context truncation/wrong values, a dropped command, a stale optimistic
value, premature removal of unresolved work and duplicate application cannot
pass the added oracles. Nine metric control cases cover those failures, including
lost optimistic projection despite retained unresolved metadata. A
deliberate main-thread busy interval must be visible
in enqueue/handler or frame-gap telemetry, using a positive observation rather
than assuming an unreported browser entry means zero. Comparison admission requires
matching source/build identities and verified passing controls/calibration.

Retain each child's full operation samples and outcomes. Report the median and
range of per-child p95s, never a percentile pooled across unequal children.
For timings and positive heap levels, report matched-round differences/ratios;
report signed differences for heap growth. Missing/failed children invalidate
the cohort rather than disappearing from denominators. Instrumented allocation
profiles, if subsequently needed, are a separate attribution cohort with sample
interval/tool version and no claim of exact allocation counts.

This protocol fixes workloads and counts before comparative execution. The
runner's conformance/calibration can expose mistakes; preserve those first
failures, version any corrected plan, and obtain interpretation review after
results exist. Unfavorable results are findings, not a reason to change budgets.
