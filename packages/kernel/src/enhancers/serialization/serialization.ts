declare const ngDevMode: boolean | undefined;
// ⚠️ FOUR IMPORTS DELETED BY PERSISTENCE-AS-LINK-SWAP-0, and they are the
// receipt for what the swap actually removed rather than moved:
//
//   withWriteContext / getActiveWriteContext   `load()` hand-tagging inbound
//                                              writes `{ origin: 'external',
//                                              participation: 'realized' }`.
//                                              Link's `external()` IS that pair.
//   scheduleDurableConsequence                 autoSave's own settlement claim
//   cancelDurableConsequence                   and its own teardown of it.
//                                              Link owns one claim for the
//                                              whole relationship.
//
// Persistence no longer reaches for causal primitives at all. It supplies a
// codec, a key and a backend; the relationship is Link's.
import type { HydrateMode } from '../../lib/internals/materialize-markers';
import type { ReadableCell, WritableCell } from '../../lib/internals/cell-runtime';


/**
 * Is this node of the tree a WRITABLE cell?
 *
 * SERIALIZATION-REACTIVE-NEED-0 — outcome **SER-A, REDUNDANT.** This was
 * `isSignal` from `@angular/core`, then briefly the realization predicate. It is
 * now neither: a purely structural check, with no framework and no realization
 * dependency.
 *
 *     DO NOT REPLACE AN UNNEEDED FRAMEWORK DEPENDENCY WITH AN UNNEEDED
 *     ABSTRACTION.
 *
 * Measured, per path:
 *
 *   ENCODE      `encodeSnapshot(tree(), …)` receives the MATERIALIZED snapshot,
 *               not the signal tree. Probed: a `.derived()` computed is absent
 *               from `tree()` (`["a","b"]`, no `sum`). No reactive value reaches
 *               the replacer at all — the code's own comment already said so:
 *               "Skip signals - we already unwrapped them".
 *
 *   HYDRATE     Walks `$`, which DOES contain readonly computeds — probed: a
 *               function with NO `.set`. Every site there either already paired
 *               the check with this same structural fallback, or is resolving a
 *               WRITE TARGET, which a readonly computed can never be.
 *
 * ⚠️ AND THE FRAMEWORK ARM WAS ARGUABLY UNSOUND WHERE IT DIFFERED. At the
 * write-target sites `isSignal(candidate)` answers TRUE for a readonly
 * `computed()` and the result is cast `as WritableSignal` — a `.set` that does
 * not exist. The structural check answers FALSE and the site correctly skips.
 * Untested either way; recorded, not fixed here.
 *
 * ⚠️ THE EARLIER RATIONALE FOR ROUTING THIS THROUGH THE REALIZATION IS
 * WITHDRAWN. It argued "a tree using persistence() is already in a framework
 * context". That is wrong for a framework-neutral kernel: persistence is a
 * surviving kernel capability, and a headless or server tree must not lose the
 * ability to persist because no framework is installed.
 *
 *     OPTIONAL DOES NOT MEAN FRAMEWORK-DEPENDENT.
 */
const isSignal = (v: unknown): v is ReadableCell<unknown> =>
  typeof v === 'function' && 'set' in (v as object) &&
  typeof (v as { set?: unknown }).set === 'function';

import { hydrateMarkerNode } from '../../lib/internals/materialize-markers';
import { external } from '../../lib/external';
import { isTraversableNode } from '../../lib/utils';
import { ISignalTree } from '../../lib/types';
import type { Enhancer, EnhancerMeta } from '../../lib/types';
import { ENHANCER_META } from '../../lib/types';
import { link, type LinkEndpoint } from '../../lib/link';
import { TYPE_MARKERS } from './constants';
import type { StorageAdapter } from './storage-adapters';

/**
 * SignalTree Serialization Module
 *
 * Provides serialization and deserialization capabilities for SignalTree,
 * enabling state persistence, SSR, and state transfer between contexts.
 */
/**
 * Interface for SignalTree with debug configuration
 */
interface SignalTreeWithConfig<T = unknown> extends ISignalTree<T> {
  __config?: {
    debugMode?: boolean;
  };
}

/**
 * Interface for enhanced SignalTree with auto-save functionality
 */
interface EnhancedSignalTree<T = unknown> extends SerializableSignalTree<T> {
  __flushAutoSave?: () => Promise<void>;
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The SNAPSHOT FORMAT version — the shape of `data`, not the application.
 *
 * Bumped 1.0.0 → 2.0.0 for the marker snapshot/hydrate work, which changed the
 * payload twice: markers gained their own `snapshot()` (so `form()`,
 * `asyncSource` and friends now APPEAR where they used to be silently absent),
 * and `serialize()` stopped using its private walker (so `status()` no longer
 * emits six computeds and nine setter methods, and `entityMap` no longer emits
 * a `map` that JSON renders as `{}`).
 *
 * ONE bump for two changes, deliberately: nothing published between them, so
 * they reach users as a single transition and a second bump would invent a
 * version nobody ever ran.
 *
 * ⚠️ WRITTEN, NOT YET ENFORCED. The two halves have opposite reversibility.
 * Writing the tag is IRREVERSIBLE — payloads already sitting in a user's
 * localStorage can never be given one retroactively, so it has a deadline and
 * that deadline is "before another payload-shape change ships". Enforcing a
 * policy is fully reversible: it is code, changeable in any later release, by
 * which time every payload carries a tag.
 *
 * ⚠️ WHEN A POLICY LANDS, `1.0.0` MEANS LEGACY/UNKNOWN, NOT "format 1". Every
 * payload ever written says `1.0.0`, including all of them written while this
 * field was decorative — emitted at two sites and read only into a `debugMode`
 * console.log. A "reject unknown versions" policy would therefore reject the
 * entire installed base. Treat it as "written before versioning meant
 * anything" and migrate on a best-effort basis.
 *
 * Distinct from `timestamp`, which answers "when" and can never answer "what
 * shape": during a rolling deploy old and new clients write concurrently, so a
 * NEWER timestamp can carry an OLDER shape.
 */
const SNAPSHOT_FORMAT_VERSION = '2.0.0';

/**
 * Serialization configuration options
 */
export interface SerializationConfig {
  /**
   * Treat a `deserialize()` payload as an SSR TRANSFER rather than a storage
   * restore. Only meaningful on `deserialize`; ignored by `serialize`.
   *
   * Both cross a process boundary, so both used to be `rehydrate` — and they
   * want OPPOSITE answers from any marker that owns a live source. A payload
   * from `localStorage` may be days old and the local loader will fetch
   * something better, so declining it is right. A payload from the server was
   * fetched milliseconds ago and the local loader has NOT run, so declining it
   * ships the bytes into the page and then refetches: measured at 54.3KB
   * wasted for a 500-row collection.
   *
   * ```ts
   * // client bootstrap
   * const ts = inject(TransferState);
   * if (ts.hasKey(KEY)) tree.deserialize(ts.get(KEY, '{}'), { transfer: true });
   * ```
   *
   * What it changes: `asyncSource` and loader-backed `entityMap` ACCEPT the
   * payload instead of declining. What it deliberately does NOT change: an
   * in-flight `LOADING` status is still normalised (a request in flight on the
   * server is not in flight here), and a form's `touched` is still not
   * restored (that objection is half-restoration, not staleness). RFC 0014.
   *
   * @default false
   */
  transfer?: boolean;

