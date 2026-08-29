// TYPE-ONLY. The kernel names Angular's `WritableSignal` while this transitional
// package still binds the Angular carrier publicly; the split rebinds it per
// package. No Angular VALUE is imported here any more.
import type { WritableCell } from './internals/cell-runtime';
import type { SignalTreeFactoryOf } from './types';

import { getMaterializationRealization } from './internals/materialization-realization';
import { withoutTracking } from './internals/tracking-suppression';
import { getCellRuntime } from './internals/cell-runtime';
import { markTreeCell } from './internals/cell-identity';

// ⚠️ THE ANGULAR BINDING STAYS HERE FOR NOW — and that is a measured decision,
// not inertia. It was moved to `internals/angular-realization.ts` and reverted:
// isolating the INSTALL does not neutralize this module, which still imports
// `signal` to create leaves and `isSignal` in `recursiveUpdate` for its own
// work. The move therefore added a coupled module without removing coupling,
// and the C6 ratchet failed it (10 -> 11).
//
//     CONCENTRATING A DEPENDENCY IS NOT REMOVING IT.
//
// The install moves out when S2b lands: once `isSignal` here becomes the
// realization's `isReactiveNode`, and leaf creation goes through the cell
// contract, this module stops importing Angular at all and the binding leaves
// with nothing left behind.
/**
 * Is this a reactive node of the installed realization?
 *
 * ⚠️ `isSignal` SURVIVES ONE SITE BELOW ON PURPOSE — the realization binding
 * itself. That call is Angular ANSWERING the question; these two are the kernel
 * ASKING it. Until the binding moves out (blocked on S1, since leaf creation
 * still calls Angular `signal`), this module stays runtime-coupled, and S2b-2
 * is deliberately NOT described as neutralizing it.
 */
// ⚠️ IT MUST NARROW, NOT JUST ANSWER. Angular's `isSignal` is a type guard
// (`value is Signal<unknown>`), so it was doing two jobs at once: the runtime
// check AND the narrowing that lets `'set' in prop` compile. A plain `boolean`
// broke the callers. The narrowing is deliberately to `object` — the weakest
// thing that supports the membership test — rather than to a framework type,
// because naming `Signal` here would reintroduce the coupling in the type
// system while claiming to have removed it from the runtime.
/**
 * A WRITABLE CELL IS A CALLABLE WITH `.set`, WHOEVER REALIZED IT.
 *
 * This replaced `isSignal(prop) && 'set' in prop` at the merge-write site. The
 * question there is about a leaf THE KERNEL CREATED, so it must be answerable by
 * the kernel alone — routing it through the realization made 151 tests fail when
 * no adapter was installed. Angular's `WritableSignal` and the kernel's own
 * plain carrier both satisfy this, which is exactly the point: the kernel checks
 * the SHAPE OF ITS OWN CONTRACT, not the identity of a framework.
 *
 *     THE KERNEL MUST NOT ASK AN OPTIONAL ADAPTER WHETHER ITS OWN STATE EXISTS.
 */
const isWritableCell = (v: unknown): v is { (): unknown; set(value: unknown): void } =>
  typeof v === 'function' &&
  'set' in (v as object) &&
  typeof (v as { set?: unknown }).set === 'function';

const isRealizedNode = (node: unknown): node is object =>
  getMaterializationRealization()?.isReactiveNode(node) ?? false;

// PHYSICAL-PACKAGE-SPLIT-0. The Angular binding that stood here — materialization,
// tracking suppression, scalar leaf, derived and cell realizations — now lives in
// `@signal-tree/angular`, installed when that package's entrypoint is evaluated.
// It was DELETED rather than conditionalized: a kernel that can still install a
// framework has not been separated from it. With no adapter installed the kernel
// falls back to its own neutral carriers, which is a supported configuration.

import { SIGNAL_TREE_MESSAGES } from './constants';
import { resolveEnhancerOrder } from '../enhancers';
import {
  setMemberPresence,
  isDormantMember,
} from './internals/member-membership';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { getOwnedOwnerPath } from './internals/owned-metadata';
import { SignalTreeBuilder } from './internals/builder-types';
import { ProcessDerived } from './internals/derived-types';
import { assertEnhancerConfigurationValid } from './internals/enhancer-requirements';
import {
  createMaterializationContext,
  _recordTreeConstruction,
  isRegisteredMarker,
  materializeMarkers,
  setMemberValueApplier,
  type OrdinaryConstructionAuthority,
  type OrdinaryStateMaterializer,
} from './internals/materialize-markers';
import { installDormantObservation } from './internals/observation-substrate';
import { defineRootTree } from './internals/root-source';
import {
  definePositionRegistry,
  type PositionRegistry,
} from './internals/position-registry';
import {
  defineOwnedOwnerPath,
  defineOwnedOwnerId,
  defineOwnedPositionIds,
  wrapOwnedWritableSignal,
} from './internals/owned-mutation';
import {
  createMutationCaptureRuntime,
  MUTATION_CAPTURE_RUNTIME,
  type MutationCaptureRuntime,
} from './internals/mutation-capture-runtime';
import {
  defineTreeScalarSlotRuntime,
  getTreeScalarSlotRuntime,
  type TreeScalarLeafRuntime,
} from './internals/tree-scalar-slot-port';
// Kernel-owned orchestration. The Angular edge is gone: the framework now
// supplies only `ScalarLeafRealization`, installed with the binding below.
import { createTreeScalarLeafRuntime } from './internals/tree-scalar-leaf-runtime';
import {
  createPhysicalCommitClock,
  definePhysicalCommitClock,
} from './internals/physical-commit-clock';
import {
  collectRequestedTreeCapabilities,
  resolveTreeCapabilities,
} from './internals/tree-capabilities';
import type { MaterializationContext } from './internals/materialize-markers';
import { applyDerivedFactories } from './internals/merge-derived';
import { hydrateMarkerNode } from './internals/materialize-markers';
import {
  deepEqual,
  isBuiltInObject,
  isTraversableNode,
  markTreeStore,
  publishMembershipChange,
  materializeNode,
  unwrap,
} from './utils';

import type {
  TreeNode,
  TreeConfig,
  NodeAccessor,
  EntityMapMarker,
  ISignalTree,
  Enhancer,
  EnhancerWithMeta,
  EnhancerMeta,
  TreeCapability,
} from './types';

import { ENHANCER_META } from './types';

// Build-time dev flag. Declared locally rather than inherited from
// a framework's ambient types: it is a bundler convention, not a framework
// API, and the kernel's declarations must not depend on Angular for it.
declare const ngDevMode: boolean | undefined;

// =============================================================================
// INTERNAL SYMBOLS
// =============================================================================
const NODE_ACCESSOR_SYMBOL = Symbol.for('SignalTree:NodeAccessor');

/** ST2018 tuning — see warnEntityArrayLeaf(). */
const ENTITY_ARRAY_MIN_LENGTH = 32;
const ENTITY_ARRAY_SAMPLE = 64;
const ENTITY_ID_KEYS = ['id', '_id', 'uuid', 'key'] as const;
/**
 * ST2018 fires at CONSTRUCTION, and a tree is commonly constructed once per
 * component instance — so a list rendering 500 rows would print 500 identical
 * warnings and the console becomes unusable. Deduped by key+identity so the
 * advice is given once and stays readable. Capped so a pathological app cannot
 * grow this without bound; past the cap the diagnostic simply goes quiet, which
 * is the right failure direction for a dev hint.
 */
const ENTITY_ARRAY_WARNED = new Set<string>();
const ENTITY_ARRAY_WARN_CAP = 256;
/**
 * @internal Back-reference from an accessor to the TreeNode its call path
 * closes over. `makeNodeAccessor` COPIES the store's properties onto the
 * accessor, so the two drift the moment anything replaces a property on one of
 * them — which is exactly what marker materialization does. Exposing the store
 * lets `materializeMarkers` update both, instead of leaving the closed-over
 * store holding a raw marker forever. Non-enumerable so it never reaches a
 * snapshot.
 */
const NODE_STORE_SYMBOL = Symbol.for('SignalTree:NodeStore');
const NODE_ACCESSOR_PEER = Symbol.for('SignalTree:NodeAccessorPeer');
// =============================================================================

type TreeBuildPlan = {
  requestedCapabilities: readonly TreeCapability[];
  capabilities: readonly TreeCapability[];
  has(capability: TreeCapability): boolean;
  leafMetadataStorage: 'property' | 'sidecar';
};

function createTreeBuildPlan(
  requestedCapabilities: readonly TreeCapability[],
  leafMetadataStorage: 'property' | 'sidecar'
): TreeBuildPlan {
  const resolved = resolveTreeCapabilities(requestedCapabilities);
  return {
    requestedCapabilities: resolved.requestedCapabilities,
    capabilities: resolved.resolvedCapabilities,
    has(capability: TreeCapability): boolean {
      return resolved.resolvedCapabilities.includes(capability);
    },
    leafMetadataStorage,
  };
}

// Public signalTree() now has one default scalar substrate: tree-owned slots
// with Angular tokens as the reactive adapter. Optional capabilities layer
// additional metadata/runtime services on top; they no longer choose between
// fundamentally different scalar storage implementations.

function finalizeLeafSignal<TValue>(
  leaf: WritableCell<TValue>,
  path: string,
  positionIds: readonly number[] | undefined,
  buildPlan: TreeBuildPlan,
  captureRuntime: MutationCaptureRuntime,
  registry?: PositionRegistry
): void {
  // A LOCATION MUST BE ABLE TO NAME ITS OWNER. Attaching the registry to the
  // leaf — not only to `tree` / `tree.$` — is what makes
  // `resolveScopeKey(leaf)` resolve the SAME scope object as
  // `resolveScopeKey(tree)`, which is the fact A2-3 measured missing. It needs
  // no change in `commit-consequence` itself: that code already asks
  // `getPositionRegistry(node)` and simply never got an answer from a leaf.
  if (buildPlan.has('position-topology') && registry) {
    definePositionRegistry(leaf as object, registry);
  }

  if (buildPlan.has('mutation-capture')) {
    wrapOwnedWritableSignal(leaf, {
      path,
      // `ownerPath: path` sat here until 15.0 (ME-B). The owner-address fact is
      // still installed on the leaf — it is now derived from `path` inside
      // owned-mutation rather than passed as a second, identical argument.
      positionIds,
      ownerId: registry?.id,
      metadataStorage: buildPlan.leafMetadataStorage,
      captureRuntime,
    });
    return;
  }

  if (buildPlan.has('position-topology')) {
    defineOwnedPositionIds(leaf as object, positionIds);
    defineOwnedOwnerId(leaf as object, registry?.id);
  }

  // THE DORMANT OBSERVATION SUBSTRATE, for leaves that received no capture.
  //
  // `link()` runs AFTER construction and cannot ask for a capability, so an
  // ordinary leaf has to be observable on demand. The interception point is
  // installed here — before any `set`/`update` reference can escape to
  // application code — and stays dormant until a relationship claims it. The
  // owner seed is what lets that claim be made from the SOURCE ALONE.
  //
  // Reached only when `mutation-capture` is absent: that path already
  // intercepts and returned above, and wrapping twice would publish twice.
  if (registry) {
    definePositionRegistry(leaf as object, registry);
    defineOwnedOwnerPath(leaf as object, path);
    installDormantObservation(leaf);
  }
}

function getEnhancerMeta(enhancer: unknown): EnhancerMeta | undefined {
  return (
    (enhancer as Record<symbol, EnhancerMeta | undefined>)[ENHANCER_META] ??
    (enhancer as { metadata?: EnhancerMeta }).metadata
  );
}

