import {
  NEUTRAL_MATERIALIZATION_REALIZATION,
  type MaterializationRealization,
} from './materialization-realization';
import {
  NEUTRAL_TREE_REALIZATION,
  bindTreeRealization,
  type TreeRealization,
} from './tree-realization';

/**
 * "Has the adapter already realized this node?" — see
 * `materialization-realization.ts`. Without an adapter this answers `false`,
 * which is the conservative direction: the walk treats the node as ordinary
 * data rather than skipping it.
 */
function isReactiveNode(
  node: unknown,
  realization: MaterializationRealization =
    NEUTRAL_MATERIALIZATION_REALIZATION
): boolean {
  return realization.isReactiveNode(node);
}

import {
  createPositionRegistry,
  type PositionRegistry,
} from './position-registry';
import type { PhysicalCommitClock } from './physical-commit-clock';
import { createRuntimeTreePlan } from './runtime-tree-plan';
import type { RuntimeTreePlan } from './runtime-tree-plan';
import type { TreeCapability } from '../types';
import {
  bindSnapshotParent,
  markSnapshotVolatile,
  materializeSnapshotNode,
  publishMembershipChange,
} from './snapshot-authority';
import { pathObservation } from './path-observation-port';
// ⚠️ THE PORT, NOT THE ENGINE. Marker processors are handed the neutral
// observation port; the only thing any of them calls on it is `notify`. Typing
// this as `PathObservationPort` claimed the whole engine surface and is what let a
// deleted method survive as a silent no-op.
import type { PathObservationPort } from './path-observation-port';
import {
  isNodeAccessor,
  isTraversableNode,
  NODE_STORE_SYMBOL,
} from './node-shape';

// Build-time dev flag. Declared locally rather than inherited from
// `@angular/core`'s ambient types: it is a bundler convention, not a framework
// API, and the kernel's declarations must not depend on Angular for it.
declare const ngDevMode: boolean | undefined;

/**
 * Unified Marker Processing
 *
 * Processes all markers in a signal tree during finalization.
 * Markers are processed in a single pass, converting placeholder objects
 * into their materialized signal forms.
 *
 * Processing order (in finalize()):
 * 1. materializeMarkers() - entityMap, status, stored markers → signals
 * 2. applyDerivedFactory() - configured derived state → computed signals
 *
 * TREE-SHAKING: This module has NO side effects at import time.
 * Built-in markers (entityMap, status, stored) self-register when
 * their factory functions are first called. If you never use a marker,
 * its code is completely tree-shaken from your bundle.
 */

// =============================================================================
// MARKER PROCESSOR REGISTRY
// =============================================================================

/**
 * How a snapshot is being applied. A property of the CALL SITE, not of the
 * data — the call site is the only place that knows whether a process boundary
 * was crossed.
 *
 * - `merge`     — `tree(partial)`. A partial write from application code.
 * - `restore`   — `restoration` undo/redo/jumpTo. Same process; an in-flight
 *                 request may genuinely still be running, so transient state is
 *                 restored VERBATIM.
 * - `rehydrate` — `deserialize` from storage. A process boundary was crossed and
 *                 the payload may be OLD, so a marker that owns a live source
 *                 is entitled to prefer its own fresher result.
 * - `transfer`  — SSR/`TransferState`. A process boundary was crossed and the
 *                 payload is FRESHER than anything here, because nothing in
 *                 this process has run yet. RFC 0014: `rehydrate` used to cover
 *                 both, and the two want OPPOSITE answers — `asyncSource`
 *                 correctly declines a day-old localStorage payload and
 *                 wrongly declined a server payload from milliseconds ago,
 *                 shipping 54.3KB into the page and then refetching anyway.
 *                 was crossed, so nothing is in flight and transient state must
 *                 be normalised rather than believed.
 */
export type HydrateMode = 'merge' | 'restore' | 'rehydrate' | 'transfer';

export interface MaterializationContext {
  readonly cellRuntime: TreeRealization['cell'];
  readonly derivedRuntime: TreeRealization['derived'];
  readonly materializationRealization: TreeRealization['materialization'];
  readonly scalarLeafRealization: TreeRealization['scalarLeaf'];
  readonly suppressTracking: TreeRealization['suppressTracking'];
  positionRegistry: PositionRegistry;
  positionTopologyEnabled: boolean;
  physicalCommitClock?: PhysicalCommitClock;
  hasCapability: (capability: TreeCapability) => boolean;
  /**
   * The finalized build plan, as the runtime queries a materialized node makes
   * of it. Carried here because markers materialize during construction and the
   * subsystems they create — `entityMap`'s retirement boundary above all — need
   * the answer long afterwards.
   */
  runtimeTreePlan: RuntimeTreePlan;
  allocatePositionId: (parentPositionId?: number) => number;
  /**
   * Entity collections that can be asked to reclaim a retired subject.
   *
   * Collected here because a marker materialises with no reference to the root
   * — the context is the only thing it and `signalTree` both see. `signalTree`
   * hands the list to the tree; the reclamation sink broadcasts to it.
   *
   * Structurally typed rather than importing `SubjectPhysicalOwner`, so the
   * bare bundle does not gain an edge to the sink module for a field it never
   * populates. A tree with no restoration authority leaves this empty.
   */
  physicalOwners: Array<{
    __prepareSubjectReclamation(
      subjectId: number,
      options: { causallyEligible: boolean; reclaimLifetimeRecord?: boolean }
    ): unknown;
    __applyPreparedSubjectReclamation(prepared: unknown): void;
  }>;
}

