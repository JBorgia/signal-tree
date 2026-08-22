# Runtime capability authority — audit before wiring

**Status:** audit complete. Nothing changed. Wiring is **not** safe as-is.

`entityMap` already asks the right question — `context.hasCapability(...)` — and
`TreeCapability` / `EnhancerMeta.capabilities` already exist. Connecting them
looked like small plumbing. It is not, and the audit says why.

## ⚠️ CORRECTION — three findings in the first pass of this audit were wrong

The first pass concluded the capability system needed building. It does not. It
is **already implemented**, and the corrections matter more than the original
findings.

**Wrong: "the declarations are incomplete."** `internals/tree-capabilities.ts`
carries a dependency graph:

```ts
'causal-runtime': ['mutation-capture', 'position-topology'],
```

`resolveTreeCapabilities` walks it, so declaring `causal-runtime` already
_implies_ both. `timeTravel` and `transactions` are correctly declared.

**Wrong: "nobody supplies `hasCapability`."** `signal-tree.ts:1644` supplies it —
as `(capability) => LEGACY_TREE_BUILD_PLAN.has(capability)`, and that constant is
`createTreeBuildPlan(['causal-runtime', 'temporal-snapshots'], 'property')`,
which resolves to every capability. So the answer is not a missing wire; it is a
wire to a constant that says yes.

**Wrong: "the timing mismatch needs `mutation-capture` to become a query."** Not
on the path that already does this properly. `plannedSignalTree().build()`
defers materialization until after every `.with()`, computes the real plan from
the accumulated enhancers, and passes it through:

```ts
const buildPlan = buildTreePlan(orderedEnhancers);
const materializationContext = createMaterializationContext(buildPlan.has('position-topology'), (capability) => buildPlan.has(capability), physicalCommitClock);
```

No stale snapshot, no boolean-versus-query problem, capability-dependent
`physicalCommitClock`, and `finalizeLeafSignal` already branches on
`buildPlan.has('mutation-capture')` for leaves.

## The actual finding: the correct implementation is dead code

```text
plannedSignalTree   implemented, complete, capability-driven
                    referenced in production source          NO
                    exported from the public barrel          NO
                    present in the built artifact            NO
```

`dist/packages/core/dist/lib/signal-tree.js` ends
`export{isNodeAccessor,signalTree}`. `plannedSignalTree` is referenced only by
three spec files, so the bundler eliminates it. The one public constructor,
`signalTree()`, opts out by using `LEGACY_TREE_BUILD_PLAN` — every capability
on, `'property'` leaf metadata storage — and materializes immediately at
construction rather than at `build()`.

Measured on the shipped path, with all nodes held:

```text
signalTree (legacy plan)   __ownerPath ✓  __subjectIds ✓  __positionIds ✓
```

Everything installed, unconditionally, for a tree with no enhancers at all.

So this is the fifth instance in this investigation of the same pattern —
declaration, seam and consumer all present, wire never run — and the most
striking, because here the wire _is_ run, on a path that is deleted from the
build.

## What that changes about the plan

The work is not "build a runtime capability authority". It is a product
question: **should `signalTree()` adopt the planned path's capability
resolution?** That is a much larger question than plumbing, because:

- `LEGACY_TREE_BUILD_PLAN` also selects `'property'` leaf metadata storage while
  the planned path selects `'sidecar'`. Those are different physical layouts,
  not just different flags.
- `signalTree()` materializes eagerly; the planned builder defers to `build()`.
  Adopting resolution means adopting deferral, which is an API-shape change.
- The prize is real — ~1,710 B/entity of held-node metadata for trees with no
  `causal-runtime` consumer — but it arrives through a construction-semantics
  change, not a flag.

None of that is required for zero-owner reclamation, which needs a
**retirement-time** `causal-runtime` query and can read the same plan the tree
already holds.

## 1. Capabilities are monotonic

No detach surface exists. `.with()` accumulates; there is no `without()`,
`detach()` or enhancer removal anywhere in the public types. So a plain
`Set<TreeCapability>` suffices — no signal, no reactive invalidation, no
ref-counting, no lifecycle bookkeeping. `hasCapability()` can be a synchronous
membership check.

## 2. Declarations — SUPERSEDED by the correction above

Every capability declaration in the repository:

```text
transactions.ts:1382   capabilities: ['causal-runtime']
time-travel.ts:3017    capabilities: ['causal-runtime', 'temporal-snapshots']
```

Neither declares `'mutation-capture'` or `'position-topology'`. But **both
consume what `mutation-capture` gates** — `__ownerPaths`, `__subjectIds`,
`getOwnedPositionIds`.

Today `hasCapability` has no source of truth and its default answers
`capability === 'position-topology' ? positionTopologyEnabled : true`, so
`'mutation-capture'` is unconditionally **true** and everything works by
accident.

Wire a truthful registry against the declarations as they stand and:

```text
hasCapability('mutation-capture')  ->  false for every tree
  -> ownerMetadataEnabled: false, subjectMetadataEnabled: false
  -> __ownerPath / __subjectIds accessors never attached to field signals
  -> transactions and timeTravel lose the metadata they read
```

**So completing the declarations is a prerequisite, not a follow-up.** The two
enhancers that consume `mutation-capture` must declare it.

