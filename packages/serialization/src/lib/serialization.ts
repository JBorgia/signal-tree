// packages/serialization/src/lib/serialization.ts

/**
 * SignalTree Serialization Module
 *
 * Provides serialization and deserialization capabilities for SignalTree,
 * enabling state persistence, SSR, and state transfer between contexts.
 */

import { SignalTree, isJestWorker as coreIsJestWorker } from '@signaltree/core';
import { isSignal, Signal } from '@angular/core';
import { TYPE_MARKERS } from '../constants';

/**
 * Interface for SignalTree with debug configuration
 */
interface SignalTreeWithConfig<T = unknown> extends SignalTree<T> {
  __config?: {
    debugMode?: boolean;
  };
}

/**
 * Interface for enhanced SignalTree with auto-save functionality
 */
interface EnhancedSignalTree {
  __flushAutoSave?: () => Promise<void>;
  __checkAutoSave?: () => void;
}

/**
 * Serialization configuration options
 */
export interface SerializationConfig {
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
     * Version of the serialization format
     */
    version: string;

    /**
     * Custom application version
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
  };
}

/**
 * Enhanced SignalTree interface with serialization capabilities
 */
export interface SerializableSignalTree<T> extends SignalTree<T> {
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
  toJSON(): T;

  /**
   * Restore state from a plain object
   */
  fromJSON(data: T): void;

  /**
   * Create a snapshot of the current state
   */
  snapshot(): SerializedState<T>;

  /**
   * Restore state from a snapshot
   */
  restore(snapshot: SerializedState<T>): void;
}

/**
 * Default serialization config
 */
const DEFAULT_CONFIG: Required<
  Omit<SerializationConfig, 'replacer' | 'reviver'>
> &
  Pick<SerializationConfig, 'replacer' | 'reviver'> = {
  includeMetadata: true,
  replacer: undefined,
  reviver: undefined,
  preserveTypes: true,
  maxDepth: 50,
  handleCircular: true,
};

/**
 * Detect if we're running inside a Jest worker process without directly
 * referencing `process.env` (avoids lint rules and bundler issues).
 */
function isJestWorker(): boolean {
  // Delegate to core helper to avoid duplication and lint issues
  return coreIsJestWorker();
}

/**
 * Safely unwrap object with circular reference detection
 */
function unwrapObjectSafely(
  obj: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
  maxDepth = 50,
  preserveTypes = true
): unknown {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return '[Max Depth Exceeded]';
  }

  // Handle primitives and special values
  if (obj === null || typeof obj !== 'object') {
    // Handle special values when preserveTypes is enabled
    if (preserveTypes) {
      if (obj === undefined) {
        return { [TYPE_MARKERS.UNDEFINED]: true };
      }
      if (typeof obj === 'number') {
        if (isNaN(obj)) {
          return { [TYPE_MARKERS.NAN]: true };
        }
        if (obj === Infinity) {
          return { [TYPE_MARKERS.INFINITY]: true };
        }
        if (obj === -Infinity) {
          return { [TYPE_MARKERS.NEG_INFINITY]: true };
        }
      }
      if (typeof obj === 'bigint') {
        return { [TYPE_MARKERS.BIGINT]: obj.toString() };
      }
      if (typeof obj === 'symbol') {
        return { [TYPE_MARKERS.SYMBOL]: obj.toString() };
      }
    }
    return obj;
  }

  // Handle circular references
  if (visited.has(obj)) {
    return '[Circular Reference]';
  }

  // Handle signals
  if (isSignal(obj)) {
    return (obj as Signal<unknown>)();
  }

  // Preserve special types if requested - convert them to marker format
  if (preserveTypes) {
    if (obj instanceof Date) {
      return { [TYPE_MARKERS.DATE]: obj.toISOString() };
    }
    if (obj instanceof RegExp) {
      return {
        [TYPE_MARKERS.REGEXP]: {
          source: obj.source,
          flags: obj.flags,
        },
      };
    }
    if (obj instanceof Map) {
      return {
        [TYPE_MARKERS.MAP]: Array.from(obj.entries()),
      };
    }
    if (obj instanceof Set) {
      return {
        [TYPE_MARKERS.SET]: Array.from(obj.values()),
      };
    }
  } else {
    // When preserveTypes is false, let special objects (Date, RegExp, etc.)
    // be handled by JSON.stringify naturally
    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
  }
  visited.add(obj);