  /**
   * Whether to include metadata (timestamps, version, etc.)
   * @default true
   */
  includeMetadata?: boolean;

  /**
   * Custom replacer function for JSON.stringify
   */
  replacer?: (key: string, value: unknown) => unknown;

  /**
   * Custom reviver function for JSON.parse
   */
  reviver?: (key: string, value: unknown) => unknown;

  /**
   * Whether to preserve special types (Date, RegExp, etc.)
   * @default true
   */
  preserveTypes?: boolean;

  /**
   * Maximum depth to serialize (prevents infinite recursion)
   * @default 50
   */
  maxDepth?: number;

  /**
   * Whether to handle circular references
   * @default true
   */
  handleCircular?: boolean;
}

/**
 * Serialized state wrapper with metadata
 */
export interface SerializedState<T = unknown> {
  /**
   * The actual serialized state data
   */
  data: T;

  /**
   * Metadata about the serialization
   */
  metadata?: {
    /**
     * Timestamp when serialized
     */
    timestamp: number;

    /**
     * Version of the SNAPSHOT FORMAT — the shape of `data`, not the app.
     *
     * ⚠️ NOT YET ENFORCED, and that is deliberate. Writing the tag is
     * irreversible: payloads already sitting in a user's localStorage can never
     * be given one retroactively. Enforcing a policy is fully reversible —
     * it is code, changeable in any later release, by which time every payload
     * carries a tag. So the tag is written now and the policy is left open.
     *
     * ⚠️ `'1.0.0'` IS NOT A CLEAN BASELINE. Every payload ever written says
     * `1.0.0`, including all of them written while this field was decorative
     * (emitted at two sites, read only into a `debugMode` console.log). When a
     * policy does land it must treat `1.0.0` as LEGACY/UNKNOWN, not as a known
     * shape — "reject unknown versions" would reject the entire installed base.
     *
     * The first real bump belongs to the marker snapshot/hydrate work, which
     * changed the payload twice (markers gained snapshots; `serialize()` stopped
     * using its private walker). Nothing published between those, so they reach
     * users as ONE transition and deserve ONE bump.
     *
     * Distinct from `timestamp`, which answers "when" and cannot answer "what
     * shape": during a rolling deploy old and new clients write concurrently,
     * so a NEWER timestamp can carry an OLDER shape, and client clocks are not
     * trustworthy anyway. A version bumps only when the shape changes, which is
     * the one thing a timestamp can never express.
     */
    version: string;

    /**
     * Custom application version.
     *
     * ⚠️ DECLARED BUT NEVER WRITTEN OR READ — anywhere, by anything. It exists
     * only as a type. Kept rather than deleted because removing a public
     * optional field is a breaking change for anyone who sets it in a config
     * object, but nothing consumes it: setting it has no effect today.
     */
    appVersion?: string;

    /**
     * Type information for special objects
     */
    types?: Record<string, string>;

    /**
     * Circular reference paths
     */
    circularRefs?: Array<{ path: string; targetPath: string }>;
    /**
     * Optional map of paths that indicate where the target tree contains
     * branch nodes (objects with set/update) or root-as-signal markers.
     * Keys are paths (dot/array notation), values: 'b' = branch, 'r' = root
     */
    nodeMap?: Record<string, 'b' | 'r'>;
  };
}

/**
 * Enhanced SignalTree interface with serialization capabilities
 */
interface SerializableSignalTree<T> extends ISignalTree<T> {
  /** Explicit reactive alias for state (helps TS resolution in tests) */
  // Use `any` here as a pragmatic escape hatch to avoid TS index-signature
  // access errors in tests (dot-access on dynamic keys). This will be
  // tightened later once type incompatibilities between enhancers and
  // `.with()` are fully resolved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: any;
  /**
   * Serialize the current state to a JSON string
   */
  serialize(config?: SerializationConfig): string;

  /**
   * Deserialize and apply state from a JSON string
   */
  deserialize(json: string, config?: SerializationConfig): void;

  /**
   * Get a plain object representation of the current state
   */

  /**
   * Restore state from a plain object
   */

  /**
   * Create a snapshot of the current state
   */

  /**
   * Restore state from a snapshot
   */
}

/**
 * Just the methods added by serialization (for Tree-polymorphic pattern)
 */
/**
 * ONE SEMANTIC JOB, ONE AUTHORITATIVE PUBLIC SURFACE.
 *
 * This carried SIX methods over two jobs. Four were spellings, deleted by
 * `PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0`:
 *
 * ```text
 * toJSON()    MEASURED EXACTLY EQUAL to `tree()`. Its one distinct job was
 *             `JSON.stringify(tree)` protocol conformance — which worked ONLY
 *             with `persistence()` installed, so on a bare tree
 *             `JSON.stringify(tree)` returned `undefined`. A protocol hook that
 *             silently yields undefined in the DEFAULT case is a trap, not a
 *             contract. `JSON.stringify(tree())` works on every tree.
 * snapshot()  toJSON() plus metadata plus a JSON deep clone. Diagnostic
 *             cloning survives privately; nothing public consumed it, and the
 *             only thing it paired with was restore().
 * restore(s)  fromJSON(s.data, s.metadata). A synonym whose English name
 *             emphasises a different part of one operation.
 * fromJSON()  INTERNALIZED, not deleted — it is the convergence point where
 *             `external()` classifies the acquisition, and it stays a private
 *             function. DELETE THE PUBLIC SPELLING, NOT THE CAPABILITY.
 * ```
 *
 * What survives is the one job `tree()`/`tree(value)` genuinely cannot do:
 * a TYPE-PRESERVING DURABLE REPRESENTATION. `tree()` hands back live
 * Date/Map/Set/bigint instances and no version envelope; `serialize` encodes
 * them and stamps the snapshot format, and `deserialize` is its inverse.
 */
export interface SerializationMethods {
  serialize(config?: SerializationConfig): string;
  deserialize(json: string, config?: SerializationConfig): void;
}

/**
 * Default serialization config
 */
const DEFAULT_CONFIG: Required<
  Omit<SerializationConfig, 'replacer' | 'reviver'>
> &
  Pick<SerializationConfig, 'replacer' | 'reviver'> = {
  transfer: false,
  includeMetadata: true,
  replacer: undefined,
  reviver: undefined,
  preserveTypes: true,
  maxDepth: 50,
  handleCircular: true,
};

/**
 * Detects circular references in an object
 */
function detectCircularReferences(
  obj: unknown,
  path = '',
  seen = new WeakSet<object>(),
  paths = new Map<object, string>()
): Array<{ path: string; targetPath: string }> {
  const circular: Array<{ path: string; targetPath: string }> = [];

  if (obj === null || typeof obj !== 'object') {
    return circular;
  }

  // Check if we've seen this object before
  if (seen.has(obj)) {
    // Found a circular reference
    const targetPath = paths.get(obj) || '';
    circular.push({ path, targetPath });
    return circular; // Don't recurse into circular references
  }

  // Mark this object as seen
  seen.add(obj);
  paths.set(obj, path);

  // Recursively check children
  if (Array.isArray(obj)) {
    const arrObj = obj as unknown[];
    for (let i = 0; i < arrObj.length; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      const childCircular = detectCircularReferences(
        arrObj[i],
        itemPath,
        seen,
        paths
      );
      circular.push(...childCircular);
    }
  } else {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const propPath = path ? `${path}.${key}` : key;
      const childCircular = detectCircularReferences(
        value,
        propPath,
        seen,
        paths
      );
      circular.push(...childCircular);
    }
  }

