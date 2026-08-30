# Post-RC1 target-state workstream

**Evidence bases**

```text
SignalTree      6c511755  post-RC1 development ancestry
RC1 candidate   4020b7dd  immutable artifact authority
TruckTrax v2    e704f8e78d
TruckTrax v3    d3d9dfd04
```

RC1 remains `@signal-tree/kernel` plus `@signal-tree/angular`. This workstream
does not rebuild, retag, or reinterpret RC1.

## Coordinated questions

```text
REACT-GREENFIELD-0
REACT-OBSERVATION-0
GREENFIELD-APPLICATION-PATTERNS-0
TRUCKTRAX-V2-REACT-MIGRATION-0
TRUCKTRAX-V3-MIGRATION-WEDGE-0
V15-MIGRATION-DOCS-0
LLMS-GUIDANCE-0
```

These share evidence but have separate verdicts. Their order is binding:

```text
greenfield architecture
  -> independent reference implementation
  -> target contract freeze
  -> migration toward the target
  -> documentation of what legacy ownership must change
```

Migration pressure may reveal a missing property, but it never determines the
replacement architecture. TruckTrax v2 and v3 are evidence and validation, not
design authorities. React may remain post-GA without holding v15.

## REACT-GREENFIELD-0

Frozen property:

> React observes SignalTree truth; React does not become another state
> authority.

Question:

> What is the smallest, best long-term React realization of SignalTree if React
> support is designed today with no legacy consumer?

TruckTrax dependencies, Redux idioms, migration diff size, and React Native use
in an existing application are forbidden design premises. They may later
falsify the frozen result.

### Greenfield reference application

The package contract must be earned by a new React application that exercises:

- `signalTree(initialState, { derived, enhancers })`;
- scalar, nested, entity-map, and derived reads;
- writes and coherent multi-location transactions;
- retained entity references across deletion and reactivation;
- observations shared by multiple components;
- StrictMode mount, unmount, and remount;
- subscription cleanup and adversarial render/update ordering;
- stable snapshots with no tearing, mirrored state, or duplicate reactive graph.

React Native is a second greenfield realization test only if the resulting
adapter has no DOM dependency. Existing React Native usage is not evidence for
the package design.

## REACT-OBSERVATION-0

Property:

> A greenfield React application can observe one SignalTree owner through
> coherent publication invalidation while continuing to read canonical
> SignalTree values synchronously.

### Outcomes

```text
R-A  Existing public kernel capabilities are sufficient.

R-B  One neutral owner invalidation fact is genuinely missing.

R-C  Correct React support requires a larger mechanism.
```

React's reference model is `useSyncExternalStore`: one `getSnapshot`, one
subscription, stable snapshots, and lifecycle-owned cleanup. Copying values into
`useState` is excluded.

Required controls: StrictMode, cleanup, unmount/remount, multiple observers,
held references, entity deletion/reactivation, derived reads, stable snapshots,
and no tearing. React Native compatibility is a separate runtime result, not a
compile-time inference. SSR is opened only by a real consumer requirement.

### Greenfield reference result

`apps/react-reference` is a new React 19 application with no TruckTrax, Redux,
RxJS, or React Native premise. Its local `useSignalTree` is a proof surface, not
a proposed package API.

Candidate A was falsified. With the pre-exception public kernel capabilities,
the app could read current values but could not be notified after a write.

The app-local owner-invalidation proof passes:

- scalar, nested, entity-map, and selected entity reads;
- direct writes and bulk upserts;
- five observations sharing one owner source;
- StrictMode cleanup, unmount, and remount;
- a coherent multi-location transaction with no mixed render;
- retained entity identity across removal and same-key successor creation;
- same-address writes from two owners without cross-owner loss.

One pre-implementation characterization was decisive: `setActiveId()` changed
the canonical public read while the mounted React view and invalidation count
remained unchanged. Therefore the semantic seam could not be a public alias for
`PathNotifier`; it had to cover every owner change that can alter a public
synchronous read.

Candidate B is established and implemented for the observation row only:

> An adapter can subscribe to invalidation of one owner's externally readable
> truth. One or more coherent public changes produce at least one later
> invalidation instructing the adapter to reread canonical state.