export function createMaterializationContext(
  positionTopologyEnabled = true,
  /**
   * The default is PERMISSIVE, and that is the fail-safe direction here.
   *
   * A context built without a plan — a test, or a direct materialization —
   * answers `true` for everything except position topology, so
   * `hasRestorationAuthority` is `true` and the retirement boundary RETAINS.
   * Reclaiming a subject some unseen owner could still restore is
   * unrecoverable; retaining one nothing will restore costs bytes. Never invert
   * this default to make a test reclaim; pass a real predicate instead.
   */
  hasCapability: (capability: TreeCapability) => boolean = (capability) =>
    capability === 'position-topology' ? positionTopologyEnabled : true,
  physicalCommitClock?: PhysicalCommitClock,
  realization: TreeRealization = NEUTRAL_TREE_REALIZATION
): MaterializationContext {
  const positionRegistry = createPositionRegistry();
  return {
    cellRuntime: realization.cell,
    derivedRuntime: realization.derived,
    materializationRealization: realization.materialization,
    scalarLeafRealization: realization.scalarLeaf,
    suppressTracking: realization.suppressTracking,
    positionRegistry,
    positionTopologyEnabled,
    physicalCommitClock,
    hasCapability,
    runtimeTreePlan: createRuntimeTreePlan(hasCapability),
    allocatePositionId: (parentPositionId?: number) =>
      positionRegistry.allocate(parentPositionId),
    physicalOwners: [],
  };
}

interface MarkerProcessor {
  check: (value: unknown) => boolean;
  create: (
    marker: unknown,
    notifier: PathObservationPort,
    path: string,
    context: MaterializationContext,
    parentPositionId?: number
  ) => unknown;
  /**
   * Live node → the payload that represents its STATE. Anything the node can
   * recompute must be omitted: a derived value frozen into a snapshot is stale
   * the moment anything changes, and a snapshot exists to rehydrate a tree that
   * already knows how to derive.
   *
   * Omitting this means "my node is already a plain signal, the normal walk
   * handles me" — which is true of `stored()` and nothing else today.
   */
  snapshot?: (node: unknown) => unknown;
  /** Payload → live node. See {@link HydrateMode}. */
  hydrate?: (node: unknown, value: unknown, mode: HydrateMode) => void;
  cacheSnapshot: boolean;
}

/**
 * Stamped on every materialised node so finding its processor is O(1).
 *
 * ⚠️ There is NO `owns()` hook. Earlier revisions of this comment referred to
 * one as though it existed, and a research doc then repeated it as fact — the
 * exact stale-comment-becomes-canon failure this codebase keeps hitting.
 * Source ownership is decided INSIDE each marker's `hydrate`, which already
 * receives the mode: `entityMap` declines when `typeof node.load === 'function'`,
 * `asyncSource` declines on `rehydrate` outright. A separate hook would add
 * surface for a decision the existing one can already express.
 *
 * The stamp matters for isolation, not just speed. A linear scan over the
 * registry would put every marker author's predicate on the hot path of every
 * node materialisation, letting one slow third-party check degrade trees that
 * do not contain that marker. A stamp makes a marker's cost payable only by
 * trees that use it — the same boundary lazy self-registration already draws
 * for bundle size.
 *
 * The `SignalTree:` prefix is load-bearing: `unwrap`'s symbol loop skips that
 * prefix by identity, so a correctly-named stamp cannot leak into a snapshot.
 * Name it anything else and it lands in every persisted payload.
 */
const PROCESSOR_STAMP = Symbol.for('SignalTree:MarkerProcessor');

/** @internal Returns the processor that materialised this node, if any. */
export function getNodeProcessor(node: unknown): MarkerProcessor | undefined {
  if (!isTraversableNode(node)) return undefined;
  return (node as Record<symbol, MarkerProcessor | undefined>)[PROCESSOR_STAMP];
}

/**
 * @internal Snapshot a materialised marker node, or `undefined` if the node is
 * not a marker or its processor declines to define a snapshot.
 */
