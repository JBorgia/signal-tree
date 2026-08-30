import type {
  CarrierKind,
  EntitySignalOf,
  ISignalTreeOf,
  ReadonlyOf,
  TreeNodeOf,
} from './types';
import type { ReadableCell } from './internals/cell-runtime';

import type { SignalTreeBuilderOf } from './internals/builder-types';
import type {
  WritableLeaf,
  NodeAccessor,
  TreeNode,
} from './types';
import { ENTITY_READERS } from './readonly-readers';

/**
 * READ-ONLY VIEW TYPES (RFC 0004 §4 step 2 — "Readonly, truthful and minimal")
 *
 * A read-only view is a **type-only** narrowing: `asReadonly(tree)` returns the
 * exact same runtime object, typed so that no write path is *offered*. It does
 * not protect against a deliberate `as any` bypass — it protects the common
 * case where a developer (or AI agent) reaches for a `.set()`/mutator that
 * simply isn't on the injected type. Pair it with a separate `@Injectable` Ops
 * service for the write path (see "Production architecture" in the root
 * README). A dev-mode throwing Proxy was considered and refuted (RFC 0004 §3
 * V-P2): it would hard-throw in dev and silently pass in prod for the repo's
 * own documented reader+Ops pattern, break Proxy invariants on the
 * non-configurable properties markers attach, and put a get-trap on the
 * hottest read path.
 *
 * Marker surfaces are narrowed via `Pick` over exported `const` reader-key
 * allowlists (below). This direction of drift is fail-safe: a *new* mutator
 * added to a marker interface stays invisible on the readonly view until
 * someone deliberately adds it to the reader list; a renamed/removed reader
 * key fails `tsc` loudly at the `Pick` site.
 */

// =============================================================================
// HELPERS
// =============================================================================

/**
 * `Pick` over a reader-key allowlist. Call signatures are NOT carried by mapped
 * types — views that keep the marker's zero-arg read call re-add it via
 * intersection.
 *
 * ⚠️ THIS USED TO DEMOTE `WritableSignal` MEMBERS to plain `Signal`, via a
 * `DemoteWritable<T>` conditional. ASYNC-QUERY-CLOSE-0 measured that branch
 * UNREACHABLE and deleted it rather than leaving untested machinery behind:
 *
 * ```text
 * ENTITY_READERS         methods and computeds
 * ASYNC_SOURCE_READERS   data/loading/error — all Signal
 * STORED_READERS         key/version — plain values
 * ```
 *
 * Not one surviving allowlist member is a `WritableSignal`. The two that ever
 * were — `asyncQuery.input` and `status.state` — belonged to primitives that
 * are now deleted.
 *
 * ⚠️ `ReadonlyExtras` demotes writable EXTRAS through `ReadonlyView`, which is a
 * DIFFERENT mechanism and is unaffected.
 *
 * If a future marker exposes a writable reader, the demotion must be
 * reintroduced WITH a test — the existing `Equal<>` assertions over all four
 * allowlists are what proved this deletion safe, and they will fail rather than
 * silently widen.
 */
type PickReaders<T, K extends keyof T> = {
  readonly [P in K]: T[P];
};

/**
 * Read-only counterpart to {@link NodeAccessor} — only the zero-arg read form.
 */
export interface ReadonlyNodeAccessor<T> {
  (): T;
}

/**
 * Extra members deep-merged INTO a marker node by `.derived()` (e.g.
 * `.derived($ => ({ plants: { total: computed(…) } }))` where `plants` is a
 * loading `entityMap`). The marker dispatch rows re-sign the node to a
 * Pick-allowlist view, which on its own would silently swallow those
 * intersection extras (the readonly×merged-derived gap) — so every marker row
 * intersects its readonly marker view with the {@link ReadonlyView}-mapped
 * remainder beyond the marker interface: derived `Signal`s survive,
 * `WritableSignal` extras demote to `Signal`, unknown functions degrade to
 * `{}` unless they already satisfy the kernel's zero-argument `ReadableCell`
 * contract. Resolves to `unknown` (identity under `&`) when there are no extras,
 * so marker-only nodes keep types exactly equal to their views.
 */
type ReadonlyExtras<N, Base, C extends CarrierKind> = keyof Omit<
  N,
  keyof Base
> extends never
  ? unknown
  : ReadonlyViewOf<Omit<N, keyof Base>, C>;

/**
 * The effective parameter tuple of a callable. For an overloaded
 * `NodeAccessor`, TypeScript selects its final write overload; a foreign
 * readable reactive callable has only the zero-argument read signature.
 */