`observeOwnerInvalidation(owner, callback)` now exposes that fact only from
`@signal-tree/kernel/adapter`. Its callback carries no value, path, causal
metadata, selector, React type, or compatibility policy. Demand activation is
shared per owner, last cleanup returns observation to dormancy, destruction is
terminal, and subscribing after destruction cannot reactivate it.

The callback is invalidation, not an event. Multiple changes may coalesce;
callback count has no mutation, transaction, publication, or causal meaning.
The transaction and commit machinery remains coherence authority. The
invalidation scheduler only marks an owner dirty and later asks adapters to
reread canonical truth.

The no-subscriber cost control used the existing production-substrate report at
the pushed `72da5f2a` baseline and the implementation, three runs each. Median
compiled-write deltas across 10 to 100,000 positions were `+1.4%`, `-2.6%`,
`+14.0%`, `+16.3%`, and `+5.1%`. The existing harness records `+77%` to `+190%`
sequential A/A variance. Existing EntityMap mutation rows ranged from `-48.0%`
to `+37.5%`, with no consistent direction or scaling trend. No meaningful
steady-state tax is established. An initial always-allocated registry measured
worse and was replaced by a registry that does not exist until first demand.

After the invalidation rename and separate membership controls, one final run
of the same existing workload measured `-7.7%`, `+6.3%`, `+1.8%`, `+5.9%`, and
`+3.1%` against the three-run baseline medians. The unused capability remains
inside the established noise envelope with no directional tax.

The React reference now consumes only this adapter primitive. It does not
define or freeze a React hook. Selector-result caching is observational
memoization, not a writable state authority, but changing-selector and
abandoned-render controls remain required before a hook contract can freeze.

The alternatives were tested separately:

- generic Observable-to-`useState` hooks create a lagging second read authority;
- `BehaviorSubject` supplies a current value but not derived dependency or
  SignalTree transaction semantics by itself;
- an adapter-installed reactive runtime is process-global, cannot retrofit a
  preexisting neutral tree, conflicts with Angular realization, and can notify
  during physical writes before a semantic transaction is coherent;
- public `link()` activates dormant observation, but it is external-authority
  synchronization: it deliberately suppresses inspection writes and rejects
  configured readonly derived cells;
- owner-wide coherent invalidation plus direct selector reads satisfies React's
  external-store contract in principle without copied state; unrelated
  publications cause snapshot rechecks, not necessarily renders.

Pinned by `packages/kernel/src/react-observation-contract.typing.spec.ts`: cells
and tree roots still expose no subscription API; only the adapter SDK exposes
owner invalidation. `packages/kernel/src/lib/owner-invalidation.spec.ts` freezes
the semantic law, and `packages/kernel/src/lib/react-link-observation-discriminator.spec.ts`
retains the negative proof that `link()` cannot substitute for observation.

Any proposed adapter export must be framework-neutral, express a semantic fact
already owned by the kernel, be required by a correct realization, and be
neither application convenience nor compatibility machinery. Per-location
subscription, paths, causal metadata, compatibility APIs, context ergonomics,
and hook names remain unopened.

### REACT-GREENFIELD-0 remains open

Observation is not the whole realization. Passing characterizations in the
reference app pin two separate neutral-runtime facts:

1. repeated `tree()` reads allocate new snapshots without an installed
   realization, so the whole owner cannot directly be React's cached snapshot;
2. a callable returned from `config.derived` is dropped with ST2007 because
   derived admission recognizes only a globally installed framework runtime.

The first can plausibly remain adapter-owned selector memoization and does not
yet justify a kernel change. The second blocks the required greenfield
`config.derived` workflow.

The strongest current derived candidate treats callable terminals in the
explicit derived factory as computation recipes, then realizes each recipe
through a construction-bound realization bundle. The neutral factory would
produce current-on-read cells; framework-bound factories could produce truthful
native carriers. This avoids function-as-state ambiguity because initial state,
not `config.derived`, owns persistent functions.

That candidate also implies replacing process-global realization selection with
construction-bound ownership across cells, derived values, marker snapshots,
scalar leaves, and tracking suppression. It is a larger architecture decision,
not a React convenience and not authorized here. `@signal-tree/react` remains
unfrozen until this row is adversarially closed.

## CONSTRUCTION-BOUND-REALIZATION-0

Property:

> The realization used to materialize one SignalTree is determined at
> construction and remains bound to that tree; realization selection is not
> mutable process-global state.

