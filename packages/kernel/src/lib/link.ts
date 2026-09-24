import type { Location } from './internals/cell-runtime';
import {
  isWritableLocation,
  replaceLocation,
} from './internals/location-runtime';

import { deepEqual } from './utils';
import { external } from './external';
import {
  getOwnedOwnerPath,
  getOwnedPositionIds,
} from './internals/owned-metadata';
import { getPathNotifier } from './path-notifier';
import { reportTreeError } from './internals/error-reporter';
import {
  getPositionRegistry,
  getNodeAddress,
} from './internals/position-registry';
import { acquireObservation } from './internals/observation-substrate';
import { isInspectionWrite } from './write-participation';
import {
  getEntityProjectionSeed,
  getEntityLocationBinding,
} from './internals/entity-projection-seed';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
import {
  createEntityEgressProjection,
  projectEntityFields,
  type EntityEgressProjection,
} from './internals/entity-egress-projection';
import {
  applyAtRelativePath,
  relativeSourceAddress,
} from './internals/source-mutation';
import { isNodeAccessor, isTraversableNode } from './internals/node-shape';
import { getRootTree } from './internals/root-source';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import type { EntityMapBuilder } from './markers/entity-map';
import type { NodeAccessor } from './node-accessor';
import type { ConstructionOf } from './internals/construction-accessor';
import type { ResolveLeafDefinitions } from './types';

/**
 * `link(x, y)` — synchronize a SignalTree location with an external endpoint.
 *
 * ```ts
 * const connection = link(tree.$.rows, {
 *   get: () => api.load(),
 *   set: (rows) => api.save(rows),
 *   subscribe: (next) => socket.on('rows', next),
 * });
 *
 * await connection.retrieve();
 * await connection.settled();
 * connection.dispose();
 * ```
 *
 * Three directions, one primitive:
 *
 * ```text
 * get        Y -> X   pulled on demand via retrieve()
 * set        X -> Y   pushed after every settled turn
 * subscribe  Y -> X   pushed live
 * ```
 *
 * A rejected `set()` is reported to `onTreeError` — once, with the owning
 * `treeId` and the linked location's `path`. `X` stays authored, the outbound
 * queue survives, and `settled()` RESOLVES rather than throwing. That is why the
 * handle needs no error member of its own.
 *
 * ⚠️ **X must be an OWNED SignalTree location.** That is enforced at RUNTIME,
 * not by the type: `LINK-2` measured that a `computed` and a bare
 * `WritableSignal` are structurally identical to an owned leaf — same call
 * signature, same `.set` — and ownership is a runtime fact on a non-enumerable
 * property. Making it a compile error needs a branded location type threaded
 * through every public return in the library, which is a far larger decision.
 */
export interface LinkEndpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * The handle. Deliberately three members.
 *
 * No `subscribe()`, no `then()`, no retry/backoff/status, no `afterGet`/
 * `afterSet`/`afterChange` — none of those were earned by a demonstrated
 * third-party authoring need, and "might be useful" is UNPROVEN, not PUBLIC.
 */
export interface Link {
  /** Pull Y into X once. Rejects if the endpoint supplies no `get()`. */
  retrieve(): Promise<void>;
  /** Resolves when every outbound write in flight has been acknowledged. */
  settled(): Promise<void>;
  /** Stop synchronizing. Idempotent. */
  dispose(): void;
}

/**
 * The natural value of a source — derived from the SOURCE, never annotated by
 * the caller.
 *
 * ⚠️ The collection branch is first, and it is what LINK-COLLECTION-TYPE-0
 * earned. A collection node is deliberately NOT callable, and the previous
 * target union therefore rejected it outright — inference never reached the
 * endpoint. The finding that fixed it:
 *
 * > **node access shape != linked value shape**
 *
 * Making `link` generic over `S` rather than `T` is what lets contextual typing
 * flow into the endpoint callbacks, so `link(tree.$.rows, { set: (v) => ... })`
 * infers `v: Row[]` with no explicit generic.
 */