type EffectiveParameters<T> = T extends (...args: infer P) => unknown
  ? P
  : never;

// =============================================================================
// PER-MARKER READ-ONLY VIEWS
// =============================================================================

/**
 * Read-only counterpart to `EntityNode<E>` — zero-arg read call plus deep
 * `Signal` leaves, no write call signatures and no leaf `.set`/`.update`.
 * Mirrors `EntityNode`'s branch/array/leaf shape exactly.
 */
type ReadonlyEntityNodeOf<E, C extends CarrierKind> = {
  (): E;
} & {
  readonly [P in keyof E]: E[P] extends object
    ? E[P] extends readonly unknown[]
      ? ReadonlyOf<C, E[P]>
      : ReadonlyEntityNodeOf<E[P], C>
    : ReadonlyOf<C, E[P]>;
};

  export type ReadonlyEntityNode<E> = ReadonlyEntityNodeOf<E, 'cell'>;

/**
 * Read-only view of {@link EntitySignal}: query surface only. `byId`/
 * `byIdOrFail` are re-signed to return {@link ReadonlyEntityNode} — the full
 * surface returns a deep-writable `EntityNode`, which would leak the write
 * path through a "readonly" view (RFC 0004 §3 V-P2).
 */
type ReadonlyEntitySignalOf<
  E,
  K extends string | number,
  C extends CarrierKind
> = PickReaders<EntitySignalOf<E, K, C>, (typeof ENTITY_READERS)[number]> & {
  /** Re-signed: same node at runtime, typed without write reachability. */
  byId(id: K): ReadonlyEntityNodeOf<E, C> | undefined;
  /** Re-signed: same node at runtime, typed without write reachability. */
  byIdOrFail(id: K): ReadonlyEntityNodeOf<E, C>;
};

// =============================================================================
// THE VIEW
// =============================================================================

/**
 * Per-member dispatch for {@link ReadonlyView}.
 *
 * ORDER IS LOAD-BEARING — these surfaces structurally overlap:
 * - Every marker row intersects {@link ReadonlyExtras} so derived state
 *   deep-merged INTO the marker node (`.derived($ => ({ plants: { total } }))`)
 *   survives the Pick-allowlist re-signing instead of being swallowed.
 * - Marker surfaces come first: every marker signal is callable and/or
 *   structurally satisfies `NodeAccessor` (a single `(): T` call signature
 *   satisfies all three `NodeAccessor` overloads under TS's fewer-params
 *   rule), so a later row would swallow them.
 * - `WritableLeaf` before `NodeAccessor`: a writable foreign reactive callable
 *   is demoted through its carrier before the structural callable overlap.
 * - `NodeAccessor` before `ReadableCell`: a real accessor structurally satisfies
 *   `ReadableCell`, so moving the readable row first collapses branch topology.
 *   The accessor row therefore inspects the callable grammar: a zero-parameter
 *   callable is a foreign reader, while the effective one-parameter overload is
 *   SignalTree's whole-value/updater write grammar.
 * - Branch accessors (`NodeAccessor<U> & TreeNode<U>`) recurse; the mapped
 *   type drops the write call signatures, `ReadonlyNodeAccessor` re-adds the
 *   zero-arg read.
 * - Bare objects (derived-only groups, `{ group: { total: computed(…) } }`)
 *   have no call signature — they miss the `NodeAccessor` row and recurse
 *   through the object row. Function members with another call grammar degrade
 *   to `{}` there. A zero-argument function is structurally a `ReadableCell`
 *   throughout the neutral derived type system and follows the reader row.
 *
 * Dispatch is structural (the accumulated `$` type carries materialized
 * signal surfaces, not brandable markers), so a future marker without a row
 * here degrades *silently* — the parity fixture in `readonly.typing.spec.ts`
 * is the maintained guard (RFC 0004 §3 V-P2). Add a row + fixture line for
 * every new marker.
 */
type ReadonlyNodeView<T, C extends CarrierKind> = T extends EntitySignalOf<
  infer E,
  infer K extends string | number,
  C
>
  ? ReadonlyEntitySignalOf<E, K, C> &
      ReadonlyExtras<T, EntitySignalOf<E, K, C>, C>
  : T extends WritableLeaf<infer V>
  ? ReadonlyOf<C, V>
  : T extends NodeAccessor<infer U>
  ? EffectiveParameters<T> extends []
    ? T extends ReadableCell<infer V>
      ? ReadonlyOf<C, V>
      : T
    : ReadonlyNodeAccessor<U> & ReadonlyViewOf<T, C>
  // ⚠️ ORDER: `NodeAccessor` MUST be tested before `ReadableCell`.
  // The call-grammar check above keeps a foreign zero-argument reader from
  // being captured as a branch while preserving real accessors here.
  //
  //     REMOVING A NOMINAL BRAND MAKES STRUCTURAL ORDER LOAD-BEARING.
  : T extends ReadableCell<infer V>
  ? ReadonlyOf<C, V>
  : T extends object
  ? ReadonlyViewOf<T, C>
  : T;

