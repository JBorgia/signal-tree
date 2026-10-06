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
import { getPositionRegistry } from './internals/position-registry';
import { acquireObservation } from './internals/observation-substrate';
import { isInspectionWrite } from './write-participation';
import {
  getEntityProjectionOrder,
  getEntityProjectionSeed,
} from './internals/entity-projection-seed';
import { activateEntityMembership } from './internals/entity-membership-inventory';
import { getActiveWriteContext } from './write-context';
import {
  createEntityEgressProjection,
  type EntityEgressProjection,
} from './internals/entity-egress-projection';
import { applyAtSegments } from './internals/source-mutation';
import { isNodeAccessor } from './internals/node-shape';
import { visitTree } from './internals/visit-tree';
import {
  applyPlainBranchMembership,
  plainBranchMembershipChange,
} from './internals/plain-branch-membership';
import { keysBelow } from './internals/member-membership';
import { registerLinkState } from './internals/link-state-view';
import { bindLinkToTree } from './internals/link-lifetime';
import { StudioTreeDestroyedError } from './internals/confirmed-turn-view';
import { getRootTree } from './internals/root-source';
import {
  hasOpenCommitScope,
  scheduleDurableConsequence,
  withdrawHeldConsequence,
} from './internals/commit-consequence';
import type { EntityMapBuilder } from './markers/entity-map';
import type { NodeAccessor } from './node-accessor';

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
  /**
   * Resolves when every outbound write in flight has been acknowledged,
   * including one caused by a write still queued for delivery.
   */
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

/**
 * Does this declared value still contain a CONSTRUCTION MARKER?
 *
 * ⚠️ LINK-MATERIALIZED-VALUE-0 measured that a branch containing an `entityMap`
 * declares `{ users: EntityMapBuilder<...> }` while its runtime state reads
 * `{ users: { all: User[] } }` and accepts either shape on write. The declared
 * type therefore matches NEITHER side — it names the thing you PASS IN at
 * construction, not the state the tree synchronizes.
 *
 * > **construction marker type != synchronized runtime state type**
 */
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
 * A source whose declared natural value is TRUTHFUL.
 *
 * ⚠️ The rule is about TYPE TRUTHFULNESS, not topology. It is deliberately NOT
 * "exclude the root": a root with no collection is admitted, and a nested BRANCH
 * containing one is rejected. `tree.$.nested` was measured exactly as untruthful
 * as the root, and `tree.$.plain` exactly as truthful.
 *
 * ⚠️ It rejects at the SOURCE parameter rather than by collapsing the endpoint
 * value to `never`, so a subscribe-only or oddly inferred endpoint cannot sneak
 * an untruthful source through.
 *
 * The escape hatch is not a flag — it is to link the collection ITSELF, which
 * has a correct public value:
 *
 * ```ts
 * link(tree.$.nested.users, endpoint)   // User[], truthful
 * ```
 */