function buildTreePlan(
  enhancers: EnhancerWithMeta<unknown>[],
  explicitCapabilities: readonly TreeCapability[] = []
): TreeBuildPlan {
  const requestedCapabilities = collectRequestedTreeCapabilities([
    ...enhancers.map((enhancer) => getEnhancerMeta(enhancer)),
    // An explicit request is treated as one more declaration, so it goes
    // through the same dependency resolution rather than bypassing it.
    { capabilities: [...explicitCapabilities] },
  ]);
  // LAYOUT: 'property' is retained deliberately for now. The planned path used
  // 'sidecar', and switching both construction AND physical metadata layout in
  // one change would confound them -- a failure could be either. The layout A/B
  // is its own trial; see docs/architecture/phase-model-blast-radius.md.
  return createTreeBuildPlan(requestedCapabilities, 'property');
}

function materializeTreeMarkers<T extends object>(
  tree: ISignalTree<T>,
  materializationContext: MaterializationContext,
  authority?: OrdinaryConstructionAuthority
): void {
  materializeMarkers(tree.$, undefined, [], materializationContext, authority);
  _recordTreeConstruction();
}

export function isNodeAccessor(value: unknown): value is NodeAccessor<unknown> {
  return (
    typeof value === 'function' &&
    (value as unknown as Record<symbol, unknown>)[NODE_ACCESSOR_SYMBOL] === true
  );
}

function isEntityMapMarker(
  value: unknown
): value is EntityMapMarker<unknown, string | number> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>)['__isEntityMap'] === true
  );
}

// =============================================================================
// UTILITIES
// =============================================================================

function createEqualityFn(useShallowComparison: boolean) {
  return useShallowComparison ? Object.is : deepEqual;
}

// `estimateObjectSize` and `shouldUseLazy` lived here and are DELETED in 15.0
// with the lazy feature. They existed only to decide whether to hand
// construction to the lazy proxy; nothing else ever asked how big a state
// object was.

// =============================================================================
// SECURITY VALIDATION — REMOVED IN 15.0 (SEC-DEL)
// =============================================================================
//
// TOMBSTONE: `validateTree()`, `config.security`, `SecurityFeature`, the
// `security()` helper, `SecurityValidator`, `SecurityPresets` and the
// `@signal-tree/kernel/security` subpath.
//
// SEC-0 measured all three protections it offered:
//
//   PROTOTYPE POLLUTION  core already drops a JSON-parsed `__proto__` and does
//                        not pollute Object.prototype, with no opt-in. What the
//                        feature added was rejecting `constructor` and
//                        `prototype` as LITERAL DATA KEYS — harmless
//                        own-properties that real data contains. Strictly worse
//                        than core alone.
//
//   preventXSS           INERT. `validateValue()` RETURNS a sanitised string
//                        and the walk discarded the return, and only ran at
//                        construction. An advertised control that did nothing
//                        on the path users invoke.
//
//   preventFunctions     serializability hygiene, not a security boundary.
//
// Core's own prototype-pollution handling stays — that is where the real
// defence lives, covered by `apply-state-pollution.spec.ts`. Do not reintroduce
// a construction-time sanitiser: sanitising on the way INTO state corrupts data
// and does not protect the rendering sink, which is where XSS is decided and
// which Angular already escapes.


// =============================================================================
// NODE ACCESSOR CREATION
// =============================================================================

/**
 * Creates a NodeAccessor function that wraps a TreeNode.
 *
 * NodeAccessors are functions that:
 * - Can be called with no args to get the unwrapped state
 * - Can be called with a value to set state
 * - Can be called with an updater function to transform state
 * - Have enumerable properties for child nodes (signals or nested accessors)
 *
 * **This is a plain function, NOT an Angular signal.** Only leaves are signals.
 * The accessor deliberately has no `.set()`/`.update()` — being callable for
 * reads *and* both write forms is the whole point, and adding those methods
 * would both duplicate the call signatures and collide with any state key
 * named `set` or `update`. See the `NodeAccessor` docs in ./types.ts for the
 * leaf-vs-node table — and note that a LEAF takes no such call: calling an
 * Angular signal is a read, and since 14.0.0 that is a compile error rather
 * than a silent no-op.
 *
 * ## Partial Updates
 *
 * ⚠️ THIS SECTION USED TO CLAIM `batchScope` CONSOLIDATED CHANGE DETECTION INTO
 * A SINGLE CYCLE. It did not. `batchScope` incremented a counter, ran the
 * callback and decremented — no scheduler, no Angular primitive, no reader.
 * Deleted in 15.0 (MODULE-STATE-OWNERSHIP-0 / BD-C) along with the claim; if
 * SignalTree ever consolidates CD cycles, the mechanism that does it will have
 * to prove it.
 *
 * When called with an object argument, each child signal is written directly.
 *
 * ```typescript
 * $.tickets({ startDate, endDate, count });
 *
 * // Individual CD cycles (not batched)
 * $.tickets.startDate.set(startDate);
 * $.tickets.endDate.set(endDate);
 * $.tickets.count.set(count);
 * ```
 *
 * ## Writable Properties for Deep Merge
 *
 * Properties are defined with `writable: true` to support the deep merge pattern.
 * When derived state is merged into a namespace and then processed by
 * materializeMarkers(), it needs to replace markers with their signal forms.
 */
