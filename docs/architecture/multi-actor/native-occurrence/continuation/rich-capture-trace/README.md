# Rich committed capture crosses the mixed installation boundary

Read-only causal/contract review of SNAPSHOT-A, 2026-10-29. No runtime changes. All original fixtures and source trees preserved. Test-only trace lives in a verified disposable copy; Main owns correction/disposition.

## Decisive observation

The unchanged fixture `packages/kernel/src/lib/internals/causal-runtime/committed-entity-selected-unit.spec.ts` fails on both `/private/tmp/st-current-read-integration/candidate` (baseline) and `/private/tmp/st-native-combined-successor/candidate` (current SNAPSHOT-A). Each isolated Nx command runs exactly one test and exits1. The observed left collection is restored, but right still reads 50/60 instead of 11/12. This matches the preserved broad failure at `/private/tmp/st-current-read-integration/runs/combined-full/first.log:2165`.

The separate test-only trace preserves all original assertions and only appends callback stack/images and the post-undo image. `current/trace.jsonl` establishes:

1. Callback: left=[{id:a,n:1}], right=[{id:a,n:50},{id:b,n:60}].
2. Callback writes right.a.n=777.
3. After undo: left remains restored; right=[{id:a,n:11},{id:b,n:12}]. The newer nested write was overwritten by the already prepared inverse.

The original first assertion stops before its final 777 assertion. The trace makes that later outcome observable without replacing or softening the original oracle. Instrumented and unchanged runs fail at the same observed-image assertion. No production87f equivalence is claimed by this comparison; baseline here is the exact current-read integration source requested for this failure.

## Exact dynamic route

Captured stack, from callback toward caller (full stack in JSONL):

- rich-capture-trace.spec.ts callback
- mutation-capture-runtime.ts:171 `publishCommittedEntity`
- entity-signal.ts:2408 committed observer closure
- entity-signal.ts:1416 callback passed to EntityMutationFrame.commit
- physical/entity-mutation-frame.ts:399 `observeCommitted`
- entity-signal.ts:1415 `frame.commit`
- entity-signal.ts:2504 `planRestore.commit`
- internals/causal-runtime/tree-realization-adapter.ts:1523 heterogeneous `install`, placement-plan commit

This proves the route is the heterogeneous mixed installer, not per-effect fallback or the bounded point-only selected installer. Delivery is **too early inside installation**, not late after completion. The outer invalidation/membership holds do not hold this direct synchronous listener loop.

## Source sequence and first divergent boundary

All line references below are in SNAPSHOT-A's `packages/kernel/src`.

1. `enhancers/restoration/restoration.ts:3303,3364` prepares ordinary effects, validates that exact paired array, and calls applyAtomically under restoration origin. The ordinary/physical paired route is used. It does not mean the point-only selected producer is used.
2. `lib/internals/causal-runtime/tree-realization-adapter.ts:715-723` limits admitSelectedOperation to operations with no structural/order/frontier requirement. This inverse restores left membership, so that bounded producer cannot own it. The complete existing heterogeneous route is the intended owner; routing the structural inverse into the point-only lane is not a valid repair.
3. `planHeterogeneousFrame:1006` resolves structural plans and existing subject field edits. Right's two values are existing entity lifetimes, gathered in liveRows at1123 onward and prepared through `__preparePointValues` at1185-1186. They are not ordinary scalar slots merely because they are scalar-valued fields.
4. Heterogeneous install: scalar-slot frame commit at1508 if present, removals, structural placements/restores at1522-1523, remaining rekeys, **livePointPlans.install at1529**, ordinaryPlans.install at1530, then physical clock advance. For this case the left restore precedes both right point installs.
5. `entity-signal.ts:2500-2509`: planRestore.commit constructs a source frame and calls commitAndProjectEntityMutationFrame. Its separate publish method is for notifier/onAdd delivery; rich capture is not deferred to that method.
6. `entity-signal.ts:1370-1407`: the source prepares ordinary/physical publication, selected field responsibility, revision validation and a committed observer closure, then finalizes publication. At1415 it calls frame.commit. The installOrdinary closure at1419-1423 installs this source's ordinary plan and terminal record.
7. `physical/entity-mutation-frame.ts:394-399`: after local physical writes, it calls installOrdinary, installs supplied responsibility if any, then immediately calls observeCommitted. This is complete **for that entity frame**, but not for the surrounding heterogeneous operation. The left source's installed record is visible; right transitions and right terminal records are still uninstalled. This is the first demonstrated mixed-unit divergence.
8. Only after that callback returns does the left commit complete publication (`entity-signal.ts:1429` onward), invalidate/sync, and return to the heterogeneous loop. The loop installs right's already prepared transitions. `preparePointValues:590-597` writes the transition and terminal record during install. This explains the overwrite of nested777 with11.
9. Outer invalidate/publish (`adapter:1533-1640`) happens after installation: right completes publication/epochs/signals, scalar notifications if any, structural notifier/taps, then right notifier/taps. That later phase cannot repair a rich callback already delivered during step7.

