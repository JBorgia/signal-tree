// TYPE-ONLY: this transitional package still names Angular's types publicly;
// the split rebinds them per package. No Angular VALUE remains in kernel utils.
import type { ReadableCell } from './internals/cell-runtime';
import { isTreeCell, markTreeCell } from './internals/cell-identity';
import { NEUTRAL_MATERIALIZATION_REALIZATION } from './internals/materialization-realization';
import {
  getTreeRealization,
} from './internals/tree-realization';
import {
  bindSnapshotParent,
  isSnapshotNode,
  materializeSnapshotNode,
} from './internals/snapshot-authority';

/**
 * Snapshot/apply walkers must recurse into anything that CARRIES state
 * reactively, which is two distinct facts — kept distinct:
 *
 *   isTreeCell          SignalTree explicitly acquired this cell. Neutral;
 *                       true with no framework present.
 *   isReactiveNode      the installed adapter recognises a FOREIGN reactive
 *                       value the consumer created and stored as state. Only
 *                       an adapter can know its own objects, and such values
 *                       exist only when one is installed, so this degrades to
 *                       `false` in a neutral kernel and stays correct.
 *
 * Combining them HERE keeps cell ownership from being redefined as "anything
 * reactive" — the conflation that `isAnySignal` died of. Local to this file
 * because these walkers are its only users.
 */
function isReactiveStateValue(value: unknown, owner: unknown = value): boolean {
  if (isTreeCell(value)) return true;
  if (typeof value !== 'function') return false;
  return (
    getTreeRealization(owner)?.materialization.isReactiveNode(value) ??
    NEUTRAL_MATERIALIZATION_REALIZATION.isReactiveNode(value)
  );
}
import { deepEqual, isBuiltInObject, parsePath } from '@signaltree/shared';
import { dormantKeys, hasDormantMembers } from './internals/member-membership';
import {
  hydrateMarkerNode,
  snapshotMarkerNode,
} from './internals/materialize-markers';

declare const ngDevMode: boolean | undefined;

/**
 * @internal Dev-mode notice that a snapshot silently omitted a value.
 *
 * Deliberately NOT deduped. An earlier version keyed a suppression Set on the
 * bare property name, so the first `value`/`id`/`name` anywhere in the process
 * silenced every later one — including in a different tree — for the process
 * lifetime, hiding the second instance of every bug it found. Repeating in dev
 * is the lesser evil, and it also stops the Set growing without bound.
 */
function warnUnwrapSkipped(key: string): void {
  console.error(
    `SignalTree: "${key}" OMITTED from snapshot — value is a function that is ` +
      `neither signal nor node accessor. [ST2008]`
  );
}

/** @internal Dev-mode notice that applyState clobbered a live node. Not deduped — see above. */
function warnApplyStateOverwrite(key: string, target: unknown): void {
  if (typeof target !== 'function') return;
  console.error(
    `SignalTree: applyState REPLACED the live value at "${key}" with a raw ` +
      `value; its signal is gone. [ST2009]`
  );
}

// HISTORY_EXCLUDED, pruneHistoryExcluded(), prunedEqual() and pruneUncached()
// were DELETED in 15.0 with `entityMap({ recordHistory: false })`.
//
// TOMBSTONE, because the deletion is larger than one option. `recordHistory`
// implemented location-scoped history — the HIST-B model — which HIST-0 case 4
// refuted and which was then measured partially reversing an atomically authored
// turn: a turn writing a document field and an excluded collection reversed only
// the document half. Opt-in eligibility (`undoable()`) leaves it no semantic
// role, so it goes rather than being carried.
//
// The prune machinery existed ONLY to service it, along with a bug class of its
// own: a write to an excluded collection still made a new root, and pruning
// copied every node on the path down to the excluded key, so two snapshots
// differing only inside excluded state were structurally identical and
// referentially distinct. The `===` dedupe missed them and each became a PHANTOM
// entry — `canUndo()` true, undo changes nothing visible, and the user spends a
// step they never took. `prunedEqual` was the walk that guarded that.
//
// Do not reintroduce location-scoped exclusion. Eligibility belongs to the
// authored operation; see `undoable()`.