  // Remove from seen set when backing out (allows siblings to reference same objects)
  seen.delete(obj as object);

  return circular;
}

/**
 * Internal config with all required properties but nullable functions
 */
type InternalSerializationConfig = Required<
  Omit<SerializationConfig, 'replacer' | 'reviver'>
> & {
  replacer?: (key: string, value: unknown) => unknown;
  reviver?: (key: string, value: unknown) => unknown;
};

/**
 * Methods added by the persistence enhancer
 */
export interface PersistenceMethods {
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
  __flushAutoSave?: () => Promise<void>;
}

/**
 * Custom replacer that handles circular references only
 */
function createReplacer(config: InternalSerializationConfig) {
  const seen = new WeakSet<object>();
  const circularPaths = new Map<object, string>();

  return function replacer(
    this: Record<string, unknown>,
    key: string,
    value: unknown
  ): unknown {
    // Apply custom replacer first if provided
    if (config.replacer) {
      value = config.replacer.call(this, key, value);
    }

    // Skip signals - we already unwrapped them
    if (isSignal(value)) {
      return (value as ReadableCell<unknown>)();
    }

    // Handle circular references
    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        if (config.handleCircular) {
          const targetPath = circularPaths.get(value) || '';
          return { [TYPE_MARKERS.CIRCULAR]: targetPath };
        }
        return undefined;
      }
      seen.add(value);
      const currentPath = key || '';
      circularPaths.set(value, currentPath);
    }

    // Special-type handling happens in `tree()`'s walk, not here. (It used to
    // live in a private `unwrapObjectSafely`, deleted in 14.0.0.)
    return value;
  };
}

/**
 * Resolves circular references after parsing
 */
function resolveCircularReferences(
  obj: Record<string, unknown>,
  circularPaths: Array<{ path: string; targetPath: string }>
): void {
  for (const { path, targetPath } of circularPaths) {
    const pathParts = path.split(/\.|\[|\]/).filter(Boolean);
    const targetParts = targetPath.split(/\.|\[|\]/).filter(Boolean);

    // Navigate to the circular reference location
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]] as Record<string, unknown>;
      if (!current) break;
    }

    // Navigate to the target
    let target: Record<string, unknown> = obj;
    for (const part of targetParts) {
      target = target[part] as Record<string, unknown>;
      if (!target) break;
    }

    // Set the circular reference
    if (current && target) {
      current[pathParts[pathParts.length - 1]] = target;
    }
  }
}

/**
 * Enhances a SignalTree with serialization capabilities
 */
/**
 * DECODE, the mirror of `encodeSpecials`. Hoisted to module scope for the same
 * reason: it closes over nothing but module-level TYPE_MARKERS, and
 * `persistence()` needs to decode a payload WITHOUT applying it — Link owns the
 * apply, because acquiring external truth is a relationship act, not a codec
 * act.
 */
const restoreSpecialTypes = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  // Check for type markers
  if (TYPE_MARKERS.UNDEFINED in value) {
    return undefined;
  }
  if (TYPE_MARKERS.NAN in value) {
    return NaN;
  }
  if (TYPE_MARKERS.INFINITY in value) {
    return Infinity;
  }
  if (TYPE_MARKERS.NEG_INFINITY in value) {
    return -Infinity;
  }
  if (TYPE_MARKERS.BIGINT in value) {
    return BigInt(value[TYPE_MARKERS.BIGINT] as string);
  }
  if (TYPE_MARKERS.SYMBOL in value) {
    return Symbol.for(value[TYPE_MARKERS.SYMBOL] as string);
  }
  if (TYPE_MARKERS.DATE in value) {
    return new Date(value[TYPE_MARKERS.DATE] as string);
  }
  if (TYPE_MARKERS.REGEXP in value) {
    const regexpData = value[TYPE_MARKERS.REGEXP] as {
      source: string;
      flags: string;
    };
    return new RegExp(regexpData.source, regexpData.flags);
  }
  if (TYPE_MARKERS.MAP in value) {
    return new Map(value[TYPE_MARKERS.MAP] as Array<[unknown, unknown]>);
  }
  if (TYPE_MARKERS.SET in value) {
    return new Set(value[TYPE_MARKERS.SET] as Array<unknown>);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(restoreSpecialTypes);
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    result[k] = restoreSpecialTypes(v);
  }
  return result;
};

// Encode helper over already-unwrapped plain data. Hoisted to module scope
// with the codec: it closes over nothing but module-level TYPE_MARKERS.
function encodeSpecials(v: unknown, preserveTypes: boolean): unknown {
  if (!preserveTypes) return v;
  if (v === undefined) return { [TYPE_MARKERS.UNDEFINED]: true };
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { [TYPE_MARKERS.NAN]: true };
    if (v === Infinity) return { [TYPE_MARKERS.INFINITY]: true };
    if (v === -Infinity) return { [TYPE_MARKERS.NEG_INFINITY]: true };
    return v;
  }
  if (typeof v === 'bigint') return { [TYPE_MARKERS.BIGINT]: String(v) };
  if (typeof v === 'symbol') return { [TYPE_MARKERS.SYMBOL]: String(v) };

  if (v instanceof Date) return { [TYPE_MARKERS.DATE]: v.toISOString() };
  if (v instanceof RegExp)
    return {
      [TYPE_MARKERS.REGEXP]: { source: v.source, flags: v.flags },
    };
  if (v instanceof Map) return { [TYPE_MARKERS.MAP]: Array.from(v.entries()) };
  if (v instanceof Set) return { [TYPE_MARKERS.SET]: Array.from(v.values()) };

  if (Array.isArray(v)) return v.map((x) => encodeSpecials(x, preserveTypes));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>))
      out[k] = encodeSpecials(val, preserveTypes);
    return out;
  }
  return v;
}

