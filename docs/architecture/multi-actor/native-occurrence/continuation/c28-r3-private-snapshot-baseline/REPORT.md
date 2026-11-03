# Phase A baseline characterization — partial coverage, no runtime prototype

Exact input is frozen composition manifest **2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd**, not bare R3 and not live combined. All3102 original paths verified in frozen source and disposable copy after checks; no mismatch. Only one new spec, six cases, at most four distinct row IDs per case. ORIGINAL-R3-PLAN.md and input/callsite AMENDMENT.md preserve the scope correction. Current combined source unchanged. The prior163 sampling evidence hashes, including original profiles, remain unchanged.

## Executed outcomes and first failures

| Run | Outcome | Classification |
| --- | --- | --- |
|new-first|6 failed in setup|Spy attempted unavailable optional createWritableProjection. No semantic case reached; EXECUTED-FIRST.spec.ts/log preserved.|
|new-second|5 passed,1 failed|Calibration correctly failed: factories were wrapped on a runtime not used by createSignalTreeFactory. No claim from those zero counts. SECOND-FIRST-RESULT.spec.ts preserved.|
|spec-first|2 new spec errors|Implicit rest args and Link sink returning push's number instead of void. Preserved raw log; no ratchet change.|
|new-third|6 passed|Actual createLocations ingress delegates to real createLocationRuntime; cold factory calibration positive. THIRD-PASS.spec.ts preserved.|
|spec-second|passed|Fixture-only type/setup corrections.|
|new-final|6 passed|Added token-read stack provenance, strengthened throwing clone with genuine nested committed stamp write, and value-reference assertion. No new cases.|
|originals-first|12 passed,49 filtered,3 files|Exact unchanged selected handle/structural-store/adapter controls.|
|source-first|passed|Unchanged tsc source gate, tsconfig.typecheck-all.json.|
|spec-final|passed|Unchanged tools/check-spec-types.mjs; no allowlist/ratchet changes.|

Run directories preserve first.log/EXIT, later COMMAND.json, observations, and exact fixture versions. First run's exact command is recorded below because it preceded the reusable runner. Warnings from archived docs tsconfigs referencing absent historical temporary directories were emitted by Vite but did not prevent cases executing; no config edited. No broad suite or profiling. Earlier script attempts that inspect logs are not runtime failures.

Final test-only patch `tests.patch`, exact FINAL.spec.ts, BASE-MANIFEST.json and SOURCE-AFTER.json are review artifacts. Do not promote this diagnostic packet as a completed replacement safety gate.

## Actual useful assertions

1. N2 disjoint replacement: full physical rows/order after replacement/undo/redo, exact last Link payload after each, later update payload. Four observed sends: replacement, old rows, replacement, later c.n=8.
2. Held row/field on point undo: actual reactive observer follows7→1→9 and row value is correct. Explicit cold byId creation calibration. Preparation token reads recorded separately.
3. Mixed point+removal undo: exact restored rows/order, held removed row/field restored; rekey b→z followed by fresh b does not retarget old held lifetime; later z update reaches old field.
4. Private physical-window ingress: hidden own-tree backing visible at matching registry/tap depth; foreign tree and nested tap remain absent; after finally pop ordinary reads remain absent. **Not a public hidden reversal proof.**
5. Existing point-clone getter throws sentinel; original baseline records1 getter hit, outer row stays n7. Final version's getter also commits stamp5 once, outer throws same sentinel, stamp5 survives and row remains n7. Restoring the property then updating n9 succeeds. No fixed getter-count contract is asserted (only >0 reach). This is one throwing supported callback case, **not nonthrowing reentry/stale-refusal proof**, and not placement-rekey clone coverage.
6. Private existing collection-shaped ingress: real collection's byIdOrFail transparently returns direct raw row rather than callable for adapter remove validation. Actual validation succeeds; method receiver/key semantics retained, call count positive, backing reference and rows unchanged. This is a pre-new-capability shape characterization; no capability or fallback implementation exists yet, and present-capability exception/no-fallback behavior is untested.

## Measured construction and dependency observations

Instrumentation uses repository createReactiveTestRealization's actual observation tokens and kernel createLocationRuntime, with transparent token observe/invalidate delegation. It wraps the **actual createSignalTreeFactory third-argument createLocations ingress** and delegates each available factory unchanged. It does not substitute fake cells/computed, change runtime source or inject proof. This is the existing kernel reactive test realization, not Angular/Vue/Solid/React native UI qualification.