/** Symbol to mark callable signals - must match symbol used by signal-tree */

/**
 * SignalTree Utility Functions v1.1.6
 * Core utilities for signal tree operations
 */

export { deepEqual };
// `export { deepEqual as equal }` was REMOVED in 14.1.1. See
// shared/src/lib/deep-equal.ts for why: `equal` is the OPTION key throughout the
// library and cannot also be a function export.
export { isBuiltInObject };
export { parsePath };

/**
 * Check if a value is an EntityMapMarker
 * Used to preserve entity map markers during lazy signal tree creation
 */
export function isEntityMapMarker(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { __isEntityMap?: unknown }).__isEntityMap === true
  );
}

/**
 * Generic memory manager interface for lazy signal trees
 */
// `MemoryManager` lived here and is DELETED in 15.0. It described the shape of
// `SignalMemoryManager`, the cache behind the lazy proxy, and nothing else ever
// implemented or consumed it.

// NodeAccessor and TreeNode are defined in ./types.ts (canonical location)
import type { NodeAccessor, TreeNode } from './types';

/**
 * Checks if a value is a node accessor created by makeNodeAccessor
 */

/**
 * Checks if a value is either an Angular signal or a callable signal
 * This is useful for packages that need to work with both types
 */
/**
 * Checks if a value is a non-null object or function — the permissive
 * "can this have own enumerable children worth recursing into" test that
 * every hand-written tree walker in this codebase needs. Node accessors and
 * leaf signals are callable (`typeof === 'function'`); plain nested state
 * literals are plain objects (`typeof === 'object'`) — a walker that only
 * accepts one of the two silently skips half the tree.
 *
 * This is intentionally broader than {@link isNodeAccessor} or
 * {@link isNodeAccessor}, which checks for a *specific* shape. Use this as the
 * "should I keep walking?" guard before those narrower checks decide what
 * to do with the value.
 *
 * Typed as a guard narrowing to `object` (which in TypeScript includes
 * callables), so callers can pass the value to `Object.keys()` /
 * `WeakSet#has()` without re-asserting what the guard already proved.
 */

// Structural predicate extracted to a framework-neutral module so a neutral
// consumer can reach it; re-exported here so the public surface is unchanged.
import {
  isTraversableNode,
  isNodeAccessor,
  snapshotNodeKey,
} from './internals/node-shape';

// Structural guards live in a framework-neutral module so neutral consumers can
// reach them; re-exported here so the public surface is unchanged.
export { isTraversableNode, isNodeAccessor } from './internals/node-shape';

/**
 * A node is reachable two ways — as the accessor (`tree.$.a`) and as the raw
 * store the accessor wraps — and both materialise the same subtree. Keying the
 * memo on the STORE collapses them onto one cache entry, so `tree.$()` and
 * `unwrap(tree.$.a)` hand back the SAME object rather than two equal copies.
 * Without this the structural sharing silently splits in half.
 */
/**
 * Only GENUINE tree nodes may be memoised.
 *
 * A `computed` over a non-reactive plain object has no dependencies, so it never
 * invalidates and the snapshot is stale forever. `snapshotState()` is public and
 * takes `unknown`, so without this guard any caller handing it a plain object —
 * a mock in a test, a detached sub-object, a hand-built state bag — would get a
 * value frozen at first read, silently and permanently.
 *
 * A WeakSet rather than a stamped symbol: `unwrap` copies own symbol keys into
 * the snapshot, so a marker property would leak into every materialised result.
 */
function isMemoisable(node: object): boolean {
  return isSnapshotNode(node);
}