/**
 * THE CODEC, over a SUPPLIED VALUE.
 *
 * ⚠️ EXTRACTED AT THE SEAM `const raw = tree()` — the ONE line that bound
 * encoding to "whatever the tree currently holds". Everything else here
 * (special types, circular refs, nodeMap, metadata, replacer) is pure encoding
 * over `raw` and always was.
 *
 * That binding is exactly what PERSISTENCE-AS-LINK-SWAP-0 had to break.
 * `persistence()` must encode the value Link says is EGRESS-ELIGIBLE, which is
 * not in general the value `tree()` returns — an inspection write moves the
 * latter and deliberately leaves the former behind. The public
 * `serialize(config?)` signature is UNCHANGED and still means "encode current
 * state"; only an internal caller may name a different value.
 */
function encodeSnapshot<T>(
  raw: T,
  tree: ISignalTree<T>,
  fullConfig: InternalSerializationConfig
): string {
  // ONE materialiser. `serialize()` used to walk the tree itself with a
  // private `unwrapObjectSafely`, three hundred lines from `toJSON()` which
  // already delegated to `tree()` — so the enhancer disagreed with itself
  // about what a snapshot is, and the private copy never learned the marker
  // rule. That is why it emitted 17 keys for a `status()` node (2 state, 6
  // computeds, 9 SETTER METHODS) and then threw on restore when it tried to
  // `.set()` a computed back.
  //
  // The stated reason for keeping it — "we need type-preserving markers" —
  // does not hold: `tree()` returns LIVE Date/Map/Set/RegExp/bigint
  // instances (verified for all six, nested included) and `encodeSpecials`
  // below does the marking. It was never `unwrapObjectSafely` that
  // preserved the types.
  const state = encodeSpecials(raw, fullConfig.preserveTypes) as T;

  // Detect circular references if needed
  const circularPaths = fullConfig.handleCircular
    ? detectCircularReferences(state)
    : [];

  // Prepare data
  const data: SerializedState<T> = {
    data: state,
  };

  // Build a compact nodeMap by traversing the callable proxy alias (tree.$)
  // and marking any signal-like branch node we encounter. Also mark a
  // root-as-signal marker ('r') if the root alias exposes a .set().
  const nodeMap: Record<string, 'b' | 'r'> = {};
  try {
    type Alias = { set?: (v: unknown) => void } & Record<string, unknown>;
    const rootAlias = (tree as unknown as { $?: Alias }).$;
    if (rootAlias && typeof rootAlias.set === 'function') {
      nodeMap[''] = 'r';
    }

    const visited = new WeakSet<object>();
    const isBranch = (v: unknown): boolean =>
      isSignal(v) ||
      (typeof v === 'function' &&
        'set' in (v as object) &&
        typeof (v as { set?: unknown }).set === 'function');

    const walkAlias = (obj: unknown, path = '') => {
      if (!isTraversableNode(obj)) return;
      const ref = obj as object;
      if (visited.has(ref)) return;
      visited.add(ref);

      if (path && isBranch(obj)) {
        nodeMap[path] = 'b';
      }

      // Traverse own enumerable properties (callable proxies expose children here)
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const childPath = path ? `${path}.${k}` : k;
        walkAlias(v, childPath);
      }
    };

    if (rootAlias) walkAlias(rootAlias);
  } catch {
    // Do not block serialization on nodeMap errors
  }

  // Add metadata if requested
  if (fullConfig.includeMetadata) {
    data.metadata = {
      // `timestamp` answers "when was this written" — useful for
      // staleness ("this draft is three weeks old, discard it"), which is
      // the job `loader({ staleTime })` already does via `lastLoadedAt`.
      // It is deliberately excluded from the change-detection cache key so
      // it cannot cause false positives.
      //
      // It is NOT a compatibility signal: see the note on `version` in the
      // metadata type. Both fields are currently read only into a
      // debugMode console.log.
      timestamp: Date.now(),
      version: SNAPSHOT_FORMAT_VERSION,
      ...(circularPaths.length > 0 && { circularRefs: circularPaths }),
      ...(Object.keys(nodeMap).length > 0 && { nodeMap }),
    };
  }

  // Serialize with custom replacer
  const replacer = createReplacer(fullConfig);
  const json = JSON.stringify(data, replacer, 2);
  // Extra debug: if JSON contains MAP or SET markers, print compact preview
  return json;
}

