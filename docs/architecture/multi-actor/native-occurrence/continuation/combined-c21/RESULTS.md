# C21 test-only qualification candidate

Manifest SHA256: 73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27.

Composes C20's independently reviewed recipient counterparts with the independently reviewed clear-search guard. The only incoming file is entity-large-batches-v16-controls.spec.ts; zero merge conflicts. Runtime, library API, discovery configuration, point-write budget and artifact ceilings remain unchanged from C19.

Focused composition: 40 passed, three large cases deliberately filtered, four files. Exact command and source-before/after hashes in runs/joint-test-maintenance. The clear guard separately passed meaningful current-route and legacy-route mutation controls; no mutant runtime is in this candidate. This does not qualify the excluded large cases.

A fresh, separately instrumented original130k test passed all phase/assertion/cleanup markers against unchanged C19 runtime. The original full-suite stall remains preserved and unexplained. A broader C21 run uses the unchanged test timeouts plus an external 180-second no-progress watchdog and an owned process group. Full disposition must come from runs/full-kernel-watchdog, not this launch record.

No release acceptance, API activation, production change, budget increase, push or merge.

## Full-run outcome

The external watchdog terminated the full run after 180 seconds without progress
in the original 130,000-row membership-observed first case, after 276 completed
modules. This repeats C19's stalled location; the isolated stage-copy pass does
not qualify the original full run. No aggregate full-suite pass count is claimed.
The unchanged point-work absolute guard and original three-method API assertion
also fail in the completed portion. The revised large-v16 controls pass all18
cases, including the previously filtered large cases. Source hashes remain
unchanged.

SIGTERM targeted only owned process group60688. The runner recorded the group
still present immediately after its parent exited; a later permitted process
listing found no entries in that group. These observations remain distinct.
Next discriminator is the unchanged original first case alone, with full-run
environment/reporter settings, not another broad rerun.