/**
 * @internal Reactive observation of a branch's MEMBERSHIP SET.
 *
 *     MEMBERSHIP-SET OBSERVATION BELONGS TO THE CONTAINER WHOSE MEMBERSHIP SET
 *     CHANGED.
 *
 * One carrier per MATERIALIZED branch — not one per child. "Which of my children
 * are semantically present" is a property of the container; no child slot can
 * represent it.
 *
 * ⚠️ THIS REPLACES A CACHE-DELETION APPROACH THAT WAS FALSIFIED.
 *
 *     INVALIDATING CACHE IDENTITY IS NOT REACTIVE INVALIDATION.
 *
 * The previous mechanism deleted the memo from its WeakMap. That changes what a
 * FUTURE caller receives and does nothing to a consumer already depending on the
 * old computed. Measured on a plain static tree: after `box({keep})` omitted
 * `drop`, a held `getDerivedRuntime().createDerived(() => box())` still reported `{keep, drop}` while
 * `drop()` correctly returned `undefined` — two observable answers to whether
 * `drop` exists.
 *
 * ⚠️ ALLOCATED AT FIRST MATERIALIZATION, NOT AT FIRST TRANSITION. Allocating on
 * the first membership change cannot work: a consumer established earlier never
 * depended on a signal that did not exist, so the transition cannot reach it.
 * Creating the carrier WITH the memo, and having the memo read it, means the
 * dependency exists before any transition can occur. A branch nobody ever
 * materializes allocates nothing — and can have no held consumer to wake.
 */
/**
 * @internal Materialise one tree node, memoised. This is the entry point the
 * tree callables use — see {@link materialized} for why it is a `computed`.
 */
export function materializeNode<T>(store: object): T {
  if (!isMemoisable(store)) return unwrap<T>(store);
  return materializeSnapshotNode(store, () => unwrap<T>(store));
}

/**
 * Marks a signal as DERIVED, so `unwrap()` leaves it out of every snapshot.
 *
 * A snapshot carries state. A derived value is by definition recomputable from
 * state, so freezing one into a payload produces a number that was true once —
 * the `map: {}` failure in a different costume: not absent data, WRONG data.
 *
 * Before this stamp, whether a derived appeared in the root snapshot depended on TOUCH
 * ORDER, which nothing documented and no test covered:
 *
 *   read the root first, never touch `$`  → absent   (correct, by accident)
 *   touch `$` first, then read the root    → PRESENT  (wrong)
 *
 * because `finalize()` (the `$` getter) applies configured derived state, while the
 * NaturalValue path reads the backing source store. Every real application
 * touches `$` before persistence, so derived values must remain accessor
 * structure rather than becoming snapshot data as a side effect of touch order.
 *
 * The `SignalTree:` prefix is load-bearing for the same reason it is on
 * `PROCESSOR_STAMP`: `unwrap`'s symbol loop skips that prefix by identity, so
 * the stamp itself can never leak into a payload.
 *
 * Only NON-WRITABLE signals are stamped. A writable carrier returned by
 * `config.derived` stays writable under `$`, but configured-derived ownership
 * still excludes it from the backing source store and NaturalValue snapshot.
 * Writability is an access capability, not snapshot authority.
 */
const DERIVED_STAMP = Symbol.for('SignalTree:Derived');