Pre-registered outcomes:

```text
CBR-A — expected

signalTree construction can receive or bind one immutable realization bundle.
kernel construction binds neutral realization.
Angular construction binds Angular realization.
React construction binds React realization.

Multiple realization families coexist in one process. Existing trees cannot
change realization because another package loads.

-> adopt

CBR-B

A smaller construction-owned mechanism satisfies the same law without an
explicit realization-bundle public concept.

-> adopt the smaller mechanism

CBR-C

Correct construction ownership requires substantial new public framework
machinery or duplicated state authority.

-> stop and report
```

Do not assume public spelling. A package-owned factory bound to its realization
is preferable to application configuration such as `{ runtime }`. Reassess the
global installer family as one system; preserve no installer merely because it
already exists.

Current status:

```text
OWNER-INVALIDATION-0                CLOSED GREEN — cb2a276f
CONSTRUCTION-BOUND-REALIZATION-0    OPEN NEXT
@signal-tree/react                  BLOCKED
TruckTrax v2 migration              BLOCKED
TruckTrax v3 migration              BLOCKED
React Native                        BLOCKED
```

## GREENFIELD-APPLICATION-PATTERNS-0

Before v3 migration, establish canonical greenfield v15 application patterns
for async/server acquisition, forms, persistence, and derived state. Determine
ownership from the needs of a new consequential application, not from v3's
current loader, status, storage, or forms APIs. Validate each pattern outside
v3 before it can become a migration target.

## TruckTrax v2 wedge: Route History

**Blocked until `@signal-tree/react` is architecturally closed and its contract
is frozen from greenfield evidence.** The dirty primary checkout remains
excluded. Migration work, when opened, belongs in the clean
`migration/signaltree-react-route-history` worktree at `e704f8e78d`.

The bounded workflow contains:

- server-loaded ordered `RouteDto` entities;
- selected route IDs and hovered route state;
- seven reading components across panel, table, map, and markers;
- async request and client-side ownership annotation/filtering;
- derived selection, marker, legend, and visibility projections.

The migration asks how much work is required to move this workflow to the
already-correct SignalTree architecture. It does not preserve Redux ownership,
tee actions into a shadow tree, or introduce Redux adapters. A large rewrite is
acceptable when the old architecture is wrong.

Measure projection parity, React commits, recomputations, referential stability,
network count, cleanup after unmount, files/LOC touched, selectors/actions/
reducers removed, and test complexity. Migration pain is documented as evidence;
it does not reopen compatibility APIs.

Reject the slice if route order/selection/hover/markers diverge, SignalTree
causes more commits for selection or hover, null/empty distinctions are lost,
subscriptions survive unmount, or unrelated state must enter the boundary.

## TruckTrax v3 wedge: ScaleTrax V3 Edge catalogs

**Blocked until `GREENFIELD-APPLICATION-PATTERNS-0` establishes the target.**
Work, when opened, lives on `migration/signaltree-v15-v3edge-catalog` at
`d3d9dfd04`.

The scales and transports slice is retained as later migration evidence. Its
current concepts are questions, not presumed v15 counterparts:

| Legacy concept                         | Actual job                        |
| -------------------------------------- | --------------------------------- |
| `entityMap`                            | keyed identity and reconciliation |
| `loader`                               | request and cache orchestration   |
| loader status                          | pending, error, and freshness     |
| `staleTime`, SWR, force, single-flight | acquisition policy                |
| successful GET                         | adoption of authoritative rows    |
| `derivedFrom` aggregate                | cross-domain derived read         |

The result must look like a domain slice worth showing as a brand-new v15
application. Concepts may move or disappear. The migration record compares
before and after and explains why; it does not optimize for minimal churn.
Capture, net-weight, printing, and all frontend weight behavior remain out of
scope.

Stop if v13/v15 cannot coexist, edits escape ScaleTrax, stale responses can
overwrite newer truth, failure drops rows, UI loading/error behavior changes,
or certified-weight behavior must move.

## Continuous decision record

Every migration decision is recorded when made:

```yaml
legacy_pattern:
actual_job:
old_owner:
v15_owner:
replacement:
why:
files_touched:
behavioral_proof:
common_wrong_migration:
```

These records feed the migration, implementation, and agent guidance. They are
not reconstructed after the code lands.