/**
 * Memoised per node, because the wrapper churned on UNRELATED writes.
 *
 * `unwrap` calls this on every parent rebuild, and `isMemoisable` cannot accept
 * a marker node (it recognises tree stores and node accessors only), so each
 * call re-ran `proc.snapshot(node)` and allocated a fresh `{ value }`. Measured:
 * after changing an unrelated leaf, `tree().rows !== previous.rows` even though
 * the collection had not changed — while the `all` array INSIDE it was
 * correctly stable. Only the wrapper churned, and that is enough to make a
 * `computed(() => tree().rows)` recompute and an OnPush component bound to the
 * whole marker re-render on every unrelated write.
 *
 * A `computed` is the right memo here rather than a hand-rolled cache: the
 * marker's snapshot reads the marker's own signals, so Angular's graph already
 * knows exactly when it is stale. Cost is O(1) per marker, not per entity —
 * this is a REFERENCE-STABILITY fix, and it does not touch the per-entity
 * figures in docs/architecture/memory-profile.md, which are the entityMap's id
 * index and storage.
 */
export function snapshotMarkerNode(
  node: unknown,
  parent?: object
): { value: unknown } | undefined {
  const proc = getNodeProcessor(node);
  if (!proc?.snapshot) return undefined;
  if (!isTraversableNode(node)) return { value: proc.snapshot(node) };
  if (parent) bindSnapshotParent(node as object, parent);
  if (!proc.cacheSnapshot) {
    markSnapshotVolatile(node as object);
    return { value: proc.snapshot(node) };
  }

  const snapshot = proc.snapshot;
  return materializeSnapshotNode(node as object, () => ({
    value: snapshot(node),
  }));
}

/** @internal Hydrate a materialised marker node. Returns false if unhandled. */
export function hydrateMarkerNode(
  node: unknown,
  value: unknown,
  mode: HydrateMode
): boolean {
  const proc = getNodeProcessor(node);
  if (!proc?.hydrate) return false;
  proc.hydrate(node, value, mode);
  return true;
}

// =============================================================================
// HYDRATION DECISIONS — §5.5
// =============================================================================

/**
 * Registry of marker processors.
 * Order matters: first match wins.
 */
const MARKER_PROCESSORS: MarkerProcessor[] = [];

/**
 * Check if a value matches any registered marker processor.
 * Used by createSignalStore to preserve markers for later materialization.
 *
 * This enables user-defined markers registered via registerMarkerProcessor()
 * to be preserved during tree creation and materialized later.
 *
 * @param value - The value to check
 * @returns true if the value is a registered marker
 */