export type NaturalValue<S> = S extends Location<infer T>
  ? T
  : S extends NodeAccessor<infer T>
  ? T
  : S extends {
      readonly all: unknown;
      setAll(...args: infer Args): unknown;
    }
  ? Args[0]
  : S extends () => infer T
  ? T
  : S extends { readonly value: infer T }
  ? T
  : never;

/** Construction provenance keeps the existing Link admission boundary even
 * though root and branch accessor values now describe canonical snapshots. */
type ContainsEntityMapMarker<T> = [T] extends [never]
  ? false
  : T extends EntityMapBuilder<infer _R, infer _K, infer _S>
  ? true
  : T extends readonly unknown[]
  ? false
  : T extends object
  ? true extends {
      [K in keyof T]-?: ContainsEntityMapMarker<T[K]>;
    }[keyof T]
    ? true
    : false
  : false;

/**
 * Preserve existing source admission: collection-containing construction
 * branches remain excluded. Their corrected hydration typing does not expand
 * Link admission. A collection itself continues to synchronize its row array.
 *
 * Optional private type metadata records construction, without a runtime brand.
 * Sources without that metadata retain the existing natural-value check.
 * Rejection stays on the source parameter, including subscribe-only endpoints.
 */
export type TruthfulLinkSource<S> = ContainsEntityMapMarker<
  ResolveLeafDefinitions<ConstructionOf<S, NaturalValue<S>>>
> extends true
  ? never
  : S;

/**
 * Read/write accessors resolved from the NODE, not configured by the caller.
 *
 * ```text
 * collection   read all()      write setAll(value)
 * location     read source()   write source(value)
 * ```
 */
function accessorsFor<T>(x: unknown): {
  read: () => T;
  write: (value: T) => void;
  /** True for an `EntitySignal` source, whose NaturalValue is `Row[]`. */
  collection: boolean;
} {
  const node = x as {
    all?: () => T;
    setAll?: (v: T) => void;
  };

  // THE ROOT ACCESSOR, checked FIRST: it is a plain object, so every later
  // branch misreads it — the callable fallback is what produced
  // "x is not a function". Its canonical value is the whole-tree snapshot, and
  // the tree itself both reads and writes that. Only an explicitly recorded
  // SignalTree root matches; arbitrary objects do not become readable.
  const rootTree = getRootTree(x);
  if (rootTree) {
    return {
      read: () => rootTree.read() as T,
      write: (v: T) => rootTree.replace(v),
      collection: false,
    };
  }

  if (isNodeAccessor(x)) {
    return {
      read: () => x() as T,
      write: (value: T) => x(value),
      collection: false,
    };
  }

  // The functions are captured rather than re-read behind a non-null
  // assertion: `node` is a loose cast, so a `typeof` guard on the property does
  // not narrow the property itself on later access.
  const all = node.all;
  const setAll = node.setAll;
  if (typeof all === 'function' && typeof setAll === 'function') {
    return {
      read: () => all(),
      write: (v: T) => setAll(v),
      collection: true,
    };
  }

  if (isWritableLocation(x)) {
    return {
      read: () => (x as () => T)(),
      write: (value: T) => replaceLocation(x as Location<T>, value),
      collection: false,
    };
  }

  return {
    read: () => (x as () => T)(),
    write: (v: T) => (x as (v: T) => void)(v),
    collection: false,
  };
}

