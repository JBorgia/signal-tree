# Bounded correction mechanism review

**GO for bounded implementation and focused falsification, not acceptance.** Shared wrapper invalidation plus effective-absence comparison addresses both layers of the reproduced defect. No new state authority, graph or epoch is needed. No runtime changes or correction tests were performed in this review.

Baseline: exact C10 promoted manifest SHA-256 `de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4`. Prior executable evidence: `/private/tmp/st-absent-collection-introduction/REVIEW.md` and its raw runs. Exact C8a passes the unchanged ordinary re-add test; parent proof and C10 fail. This verdict does not infer final totals from Main's incomplete broad run.

## Minimal seams

1. **Membership installation:** extend the existing changed-presence invalidation at `packages/kernel/src/lib/internals/member-membership.ts:999–1011`. After authoritative descriptors/ordinary records install and before completion callbacks, invalidate affected retained materialized wrappers through existing `markSnapshotInstalled`. Recurse only ordinary node accessor state descriptors. Mark a presence-aware marker's own wrapper and stop there. Do not invoke a marker snapshot, notification hook, getter, predicate or comparer during invalidation.

   Prefer the existing shared `MEMBERSHIP_CHANGED` / `membershipHook` metadata (same file, lines 216–228), already used by `linkDescendants` to recognize presence-aware opaque collections. This identifies participation without an EntityMap-specific guard. Merely test the metadata; **do not call the hook**, which performs native invalidation. Existing processor metadata can identify a marker boundary if needed; do not classify by user data or scan marker properties. `materialize-markers.ts` already imports membership, so avoid an unnecessary eager reverse dependency just to read its stamp. A missing materialized record is a no-op, not a reason to instantiate a wrapper or a new registration graph.

2. **EntityMap projection cache:** extend `createVersionedProjection` in `packages/kernel/src/lib/entity-signal.ts:444–464` with the effective-absence value from existing `isAbsentMember` semantics as another cache-key component alongside version/install revision. Read it on every current read, including warmed held readers; keep the existing `version()` observation dependency. Do not use ordinary-presence overrides or physical-row restoration windows as the public projection's absence authority. Apply at this factory, covering all/count/ids/map/has/where/find rather than adding caller fixes.

Both are necessary: wrapper invalidation alone can rebuild through a pre-presence projection cache; projection freshness alone cannot invalidate a wrapper already accepted at its generation. The known empty wrapper was cached by ordinary membership preparation while the ancestor was still absent, then reused after reactivation.

## Rules and limits

- **Cold wrappers:** no cache exists to invalidate; first demand must build current state using the presence-aware projection. A previously held projection can be warm even when the wrapper is cold, so wrapper coldness must not exempt the projection check.
- **Identity:** keep invalidation inside genuine installed changes. An unrelated write, repeated omission, refused write or unchanged effective absence must not acquire a fresh cache merely because a current read occurred. A descendant still hidden by another omitted edge has no effective-presence change. Preserve unrelated marker identity and existing no-op assertions. Presence changes themselves are real semantic changes even when physical rows are unchanged.
- **Timing:** generation invalidation and reading `isAbsentMember` publish nothing. Keep native notifications at the existing membership wake boundary. A SignalTree reader can become current before delivery while an app-created native computed retains its prior value until ordinary notification. Do not repair this by invoking `MEMBERSHIP_CHANGED` early.
- **Traversal/cycles:** use own data descriptors of ordinary state nodes, not arbitrary marker payloads or accessor getters. Stop at opaque markers and terminal data, including cyclic payloads. If the walk can revisit accessor identities, use an operation-local visited set keyed by existing node identity; this is traversal protection, not a retained second graph. Do not follow metadata back-references as state children or expand support for malformed private ancestry.
- **Callback reentry:** capture the absence discriminator before `compute()`, not only afterward. Do not label a result built under one presence state as belonging to a newer state installed by its predicate/comparer. Preserve the existing first result/error and do not retry user callbacks. The added discriminator must not independently introduce such cache poisoning. Existing broader sort/reentry limitations remain outside this correction; no universal custom-callback guarantee is requested.

No concrete impossibility or mechanism blocker found with these rules. Existing helper-level `empty`/`activeEntity` derived readers are not automatically converted into source-current projections by this change; do not claim or implement that broader behavior here.

## Focused controls for implementation

- Replay unchanged `absent-collection.spec.ts` first ordinary failure, then that file's omission/re-add and restoration/rollback cases; replay React's absent-collection file. Keep jump-undo-equivalence attribution separate.
- Add a pre-notification read at the existing supported membership completion seam, after authoritative presence installation: warm empty collection projection and wrapper before re-add, require direct collection and parent snapshot to contain Z, and require warmed native computed to remain old until delivery. Cover direct collection omission and omission of its ancestor, plus cold-wrapper/held-projection order.
- Retain parent-freshness EntityMap early/post-delivery identity and subsequent-dependency controls, marker snapshot memo identity, and no-op/refused-write controls. Include a descendant still hidden by an independently omitted edge so the effective-absence discriminator does not churn on a non-change.
- A marker with opaque cyclic data or a throwing property getter must not have that payload/getter traversed during presence invalidation. A bounded reentrant predicate/comparer must not be automatically invoked twice or have its exception replaced. Compare against preserved baseline limitations.
- Run affected source/spec types after implementation. No full suite or CPU/allocation claim is needed to decide whether this bounded correction fixes the causal boundary.

These are proposed falsifiers, **not run results for a correction**. This report is source review against the already executed reproduction and cache-assignment trace. Main owns implementation and final acceptance.