  try {
    // Handle arrays
    if (Array.isArray(obj)) {
      const result = obj.map((item) =>
        unwrapObjectSafely(item, visited, depth + 1, maxDepth, preserveTypes)
      );
      visited.delete(obj);
      return result;
    }

    // Handle plain objects
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSignal(value)) {
        const signalValue = (value as Signal<unknown>)();
        result[key] = unwrapObjectSafely(
          signalValue,
          visited,
          depth + 1,
          maxDepth,
          preserveTypes
        );
      } else {
        result[key] = unwrapObjectSafely(
          value,
          visited,
          depth + 1,
          maxDepth,
          preserveTypes
        );
      }
    }

    visited.delete(obj);
    return result;
  } catch {
    visited.delete(obj);
    return '[Serialization Error]';
  }
}

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
    for (let i = 0; i < obj.length; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      const childCircular = detectCircularReferences(
        obj[i],
        itemPath,
        seen,
        paths
      );
      circular.push(...childCircular);
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const propPath = path ? `${path}.${key}` : key;
      const childCircular = detectCircularReferences(
        value,
        propPath,
        seen,
        paths
      );

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
 * Custom replacer that handles circular references only
 */
function createReplacer(config: InternalSerializationConfig) {
  const seen = new WeakSet<object>();

  return function replacer(
    this: Record<string, unknown>,
    key: string,
    value: unknown
  ): unknown {
    // Apply custom replacer first if provided
    if (config.replacer) {
      value = config.replacer.call(this, key, value);
    }

    // Preserve special types at stringify-time so they survive JSON.stringify
    // (some objects like Date are stringified by JSON; convert them into
    // our marker shapes here so parse() + restoreSpecialTypes can rehydrate.)
    if (config.preserveTypes) {
      try {
        if (value instanceof Date) {
          return { [TYPE_MARKERS.DATE]: value.toISOString() };
        }
        if (value instanceof RegExp) {
          return {
            [TYPE_MARKERS.REGEXP]: {
              source: value.source,
              flags: value.flags,
            },
          };
        }
        if (value instanceof Map) {
          return {
            [TYPE_MARKERS.MAP]: Array.from(
              (value as Map<unknown, unknown>).entries()
            ),
          };
        }
        if (value instanceof Set) {
          return {
            [TYPE_MARKERS.SET]: Array.from((value as Set<unknown>).values()),
          };
        }
        if (typeof value === 'bigint') {
          return { [TYPE_MARKERS.BIGINT]: value.toString() };
        }
        if (typeof value === 'symbol') {
          return { [TYPE_MARKERS.SYMBOL]: value.toString() };
        }
      } catch {
        // ignore side-effectful checks
      }
    }

    // Skip signals - we already unwrapped them
    if (isSignal(value)) {
      return (value as Signal<unknown>)();
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

    // All special type handling is now done in unwrapObjectSafely
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
export function withSerialization<T extends Record<string, unknown>>(
  defaultConfig: SerializationConfig = {}
): (tree: SignalTree<T>) => SerializableSignalTree<T> {
  return (tree: SignalTree<T>): SerializableSignalTree<T> => {
    const enhanced = tree as SerializableSignalTree<T>;

    /**
     * Get plain object representation
     */
    enhanced.toJSON = (): T => {
      const fullConfig: InternalSerializationConfig = {
        ...DEFAULT_CONFIG,
        ...defaultConfig,
      };
      // Use the unwrapped state via the callable API to avoid serializing
      // proxy objects or internal wrappers.
      return unwrapObjectSafely(
        tree.$(),
        new WeakSet(),
        0,
        fullConfig.maxDepth,
        fullConfig.preserveTypes
      ) as T;
    };

    /**
     * Restore from plain object
     */
    enhanced.fromJSON = (data: T): void => {
      try {
        if (isJestWorker()) {
          try {
            console.debug(
              '[SignalTree debug] fromJSON entry raw data keys:',
              Object.keys((data || {}) as Record<string, unknown>)
            );
            try {
              console.debug(
                '[SignalTree debug] fromJSON entry raw data preview:',
                JSON.stringify(data).slice(0, 1000)
              );
            } catch {}
          } catch {}
        }
      } catch {}
      // Convert special type markers back to their actual types
      const restoreSpecialTypes = (value: unknown): unknown => {
        // Handle stringified ISO dates (some paths may stringify Date -> ISO)
        if (typeof value === 'string') {
          // Simple ISO8601-ish detection
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
            try {
              return new Date(value);
            } catch {
              // fall through to return string
            }
          }
          return value;
        }

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
          const dateStr = value[TYPE_MARKERS.DATE] as string;
          // Rich debug for DATE marker parsing
          try {
            const parsedMs = (() => {
              try {
                return new Date(dateStr).getTime();
              } catch (err) {
                return '[invalid]';
              }
            })();
            if (isJestWorker()) {
              console.debug(
                '[SignalTree debug] restoreSpecialTypes DATE marker:',
                {
                  marker: dateStr,
                  parsedMs,
                }
              );
            }
          } catch (err) {
            try {
              if (isJestWorker())
                console.debug(
                  '[SignalTree debug] restoreSpecialTypes DATE marker error:',
                  String(err)
                );
            } catch {}
          }

          const created = new Date(dateStr);
          try {
            if (isJestWorker()) {
              console.debug(
                '[SignalTree debug] restoreSpecialTypes DATE created:',
                {
                  iso: created.toISOString
                    ? created.toISOString()
                    : String(created),
                  time: (() => {
                    try {
                      return created.getTime();
                    } catch {
                      return '[unavailable]';
                    }
                  })(),
                }
              );
            }
          } catch (err) {
            try {
              if (isJestWorker())
                console.debug(
                  '[SignalTree debug] restoreSpecialTypes DATE created error:',
                  String(err)
                );
            } catch {}
          }

          return created;
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

      // Restore special types in the data
      const restoredData = restoreSpecialTypes(data) as T;

      // Debugging: print restoredData preview under Jest to validate restoration
      try {
        if (isJestWorker()) {
          console.debug(
            '[SignalTree debug] restoredData preview:',
            JSON.stringify(restoredData).slice(0, 500)
          );
        }
      } catch {
        // ignore
      }

      // Deep diagnostic scan: find DATE markers, ISO strings, and Date objects
      try {
        if (isJestWorker()) {
          const findings: Array<{
            path: string;
            kind: string;
            value: unknown;
          }> = [];

          function scan(obj: unknown, path = ''): void {
            if (obj === null || obj === undefined) return;
            // Marker objects (should be objects with TYPE_MARKERS keys)
            if (typeof obj === 'object' && !Array.isArray(obj)) {
              const o = obj as Record<string, unknown>;
              // DATE marker
              if (TYPE_MARKERS.DATE in o) {
                const iso = o[TYPE_MARKERS.DATE] as unknown;
                findings.push({ path, kind: 'DATE_MARKER', value: iso });
                try {
                  const dt = new Date(String(iso)).getTime();
                  findings.push({
                    path: path + '.__constructedDate',
                    kind: 'DATE_MS',
                    value: dt,
                  });
                } catch {}
              }
              // Recurse properties
              for (const [k, v] of Object.entries(o)) {
                scan(v, path ? `${path}.${k}` : k);
              }
              return;
            }

            // Arrays
            if (Array.isArray(obj)) {
              for (let i = 0; i < obj.length; i++) {
                scan(obj[i], `${path}[${i}]`);
              }
              return;
            }

            // Strings that look like ISO dates
            if (typeof obj === 'string') {
              const isoLike =
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z$/.test(obj);
              if (isoLike) {
                try {
                  findings.push({ path, kind: 'ISO_STRING', value: obj });
                  findings.push({
                    path: path + '.__parsedDate',
                    kind: 'ISO_MS',
                    value: new Date(obj).getTime(),
                  });
                } catch {}
              }
            }
          }

          scan(restoredData);
          console.debug(
            '[SignalTree debug] deep restoredData findings:',
            findings
          );
        }
      } catch {
        /* ignore diagnostics failure */
      }

      // Debug: print type info for top-level restored properties when running tests
      try {
        if (isJestWorker()) {
          const diag: Record<string, unknown> = {};
          for (const k of Object.keys(
            restoredData as Record<string, unknown>
          )) {
            const v = (restoredData as unknown as Record<string, unknown>)[k] as unknown;
            diag[k] = {
              typeof: typeof v,
              isDate: v instanceof Date,
              dateTime:
                v instanceof Date
                  ? (() => {
                      try {
                        return (v as Date).getTime();
                      } catch {
                        return '[unavailable]';
                      }
                    })()
                  : undefined,
              isRegExp: v instanceof RegExp,
              isMap: v instanceof Map,
              isSet: v instanceof Set,
              preview: (() => {
                try {
                  return JSON.stringify(v).slice(0, 200);
                } catch {
                  return String(v);
                }
              })(),
            };
          }
          console.debug('[SignalTree debug] restoredData types:', diag);
        }
      } catch {
        /* ignore */
      }

      // Use set with the full object to replace everything at once
      // Normalize date-like strings into Date objects when the target
      // signal currently holds a Date. This guards against cases where
      // serialization produced plain ISO strings instead of type markers.
      function normalizeDatesByTarget(targetNode: any, incoming: any) {
        if (!incoming || typeof incoming !== 'object') return;

        for (const k of Object.keys(incoming)) {
          try {
            const incomingVal = incoming[k];
            const candidate = targetNode?.[k];

            if (candidate && typeof candidate === 'function') {
              // candidate is a signal or callable proxy
              try {
                const current = candidate();
                if (
                  typeof incomingVal === 'string' &&
                  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.Z+-]+$/.test(
                    incomingVal
                  ) &&
                  current instanceof Date
                ) {
                  try {
                    if (isJestWorker()) {
                      try {
                        console.debug(
                          '[SignalTree debug] normalizeDatesByTarget will convert',
                          {
                            key: k,
                            incomingVal,
                            currentIsDate: current instanceof Date,
                            currentTime:
                              current instanceof Date
                                ? current.getTime()
                                : undefined,
                          }
                        );
                      } catch {}
                    }
                  } catch {}
                  incoming[k] = new Date(incomingVal);
                } else if (incomingVal && typeof incomingVal === 'object') {
                  // Recurse into nested proxies
                  normalizeDatesByTarget(candidate, incomingVal);
                }
              } catch {
                // ignore candidate introspection failures
              }
            } else if (incomingVal && typeof incomingVal === 'object') {
              // No callable target; recurse to convert nested date strings
              normalizeDatesByTarget(targetNode?.[k], incomingVal);
            }
          } catch {
            /* ignore per-key errors */
          }
        }
      }

      try {
        if (isJestWorker()) {
          try {
            console.debug(
              '[SignalTree debug] incoming restoredData keys:',
              Object.keys(restoredData as Record<string, unknown>)
            );
          } catch {}
        }
      } catch {}

      try {
        normalizeDatesByTarget(tree.$ as any, restoredData as any);
      } catch (e) {
        try {
          if (isJestWorker())
            console.debug(
              '[SignalTree debug] normalizeDatesByTarget error:',
              String(e)
            );
        } catch {}
      }

      try {
        // Print incoming restoredData preview under Jest before set
        if (isJestWorker()) {
          try {
            console.debug(
              '[SignalTree debug] pre-set restoredData preview:',
              JSON.stringify(restoredData).slice(0, 1000)
            );
          } catch {}
        }
      } catch {}

      tree.$.set(restoredData);

      // Debug: after setting, print resulting signal values for top-level keys
      try {
        if (isJestWorker()) {
          const post: Record<string, unknown> = {};
          for (const k of Object.keys(
            restoredData as Record<string, unknown>
          )) {
            try {
              const candidate: any = (tree.$ as any)[k];
              if (typeof candidate === 'function') {
                post[k] = candidate();
              } else {
                post[k] = typeof candidate;
              }
            } catch {
              post[k] = '[unreadable]';
            }
          }
          console.debug('[SignalTree debug] post-set values:', post);
        }
      } catch {
        /* ignore */
      }
    };

    /**
     * Serialize to JSON string
     */
    enhanced.serialize = (config?: SerializationConfig): string => {
      const fullConfig: InternalSerializationConfig = {
        ...DEFAULT_CONFIG,
        ...defaultConfig,
        ...config,
      };

      // Use the unwrapped callable state to avoid serializing internal
      // proxy wrappers.
      const state = unwrapObjectSafely(
        tree.$(),
        new WeakSet(),
        0,
        fullConfig.maxDepth,
        fullConfig.preserveTypes
      ) as T;

      // Ensure that any remaining special objects (Date/RegExp/Map/Set/BigInt/Symbol)
      // are converted to marker objects before JSON.stringify. This guards
      // against cases where unwrapObjectSafely returned Date instances or other
      // specials directly.
      function sanitizeStateForStringify(
        input: unknown,
        visited = new WeakSet()
      ): unknown {
        if (input === null || typeof input !== 'object') {
          // primitives
          return input;
        }

        if (visited.has(input as object)) return '[Circular Reference]';
        visited.add(input as object);

        // Dates/RegExp/Map/Set/BigInt/Symbol handling
        try {
          if (input instanceof Date) {
            return { [TYPE_MARKERS.DATE]: input.toISOString() };
          }
          if (input instanceof RegExp) {
            return {
              [TYPE_MARKERS.REGEXP]: {
                source: input.source,
                flags: input.flags,
              },
            };
          }
          if (input instanceof Map) {
            return {
              [TYPE_MARKERS.MAP]: Array.from(
                (input as Map<unknown, unknown>).entries()
              ),
            };
          }
          if (input instanceof Set) {
            return {
              [TYPE_MARKERS.SET]: Array.from((input as Set<unknown>).values()),
            };
          }
        } catch {
          // ignore
        }

        // BigInt and Symbol need typeof check
        if (typeof input === 'object' && (input as any) === input) {
          // Handle arrays
          if (Array.isArray(input)) {
            const out: unknown[] = [];
            for (const item of input as Array<unknown>) {
              out.push(sanitizeStateForStringify(item, visited));
            }
            visited.delete(input as object);
            return out;
          }

          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(
            input as Record<string, unknown>
          )) {
            // BigInt and Symbol on property values
            if (typeof v === 'bigint') {
              result[k] = { [TYPE_MARKERS.BIGINT]: v.toString() };
            } else if (typeof v === 'symbol') {
              result[k] = { [TYPE_MARKERS.SYMBOL]: v.toString() };
            } else {
              result[k] = sanitizeStateForStringify(v, visited);
            }
          }
          visited.delete(input as object);
          return result;
        }

        visited.delete(input as object);
        return input;
      }

      const sanitized = sanitizeStateForStringify(state) as T;

      // Debug: inspect the raw state returned by unwrapObjectSafely so we can
      // determine whether special-type markers (e.g. DATE) are present.
      try {
        if (isJestWorker()) {
          const diag: Record<string, unknown> = {};
          if (state && typeof state === 'object') {
            for (const k of Object.keys(state as Record<string, unknown>)) {
              const v: any = (state as any)[k];
              diag[k] = {
                typeof: typeof v,
                isDateObj: v instanceof Date,
                isMarkerObject:
                  v && typeof v === 'object' && TYPE_MARKERS.DATE in v,
                preview: (() => {
                  try {
                    return JSON.stringify(v).slice(0, 200);
                  } catch {
                    return String(v);
                  }
                })(),
              };
            }
          }
          console.debug('[SignalTree debug] serialize raw state types:', diag);
        }
      } catch {
        /* ignore */
      }

      // Detect circular references if needed
      const circularPaths = fullConfig.handleCircular
        ? detectCircularReferences(sanitized)
        : [];

      // Prepare data
      const data: SerializedState<T> = {
        data: sanitized,
      };

      // Add metadata if requested
      if (fullConfig.includeMetadata) {
        data.metadata = {
          timestamp: Date.now(),
          version: '1.0.0',
          ...(circularPaths.length > 0 && { circularRefs: circularPaths }),
        };
      }

      // Serialize with custom replacer
      const replacer = createReplacer(fullConfig);
      const serialized = JSON.stringify(data, replacer, 2);

      // Debug in test environment to help diagnose failing spec
      try {
        if (isJestWorker()) {
          // Print a compact preview
          console.debug(
            '[SignalTree debug] serialized preview:',
            serialized.slice(0, 500)
          );
        }
      } catch {
        // ignore
      }

      return serialized;
    };

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
        // Debug: show incoming JSON preview
        try {
          if (isJestWorker())
            console.debug(
              '[SignalTree debug] deserialize incoming json preview:',
              String(json).slice(0, 1000)
            );
        } catch {}

        // Parse with simple JSON.parse (no custom reviver)
        const parsed: SerializedState<T> = JSON.parse(json);

        try {
          if (isJestWorker()) {
            try {
              console.debug(
                '[SignalTree debug] deserialize parsed data keys:',
                Object.keys((parsed?.data || {}) as Record<string, unknown>)
              );
              try {
                console.debug(
                  '[SignalTree debug] deserialize parsed data preview:',
                  JSON.stringify(parsed?.data).slice(0, 1000)
                );
              } catch {}
            } catch {}
          }
        } catch {}

        // Extract data and metadata
        const { data, metadata } = parsed;

        // Resolve circular references if present
        if (metadata?.circularRefs && fullConfig.handleCircular) {
          resolveCircularReferences(data, metadata.circularRefs);
        }

        // Apply the data to the tree (fromJSON will handle type restoration)
        enhanced.fromJSON(data);

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

    /**
     * Create a snapshot
     */
    enhanced.snapshot = (): SerializedState<T> => {
      const state = enhanced.toJSON();
      const circularPaths = detectCircularReferences(state);

      return {
        data: JSON.parse(JSON.stringify(state)), // Deep clone
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
          ...(circularPaths.length > 0 && { circularRefs: circularPaths }),
        },
      };
    };

    /**
     * Restore from snapshot
     */
    enhanced.restore = (snapshot: SerializedState<T>): void => {
      const { data, metadata } = snapshot;

      // Resolve circular references if present
      if (metadata?.circularRefs) {
        resolveCircularReferences(data, metadata.circularRefs);
      }

      enhanced.fromJSON(data);
    };

    return enhanced;
  };
}

/**
 * Convenience function to enable serialization with defaults
 */
export function enableSerialization<T extends Record<string, unknown>>() {
  return withSerialization<T>({
    includeMetadata: true,
    preserveTypes: true,
    handleCircular: true,
  });
}

/**
 * Storage adapter interface for persistence
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

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
}

/**
 * Adds persistence capabilities to a SerializableSignalTree
 */
export function withPersistence<T extends Record<string, unknown>>(
  config: PersistenceConfig
): (tree: SignalTree<T>) => SerializableSignalTree<T> & {
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): Promise<void>;
} {
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

  return (tree: SignalTree<T>) => {
    // First enhance with serialization
    const serializable = withSerialization<T>(serializationConfig)(tree);

    // Add persistence methods
    const enhanced = serializable as SerializableSignalTree<T> & {
      save(): Promise<void>;
      load(): Promise<void>;
      clear(): Promise<void>;
    };

    // Whether auto-save should be suppressed (useful during load)
    let suppressAutoSave = false;
    // Baseline snapshot used to diff for auto-save. Promoted to outer
    // scope so load() can reset it after restoring state.
    let prevSnapshot: string | undefined;

    /**
     * Save current state to storage
     */
    enhanced.save = async (): Promise<void> => {
      try {
        const serialized = enhanced.serialize(serializationConfig);
        await Promise.resolve(storage.setItem(key, serialized));

        if ((tree as SignalTreeWithConfig).__config?.debugMode) {
          console.log(`[SignalTree] State saved to storage key: ${key}`);
        }
      } catch (error) {
        console.error('[SignalTree] Failed to save state:', error);
        throw error; // Re-throw for tests to catch
      }
    };

    /**
     * Load state from storage
     */
    enhanced.load = async (): Promise<void> => {
      try {
        // Suppress auto-save while we read and restore state to avoid
        // scheduling a debounced save from the load path.
        suppressAutoSave = true;
        const data = await Promise.resolve(storage.getItem(key));
        if (data) {
          enhanced.deserialize(data, serializationConfig);

          if ((tree as SignalTreeWithConfig).__config?.debugMode) {
            console.log(`[SignalTree] State loaded from storage key: ${key}`);
          }
          // After a load, reset the baseline snapshot (without metadata)
          try {
            prevSnapshot = serializable.serialize({
              ...serializationConfig,
              includeMetadata: false,
            });
          } catch {
            prevSnapshot = undefined;
          }
        }
      } catch (error) {
        console.error('[SignalTree] Failed to load state:', error);
        throw error; // Re-throw for tests to catch
      } finally {
        suppressAutoSave = false;
      }
    };

    /**
     * Clear state from storage
     */
    enhanced.clear = async (): Promise<void> => {
      try {
        await Promise.resolve(storage.removeItem(key));

        if ((tree as SignalTreeWithConfig).__config?.debugMode) {
          console.log(`[SignalTree] State cleared from storage key: ${key}`);
        }
      } catch (error) {
        console.error('[SignalTree] Failed to clear state:', error);
        throw error; // Re-throw for tests to catch
      }
    };

    // Auto-load on creation if enabled
    if (autoLoad) {
      // Run load immediately (microtask) so tests relying on auto-load don't
      // need to wait on timers. Errors are caught and logged.
      (async () => {
        try {
          suppressAutoSave = true;
          await enhanced.load();
        } catch (error) {
          console.warn('[SignalTree] Auto-load failed:', error);
        } finally {
          suppressAutoSave = false;
        }
      })();
    }

    // Auto-save on updates if enabled. Use polling to detect changes
    // and debounce saves. This approach works reliably with Jest/Zone
    // without requiring Angular DI setup.
    if (autoSave) {
      let saveTimeout: ReturnType<typeof setTimeout> | undefined;
      let pollInterval: ReturnType<typeof setInterval> | undefined;

      const triggerSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          enhanced.save().catch((error) => {
            console.error('[SignalTree] Auto-save failed:', error);
          });
          saveTimeout = undefined;
        }, debounceMs);
      };

      // Initial snapshot to compare (do not include metadata in diff)
      try {
        prevSnapshot = serializable.serialize({
          ...serializationConfig,
          includeMetadata: false,
        });
      } catch {
        prevSnapshot = undefined;
      }

      // Poll for changes every 100ms
      const checkForChanges = () => {
        try {
          const current = serializable.serialize({
            ...serializationConfig,
            includeMetadata: false,
          });
          if (suppressAutoSave) {
            // If suppression is active (e.g., during load), reset baseline
            // and avoid scheduling saves triggered by load.
            prevSnapshot = current;
            return;
          }
          if (prevSnapshot === undefined || current !== prevSnapshot) {
            prevSnapshot = current;
            triggerSave();
          }
        } catch {
          // swallow serialization errors during polling
        }
      };

      // Start polling every 100ms
      pollInterval = setInterval(checkForChanges, 100);

      // For testing: manually trigger change check
      (enhanced as EnhancedSignalTree).__checkAutoSave = checkForChanges;

      (enhanced as EnhancedSignalTree).__flushAutoSave = async () => {
        if (saveTimeout) {
          clearTimeout(saveTimeout);
          saveTimeout = undefined;
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = undefined;
        }
        return enhanced.save();
      };
    }

    return enhanced;
  };
}

/**
 * Create a custom storage adapter
 */
export function createStorageAdapter(
  getItem: (key: string) => string | null | Promise<string | null>,
  setItem: (key: string, value: string) => void | Promise<void>,
  removeItem: (key: string) => void | Promise<void>
): StorageAdapter {
  return { getItem, setItem, removeItem };
}

/**
 * IndexedDB storage adapter for large state trees
 */
export function createIndexedDBAdapter(
  dbName = 'SignalTreeDB',
  storeName = 'states'
): StorageAdapter {
  let db: IDBDatabase | null = null;

  const openDB = async (): Promise<IDBDatabase> => {
    if (db) return db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
    });
  };

  return {
    async getItem(key: string): Promise<string | null> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async removeItem(key: string): Promise<void> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },
  };
}