export function link<S>(
  source: TruthfulLinkSource<S>,
  endpoint: LinkEndpoint<NaturalValue<S>>
): Link {
  type T = NaturalValue<S>;
  const x = source as unknown;

  // ⚠️ THE X CONSTRAINT, ENFORCED HERE. A registry is what makes this a location
  // the tree owns and can settle — a bare signal or a computed has none.
  const registry = getPositionRegistry(x);
  if (!registry) {
    throw new Error(
      'link: X must be an owned SignalTree location. A bare signal() or ' +
        'computed() has no owning tree, so there is nothing to settle against.'
    );
  }

  // ⚠️ AN EMPTY ENDPOINT IS REFUSED. Earned by DEMARCATION-0: a link with no
  // direction synchronizes nothing, and silently returning an inert handle
  // means `settled()` resolves and `retrieve()` throws for a reason the caller
  // did not cause. Fail where the mistake was written.
  if (!endpoint.get && !endpoint.set && !endpoint.subscribe) {
    throw new Error(
      'link: the endpoint must supply at least one of get, set or ' +
        'subscribe — a link with no direction synchronizes nothing.'
    );
  }

  const { read, write, collection } = accessorsFor<T>(x);
  const entityLocation = getEntityLocationBinding(x);
  const sourceAddress = getNodeAddress(x);
  if (!entityLocation && sourceAddress === undefined) {
    throw new Error('link: the owned source has no structured address.');
  }

  /**
   * Acquired after admission checks. If endpoint subscription throws below,
   * dispose releases this claim along with the notifier subscriptions.
   *
   * Ordinary leaves inside this source are armed on the first claim and share
   * one physical publication with any other relationship over the same leaf.
   * A tree built with `mutation-capture` already intercepts its writes, so this
   * is a no-op there.
   */
  const releaseObservation = acquireObservation(x);
  const ownerPath = getOwnedOwnerPath(x) ?? '';
  const notifier = getPathNotifier();

  let knownY: { value: T } | undefined;
  let disposed = false;
  let dirty = false;
  let chain: Promise<unknown> = Promise.resolve();
  let inboundSeq = 0;

  /**
   * THE EGRESS-ELIGIBLE PROJECTION — the complete value permitted to acquire
   * external authority. Earned by INSPECTION-EGRESS-0.
   *
   * Three concepts that the incumbent compressed into one, and must not be
   * recompressed:
   *
   *   local state       what the tree currently holds, including a devtools scrub
   *   eligible          the latest state permitted to become external truth
   *   knownY            what the endpoint has acknowledged
   *
   * Authored and restorative work keeps `local === eligible`. An INSPECTION
   * write moves local state and deliberately leaves `eligible` behind: a
   * developer looking at state B cannot make B externally authoritative. An
   * in-flight send keeps `eligible !== knownY` until it lands.
   *
   * ⚠️ RELATIONSHIP-CREATION ADOPTION. This `read()` is not a convenience — it
   * is the authority baseline. A relationship owns authority from the moment it
   * EXISTS, never retroactively, so an inspection value that predates this
   * `link()` call is legitimately adopted here. That does not reclassify the
   * value's provenance, which stays inspection-derived; it defines only what
   * this new relationship starts from. An inspection occurring AFTER creation
   * can never advance the projection (BASE-1 vs BASE-2).
   */
  let eligible: T = read();

  /**
   * A collection source keeps its eligible value as a SUBJECT-KEYED projection
   * rather than a patched `Row[]`. `Row[]` carries no identity, and a rekey
   * moves an address without touching the payload, so nothing in the value
   * itself can say which lifetime an event refers to.
   *
   * Seeded here, at the same RELATIONSHIP-CREATION ADOPTION boundary as
   * `eligible` above and from the same current truth.
   */
  const entityProjection: EntityEgressProjection | undefined = collection
    ? createEntityEgressProjection(getEntityProjectionSeed(x) ?? [])
    : undefined;

  /**
   * Scalar and branch sources advance their eligible value through shared
   * source-shape interpretation (`internals/source-mutation.ts`). Only the
   * AUTHORITY — `eligible` itself — belongs to Link.
   *
   * Deliberately NOT `read()`-based: re-reading current state after an eligible
   * notification is how inspection contamination re-enters, because batched
   * delivery means a later inspection write is already applied.
   *
   * Collection sources never reach here; they advance `entityProjection`.
   */
  /**
   * NESTED COLLECTIONS INSIDE A BRANCH SOURCE.
   *
   * ⚠️ REGRESSION REPAIR. A branch source's eligible value was patched purely by
   * path, so an entity mutation publishing at `dashboard.rows.<key>` was written
   * into the snapshot as `rows["<key>"]` while the collection's own `all` went
   * stale. The projection was treating a collection as ordinary
   * path-addressable structure — the same category error the `collection` gate
   * below prevents for a DIRECT collection source, never extended to one nested
   * inside a branch.
   *
   * Each nested collection therefore gets its OWN projection instance: same
   * algorithm as a direct collection source, separate state. Shared algorithm,
   * separate authority.
   *
   * ⚠️ AND NOT A RE-READ. The obvious repair — "a collection changed, so re-read
   * the branch" — produces the right SHAPE and destroys the reason this
   * projection exists: current branch state may hold an inspection-only change,
   * which a later eligible write would then carry outward. The nested
   * collection's ELIGIBLE value is adopted, never its current one.
   */
  type NestedCollection = {
    readonly projection: EntityEgressProjection;
    readonly relativeAddress: readonly string[];
  };
  const nestedCollections = new Map<number, NestedCollection>();
  const collectionSources = new Map<unknown, EntityEgressProjection>();
  if (entityProjection) collectionSources.set(x, entityProjection);
  if (!collection && !entityLocation) {
    const discover = (node: unknown): void => {
      if (!isTraversableNode(node)) return;
      const seed = getEntityProjectionSeed(node);
      if (seed) {
        const position = getOwnedPositionIds(node)?.[0];
        const address =
          position === undefined ? undefined : registry.addressFor(position);
        const relative =
          sourceAddress !== undefined && address !== undefined
            ? relativeSourceAddress(sourceAddress, address)
            : undefined;
        if (position === undefined || relative === undefined) return;
        const projection = createEntityEgressProjection(seed);
        nestedCollections.set(position, {
          projection,
          relativeAddress: relative,
        });
        collectionSources.set(node, projection);
        return; // its interior is its own business
      }
      for (const key of Object.keys(node as Record<string, unknown>)) {
        discover((node as Record<string, unknown>)[key]);
      }
    };
    discover(x);
  }

  /** Write only the collection's eligible value at its structural address. */
  const advanceNested = (nested: NestedCollection): void => {
    eligible = applyAtRelativePath(eligible, nested.relativeAddress, {
      all: nested.projection.value(),
    });
  };

  /**
   * WAITERS, NOT A COUNTER - earned by LINK-HANDLE-0.
   *
   * The first `settled()` polled a count across microtasks, so a settlement
   * arriving on a MACROTASK could never be observed and the loop hit its own
   * guard. Measured: it failed the moment a test confirmed via `setTimeout`.
   *
   * Each HELD observation - marked dirty and handed to the settlement authority
   * but not yet released - owns a promise that resolves when the authority
   * releases it, so `settled()` waits on a signal instead of spinning.
   */
  const held = new Set<{ promise: Promise<void>; resolve: () => void }>();
  // Distinct relationships may share a source, but never a collapse key.
  const consequenceKey = {};
  // Send admission must not replace a queued flush (or another relationship).
  const sendConsequenceKey = {};
  const waitingSends = new Set<() => void>();
  const settlementWaiters = new Set<() => void>();
  const pendingOrders = new Set<{
    promise: Promise<void>;
    resolve: () => void;
  }>();

  /**
   * In-flight retrievals, as RELEASE SIGNALS rather than a counter - same
   * reason as `held`.
   *
   * LINK-HANDLE-1 chose INCLUDED over EXCLUDED: `settled()` means "this
   * relationship has no link-owned work in progress or held", and `retrieve()`
   * is work the link INITIATED AND OWNS. Having its own promise is not
   * sufficient to exclude it - per-operation promises and whole-object idle
   * promises routinely coexist.
   *
   * The deciding argument is that an excluded `retrieve()` can MUTATE X after
   * `settled()` has already returned, which is misleading in exactly the way
   * the WEAK outbound reading was.
   */
  const retrievals = new Set<{ promise: Promise<void>; resolve: () => void }>();

  /**
   * Inbound Y -> X.
   *
   * `external()` marks the write as coming from outside so it is not mistaken
   * for an authored mutation, and `seq` drops a stale emission that lost a race
   * to a newer one.
   */
  const acquire = (value: T, seq: number) => {
    if (disposed || seq < inboundSeq) return;
    inboundSeq = seq;
    knownY = { value };
    // ⚠️ INBOUND AUTHORITY IS DIRECT. Link already holds the complete inbound
    // value, so the projection is SET from it rather than reconstructed from
    // the leaf notifications that applying it will generate. External truth is
    // authoritative for this relationship — it is not inspection, and it is not
    // an authored mutation to be reduced.
    eligible = value;
    external(() => write(value));
    // ⚠️ AND THE SUBJECT SHADOW IS RESEEDED, not reduced. Applying inbound truth
    // may emit no notification at all when it coincides with what is already
    // shown (the I4 case), so the shadow is rebuilt from the post-apply
    // topology rather than inferred from events that may never arrive.
    if (entityProjection) {
      entityProjection.reseed(getEntityProjectionSeed(x) ?? []);
    }
  };

  const offSub = notifier.subscribe(
    '**',
    (v, prev, _path, _o, _origin, subjectIds, _pos, meta, _scopes, _owner, fields) => {
      if (disposed || !endpoint.set) return;
      // OWNER-PING-0. Two same-shaped trees give their collections the SAME
      // local position id, so identity is (registry, position) — never the
      // position alone.
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      // A value-less ping is a notification, not a state change.
      if (v === undefined && prev === undefined) return;
      if (entityLocation) {
        // Row and field locations follow an entity lifetime, never its current
        // key spelling. Notifications carry the complete row; project from that
        // captured payload so later inspection cannot contaminate outbound truth.
        if (
          _pos?.[0] !== entityLocation.owner ||
          subjectIds?.[0] !== entityLocation.subjectId ||
          isInspectionWrite(meta)
        )
          return;
        const effect = meta?.structuralEffect;
        if (effect?.kind === 'rekey') return;
        const removed = effect?.kind === 'remove';
        const footprint = effect?.kind === 'add' ? null : fields;
        if (!removed && footprint === undefined) return;
        if (entityLocation.fieldKey !== undefined) {
          if (
            !removed &&
            footprint !== null &&
            !footprint?.includes(entityLocation.fieldKey)
          ) return;
          eligible = (
            v != null &&
            Object.prototype.hasOwnProperty.call(v, entityLocation.fieldKey)
              ? (v as Record<string, unknown>)[entityLocation.fieldKey]
              : undefined
          ) as T;
        } else {
          const next = removed
            ? undefined
            : projectEntityFields(eligible, v, footprint);
          if (next === eligible) return;
          eligible = next as T;
        }
        dirty = true;
        return;
      }
      const position = _pos?.[0];
      const address =
        position === undefined ? undefined : registry.addressFor(position);
      const relative =
        sourceAddress !== undefined && address !== undefined
          ? relativeSourceAddress(sourceAddress, address)
          : undefined;
      if (relative === undefined) return;
      // ⚠️ INSPECTION DOES NOT ADVANCE EXTERNAL AUTHORITY. Local state has
      // already moved; the projection deliberately does not follow, and no
      // outbound work is armed. Keyed on PARTICIPATION, never on
      // `origin === 'devtools'` — provenance says where a write came from,
      // participation says which causal mechanisms it may take part in.
      const inspection = isInspectionWrite(meta);

      // A notification owned by a collection NESTED in this branch source.
      const nested =
        position === undefined ? undefined : nestedCollections.get(position);
      if (nested) {
        const effect = (meta as Record<string, unknown> | undefined)?.[
          'structuralEffect'
        ] as Parameters<EntityEgressProjection['apply']>[2];
        const advanced = nested.projection.apply(
          subjectIds?.[0],
          v,
          effect,
          inspection,
          fields
        );
        if (advanced) {
          advanceNested(nested);
          dirty = true;
        }
        return;
      }

      if (entityProjection) {
        // Inspection reaches the projection, but only to leave latent
        // structural context — CAUSAL DEPENDENCY ADOPTION. It never advances
        // authority, and `apply` says so by returning false.
        const effect = (meta as Record<string, unknown> | undefined)?.[
          'structuralEffect'
        ] as Parameters<EntityEgressProjection['apply']>[2];
        const advanced = entityProjection.apply(
          subjectIds?.[0],
          v,
          effect,
          inspection,
          fields
        );
        if (advanced) dirty = true;
        return;
      }
      if (inspection) return;
      eligible = applyAtRelativePath(eligible, relative, v);
      dirty = true;
    }
  );

  const sendEligible = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const cancel = () => {
        waitingSends.delete(cancel);
        resolve(false);
      };
      waitingSends.add(cancel);
      const attempt = () => {
        if (disposed) {
          cancel();
          return;
        }
        let synchronous = true;
        try {
          // No remaining work needs no permission. Read only the eligible
          // projection, once per attempt; deferred admission restarts here.
          const now = entityProjection
            ? (entityProjection.value() as unknown as T)
            : eligible;
          if (knownY !== undefined && deepEqual(now, knownY.value)) {
            cancel();
            return;
          }
          scheduleDurableConsequence({
            claimant: x as object,
            key: sendConsequenceKey,
            run: () => {
              if (!synchronous) {
                // Settlement can precede delivery of rollback notifications.
                // Resume after that turn, then ask the authority again: another
                // scope may have opened before this continuation runs.
                queueMicrotask(attempt);
                return;
              }
              waitingSends.delete(cancel);
              try {
                // Invoke inside the authority's callback. Awaiting permission
                // first would let a new scope open before the actual send.
                Promise.resolve(endpoint.set?.(now)).then(() => {
                  knownY = { value: now };
                  resolve(true);
                }, reject);
              } catch (error) {
                reject(error);
              }
            },
          });
        } catch (error) {
          waitingSends.delete(cancel);
          reject(error);
        } finally {
          synchronous = false;
        }
      };
      attempt();
    });

  /**
   * ⚠️ THE TURN BOUNDARY IS REQUIRED, not an optimization.
   *
   * Outbound writes are sent once per settled turn, so a transaction that is
   * rolled back never reaches the endpoint, and a multi-write turn sends one
   * value rather than an intermediate for each write.
   */
  const flushOutbound = () => {
    if (disposed || !dirty) return;
    dirty = false;
    // Registered BEFORE the consequence is scheduled, so an observation is
    // already visible to `settled()` while it waits behind settlement.
    // Replacing a queued callback must retain its release signal: callers of
    // settled() may already be waiting on it. Coalesced observations belong to
    // the same relationship and reconcile its latest eligible value on release.
    let entry = held.values().next().value;
    if (!entry) {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      entry = { promise, resolve };
      held.add(entry);
    }
    const pending = entry;

    scheduleDurableConsequence({
      claimant: x as object,
      key: consequenceKey,
      run: () => {
        held.delete(pending);
        pending.resolve();
        if (disposed) return;
        chain = chain
          .then(async () => {
            // LINK-RACE-1. Reconcile until X equals Y's acknowledged state.
            // Terminates on EQUALITY, not on a counter — a write that lands
            // while an earlier one is in flight is picked up by the next lap.
            for (;;) {
              if (disposed) return;
              // Each lap can follow an async acknowledgement or queued turn;
              // admission of the original flush cannot authorize this send.
              if (!(await sendEligible())) return;
            }
          })
          .catch((error) => {
            // LINK-2 case 3. A rejected outbound `set()` reaches the EXISTING
            // central reporter, so `Link` needs NO error surface of its own:
            // no `failures`, no error signal, no status. Reusing the reporter
            // is why the handle stays three members.
            //
            // ⚠️ PUBLICLY OBSERVABLE, as of ERROR-SURFACE-2:
            //
            //     Rejected outbound Link sends are publicly observable through
            //     `onTreeError`.
            //
            // ERROR-SURFACE-1 had blocked that claim on two counts, both now
            // measured closed: the event carries a REQUIRED `treeId`, so two
            // same-shaped trees are distinguishable; and the `source` union is
            // deleted rather than frozen into public API.
            //
            // The queue must SURVIVE the failure too. Otherwise one rejection
            // wedges the link forever, which is a retry policy's failure mode
            // arriving without a retry policy.
            reportTreeError({
              error,
              operation: 'link:set',
              treeId: registry.id,
              // ⚠️ `ownerPath` was already known here and previously dropped.
              // Location, never identity — two trees share this string.
              path: ownerPath === '' ? undefined : ownerPath,
            });
          });
      },
    });
  };
  const offFlush = notifier.onFlush?.(flushOutbound);

  // Order-only changes need no row notification. Consume their existing capture
  // channel, after earlier queued row notifications, then use the same durable
  // publication gate as every other eligible change.
  const releaseOrders: Array<() => void> = [];
  for (const [node, projection] of collectionSources) {
    const capture = getMutationCaptureRuntime(node);
    if (!capture?.subscribeCollectionOrder) continue;
    const releaseCapture = capture.activateCapture();
    const offOrder = capture.subscribeCollectionOrder((order) => {
      if (disposed || order.owner !== getOwnedPositionIds(node)?.[0]) return;
      const inspection = isInspectionWrite(order.meta);
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const pending = { promise, resolve };
      pendingOrders.add(pending);
      queueMicrotask(() => {
        try {
          if (disposed || !projection.reorder(order.afterSubjects, inspection))
            return;
          if (projection !== entityProjection) {
            const nested = nestedCollections.get(order.owner);
            if (nested) advanceNested(nested);
          }
          dirty = true;
          flushOutbound();
        } finally {
          pendingOrders.delete(pending);
          pending.resolve();
        }
      });
    });
    releaseOrders.push(() => {
      offOrder();
      releaseCapture();
    });
  }

  let offSource: (() => void) | undefined;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    // Release only this relationship's claim; overlapping links stay armed.
    releaseObservation();
    offSub();
    offFlush?.();
    for (const release of releaseOrders) release();
    // Release waiters before invoking user cleanup, which can throw or reenter.
    for (const h of held) h.resolve();
    held.clear();
    for (const cancel of waitingSends) cancel();
    waitingSends.clear();
    for (const release of settlementWaiters) release();
    settlementWaiters.clear();
    for (const order of pendingOrders) order.resolve();
    pendingOrders.clear();
    for (const r of retrievals) r.resolve();
    retrievals.clear();
    offSource?.();
  };
  try {
    offSource = endpoint.subscribe?.((v) => acquire(v, ++inboundSeq));
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    async retrieve() {
      if (!endpoint.get) {
        throw new Error('link: endpoint supplies no get().');
      }
      const seq = ++inboundSeq;
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const entry = { promise, resolve };
      retrievals.add(entry);
      try {
        acquire((await endpoint.get()) as T, seq);
      } finally {
        // `finally`, so a rejected get() releases the waiter too - otherwise a
        // failing endpoint would wedge every future `settled()`.
        retrievals.delete(entry);
        entry.resolve();
      }
    },
    async settled() {
      // STRONG, not `await chain`. LINK-HANDLE-0 measured that the weak form
      // means only "the chain I can currently see is drained", which misses
      // observations HELD behind settlement and anything a completed send
      // caused the reconciler to enqueue.
      for (;;) {
        if (disposed) return;
        // Observe retrievals before yielding to the chain, so a completed
        // acquisition cannot disappear from this wait before its caller's
        // follow-up write is delivered.
        if (retrievals.size > 0) {
          await Promise.race([...retrievals].map((r) => r.promise));
          continue;
        }
        const awaitedChain = chain;
        // Disposal releases the local wait, not the endpoint's operation or
        // acknowledgement. Remove each waiter when its chain drains as well.
        await new Promise<void>((resolve, reject) => {
          const release = () => {
            settlementWaiters.delete(release);
            resolve();
          };
          settlementWaiters.add(release);
          void awaitedChain.then(release, (error) => {
            settlementWaiters.delete(release);
            reject(error);
          });
        });
        if (disposed) return;
        // A retrieval started while awaiting the chain also belongs to us.
        if (retrievals.size > 0) continue;
        if (pendingOrders.size > 0) {
          await Promise.race([...pendingOrders].map((order) => order.promise));
          continue;
        }
        // An order capture can append a send while the previous chain drains.
        if (chain !== awaitedChain) continue;
        if (held.size === 0) break;
        // The RELEASE SIGNAL, not a poll. Every appended send is preceded by a
        // held observation, so this also carries the loop across work enqueued
        // behind a completed send.
        await Promise.race([...held].map((h) => h.promise));
      }
    },
    dispose,
  };
}
