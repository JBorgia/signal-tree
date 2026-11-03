# Paired ordinary membership responsibility

October 18, 2026. Runtime checkpoint:
`89bfca6260cb3bc0993abb350f0f340b4e59581b`.
Parent: `add49efacb615970240250a9c59eb41d07f17a52`.
Incumbent reference: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.

**The bounded installation/capture correction passes its controls and independent
review. The cumulative new-key candidate is not release-accepted: four bundle
budgets fail, and the readiness inventory's other obligations remain open.**
No API, ceiling, stable-v15, B, activation or publication changes.

## Sequence and correction

Previously: private preparation; canonical child allocation; member installation;
later sibling equality/updater; end-of-loop membership notification; transaction
capture at notification. A later exception skipped the last two steps, so automatic
abort could report success while leaving the newly created member live.

Equality cannot be hoisted safely. A legal getter visited by built-in deep equality
reads the already-installed preceding member. Moving equality first changes its
input and can change whether it compares equal. The preserved equality-order probe
observes 123; a hoisted call would observe absence. No custom comparator is needed.

Now: private preparation; canonical child construction; prepare the membership
address/effect and transaction map/set writes; install membership and those prepared
records without application callbacks between them; invalidate membership within
the existing group; continue subsequent entries; deliver actual membership on exit,
including a partial-write exception. Original application failure takes precedence
over a secondary delivery failure; the latter is reported through the existing
contained-observer mechanism. No key-deletion compensation was added.

The correction extends existing `TerminalRecordPlan` use to ordinary member creation.
It records absence versus presence, the retained address, baseline, capture effect
and installed-operation record. The operation's effect is cloned independently of
the mutable capture bucket. Later notification still serves inspection, restoration
and Link; it is no longer the only transaction responsibility record.

Publication and responsibility remain separate claims. Moving snapshot invalidation
alongside installation prevents post-failure stale snapshots. Delivering the actual
membership in cleanup ensures Link sees completed partial writes. Neither step
moves framework-native delivery out of its group or imposes atomicity on every
ordinary whole-value write. Failed transactions still compensate completed writes.

## Preserved failures and review

The parent has the ordinary new-key/later-equality failed-abort counterexample.
All 23 parent tests keep their assertions. The final focused suite adds three
controls: entry order, refused-abort usable recovery, and partial-write Link delivery.
Four frameworks add seeded and unseeded failed-abort observer controls, each with a
successful later write proving the observer is live.

Independent reviewer `readiness_contract_review` reproduced equality-order constraints,
missing partial-write snapshot invalidation, missing Link delivery, reentry and
recovery. The latter two publication findings were repaired and rechecked. A source
aliasing concern was corrected by cloning the installed-operation effect. Final
review found no remaining blocker within its targeted scope, including a subsequent
source check of the error-flow cleanup.

One **new test premise**, not a parent assertion, was corrected. Requiring a primed
root snapshot to be fresh inside an arbitrary equality callback failed. Exact-8d
seeded control reads direct value 123 and snapshot value 0 inside that callback,
then snapshot 123 after the group. The final test preserves this timing and asserts
entry order plus post-group coherence. First-red logs remain archived. L13 at
`docs/research/transaction-semantics-2/LAWS.md:183` specifies coherent settlement
observer snapshots; it does not authorize expanding arbitrary grouped callback
snapshot semantics. Framework controls assert observer coherence after/during actual
delivery, never native computed freshness inside the callback.

Other preserved first failures: Object.hasOwn in new framework specs exceeded their
configured ES library and was replaced with hasOwnProperty.call; a new error-report
operation string was outside the existing contained-error union and now uses the
existing notification category; lint rejected a throw inside finally. Error values
are now collected, cleanup completes, then the first failure is thrown. No assertion,
type baseline or lint rule was weakened.

## Final-source verification

Node 24.15.0, pnpm 10.17.0, Nx daemon disabled. Dependency symlink provenance is
unchanged from the parent record; this is not a fresh dependency installation.
Full final runs occurred after the last runtime edit; the committed runtime matches
those bytes. Earlier runs and failures remain distinct in the archive.

| Check | Result |
| --- | --- |
| Focused kernel new-key controls | 26 ordinary passes |
| Focused framework controls | 3 each, 12 total |
| Full kernel | 5,777 ordinary passes; 11 expected failures; 12 skips |
| Angular | 77 passes |
| React | 240 passes; 3 skips |
| Vue | 107 passes |
| Solid | 175 passes |
| Runtime typecheck | Pass |
| Spec-types | Pass; existing baseline debt retained, no ratchet edits |
| Lint | Pass after kernel correction; 20 framework warnings retained |
| Five package builds / production demo | Pass |
| Packed consumer runtime identities, bundler and node16 types | Pass |
| Declaration documentation | Pass |
| Production/development bundle budgets | **Four failures** |

Lint warnings: eight existing Angular type-only fixture warnings plus three in each
framework's earlier new-key spec (unused describe and two non-null assertions).
The final kernel lint has no warning/error. Package builds still print existing
TS4111 diagnostics from research semantics-composition code; the dedicated runtime
and spec type gates pass. Build exit alone is not a clean-all-files type claim.

## Artifact costs and remaining limits

Fresh final measurements, cumulative new-key candidate (not attribution to this
single correction):

| Artifact | Measured gzip KB | Unchanged ceiling KB |
| --- | ---: | ---: |
| Bare production | 12.32 | 11.75 |
| Bare development | 14.71 | 14.10 |
| Entities production | 26.14 | 25.60 |
| Entities development | 28.91 | 28.40 |

Production demo initial: **565.36 kB**, estimated transfer **144.63 kB**. These are
fresh candidate figures, not a matched-baseline cost attribution. No CPU/heap
campaign or full release-gate registry was run. Artifact hashes are in manifest.json.
Do not infer release readiness from the semantic repair. Open K2 unseen descendants,
composed restoration, Link matrix diagnosis and scope decisions remain in the parent
inventory. B remains closed.

The supported failure evidence covers application getters/equality, later exceptions,
reentry and existing forced validation refusal with usable recovery. It does not
establish universal recovery from OOM, monkey-patched intrinsic Map/Set operations,
or arbitrary failures inserted into private registration code. Previously preserved
preparation/retention regressions remain passing under their unchanged fault models.

## Exact replay

From this dedicated worktree, with Node/pnpm above on PATH:

```sh
export NX_DAEMON=false
pnpm nx test kernel --testFile=src/lib/whole-value-new-keys.spec.ts --skip-nx-cache
pnpm nx run-many -t test --projects=kernel,angular,react,vue,solid --skip-nx-cache
pnpm run typecheck
node tools/check-spec-types.mjs
pnpm nx run-many -t lint --projects=kernel,angular,react,vue,solid --skip-nx-cache
pnpm run build:all
pnpm run build:demo:prod
node tools/check-bundle-budget.mjs
node tools/verify-consumer-typecheck.mjs
node tools/check-declaration-docs.mjs
```

The budget command must currently fail. Individual framework focused command:
`pnpm nx test <framework> --skip-nx-cache --args=whole-value-new-keys`.
Full logs and independent probe sources/bundles are in evidence.tar.xz with checksums.
No push, merge, tag or publication occurred.