/** @internal Stamp a derived signal so snapshots skip it. Returns it. */
export function stampDerived<T>(sig: T): T {
  // ADOPTION PATH: an externally supplied derived signal that SignalTree takes
  // ownership of is a tree cell, even though this kernel did not mint it.
  // `DERIVED_STAMP` below records that it is DERIVED; cell identity is a
  // separate fact and is recorded separately.
  if (typeof sig === 'function') markTreeCell(sig as unknown as object);
  if (
    isTraversableNode(sig) &&
    typeof (sig as { set?: unknown }).set !== 'function'
  ) {
    Object.defineProperty(sig, DERIVED_STAMP, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
  return sig;
}

/**
 * Unwraps a signal or signal tree into a plain JS value shaped as T.
 * NOTE: Runtime strips the dynamic set/update helpers; call sites receive T.
 */
export function unwrap<T>(node: TreeNode<T>): T;
export function unwrap<T>(node: NodeAccessor<T> & TreeNode<T>): T;
export function unwrap<T>(node: NodeAccessor<T>): T;
export function unwrap<T>(node: unknown): T;
export function unwrap<T>(node: unknown): T {
  if (node === null || node === undefined) {
    return node as T;
  }

  // Handle callable signals first.
  //
  // ONE BUILDER. An accessor is materialised by walking its BACKING STORE, not
  // the accessor itself. There used to be a second builder (buildFromAccessor)
  // that walked the accessor, and because memoKey() resolves an accessor to its
  // store, both wrote to the SAME memo cell — so whichever entry point read a
  // node first decided its snapshot, permanently. That made ST2008 fire or not
  // depending on read order, and made the two builders disagree on symbol keys.
  //
  // The store direction is the correct one to keep, for three reasons:
  //   - a store carries NO own symbols, while an accessor carries its
  //     `SignalTree:NodeAccessor` and `SignalTree:NodeStore` brands, which a
  //     symbol-copying walk would stamp into every snapshot;
  //   - a store is a plain object, so the `length`/`name`/`prototype` intrinsic
  //     skip that only existed because an accessor IS a function is no longer
  //     needed;
  //   - the store walk takes a child accessor's materialisation BY REFERENCE
  //     (`value()`), where the accessor walk re-copied it via `unwrap()` and
  //     destroyed the structural sharing the memo exists to produce.
  if (isNodeAccessor(node)) {
    // Memoised per node — see materialized(). Clean subtrees are returned by
    // reference, so a one-leaf write does not rebuild the whole tree.
    // memoKey() IS the accessor->store resolution, so reusing it here is not a
    // convenience: it guarantees the object we BUILD FROM is the same object the
    // memo is KEYED ON. Two different answers to that question is what produced
    // the shared-cell bug in the first place.
    const target = snapshotNodeKey(node as object);
    return isMemoisable(node)
      ? materializeSnapshotNode(node, () => buildFromStore<T>(target))
      : buildFromStore<T>(target);
  }
  if (isReactiveStateValue(node)) {
    const value = (node as ReadableCell<unknown>)();
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      return unwrap(value) as T;
    }
    return value as T;
  }

  if (typeof node !== 'object') {
    return node as T;
  }

  if (Array.isArray(node)) {
    return node as T;
  }

  if (isBuiltInObject(node)) {
    return node as T;
  }

  return buildFromStore<T>(node as object);
}

/**
 * @internal THE builder. Every snapshot of a tree node is produced here —
 * `tree.$()`, `snapshotState()`, `unwrap()` of an accessor, and every nested
 * child — so there is exactly one place that decides what a property
 * contributes to a snapshot.
 *
 * This used to be two near-duplicate loops (this one, plus `buildFromAccessor`
 * for the accessor side) that shared a single memo cell and had already drifted:
 * only one of them carried the ST2008 diagnostic, and only one of them copied
 * symbol keys. See the comment on the accessor branch of `unwrap()`.
 */
function buildFromStore<T>(node: object): T {
  // A materialised marker snapshots itself — see snapshotMarkerNode().
  const own = snapshotMarkerNode(node);
  if (own) return own.value as T;

  const result = {} as Record<string, unknown>;

  // ⚠️ A RETAINED DORMANT CHILD MUST REMAIN CAPABLE OF INVALIDATING EVERY
  // OBSERVATION THAT WILL INCLUDE IT WHEN REACTIVATED.
  //
  // A dormant member is excluded from the VALUE below, which also removes it
  // from this snapshot's dependency set — so reactivating it would change the
  // node's value while nothing this computation reads has changed, leaving every
  // already-subscribed parent consumer permanently stale. Measured: a held
  // `getDerivedRuntime().createDerived(() => tree.$.user())` stayed at `{name:'Dave'}` after
  // `age.set(42)` reactivated the member.
  //
  // Reading each dormant child re-establishes the dependency on its EXISTING
  // per-slot publication token without contributing a value. Zero new reactive
  // state: the token already exists and the leaf already publishes through it.
  //
  //     DORMANT REPRESENTATION MAY LEAVE VALUE MEMBERSHIP,
  //     BUT NOT THE OBSERVATION GRAPH.
  //
  // ⚠️ SPECIALIZE THE RARE CASE. This is gated on a hint so an ordinary branch —
  // one that has never omitted a member — pays a single property lookup rather
  // than the all-own-properties + descriptor walk that would tax every read.
  if (hasDormantMembers(node)) {
    for (const key of dormantKeys(node)) {
      const dormant = (node as Record<string, unknown>)[key];
      if (typeof dormant === 'function') (dormant as () => unknown)();
    }
  }

  for (const key in node as Record<string, unknown>) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;

    const value = (node as Record<string, unknown>)[key];

    // NOTE: there was a name-based skip for `set`/`update` here. A leaf signal
    // IS a function, so it dropped state stored under those keys — `set` and
    // `update` are ordinary words (permission sets, an `update` timestamp) and
    // they vanished from every snapshot, every persisted payload and every
    // structuredClone, silently. The general plain-function skip below already
    // covers the case it was written for, and covers it by value rather than
    // by name.

    // A materialised marker may be an unbranded CALLABLE (form, asyncSource):
    // neither signal nor accessor, so the function-skip below would drop it and
    // its value with it. Ask the registry first — that is the whole reason
    // `snapshot()` exists.
    // A DERIVED value is recomputable from state, so it is not state. Freezing
    // one into a payload yields a number that was true once. Skipped silently:
    // this is the documented rule, not a mistake worth reporting.
    if (
      value &&
      (typeof value === 'function' || typeof value === 'object') &&
      (value as Record<symbol, unknown>)[DERIVED_STAMP] === true
    ) {
      continue;
    }

    const markerSnapshot = snapshotMarkerNode(value, node);
    if (markerSnapshot) {
      result[key] = markerSnapshot.value;
      continue;
    }

    if (
      typeof value === 'function' &&
      !isNodeAccessor(value) &&
      !isReactiveStateValue(value)
    ) {
      // Skip plain functions so snapshots stay plain-data — but SAY SO. A
      // materialized marker that is an unbranded callable (`form`,
      // `asyncSource`) lands here, so its value vanishes from the snapshot and
      // from everything built on one: serialize, persistence, devtools, audit,
      // restoration. ST2008 previously existed only on the accessor builder,
      // which is not the one that runs for a marker behind a store, so this
      // was silent in practice for the whole class it was written for.
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        warnUnwrapSkipped(key);
      }
      continue;
    }

    if (isNodeAccessor(value)) {
      bindSnapshotParent(value as object, node);
      // Take the child's materialisation AS IS. Calling `unwrap()` on it again
      // deep-copied a plain object that was already plain — pure waste, and it
      // destroyed the structural sharing the memo exists to produce: every
      // parent read minted a fresh copy of every child, so NO subtree was ever
      // reference-stable and a one-leaf write still cost O(state) downstream.
      // (The identical-looking recursion in the `isSignal` branch below IS
      // load-bearing: a leaf's VALUE is user data, and copying it is what keeps
      // a snapshot from aliasing live state.)
      result[key] = value();
    } else if (isReactiveStateValue(value)) {
      const unwrappedValue = (value as ReadableCell<unknown>)();
      if (
        typeof unwrappedValue === 'object' &&
        unwrappedValue !== null &&
        !Array.isArray(unwrappedValue) &&
        !isBuiltInObject(unwrappedValue)
      ) {
        result[key] = unwrap(unwrappedValue);
      } else {
        result[key] = unwrappedValue;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      result[key] = unwrap(value);
    } else {
      result[key] = value;
    }
  }

  const symbols = Object.getOwnPropertySymbols(node as object);
  for (const sym of symbols) {
    // Never copy SignalTree's own brands into a snapshot.
    //
    // A store carries no own symbols, so this cannot fire on the normal path —
    // it is defence-in-depth for the fallback where an accessor is walked
    // directly. An accessor owns `SignalTree:NodeAccessor` and
    // `SignalTree:NodeStore`, and the second one's VALUE IS THE BACKING STORE,
    // so copying it would drag a full walk of the store into the payload under
    // a symbol key.
    //
    // Descriptors are NOT a defence here: `Object.getOwnPropertySymbols`
    // returns non-enumerable symbols too, so marking a brand
    // `enumerable: false` does nothing. It has to be skipped by identity.
    // (Same hazard TREE_STORES is a WeakSet to avoid — see its comment.)
    if (
      typeof sym.description === 'string' &&
      sym.description.startsWith('SignalTree:')
    ) {
      continue;
    }

    const value = (node as Record<symbol, unknown>)[sym];

    // A DERIVED value is recomputable from state, so it is not state. Freezing
    // one into a payload yields a number that was true once. Skipped silently:
    // this is the documented rule, not a mistake worth reporting.
    if (
      value &&
      (typeof value === 'function' || typeof value === 'object') &&
      (value as Record<symbol, unknown>)[DERIVED_STAMP] === true
    ) {
      continue;
    }

    // Same as the string-key loop: ask the registry before skipping a callable.
    const markerSnapshotSym = snapshotMarkerNode(value, node);
    if (markerSnapshotSym) {
      (result as Record<symbol, unknown>)[sym] = markerSnapshotSym.value;
      continue;
    }

    if (
      typeof value === 'function' &&
      !isNodeAccessor(value) &&
      !isReactiveStateValue(value)
    ) {
      // Skip plain functions so snapshots stay plain-data. See the string-key
      // loop above for why this reports rather than vanishing.
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        warnUnwrapSkipped(String(sym));
      }
      continue;
    }

    if (isNodeAccessor(value)) {
      // Take the child's materialisation AS IS. Calling `unwrap()` on it again
      // deep-copied a plain object that was already plain — pure waste, and it
      // destroyed the structural sharing the memo exists to produce: every
      // parent read minted a fresh copy of every child, so NO subtree was ever
      // reference-stable and a one-leaf write still cost O(state) downstream.
      // (The identical-looking recursion in the `isSignal` branch below IS
      // load-bearing: a leaf's VALUE is user data, and copying it is what keeps
      // a snapshot from aliasing live state.)
      (result as Record<symbol, unknown>)[sym] = value();
    } else if (isReactiveStateValue(value)) {
      const unwrappedValue = (value as ReadableCell<unknown>)();
      if (
        typeof unwrappedValue === 'object' &&
        unwrappedValue !== null &&
        !Array.isArray(unwrappedValue) &&
        !isBuiltInObject(unwrappedValue)
      ) {
        (result as Record<symbol, unknown>)[sym] = unwrap(unwrappedValue);
      } else {
        (result as Record<symbol, unknown>)[sym] = unwrappedValue;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      (result as Record<symbol, unknown>)[sym] = unwrap(value);
    } else {
      (result as Record<symbol, unknown>)[sym] = value;
    }
  }

  return result as unknown as T;
}