export function isRegisteredMarker(value: unknown): boolean {
  // Early exit for non-objects
  if (value === null || typeof value !== 'object') {
    return false;
  }

  // Fast path: most objects don't have Symbol keys
  // Custom markers typically use Symbols for identification
  if (Object.getOwnPropertySymbols(value).length === 0) {
    return false;
  }

  for (const processor of MARKER_PROCESSORS) {
    if (processor.check(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a value has Symbol keys but isn't a registered marker.
 * Used for dev-mode warnings about potential registration timing issues.
 *
 * @param value - The value to check
 * @returns true if value has Symbols but no matching processor
 * @internal
 */
export function hasUnregisteredSymbolKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const symbolKeys = Object.getOwnPropertySymbols(value);
  if (symbolKeys.length === 0) {
    return false;
  }
  // Has Symbols but no registered processor matched
  return !isRegisteredMarker(value);
}

/**
 * Register a marker processor.
 *
 * Built-in markers call this automatically when their factory is first used.
 * Custom markers should call this at app startup, BEFORE creating trees.
 *
 * @param check - Type guard function to identify the marker
 * @param create - Factory function to create the materialized signal
 *
 * @example
 * ```typescript
 * // Custom marker registration (call before creating trees)
 * registerMarkerProcessor(isCounterMarker, createCounterSignal);
 * ```
 */
export function registerMarkerProcessor<T, R>(
  check: (value: unknown) => value is T,
  create: (
    marker: T,
    notifier: PathObservationPort,
    path: string,
    context: MaterializationContext,
    parentPositionId?: number
  ) => R,
  hooks?: {
    snapshot?: (node: R) => unknown;
    hydrate?: (node: R, value: unknown, mode: HydrateMode) => void;
    transient?: true;
  }
): void {
  // Public entry point — used for custom markers. Emits the post-construction
  // timing warning, because an imperative custom-marker registration that lands
  // after trees already exist is a genuine footgun.
  registerProcessor(
    check,
    create,
    /* suppressTimingWarning */ false,
    /* cacheSnapshot */ false,
    hooks
  );
}

/**
 * Register a built-in marker processor (status, entityMap, stored, form,
 * asyncSource).
 *
 * Built-in markers self-register lazily on first factory call (for tree-shaking).
 * That factory call always happens INSIDE the state literal — `signalTree({ x:
 * status() })` evaluates `status()` before `signalTree()` runs — so the processor
 * is always registered before the tree it belongs to is materialized. The marker
 * is therefore correct-by-construction and the post-construction timing warning
 * does NOT apply, even when earlier trees (that never used this marker) already
 * exist. Suppress it to avoid false alarms in multi-store / lazy-module apps.
 *
 * @internal
 */
export function registerBuiltinMarkerProcessor<T, R>(
  check: (value: unknown) => value is T,
  create: (
    marker: T,
    notifier: PathObservationPort,
    path: string,
    context: MaterializationContext,
    parentPositionId?: number
  ) => R,
  hooks?: {
    snapshot?: (node: R) => unknown;
    hydrate?: (node: R, value: unknown, mode: HydrateMode) => void;
    transient?: true;
  }
): void {
  registerProcessor(
    check,
    create,
    /* suppressTimingWarning */ true,
    /* cacheSnapshot */ true,
    hooks
  );
}

/**
 * ST2022 — a marker registered without saying what of it is state.
 *
 * This is the guard against the defect class that produced FOUR separate bugs:
 * `form()` and the three async markers vanishing from every snapshot,
 * `entityMap` emitting a `map` that JSON rendered as `{}` while holding 10,000
 * entities, and `status()` shipping six computeds plus nine setter METHODS into
 * a payload that then threw on restore. All four share one cause — nothing ever
 * forced a marker author to answer *"what of me is state?"*
 *
 * Enforced at REGISTRATION rather than at materialisation, because
 * `materializeMarkers` swallows `create()` throws (RFC 0005 §7), so a
 * materialiser-level guard fails open — the lesson `entityMap({ load })` already
 * learned with [ST2004].
 *
 * Three answers are valid, and silence is not one of them:
 *   - `snapshot` (+ optional `hydrate`) — here is my state
 *   - `transient: true` — I deliberately have none; omit me, and do not warn
 *   - a node that is already a real Angular signal — the ordinary walk handles
 *     it, and this check does not apply
 *
 * Warns rather than throws, for now: `registerMarkerProcessor` is public and
 * throwing would break every existing third-party marker at runtime rather than
 * at author time. The type signature makes it a compile error for anyone using
 * the types; this catches the ones who cast past them. It should become a throw
 * in the next major.
 */
function warnUndeclaredMarker(): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  console.warn(
    'SignalTree: a marker was registered without `snapshot` or ' +
      '`transient: true`. Its value will be DROPPED from every snapshot — ' +
      'tree(), persistence(), devtools, audit and undo/redo — silently, ' +
      'except for an ST2008 report at read time. Declare what of your marker ' +
      'is state: pass `{ snapshot, hydrate }`, or `{ transient: true }` if it ' +
      'deliberately has none. [ST2022]'
  );
}

/**
 * ST2023 — a marker that can be SNAPSHOTTED but never restored.
 *
 * This is the half of the marker-drop class that [ST2022] cannot see. ST2022
 * asks "what of you is state?" and a `snapshot` hook answers it, so a processor
 * with `snapshot` and no `hydrate` passes registration cleanly — then serializes
 * perfectly and silently discards every write. Measured on a probe marker:
 * `tree()` emitted `{"p":1}`, `tree({p: 99})` left the node at `1`, and NOTHING
 * was reported. `tree(tree())` on such a marker loses data with no diagnostic
 * at either end.
 *
 * Why HERE and not at registration, and not on the write path:
 *
 *  - **Not at registration.** `snapshot` without `hydrate` is perfectly correct
 *    when the node is a writable signal — `recursiveUpdate`'s leaf branch writes
 *    it, no hook needed. Registration cannot know the node's shape, so a guard
 *    there would fire on correct code. That is precisely how the previous
 *    attempt at a write-shape diagnostic (the retired core ST2005) failed: it
 *    sat where ordinary writes reached it and cried wolf on `tree({known: 2})`
 *    and on type-legal `{ user: undefined }`.
 *  - **Not on the write path.** The write path is the thing this design
 *    protects; it should not grow a registry lookup to serve a third-party
 *    authoring mistake.
 *  - **Here**, at materialisation, the node EXISTS, so its shape is knowable,
 *    and the check is one property read per marker node, once — off the write
 *    path entirely. It also fires before the user ever attempts a restore,
 *    which matters because the bug is latent until then.
 *
 * The predicate is deliberately the exact MIRROR of `recursiveUpdate`'s
 * fall-through (`isSignal(node) && 'set' in node`). Anything that branch can
 * write is not dropped and is not reported; anything it cannot write, and that
 * has no `hydrate`, is. Keeping the two in one shape is what makes this
 * incapable of crying wolf — if the fall-through ever widens, this must widen
 * with it.
 *
 * Reachable only by a marker registered through the public
 * `registerMarkerProcessor`; no built-in marker trips it (all declare `hydrate`
 * or are signal-shaped), which is why it costs existing users nothing.
 */
const warnedWriteOnly = new WeakSet<object>();

function warnWriteOnlyMarker(
  processor: MarkerProcessor,
  node: unknown,
  realization: MaterializationRealization
): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  if (!processor.snapshot || processor.hydrate) return;
  // Exactly what `recursiveUpdate` falls through to. If that can write the
  // node, no hook is needed and there is nothing to report.
  if (isReactiveNode(node, realization) && 'set' in (node as object)) return;
  if (warnedWriteOnly.has(processor as object)) return;
  warnedWriteOnly.add(processor as object);
  console.warn(
    'SignalTree: a marker declares `snapshot` but no `hydrate`, and its node ' +
      'is not a writable signal. It will be captured by tree(), persistence(), ' +
      'devtools, audit and undo/redo — and every attempt to write it back is ' +
      'SILENTLY DISCARDED, so tree(tree()) loses its value. Add a `hydrate` ' +
      'hook, or mark it `transient: true` if it is genuinely not restorable. ' +
      '[ST2023]'
  );
}

function registerProcessor<T, R>(
  check: (value: unknown) => value is T,
  create: (
    marker: T,
    notifier: PathObservationPort,
    path: string,
    context: MaterializationContext
  ) => R,
  suppressTimingWarning: boolean,
  cacheSnapshot: boolean,
  hooks?: {
    snapshot?: (node: R) => unknown;
    hydrate?: (node: R, value: unknown, mode: HydrateMode) => void;
    transient?: true;
  }
): void {
  // Dev-mode validation: prevent invalid argument types with a clear error.
  if (typeof check !== 'function' || typeof create !== 'function') {
    throw new TypeError(
      "registerMarkerProcessor: both 'check' (type guard) and 'create' " +
        '(materializer) must be functions. Received check=' +
        typeof check +
        ', create=' +
        typeof create +
        '. ' +
        'See https://signaltree.io/docs (custom markers section) for usage.'
    );
  }

  // Prevent duplicate registration (same check function)
  const alreadyRegistered = MARKER_PROCESSORS.some((p) => p.check === check);
  if (alreadyRegistered) {
    return;
  }

  // Dev-mode warning when registering after at least one tree has been built.
  // Markers registered AFTER tree construction won't be processed in that tree
  // — they only take effect for trees built after registration. This is one of
  // the top "why isn't my custom marker working?" support questions. Built-in
  // markers route through registerBuiltinMarkerProcessor() and suppress it.
  if (
    !suppressTimingWarning &&
    (typeof ngDevMode === 'undefined' || ngDevMode) &&
    treesConstructedCount > 0
  ) {
    console.warn(
      '[SignalTree] registerMarkerProcessor() was called AFTER at least one ' +
        `signalTree() had already been constructed (${treesConstructedCount} trees so far). ` +
        'Existing trees will NOT pick up this marker — only trees built after ' +
        'this point will use it. To process your custom marker in existing ' +
        'trees, register it at module load time (before any signalTree() call), ' +
        'or rebuild the tree after registration.'
    );
  }

  if (!hooks?.snapshot && !hooks?.transient) warnUndeclaredMarker();

  MARKER_PROCESSORS.push({
    check,
    create: create as (
      marker: unknown,
      notifier: PathObservationPort,
      path: string,
      context: MaterializationContext
    ) => unknown,
    snapshot: hooks?.snapshot as ((node: unknown) => unknown) | undefined,
    hydrate: hooks?.hydrate as
      | ((node: unknown, value: unknown, mode: HydrateMode) => void)
      | undefined,
    cacheSnapshot,
  });
}

/**
 * @internal
 * Incremented every time a tree is materialized. Used to detect
 * post-construction registerMarkerProcessor() calls in dev mode.
 */
let treesConstructedCount = 0;

/**
 * @internal
 * Called by signalTree() to record that a tree has been built. Powers the
 * post-construction warning in registerMarkerProcessor.
 */
export function _recordTreeConstruction(): void {
  treesConstructedCount += 1;
}

// =============================================================================
// MATERIALIZATION
// =============================================================================

/**
 * Process all markers in a tree node.
 * Walks recursively, replacing markers with materialized signals.
 *
 * @param node - The tree node to process (usually tree.$)
 * @param notifier - PathObservationPort for entity signals
 * @param path - Current path for nested processing
 */
/**
 * ORDINARY-STATE MATERIALIZATION REQUEST — DYN-CONSTRUCTION-AUTHORITY-0.
 *
 * A marker processor returns this to say: *"materialize this payload here as
 * ordinary SignalTree state."* It does NOT make the processor a constructor.
 *
 *     ENCODING DOES NOT CHOOSE AUTHORITY. THE CALLER DOES.
 *
 * ```text
 * processor owns          recognizing its marker, extracting the natural value
 * processor does NOT own  PositionId allocation, slot creation, branch/leaf
 *                         construction, mutation capture, publication,
 *                         framework storage, recursive topology
 * ```
 *
 * ⚠️ THE MATERIALIZER IS NOT REACHABLE FROM `processor.create`. It is threaded
 * to the DISPATCHER below, never handed to a processor — deliberately, because
 * putting it on `MaterializationContext` (which processors DO receive) would
 * give every marker a general recursive tree-construction capability that
 * nothing has earned. `entityMap` is the counter-example that proves the point:
 * it builds its own physical layer because entities are genuinely a different
 * structure, and it must not become the template for markers that resolve into
 * ORDINARY topology.
 *
 * ⚠️ THE MARKER MUST NOT ADD A PHYSICAL TOPOLOGY LEVEL. The authored marker
 * occupies the location syntactically; the resulting subtree occupies it
 * semantically. For `users: dyn({ alice: … })` the canonical paths stay
 * `users`, `users.alice`, `users.alice.name` — no hidden subject between.
 */
const ORDINARY_STATE = Symbol.for('SignalTree:OrdinaryStateRequest');

export interface OrdinaryStateRequest {
  readonly [ORDINARY_STATE]: true;
  readonly value: unknown;
  /**
   * ⚠️ DYNAMIC CAPABILITY DECORATES THE CANONICAL BRANCH; IT DOES NOT CONSTRUCT
   * A DIFFERENT BRANCH. The request may DESCRIBE that the resulting ordinary
   * branch needs keyed lookup; it still hands no recursive construction
   * authority back to the marker.
   */
  readonly keyedLookup?: boolean;
}

/**
 * @internal Ask the canonical authority to materialize `seed` as the ordinary
 * BRANCH value of this location.
 *
 * ⚠️ DELIBERATELY NARROW. This admits a plain recursively-materializable object
 * and nothing else. Supporting arbitrary payloads — primitives, arrays, Dates,
 * signals, other markers — would mean extracting the parent loop's entire value
 * classification switch, which nothing has earned. Widen only against evidence.
 */
export function ordinaryBranch(
  seed: object,
  options?: { keyedLookup?: boolean }
): OrdinaryStateRequest {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (
      !isTraversableNode(seed) ||
      Array.isArray(seed) ||
      typeof seed === 'function'
    ) {
      throw new Error(
        'SignalTree: ordinaryBranch() takes a plain object branch payload.'
      );
    }
  }
  return {
    [ORDINARY_STATE]: true,
    value: seed,
    keyedLookup: options?.keyedLookup,
  };
}