## 3. Timing — SUPERSEDED for the planned path; still true for `signalTree()`

`materializeMarkers` runs inside `signalTree(...)` (signal-tree.ts:196), while
enhancers attach afterwards through `.with()`. And `createEntitySignal` captures
the flags as closure constants:

```ts
const ownerMetadataEnabled = options?.ownerMetadataEnabled ?? true;
const subjectMetadataEnabled = options?.subjectMetadataEnabled ?? ownerMetadataEnabled;
```

So a boolean resolved at materialization is decided **before any enhancer
exists**. The two capabilities we care about therefore need different treatment:

| capability         | consumed where                              | timing needed                                                    |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| `causal-runtime`   | at subject retirement, for reclamation      | dynamic query — fine                                             |
| `mutation-capture` | inside `createEntityNode`, on lazy `byId()` | dynamic, but currently captured as a constant at materialization |

`createEntityNode` runs lazily on first `byId()`, which in practice is well
after `.with()`. So a dynamic answer would be available at the moment it is
actually needed — but only if the option becomes a **query** rather than a
boolean captured at materialization. That is a small change to
`createEntitySignal`'s options shape, and it is load-bearing: without it, the
truthful registry arrives too late to matter for `mutation-capture`.

## 4. Ownership: the authority must belong to the tree, not the wrapper

```text
base     = signalTree(...)
enhanced = base.with(timeTravel(...))
```

If the registry lives on the enhanced wrapper, `enhanced.hasCapability(...)`
answers `true` while the `MaterializationContext` captured by `base`'s already
materialized `entityMap` answers `false` — the stale-snapshot problem in a new
costume. The registry has to be one shared object created with the tree's
internal runtime, captured by `MaterializationContext` as a query into it, and
added to by `.with()`.

## 5. An unaudited prize sits behind this

`hasCapability('mutation-capture')` currently returning `true` for everyone
means every materialized node carries owner and subject metadata accessors
whether anything reads them. Measured earlier: with all nodes held at 10k, those
accessors are **~1,710 B/entity** (L5 5,562 vs L5m 3,980 B/entity). For a tree
with no `mutation-capture` consumer attached, a truthful answer would drop that
entirely.

That is a larger prize than the churn fix that started this thread, and it is a
_correctness_ improvement as well — the flag was clearly intended to be
conditional. It is also strictly gated on items 2 and 3 above, so it is recorded
here rather than acted on.

## Acceptance criteria for the wiring commit

```text
bare tree                         causal-runtime = false
.with(timeTravel())               causal-runtime = true
.with(transactions())             causal-runtime = true
capability visible through a context created BEFORE attachment
position-topology semantics       unchanged
mutation-capture                  explicitly audited, per consumer, before
                                  the answer is allowed to become false
```

Each of the four capabilities should be checked against: bare tree, its own
enhancer attached, an unrelated enhancer attached, and multiple `.with()` calls.

## Not concluded

Whether `mutation-capture` should become a query, whether the two enhancers
should declare it or whether the gate belongs somewhere else entirely, and
whether the metadata accessors are earned at all once the answer is truthful.
The last one is its own trial, with the ~1,710 B/entity as its prize.

---

## AMENDMENT — the "unaudited prize" of §5 is SUPERSEDED

Added after the 15.0 declarative-construction and zero-owner-reclamation work.
Section 5 above claims metadata accessors are **~1,710 B/entity** (L5 5,562 vs
L5m 3,980) and calls that the prize for making `mutation-capture` truthful.

**That number no longer exists.** It was measured before the
materialized-projection deletion and the activation-token and
subject-position-transport cleanups, all of which removed held-node cost that the
L5/L5m comparison was attributing partly to metadata. Re-measured on 15.0 with
`node --expose-gc tools/bench-entity-layers.mjs`:

| arm                    | before (§5) | now       |
| ---------------------- | ----------: | --------: |
| L5-nodes-held          |     5,562 B |   3,859 B |
| L5m-nodes-held-nometa  |     3,980 B |   3,853 B |
| **difference**         | **1,710 B** | **6-7 B** |

Six or seven bytes per entity, run to run — 0.06 MB across 10,000 held entities.
Re-measured again after zero-owner lifetime forgetting landed, unchanged: that
change touches retirements, and these arms hold live entities. The accessors are
not a memory opportunity, and **§5 must not be quoted as one**. Almost all of the
held-node cost is jointly the Angular field computeds and the node/facade
objects; no arm in that harness separates those two, so neither is charged alone.

What survives from §5: making `mutation-capture` truthful is still a
**correctness** improvement — the flag was intended to be conditional and
answering `true` for everyone is wrong regardless of what it costs. Do the work
for that reason or not at all.

### Also resolved: items 2 and 3

The wiring §5 was gated on exists now. `signalTree` builds the plan from the
declared enhancer set and passes `(capability) => buildPlan.has(capability)` into
`createMaterializationContext`, so `hasCapability` has a real source of truth,
and `internals/runtime-tree-plan.ts` carries the finalized answer to runtime
consumers. The acceptance criteria above are still worth running, but their
`.with()` rows no longer apply: there is no attachment to be "before", which is
the point — see the AMENDMENT in
[restoration-ownership-inventory.md](./restoration-ownership-inventory.md).