/**
 * Snapshot the current tree state into a plain JS object by unwrapping signals.
 */
export function snapshotState<T>(state: TreeNode<T>): T {
  // Routed through the memo, not bare `unwrap`. Every snapshot consumer —
  // restoration, devtools, serialisation — was rebuilding the entire tree on
  // every call while `tree.$()` next door returned a memoised result, because
  // this took the raw store and `unwrap`'s uncached path.
  return state !== null && typeof state === 'object'
    ? materializeNode<T>(state as unknown as object)
    : (unwrap(state as unknown) as T);
  // materializeNode falls back to a plain walk for anything that is not a
  // registered tree store or a node accessor — see isMemoisable().
}

/**
 * Apply a plain JS snapshot onto a TreeNode (state.$) by writing into signals or node accessors.
 * This is a shallow/apply operation suitable for devtools/restoration use-cases.
 */
export function applyState<T>(stateNode: TreeNode<T>, snapshot: T): void {
  if (snapshot === null || snapshot === undefined) return;
  if (typeof snapshot !== 'object') return;

  type EntitySignalLike = {
    setAll?: (values: unknown[]) => void;
  };
  type SnapshotWithAll = {
    all?: unknown;
  };
  type CallableTarget = ((value: unknown) => unknown) & {
    set?: (value: unknown) => void;
  };

  // A rehydrated tree has NO REQUEST IN FLIGHT.
  //
  // `LOADING` describes an in-flight operation, and an operation cannot survive
  // serialisation — the process that owned it is gone. Restoring it verbatim
  // deadlocks the node: `loading()` is true so a "don't fetch while loading"
  // guard blocks forever, `idle()` is false so an idle-gated fetch never fires,
  // and `settled()` is false so anything awaiting settlement waits forever.
  // Nothing is running to ever change it. Permanent spinner, no retry.
  //
  // Normalised HERE rather than at capture, so the snapshot stays faithful to
  // the moment it was taken (devtools can still show that the node WAS loading)
  // while every restore path lands somewhere a tree can actually operate from.
  // This is equally true of a restoration undo INTO a loading moment: there is
  // no request there either.
  //
  // `Loaded` and `Error` both survive: they describe a finished operation, and
  // `Error` is what lets a retry guard know the last attempt failed.
  // A materialised marker hydrates itself, and decides for itself what a
  // process boundary means for its transient state. `applyState` is the
  // devtools REPLAY path — same process — so it passes `restore`, under which
  // an in-flight `Loading` is kept verbatim because the request may genuinely
  // still be running. `deserialize` and SSR pass `rehydrate` instead.
  if (hydrateMarkerNode(stateNode, snapshot, 'restore')) return;

  // Special-case EntitySignal-like nodes: restore via setAll() when possible
  // so internal storage stays consistent.
  if (
    stateNode &&
    typeof stateNode === 'object' &&
    typeof (stateNode as EntitySignalLike).setAll === 'function' &&
    snapshot &&
    typeof snapshot === 'object' &&
    Array.isArray((snapshot as SnapshotWithAll).all)
  ) {
    try {
      (stateNode as EntitySignalLike).setAll?.(
        (snapshot as SnapshotWithAll).all as unknown[]
      );
      return;
    } catch {
      // fall back to generic application
    }
  }

  for (const key of Object.keys(snapshot as Record<string, unknown>)) {
    // SECURITY: `snapshot` is untrusted. The devtools channel reaches here via
    // a bare JSON.parse of a window.postMessage payload, and JSON.parse creates
    // a real OWN `__proto__` key, so Object.keys yields it. Reading
    // `stateNode['__proto__']` then handed back Object.prototype, which is an
    // object, so the branch below RECURSED INTO Object.prototype and the next
    // level assigned onto it — full process-wide pollution from one message,
    // with no enterprise package and no lazy tree involved.
    //
    // Own-ness is the load-bearing guard — without it applyState walks into
    // ANYTHING on the prototype chain, not just a named few — and `__proto__`
    // is refused by name on top, because a minted own `__proto__` would
    // otherwise satisfy own-ness forever. `constructor`/`prototype` need no
    // name check: own-ness already stops the fall-through, and blocking them by
    // name would delete legitimate state under those keys.
    if (key === '__proto__') continue;
    if (!Object.prototype.hasOwnProperty.call(stateNode, key)) continue;

    const val = (snapshot as Record<string, unknown>)[key];
    const target = (stateNode as Record<string, unknown>)[key];

    // A materialised marker hydrates ITSELF, before any of the shape-guessing
    // below. Without this, a marker whose node is an unbranded callable (form,
    // asyncSource) falls through to the raw assignment at the bottom and its
    // live signal is REPLACED by a plain object — which is exactly what ST2009
    // was built to catch, and did.
    if (hydrateMarkerNode(target, val, 'restore')) continue;

    if (isNodeAccessor(target)) {
      if (val && typeof val === 'object') {
        try {
          applyState(
            target as unknown as TreeNode<unknown>,
            val as Record<string, unknown>
          );
        } catch {
          try {
            (target as CallableTarget)(val);
          } catch {
            // swallow
          }
        }
      } else {
        try {
          (target as CallableTarget)(val);
        } catch {
          // ignore
        }
      }
    } else if (isReactiveStateValue(target)) {
      try {
        (target as CallableTarget).set?.(val);
      } catch {
        try {
          (target as CallableTarget)(val);
        } catch {
          // ignore
        }
      }
    } else if (
      target &&
      typeof target === 'object' &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(target) &&
      !Array.isArray(val)
    ) {
      try {
        applyState(
          target as unknown as TreeNode<unknown>,
          val as Record<string, unknown>
        );
      } catch {
        try {
          (stateNode as Record<string, unknown>)[key] = val as unknown;
        } catch {
          // ignore
        }
      }
    } else {
      // Neither a writable signal nor a traversable node: this assignment
      // REPLACES whatever lives at that key with a raw value. If it was a
      // materialized marker (a plain callable), the live signal is destroyed
      // and subsequent reads of it throw.
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        warnApplyStateOverwrite(key, target);
      }
      try {
        (stateNode as Record<string, unknown>)[key] = val as unknown;
      } catch {
        // ignore
      }
    }
  }
}
