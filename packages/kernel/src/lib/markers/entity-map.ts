import { definePositionRegistry } from '../internals/position-registry';
import { getDerivedRuntime } from '../internals/derived-runtime';
import type { CarrierKind, EntitySignalOf, ReadonlyOf } from '../types';

import { createEntitySignal } from '../entity-signal';
import {
  registerBuiltinMarkerProcessor,
} from '../internals/materialize-markers';
import { isEntityMapMarker } from '../utils';

// Build-time dev flag. Declared locally rather than inherited from
// `@angular/core`'s ambient types: it is a bundler convention, not a framework
// API, and the kernel's declarations must not depend on Angular for it.
declare const ngDevMode: boolean | undefined;


// Re-export isEntityMapMarker for convenience
export { isEntityMapMarker };

/**
 * EntityMap Marker Factory
 *
 * Self-registering marker for entity collections. If you never use `entityMap()`,
 * this code is tree-shaken from your bundle. Passing a `load` turns the
 * collection into a cache-aware (single-scope), self-loading one; the loader
 * machinery lives in `./entity-loader`.
 *
 * Tree-shake boundary (RFC 0005 §6): the loader machinery is reached ONLY
 * through the `loader()` helper (`./loader`) — `entityMap({ load: loader(fn,
 * opts) })`. This file does NOT import `attachLoader`; the `loader()` feature
 * carries the only reference to it, so a plain `entityMap()` (or one whose
 * `load` is never a loader feature) tree-shakes the loader/cache/SWR/persist
 * code out entirely. A raw function passed to `load` fails closed ([ST2004]) —
 * it cannot silently no-op. (v12 removed the deprecated raw `load: fn` path;
 * this is the reclaim RFC 0005 was staged to earn.)
 */

import type {
  EntityConfig,
  EntityMapMarker,
} from '../types';

// =============================================================================
// COMPUTED SLICE TYPES
// =============================================================================

/**
 * Configuration for a computed slice on entityMap
 */
export interface ComputedSliceConfig<E, R> {
  /** Compute function - receives all entities, returns derived value */
  compute: (entities: E[]) => R;
}

/**
 * Stored computed slice definitions for an entityMap marker
 */
export interface EntityMapComputedSlices<E> {
  [name: string]: ComputedSliceConfig<E, unknown>;
}

/**
 * EntityMap marker with computed slices attached
 */
export interface EntityMapMarkerWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> extends EntityMapMarker<E, K> {
  __computedSlices?: EntityMapComputedSlices<E>;
  /** Type-level only: the computed slice types */
  __sliceTypes?: Slices;
}

/**
 * EntitySignal extended with computed slices
 */
export type EntitySignalWithSlicesOf<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>,
  C extends CarrierKind
> = EntitySignalOf<E, K, C> & {
  [P in keyof Slices]: ReadonlyOf<C, Slices[P]>;
};

/** PUBLIC kernel spelling. Carrier bound to the neutral cell. */
export type EntitySignalWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> = EntitySignalWithSlicesOf<E, K, Slices, 'cell'>;

/**
 * Builder for chainable computed slices on a plain entityMap.
 */
export interface EntityMapBuilder<
  E,
  K extends string | number,
  Slices extends Record<string, unknown> = Record<string, never>
> extends EntityMapMarker<E, K> {
  __computedSlices?: EntityMapComputedSlices<E>;
  __sliceTypes?: Slices;

  /**
   * Add a computed slice to this entityMap.
   *
   * @example
   * ```typescript
   * entityMap<Listing>()
   *   .computed('active', all => all.filter(l => l.status === 'active'))
   * // Access: tree.$.listings.active() // ReadableCell<Listing[]>
   * ```
   */
  computed<N extends string, R>(
    name: N,
    compute: (entities: E[]) => R
  ): EntityMapBuilder<E, K, Slices & Record<N, R>>;

  /** Finalize and return the marker (usually unnecessary — the builder is a marker). */
  build(): EntityMapMarkerWithSlices<E, K, Slices>;
}

// =============================================================================
// SELF-REGISTERING MARKER FACTORY
// =============================================================================

/**
 * Internal marker shape as seen by the processor (runtime). Carries the optional
 * load options alongside the entity config.
 * @internal
 */
type InternalMarker = EntityMapMarker<
  Record<string, unknown>,
  string | number
