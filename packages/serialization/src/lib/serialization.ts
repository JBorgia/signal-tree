/**
 * SignalTree Serialization Module
 *
 * Provides serialization and deserialization capabilities for SignalTree,
 * enabling state persistence, SSR, and state transfer between contexts.
 */

import { SignalTree } from '@signaltree/core';
import { isSignal, Signal, WritableSignal } from '@angular/core';
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
     * Circular reference markers
     */
    circularRefs?: Record<string, string>;
  };
}

/**
 * Enhanced SignalTree interface with serialization capabilities
 */
export interface SerializableSignalTree<T> extends SignalTree<T> {
  /** Serialize the current state to a JSON string */
  serialize(config?: SerializationConfig): string;
  /** Deserialize and apply state from a JSON string */
  deserialize(json: string, config?: SerializationConfig): void;
  /** Get a plain object representation of the current state */
  toJSON(): T;
  /** Restore state from a plain object */
  fromJSON(data: T): void;
  /** Create a snapshot of the current state */
  snapshot(): SerializedState<T>;
  /** Restore state from a snapshot */
  restore(snapshot: SerializedState<T>): void;
}

/**
 * Enhanced SignalTree with persistence capabilities
 */
export interface PersistableSignalTree<T> extends SerializableSignalTree<T> {
  /** Save current state to storage */
  save(): Promise<void>;
  /** Load state from storage */
  load(): Promise<void>;
  /** Clear state from storage */
  clear(): Promise<void>;
  /** Dispose of resources (cleanup) */
  dispose(): void;
  /** Promise that resolves when initial load is complete */
  ready: Promise<void>;
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
 * Internal config with all required properties but nullable functions
 */
type InternalSerializationConfig = Required<
  Omit<SerializationConfig, 'replacer' | 'reviver'>
> & {
  replacer?: (key: string, value: unknown) => unknown;
  reviver?: (key: string, value: unknown) => unknown;
};

/**
 * Helper to check if a value is a built-in object that should be treated as primitive
 */
function isBuiltInObject(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  return (
    v instanceof Date ||
    v instanceof RegExp ||
    typeof v === 'function' ||
    v instanceof Map ||
    v instanceof Set ||
    v instanceof WeakMap ||
    v instanceof WeakSet ||
    v instanceof ArrayBuffer ||
    v instanceof DataView ||
    v instanceof Error ||
    v instanceof Promise ||
    (typeof URL !== 'undefined' && v instanceof URL) ||
    (typeof URLSearchParams !== 'undefined' && v instanceof URLSearchParams) ||
    (typeof FormData !== 'undefined' && v instanceof FormData) ||
    (typeof Blob !== 'undefined' && v instanceof Blob) ||
    (typeof File !== 'undefined' && v instanceof File)
  );
}

/**
 * Convert special types to marker format for serialization
 */
function convertToTypeMarker(value: unknown): unknown {
  if (value === undefined) return { [TYPE_MARKERS.UNDEFINED]: true };
  if (typeof value === 'number') {
    if (isNaN(value)) return { [TYPE_MARKERS.NAN]: true };
    if (value === Infinity) return { [TYPE_MARKERS.INFINITY]: true };
    if (value === -Infinity) return { [TYPE_MARKERS.NEG_INFINITY]: true };
  }
  if (typeof value === 'bigint')
    return { [TYPE_MARKERS.BIGINT]: value.toString() };
  if (typeof value === 'symbol')
    return { [TYPE_MARKERS.SYMBOL]: value.toString() };
  if (value instanceof Date)
    return { [TYPE_MARKERS.DATE]: value.toISOString() };
  if (value instanceof RegExp) {
    return {
      [TYPE_MARKERS.REGEXP]: {
        source: value.source,
        flags: value.flags,
      },
    };
  }
  if (value instanceof Map)
    return { [TYPE_MARKERS.MAP]: Array.from(value.entries()) };
  if (value instanceof Set)
    return { [TYPE_MARKERS.SET]: Array.from(value.values()) };
  return value;
}

/**
 * Restore special types from marker format
 */
function restoreSpecialTypes(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  // Check for type markers
  const obj = value as Record<string, unknown>;
  if (TYPE_MARKERS.UNDEFINED in obj) return undefined;
  if (TYPE_MARKERS.NAN in obj) return NaN;
  if (TYPE_MARKERS.INFINITY in obj) return Infinity;
  if (TYPE_MARKERS.NEG_INFINITY in obj) return -Infinity;
  if (TYPE_MARKERS.BIGINT in obj)
    return BigInt(obj[TYPE_MARKERS.BIGINT] as string);
  if (TYPE_MARKERS.SYMBOL in obj)
    return Symbol.for(obj[TYPE_MARKERS.SYMBOL] as string);
  if (TYPE_MARKERS.DATE in obj)
    return new Date(obj[TYPE_MARKERS.DATE] as string);
  if (TYPE_MARKERS.REGEXP in obj) {
    const regexpData = obj[TYPE_MARKERS.REGEXP] as {
      source: string;
      flags: string;
    };
    return new RegExp(regexpData.source, regexpData.flags);
  }
  if (TYPE_MARKERS.MAP in obj)
    return new Map(obj[TYPE_MARKERS.MAP] as Array<[unknown, unknown]>);
  if (TYPE_MARKERS.SET in obj)
    return new Set(obj[TYPE_MARKERS.SET] as Array<unknown>);

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
}

/**
 * Serialize a SignalTree to a plain object
 */
function serializeSignalTree<T>(
  tree: SignalTree<T>,
  config: InternalSerializationConfig
): T {
  const visited = new WeakSet<object>();
  const circularRefs: Record<string, string> = {};
  let refCounter = 0;
  const refMap = new WeakMap<object, string>();

  function serialize(node: unknown, depth = 0): unknown {
    // Depth check
    if (depth > config.maxDepth) {
      return '[Max Depth]';
    }

    // Handle primitives
    if (node === null || typeof node !== 'object') {
      return config.preserveTypes ? convertToTypeMarker(node) : node;
    }

    // Handle circular references
    if (visited.has(node)) {
      if (config.handleCircular) {
        const existingRef = refMap.get(node);
        if (existingRef) {
          return { [TYPE_MARKERS.CIRCULAR]: existingRef };
        }
        const newRef = `ref_${refCounter++}`;
        refMap.set(node, newRef);
        return { [TYPE_MARKERS.CIRCULAR]: newRef };
      }
      return undefined;
    }
    visited.add(node);

    // Handle signals - unwrap them
    if (isSignal(node)) {
      const value = (node as Signal<unknown>)();
      return serialize(value, depth);
    }

    // Handle built-in types
    if (isBuiltInObject(node)) {
      return config.preserveTypes ? convertToTypeMarker(node) : node;
    }

    // Handle arrays
    if (Array.isArray(node)) {
      const result = node.map((item) => serialize(item, depth + 1));
      visited.delete(node);
      return result;
    }

    // Handle objects - skip methods and internal properties
    const result: Record<string, unknown> = {};
    const skipKeys = new Set(['set', 'update', '__cleanup__', '__config']);

    for (const key in node) {
      if (skipKeys.has(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;

      const value = (node as Record<string, unknown>)[key];
      result[key] = serialize(value, depth + 1);
    }

    visited.delete(node);
    return result;
  }

  return serialize(tree.$) as T;
}

/**
 * Apply restored data to a SignalTree
 */
function applyToSignalTree<T>(
  target: any,
  source: T,
  path: string[] = []
): void {
  if (!source || typeof source !== 'object') return;

  for (const [key, value] of Object.entries(source)) {
    const targetProp = target[key];

    if (isSignal(targetProp)) {
      // It's a signal - set it directly
      (targetProp as WritableSignal<unknown>).set(value);
    } else if (
      targetProp &&
      typeof targetProp === 'object' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      // It's a nested branch - recurse
      applyToSignalTree(targetProp, value, [...path, key]);
    } else if (targetProp === undefined && value !== undefined) {
      // Property doesn't exist in target - skip with warning
      console.warn(
        `Cannot restore property at ${[...path, key].join(
          '.'
        )}: property does not exist in target`
      );
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
      return serializeSignalTree(tree, fullConfig);
    };

    /**
     * Restore from plain object
     */
    enhanced.fromJSON = (data: T): void => {
      const restoredData = restoreSpecialTypes(data) as T;
      applyToSignalTree(tree.$, restoredData);
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

      const state = serializeSignalTree(tree, fullConfig);

      // Prepare data with metadata
      const data: SerializedState<T> = {
        data: state,
      };

      if (fullConfig.includeMetadata) {
        data.metadata = {
          timestamp: Date.now(),
          version: '2.0.0',
        };
      }

      // Custom replacer if provided
      const replacer = fullConfig.replacer || undefined;
      return JSON.stringify(data, replacer, 2);
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
        const parsed: SerializedState<T> = JSON.parse(json, fullConfig.reviver);
        const { data, metadata } = parsed;

        // Apply the data to the tree
        enhanced.fromJSON(data);

        // Log restoration if in debug mode
        if ((tree as SignalTreeWithConfig).__config?.debugMode) {
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
      return {
        data: JSON.parse(JSON.stringify(state)), // Deep clone
        metadata: {
          timestamp: Date.now(),
          version: '2.0.0',
        },
      };
    };

    /**
     * Restore from snapshot
     */
    enhanced.restore = (snapshot: SerializedState<T>): void => {
      enhanced.fromJSON(snapshot.data);
    };

    return enhanced;
  };
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

  /**
   * Error handler for save operations
   */
  onSaveError?: (error: Error) => void;

  /**
   * Error handler for load operations
   */
  onLoadError?: (error: Error) => void;
}

/**
 * Adds persistence capabilities to a SerializableSignalTree
 */
export function withPersistence<T extends Record<string, unknown>>(
  config: PersistenceConfig
): (tree: SignalTree<T>) => PersistableSignalTree<T> {
  const {
    key,
    storage = typeof window !== 'undefined' ? window.localStorage : undefined,
    autoSave = true,
    debounceMs = 1000,
    autoLoad = true,
    onSaveError,
    onLoadError,
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
    const enhanced = serializable as PersistableSignalTree<T>;

    // Track resources for cleanup
    let pollInterval: ReturnType<typeof setInterval> | undefined;
    let saveTimeout: ReturnType<typeof setTimeout> | undefined;
    let suppressAutoSave = false;
    let prevSnapshot: string | undefined;

    // Create ready promise
    let readyResolve: () => void = () => {
      // intenstionally blank
    };
    enhanced.ready = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });

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
        const err = error instanceof Error ? error : new Error(String(error));
        if (onSaveError) {
          onSaveError(err);
        } else {
          console.error('[SignalTree] Failed to save state:', error);
        }
        throw err;
      }
    };

    /**
     * Load state from storage
     */
    enhanced.load = async (): Promise<void> => {
      try {
        suppressAutoSave = true;
        const data = await Promise.resolve(storage.getItem(key));

        if (data) {
          enhanced.deserialize(data, serializationConfig);

          if ((tree as SignalTreeWithConfig).__config?.debugMode) {
            console.log(`[SignalTree] State loaded from storage key: ${key}`);
          }

          // Reset baseline snapshot after load
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
        const err = error instanceof Error ? error : new Error(String(error));
        if (onLoadError) {
          onLoadError(err);
        } else {
          console.error('[SignalTree] Failed to load state:', error);
        }
        throw err;
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
        throw error;
      }
    };

    /**
     * Dispose of resources
     */
    enhanced.dispose = (): void => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = undefined;
      }
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = undefined;
      }
    };

    // Auto-load on creation if enabled
    if (autoLoad) {
      (async () => {
        try {
          suppressAutoSave = true;
          await enhanced.load();
        } catch (error) {
          console.warn('[SignalTree] Auto-load failed:', error);
        } finally {
          suppressAutoSave = false;
          readyResolve();
        }
      })();
    } else {
      readyResolve();
    }

    // Auto-save on updates if enabled
    if (autoSave) {
      const triggerSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          enhanced.save().catch((error) => {
            if (onSaveError) {
              onSaveError(
                error instanceof Error ? error : new Error(String(error))
              );
            } else {
              console.error('[SignalTree] Auto-save failed:', error);
            }
          });
          saveTimeout = undefined;
        }, debounceMs);
      };

      // Initial snapshot
      try {
        prevSnapshot = serializable.serialize({
          ...serializationConfig,
          includeMetadata: false,
        });
      } catch {
        prevSnapshot = undefined;
      }

      // Poll for changes
      const checkForChanges = () => {
        if (suppressAutoSave) return;

        try {
          const current = serializable.serialize({
            ...serializationConfig,
            includeMetadata: false,
          });
          if (prevSnapshot === undefined || current !== prevSnapshot) {
            prevSnapshot = current;
            triggerSave();
          }
        } catch {
          // Swallow serialization errors during polling
        }
      };

      pollInterval = setInterval(checkForChanges, 100);
    }

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
