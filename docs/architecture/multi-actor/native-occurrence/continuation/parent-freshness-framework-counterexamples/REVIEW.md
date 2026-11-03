# Vue, Solid, React parent-freshness counterparts

Bounded result: the exact proof improves completion freshness in all three real facades, but does not satisfy nonthrowing nested-write preservation. Preserve the failing test; do not promote this as all-green acceptance. No runtime, exports, budgets, root checkout, Main composition, or frozen inputs were edited.

Identity: base SNAPSHOT-PROOF SHA256 `5cb0b3d5616b3f9d002625270ee4b6793f8ba0388f5d6327ba52fa213d789b7b`, 3047 files. `IDENTITY.json` verifies every baseline file both in the frozen source and owned candidate after execution; it separately verifies original/owned C8. `TESTS.patch` adds only three spec files. `SNAPSHOT-COUNTERPARTS.json` seals baseline plus those additions. Comparison uses C8 manifest `3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a` with byte-identical final specs.

## Concrete failure and scope

All three facades: start rows `{old:{n:10}}`, warm retained branch/root readers and actual native consumer. Public branch assignment supplies `{old:{n:10},a:{n:1}}`. A **private injected membership-completion observer**, selected only for first installation of a, reads the held branch/root and issues the public read-derived assignment `{...rows(),b:{n:2}}`.

On the proof, the completion reads correctly include a; immediately after the nested assignment the branch correctly includes old+a+b. Native computed/memo/render stays at its prior delivered image and does not run early. On normal completion return, the outer write finishes with old+a, losing b. This is the first runtime assertion failure in each final proof log: Vue spec line 102, Solid line 110, React line 110 (`expect(heldBranch()).toEqual(expected)`). Throwing the exact sentinel after the nested assignment instead retains old+a+b, preserves sentinel identity, and passes the rest of the test.

This falsifies the requested **internal installed-completion reentry** preservation claim. It is not demonstrated as a supported public-callback regression: the observer registration is test-only private injection. Facade construction, state writes, branch/root reads and consumers are real; no fake adapter or invented React computed is used. C8 also fails preservation, so the evidence does not identify this as a newly introduced loss by the proof. C8's stale parent reads independently lose a in the read-derived input, which the proof repairs.

Source trace (inspection, not instrumentation): `packages/kernel/src/lib/signal-tree.ts:1059` installs a new prepared member during the supplied-key loop. `internals/materialize-markers.ts:872` completes its prepared publication before that outer loop reaches final membership reconciliation. `signal-tree.ts:1306` then enumerates current physical keys; omission at 1318 protects only `readdedDuringStructuralWrite`. `internals/member-membership.ts:437` consults re-add stamps; writes at 525-529 record dormant reactivation. A newly allocated nested b is not that reactivation case. Normal return reaches omission; a completion throw skips it. This source path explains the measured return/throw distinction; no runtime correction was attempted.

## Executed coverage

| Frozen runtime | Vue | Solid | React |
| --- | --- | --- | --- |
| Parent-freshness proof, final specs | 2 pass / 1 fail | 2 pass / 1 fail | 2 pass / 1 fail |
| Unchanged C8, identical final specs | 0 pass / 3 fail | 0 pass / 3 fail | 0 pass / 3 fail |

Exactly three scenarios per facade: normal non-reentrant completion; normal reentrant completion; throwing reentrant completion. Passing controls check pre-held branch/ancestor freshness, sibling identity, expected native delay, eventual delivery, independently update retained existing old then new a (and new b in the throwing case), require observer activity for every useful write, then same-value a write preserves root/branch/native identity and observer count. React uses mounted `useSignalTree` with `act`, and checks final DOM. Vue uses `computed` + synchronous `watchEffect`; Solid uses `createMemo` + `createComputed` in disposed `createRoot`. All readers/trees/native observers are torn down.

The C8 failures begin at completion freshness (a absent; ancestor remains prior identity), providing a decisive negative control. Soft freshness assertions retain subsequent diagnostic checks without changing expected semantics. Assertions after the final-image hard failure in nonthrowing reentry are blocked, not counted as validated; the separate passing normal and throwing controls cover later observation/no-op behavior.

Commands run from the indicated owned copy, with Node24.15.0, corepack pnpm10.17.0, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_NO_CLOUD=true, CI=true:

```
corepack pnpm nx test vue --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test solid --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test react --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm run typecheck:source
corepack pnpm exec node tools/check-spec-types.mjs
```

Each framework Nx target runs its actual `tsconfig.spec.json` tsc gate before Vitest. All three pass spec compilation, including React TSX (the root spec ratchet excludes TSX). Source types and root spec ratchet exit 0; no ratchet update. Final proof logs are `vue-final.log`, `solid-final.log`, `react-final.log`; final C8 logs are `c8-*-final.log`. Each has adjacent exact `*-command.json` and `*-exit.json`; exits are 1 for test runs, 0 for source/spec gates. Formatter only touched the three new specs before final execution.

## Preserved fixture failures and environment

`first-fixtures/` preserves original generated source. First Vue command `vue-first-command.json` used `--testFile=...` and stopped in tsc: ReturnType of overloaded writable root inferred void. Corrected the fixture to `typeof before`; switched to the positional Vitest filename filter used by these run-commands targets. No runtime change.

`second-fixtures/` preserves that revision. `vue-second.log` then failed its own guard before mutation: Vue native refs are callable here, and the object-only guard rejected one. Changed only the guard to Vue `isRef`. `vue-third.log` first reached the genuine nonthrowing nested-write failure. Solid/React first runtime failures are `solid-first.log`/`react-first.log` using their corrected typed sources in `second-fixtures/`. `runtime-first-fixtures/` and `c8-first-fixtures/` preserve the two-case sources used for first comparative runs. Final fixtures add the non-reentrant control and formatting; prior logs/sources remain intact.

Dependencies are a symlink to the independently copied working dependency tree at `/private/tmp/st-r4-review-resumed/candidate/node_modules`, not the broken v16-transition-qualification tree. Exact path and matching root/candidate lock hashes are in IDENTITY.json; lock SHA256 is `5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`. `node-version.log` and `pnpm-version.log` record pins. Inherited archived audit tsconfig missing-path warnings and npm config warnings remain in raw logs; they do not prevent compilation or selected tests from running.

Not run: broad framework/kernel suites, performance, builds, public callback matrix, composition with C10, or release gates. No inference of broader framework acceptance or release readiness. Recommended disposition: retain the three failing nonthrowing controls and route the concrete omission/reentry trace to Main; accept only the demonstrated freshness/delivery improvements and passing controls within this bounded scope.
