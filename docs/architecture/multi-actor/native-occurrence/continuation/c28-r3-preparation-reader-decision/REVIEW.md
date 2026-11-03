# Preparation reader decision — bounded premise

**Choose a collection-owned private preparation reader that retains primitive dependency reads; do not use the existing raw handle hook directly.** This is the smallest concrete replacement worth implementing, conditional on the three discriminators below. Retaining the facade remains the correct fallback if they fail. No runtime edits, executions, OOM or performance claims here; no additional owner approval is inferred for a semantics-preserving implementation.

Identity: retained composition `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333`, `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate`. Read both prior premise reviews, all twelve saved baseline fixtures/results, review/contributor contracts and scoped protocol. Their **11 passes/1 preserved route-oracle failure** concern predecessor baseline 2a020da7; they are reusable fixtures/evidence, not fresh passes on an optimization.

## Exact mechanism and alternatives

Retaining `byIdOrFail(key)()` preserves incidental facade construction, metadata and native reads automatically. A bare `backingForSubject(effect.subjectId)` loses key/lifetime acquisition, visibility, dependencies and refusal behavior; reject it. The existing `__acquireEntityHandleForTesting`/`__resolveEntityHandleForTesting` pair supplies lifetime machinery, **not** a complete production read contract. Reuse their underlying StructuralStore/resolver implementation inside the collection, not their testing-property names in the adapter.

Add one internal module, e.g. `internals/entity-preparation-reader.ts`: module-private Symbol, `defineEntityPreparationReader(node, reader)` and `getEntityPreparationReader(node): ((key: string|number) => unknown) | undefined`. Register a collection-closure callback nonenumerably on `api`; its symbol forwards through the existing proxy, following `entity-membership-source.ts`/`entity-projection-seed.ts`. No public barrel, SDK, EntitySignal type, publication-permission field or new state authority. Do not overload projection-seed enumeration or publication binding with physical reads.

Only `snapshotCollectionEntityValue` changes dispatch: if capability exists, call it; otherwise execute the **exact** existing receiver-preserving `collection.byIdOrFail(key)` and callable-or-value fallback. Undefined *result* is not missing capability; a capability exception never triggers fallback.

Inside the reader, mirror the existing lookup/read phases using collection primitives:

1. `rowAbsent()` and active-key gate; on initial absence touch `idsSignal()` and throw existing `Entity with id … not found`. Preserve initial missing-backing refusal.
2. Preserve the initial `readEntityByKey(key)`/subject-epoch read. Acquire the key's current lifetime where facade acquisition currently occurs, not before callback-capable native initialization; retain any required collection owner initialization.
3. Read the same `getSubjectStateSignal(subject)` activation carrier, resolve that acquired handle's current lifetime/key, then use `readEntityByKey(currentKey)` (including epoch and visibility read). Follow rekey; never retarget through the originally requested key after acquisition. Preserve post-acquisition inactive/undefined outcomes rather than converting every outcome into a new exception. No acquiredRevision-equals-current rejection.

This deliberately retains epoch/activation work; it removes row/field facade creation, not all native activity. No payload enumeration, clone, cached snapshot, hidden-window opening or publication input scope belongs inside it. Native initialization may reenter; unchanged preparation guards remain essential.

## Four existing callsites: leave surrounding behavior intact

Paths below are `packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts`.

| Call | Required surrounding contract |
| --- | --- |
| :1016 direct point | Subject→live key resolution and early declines; clone once per staged subject; separate cloned effect payload; existing scalar/frame/clock refusal and install guards. |
| :1274 heterogeneous live point | Same physical payload/clone rule within existing prepared topology and joint validation; no switch to ordinary inspection baseline. |
| :2414 placement rekey | Read `effect.before` only in the existing placement/no-prepared-subject branch; retain callsite deepClone and prepared lifetime/order handling. |
| :2461 removal | Use existing effective remove key; retain uncloned live reference, existing undefined branch and `rememberRemovedSubject` prepared-value preference. |

Visibility is collection-owned `entity-signal.ts:515`: only matching position registry **and tap depth** can read hidden physical rows. Preserve current installed backing before notifications. Do not move `canApplyEffect`, publication sealing, installation, invalidation or error cleanup. Clone/getter errors and genuine supported reentry remain observable; fixed getter counts and facade-factory invocation counts are not newly imposed contracts.

## Cold metadata: what source establishes, what it does not

Correction to the proposed premise: `createEntityNode/bindLocation` (:3562–3636) attaches per-field bindings, but **not distinct per-field PositionIds**. Fields share the collection owner from `getPositionIds()` (:1920); this can lazily allocate/register that owner. Preserve that owner obligation separately if needed. Bindings attach registry, collection owner/subject/field, publication source/selected-write continuation, mutation runtime and field metadata to the newly created locations.

Point preparation (:654–743) uses subject/key/value transitions and the collection publication source directly; it does not consume the just-created field facades. Location bindings are consumed when actual locations are later used, including Link/selected writes. This supports separating payload reading from construction, but **does not prove absence of indirect capture/inspection reliance for cold rows**. Do not manufacture dummy fields/publication bindings to imitate construction; falsify reliance with useful state/capture results.

## Only missing discriminators to settle

1. **Cold capture/inspection + native dependencies.** Start with collection-level writes and no `byId`/held field. Reuse case 1's reached cold snapshot route; record populated pending inspection/capture, undo/redo outputs and later useful writes/publication. Compare before/after owner/subject/field identities and pending-owner holds; only afterward materialize row/field and verify selected writes/Link behavior. Record physical inventory `nodeFacadeMaterialized`/`fieldFacadesMaterialized` around the actual read. Inventory itself calls `getPositionIds`: pre-establish the owner deliberately, and separately check lazy-owner behavior so instrumentation cannot hide it. Pair old read/new capability in the real native tracking realization: value change, rekey, disappearance and restoration must invalidate useful reads. Existing case 2 tests held-field liveness, not preparation dependency equivalence; no allocation inference from it.
2. **Capability-specific boundaries.** Adapt case 4 to invoke the capability under same-tree/same-depth, nested-depth, foreign-tree and closed-window conditions. Reuse existing handle rekey/ABA/incarnation controls. Exercise a genuinely capability-absent structural collection double (case 6 currently overrides a real collection and will acquire the new capability), plus capability-present throwing sentinel and missing backing. Verify original fallback receiver/value identity and no error fallback.
3. **Reached clone/refusal.** Reuse private P/R routes, adding a nonthrowing/throwing payload callback at their actual retained clone boundary with no partial installation and useful fresh-plan recovery. P's byIdOrFail spy will be bypassed; preserve it as baseline instrumentation, not an obligation to keep the facade call. R proves placement/lifetime, not clone/reference identity. Check removal's live/prepared-reference distinction separately within this bounded fixture.

Reuse cases 1/3/4/6 and A/D for their stated boundaries; 2/5/B remain useful public regression controls but did not reach the targeted helper in the recorded paths. P/R supply private reach only. C's getter ran elsewhere and its refusal oracle failed: preserve it, neither repair its assertion nor treat it as a blocker to this mechanism. Freeze these precise comparison oracles before switching the helper; no further generic review or broad campaign is needed. If a discriminator exposes a supported semantic difference, retain the facade for that path until resolved.