> & {
  __entityMapConfig?: EntityConfig<Record<string, unknown>, string | number> & {
    // `load` is a `loader()` feature (v12). Typed `unknown` here — the
    // processor guards with `isLoaderFeature` and fails closed on anything
    // else (e.g. a JS/`any` caller passing a raw function).
    load?: unknown;
  };
  __computedSlices?: EntityMapComputedSlices<Record<string, unknown>>;
};

/**
 * Default key type: inferred from the entity's `id` field if present.
 */
/**
 * Exported because it appears in a PUBLIC signature default —
 * `entityMap<E, K = DefaultKey<E>>`. As a module-local type it was referenced by
 * the emitted `.d.ts` and declared nowhere in it, so a consumer compiling with
 * `skipLibCheck: false` got `TS2304: Cannot find name 'DefaultKey'`. A type that
 * is reachable from a public signature is public whether or not it is exported;
 * the only choice is whether the declaration ships with it.
 */
export type DefaultKey<E> = E extends { id: infer I extends string | number }
  ? I
  : string;

/**
 * Create an entity map marker for use in a `signalTree` state definition.
 *
 * Automatically registers its processor on first use — no manual registration.
 * If you never use `entityMap()`, the processor is tree-shaken out.
 *
 * Passing a `load` — as a `loader()` feature (preferred) or a raw function
 * (deprecated, [ST2004]) — makes the collection **cache-aware**: it loads
 * itself, exposes `.load()/.loadOrThrow()/.refresh()/.invalidate()/.loading()/
 * .loaded()/.error()/.lastLoadedAt()/.params()`, guards refetches by
 * `staleTime`, coalesces concurrent loads, and (with a loader that declares a
 * param) is scoped per `params` (one scope retained at a time — not a multi-key
 * cache). Wrapping with `loader()` keeps the loader machinery tree-shakeable —
 * a plain `entityMap()` never pays for it. Without `load` it's a plain
 * normalized client collection.
 *
 * @example Plain (client-side)
 * ```typescript
 * const tree = signalTree({ users: entityMap<User, number>() });
 * tree.$.users.addOne({ id: 1, name: 'Alice' });
 * ```
 *
 * @example Cache-aware (self-loading)
 * ```typescript
 * import { signalTree, entityMap, loader } from '@signal-tree/kernel';
 *
 * const tree = signalTree({
 *   plants: entityMap<Plant, string>({
 *     selectId: (p) => p.url,
 *     load: loader(() => plantApi.list$(), { staleTime: '30m', tags: ['plants'] }),
 *   }),
 * });
 * await tree.$.plants.load();   // guarded — no-op while fresh / in-flight
 * ```
 *
 * @example Scoped (parameterized)
 * ```typescript
 * const tree = signalTree({
 *   customers: entityMap<Customer, string, { regionUrl: string }>({
 *     selectId: (c) => c.externalId,
 *     load: loader(({ regionUrl }) => api.getCustomers$(regionUrl), { staleTime: '30m' }),
 *   }),
 * });
 * await tree.$.customers.load({ regionUrl });  // per-scope freshness
 * ```
 *
 * @see RFC 0002, RFC 0003, RFC 0005
 */