export type TruthfulLinkSource<S> = ContainsEntityMapMarker<
  NaturalValue<S>
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

  // ⚠️ A DESTROYED TREE IS REFUSED (15.4.4), as every v15 reader refuses one:
  // a dead tree and an idle relationship are different facts, and a handle
  // that can never send would still report settled(). Before any claim.
  if (registry.closed) {
    throw new StudioTreeDestroyedError(
      'STUDIO_TREE_DESTROYED: link: this tree was destroyed, so there is ' +
        'nothing to synchronize. link() refuses rather than returning a ' +
        'relationship that can never send.'
    );
  }

  const { read, write, collection } = accessorsFor<T>(x);

  /**
   * ⚠️ ACQUIRED AFTER EVERY REJECTION PATH. The ownership guard and the
   * empty-endpoint refusal both throw above, so a rejected `link()` cannot
   * strand an observation claim: FAILED CONSTRUCTION LEAVES NO CLAIM.
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
  let queued = 0;
  let sending = false;

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
    ? createEntityEgressProjection(
        getEntityProjectionSeed(x) ?? [],
        getEntityProjectionOrder(x)
      )
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
  // Addresses come from actual property keys and owned positions. A dotted
  // display path cannot distinguish data['a.b'] from data.a.b.
  type LinkedAddress = {
    segments: readonly string[];
    projection?: EntityEgressProjection;
  };
  const addresses = new Map<number, LinkedAddress>();
  // Every collection nested in this source, with the projection it advances.
  const nestedCollections: Array<{
    node: object;
    address: LinkedAddress & { projection: EntityEgressProjection };
  }> = [];
  const segmentsByNode = new WeakMap<object, readonly string[]>();
  visitTree(
    x,
    (node, _path, key, parent) => {
      // An omitted optional member retains its owned location. Index it too;
      // function implementation properties are not state locations.
      const seed = getEntityProjectionSeed(node);
      if (
        node !== x &&
        seed === undefined &&
        getOwnedOwnerPath(node) === undefined
      )
        return false;
      const segments =
        key === null
          ? []
          : [...(segmentsByNode.get(parent as object) ?? []), key];
      segmentsByNode.set(node as object, segments);
      const address: LinkedAddress = {
        segments,
        projection:
          seed && node !== x
            ? createEntityEgressProjection(seed, getEntityProjectionOrder(node))
            : undefined,
      };
      if (address.projection)
        nestedCollections.push({
          node: node as object,
          address: address as LinkedAddress & {
            projection: EntityEgressProjection;
          },
        });
      for (const position of getOwnedPositionIds(node) ?? [])
        addresses.set(position, address);
      if (seed || (isWritableLocation(node) && !isNodeAccessor(node)))
        return false;
      return true;
    },
    { maxDepth: Infinity, includeNonEnumerable: true }
  );

  const advanceEligible = (address: LinkedAddress, value: unknown): void => {
    eligible = applyAtSegments(eligible, address.segments, value);
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
  // Distinct relationships may share a source, but never a collapse key. With
  // the shared `link` function as the key, a second relationship's flush
  // replaced the first one's held consequence while any transaction was open:
  // the first endpoint never received its value and its settled() never
  // resolved. (Main's link.ts made this change together with the shared
  // release signal below; the 15.x port first took only the signal.)
  const consequenceKey = {};

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
  // Only active settlement waiters are retained; disposal releases their wait,
  // without cancelling an endpoint operation already running externally.
  const settlementWaiters = new Set<() => void>();
  const observation = registerLinkState(registry, (id) => ({
    id,
    path: ownerPath,
    positions: getOwnedPositionIds(x) ?? [],
    directions: {
      get: !!endpoint.get,
      set: !!endpoint.set,
      subscribe: !!endpoint.subscribe,
    },
    dirty,
    held: held.size > 0,
    queued,
    sending,
    retrieving: retrievals.size,
    disposed,
  }));

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
    (v, prev, _path, _o, _origin, subjectIds, positions, meta) => {
      if (disposed || !endpoint.set) return;
      // OWNER-PING-0. Two same-shaped trees give their collections the SAME
      // local position id, so identity is (registry, position) — never the
      // position alone.
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      const membership = plainBranchMembershipChange(meta);
      if (membership) {
        if (isInspectionWrite(meta)) return;
        const segments = segmentsByNode.get(membership.branch);
        if (segments !== undefined) {
          eligible = applyPlainBranchMembership(eligible, segments, membership);
        } else {
          // A member at or above X changed: X now reads what that change
          // installed, or nothing while it, or a member above it, is
          // omitted. The endpoint gets what the tree exposes, `undefined`
          // (`[]` for a collection), never retained storage (v15 port
          // review, item 4).
          const below = keysBelow(membership.branch, x);
          const member =
            below && membership.members.find(({ key }) => key === below[0]);
          if (!member) return;
          let value = member.after.present ? member.after.value : undefined;
          for (const key of (below as string[]).slice(1))
            value =
              value !== null &&
              typeof value === 'object' &&
              Object.prototype.hasOwnProperty.call(value, key)
                ? (value as Record<string, unknown>)[key]
                : undefined;
          eligible = value as T;
          entityProjection?.reseed(getEntityProjectionSeed(x) ?? []);
        }
        // A nested collection at or below a changed member reads its rows
        // now (none while omitted): its projection restarts from them, and a
        // present one gives the value its rows. Others keep their eligible
        // rows, which an inspection write must not move.
        for (const { node, address } of nestedCollections) {
          if (
            segments !== undefined &&
            !membership.members.some(
              ({ key }) =>
                address.segments[segments.length] === key &&
                segments.every((step, at) => address.segments[at] === step)
            )
          )
            continue;
          address.projection.reseed(getEntityProjectionSeed(node) ?? []);
          let at: unknown = eligible;
          for (const key of address.segments.slice(0, -1))
            at =
              at !== null && typeof at === 'object'
                ? (at as Record<string, unknown>)[key]
                : undefined;
          if (
            at !== null &&
            typeof at === 'object' &&
            Object.prototype.hasOwnProperty.call(
              at,
              address.segments[address.segments.length - 1]
            )
          )
            advanceEligible(address, { all: address.projection.value() });
        }
        dirty = true;
        observation.publish();
        return;
      }
      const address = positions
        ?.map((position) => addresses.get(position))
        .find((value) => value !== undefined);
      if (!address) return;
      // A value-less ping is a notification, not a state change.
      if (v === undefined && prev === undefined) return;
      // ⚠️ INSPECTION DOES NOT ADVANCE EXTERNAL AUTHORITY. Local state has
      // already moved; the projection deliberately does not follow, and no
      // outbound work is armed. Keyed on PARTICIPATION, never on
      // `origin === 'devtools'` — provenance says where a write came from,
      // participation says which causal mechanisms it may take part in.
      const inspection = isInspectionWrite(meta);

      // A notification owned by a collection NESTED in this branch source.
      const nested = address.projection;
      if (nested) {
        const effect = (meta as Record<string, unknown> | undefined)?.[
          'structuralEffect'
        ] as Parameters<EntityEgressProjection['apply']>[2];
        const advanced = nested.apply(subjectIds?.[0], v, effect, inspection);
        if (advanced) {
          advanceEligible(address, { all: nested.value() });
          dirty = true;
          observation.publish();
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
          inspection
        );
        if (advanced) {
          dirty = true;
          observation.publish();
        }
        return;
      }
      if (inspection) return;
      advanceEligible(address, v);
      dirty = true;
      observation.publish();
    }
  );

  /**
   * ⚠️ THE TURN BOUNDARY IS REQUIRED, not an optimization.
   *
   * Outbound writes are sent once per settled turn, so a transaction that is
   * rolled back never reaches the endpoint, and a multi-write turn sends one
   * value rather than an intermediate for each write.
   */
  const scheduleSend = () => {
    if (disposed || !dirty) return;
    dirty = false;
    // Registered BEFORE the consequence is scheduled, so an observation is
    // already visible to `settled()` while it waits behind settlement.
    //
    // The consequence below is keyed, so a later flush REPLACES a still-held
    // one and only the last run() ever executes. A fresh release signal per
    // flush therefore orphaned every earlier one, and `settled()` waited on
    // them forever. Coalesced observations belong to one relationship and are
    // reconciled together on release, so they share one signal. Together with
    // the per-relationship `consequenceKey`, this is main's repair.
    let entry = held.values().next().value as
      | { promise: Promise<void>; resolve: () => void }
      | undefined;
    if (!entry) {
      let releaseHeld!: () => void;
      const heldPromise = new Promise<void>((r) => (releaseHeld = r));
      entry = { promise: heldPromise, resolve: releaseHeld };
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
        queued++;
        chain = chain
          .then(async () => {
            queued--;
            // Publish after entering I/O or completing reconciliation, never
            // between removal from the queue and the first endpoint call.
            try {
              // LINK-RACE-1. Reconcile until X equals Y's acknowledged state.
              // Terminates on EQUALITY, not on a counter — a write that lands
              // while an earlier one is in flight is picked up by the next lap.
              for (;;) {
                if (disposed) return;
                // ⚠️ THE PROJECTION, NOT CURRENT LOCAL STATE. Re-read each
                // lap so a write landing mid-flight is still picked up — that is
                // LINK-RACE-1 and it is preserved. What changed is WHAT is
                // reconciled: an inspection write that moved local state cannot
                // enter here, because it never advanced `eligible`.
                const now = entityProjection
                  ? (entityProjection.value() as unknown as T)
                  : eligible;
                if (knownY !== undefined && deepEqual(now, knownY.value))
                  return;
                // A scope may have opened while this send waited in the chain,
                // or while the previous endpoint call was in flight. Re-enter
                // the consequence authority before sending any newer value.
                // Use commit scopes, not pending transaction handles: v15
                // releases consequences even when explicit rollback refuses.
                if (hasOpenCommitScope(x as object)) {
                  dirty = true;
                  scheduleSend();
                  return;
                }
                sending = true;
                observation.publish();
                try {
                  if (disposed) return;
                  await endpoint.set?.(now);
                  knownY = { value: now };
                } finally {
                  sending = false;
                }
              }
            } finally {
              observation.publish();
            }
          })
          .catch((error) => {
            observation.publish('send-failed');
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
        observation.publish();
      },
    });
    observation.publish();
  };

  /**
   * A delivery is complete: place any collection row still held for
   * neighbours later in that delivery which never arrived (15.4.4, see
   * `createEntityTopology`). Runs before the turn's send is scheduled, so a
   * held row is never published out of place or left out.
   */
  const settleCollections = () => {
    if (disposed || !endpoint.set) return;
    let settled = entityProjection?.settle() ?? false;
    for (const { address } of nestedCollections) {
      if (!address.projection.settle()) continue;
      advanceEligible(address, { all: address.projection.value() });
      settled = true;
    }
    if (!settled) return;
    dirty = true;
    observation.publish();
  };
  const offFlush = notifier.onFlush?.(() => {
    settleCollections();
    scheduleSend();
  });

  /**
   * ORDER-ONLY CHANGES (15.4.4). A reorder of surviving rows publishes no row
   * notification that carries order, so since 15.3.1 or earlier a linked
   * endpoint kept ABCD after `setAll([D,C,B,A])`.
   *
   * Each linked collection's membership inventory, on its ORDER tier only,
   * reports the complete order after a `setAll()`, a prepend and every undo,
   * redo, jump and rollback. The order tier leaves full membership unobserved,
   * so linking a collection does not make its other structural operations
   * build membership records. The collection-order capture channel 16.x subscribes to is
   * published only by a forward `setAll()`: following it alone sends DCBA and
   * then leaves the endpoint there when undo or rollback restores ABCD.
   *
   * Delivered synchronously as the change commits, ahead of that write's
   * queued row notifications. Local order adopts it at once; rows added
   * earlier in the tick are then found already placed, and later adds name
   * neighbours in the new order. Participation is the write's own ambient
   * context, the same one its row notifications carry: inspection moves local
   * order only. No send is requested here: every reordering operation also
   * queues row notifications for that collection, and the flush delivering
   * them schedules the turn's send as for any other change.
   */
  const releaseOrders: Array<() => void> = [];
  const followOrder = (
    node: object,
    projection: EntityEgressProjection,
    address?: LinkedAddress
  ) => {
    let release: (() => void) | undefined;
    try {
      // The ORDER tier only: subscribing here leaves full membership
      // unobserved, so the collection builds no add/remove/rekey records for
      // this relationship, only the `reorder` it reads.
      release = activateEntityMembership(node)?.subscribeOrder(({ after }) => {
        if (disposed) return;
        const inspection = isInspectionWrite(getActiveWriteContext());
        if (!projection.reorder(after, inspection)) return;
        if (address) advanceEligible(address, { all: projection.value() });
        // No link-state publication here: this runs inside the entity write,
        // and the flush that follows publishes when it schedules the send.
        dirty = true;
      });
    } catch {
      // A closed inventory belongs to a destroyed tree, and one inside a
      // structural commit cannot take a subscriber: no order to follow.
    }
    if (release) releaseOrders.push(release);
  };
  if (endpoint.set) {
    if (entityProjection) followOrder(x as object, entityProjection);
    for (const { node, address } of nestedCollections)
      followOrder(node, address.projection, address);
  }

  let offSource: (() => void) | undefined;
  try {
    offSource = endpoint.subscribe?.((v) => acquire(v, ++inboundSeq));
  } catch (error) {
    // Construction did not return a handle. Release every acquired resource;
    // a failed endpoint subscription is not an active relationship.
    disposed = true;
    releaseObservation();
    offSub();
    offFlush?.();
    for (const release of releaseOrders) release();
    withdrawHeldConsequence(x as object, consequenceKey);
    for (const pending of held) pending.resolve();
    held.clear();
    observation.forget();
    throw error;
  }
  observation.publish('created');

  const drain = async () => {
    // STRONG, not `await chain`. LINK-HANDLE-0 measured that the weak form
    // means only "the chain I can currently see is drained", which misses
    // observations HELD behind settlement and anything a completed send
    // caused the reconciler to enqueue.
    for (;;) {
      if (disposed) return;
      const observedChain = chain;
      await observedChain;
      if (disposed) return;
      // A queued notifier flush can append a send while this await yields.
      // Its held signal is released when enqueued, not when the endpoint
      // finishes. Re-check chain identity before declaring the link idle.
      if (chain !== observedChain) continue;
      // Retrieval first: an acquisition can enqueue outbound work, so
      // draining the chain before the retrieval lands would miss it.
      if (retrievals.size > 0) {
        await Promise.race([...retrievals].map((r) => r.promise));
        continue;
      }
      if (held.size === 0) {
        // REACTIVE WRITES (15.4.4, ported from 16.x b6633617). A subscriber
        // handling an earlier write may have written again; that write is
        // still queued and reaches this relationship only at a later flush,
        // one per hop, as does a write authored after settled() in this same
        // turn. Await that flush (a microtask, never I/O) and look again. The
        // queue is shared by every tree, deliberately: a hop can pass through
        // another tree. Another relationship's endpoint work stays its own.
        if (!notifier.hasPending()) break;
        await new Promise<void>((resolve) => {
          const off = notifier.onFlush(() => {
            off();
            resolve();
          });
        });
        continue;
      }
      // The RELEASE SIGNAL, not a poll. Every appended send is preceded by a
      // held observation, so this also carries the loop across work enqueued
      // behind a completed send.
      await Promise.race([...held].map((h) => h.promise));
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    unbindTree();
    // Releases only THIS relationship's claim. A leaf shared with another
    // Link stays armed for it; the last release returns the leaf to dormant.
    releaseObservation();
    offSub();
    offFlush?.();
    for (const release of releaseOrders) release();
    // Its held consequence would only no-op now, but it keeps this whole
    // relationship reachable until the tree's transactions settle.
    withdrawHeldConsequence(x as object, consequenceKey);
    // Release anyone already inside `settled()`: a disposed link owns no
    // further work, and a held observation's count never returns to zero on
    // its own.
    for (const release of settlementWaiters) release();
    settlementWaiters.clear();
    for (const h of [...held]) {
      held.delete(h);
      h.resolve();
    }
    for (const r of [...retrievals]) {
      retrievals.delete(r);
      r.resolve();
    }
    observation.publish('disposed');
    // User cleanup may throw; all owned state and waiters are already released.
    offSource?.();
  };
  // `tree.destroy()` disposes this relationship exactly as `dispose()` does
  // (15.4.4); see `internals/link-lifetime.ts`.
  const unbindTree = bindLinkToTree(registry, dispose);

  return {
    async retrieve() {
      if (disposed) return;
      if (!endpoint.get) {
        throw new Error('link: endpoint supplies no get().');
      }
      const seq = ++inboundSeq;
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const entry = { promise, resolve };
      retrievals.add(entry);
      observation.publish();
      try {
        if (disposed) return;
        acquire((await endpoint.get()) as T, seq);
      } catch (error) {
        observation.publish('retrieve-failed');
        throw error;
      } finally {
        // `finally`, so a rejected get() releases the waiter too - otherwise a
        // failing endpoint would wedge every future `settled()`.
        retrievals.delete(entry);
        entry.resolve();
        observation.publish();
      }
    },
    async settled() {
      if (disposed) return;
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      settlementWaiters.add(release);
      try {
        // Keep the drain's awaits intact: adding a microtask before its
        // retrieval check can miss work authored immediately after retrieve().
        await Promise.race([drain(), released]);
      } finally {
        settlementWaiters.delete(release);
      }
    },
    dispose,
  };
}