/**
 * Read-only mapped view over a tree's **accumulated** `$` type (the builder's
 * `TAccum` — `TreeNode<TSource>` plus every `.derived()` layer), NOT over the
 * raw source `T`. Computing the view from the source type was the original
 * bug (RFC 0004 F1): it silently dropped every derived computed.
 *
 * - leaf `WritableLeaf<V>` → `ReadableCell<V>`
 * - branch `NodeAccessor<U> & children` → zero-arg read + mapped children
 * - derived `Signal`s pass through; `linked()` `WritableSignal`s narrow to `Signal`
 * - marker surfaces → their `Readonly*` views (reader allowlists above)
 */
export type ReadonlyViewOf<T, C extends CarrierKind> = {
  readonly [K in keyof T]: ReadonlyNodeView<T[K], C>;
};

/** PUBLIC kernel spelling, bound to the neutral carrier. */
export type ReadonlyView<T> = ReadonlyViewOf<T, 'cell'>;

/**
 * The read-only store surface: read-only `$` plus the zero-arg snapshot read
 * and lifecycle (`destroy()`/`destroyed`). This is the injected type of
 * `defineStore(factory, { expose: 'readonly' })` and the return type of
 * {@link asReadonly}.
 *
 * Deliberately excludes `with()` (construction-time capability), `bind()`
 * (returns a writable accessor), `updateAndReport()` (writes state), and
 * `registerCleanup()` (enhancer plumbing) — each would let a "reader" reach a
 * write path. Also excludes the `state` alias (read-equivalent of `$`,
 * dropped for surface minimality — one name for the read surface).
 *
 * @typeParam TSource - the raw source state type (snapshot shape)
 * @typeParam TAccum - the accumulated `$` type; defaults to `TreeNode<TSource>`
 */
export interface ReadonlyStoreOf<TSource, TAccum, C extends CarrierKind> {
  /** Zero-arg snapshot read — the write overloads are not offered. */
  (): TSource;
  readonly $: ReadonlyViewOf<TAccum, C>;
  /** Whether this tree has been destroyed. */
  readonly destroyed: ReadonlyOf<C, boolean>;
  destroy(): void;
}

/** PUBLIC kernel spelling. `@signal-tree/angular` binds `'angular'`. */
export type ReadonlyStore<TSource, TAccum = TreeNode<TSource>> =
  ReadonlyStoreOf<TSource, TAccum, 'cell'>;

// =============================================================================
// asReadonly()
// =============================================================================

/**
 * Narrow a tree to its {@link ReadonlyStore} view. **Type-only** — returns the
 * exact same runtime object (identity, zero overhead); see the module docs
 * for the threat model this does and does not cover.
 *
 * This is the primary readonly surface. Unlike an options-overload it cannot
 * silently no-op: any tree-shaped value either matches an overload and is
 * narrowed, or fails to compile (RFC 0004 F2 dies structurally).
 *
 * @example
 * ```ts
 * const tree = signalTree({ count: 0 })
 *   .derived(($) => ({ doubled: computed(() => $.count() * 2) }));
 *
 * const reader = asReadonly(tree);
 * reader.$.count();        // ✅ read
 * reader.$.doubled();      // ✅ derived computeds survive
 * // reader.$.count.set(1) // ❌ compile error — not offered
 * ```
 */
/**
 * ⚠️ CARRIER-GENERIC. `asReadonly` is re-exported by BOTH packages, so its
 * declared result must follow the carrier of the tree it was handed rather than
 * being pinned to the kernel's `'cell'`. Pinned, an Angular consumer calling
 * `asReadonly(tree)` got a store whose leaves typed as `ReadableCell`.
 */
export function asReadonly<TSource, TAccum, C extends CarrierKind = 'cell'>(
  tree: SignalTreeBuilderOf<TSource, TAccum, C>
): ReadonlyStoreOf<TSource, TAccum, C>;
export function asReadonly<TSource, C extends CarrierKind = 'cell'>(
  tree: ISignalTreeOf<TSource, C>
): ReadonlyStoreOf<TSource, TreeNodeOf<TSource, C>, C>;
export function asReadonly(tree: object): object {
  return tree;
}
