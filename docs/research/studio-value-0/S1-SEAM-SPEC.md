# S1 — minimum kernel observation seam

> Step 3 of the S1 order. Derived from `S1-OBSERVATION-INVENTORY.md`, not from
> the product spec. Specifies the smallest kernel change that lets Studio answer
> **"what did this transaction actually cause state to become?"**
>
> Status: **specification. Not implemented.**

## Summary

The seam adds **no new observation**. Every fact is already produced and already
delivered. The minimum change is three things:

1. **Stop discarding the address** the capture bridge already receives.
2. **Declare** the address field three consumers already read via cast.
3. **Add a read port** for turns, modelled on `PathObservationPort`.

Nothing else in the kernel moves.

---

## 1. The one real gap

`PathNotifierHandler` delivers the address:

```ts
export type PathNotifierHandler = (
  value, prev,
  path: string,          // <- delivered
  ownerPath?: string,    // <- delivered
  origin?, subjectIds?, positionIds?, meta?
) => void | Promise<void>;
```

`transaction-capture-bridge.ts` binds and **discards** both:

```ts
return (next, prev, _path, _ownerPath, _source, subjectIds, positionIds, meta) => {
```

and `toExplicitTransactionEffect()` builds `{ owner, before, after, subjectId,
structural?, structuralContext? }` — no address. So a captured transaction
effect can say *position 7 went from 24.00 to 18.00* and cannot say **which
field that was**.

That is the entire gap for S1. The address is arriving on the same call and
being dropped.

## 2. A pre-existing defect this exposes

`CausalEffect` does not declare `path`, yet three modules read it:

```ts
// reversal-planner.ts:48, :82   reapply-planner.ts:50, :82
path: (effect as CausalEffect & { path?: string }).path,
```

```ts
// pending-rollback.ts:193 — a type guard asserting a field the interface lacks
): effect is CausalTurn['effects'][number] & { path: string; ownerPath: string }
```

Paths are present at runtime on effects produced by the realization adapter and
absent on those produced by the capture bridge, and **the type system declares
neither case**. Consumers cast across the difference.

This is a defect independent of Studio: a field that some producers set, some
do not, and the type never mentions, is exactly the shape that silently breaks
when a producer changes. Declaring it is a fix the kernel wants regardless, and
S1 should not build on top of the cast.

## 3. Address is not identity

Carried verbatim from `ReversalEffect`'s existing doc, because Studio is the
consumer most likely to violate it:

> Captured realization address. Used to derive collection context and
> subject-relative field address. **It is not semantic identity and must not be
> used to bypass SubjectId when resolving a current entity target.**

Studio renders `path` to humans and resolves entities by `subjectId`. A "why is
this value here" chain that re-finds its target by path is wrong even when it
looks right, because a subject can move between paths.

`PositionRegistry.collectionPathFor()` returns `undefined` for non-collections,
and that `undefined` is a *meaningful answer*, not a lookup miss — an ordinary
scalar leaf is not a collection. Studio must not route around it.

## 4. Tree scoping is mandatory, not optional

```text
PositionId  "position N in THIS registry" — allocated from 1 per tree
TreeId      process-unique per live tree; opaque, runtime-local
```

Two trees both call their first leaf `1`. The process-global path notifier
already made this mistake once and coalesced two trees' writes into one
(`NOTIFIER-SCOPE-0`). **Every Studio record must be namespaced by `TreeId`** or
it reproduces that bug in the inspector.

This is the concrete content of **C11** (multi-tree transaction-owner
isolation) for S1, and it is testable directly: two live trees, one transaction
each, same numeric position ids, must not merge.

`TreeId`'s contract is equality and `Map` keys only — no ordinal meaning, no
persistence, no serialization identity. A `.ststudio` session bundle therefore
cannot store a raw `TreeId` as a durable key; it needs its own session-scoped
tree identity mapped at capture time. **Open question for the adapter, flagged
now rather than at export time.**