/**
 * @internal Branch-local key index.
 *
 *     THE INDEX LOCATES LOCATIONS. IT DOES NOT CONTAIN STATE.
 *
 * Entries point at the children canonical construction ALREADY produced, so
 * `at(key)` returns the exact same object as `branch.key` — proven by reference
 * identity, not by equivalence. No duplicate Location, PositionId, slot or
 * publication authority exists.
 */
const KEY_INDEX = Symbol.for('SignalTree:DynamicKeyIndex');
const MEMBER_MATERIALIZER = Symbol.for('SignalTree:MemberMaterializer');

function attachKeyIndex(branch: object): void {
  const members = new Map<string, unknown>();
  for (const key of Object.keys(branch)) {
    members.set(key, (branch as Record<string, unknown>)[key]);
  }
  Object.defineProperty(branch, KEY_INDEX, {
    value: members,
    enumerable: false,
    configurable: true,
  });
}

/**
 * @internal Establish `key` as a present member of a dynamic branch, carrying
 * `value`.
 *
 *     ACQUISITION IS CREATE-IF-NEVER-SEEN, REACTIVATE-IF-DORMANT,
 *     REUSE-IF-ACTIVE.
 *
 *     IDENTITY DISCOVERY PRECEDES IDENTITY ACQUISITION.
 *     FIRST APPEARANCE AUTHORITY MUST NOT RUN FOR AN IDENTITY THAT ALREADY
 *     EXISTS.
 *
 * ⚠️ AN EARLIER VERSION CALLED THE CONSTRUCTOR UNCONDITIONALLY. Measured over
 * 1000 same-key add/remove cycles: 4000 PositionIds and — once observed — 2000
 * memos and 2000 membership carriers, because every re-add built a brand new
 * canonical Location and discarded the previous one. Index and property
 * cardinality stayed flat, so nothing accumulated in the branch; what grew was
 * redundant CONSTRUCTION. That also split one semantic subject across two
 * behaviours: whole-value reactivation preserved identity while this path did
 * not.
 *
 * The index answers "have we ever established canonical identity for this key".
 * The parent still answers "is that identity semantically present now" —
 * THE INDEX DISCOVERS CANONICAL MEMBERS; IT DOES NOT DEFINE THEIR EXISTENCE.
 *
 *     DISCOVERABILITY MUST FOLLOW SUCCESSFUL AUTHORITY ACQUISITION.
 *
 * Construction still happens before anything becomes discoverable, so a
 * throwing materialization leaves no phantom.
 */