`createWritableProjection` is unavailable on this runtime and logged as such in every setup: **unobserved factory category**, not zero projection creation. The kernel fallback constructs projections through createDerived, which is measured. Read-only stack capture and counters have overhead and are not timing/allocation-byte measurements. No fixed runtime-work ceiling is asserted.

| Operation | createDerived calls | under snapshot helper | under hasCollectionKey | token reads / under snapshot |
| --- | ---: | ---: | ---: | ---: |
|replacement undo|4|4|0|31 /24|
|replacement redo|4|4|0|31 /24|
|explicit cold held-row calibration|2|0|0|1 /0|
|held point undo|0|0|0|6 /0|
|mixed undo|2|0|0|10 /3|
|throwing clone undo|0|0|0|5 /0|

Counts refer to phases in runs/new-final/observations.jsonl and OBSERVATION-SUMMARY.json. V8 stacks are bounded/truncated; unmatched frames are not proof of no underlying work. No total-zero inference for hasCollectionKey: it remains unchanged and can prewarm rows; this finite stack sample did not attribute new factory calls beneath it. Mixed operation constructs elsewhere before its observed snapshot reads. Cold/held setup deliberately differs; don't compare totals as a cost reduction.

Reachability inventory for composition helper consumers:

- Structural removal snapshot: positively reached during replacement reversal, with positive createDerived construction beneath snapshotCollectionEntityValue. This validates the local allocation category, not its redundancy or a speedup.
- Heterogeneous live-point consumer :1274: positively reached by mixed case through token-read stack `readSubjectEntity → byId → byIdOrFail → snapshotCollectionEntityValue → planHeterogeneousFrame`. Its row was prewarmed; no positive targeted construction there.
- Direct preparePointRealization consumer :1016: **not established by this packet**. The public point undo case passed but raw captured read stacks do not demonstrate that helper callsite. Do not infer direct point coverage from its test title.
- Placement rekey snapshot :2414: **not established**. Public rekey/lifetime assertions and unchanged selected adapter tests do not establish this specific helper branch or clone boundary.

The native token observations prove actual dependency-touch activity at some preparation reads. They do **not** establish whether an active consumer semantically needs every touch, nor that removing them preserves native dependency behavior. No optimized reader arm exists, so there is no old/new dependency-equivalence comparison yet. Public held-field liveness passed independently; that does not settle internal tracking authority.

## Missing discriminators / bounded stop

Do not classify the six passes as full presence/reentry/clone/proof safety completion. Remaining: public hidden-ancestor reversal with callback exposure; direct point consumer reach; placement-rekey clone/identity and removal-prepared-value preference through the exact helper; nonthrowing reentry plus stale physical clock refusal; pending foreign proof/Link safety; active tracking context around preparation; missing-backing/missing-key error equivalence; absent-capability versus present-capability-throw distinction in a future reader. Existing handle ABA/reset originals passed but do not eliminate these gaps. Any additional cases should be separately scoped; no new runtime prototype now.

Original controls run exactly via positional Nx filters and regex in runs/originals-first/COMMAND.json: handle resolution2, structural-store3, adapter7. No original tests edited or source loops changed. Independent premise review informed callsite scope, not a preferred runtime design verdict.

## Reproduction and preservation

Pinned Node24.15.0/corepack pnpm10.17.0 PATH; separate run-owned Nx cache/workspace data/TMPDIR and ST_SNAPSHOT_OUTPUT. No global prototype mutation, no source instrumentation, no heavy workload. `run-check.py` records actual commands/exits for corrected/new/control/type runs. First command: `corepack pnpm nx test kernel private-snapshot-baseline --skip-nx-cache --maxWorkers=1`, cwd candidate, NX_DAEMON=false/NX_ISOLATE_PLUGINS=false/NX_NO_CLOUD=true/NX_TUI=false, cache/data/tmp and observation sink under runs/new-first. Same pinned PATH. Each test destroys owned trees; spy restorers and physical window/tap depth finally blocks execute. All invoked processes returned; no background workload launched.

Interpretation: a positive targeted construction premise exists for the replacement structural path. Some other paths prewarm or remain unreached. No optimization accepted, no130k/OOM/timing/retention claim, no new API/semantic promise. Main's sampled-method amendment was authorization of diagnostic technique within this task, not a new product decision by the user.