No outer-scalar authored-write hypothesis is required: these right effects enter live entity point plans. This trace does not adjudicate separate scalar-frame author-work defects.

## Capture authority versus diagnostic subscription

The fixture imports a private runtime, explicitly activates capture, and attaches an arbitrary callback. It is an internal observer test, not a public subscribe/onAdd API example. However the channel is not diagnostic-only:

- `lib/internals/mutation-capture-runtime.ts:147-182` synchronously calls entity listeners (and structural-boundary listeners when applicable). It contains individual errors because committed truth cannot be unapplied and admission observers must not starve each other.
- `enhancers/transactions/transactions.ts:2256` uses subscribeCommittedEntity for transient open-bucket entity footprints, covering the interval after storage and before notifier capture. It filters restoration/rollback/inspection/realized captures; do not infer that this exact restoration callback updates a transaction bucket.
- `enhancers/restoration/restoration.ts:4604-4650` installs committed-capture plus enqueue witnesses for pending foreign transaction footprints. These are admission evidence consumers, although the fixture has no foreign transaction and does not establish their particular trigger.
- The newer authority path is distinct: `prepareEntityResponsibility` (`transactions.ts:2378`), supplied by prepareEntityPublication (`entity-signal.ts:2295`), is invoked during source evidence preparation (`experimental-publication/entity.ts:75`). Its record is combined with the publication record at175, then installed by the source **before** rich callback delivery. Preserving this ordering is load-bearing. In this fixture there is only restoration, so a transaction responsibility callback need not even be installed.

Therefore “queue all authority until after effects” is not a sound correction. Prepared responsibility must remain part of installation, not be reconstructed by delayed diagnostics. Existing rich admission consumers also cannot simply lose their pre-notifier witness without replacement/disposition.

## Bounded correction requirements for Main's design review

No patch is proposed as already qualified. The required boundary is shared-unit completion:

- Prepare each source's immutable physical/ordinary payload, exact selected support, and responsibility contributions before any selected install. Keep callback-bearing source preparation/revision validation out of a partially installed unit.
- Install all source storage, ordinary transitions and prepared terminal responsibility without invoking rich listeners, completion callbacks or invalidation delivery between sources.
- Once the whole unit is installed, complete/invalidate/deliver under the chosen shared boundary so an internal callback reading either source sees the complete inverse and its nested write cannot be overwritten by pending installation.
- Retain capture payloads from the completed source operations. Do not re-read mutable physical rows when draining callbacks or queue native responsibility installation behind them. Preserve observer-error isolation and later deliveries.
- Include the direct rich/structural-boundary channel and source publication completion in the audit; holding only PathNotifier or membership delivery is insufficient. Source frames currently perform preparation and completion inside commit, so merely renaming the existing commit as install does not prove this separation.

The observed assertion constrains internal observer atomicity. Public operations create the mixed inverse (undoable left removal plus two right field writes, then undo), but the demonstrated trigger for reading/writing mid-install is private subscribeCommittedEntity. Existing public onAdd/onUpdate callbacks occur in the later publish path by inspection; this run does not establish a public onAdd half-state, foreign-owner theft, or a new public capture API requirement. The nested write inherits restoration execution context; physical loss of777 is observed, but broader owner/transaction authority conclusions require their own controls.

## Evidence and limits

- `current/runs/unchanged`, `baseline/runs/unchanged`: exact fixture, exit1, one failure each.
- `current/runs/trace`: added trace fixture only, exit1, same oracle failure; raw trace.jsonl includes final state.
- Commands through Nx: `corepack pnpm nx test kernel --skip-nx-cache committed-entity-selected-unit.spec.ts --reporter=verbose --maxWorkers=1`; trace substitutes rich-capture-trace.spec.ts. Node24.15.0/pnpm10.17.0, existing dependency link, no timeout increases. Per-run COMMAND/RESULT/first.log retained.
- IDENTITY.json verifies every original source file and copied original file unchanged, fixture hashes, and exact SNAPSHOT-A agreement. Only an added diagnostic test differs in the current disposable copy. No runtime/test edits to source candidates; original fixture unchanged even in copies.
- No broad runs, performance, retention or acceptance claims. This is a bounded causal trace for Main's coordinated correction.