export function materializeMember(
  branch: unknown,
  key: string,
  value: unknown
): unknown {
  if (!isTraversableNode(branch)) return undefined;
  const index = (branch as Record<symbol, Map<string, unknown> | undefined>)[
    KEY_INDEX
  ];

  // ── IDENTITY DISCOVERY FIRST ────────────────────────────────────────────
  const existing = index?.get(key);
  if (existing !== undefined) {
    // Reactivate / update through the ordinary membership + value substrate.
    // ⚠️ NOT by re-entering the public whole-value branch syntax: this operation
    // already knows its subject and its intent, and AN OPERATION THAT KNOWS ITS
    // MUTATION SEMANTICS MUST NOT RE-ENTER SYNTAX WHOSE JOB IS TO INFER THEM.
    applyMemberValue?.(branch as object, key, existing, value);
    return existing;
  }

  const bind = (branch as Record<symbol, MemberMaterializer | undefined>)[
    MEMBER_MATERIALIZER
  ];
  if (!bind) return undefined;

  const child = bind(key, value); // may throw — nothing observable yet

  // ⚠️ BOTH THE ACCESSOR AND ITS BACKING STORE. A node accessor COPIES its
  // store's properties, but its CALL path closes over the original store — so
  // installing only on the accessor leaves `branch()` and every snapshot blind
  // to the new member.
  const define = (target: object) => {
    Object.defineProperty(target, key, {
      value: child,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  };
  define(branch as object);
  const backingStore = (branch as Record<symbol, unknown>)[
    NODE_STORE_SYMBOL
  ] as object | undefined;
  if (backingStore && backingStore !== branch) define(backingStore);

  index?.set(key, child);
  publishMembershipChange(branch as object);
  return child;
}

/**
 * @internal Applies a supplied value to an EXISTING member, activating its
 * membership if dormant. Registered by `signal-tree`, which owns the membership
 * and value convergence points — the same reason the construction authority is
 * threaded rather than imported.
 */
let applyMemberValue:
  | ((parent: object, key: string, member: unknown, value: unknown) => void)
  | undefined;

/** @internal */
export function setMemberValueApplier(
  fn: (parent: object, key: string, member: unknown, value: unknown) => void
): void {
  applyMemberValue = fn;
}

// ⚠️ NOT EXPORTED. Used only inside this module; the `export` was surplus.
// (ORPHAN sweep, 15.0. Same-file-only proves the EXPORT is unnecessary — it says
// nothing about who owns the code, and this code is live.)
function isOrdinaryStateRequest(v: unknown): v is OrdinaryStateRequest {
  return (
    isTraversableNode(v) &&
    (v as Record<symbol, unknown>)[ORDINARY_STATE] === true
  );
}

/**
 * @internal Performs ordinary construction at a location. Supplied by
 * `signalTree`, which is where the canonical construction context lives.
 */
export type OrdinaryStateMaterializer = (
  value: unknown,
  path: string,
  parentPositionId?: number
) => unknown;

/**
 * @internal Adds a member to an ALREADY-CANONICAL dynamic branch, for the
 * lifetime of the tree.
 *
 *     OWNER IDENTITY DEFINES THE MATERIALIZATION DOMAIN.
 *
 * The caller supplies only `key` and `value`. Path and parent PositionId are
 * DERIVED from the owning branch, so there is no argument through which a caller
 * could target topology elsewhere in the tree.
 */
export type MemberMaterializer = (key: string, value: unknown) => unknown;

/**
 * @internal The canonical construction authority as seen by the marker
 * dispatcher.
 *
 * ⚠️ `bindMember` is invoked ONLY for a branch that requested keyed lookup, so a
 * tree with no dynamic branches never causes the shared lifetime runtime to be
 * created. That is what protects the PERF-DYNAMIC-0/B result architecturally
 * rather than by accident.
 */
export interface OrdinaryConstructionAuthority {
  materialize: OrdinaryStateMaterializer;
  bindMember: (ownerBranch: object) => MemberMaterializer;
}

/**
 * Materialize the ordinary branch, then DECORATE it if the request asked for
 * keyed lookup. The decoration happens strictly AFTER canonical construction and
 * never replaces it.
 */
function materializeKeyedAware(
  authority: OrdinaryConstructionAuthority,
  request: OrdinaryStateRequest,
  path: string,
  parentPositionId?: number
): unknown {
  const branch = authority.materialize(request.value, path, parentPositionId);
  if (request.keyedLookup && isTraversableNode(branch)) {
    attachKeyIndex(branch as object);
    // Lifetime authority is granted ONLY here — to a branch whose contract
    // includes post-construction topology acquisition.
    Object.defineProperty(branch as object, MEMBER_MATERIALIZER, {
      value: authority.bindMember(branch as object),
      enumerable: false,
      configurable: true,
    });
  }
  return branch;
}

export function materializeMarkers(
  node: unknown,
  notifier?: PathObservationPort,
  path: string[] = [],
  context: MaterializationContext = createMaterializationContext(),
  authority?: OrdinaryConstructionAuthority
): void {
  if (!isTraversableNode(node)) return;
  if (context.materializationRealization.isReactiveNode(node)) return;

  // Handle NodeAccessors (functions with properties)
  const isAccessor = typeof node === 'function' && isNodeAccessor(node);
  if (typeof node === 'function' && !isAccessor) return;

  // Lazy-init notifier only if needed
  // ⚠️ RESOLVED PER CALL, NOT CACHED INTO `notifier`. Caching would freeze
  // whichever answer existed when the FIRST marker materialized — and an
  // enhancer that installs delivery later in construction would then be
  // invisible to every marker created before it.
  const getNotifier = (): PathObservationPort => notifier ?? pathObservation();

  const keys = Object.keys(node as object);

  for (const key of keys) {
    const value = (node as Record<string, unknown>)[key];
    const currentPath = [...path, key];
    const pathString = currentPath.join('.');

    // Check each registered marker processor
    let processed = false;
    for (const processor of MARKER_PROCESSORS) {
      if (processor.check(value)) {
        try {
          const parentPositionId = (node as { __positionIds?: number[] })
            .__positionIds?.[0];
          const produced = processor.create(
            value,
            getNotifier(),
            pathString,
            context,
            parentPositionId
          );
          // The processor DESCRIBED ordinary state; the canonical authority
          // BUILDS it. Same equality, buildPlan, captureRuntime, slot runtime,
          // position registry and path as any inline branch — and at THIS
          // location, so no extra topology level appears.
          const materialized =
            isOrdinaryStateRequest(produced) && authority
              ? materializeKeyedAware(
                  authority,
                  produced,
                  pathString,
                  parentPositionId
                )
              : produced;
          // Stamp the owning processor so lookup is an O(1) property read
          // rather than a scan over every registered marker. Non-enumerable so
          // it cannot reach a string-key walk; the `SignalTree:` prefix keeps
          // it out of the symbol walk too.
          if (isTraversableNode(materialized)) {
            bindTreeRealization(
              materialized as object,
              {
                cell: context.cellRuntime,
                derived: context.derivedRuntime,
                materialization: context.materializationRealization,
                scalarLeaf: context.scalarLeafRealization,
              }
            );
            Object.defineProperty(materialized, PROCESSOR_STAMP, {
              value: processor,
              enumerable: false,
              writable: false,
              configurable: true,
            });
          }
          // Inline guard, not one inside the callee: esbuild folds the full
          // expression at the CALL SITE and nothing else (docs/performance/
          // dropping-dev-code.md), so a guard hidden in the function body
          // ships its message string to production.
          if (typeof ngDevMode === 'undefined' || ngDevMode) {
            warnWriteOnlyMarker(
              processor,
              materialized,
              context.materializationRealization
            );
          }
          (node as Record<string, unknown>)[key] = materialized;
          // A node accessor copies its store's properties, but its CALL path
          // closes over the original store. Writing only to the accessor
          // leaves that store holding the raw marker forever — which is why a
          // nested marker used to surface as a raw marker object from `tree()`
          // and why a merge write through a parent never reached it. Update
          // both so the two views agree.
          const backingStore = (node as Record<symbol, unknown>)[
            NODE_STORE_SYMBOL
          ] as Record<string, unknown> | undefined;
          if (backingStore && backingStore !== node) {
            backingStore[key] = materialized;
          }
          processed = true;
        } catch (err) {
          if (typeof ngDevMode === 'undefined' || ngDevMode) {
            console.error(
              `SignalTree: Failed to materialize marker at "${pathString}"`,
              err
            );
          }
        }
        break;
      }
    }

    // Recurse into unprocessed objects/accessors
    if (!processed && value != null) {
      if (isNodeAccessor(value)) {
        // NodeAccessor - recurse to find nested markers
        materializeMarkers(value, notifier, currentPath, context, authority);
      } else if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !isReactiveNode(value, context.materializationRealization)
      ) {
        // Plain object - recurse
        materializeMarkers(value, notifier, currentPath, context, authority);
      }
    }
  }
}