export function serialization(
  defaultConfig: SerializationConfig = {}
): Enhancer<SerializationMethods> {
  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & SerializationMethods => {
    const enhanced = tree as ISignalTree<T> & SerializationMethods;

    /**
     * Which HydrateMode the current `deserialize`/`fromJSON` pass is running
     * under. `rehydrate` unless a caller asked for `transfer`.
     *
     * Closure state rather than a parameter because the mode has to reach
     * `updateSignals`, which is nested inside `fromJSON`, and `fromJSON` is
     * PUBLIC API — widening its signature to carry an internal detail would put
     * a mode argument in front of every caller who has no opinion about it.
     * Safe because the whole path is synchronous: `deserialize` sets it, calls
     * `fromJSON`, and restores it in a `finally` before returning, so no two
     * passes can interleave. RFC 0014.
     */
    let hydrateMode: HydrateMode = 'rehydrate';
    /**
     * Restore from plain object
     */
    const applyJSON = (
      data: T,
      metadata?: SerializedState<T>['metadata']
    ): void => {
      // Restore special types in the data
      const restoredData = restoreSpecialTypes(data);

      // Helper to resolve a signal from the root alias (`tree.$`) using the
      // accumulated path so keys that collide with branch methods (like "set")
      // still map to the child signals.
      function resolveAliasSignal(path: string, key: string) {
        let node: { [k: string]: unknown } | undefined = (
          tree as unknown as {
            $?: { [k: string]: unknown };
          }
        ).$;
        if (path && node) {
          for (const part of path.split('.')) {
            if (!part) continue;
            const next = node[part];
            if (!isTraversableNode(next)) {
              node = undefined;
              break;
            }
            node = next as { [k: string]: unknown };
          }
        }
        const candidate = node?.[key] as unknown;
        return isSignal(candidate)
          ? (candidate as WritableCell<unknown>)
          : undefined;
      }

      function updateSignals(
        target: Record<string, unknown>,
        source: Record<string, unknown>,
        path = ''
      ): void {
        if (!target || !source) return;

        for (const key in source) {
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

          const sourceValue = source[key];
          const direct = target[key];

          // A materialised marker hydrates ITSELF, before any of the signal
          // resolution below. Without this, `deserialize` walked a marker's
          // payload key by key and tried to `.set()` each one back — including
          // the derived ones — and a computed has no setter, so the whole
          // restore threw. That is what made persisting a tree containing an
          // `entityMap` impossible.
          //
          // `rehydrate`, not `restore`: deserialize crosses a process boundary,
          // so nothing is in flight and transient state must be normalised
          // rather than believed. See docs/architecture/undo-redo-vs-devtools.md.
          if (hydrateMarkerNode(direct, sourceValue, hydrateMode)) continue;

          // Prefer the real signal if present; otherwise resolve from root alias
          const targetSignal = isSignal(direct)
            ? (direct as WritableCell<unknown>)
            : // Check if it's a callable signal (function with set method)
            typeof direct === 'function' &&
              'set' in direct &&
              typeof (direct as { set?: unknown }).set === 'function'
            ? (direct as { set: (value: unknown) => void })
            : resolveAliasSignal(path, key);

          if (targetSignal) {
            targetSignal.set(sourceValue);
            continue;
          }

          // Recurse only into a traversable target that isn't a writable
          // leaf: a callable carrying `set` is a leaf signal (handled above
          // via targetSignal), never a branch to descend into.
          const isWritableCallable = (v: object): boolean =>
            typeof v === 'function' && 'set' in v;
          if (
            sourceValue &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            isTraversableNode(direct) &&
            !isWritableCallable(direct) &&
            !isSignal(direct)
          ) {
            updateSignals(
              direct as Record<string, unknown>,
              sourceValue as Record<string, unknown>,
              path ? `${path}.${key}` : key
            );
          }
        }
      }

      // If the serialized data contains a compact nodeMap, use it to apply
      // updates deterministically: 'r' => root set, 'b' => set on branch
      const nodeMap = (
        metadata as unknown as {
          nodeMap?: Record<string, 'b' | 'r'>;
        }
      )?.nodeMap;

      if (nodeMap && Object.keys(nodeMap).length > 0) {
        // Root marker
        if (nodeMap[''] === 'r') {
          type Alias = { set?: (v: unknown) => void } & Record<string, unknown>;
          const rootAlias = (tree as unknown as { $?: Alias }).$;
          if (rootAlias && typeof rootAlias.set === 'function') {
            (rootAlias as unknown as WritableCell<unknown>).set(restoredData);
            // Don't return; still perform targeted updates below to ensure
            // type-preserving restoration for all branches.
          }
        }

        // For branch entries, apply child signal .set directly when possible
        for (const [path, kind] of Object.entries(nodeMap)) {
          if (path === '') continue; // root handled
          if (kind !== 'b') continue;

          // Navigate to path and set the node if a WritableSignal is found
          const parts = path.split(/\.|\[|\]/).filter(Boolean);
          type Alias = Record<string, unknown> & { set?: (v: unknown) => void };
          let node: Record<string, unknown> | undefined = (
            tree as unknown as { $?: Alias }
          ).$;
          for (const p of parts) {
            if (!node) break;
            node =
              (node[p] as Record<string, unknown> | undefined) ?? undefined;
          }

          if (
            node &&
            (isSignal(node) ||
              (typeof node === 'function' &&
                'set' in node &&
                typeof (node as { set?: unknown }).set === 'function'))
          ) {
            // Extract the corresponding value from restoredData
            let current: unknown = restoredData as unknown;
            for (const p of parts) {
              if (current == null) {
                current = undefined;
                break;
              }
              if (typeof current === 'object') {
                current = (current as Record<string, unknown>)[p];
              } else {
                current = undefined;
                break;
              }
            }
            try {
              // A marker hydrates itself. Without this the nodeMap pass writes
              // the marker's raw PAYLOAD through its `set()` — a `form()` has
              // one, so `set({values, touched})` merged those two keys into the
              // form's values as if they were fields. `updateSignals` then
              // hydrated it properly, leaving BOTH: `{name:'Ada', values:{…},
              // touched:{…}}`. Two writers, same key, and the wrong one ran
              // first.
              if (!hydrateMarkerNode(node, current, hydrateMode)) {
                (node as unknown as WritableCell<unknown>).set(current);
              }
            } catch {
              /* ignore per-path failures */
            }
          }
        }

        // After applying nodeMap-targeted sets, perform a best-effort deep update for remaining keys
        updateSignals(
          tree.$ as Record<string, unknown>,
          restoredData as Record<string, unknown>
        );
        return;
      }

      updateSignals(
        tree.$ as Record<string, unknown>,
        restoredData as Record<string, unknown>
      );
    };

    /**
     * Restore from plain object.
     *
     * ⚠️ THE ONE EXTERNAL-TRUTH ACQUISITION POINT. `deserialize()`, `restore()`
     * and `fromJSON()` all converge here, and MEASURED, all three applied their
     * payload with NO classification at all — `{}`, neither origin nor
     * participation — while `load()` on the same tree measured
     * `{ origin: 'external', participation: 'realized' }`.
     *
     * That gap is the A2-2 defect resurfacing on a sibling path. The incumbent
     * fixed it by hand-wrapping ONE CALLER, `load()`; the swap moved that
     * caller's job into Link's `acquire()`. Neither ever covered the PUBLIC
     * methods, so an application calling `deserialize()` directly applied
     * external truth that every participation-keyed consumer then read as
     * authored work — revocable by a transaction, and indistinguishable from
     * something the user did.
     *
     *     FIX THE CONVERGENCE POINT, NOT THE CALLER THAT REVEALED IT.
     *
     * ⚠️ AND THIS IS CLASSIFICATION, NOT A RELATIONSHIP. It declares what the
     * write IS; it does not give serialization an eligible projection, a
     * knownY, or any egress authority. A serializer with no relationship
     * attached maintains nothing — OWNERSHIP-BEFORE-ADOPTION. When a
     * relationship IS attached, it observes a correctly classified write and
     * decides authority itself.
     */
    /**
     * The one external-truth acquisition point, now PRIVATE. `deserialize()` is
     * its only caller; the public `fromJSON` spelling is deleted.
     */
    const acquireJSON = (
      data: T,
      metadata?: SerializedState<T>['metadata']
    ): void => {
      external(() => applyJSON(data, metadata));
    };

    /**
     * Serialize to JSON string
     */
    enhanced.serialize = (config?: SerializationConfig): string =>
      encodeSnapshot(tree(), tree, {
        ...DEFAULT_CONFIG,
        ...defaultConfig,
        ...config,
      });

    /**
     * Deserialize from JSON string
     */
    enhanced.deserialize = (
      json: string,
      config?: SerializationConfig
    ): void => {
      const fullConfig: InternalSerializationConfig = {
        ...DEFAULT_CONFIG,
        ...defaultConfig,
        ...config,
      };

      try {
        // Parse with simple JSON.parse (no custom reviver)
        const parsed = JSON.parse(json) as SerializedState<unknown>;

        // Extract data and metadata
        const { data, metadata } = parsed;

        // Resolve circular references if present
        if (metadata?.circularRefs && fullConfig.handleCircular) {
          resolveCircularReferences(
            data as unknown as Record<string, unknown>,
            metadata.circularRefs
          );
        }

        // Apply parsed data to the tree; fromJSON will handle type restoration
        // `transfer` opts this payload out of the loader-owns-source declines.
        // Restored in `finally` so a throw cannot leave the next pass — or
        // `restore()`, which shares `fromJSON` — running in the wrong mode.
        hydrateMode = fullConfig.transfer ? 'transfer' : 'rehydrate';
        try {
          acquireJSON(
            data as T,
            metadata as SerializedState<T>['metadata']
          );
        } finally {
          hydrateMode = 'rehydrate';
        }

        // Log restoration if in debug mode
        if (
          (tree as { __config?: { debugMode?: boolean } }).__config?.debugMode
        ) {
          console.log('[SignalTree] State restored from serialized data', {
            timestamp: metadata?.timestamp,
            version: metadata?.version,
          });
        }
      } catch (error) {
        console.error('[SignalTree] Failed to deserialize:', error);
        throw new Error(
          `Failed to deserialize SignalTree state: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    };
    return enhanced as unknown as ISignalTree<T> & SerializationMethods;
  };

  const meta: EnhancerMeta = {
    name: 'serialization',
    provides: ['serialization'],
  };
  (enhancerFn as unknown as { metadata: EnhancerMeta }).metadata = meta;
  (enhancerFn as unknown as Record<symbol, EnhancerMeta>)[ENHANCER_META] = meta;

  // THE ONE BOUNDARY CAST, re-justified for this enhancer: `enhancerFn` reads
  // the realized tree so its parameter is `ISignalTree<T>`, while
  // `Enhancer<TAdded>` takes the neutral `EnhancerHost` and parameters are
  // contravariant under `strictFunctionTypes`. Body untouched. Unlike
  // `restoration` there is no receiver-derived member here to preserve —
  // `SerializationMethods` erases state to `SerializedState<unknown>` already.
  return enhancerFn as unknown as Enhancer<SerializationMethods>;
}

// v12: removed the deprecated `withSerialization` alias — use `serialization()`.

// The StorageAdapter CONTRACT is re-exported; the generic factories went with
// STORAGE-DEL and the './storage' subpath (PER-0). `PersistenceConfig.storage`
// references this type, so it must be reachable from the root barrel — which is
// where it now lives, rather than behind a subpath.
export { type StorageAdapter } from './storage-adapters';

/**
 * Persistence configuration
 */
export interface PersistenceConfig extends SerializationConfig {
  /**
   * Storage key to use
   */
  key: string;

  /**
   * Storage adapter (defaults to localStorage)
   */
  storage?: StorageAdapter;

  /**
   * Whether to auto-save on every update
   * @default true
   */
  autoSave?: boolean;

  /**
   * Debounce delay for auto-save in ms
   * @default 1000
   */
  debounceMs?: number;

  /**
   * Whether to auto-load on creation
   * @default true
   */
  autoLoad?: boolean;

  /**
   * Whether to skip caching and force storage writes even if unchanged
   * @default false
   */
  skipCache?: boolean;
}

/**
 * Adds persistence capabilities to a SerializableSignalTree
 */
export function persistence(
  config: PersistenceConfig
): Enhancer<SerializationMethods & PersistenceMethods> {
  const {
    key,
    storage = typeof window !== 'undefined' ? window.localStorage : undefined,
    autoSave = true,
    debounceMs = 1000,
    autoLoad = true,
    ...serializationConfig
  } = config;

  if (!storage) {
    throw new Error(
      'No storage adapter available. Provide a storage adapter in the config.'
    );
  }

  // Narrow storage for TypeScript and linter: from here on it's defined.
  const storageAdapter: StorageAdapter = storage;

  const persistenceFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & SerializationMethods & PersistenceMethods => {
    // First enhance with serialization.
    //
    // The cast on the ARGUMENT is the consequence of `serialization()` now
    // returning the neutral `Enhancer<SerializationMethods>`: its parameter is
    // `EnhancerHost`, and `ISignalTree<Model>` is not assignable to that,
    // because `NodeAccessor<T>` has input positions and is therefore
    // contravariant in `T` (see the `EnhancerHost` note in `lib/types.ts`).
    // This is an INTERNAL direct application, not `.with()`, so it needs the
    // same library-owned assertion `with()`'s implementation makes. It does not
    // change `persistence()`'s own public signature, which is migrated in its
    // own slice.
    const serializable = serialization(serializationConfig)(
      tree as unknown as Parameters<ReturnType<typeof serialization>>[0]
    ) as unknown as ISignalTree<T> & SerializationMethods;

    // Add persistence methods
    const enhanced = serializable as ISignalTree<T> &
      SerializationMethods &
      PersistenceMethods;

    // ══════════════════════════════════════════════════════════════════════
    // THE RELATIONSHIP IS A LINK.            PERSISTENCE-AS-LINK-SWAP-0
    // ══════════════════════════════════════════════════════════════════════
    //
    // THE HYPOTHESIS THIS IMPLEMENTS:
    //
    //     Persistence does not need its own relationship authority model.
    //     Persistence = Link + application/durability policy.
    //
    // WHAT LINK NOW OWNS — every one of these was hand-rolled here, and each
    // hand-rolled copy was WEAKER than the primitive that replaced it:
    //
    //   change detection    was `tree() !== previousState` off `subscribe()`,
    //                       with a 100ms POLLING FALLBACK outside Angular.
    //                       Now: the path notifier, per notification.
    //   turn coalescing     was a `debounceMs` timer doing double duty as both
    //                       policy and correctness. Now: Link's flush boundary
    //                       sends one value per settled turn; the debounce
    //                       below is policy ONLY.
    //   transaction gating  was a bespoke `scheduleDurableConsequence` claim on
    //                       an `autoSaveKey` symbol. Now: Link's own.
    //   echo suppression    was `lastCacheKey`, a STRING compare of the whole
    //                       serialized payload. Now: `knownY` + `deepEqual`,
    //                       which is semantic and needs no serialization to
    //                       answer. The cache key survives BELOW, where it
    //                       belongs — as a storage-write optimization.
    //   realized inbound    was a hand-written `withWriteContext({ origin:
    //                       'external', participation: 'realized' })`. Now:
    //                       Link's `external()`, which declares exactly that.
    //   owner isolation     was implicit in one-subscription-per-tree. Now:
    //                       explicit `(registry, position)` identity.
    //
    // ⚠️ AND THE ONE THAT WAS NOT MERELY WEAKER — IT WAS ABSENT.
    //
    // Whole-tree reference identity cannot tell an AUTHORED write from an
    // INSPECTION write, because both move `tree()`. That is structurally the
    // same mechanism as LINK-ROOT-SOURCE-0's M3 mutation — "replace the
    // eligible projection with a current whole-tree re-read" — which passed six
    // rows and killed the inspection row ALONE. Measured here before the swap,
    // P2 and P3 failed for exactly that reason and nothing else did:
    //
    //     CORRECT COMPLETE SHAPE IS NOT CORRECT EXTERNALLY-AUTHORIZED TRUTH.
    //
    // WHAT PERSISTENCE KEEPS, because none of it is relationship semantics:
    // the storage adapter, the key, the codec and its metadata/version, the
    // debounce, `skipCache`, and the `load()`/`autoLoad` lifecycle.

    const codecConfig: InternalSerializationConfig = {
      ...DEFAULT_CONFIG,
      ...serializationConfig,
    };
    /** Metadata-free, so a timestamp can never look like a state change. */
    const cacheKeyConfig: InternalSerializationConfig = {
      ...codecConfig,
      includeMetadata: false,
    };

    const debug = () =>
      (typeof ngDevMode === 'undefined' || ngDevMode) &&
      !!(tree as SignalTreeWithConfig).__config?.debugMode;

    // A STORAGE-WRITE optimization, no longer a correctness mechanism. Link
    // decides whether a value is worth sending; this decides only whether an
    // identical payload is worth re-writing to a backend.
    let lastCacheKey: string | null = null;

    /**
     * The latest EGRESS-ELIGIBLE whole-tree value, as Link computed it.
     *
     * Seeded from `tree()` at construction — the same read, at the same moment,
     * that Link makes for its own authority baseline — and advanced only by
     * Link handing a value to the endpoint. Deliberately never re-read from
     * `tree()` afterwards: that re-read is precisely the mechanism that made
     * inspection state durable.
     */
    let latestEligible: T = tree();

    /** Encode ONE egress-eligible whole-tree value and make it durable. */
    const persist = async (value: T): Promise<void> => {
      const cacheKey = encodeSnapshot(value, tree, cacheKeyConfig);
      if (!config.skipCache && cacheKey === lastCacheKey) {
        if (debug()) {
          console.log(
            `[SignalTree] State unchanged, skipping storage write for key: ${key}`
          );
        }
        return;
      }
      await Promise.resolve(
        storageAdapter.setItem(key, encodeSnapshot(value, tree, codecConfig))
      );
      lastCacheKey = cacheKey;
      if (debug()) {
        console.log(`[SignalTree] State saved to storage key: ${key}`);
      }
    };

    // ── DEBOUNCE: POLICY, LAYERED ON TOP ──────────────────────────────────
    //
    // Link already sends at most one value per settled turn, so this is no
    // longer load-bearing for correctness — it is the public `debounceMs`
    // contract and nothing else. It is safe to hold ONE pending value because
    // Link's reconciler AWAITS `endpoint.set` and never overlaps two sends.
    let pending: {
      value: T;
      resolve: () => void;
      reject: (e: unknown) => void;
    } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let immediate = false;

    const flushPending = async (): Promise<void> => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      const p = pending;
      pending = null;
      if (!p) return;
      try {
        await persist(p.value);
        p.resolve();
      } catch (error) {
        p.reject(error);
      }
    };

    const outbound = (value: T): Promise<void> => {
      // ⚠️ RECORD BEFORE DECIDING WHETHER TO WRITE. `autoSave: false` must
      // suppress AUTOMATIC publication, never the relationship — the eligible
      // value is what a manual `save()` publishes, and the only thing that
      // knows it is Link. Disposing here instead (the first attempt) made
      // `save()` fall back to the construction baseline and write 0 where the
      // tree held 7. Turning off the pump is not the same as cutting the pipe.
      latestEligible = value;
      if (!autoSave) return Promise.resolve();
      if (immediate || debounceMs <= 0) return persist(value);
      return new Promise<void>((resolve, reject) => {
        if (timer !== undefined) clearTimeout(timer);
        pending = { value, resolve, reject };
        timer = setTimeout(() => void flushPending(), debounceMs);
      });
    };

    // ── INBOUND: ONE DECODED PAYLOAD, HANDED TO LINK ──────────────────────
    //
    // `get()` returns a value Link then ACQUIRES: it moves `knownY` (so the
    // value is not echoed straight back out), moves `eligible` (so external
    // truth becomes authoritative even when it coincides with what inspection
    // is already displaying — the I4 case), and applies it through `external()`,
    // which declares `{ origin: 'external', participation: 'realized' }` — the
    // exact pair this function used to spell out by hand.
    //
    // ⚠️ `load()` reads storage FIRST and only then retrieves, because "no
    // stored payload" is not a value. Link has no absent-value protocol and
    // acquiring `undefined` would wipe the tree.
    let inbound: T | undefined;

    const endpoint: LinkEndpoint<T> = {
      get: () => inbound as T,
      set: outbound,
    };

    // ⚠️ THE ONE CAST, AND WHAT IT IS FOR. `TruthfulLinkSource` rejects a root
    // whose declared type still contains an `entityMap` construction marker,
    // because a CALLER writing endpoint callbacks would be handed a value type
    // that matches neither the marker nor the runtime state. Persistence has no
    // such caller: this endpoint is internal, its value is consumed only by the
    // codec, and no `NaturalValue<T>` ever reaches application code. The type
    // rule protects an authoring surface that does not exist here.
    const relationship = link(
      (tree as unknown as { $: object }).$ as never,
      endpoint as never
    );

    /**
     * Save current state to storage.
     *
     * Publishes the EGRESS-ELIGIBLE value, not `tree()` — that is the whole
     * point of the swap and it must hold for the manual path too, or a devtools
     * scrub followed by an explicit `save()` would make the scrub durable.
     */
    enhanced.save = async (): Promise<void> => {
      immediate = true;
      try {
        await flushPending();
        await relationship.settled();
        // The eligible value, never `tree()`. On an untouched tree this is
        // still the baseline Link adopted at construction — which is the point:
        // an inspection write cannot have advanced it, so a devtools scrub
        // followed by an explicit `save()` cannot make the scrub durable.
        await persist(latestEligible);
      } catch (error) {
        console.error('[SignalTree] Failed to save state:', error);
        throw error; // Re-throw for tests to catch
      } finally {
        immediate = false;
      }
    };

    /**
     * Load state from storage.
     *
     * The LIFECYCLE is unchanged — `load()` is still callable by hand and
     * `autoLoad` still runs before autosave can publish. What changed is what
     * owns the acquisition beneath it.
     */
    enhanced.load = async (): Promise<void> => {
      try {
        const data = await Promise.resolve(storageAdapter.getItem(key));
        if (data == null) return;
        const parsed = JSON.parse(data) as SerializedState<T>;
        inbound = restoreSpecialTypes(parsed.data) as T;
        await relationship.retrieve();
        // ⚠️ NO CACHE-KEY PRIMING HERE, DELIBERATELY. The obvious line —
        // `lastCacheKey = encodeSnapshot(inbound, ...)` — was written first and
        // then DELETED, because it is the incumbent's echo suppression rebuilt
        // on top of the primitive that replaced it. Link acquires the payload,
        // so `knownY` already holds it and the reconciler's `deepEqual` stops
        // the echo without serializing anything.
        //
        // It was not merely redundant: while it stood, a mutation that applied
        // the payload WITHOUT telling the relationship passed every row in the
        // matrix, because this line suppressed the echo on its own. Deleting it
        // is what makes the inbound half of the swap FALSIFIABLE.
        if (debug()) {
          console.log(`[SignalTree] State loaded from storage key: ${key}`);
        }
      } catch (error) {
        console.error('[SignalTree] Failed to load state:', error);
        throw error; // Re-throw for tests to catch
      }
    };

    /**
     * Clear state from storage
     */
    enhanced.clear = async (): Promise<void> => {
      try {
        await Promise.resolve(storageAdapter.removeItem(key));
        lastCacheKey = null;

        if (debug()) {
          console.log(`[SignalTree] State cleared from storage key: ${key}`);
        }
      } catch (error) {
        console.error('[SignalTree] Failed to clear state:', error);
        throw error; // Re-throw for tests to catch
      }
    };

    // Auto-load on creation if enabled
    if (autoLoad) {
      // Use setTimeout to avoid blocking initialization and timing issues
      setTimeout(() => {
        enhanced.load().catch((error) => {
          console.warn('[SignalTree] Auto-load failed:', error);
        });
      }, 0);
    }

    /**
     * Force a drain — the host is backgrounding, or a test needs determinism.
     *
     * ⚠️ IT DOES NOT AWAIT SETTLEMENT, AND THAT IS THE FIX. Link hands a value
     * to `outbound` only from inside its durable-consequence `run`, so anything
     * sitting in `pending` has ALREADY cleared settlement. Flushing it is
     * therefore complete — there is nothing else this drain is entitled to
     * write.
     *
     * A2-4.1 characterised the incumbent drain as writing SPECULATIVE state:
     * it bypassed the consequence authority and serialized the tree as it
     * stood, so backgrounding mid-transaction made a doomed value durable and
     * the rollback could never correct it. Awaiting settlement instead is the
     * opposite failure — the drain would never resolve while a transaction is
     * open, which is a hang at the moment a host is trying to leave.
     *
     * Neither is needed. An unresolved optimistic mutation has NO COMMITTED
     * TRUTH TO PERSIST, so the correct drain writes what is settled and returns.
     */
    (enhanced as unknown as EnhancedSignalTree).__flushAutoSave = async () => {
      immediate = true;
      try {
        await flushPending();
      } finally {
        immediate = false;
      }
    };

    // Register cleanup so destroy() stops auto-save automatically
    if (typeof tree.registerCleanup === 'function') {
      tree.registerCleanup(() => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        // A held save must not outlive the tree: settling a scope after
        // destroy() would otherwise resurrect a save on a dead tree. Link's
        // dispose() drops its own durable-consequence claim; dropping the
        // debounced value here is this layer's half of the same rule.
        pending = null;
        relationship.dispose();
      });
    }

    return enhanced as unknown as ISignalTree<T> &
      SerializationMethods &
      PersistenceMethods;
  };

  const meta: EnhancerMeta = {
    name: 'persistence',
    provides: ['persistence', 'serialization'],
    requires: [],
  };
  (persistenceFn as unknown as { metadata: EnhancerMeta }).metadata = meta;
  (persistenceFn as unknown as Record<symbol, EnhancerMeta>)[ENHANCER_META] =
    meta;

  // THE ONE BOUNDARY CAST, re-justified: `persistenceFn` reads the realized
  // tree so its parameter is `ISignalTree<T>`, while `Enhancer<TAdded>` takes
  // the neutral `EnhancerHost` and parameters are contravariant under
  // `strictFunctionTypes`. Body untouched.
  //
  // `TAdded` here is a COMPOSITE — `SerializationMethods & PersistenceMethods`
  // — because this enhancer applies `serialization()` internally and then adds
  // its own surface on top. Both halves must survive the cast; the rows in
  // `persistence-contract.typing.spec.ts` check them independently, since a
  // migration dropping the serialization half would still satisfy any test
  // that merely calls `save()`.
  return persistenceFn as unknown as Enhancer<
    SerializationMethods & PersistenceMethods
  >;
}

// v12: removed the deprecated `withPersistence` alias — use `persistence()`.

// createStorageAdapter / createIndexedDBAdapter moved to ./storage-adapters
// (re-exported near the StorageAdapter type above — public surface unchanged).

// The primary `serialization()` and `persistence()` implementations are
// declared above. Legacy `serialization` / `persistence` aliases
// are exported (and annotated `@deprecated`) for backwards compatibility.

/**
 * Applies the enhancer with explicit typing, to avoid depending on `.with()`
 * overload inference in tests.
 *
 * The `applyPersistence` sibling and `enableSerialization` were removed in
 * 14.0.0: neither had an importer or a path to any package entry point, so no
 * consumer could reach them and no test used them. This one is kept because
 * serialization.roundtrip.spec.ts does import it.
 */
export function applySerialization<T extends Record<string, unknown>>(
  tree: ISignalTree<T>
): ISignalTree<T> & SerializationMethods {
  // Same internal-direct-application assertion as in `persistence()` above.
  return serialization()(
    tree as unknown as Parameters<ReturnType<typeof serialization>>[0]
  ) as unknown as ISignalTree<T> & SerializationMethods;
}