function makeNodeAccessor<T>(
  store: TreeNode<T>,
  ownerPath?: string,
  positionIds?: readonly number[],
  registry?: PositionRegistry
): NodeAccessor<T> {
  // Declared as a METHOD SHORTHAND, not `function () {}`, and this is
  // load-bearing. A node carries the user's state keys as its own enumerable
  // properties, so every own property name a function already has is a name
  // the user cannot use for state. Ordinary function expressions own a
  // NON-CONFIGURABLE `prototype`, which made `signalTree({ a: { prototype: 1 } })`
  // die inside the copy loop below with "Cannot redefine property: prototype".
  // Concise methods are not constructors and have no `prototype` at all, while
  // still binding `arguments` (which an arrow function would not). That takes
  // the reserved-name list for state keys down to zero — `length`, `name`,
  // `caller` and `arguments` are all configurable and were already fine.
  // Read INSIDE the method, which only runs after the assignment below — the
  // same box pattern the leaf uses, for the same reason.
  const self: { accessor?: NodeAccessor<T> } = {};

  const accessor = {
    node(arg?: unknown): T | void {
      // GET - no argument. Memoised per node: a clean subtree comes back BY
      // REFERENCE instead of being rebuilt, so one leaf write no longer costs
      // O(state) to observe. See materialized() in utils.ts.
      if (arguments.length === 0) {
        // ⚠️ DORMANCY IS ENFORCED AT THE CANONICAL READ BOUNDARY, FOR BRANCHES
        // AS WELL AS LEAVES.
        //
        //     A SEMANTICALLY ABSENT DESCENDANT READS AS ABSENT EVEN IF ITS
        //     PHYSICAL STORAGE IS RETAINED.
        //
        // That was implemented for leaves only. Measured on a plain static tree
        // with no markers: `box({ keep })` omitting `drop` left BOTH
        // `box.drop()` returning `{v:2}` AND `box()` still listing `drop` —
        // because the parent's dormant-child read (M-C2) called the branch,
        // got its unchanged snapshot back, and propagated nothing.
        //
        // Fixing it HERE fixes both symptoms from one place: a dormant branch
        // now returns a DIFFERENT value, so the parent's retained dependency
        // propagates and its memo rebuilds without any explicit invalidation.
        // ⚠️ The read boundary alone is NOT sufficient: a branch has no
        // publication token, so a held parent consumer sees nothing. The
        // membership carrier in `publishMembershipChange` is what wakes it.
        if (self.accessor !== undefined && isDormantMember(self.accessor)) {
          return undefined as unknown as T;
        }
        return materializeNode(store as object) as unknown as T;
      }

      // UPDATE with function - auto-batch
      if (typeof arg === 'function') {
        const updater = arg as (current: T) => T;
        const current = unwrap(store) as T;
        recursiveUpdate(store, updater(current));
        return;
      }

      // WHOLE-VALUE ASSIGNMENT with an object - auto-batch.
      //
      // ⚠️ THE MECHANISM DID NOT CHANGE IN 15.0, THE CONTRACT DID. This path
      // always installed exactly the keys it was handed; "merge" was a
      // consequence of ACCEPTING a `Partial<T>`, never a separate merging step.
      // Now that the type requires a whole `T`, the same call installs the whole
      // value.
      //
      // That is deliberate, and it is why the rule reads:
      //
      //   WHOLE-VALUE ASSIGNMENT MUST NOT BE IMPLEMENTED AS
      //   "PARTIAL WRITE WITH OMITTED KEYS CLEARED".
      //
      // The GREENFIELD-BRANCH-WRITE-0 probe DID manufacture `undefined` writes
      // for omitted descendants, and it misbehaved twice: a spurious mutation
      // event per omitted key, and unknown keys discarded before the
      // unknown-key diagnostic could see them. Nothing here writes a key the
      // caller did not supply.
      //
      // ⚠️ PERMISSIVE AT RUNTIME. A caller who defeats the type still merges
      // rather than throwing. No carrier proves a runtime rejection, and adding
      // one would invent a contract and could break untyped consumers — see the
      // C8 surface review for whether a dev-mode diagnostic is warranted.
      if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
        recursiveUpdate(store, arg as T);
        return;
      }

      // FULL SET with primitive/array - single value, no batch needed
      recursiveUpdate(store, arg);
    },
  }.node as NodeAccessor<T>;

  self.accessor = accessor;
  (accessor as unknown as Record<symbol, boolean>)[NODE_ACCESSOR_SYMBOL] = true;
  Object.defineProperty(accessor, NODE_STORE_SYMBOL, {
    value: store,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  // ⚠️ AND THE REVERSE EDGE. Membership transitions arrive holding EITHER half
  // of the pair — `recursiveUpdate` reconciles over the store, dynamic
  // reacquisition arrives at the accessor — and both descriptors have to move
  // together. Without this link the store cannot find its accessor, so the
  // convergence owner could only ever fix one direction. See
  // `setMemberPresence`.
  Object.defineProperty(store as object, NODE_ACCESSOR_PEER, {
    value: accessor,
    enumerable: false,
    writable: false,
    configurable: true,
  });

  // Copy store properties onto accessor
  // CRITICAL: Properties must be writable to allow materializeMarkers()
  // to replace markers with their signal forms. Without writable: true,
  // this assignment silently fails in non-strict mode, causing runtime errors
  // like "$.users.upsertOne is not a function".
  for (const key of Object.keys(store as object)) {
    Object.defineProperty(accessor, key, {
      value: (store as Record<string, unknown>)[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  if (positionIds && positionIds.length > 0) {
    defineOwnedPositionIds(accessor as object, positionIds);
  }

  if (ownerPath !== undefined) {
    defineOwnedOwnerPath(accessor as object, ownerPath);
  }

  // A BRANCH is a location too. The ownership correction reached `tree`,
  // `tree.$` and leaves; an intermediate accessor was the one class left
  // unable to name its owner, which made `getPositionRegistry(tree.$.settings)`
  // undefined while both the leaf under it and the root above it answered.
  // Measured by LINK-1 case 1, where branch is a valid X.
  if (registry) {
    definePositionRegistry(accessor as object, registry);
    defineOwnedOwnerId(accessor as object, registry.id);
  }

  return accessor;
}

/**
 * @internal Dev-mode notice that a write to a BRANCH position was discarded
 * because its value is not an object. Reached both directly (`{ user: null }`)
 * and via an updater that returned one (`{ user: () => null }`) — the second
 * used to vanish in silence, including the forgotten-`await` case where the
 * updater returns a Promise.
 */
/**
 * ST2021 — a marker inside an array.
 *
 * Array elements are never traversed, so a marker in one is never materialised:
 * it stays a raw marker object for the life of the tree. `tree.$.list()[0]` is
 * a plain `{ key, defaultValue }`, not a signal, and every write to it is lost.
 * Silent, and it looks like it should work.
 *
 * "Store the array as a Map so elements CAN be traversed" is the natural fix and
 * is already built — it is what `entityMap` is, and it measures 28.5x faster
 * than an immutable store on the keyed-collection task. Applying it to EVERY
 * array is what does not survive measurement: a per-node Map index cost +12.1%
 * on subtree reads and 310B/node in this repo (built, measured, reverted), an
 * index-keyed structure pays O(n) to reindex on any insert or reorder, and
 * `tree()` has to hand back a real Array regardless. Most arrays in a tree are
 * ordered lists of primitives and would pay that for nothing.
 *
 * So: a keyed collection is an `entityMap`; an ordered list is an array leaf;
 * and a marker in an array is the first case wearing the second's clothes.
 *
 * Bounded scan, dev only, deduped per key.
 */
const MARKER_IN_ARRAY_WARNED = new Set<string>();

const looksLikeMarker = (item: unknown): boolean =>
  item !== null &&
  typeof item === 'object' &&
  (isEntityMapMarker(item) || isRegisteredMarker(item));

/**
 * ⚠️ EXTENDED TO Map AND Set BY MARKER-GRAMMAR-DIAGNOSTICS-0, and the GRAMMAR IS
 * UNCHANGED. A Map value and a Set member are ordinary data exactly as before —
 * they are not materialised, acquire no marker semantics, and are not recursed
 * into. Only the diagnostic changed.
 *
 * The gap this closes: ST2021 scanned arrays only, so identical misuse warned in
 * one non-traversable container and was SILENT in the others. `marker-location-
 * grammar.spec.ts` recorded that with the Map/Set rows asserting zero warnings.
 *
 * ⚠️ NO NEW SCAN OF ORDINARY VALUES. This runs at the one branch that already
 * decided the position becomes a leaf whose interior is never traversed, under
 * the same dev guard, the same 64-element sample bound and the same per-key
 * dedupe the array scan always had. A Map or Set that holds no marker costs one
 * bounded sample in dev and nothing in production.
 *
 * ⚠️ THE POSITION IS RENDERED HONESTLY. A Map value is not a property path, so
 * it is not spelled like one: `m -> Map value at key "a"`, `s -> Set member #0`.
 * READ THE OBSERVATION, NOT ITS RENDERING — writing `m.a` would name a location
 * that does not exist and cannot be addressed.
 */
function warnMarkerInContainer(key: string, value: unknown): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  if (MARKER_IN_ARRAY_WARNED.has(key)) return;

  let where: string | undefined;
  let container: string | undefined;

  if (Array.isArray(value)) {
    const limit = Math.min(value.length, ENTITY_ARRAY_SAMPLE);
    for (let i = 0; i < limit; i++) {
      if (looksLikeMarker(value[i])) {
        where = `"${key}[${i}]"`;
        container = 'an array. Array elements';
        break;
      }
    }
  } else if (value instanceof Map) {
    let i = 0;
    for (const [k, v] of value) {
      if (i++ >= ENTITY_ARRAY_SAMPLE) break;
      if (looksLikeMarker(v)) {
        where = `"${key}" -> Map value at key ${JSON.stringify(String(k))}`;
        container = 'a Map. Map values';
        break;
      }
    }
  } else if (value instanceof Set) {
    let i = 0;
    for (const member of value) {
      if (i >= ENTITY_ARRAY_SAMPLE) break;
      if (looksLikeMarker(member)) {
        where = `"${key}" -> Set member #${i}`;
        container = 'a Set. Set members';
        break;
      }
      i++;
    }
  }

  if (where === undefined || container === undefined) return;

  MARKER_IN_ARRAY_WARNED.add(key);
  console.warn(
    `SignalTree: ${where} holds a MARKER inside ${container} are never ` +
      `traversed, so the marker is never materialised — it stays a raw object, ` +
      `it is not a signal, and writes to it are lost. Markers belong at object ` +
      `positions; for a keyed collection use entityMap({ selectId }). [ST2021]`
  );
}

/**
 * ST2018 — an array of entities is being stored as a plain array leaf.
 *
 * This is the most expensive idiom mistake available in SignalTree, and it does
 * not look like a mistake. Measured on the same task (1000 updates to a
 * 50,000-row collection, with a dependent read):
 *
 *   entityMap                1.63 ms
 *   plain array leaf        49.80 ms      <- this
 *   NgRx SignalStore        46.56 ms
 *
 * An array leaf lands at PARITY with the immutable store SignalTree beats 28x
 * with the right container, because every update rebuilds the array (`slice()`
 * alone is ~41 ms of that 49.80 ms) and every equality check walks it.
 * `entityMap` writes one entity in O(1) and reads it back through a per-entity
 * signal.
 *
 * Documentation did not prevent this: SignalTree's OWN demo benchmark shipped
 * the array-leaf idiom while `docs/guides/entity-collection-cookbook.md` sat in
 * the repo. Hence a diagnostic rather than another guide.
 *
 * Deliberately conservative, because a false positive on every small array
 * would train developers to ignore it:
 *   - at least ENTITY_ARRAY_MIN_LENGTH elements (below that, O(N) is noise)
 *   - every sampled element is a non-null, non-array object
 *   - every sampled element carries the SAME identity key with a primitive
 *     value, and no duplicates within the sample
 * The scan is bounded and runs once per array at construction, in dev only.
 */
function warnEntityArrayLeaf(key: string, value: readonly unknown[]): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  if (value.length < ENTITY_ARRAY_MIN_LENGTH) return;

  const first = value[0];
  if (first === null || typeof first !== 'object' || Array.isArray(first)) {
    return;
  }

  const idKey = ENTITY_ID_KEYS.find((candidate) => {
    const v = (first as Record<string, unknown>)[candidate];
    return typeof v === 'string' || typeof v === 'number';
  });
  if (!idKey) return;

  const sampleSize = Math.min(value.length, ENTITY_ARRAY_SAMPLE);
  const seen = new Set<unknown>();
  for (let i = 0; i < sampleSize; i++) {
    const item = value[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    const id = (item as Record<string, unknown>)[idKey];
    if (typeof id !== 'string' && typeof id !== 'number') return;
    if (seen.has(id)) return; // not a stable identity — say nothing
    seen.add(id);
  }

  const seenKey = `${key}:${idKey}`;
  if (ENTITY_ARRAY_WARNED.has(seenKey)) return;
  if (ENTITY_ARRAY_WARNED.size >= ENTITY_ARRAY_WARN_CAP) return;
  ENTITY_ARRAY_WARNED.add(seenKey);

  // Kept SHORT deliberately: this string sits in the dev-mode floor that
  // tools/check-bundle-budget.mjs measures, and an earlier draft inlining the
  // full benchmark table cost ~0.8KB gzip across every bundle. The numbers and
  // the "when an array leaf is right" case live in docs/errors/README.md and
  // the entity cookbook, which the code points at.
  console.warn(
    `SignalTree: "${key}" holds ${value.length} objects with a stable ` +
      `"${idKey}" — use entityMap({ selectId: (e) => e.${idKey} }). An array ` +
      `leaf rebuilds and re-compares the whole array on every update — two ` +
      `orders of magnitude at 50k. Read-only or replaced wholesale? ` +
      `Leave it plain; otherwise model it as an entityMap. [ST2018]`
  );
}

function warnDiscardedBranchWrite(path: string, value: unknown): void {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.error(
      `SignalTree: write to "${path}" DISCARDED — a branch cannot be replaced ` +
        `by a non-object value (received ${
          value === null ? 'null' : typeof value
        }). Write the leaves, or use a marker if this position should hold a ` +
        `value. [ST2014]`
    );
  }
}

/**
 * @internal Dev-mode notice that a builder could not forward a method to its
 * base tree — which means an enhancer in the chain returned a tree missing it.
 *
 * The cause every time so far has been `Object.assign(newTree, tree)` inside an
 * enhancer: it copies only ENUMERABLE own properties, and every tree method is
 * defined `enumerable: false`. The forwarder then returned an empty result,
 * which reads exactly like "nothing changed" — so a dropped write looked
 * healthy. Fail loudly instead.
 */
function warnMissingForward(method: string): void {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.error(
      `SignalTree: "${method}" could not be forwarded — an enhancer in the ` +
        `chain returned a tree without it, so this call did NOTHING. An ` +
        `enhancer that builds a new tree object must copy own property ` +
        `DESCRIPTORS (see copyTreeProperties), not Object.assign, which skips ` +
        `non-enumerable methods. [ST2017]`
    );
  }
}

/**
 * MATRIX-CLOSE S3 — `currentHydrateMode()` IS DELETED.
 *
 * It computed `'merge' | 'restore'` from `origin === 'restoration'` and passed
 * the result to `hydrateMarkerNode`. Its comment claimed a measured corruption
 * it existed to prevent:
 *
 *     n=3 rows=3  ->  undo  ->  n=2 rows=3
 *
 * M6 forced it permanently to `'merge'` and the whole 1885-test suite stayed
 * green. S3-RECOVER then found something stronger than "that defect is gone":
 *
 * ```text
 * currentHydrateMode() produced   'merge' | 'restore'
 * markers branch only on          'rehydrate'
 * ```
 *
 * `entity-map.ts` and `async-source.ts` each decline exactly one mode —
 * `mode === 'rehydrate'` — which this function never produced. Both of its return
 * values therefore fell through the same path in every marker processor. **The
 * distinction was computed and no consumer could act on it.**
 *
 * `s3-hydrate-mode-recovery.spec.ts` holds both halves permanently: the
 * historical n/rows case does not reproduce, and `'merge'` and `'restore'` are
 * indistinguishable to a loader-backed marker while `'rehydrate'` is not.
 *
 * This deletes a POLICY BRANCH, not the `origin` axis. `origin` remains
 * provenance with diagnostic consumers (DevTools action metadata, the diagnostic
 * journal) and one structural justification (DX-NAMES-1.3 Fact 1). What is gone
 * is the claim that it had a policy consumer.
 */

/** Dev-mode: paths already warned about for ref-identical no-op writes. */
const warnedNoopPaths = new Set<string>();
/** @internal Dedupe for ST2027. Separate from ST2003 — different mistakes. */
const warnedNoopCopyPaths = new Set<string>();

/**
 * @internal Is this value big enough that a wasted deep-equal walk matters?
 *
 * 32 matches ST2018's collection threshold so the two diagnostics agree on what
 * counts as "a lot". Deliberately shallow — an O(1) length/key count, never a
 * walk, because a diagnostic that has to traverse the value to decide whether
 * traversing the value was wasteful is its own punchline.
 */
function isLargeEnoughToMatter(value: object): boolean {
  if (Array.isArray(value)) return value.length >= 32;
  if (value instanceof Map || value instanceof Set) return value.size >= 32;
  return Object.keys(value).length >= 32;
}

/**
 * @internal Invalidate the OBSERVATION of every scalar member under `parent`
 * after a membership transition, without writing anything.
 *
 * ⚠️ THIS IS AN INVALIDATION CARRIER, NOT A MEMBERSHIP AUTHORITY. Enumerability
 * decides membership; this only wakes the consumers so they re-read it.
 *
 * It reuses the per-slot publication tokens that already exist and that each
 * leaf ALREADY depends on — `createAngularLeaf` calls `publication.observe(slot)`
 * INSIDE its computation, so the dependency edge is established on the leaf's
 * first read. That is what makes membership free: no new reactive state, and no
 * first-transition problem. A lazily created membership signal would NOT be a
 * dependency of a computation that had already run — measured, and the reason
 * the per-leaf design was abandoned.
 */
function republishMembers(parent: object, keys: readonly string[]): void {
  const runtime = getTreeScalarSlotRuntime(parent);
  if (!runtime) return;

  // ⚠️ ONLY THE SLOTS WHOSE MEMBERSHIP CHANGED.
  //
  //     changedSlots = value-changed slots UNION membership-changed slots
  //     each semantic slot published ONCE per transition
  //
  // Sweeping every slot under the branch published siblings whose membership and
  // value were both untouched, and double-published the one that did change.
  const changedSlots: number[] = [];
  for (const key of keys) {
    const child = (parent as Record<string, unknown>)[key];
    const positionId = getOwnedPositionIds(child)?.[0];
    if (positionId === undefined) continue;

    const slot = runtime.resolveScalarSlot(positionId);
    if (slot !== undefined) changedSlots.push(slot);
  }

  // ⚠️ PUBLISHED INDEPENDENTLY OF VALUE EQUALITY.
  //
  //     SEMANTIC MEMBERSHIP CHANGE IS AN OBSERVABLE SLOT CHANGE EVEN WHEN THE
  //     RETAINED VALUE IS IDENTICAL.
  //
  // The ordinary write path SUPPRESSES an unchanged commit — correctly, for a
  // value. But reintroducing `age: 42` over a dormant slot that still holds 42
  // changes what the leaf OBSERVES (undefined -> 42) without changing what it
  // stores, so routing membership through the value comparator would leave an
  // already-subscribed consumer stuck at `undefined`.
  // ⚠️ A BRANCH MEMBER HAS NO PUBLICATION TOKEN, so its membership transition is
  // unobservable through the dependency graph.
  //
  // A dormant LEAF is carried by its retained per-slot token: the parent's
  // dormant-child read returns a CHANGED value and propagates. A dormant BRANCH
  // returns `undefined` now too, but that call reads no signal whose value
  // changed — the child's own memo still depends on unchanged leaf tokens — so
  // nothing invalidates the parent. Measured: `drop()` correctly became
  // `undefined` while `box()` still listed `drop`.
  //
  // This is the SAME structural condition as first appearance, not a generic
  // structural-edit hammer:
  //
  //     A MEMBERSHIP TRANSITION WHOSE MEMBER CARRIES NO OBSERVABLE DEPENDENCY
  //     MUST INVALIDATE ANY SNAPSHOT WHOSE DEPENDENCY SET COULD NOT REFLECT IT.
  // ⚠️ TOKENLESS MEANS NO SLOT, NOT NO POSITION. A branch member DOES own a
  // PositionId — an earlier version of this check tested for one and therefore
  // never fired. What a branch lacks is a per-slot PUBLICATION TOKEN, which is
  // what the dependency graph actually carries.
  if (changedSlots.length < keys.length) {
    publishMembershipChange(parent);
  }

  if (changedSlots.length > 0) {
    // `advanceRevision` is NOT wanted: nothing was committed, so the physical
    // commit clock must not move.
    runtime.publishPrepared({ revision: runtime.revision(), changedSlots });
  }

  // The node's own snapshot is memoised over the members it enumerated, and a
  // membership change is invisible to that memo — see publishMembershipChange.
}

/**
 * @internal Apply a supplied complete value to an EXISTING dynamic member,
 * activating its membership if dormant.
 *
 *     MEMBERSHIP ACTIVATION IS NEVER A STANDALONE OPERATION.
 *     IT MUST BE COUPLED TO AN AUTHORITATIVE SUPPLIED VALUE.
 *
 * Value first, then membership — the same ordering the leaf write path uses, so
 * a dormant member's retained storage can never be observable between the two.
 * The publication is forced when membership changed, because a supplied value
 * equal to the retained one commits nothing and would otherwise leave an
 * already-subscribed consumer stuck at absent.
 */
setMemberValueApplier(
  (parent: object, key: string, member: unknown, value: unknown) => {
    // 1. install the supplied value through the member's ordinary write path.
    // The supplied value IS the complete value by contract — no shape guard,
    // because THE LOCATION TYPE DEFINES WHAT CONSTITUTES A COMPLETE VALUE and
    // second-guessing it here would quietly drop legitimate writes.
    if (typeof member === 'function') {
      (member as (v: unknown) => void)(value);
    }

    // 2. then activate membership. `setMemberPresence` owns both physical
    // halves of the branch — ACCESSOR/STORE COHERENCE MUST HAVE ONE MUTATION
    // OWNER — so this site cannot reactivate one and miss the other.
    const woke = setMemberPresence(parent, key, 'active');

    // One publication for the whole reacquisition, and only when membership
    // actually changed — an active key taking a new value is a value write, not
    // a membership event.
    if (woke) publishMembershipChange(parent);
  }
);

function recursiveUpdate(
  target: unknown,
  updates: unknown,
  out?: string[],
  pathPrefix = ''
): void {
  if (!updates || typeof updates !== 'object') return;

  const targetObj = isNodeAccessor(target)
    ? (target as unknown as Record<string, unknown>)
    : (target as Record<string, unknown>);

  for (const [key, rawValue] of Object.entries(
    updates as Record<string, unknown>
  )) {
    // Reassignable: an updater FUNCTION at either a leaf or a branch is
    // resolved to its result below, and everything downstream then sees one
    // shape rather than each branch re-implementing the updater case.
    let value = rawValue;
    const prop = targetObj[key];
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (prop === undefined) {
      // A tree's signal graph is built from its INITIAL shape, so a write to a
      // key that was never in that shape has nowhere to go and is discarded.
      // Silently, until now: this is what made a guardrails rule look broken
      // for hours when the demo wrote an optional key it had never seeded.
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.error(
          `SignalTree: write to "${childPath}" DISCARDED — key is not in the ` +
            `tree's initial shape. [ST2010]`
        );
      }
      continue;
    }

    // A materialised marker hydrates ITSELF. Without this, a marker whose node
    // is an unbranded callable (`form`) or a plain object with its own API
    // (`entityMap`, `status`) falls through to the branch/leaf logic below,
    // which has no idea how to write it — so `tree(partial)` silently no-ops,
    // and `restoration` undo silently leaves the marker at its post-change
    // value, landing the user in a state that never existed and reporting
    // success. Measured before this: `n=3 rows=3` → undo → `n=2 rows=3`.
    if (hydrateMarkerNode(prop, value, 'restore')) {
      if (out) out.push(childPath);
      continue;
    }

    // ⚠️ THIS ASKS ABOUT A LEAF THE KERNEL ITSELF CREATED, and that is why it
    // does NOT route through the realization predicate. S2b-2 substituted it and
    // the substitution was reverted on measurement:
    //
    //     realization absent, this site direct        18 failures
    //     realization absent, this site via predicate 169 failures
    //
    // The 151-test difference is the whole kernel write path. `isRealizedNode`
    // answers `false` when no realization is installed, so every merge write
    // silently did nothing — the canonical state path became contingent on an
    // OPTIONAL adapter being present.
    //
    //     THE KERNEL MUST NOT ASK AN OPTIONAL ADAPTER WHETHER ITS OWN STATE
    //     EXISTS.
    //
    // Line 1430 keeps the neutral predicate because its subject is a
    // CALLER-SUPPLIED value — the same question `merge-derived` asks. Same
    // function name, different semantic decision.
    if (isWritableCell(prop)) {
      const sig = prop as WritableCell<unknown>;
      // NOTE: a function value is STORED, never invoked. Updaters are supported
      // at branches and at the root, NOT at leaves — `tree.$.count.update(fn)`
      // is the leaf form, mirroring Angular's own signal API.
      //
      // A previous revision tried to resolve leaf updaters, guarded on "the
      // current value is not a function". That predicate is unknowable at
      // runtime: the right question is whether the leaf's DECLARED TYPE is a
      // function, and a leaf typed `null | (() => void)` sitting at `null` is
      // the ordinary callback field. Assigning a handler to one then INVOKED it
      // (running `() => this.submit()` at write time), stored its return value,
      // and reported the path as landed; a class constructor threw out of the
      // middle of the write loop, committing earlier keys and dropping later
      // ones while reporting nothing. Strictly worse than the inert
      // stored-function it replaced, so it is gone.
      // Ref-equality short-circuit: skip the .set() entirely when the
      // incoming value is identical to the current value. Saves the
      // function-call + Angular's internal equality check + any glitch
      // tracking. Wrapped in untracked() so reading the current value
      // never accidentally creates a reactive dependency.
      const current = withoutTracking(() => sig());
      if (current === value) {
        // Dev-mode footgun guard: a merge write whose value is reference-
        // identical to the current value is a no-op. For objects/arrays this
        // almost always means the caller mutated the value in place and re-set
        // the SAME reference, expecting an update — which silently does
        // nothing. Warn once per path. (Primitives re-set to the same value
        // are normal idempotent writes and are not flagged.)
        if (
          (typeof ngDevMode === 'undefined' || ngDevMode) &&
          value !== null &&
          typeof value === 'object' &&
          !warnedNoopPaths.has(childPath)
        ) {
          warnedNoopPaths.add(childPath);
          console.warn(
            `SignalTree: write at "${childPath}" was skipped — the value is ` +
              `reference-identical to the current value. If you mutated an ` +
              `object/array in place, create a NEW reference (spread/slice/map) ` +
              `so the change is observed. [ST2003]`
          );
        }
        continue;
      }
      sig.set(value);

      if (out) {
        // Report only what LANDED. Leaves are created with a deep `equal`, so
        // a new-reference-but-deep-equal value — the ordinary shape of a
        // re-fetched server payload — is rejected by the signal and notifies
        // nobody. Pushing the path anyway told audit trails, change logs and
        // targeted-persistence callers to do work for a write that never
        // happened.
        //
        // Compare against the PREVIOUS value, not the incoming one: "the leaf
        // now holds `value`" is also true when the leaf already held it, which
        // is exactly the no-op case (and Object.is(NaN, NaN) makes that
        // indistinguishable). "The leaf no longer holds what it held" is the
        // question actually being asked.
        if (
          !Object.is(
            withoutTracking(() => sig()),
            current
          )
        )
          out.push(childPath);
      }
    } else if (isNodeAccessor(prop)) {
      if (typeof value === 'function') {
        // Updater function aimed at a BRANCH, e.g. tree({ user: u => ({...}) }).
        // Resolve it here and recurse rather than handing it to the accessor:
        // the accessor's own updater path drops `out` and `pathPrefix`, so the
        // reported path was the branch ('user') instead of the leaves that
        // changed ('user.name'), and a pure no-op updater still reported a
        // change. Resolving here keeps one code path for reporting — and one
        // code path for the discard diagnostic below, which the resolved value
        // now falls through to. Without that, `u => null` and a forgotten
        // `await` (an async updater returns a Promise, whose Object.entries is
        // empty) were both SILENT no-ops.
        const updater = value as (current: unknown) => unknown;
        value = updater(unwrap(prop));
        // Only a PLAIN object merges into a branch. Everything else an updater
        // can return is a discard, and each used to be silent:
        //   - a Promise, from a forgotten `await` — it IS an object, so
        //     `Object.entries()` on it is empty and the whole write vanished.
        //     A previous revision claimed to diagnose this and did not.
        //   - a Date/Map/Set/array, which merge key-by-key into nonsense.
        //   - `undefined`, which differs from a LITERAL `undefined` in the
        //     payload: that legitimately means "no change" for an absent
        //     optional key, whereas an updater returning it is a mistake.
        const mergeable =
          isTraversableNode(value) &&
          typeof value !== 'function' &&
          !isBuiltInObject(value) &&
          !Array.isArray(value) &&
          typeof (value as { then?: unknown }).then !== 'function';
        if (!mergeable) {
          warnDiscardedBranchWrite(childPath, value);
          continue;
        }
      }
      if (typeof value === 'function') {
        // An updater that returned another function. Nothing sane to do.
        warnDiscardedBranchWrite(childPath, value);
      } else if (value && typeof value === 'object') {
        recursiveUpdate(prop, value, out, childPath);
      } else if (value === undefined) {
        // `{ user: undefined }` is type-legal for Partial<T> and is exactly what
        // `{ ...defaults, ...patch }` produces for an absent optional key. It
        // means "no change", so it is skipped WITHOUT a diagnostic — warning
        // here cried wolf on correct, type-checked code.
        continue;
      } else {
        // A primitive, null or undefined aimed at a BRANCH. This has always
        // been discarded — the accessor forwards to recursiveUpdate, which
        // returns immediately for a non-object — but the path was reported as
        // changed anyway. That is the same defect the leaf branch above was
        // fixed for, and it is the shape a server payload takes when it sends
        // `null` for a whole object. Report nothing, and say why in dev.
        warnDiscardedBranchWrite(childPath, value);
      }
    }
    // ST2005 — attempted and REVERTED, deliberately. Recorded here so the
    // next person does not re-derive it.
    //
    // Its 13.x removal note said a diagnostic here "would fire on
    // `tree(tree())`, the ordinary snapshot-restore pattern", and that markers
    // "do not accept merge writes BY DESIGN". Both were true then. Neither is
    // now: every marker declares `hydrate`, the branch above routes to it, and
    // `tree(tree())` is pinned by a round-trip test that reads LIVE node values
    // (the naive snapshot-vs-snapshot form passes vacuously when both sides
    // drop the same key).
    //
    // So the reasoning did expire — but restoring the diagnostic at THIS site
    // still cries wolf, measured: it fired on an ordinary leaf write
    // (`tree({known: 2})`) and on `{ user: undefined }`, which is type-legal
    // `Partial<T>` and exactly what `{ ...defaults, ...patch }` produces for an
    // absent optional key. This is the tail of the outer dispatch, not the
    // "matched neither guard" branch the note described.
    //
    // RESOLVED — the narrow site is not on this path at all, and the code is
    // not ST2005. That number is taken: `@signaltree/ng-forms` throws [ST2005]
    // for a bridged `form()` marker carrying its own `asyncValidators`. It has
    // shipped since v12 and is documented; reusing it in core would have
    // collided.
    //
    // The real remaining gap was narrower than this note assumed. A marker that
    // declares `snapshot` but no `hydrate`, whose node is not a writable
    // signal, snapshots perfectly and silently discards every write — measured:
    // `tree()` gave `{"p":1}`, `tree({p: 99})` left it at `1`, nothing reported
    // at either end. [ST2022] stays quiet because `snapshot` IS declared.
    //
    // That is now [ST2023], reported at MATERIALISATION (materialize-markers.ts),
    // where the node exists so its shape is knowable, once per processor, off
    // the write path entirely. Its predicate is the exact mirror of this
    // function's fall-through, which is what keeps it from crying wolf the way
    // a diagnostic at THIS site did. If the fall-through widens, widen ST2023
    // with it.
  }

  // ── MEMBERSHIP RECONCILIATION — GREENFIELD-BRANCH-WRITE-0 ─────────────────
  //
  // A whole-value assignment states the COMPLETE next value of this location, so
  // a key the value omits is not a member of it. Every caller of this function
  // is an authored whole-value path (branch value/updater, nested descent, root,
  // updateAndReport) — verified by caller audit — which is why membership lands
  // here and only here.
  //
  //     OMISSION IN A WHOLE VALUE CHANGES MEMBERSHIP.
  //     OMISSION IN A PROJECTION DEFINES SCOPE.
  //
  // ⚠️ C4's `acquireScalarProjection` must NEVER route through here. It calls
  // `subject.set()` directly precisely so that an external acquisition omitting
  // a key says NOTHING about that key.
  //
  // ⚠️ NOTHING IS WRITTEN TO AN OMITTED KEY. Absence is a membership change, not
  // an `undefined` assignment — the BR-A probe did the latter and produced a
  // spurious mutation event per omitted key while suppressing the unknown-key
  // diagnostic. The slot, its identity and its retained value all survive.
  //
  // Reactivation is handled by the supplied-key loop above having ALREADY
  // installed the value: REACTIVATION MUST CARRY THE SUPPLIED VALUE, because
  // re-enumerating alone resurrects the dormant retained one.
  const supplied = new Set(Object.keys(updates as Record<string, unknown>));
  const membershipChanged: string[] = [];

  for (const key of Object.getOwnPropertyNames(targetObj)) {
    const descriptor = Object.getOwnPropertyDescriptor(targetObj, key);
    if (!descriptor || !('value' in descriptor)) continue;

    if (!supplied.has(key)) {
      if (
        descriptor.enumerable &&
        setMemberPresence(targetObj, key, 'dormant')
      ) {
        membershipChanged.push(key);
      }
    } else if (
      !descriptor.enumerable &&
      setMemberPresence(targetObj, key, 'active')
    ) {
      membershipChanged.push(key);
    }
  }

  // One publication for the whole transition. The per-slot tokens the leaves
  // already depend on are what carries it — no new reactive state exists, and
  // no first-transition problem, because that dependency edge was established on
  // each leaf's FIRST computation.
  if (membershipChanged.length > 0) {
    republishMembers(targetObj, membershipChanged);
  }
}

// =============================================================================
// SIGNAL STORE CREATION
// =============================================================================

/**
 * @internal The comparator a LEAF is created with.
 *
 * In production this IS `base` — the ternary at each call site folds and this
 * function becomes unreferenced, so `check-devmode-foldable` reclaims all of
 * it. In dev it wraps `base` to catch ST2027.
 *
 * Why here rather than in `recursiveUpdate`, where ST2003 lives: a direct
 * `tree.$.rows.set(v)` goes STRAIGHT to the Angular signal and never enters
 * `recursiveUpdate` at all. That is the most common write form, and it is the
 * one the corrupted benchmarks used — a diagnostic that only covers merge
 * writes would have missed the case that motivated it. The comparator is the
 * one place every write funnels through, and it already knows both halves of
 * the answer: whether the values compared equal, and whether the references
 * differed.
 */
function leafEqual(
  base: (a: unknown, b: unknown) => boolean,
  path: string
): (a: unknown, b: unknown) => boolean {
  return (a: unknown, b: unknown): boolean => {
    const eq = base(a, b);
    // A no-op write, and NOT the reference kind (ST2003 covers that): a new
    // object that deep-equals the current value. `deepEqual` cannot
    // short-circuit on it, so the whole structure was walked to conclude
    // nothing changed — and then nothing notifies.
    if (
      eq &&
      a !== b &&
      a !== null &&
      typeof a === 'object' &&
      isLargeEnoughToMatter(a) &&
      !warnedNoopCopyPaths.has(path)
    ) {
      warnedNoopCopyPaths.add(path);
      console.warn(
        `SignalTree: a write to "${path || '(root leaf)'}" changed NOTHING — ` +
          `the new value is a different object but deep-equals the current ` +
          `one, so the whole structure was compared and the write discarded. ` +
          `A re-fetched payload does this. Skip the write when the data is ` +
          `unchanged, or write the smaller changed leaf. [ST2027]`
      );
    }
    return eq;
  };
}

/**
 * @internal THE canonical ordinary child-BRANCH materialization.
 *
 * ⚠️ ONE SEMANTIC JOB, ONE AUTHORITY. This was extracted from the ordinary
 * nested-object case in `createSignalStore`'s parent loop, and that loop now
 * calls it — so a marker that resolves into ordinary topology cannot silently
 * diverge from how every inline branch is built.
 *
 * `createSignalStore` ALONE IS NOT THIS AUTHORITY. A branch is four steps, and
 * calling only the second produces a store with no accessor whose descendants
 * are parented one level too high:
 *
 * ```text
 * 1. allocate the CHILD BRANCH's own PositionId under its parent
 * 2. createSignalStore(value, …, [childBranchId], childPath)
 * 3. makeNodeAccessor(store, childPath, [childBranchId], registry)
 * 4. attach the slot runtime to BOTH accessor and backing store
 * ```
 */
function materializeOrdinaryBranch(
  value: unknown,
  equalityFn: (a: unknown, b: unknown) => boolean,
  materializationContext: MaterializationContext,
  buildPlan: TreeBuildPlan,
  captureRuntime: MutationCaptureRuntime,
  scalarSlotRuntime: TreeScalarLeafRuntime | undefined,
  childPositionIds: number[] | undefined,
  childPath: string,
  devPath: string
): unknown {
  const nested = createSignalStore(
    value,
    equalityFn,
    materializationContext,
    buildPlan,
    captureRuntime,
    scalarSlotRuntime,
    childPositionIds,
    devPath
  );
  const accessor = makeNodeAccessor(
    nested as TreeNode<object>,
    childPath,
    childPositionIds,
    materializationContext.positionRegistry
  );
  // Membership reconciliation runs at EVERY branch, not just the root, so the
  // publication runtime has to be reachable from each branch accessor. One
  // non-enumerable symbol per BRANCH — branches are far fewer than leaves, and
  // this buys membership invalidation with no per-leaf state at all.
  if (scalarSlotRuntime) {
    // BOTH the accessor and its backing store: membership reconciliation
    // targets whichever object the write path holds, and those differ between
    // the branch callable (store) and an outside caller (accessor).
    defineTreeScalarSlotRuntime(accessor as object, scalarSlotRuntime);
    defineTreeScalarSlotRuntime(nested as object, scalarSlotRuntime);
  }
  return accessor;
}

function createSignalStore<T>(
  obj: T,
  equalityFn: (a: unknown, b: unknown) => boolean,
  materializationContext: MaterializationContext,
  buildPlan: TreeBuildPlan,
  captureRuntime: MutationCaptureRuntime,
  scalarSlotRuntime: TreeScalarLeafRuntime | undefined,
  positionIds?: readonly number[],
  /**
   * Dot-path to this node, used ONLY to name the leaf in ST2027. Threaded
   * rather than reconstructed because the walk already knows it, and a
   * diagnostic that cannot say WHICH leaf is most of the way to useless.
   */
  path = ''
): TreeNode<T> {
  const createLeafSignal = <TValue>(
    value: TValue,
    leafPath: string,
    leafPositionIds: readonly number[] | undefined,
    equal: (a: unknown, b: unknown) => boolean
  ): WritableCell<TValue> => {
    if (scalarSlotRuntime && leafPositionIds?.[0] !== undefined) {
      // The port declares the neutral contract (`WritableCell`); the installed
      // adapter realizes it with a native Angular signal. Same cast as the
      // ordinary leaf path below — this file still binds the Angular carrier
      // publicly until the package split rebinds it per package.
      return scalarSlotRuntime.createLeaf(
        value,
        equal as (current: TValue, next: TValue) => boolean,
        leafPositionIds[0]
      ) as unknown as WritableCell<TValue>;
    }

    // S1 — the ordinary leaf carrier comes from the installed realization when
    // there is one. The Angular fallback stays until the package split makes the
    // adapter structural: leaf allocation is the kernel's OWN state, and it must
    // not become contingent on an optional installation (see line 941).
    // ACQUISITION POINT: this cell is becoming a TREE LEAF, which is what
    // makes it a SignalTree state cell. Internal cells from the same runtime
    // (revisions, counters, metrics) never pass here and stay unclassified.
    return markTreeCell(
      getCellRuntime().createCell(value, equal)
    ) as unknown as WritableCell<TValue>;
  };

  // Primitives, null, undefined
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    const equal =
      typeof ngDevMode === 'undefined' || ngDevMode
        ? leafEqual(equalityFn, path)
        : equalityFn;
    const leaf = createLeafSignal(obj, path, positionIds, equal);
    finalizeLeafSignal(
      leaf,
      path,
      positionIds,
      buildPlan,
      captureRuntime,
      materializationContext.positionRegistry
    );
    return leaf as unknown as TreeNode<T>;
  }

  // Arrays
  if (Array.isArray(obj)) {
    const equal =
      typeof ngDevMode === 'undefined' || ngDevMode
        ? leafEqual(equalityFn, path)
        : equalityFn;
    const leaf = createLeafSignal(obj, path, positionIds, equal);
    finalizeLeafSignal(
      leaf,
      path,
      positionIds,
      buildPlan,
      captureRuntime,
      materializationContext.positionRegistry
    );
    return leaf as unknown as TreeNode<T>;
  }

  // Built-in objects (Date, Map, Set, etc.)
  if (isBuiltInObject(obj)) {
    const equal =
      typeof ngDevMode === 'undefined' || ngDevMode
        ? leafEqual(equalityFn, path)
        : equalityFn;
    const leaf = createLeafSignal(obj, path, positionIds, equal);
    finalizeLeafSignal(
      leaf,
      path,
      positionIds,
      buildPlan,
      captureRuntime,
      materializationContext.positionRegistry
    );
    return leaf as unknown as TreeNode<T>;
  }

  // Regular object - recursive
  const store: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    let childPositionIds: number[] | undefined;
    const getChildPositionIds = (): number[] | undefined => {
      if (!materializationContext.positionTopologyEnabled) {
        return undefined;
      }

      return (childPositionIds ??= [
        materializationContext.allocatePositionId(positionIds?.[0]),
      ]);
    };
    // SECURITY: every `store[key] = …` below is a plain assignment, so a key
    // named `__proto__` invokes the Object.prototype SETTER on the store rather
    // than adding a property. `JSON.parse` creates a real own `__proto__` key,
    // and rehydrating from localStorage / SSR transfer state / a fetch body is
    // the ordinary way that input reaches `signalTree()`.
    //
    // The damage is contained but real: the ROOT store IS `tree.$`, so its
    // prototype became an attacker-controlled node. `tree.$.isAdmin` then read
    // back a live signal holding `true` while `tree()` reported only the
    // legitimate keys — invisible to snapshots, serialization, persistence,
    // devtools and restoration — and a later `tree({ isAdmin: … })` wrote
    // THROUGH to it, bypassing the ST2010 not-in-initial-shape discard.
    // Nested branches were safe (each accessor gets a fresh Function.prototype);
    // the root is the only victim, which is exactly why it was easy to miss.
    if (key === '__proto__') {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.error(
          `SignalTree: dropped a "__proto__" key from the initial state — it ` +
            `cannot be a state key. If this came from JSON.parse, the payload ` +
            `is attempting prototype pollution. [ST2016]`
        );
      }
      continue;
    }

    // Entity map markers - preserve for entities() enhancer
    if (isEntityMapMarker(value)) {
      store[key] = value;
      continue;
    }

    // All markers (built-in stored/asyncSource + user-registered)
    // are caught here via the dynamic processor registry. Built-in markers
    // self-register when their factory runs — and the factory always runs
    // inside the state literal (`signalTree({ x: stored(...) })` evaluates
    // `stored()` before `signalTree()`), so the processor is registered before
    // this check. Detecting them through the registry (instead of importing
    // `isStoredMarker` directly) keeps `markers/stored` out of the bundle when
    // that marker is never used.
    if (isRegisteredMarker(value)) {
      store[key] = value;
      continue;
    }

    // Dev-mode warning: object has Symbol keys but no registered processor
    // This catches the common mistake of forgetting to register before tree creation
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.getOwnPropertySymbols(value).length > 0
      ) {
        console.warn(
          `SignalTree: Object at "${key}" has Symbol keys but doesn't match any ` +
            `registered marker processor. If this is a custom marker, ensure ` +
            `registerMarkerProcessor() is called BEFORE creating the tree.`
        );
      }
    }

    // ⚠️ A CALLER-SUPPLIED reactive node is preserved as-is, never re-wrapped —
    // and unlike the kernel's own leaves above, this one DOES route through the
    // realization predicate. The subject is a value the caller made with their
    // framework, which is the same question `merge-derived` asks of
    // `.derived()`. With no realization installed there is, correctly, no such
    // node to preserve.
    if (isRealizedNode(value)) {
      store[key] = value;
      continue;
    }

    // Null, undefined, primitives
    if (value === null || value === undefined || typeof value !== 'object') {
      const childPositionIds = getChildPositionIds();
      const equal =
        typeof ngDevMode === 'undefined' || ngDevMode
          ? leafEqual(equalityFn, childPath)
          : equalityFn;
      const leaf = createLeafSignal(value, childPath, childPositionIds, equal);
      finalizeLeafSignal(
        leaf,
        childPath,
        childPositionIds,
        buildPlan,
        captureRuntime,
        materializationContext.positionRegistry
      );
      store[key] = leaf;
      continue;
    }

    // Arrays, built-ins
    if (Array.isArray(value) || isBuiltInObject(value)) {
      // The one branch that already knows BOTH facts the diagnostic needs:
      // the value looks like a marker, and this position is not marker-
      // admissible because its interior is never traversed.
      warnMarkerInContainer(key, value);
      if (Array.isArray(value)) {
        warnEntityArrayLeaf(key, value);
      }
      const childPositionIds = getChildPositionIds();
      const equal =
        typeof ngDevMode === 'undefined' || ngDevMode
          ? leafEqual(equalityFn, childPath)
          : equalityFn;
      const leaf = createLeafSignal(value, childPath, childPositionIds, equal);
      finalizeLeafSignal(
        leaf,
        childPath,
        childPositionIds,
        buildPlan,
        captureRuntime,
        materializationContext.positionRegistry
      );
      store[key] = leaf;
      continue;
    }

    // Nested object — THE canonical child-branch authority. Extracted so the
    // marker ordinary-branch request cannot diverge from it.
    store[key] = materializeOrdinaryBranch(
      value,
      equalityFn,
      materializationContext,
      buildPlan,
      captureRuntime,
      scalarSlotRuntime,
      getChildPositionIds(),
      childPath,
      // Folds to '' in production — the path exists only to name a leaf in
      // ST2027, so a prod build should not spend a string concat per node
      // building one nothing will read.
      typeof ngDevMode === 'undefined' || ngDevMode
        ? path
          ? `${path}.${key}`
          : key
        : ''
    );
  }

  // Register as memoisable. Only stores built here are reactive all the way
  // down, which is the precondition for caching their materialisation in a
  // computed — see isMemoisable() in utils.ts.
  markTreeStore(store as object);

  return store as TreeNode<T>;
}