// ⚠️ ONE OVERLOAD NOW. There were two, ordered so that a config carrying
// `load: loader(...)` resolved to a LOADING builder. That form is gone: a
// collection's relationship with external truth is `link(tree.$.rows, endpoint)`,
// and how that endpoint fetches or caches is the application's business.
export function entityMap<E, K extends string | number = DefaultKey<E>>(
  config?: EntityConfig<E, K>
): EntityMapBuilder<E, K, Record<string, never>> {
  // ⚠️ [ST2004] IS GONE, AND IT WAS A DEAD END. It threw
  // "entityMap({ load }) requires the loader() helper" at anyone who passed a
  // raw function — while `loader()` was never exported, so the remedy the error
  // named could not be imported. The check documented an unreachable path as
  // the solution.

  // Self-register on first use (tree-shakeable).
  //
  // ⚠️ A `entityMapRegistered` BOOLEAN GUARDED THIS UNTIL 15.0. It duplicated a
  // fact the marker registry already owns — `registerProcessor` returns early
  // when a processor with the same `check` function is present, and the check
  // is the same reference on every call. Bypassing the boolean left the full
  // suite green.
  //
  //     DO NOT CACHE A FACT ALREADY AUTHORITATIVELY KNOWN BY THE REGISTRY
  //     MERELY TO AVOID AN UNMEASURED ALLOCATION.
  //
  // Its only surviving effect was skipping one closure allocation per
  // `entityMap()` call. If that ever becomes measurable, hoist the callback —
  // do not reintroduce duplicate mutable state.
  registerBuiltinMarkerProcessor(
      isEntityMapMarker as (value: unknown) => value is InternalMarker,
      (marker, notifier, path, context, parentPositionId) => {
        const cfg = marker.__entityMapConfig ?? {};
        const hasPositionTopology = context.hasCapability('position-topology');
        const hasMutationCapture = context.hasCapability('mutation-capture');
        const entitySignal = createEntitySignal(
          cfg as EntityConfig<Record<string, unknown>, string | number>,
          notifier,
          path,
          {
            physicalCommitClock: context.physicalCommitClock,
            // ADDRESS-REPAIR-1. The collection's own position is allocated
            // here, and `path` IS its canonical address — both facts are known
            // at exactly this point and nowhere later. Registering them makes
            // every downstream consumer able to ASK which collection owns a
            // position instead of guessing from a path's dot shape, which
            // REALIZATION-ADDRESS-0 measured wrong for every nested case.
            positionIdAllocator: hasPositionTopology
              ? () => {
                  const positionId =
                    context.allocatePositionId(parentPositionId);
                  if (positionId !== undefined) {
                    context.positionRegistry.registerCollectionPath(
                      positionId,
                      path
                    );
                  }
                  return positionId;
                }
              : () => undefined,
            ownerMetadataEnabled: hasMutationCapture,
            subjectMetadataEnabled: hasMutationCapture,
            positionMetadataEnabled: hasPositionTopology,
            ownerId: context.positionRegistry.id,
            // Immutable for the life of the tree — see RuntimeTreePlan. False
            // is what lets the retirement boundary release a retired subject's
            // value backing immediately.
            hasRestorationAuthority:
              context.runtimeTreePlan.hasRestorationAuthority,
          }
        );

        // OWNER-LOCATION-0. Same reason as `stored()`: a marker builds its own
        // node, so the registry the leaf/branch sites attach in
        // `signal-tree.ts` never reaches it. A collection is an addressable
        // position — positionId, ownerPath, and restoration reverses it
        // independently — and must be able to name its owning tree.
        definePositionRegistry(
          entitySignal as unknown as object,
          context.positionRegistry
        );

        // Register as a reclamation target, but ONLY when something in this
        // tree can restore. Without restoration authority the retirement
        // boundary already releases everything at the moment of retirement, so
        // a sink would have nothing to offer and the list would just pin the
        // collection.
        if (context.runtimeTreePlan.hasRestorationAuthority) {
          context.physicalOwners.push(
            entitySignal as unknown as (typeof context.physicalOwners)[number]
          );
        }

        // Computed slices
        const slices = marker.__computedSlices;
        if (slices) {
          for (const [name, sliceConfig] of Object.entries(slices)) {
            const computedSignal = getDerivedRuntime().createDerived(() =>
              sliceConfig.compute(entitySignal.all())
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (entitySignal as any)[name] = computedSignal;
          }
        }


        return entitySignal;
      },
      {
        // STATE: the entities. `ids`, `count`, `empty` and `map` are all
        // derived from `all` — and `map` is a JS `Map`, which JSON cannot
        // represent, so it used to serialise as `{}`: a snapshot claiming the
        // collection was EMPTY while holding 10,000 entities.
        snapshot: (node) => ({ all: node.all() }),

        hydrate: (node, value) => {
          // ⚠️ NOTHING DECLINES HYDRATION ANY MORE, and that is the whole
          // finding rather than a side effect. The decline here was
          // loader-conditional — `typeof node.load === 'function'`, and `load`
          // was attached only by the `loader()` feature. With loader deleted the
          // predicate can never be true, so the branch was dead the moment its
          // one producer went.
          //
          // M4 traced this trajectory already: `hydrate` had two implementers,
          // `asyncSource` and `entityMap`; asyncSource's deletion left one, and
          // loader's leaves ZERO declining paths. "A source-owning marker
          // declines rehydration" is not an invariant that lost its carrier —
          // it is a rule with no subject, because no marker in core owns an
          // external source. Relationships do, and a relationship is `link()`.
          //
          // The RFC 0014 contrast — `transfer` accepts what `rehydrate`
          // declines — is retired with it: both modes now accept.

          if (value === null || typeof value !== 'object') return;
          // A BARE ARRAY is a valid payload, not a malformed one.
          //
          // `tree({ rows: [...] })` is what a person or an AI writes to seed or
          // reset a collection, and it used to half-apply: sibling leaves in the
          // same payload took their values while the collection silently kept
          // its old contents. In dev that emitted ST2024; in production it did
          // nothing at all, which is the worst version of this — a partial
          // hydrate is harder to notice than a failed one, because the parts
          // that DID apply make it look like it worked.
          //
          // Accepting it is unambiguous. An entityMap SNAPSHOT always emits
          // `{ all: [...] }`, so a bare array can never be mistaken for the
          // snapshot shape, and no other payload this processor accepts is an
          // array. The `all` wrapper stays the canonical round-trip form; this
          // only stops the hand-written form from being silently dropped.
          const all = Array.isArray(value)
            ? value
            : (value as { all?: unknown }).all;
          if (Array.isArray(all)) {
            // DIFF FIRST, `setAll` only as a fallback.
            //
            // `setAll` rebuilds the storage map, the id index and every
            // per-entity signal — O(collection) on EVERY restore. Measured at
            // 10k entities that is 3.62 ms per undo, and it is why undo/redo
            // over a large collection was ~150x slower than elf's
            // state-history, which restores by swapping one immutable
            // reference (docs/compare/real-implementations.md).
            //
            // A snapshot SHARES its entity objects with the live tree —
            // measured 499/500 identical after a single-entity change — so a
            // reference walk finds exactly the rows that moved. Undoing one
            // edit then costs one `updateOne` (~6 us) instead of a full
            // `setAll` (~3.62 ms).
            //
            // The fast path is taken only when the id sequence is IDENTICAL,
            // in order. Any add, removal or reorder falls back to `setAll`,
            // because those change the index and the ordering guarantees that
            // `setAll` exists to maintain.
            const incoming = all as E[];
            const current = node.all();
            let diffed = false;

            if (current.length === incoming.length) {
              // Reference walk. `upsertOne` resolves the id with the node's OWN
              // selectId, so this needs no access to the marker config.
              const changed: E[] = [];
              for (let i = 0; i < incoming.length; i++) {
                if (current[i] !== incoming[i]) changed.push(incoming[i]);
              }
              if (changed.length < incoming.length) {
                for (const entity of changed) node.upsertOne(entity as never);
                // Guard against id divergence: if any incoming entity carried a
                // DIFFERENT id than the row it replaced, upsert added rather
                // than replaced and the count moved. Repair with the full
                // rebuild rather than leave a half-applied restore — this is the
                // one place a wrong shortcut would silently corrupt state.
                diffed = node.count() === incoming.length;
              }
            }

            if (!diffed) node.setAll(incoming as never[]);
          } else if (typeof ngDevMode === 'undefined' || ngDevMode) {
            console.warn(
              `SignalTree: entityMap hydrate ignored a payload with no ` +
                `\`all\` array. The collection was left unchanged. This is a ` +
                `PAYLOAD problem, not a registration one — a pre-2.0.0 ` +
                `snapshot emitted \`map\`, which JSON renders as \`{}\`, so the ` +
                `entities were never in it. [ST2024]`
            );
          }
        },
      }
    );

  const slices: EntityMapComputedSlices<E> = {};

  const combined = {
    __isEntityMap: true as const,
    __entityMapConfig: config ?? {},
    __computedSlices: slices,

    computed<N extends string, R>(
      name: N,
      compute: (entities: E[]) => R
    ): EntityMapBuilder<E, K, Record<N, R>> {
      slices[name] = { compute: compute as (entities: E[]) => unknown };
      return combined as unknown as EntityMapBuilder<E, K, Record<N, R>>;
    },

    build(): EntityMapMarkerWithSlices<E, K, Record<string, never>> {
      return combined as unknown as EntityMapMarkerWithSlices<
        E,
        K,
        Record<string, never>
      >;
    },
  };

  return combined as unknown as EntityMapBuilder<E, K, Record<string, never>>;
}
