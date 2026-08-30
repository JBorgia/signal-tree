# Post-RC1 migration workstream

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
REACT-REALIZATION-0
TRUCKTRAX-V2-REACT-MIGRATION-0
TRUCKTRAX-V3-MIGRATION-WEDGE-0
V15-MIGRATION-DOCS-0
LLMS-GUIDANCE-0
```

These share evidence but have separate verdicts. React may join RC2/GA only if
the real v2 slice closes cleanly. It may remain post-GA without holding v15.

## REACT-REALIZATION-0

Frozen property:

> React observes SignalTree truth; React does not become another state
> authority.

### Outcomes

```text
R-A  Existing public kernel observation is sufficient.
     React owns hooks, lifecycle, and optional context ergonomics.
     No carrier, state mirror, duplicate tree, or kernel public change.

R-B  React concurrency requires one missing neutral observation fact.
     Stop, demonstrate the exact failure, and request the smallest explicit
     kernel freeze exception. Migration convenience is not evidence.

R-C  Correct React support requires duplicate state authority or broad kernel
     redesign. Reject the design.
```

React's reference model is `useSyncExternalStore`: one `getSnapshot`, one
subscription, stable snapshots, and lifecycle-owned cleanup. Copying values into
`useState` is excluded.

Required controls: StrictMode, cleanup, unmount/remount, multiple observers,
held references, entity deletion/reactivation, derived reads, stable snapshots,
and no tearing. React Native compatibility is a separate runtime result, not a
compile-time inference. SSR is opened only by a real consumer requirement.

### Discriminator result: R-B

The frozen public kernel contract is insufficient for React observation, but
the missing capability is narrower than a subscribable cell. React needs a
public, owner-associated invalidation source that fires after coherent
publication and returns cleanup. The adapter can pair that with synchronous
tree reads and selector equality; per-location subscription is not required.

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
     external-store contract without copied state; unrelated publications cause
     snapshot rechecks, not necessarily renders.

Pinned by `packages/kernel/src/react-observation-contract.typing.spec.ts`: a
public neutral cell is readable, but neither it nor its owner exposes a public
change subscription. `packages/kernel/src/lib/react-link-observation-discriminator.spec.ts`
proves that `link()` cannot substitute for observation.

No React package is implemented until one narrow freeze exception is authorized:
a neutral owner-level invalidation fact sufficient to observe a tree without
exposing path-notifier internals, causal metadata, or a second reactive graph.
The exception must be tested against React lifecycle/concurrency behavior and
must remain framework-neutral. Per-location subscription, convenience APIs,
context, and hook names remain unopened.

## TruckTrax v2 wedge: Route History

The dirty primary checkout is excluded. Migration work lives in the clean
`migration/signaltree-react-route-history` worktree at `e704f8e78d`.

The bounded workflow contains:

- server-loaded ordered `RouteDto` entities;
- selected route IDs and hovered route state;
- seven reading components across panel, table, map, and markers;
- async request and client-side ownership annotation/filtering;
- derived selection, marker, legend, and visibility projections.

The first experiment keeps Redux authoritative and tees only the actually
dispatched route-history actions into a shadow SignalTree. It must not issue a
second request or pull product-line, socket, persistence, auth, or global-reset
state into the boundary.

Measure projection parity, notifications, React commits, recomputations,
referential stability, network count, cleanup after unmount, files/LOC touched,
selectors/actions/reducers removed, test complexity, adapter API required, and
kernel changes required.

Reject the slice if route order/selection/hover/markers diverge, SignalTree
causes more commits for selection or hover, null/empty distinctions are lost,
subscriptions survive unmount, or unrelated state must enter the boundary.

## TruckTrax v3 wedge: ScaleTrax V3 Edge catalogs

Work lives on `migration/signaltree-v15-v3edge-catalog` at `d3d9dfd04`.

Migrate only scales and transports from
`entityMap({ load: loader(...) })` into a side-by-side v15 catalog store:

| Legacy concept                         | Actual job                        | v15 disposition                 | Owner                 |
| -------------------------------------- | --------------------------------- | ------------------------------- | --------------------- |
| `entityMap`                            | keyed identity and reconciliation | plain `entityMap()`             | SignalTree            |
| `loader`                               | request/cache orchestration       | ordinary RxJS/controller        | application           |
| loader status                          | pending/error/freshness           | ordinary state and `computed()` | application           |
| `staleTime`, SWR, force, single-flight | acquisition policy                | local catalog store             | application           |
| successful GET                         | authoritative rows                | `external(() => setAll(rows))`  | boundary + SignalTree |
| `derivedFrom` aggregate                | cross-domain read                 | local `computed()` composition  | application           |

Preserve the existing `loadScales$(force?)` and `loadTransports$(force?)`
facades, 30-minute freshness, single-flight, forced refresh, existing rows on
failure, error model, case-insensitive lookup, and record IDs. Capture,
net-weight, printing, and all frontend weight behavior are out of scope.

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