// =============================================================================
// CORE CREATE FUNCTION
// =============================================================================

/**
 * @internal What `create` hands back to its single caller.
 *
 * ⚠️ CONSTRUCTION AUTHORITY NEED NOT SURVIVE AS RUNTIME TREE STATE WHEN ONLY
 * CONSTRUCTION-TIME CLOSURES REQUIRE IT.
 *
 * An earlier revision attached the materializer to the tree under a
 * module-private symbol, because `create` owns equality/slot runtime while
 * `signalTree` owns the marker dispatcher. That worked, but it made the runtime
 * object an incidental capability transport — and `create` has exactly ONE
 * caller, so the private return shape costs nothing. The authority stops being
 * reachable once the dispatcher and builder closures have captured it.
 *
 * ⚠️ Do NOT promote this to a runtime tree capability. If dynamic key creation
 * later needs branch materialization for the tree's LIFETIME, that is a new
 * requirement to design deliberately — not a conclusion to smuggle in now.
 */
interface TreeConstructionResult<T extends object> {
  readonly tree: ISignalTree<T>;
  readonly authority: OrdinaryConstructionAuthority;
}

function create<T extends object>(
  initialState: T,
  config: TreeConfig,
  materializationContext: MaterializationContext,
  buildPlan: TreeBuildPlan,
  captureRuntime: MutationCaptureRuntime = createMutationCaptureRuntime()
): TreeConstructionResult<T> {
  if (initialState === null || initialState === undefined) {
    throw new Error(SIGNAL_TREE_MESSAGES.NULL_OR_UNDEFINED);
  }

  const equalityFn = createEqualityFn(config.useShallowComparison ?? false);

  // Create signal store
  const scalarSlotRuntime = buildPlan.has('causal-runtime')
    ? createTreeScalarLeafRuntime(materializationContext.physicalCommitClock)
    : undefined;

  /**
   * The canonical construction authority, for the marker DISPATCHER only.
   *
   * A processor returns `ordinaryState(value)` to REQUEST this; it never
   * receives the ability to perform it. The subtree is built by the same
   * `createSignalStore` that builds every inline branch — same equality, build
   * plan, capture runtime, slot runtime, position registry and path — so its
   * descendants ARE ordinary canonical locations, not a parallel store.
   *
   * ⚠️ NO EXTRA TOPOLOGY LEVEL: it materializes AT the marker's own location
   * and parent position, so `users: dyn({ alice })` yields `users`,
   * `users.alice`, `users.alice.name` with nothing hidden in between.
   */
  const materializeOrdinaryState: OrdinaryStateMaterializer = (
    value,
    path,
    parentPositionId
  ) => {
    // ⚠️ ALLOCATE THE BRANCH'S OWN POSITION FIRST. An earlier revision passed
    // `[parentPositionId]` straight through and returned `createSignalStore`'s
    // raw store. That produced BOTH defects at once: the marker's own branch had
    // no PositionId, so its seeded descendants were parented one level too high
    // (root -> alice instead of root -> users -> alice), and the location was a
    // store rather than a callable NodeAccessor.
    const childPositionIds = materializationContext.positionTopologyEnabled
      ? [materializationContext.allocatePositionId(parentPositionId)]
      : undefined;

    return materializeOrdinaryBranch(
      value,
      equalityFn,
      materializationContext,
      buildPlan,
      captureRuntime,
      scalarSlotRuntime,
      childPositionIds,
      path,
      typeof ngDevMode === 'undefined' || ngDevMode ? path : ''
    );
  };

  /**
   * ⚠️ THE SHARED LIFETIME CHILD-CONSTRUCTION RUNTIME.
   *
   *     CONSTRUCTION AUTHORITY SURVIVES ONLY FOR SUBJECTS WHOSE CONTRACT
   *     INCLUDES POST-CONSTRUCTION TOPOLOGY ACQUISITION.
   *
   * `equalityFn`, `buildPlan`, `captureRuntime`, `scalarSlotRuntime` and the
   * materialization context are TREE-WIDE constants. Capturing them once here
   * and sharing the reference means a second or tenth dynamic branch adds only
   * its owner identity — not another four captures each.
   *
   * ⚠️ These four are the inputs `createSignalStore` currently requires. They are
   * NOT frozen as the permanent representation: a later retention/churn pass may
   * show, for instance, that `buildPlan` can shrink to a smaller derived runtime
   * plan. That is representation optimization, not Step-E semantics.
   *
   * ⚠️ LAZY BY CONSTRUCTION: `bindMember` is called only by the dispatcher, only
   * for a branch that requested keyed lookup. A tree with zero dynamic branches
   * never invokes it, so it acquires no lifetime materialization state merely
   * because SignalTree supports dynamic branches.
   */
  const constructionAuthority: OrdinaryConstructionAuthority = {
    materialize: materializeOrdinaryState,
    bindMember: (ownerBranch: object) => {
      // OWNER IDENTITY DEFINES THE MATERIALIZATION DOMAIN. Both facts are read
      // from the canonical branch itself, so no caller can supply either.
      const ownerPositionId = getOwnedPositionIds(ownerBranch)?.[0];
      const ownerPath = getOwnedOwnerPath(ownerBranch) ?? '';
      return (key: string, value: unknown) => {
        const childPositionIds = materializationContext.positionTopologyEnabled
          ? [materializationContext.allocatePositionId(ownerPositionId)]
          : undefined;
        const childPath = ownerPath ? `${ownerPath}.${key}` : key;
        return materializeOrdinaryBranch(
          value,
          equalityFn,
          materializationContext,
          buildPlan,
          captureRuntime,
          scalarSlotRuntime,
          childPositionIds,
          childPath,
          typeof ngDevMode === 'undefined' || ngDevMode ? childPath : ''
        );
      };
    },
  };
  const rootPositionIds = materializationContext.positionTopologyEnabled
    ? [materializationContext.allocatePositionId()]
    : undefined;

  // ONE construction path. The lazy proxy was the other one, and it is gone —
  // see the tombstone on `TreeConfig` in types.ts.
  const signalState: TreeNode<T> = createSignalStore(
    initialState,
    equalityFn,
    materializationContext,
    buildPlan,
    captureRuntime,
    scalarSlotRuntime,
    rootPositionIds
  );

  // Create root callable function
  const tree = function (arg?: unknown): T | void {
    if (arguments.length === 0) {
      return materializeNode(signalState as object) as unknown as T;
    }

    if (typeof arg === 'function') {
      const updater = arg as (current: T) => T;
      const current = unwrap(signalState) as T;
      recursiveUpdate(signalState, updater(current));
    } else {
      recursiveUpdate(signalState, arg);
    }
  } as ISignalTree<T>;

  // Mark as NodeAccessor
  (tree as unknown as Record<symbol, boolean>)[NODE_ACCESSOR_SYMBOL] = true;
  (tree as unknown as Record<symbol, MutationCaptureRuntime>)[
    MUTATION_CAPTURE_RUNTIME
  ] = captureRuntime;
  if (rootPositionIds) {
    defineOwnedPositionIds(tree as object, rootPositionIds);
    defineOwnedPositionIds(signalState as object, rootPositionIds);
  }
  if (buildPlan.has('mutation-capture')) {
    defineOwnedOwnerPath(tree as object, '');
    defineOwnedOwnerPath(signalState as object, '');
  }
  if (materializationContext.positionTopologyEnabled) {
    definePositionRegistry(
      tree as object,
      materializationContext.positionRegistry
    );
    definePositionRegistry(
      signalState as object,
      materializationContext.positionRegistry
    );
  }
  // THE ROOT AS A SUPPORTED LINK SOURCE.
  //
  // `link(tree.$, endpoint)` typechecks, so the root is supported — but its
  // owner carriers were capability-gated exactly as ordinary leaves' were, so a
  // plain tree rejected it as unowned. Attached unconditionally for the same
  // reason the dormant substrate seeds leaves: a post-construction operation
  // cannot ask for a capability.
  if (materializationContext.positionRegistry) {
    definePositionRegistry(
      signalState as object,
      materializationContext.positionRegistry
    );
    defineOwnedOwnerPath(signalState as object, '');
  }
  // The root accessor is not callable, so its canonical reader/writer is the
  // tree itself. Recorded here; `accessorsFor` consults it.
  defineRootTree(
    signalState as object,
    tree as unknown as { (): unknown; (value: unknown): void }
  );

  if (materializationContext.physicalCommitClock) {
    definePhysicalCommitClock(
      tree as object,
      materializationContext.physicalCommitClock
    );
    definePhysicalCommitClock(
      signalState as object,
      materializationContext.physicalCommitClock
    );
  }
  if (scalarSlotRuntime && scalarSlotRuntime.slotCount() > 0) {
    defineTreeScalarSlotRuntime(tree as object, scalarSlotRuntime);
    defineTreeScalarSlotRuntime(signalState as object, scalarSlotRuntime);
  }

  // Lifecycle: cleanup registry and destroyed flag
  const cleanupFns: Array<() => void> = [];
  const destroyedSig = getCellRuntime().createCell(false);

  // Add core properties
  Object.defineProperty(tree, '$', {
    value: signalState,
    enumerable: false,
    writable: false,
  });

  /**
   * Apply a single enhancer to this SignalTree instance and return the enhanced tree.
   *
   * Enhancers extend the tree with additional capabilities (batching, restoration, dev tools, entities, serialization, etc).
   *
   * Usage:
   * ```ts
   * const enhanced = tree.with(batching());
   * // Chain multiple enhancers:
   * const fullyEnhanced = tree
   *   .with(batching())
   *   .with(restoration({ maxHistorySize: 100 }))
   *   .with(devTools({ name: 'MyTree' }));
   * ```
   *
   * Supported enhancers and their options:
   *
   * - `batching(config?: BatchingConfig)`
   *   - Batches change detection notifications for performance.
   *   - Signal writes are always synchronous.
   *   - Options: `enabled`, `notificationDelayMs`.
   *
   * - `restoration(config?: RestorationConfig)`
   *   - Enables undo/redo and state history.
   *   - Options: `maxHistorySize`, `includePayload`, `actionNames`, `enabled`.
   *
   * - `devTools(config?: DevToolsConfig)`
   *   - Integrates with browser devtools and logs state changes.
   *   - Options: `name`, `enableBrowserDevTools`, `enableLogging`, `performanceThreshold`, `enabled`.
   *
   * - `serialization(config?: SerializationConfig)`
   *   - Adds state serialization and persistence helpers.
   *   - Options: `includeMetadata`, `replacer`, `reviver`, `preserveTypes`, `maxDepth`.
   *
   * @template R The return type of the enhancer (usually the enhanced tree).
   * @param enhancer A function that takes the current tree and returns an enhanced tree.
   * @returns The enhanced tree with additional methods or capabilities.
   * @see BatchingConfig, RestorationConfig, DevToolsConfig, SerializationConfig
   */

  // bind()
  Object.defineProperty(tree, 'bind', {
    value: function (thisArg?: unknown): NodeAccessor<T> {
      // Use native Function.prototype.bind to avoid calling this custom
      // `bind` property (which would cause infinite recursion).
      return Function.prototype.bind.call(
        tree,
        thisArg
      ) as unknown as NodeAccessor<T>;
    },
    enumerable: false,
    // Allow enhancers or consumers to bind/override if necessary
    writable: true,
    configurable: true,
  });

  // destroy()
  Object.defineProperty(tree, 'destroy', {
    value: function (): void {
      if (destroyedSig()) return; // Already destroyed
      destroyedSig.set(true);
      // Run registered cleanup functions (enhancers, subscriptions, etc.)
      for (const fn of cleanupFns) {
        try {
          fn();
        } catch {
          // Swallow errors during cleanup to ensure all cleanups run
        }
      }
      cleanupFns.length = 0;
      if (config.debugMode) {
        console.log(SIGNAL_TREE_MESSAGES.TREE_DESTROYED);
      }
    },
    enumerable: false,
    // Allow enhancers (like guardrails) to override/replace `destroy` at runtime.
    writable: true,
    configurable: true,
  });

  // destroyed (readonly signal)
  Object.defineProperty(tree, 'destroyed', {
    value: destroyedSig.asReadonly(),
    enumerable: false,
    writable: false,
    configurable: true,
  });

  // registerCleanup()
  Object.defineProperty(tree, 'registerCleanup', {
    value: function (fn: () => void): void {
      if (typeof fn === 'function') {
        cleanupFns.push(fn);
      }
    },
    enumerable: false,
    writable: false,
    configurable: true,
  });

  // clearCache(): compatibility stub for older DX and enhancers that expect
  // a global clearCache helper on the tree. Enhancers may replace this with
  // a real implementation (e.g. memoization). Default is a no-op.
  Object.defineProperty(tree, 'clearCache', {
    value: () => {
      /* no-op default */
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // `batchUpdate()` was REMOVED in 14.1.1. Its body was
  // `recursiveUpdate(signalState, arg)` — exactly what the tree callable
  // `tree(partial)` / `tree(updater)` already does. With `batching()` attached it
  // additionally wrapped in `batch()`, so `tree.batchUpdate(x)` was precisely
  // `tree.batch(() => tree(x))`. MEASURED equivalent before removal: 0.921 vs
  // 0.925 us at 10 fields, 16.585 vs 16.475 us at 100 (medians of 9 x 2000).

  // updateAndReport(): apply a partial update and return the dot-paths of
  // signals that actually changed (after ref-equality short-circuit).
  // Useful for partial server-payload sync, change-log/audit trails, and
  // targeted persistence without pulling in the @signaltree/enterprise
  // diff engine.
  Object.defineProperty(tree, 'updateAndReport', {
    value: function (arg?: unknown): string[] {
      if (arguments.length === 0) return [];
      const out: string[] = [];
      if (typeof arg === 'function') {
        const updater = arg as (current: T) => T;
        const current = unwrap(signalState) as T;
        recursiveUpdate(signalState, updater(current), out);
      } else if (
        typeof arg === 'object' &&
        arg !== null &&
        !Array.isArray(arg)
      ) {
        recursiveUpdate(signalState, arg, out);
      } else {
        recursiveUpdate(signalState, arg, out);
      }
      return out;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // Copy state properties to root for direct access (DEPRECATED - will be removed in v7)
  // Consumers should use tree.$ for state access
  for (const key of Object.keys(signalState as object)) {
    if (!(key in tree)) {
      Object.defineProperty(tree, key, {
        value: (signalState as Record<string, unknown>)[key],
        enumerable: true,
        configurable: true,
      });
    }
  }

  return { tree, authority: constructionAuthority };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Apply the resolved enhancer list, adopting identity replacements.
 *
 * THE ONLY PLACE AN ENHANCER IS EVER INVOKED. There used to be two: this loop
 * and `tree.with()`, which carried its own copy of duplicate detection and
 * requirement checking. Two engines meant two answers — `.with()` validated
 * against enhancers applied SO FAR, `signalTree` validates the declared SET —
 * and the pair could disagree on the same configuration. `with` is gone from
 * the tree and from `ISignalTree`; `assertEnhancerConfigurationValid` above is
 * the single authority, and it runs before this function is reached.
 *
 * What survives from `with` is the part that was never about validation:
 * ADOPTING A REPLACEMENT. `batching`, `restoration` and `devTools` each return a
 * NEW callable rather than mutating the tree they were given, and everything
 * after must see that one — hence the reassignment rather than a fixed
 * receiver. `enhancer-protocol-continuity.spec.ts` row F is the falsifier.
 *
 * A throwing enhancer propagates. Construction fails as a whole, so there is no
 * partially enhanced tree to reason about and nothing to unwind.
 */
function applyEnhancers<T extends object>(
  tree: ISignalTree<T>,
  ordered: readonly EnhancerWithMeta<unknown>[]
): ISignalTree<T> {
  let current = tree;
  for (const enhancer of ordered) {
    if (typeof enhancer !== 'function') {
      throw new Error('Enhancer must be a function');
    }
    const result = (enhancer as Enhancer<unknown>)(
      current as never
    ) as unknown as ISignalTree<T>;
    if (result !== (current as unknown) && isTraversableNode(result)) {
      current = result;
    }
  }
  return current;
}

/**
 * Create a minimal SignalTree.
 *
 * Returns ISignalTree<T> with only core functionality.
 * Use .with() to add enhancers for additional features.
 *
 * @example
 * ```typescript
 * // a derived value from whatever runtime the consumer installed
 * import { signalTree } from '@signal-tree/kernel';
 *
 * // Minimal tree
 * const tree = signalTree({ count: 0 });
 *
 * // With multiple enhancers
 * const tree = signalTree({ count: 0 })
 *   .with(restoration())
 *   .with(batching());
 *
 * // With derived state (v7) - chained syntax
 * const tree = signalTree({ count: 0 })
 *   .derived(($) => ({
 *     doubled: computed(() => $.count() * 2)
 *   }));
 *
 * // With derived state (v7) - second argument syntax
 * const tree = signalTree(
 *   { count: 0 },
 *   ($) => ({
 *     doubled: computed(() => $.count() * 2)
 *   })
 * );
 * ```
 */
// Overload: with derived factory as second argument

/**
 * THE RETURN TYPE IS WHERE `.with()` WENT.
 *
 * A chain accumulated enhancer surfaces one link at a time (`this & TAdded`).
 * A declared array has to recover the same information from a tuple, which is
 * what `AccumulatedEnhancerAdditions` does — and it only works if the tuple
 * survives inference, which is what `const E` is for. Without `const`, the
 * argument widens to `Enhancer<unknown>[]` and every added method is lost,
 * silently, exactly the failure `enhancer-chain.typing.spec.ts` was written
 * against.
 *
 * The four overloads are the cross-product of the two optional fields that
 * change the result type, most specific first.
 */

// Overload: enhancers AND a derived factory

// Overload: config object carrying a derived factory

// Overload: with config object

// Implementation
function signalTreeImpl<T extends object, TDerived extends object>(
  initialState: T,
  configOrDerived?: TreeConfig | (($: TreeNode<T>) => TDerived)
): SignalTreeBuilder<T, TreeNode<T>> {
  const isFactory = typeof configOrDerived === 'function';
  const config: TreeConfig = isFactory ? {} : configOrDerived ?? {};

  // CONFIGURE -> FINALIZE. The whole enhancer set is known here, so the plan
  // can be truthful. The chained builder could not do this: `.with()` had to
  // materialize before applying each enhancer, so the plan was fixed before the
  // first enhancer was seen and every tree got LEGACY_TREE_BUILD_PLAN -- which
  // declares causal-runtime and therefore resolves to every capability, on
  // every tree, whether or not anything consumed it.
  const declared = (config.enhancers ?? []) as EnhancerWithMeta<unknown>[];

  // Validate the CONFIGURATION as a set, before anything is built. Declaration
  // order is not information: a requirement is satisfied if anything in the
  // array provides it, and the ordering pass below reorders accordingly.
  assertEnhancerConfigurationValid(declared.map((e) => getEnhancerMeta(e)));

  const ordered = resolveEnhancerOrder(
    [...declared],
    new Set<string>(),
    Boolean(config.debugMode)
  );
  const buildPlan = buildTreePlan(ordered, config.capabilities);

  const physicalCommitClock = buildPlan.has('causal-runtime')
    ? createPhysicalCommitClock()
    : undefined;
  const materializationContext = createMaterializationContext(
    buildPlan.has('position-topology'),
    (capability) => buildPlan.has(capability),
    physicalCommitClock
  );
  const captureRuntime = createMutationCaptureRuntime();

  const constructed = create(
    initialState,
    config,
    materializationContext,
    buildPlan,
    captureRuntime
  );
  let tree: ISignalTree<T> = constructed.tree;
  const authority = constructed.authority;

  // Markers must exist before enhancers run -- entityMap(), form() and friends
  // are what enhancers attach to. `.with()` used to do this per call, which is
  // precisely why the plan could never see an enhancer. Doing it once, here, is
  // what makes the plan knowable.
  //
  // Only when there is something to attach, though. With no enhancers there is
  // nothing that needs markers up front, and materializing anyway would make
  // construction eager for every tree and destroy incremental materialization
  // -- markers are supposed to realize on the access path that first needs
  // them. The builder still materializes lazily in that case.
  const hasEnhancers = ordered.length > 0;
  if (hasEnhancers) {
    materializeTreeMarkers(tree, materializationContext, authority);

    // Hand the entity collections to the tree so the reclamation sink can
    // broadcast to them. The ARRAY REFERENCE is attached, not a copy of its
    // contents: markers materialize lazily when nothing forces them, so a
    // collection can register after this line and must still be visible.
    //
    // Placed here rather than in `create()` for two reasons. Markers have not
    // materialized yet at that point, so the list is always empty there — the
    // first version of this attached an empty array and the sink silently
    // reclaimed nothing. And `hasEnhancers` gates it, so a bare tree pays
    // nothing.
    //
    // A bare `Symbol.for` rather than an import from the sink module,
    // deliberately: `signal-tree.ts` is the bare bundle's entry point and that
    // edge would ship the sink to trees that can never restore, which is the
    // defect `bundle-budget` caught when the claim registry was constructed
    // here. The sink resolves the same global symbol.
    Object.defineProperty(
      tree.$ as object,
      Symbol.for('SignalTree:SubjectPhysicalOwners'),
      {
        value: materializationContext.physicalOwners,
        enumerable: false,
        configurable: true,
      }
    );

    tree = applyEnhancers(tree, ordered);
  }

  const builder = createBuilder<T, TreeNode<T>>(
    tree as ISignalTree<T>,
    materializationContext,
    hasEnhancers,
    authority
  );

  // A derived factory may arrive either as the whole second argument (the v7
  // shorthand) or as `config.derived`. Both queue on the builder, so both apply
  // at the same point a chained `.derived()` would have: lazily, on first `$`
  // access, after every enhancer.
  const derivedFactory = isFactory
    ? (configOrDerived as ($: TreeNode<T>) => TDerived)
    : (config.derived as unknown as
        | (($: TreeNode<T>) => TDerived)
        | undefined);

  if (derivedFactory) {
    return builder.derived(
      derivedFactory
    ) as unknown as SignalTreeBuilder<T, TreeNode<T>>;
  }

  return builder;
}

// =============================================================================
// BUILDER FACTORY
// =============================================================================

/**
 * Creates a SignalTreeBuilder that wraps an ISignalTree and adds:
 * - .derived() method for adding derived state layers
 * - Lazy finalization (derived factories run on first $ access)
 */
function createBuilder<TSource extends object, TAccum = TreeNode<TSource>>(
  baseTree: ISignalTree<TSource>,
  materializationContext: MaterializationContext,
  /**
   * signalTree() materializes before applying enhancers, because enhancers
   * attach to markers. Telling the builder so keeps `materializeOnly()`
   * idempotent instead of walking an already-materialized tree again.
   */
  alreadyMaterialized = false,
  authority?: OrdinaryConstructionAuthority
): SignalTreeBuilder<TSource, TAccum> {
  const derivedQueue: Array<($: unknown) => object> = [];
  let isFinalized = false;

  let markersMaterialized = alreadyMaterialized;

  /**
   * Materialize markers only — idempotent, and deliberately does NOT latch
   * `isFinalized`, so it stays legal to add `.derived()` afterwards. Reading
   * or writing through the tree needs real signals; it does not need the
   * derived queue applied.
   */
  const materializeOnly = () => {
    if (markersMaterialized) return;
    markersMaterialized = true;
    materializeMarkers(baseTree.$, undefined, [], materializationContext, authority);
    _recordTreeConstruction();
  };

  const finalize = () => {
    if (isFinalized) return;
    isFinalized = true;

    // Step 1: Materialize ALL markers (entityMap, status, stored, etc.)
    // This must happen BEFORE derived processing so that derived factories
    // can reference entity methods, status signals, and stored signals.
    materializeOnly();

    // Step 2: Apply all queued derived factories
    if (derivedQueue.length > 0) {
      applyDerivedFactories(baseTree.$, derivedQueue);
    }
  };

  // Create callable builder function that delegates to baseTree
  const builder = function (arg?: unknown): TSource | void {
    // Materialize markers WITHOUT finalizing. Calling tree() used to return
    // raw markers because this path skipped materialization entirely; but a
    // full finalize() here would also latch `isFinalized`, and `.derived()`
    // throws on that flag — so `tree(); tree.derived(...)` would start failing
    // with a message about `$` that the caller never touched.
    materializeOnly();

    // Delegate to baseTree's call signature
    if (arguments.length === 0) {
      return (baseTree as unknown as () => TSource)();
    }
    return (baseTree as unknown as (arg: unknown) => void)(arg);
  } as SignalTreeBuilder<TSource, TAccum>;

  // Mark as NodeAccessor
  (builder as unknown as Record<symbol, boolean>)[NODE_ACCESSOR_SYMBOL] = true;

  // Copy all properties from baseTree to builder
  Object.defineProperty(builder, '$', {
    get() {
      finalize();
      return baseTree.$;
    },
    enumerable: false,
    configurable: true,
  });

  // Override 'with' method to maintain builder chain

  // Copy 'bind' method from baseTree (if it exists)
  if (typeof baseTree.bind === 'function') {
    Object.defineProperty(builder, 'bind', {
      value: baseTree.bind.bind(baseTree),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  } else {
    Object.defineProperty(builder, 'bind', {
      value: () => builder,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  // Copy 'destroy' method from baseTree (if it exists)
  // Note: writable: true allows enhancers like guardrails() to override destroy
  if (typeof baseTree.destroy === 'function') {
    Object.defineProperty(builder, 'destroy', {
      value: baseTree.destroy.bind(baseTree),
      enumerable: false,
      writable: true,
      configurable: true,
    });
  } else {
    Object.defineProperty(builder, 'destroy', {
      value: () => {
        /* noop */
      },
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  // Copy 'destroyed' signal from baseTree
  if (baseTree.destroyed) {
    Object.defineProperty(builder, 'destroyed', {
      value: baseTree.destroyed,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  // Copy 'registerCleanup' from baseTree
  if (typeof baseTree.registerCleanup === 'function') {
    Object.defineProperty(builder, 'registerCleanup', {
      value: baseTree.registerCleanup.bind(baseTree),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  // Forward 'updateAndReport' from baseTree (apply partial update +
  // return changed paths). Defined as non-enumerable on baseTree, so it
  // isn't picked up by the generic key copy above.
  Object.defineProperty(builder, 'updateAndReport', {
    value: function (this: unknown, arg?: unknown): string[] {
      finalize();
      const fn = (baseTree as unknown as Record<string, unknown>)[
        'updateAndReport'
      ] as ((a?: unknown) => string[]) | undefined;
      if (!fn) {
        // This is what made the enhancer bug SILENT: a missing method meant an
        // empty report and a dropped write, indistinguishable from "nothing
        // changed". A missing forward target is a broken enhancer chain, never
        // a legitimate state, so say so.
        warnMissingForward('updateAndReport');
        return [];
      }
      return fn.call(baseTree, arg);
    },
    enumerable: false,
    writable: false,
    configurable: true,
  });

  // The `batchUpdate` forward was REMOVED in 14.1.1 along with the method it
  // forwarded. Use `tree(partial)`, or `tree.batch(() => tree(partial))`.

  // Add derived() method
  Object.defineProperty(builder, 'derived', {
    value: function <TDerived extends object>(
      factory: ($: TAccum) => TDerived
    ): SignalTreeBuilder<TSource, TAccum & ProcessDerived<TDerived>> {
      if (isFinalized) {
        throw new Error(
          'SignalTree: Cannot add derived() after tree.$ has been accessed. ' +
            'Chain all .derived() calls before accessing $.'
        );
      }
      derivedQueue.push(factory as ($: unknown) => object);
      // Return same builder - types are updated at compile time
      return builder as unknown as SignalTreeBuilder<
        TSource,
        TAccum & ProcessDerived<TDerived>
      >;
    },
    enumerable: false,
    writable: false,
    configurable: true,
  });

  // Forward everything the enhancers added.
  //
  // signalTree() now applies enhancers to the base tree BEFORE wrapping it, so
  // by the time the builder is created the tree already carries undo(),
  // getRestorationHistory(), transaction() and whatever else was configured. The chained
  // `.with()` used to copy these across one enhancer at a time; the copy has to
  // happen here instead, or the methods exist on the tree and are invisible on
  // the object the caller holds.
  const RESERVED = new Set([
    '$',
    'state',
    'with',
    'bind',
    'destroy',
    'destroyed',
    'registerCleanup',
    'derived',
  ]);
  for (const key of Object.keys(baseTree)) {
    if (RESERVED.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(baseTree, key);
    if (!descriptor) continue;
    try {
      Object.defineProperty(builder, key, descriptor);
    } catch {
      /* non-configurable on the source: nothing useful to do */
    }
  }
  for (const symbolKey of Object.getOwnPropertySymbols(baseTree)) {
    const descriptor = Object.getOwnPropertyDescriptor(baseTree, symbolKey);
    if (!descriptor) continue;
    try {
      Object.defineProperty(builder, symbolKey, descriptor);
    } catch {
      /* ignore */
    }
  }
  return builder;
}

/**
 * THE CANONICAL PUBLIC SIGNATURE LIVES IN `SignalTreeFactoryOf`.
 *
 * The five public overloads used to be declared here AND mirrored in the
 * carrier-parametric factory type, which is two declaration authorities for one
 * semantic signature — they can drift. `SignalTreeFactoryOf<C>` is now the only
 * place the overload set is written; this binds the implementation to it at the
 * kernel's carrier. `@signal-tree/angular` binds the SAME implementation to
 * `'angular'`.
 */
export const signalTree: SignalTreeFactoryOf<'cell'> =
  signalTreeImpl as unknown as SignalTreeFactoryOf<'cell'>;