## 5. The proposed shape

```ts
/** Namespaced so two live trees cannot merge. */
export interface ObservedTurn {
  readonly treeId: TreeId;
  readonly id: TurnId;
  readonly state: 'pending' | 'confirmed';
  readonly effects: readonly ObservedEffect[];
  readonly participants: readonly PositionId[];
}

export interface ObservedEffect {
  readonly owner: PositionId;
  /** Captured address for reading. NOT identity — see §3. */
  readonly path?: string;
  readonly ownerPath?: string;
  readonly before: unknown;
  readonly after: unknown;
  /** Semantic identity. Resolve entities by THIS. */
  readonly subjectId?: unknown;
  readonly structural?: 'add' | 'remove' | 'rekey';
}
```

`effects` are **net per owner position** — the kernel coalesces same-location
writes by design (MO-1B). This is what makes the frozen incident's intermediate
`discount = 20.00` *absent from the model rather than withheld*, and it is why
Studio can answer the Q4 trap honestly without special discipline.

`participants` is the parcel: what changed atomically with the value under
inspection. That is question 3 of the frozen incident, answered directly.

## 6. The port

Modelled on `path-observation-port.ts`, which the inventory (§D) showed already
satisfies the S1 disabled/unused contract nearly point for point.

```ts
export interface CausalObservationPort {
  publishTurn(turn: ObservedTurn): void;
}

let runtime: CausalObservationRuntime | undefined;
export function installCausalObservationRuntime(next): void
export function resetCausalObservationRuntime(): void
export function hasCausalObservers(): boolean
export function causalObservation(): CausalObservationPort
```

Binding rules inherited from the existing port, each of which exists because
violating it caused a recorded defect:

- **Type-only imports.** A value import re-links the engine and silently
  restores every byte while behavioural tests stay green.
- **One publication job, one port operation.** The old port carried a second
  operation for a single caller and it was removed in 15.0 (ME-B).
- **Type the port as the contract, not the implementation.** The old port was
  `{...} as unknown as PathNotifier` and kept exposing `intercept()` after the
  method was deleted — callers got a silent no-op instead of a `TypeError`.
- **Detach must clear the engine's observers too**, or `port.hasObservers()`
  and `engine.hasObservers()` disagree and a live subscriber stops receiving.

## 7. What S1 does NOT do

- No new observer. (`S1-OBSERVATION-INVENTORY.md` §C.)
- No new state semantics. The seam publishes facts the kernel already computes.
- No public export of `causal-runtime`. Only `ObservedTurn`/`ObservedEffect`
  and the port become supported surface; `TurnStore`, the planners and the
  realization adapter stay internal.
- No `TransactionSettled`. §23 scopes it to S1 "if the facts surface
  truthfully"; on this evidence they do not yet, so S1 declares it uncovered
  rather than approximating it.
- **No realization, restoration or structural coverage.** Those are S2/S3/S4.
  S1 declares them unobserved and refuses (spec §8.5, §22.1.11).

## 8. Acceptance for S1's seam

1. `ObservedTurn` published for confirmed and pending transactions on a plain
   tree; two live trees do not merge (C11, §4 above).
2. Every effect carries `path` where the producer has one, and `undefined`
   where it does not — never a fabricated or inferred address.
3. Compositions outside S1's declared set are **detected and refused**, not
   approximated (§22.1.11).
4. The eight-point disabled/unused contract (spec §8.5) holds, with the bundle
   delta and disabled-overhead numbers recorded.
5. `CausalEffect.path` is declared, and the three casting consumers stop
   casting.

## Open, blocking implementation

- **Durable tree identity for sessions** (§4). `TreeId` is explicitly
  non-persistent; `.ststudio` needs its own.
- **Does `pending` belong in S1?** Publishing pending turns exposes attempted
  work, which is the strongest causal story — but pending/rollback composition
  is where the kernel's own spec files are largest. May be S1 or may need its
  own slice.
