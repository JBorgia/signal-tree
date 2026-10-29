# Existing active-selection carrier capability: first results

2026-10-29, source75416029be1e0c1d9735ed3bdc0f4e8e6c02f775, no tracked/runtime edits. These are four new **private capability tests** with local raw backing; they are not current public selected-operation failures. Raw assignment bypasses ordinary setters intentionally. No app-owned computed freshness is required or tested.

## Exact executions

Pinned PATH=/private/tmp/link-membership-pinned-bin:$PATH, COREPACK_ENABLE_NETWORK=0, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false. Working directory `/private/tmp/link-authored-removal-successor`.

- `corepack pnpm nx test vue --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts`: exit1, one assertion red.
- `corepack pnpm nx test angular --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts`: exit1, one assertion red.
- `corepack pnpm nx test solid --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts`: exit0, one pass.
- `corepack pnpm nx test react --skip-nx-cache -- src/selected-active-id-preparation.spec.tsx`: exit0, one pass after filename discovery correction (unchanged test body).

First React command used .spec.ts, but project include accepts only .spec.tsx; zero tests executed. `REACT-FIRST.log` and original body preserved. Renaming only the new file corrected discovery; it did not change an assertion. Earlier preexecution React draft omitted required neutral factory argument; source inspection caught it before execution, archived REACT-DRAFT-BEFORE-EXECUTION.spec.ts. Corrected test imports existing NEUTRAL_OBSERVATION_ADAPTER. Framework Nx commands include their ordinary spec-type prerequisite; passing execution implies those completed for the named test source. No full suite/type gate was run.

## Observations

All prime writable + library-owned `.asReadonly()` toA. Native framework observer initially recordsA. Raw backing becomesB without advancing existing runtime epoch. Useful epoch publication is executed before the final assertion, so failures still include after-publication evidence.

| Runtime | Before invalidation direct writable | Before direct readonly | Observer before | After writable/readonly | Observer after | Capability verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Vue | B | A | [A] | B/B | [A,B] | immediate readonly freshness hypothesis fails |
| Angular | A | A | [A] | B/B | [A,B] | immediate writable and readonly freshness hypothesis fails |
| Solid | B | B | [A] | B/B | lastB | assertions pass |
| React neutral kernel runtime | B | B | [] | B/B | [B] | assertions pass |

Vue/Angular JSON observations are in their first logs. Solid/React project setup suppresses console; listed values are exact passing assertions, not fabricated stdout. React test is a neutral kernel-source subscription capability control in the React project, **not a rendered React observer test**. All observer disposers release in finally.

## Why

- Angular `packages/angular/src/lib/observation-adapter.ts:42–47` creates `linkedSignal(compute)` and peek uses untracked(cell). Primed linkedSignal retainsA until its tracked epoch dirties it.
- Vue writable projection computes directly (`vue-observation.ts:140–143`), but library `.asReadonly()` wraps a computed (34–47,61). Public activeId uses `.asReadonly()` (`entity-signal.ts:3503`). Therefore writable freshness alone is insufficient.
- Solid projection reads compute directly and readonly returns the same accessor (`solid-observation.ts:118–124`).
- Neutral createWritable reads source backing directly; source-owned raw write and binding.notify are separate existing primitives (`location-runtime.ts:412–448`).

## Contract interpretation and reuse route

This falsifies the hypothesis that an existing native writable projection universally exposes newly installed raw selection through **all direct handles before invalidation**. It does not establish a public requirement to expose raw values during a callback-free installation interval.

Approved selected-unit design installs all P/O/selection backing callback-free, then invalidates the complete unit before rich capture/user delivery. An existing raw+epoch projection can still be a feasible carrier if:

1. preparation/equality uses the source-owned raw value and revision, not cached framework peek;
2. raw selection installs with all rows while NO callback-capable preparation/observer execution remains;
3. selection epochs and row/collection invalidations run inside the existing complete selected invalidation group;
4. only then rich capture, notifier/tap delivery or other callbacks can observe the state;
5. every direct library handle and its readonly view reads the new selection after that invalidation, and reentry has no remaining older install.

The after-publication observations support the carrier part only, not the whole selected mechanism. A multi-collection invalidation group must prove synchronous observers cannot run between different carriers' publication or see old selection; this single-carrier test does not prove it. Equality/no-op/selection callback semantics and intrinsic-source observability remain separately checked against current createCell behavior. Do not add an adapter API merely to satisfy this stronger capability oracle.

Another existing route is source-owned raw backing plus locations.createWritable's returned binding and a delayed existing binding.notify/publish. Native writable-cell facades still cache until notify, so it has the same no-callback installation requirement. The native current activeId uses createCell's unobservable intrinsic source (`native-location-realization.ts:147–161`); createWritable defaults observable. Switching constructors must not silently change that deliberate behavior/cost. No route has been selected/implemented here.

## Actual public counterpart (inspection only; not executed)

- Vue `prepared-selection-publication.spec.ts:51–153`: transaction rekeysA→X/addsD; rollback onRemove callback authors selectionC/X/A, nested writes or throws; requires useful final state, callback once, terminal no-op retry, heldA identity, and **every delivered rollback snapshot coherent**. This is about delivered complete selection/rows, not primed app-owned computed freshness inside a group.
- Same file155+ covers cross-collection callback throw and callback-selected rightC while left/right rekeys restore.
- Vue `entity-selection-lifetime.spec.ts` covers selection/lifetime lifetime identity.
- Angular `entity-granular-reactivity.spec.ts:53+` requires activeEntity not reevaluate for unrelated row change and reevaluate for selected-row change.
- Solid `native-publication-error-boundary.spec.ts:296+` observes activeId/activeEntity together with direct/held rows in mixed restoration.

These unchanged controls must follow a prepared selected-unit implementation. Their existence is not a newly passing result.

## Source identity

BEFORE.json and FINAL-AFTER.json include all tracked/untracked TypeScript source hashes. Every non-test hash is identical; git tracked diff is empty. Only four new test files were created. Executed copies saved as {VUE,ANGULAR,SOLID,REACT}-EXECUTED.spec.*. BEFORE→FINAL test-file difference is only the documented React preexecution argument/discovery correction; loaded Vue/Angular/Solid files stayed unchanged. PREREG predates executions; first reds retained.
