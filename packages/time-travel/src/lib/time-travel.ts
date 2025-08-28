import type { SignalTree, DeepSignalify } from '@signaltree/core';
import { unwrap } from '@signaltree/core';
import { isSignal, WritableSignal } from '@angular/core';

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (
        !deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Deep clone helper
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  if (obj instanceof Set) {
    return new Set(Array.from(obj).map((item) => deepClone(item))) as T;
  }
  if (obj instanceof Map) {
    return new Map(
      Array.from(obj.entries()).map(([k, v]) => [deepClone(k), deepClone(v)])
    ) as T;
  }

  const cloned = {} as Record<string, unknown>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned as T;
}

/**
 * Entry in the time travel history
 */
export interface TimeTravelEntry<T> {
  state: T;
  timestamp: number;
  action: string;
  payload?: unknown;
}

/**
 * Time travel interface
 */
export interface TimeTravelInterface<T> {
  undo(): boolean;
  redo(): boolean;
  getHistory(): TimeTravelEntry<T>[];
  resetHistory(): void;
  jumpTo(index: number): boolean;
  getCurrentIndex(): number;
  canUndo(): boolean;
  canRedo(): boolean;
}

/**
 * Configuration options
 */
export interface TimeTravelConfig {
  maxHistorySize?: number;
  includePayload?: boolean;
  actionNames?: {
    update?: string;
    set?: string;
    batch?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Time travel manager
 */
class TimeTravelManager<T> implements TimeTravelInterface<T> {
  private history: TimeTravelEntry<T>[] = [];
  private currentIndex = -1;
  private maxHistorySize: number;
  private includePayload: boolean;
  private actionNames: Record<string, string>;

  constructor(
    private tree: SignalTree<T>,
    private config: TimeTravelConfig = {},
    private restoreStateFn?: (state: T) => void
  ) {
    this.maxHistorySize = config.maxHistorySize ?? 50;
    this.includePayload = config.includePayload ?? false;
    this.actionNames = {
      update: 'UPDATE',
      set: 'SET',
      batch: 'BATCH',
      ...config.actionNames,
    };

    // Add initial state to history
    this.addEntry('INIT', unwrap(this.tree.$));
  }

  addEntry(action: string, state: T, payload?: unknown): void {
    // If not at end of history, remove everything after current position
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Create new entry
    const entry: TimeTravelEntry<T> = {
      state: deepClone(state),
      timestamp: Date.now(),
      action: this.actionNames[action] || action,
      ...(this.includePayload && payload !== undefined && { payload }),
    };

    this.history.push(entry);
    this.currentIndex = this.history.length - 1;

    // Enforce max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    this.currentIndex--;
    const entry = this.history[this.currentIndex];
    this.restoreState(entry.state);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo()) return false;
    this.currentIndex++;
    const entry = this.history[this.currentIndex];
    this.restoreState(entry.state);
    return true;
  }

  getHistory(): TimeTravelEntry<T>[] {
    return this.history.map((entry) => ({
      ...entry,
      state: deepClone(entry.state),
    }));
  }

  resetHistory(): void {
    const currentState = unwrap(this.tree.$);
    this.history = [];
    this.currentIndex = -1;
    this.addEntry('RESET', currentState);
  }

  jumpTo(index: number): boolean {
    if (index < 0 || index >= this.history.length) return false;
    this.currentIndex = index;
    const entry = this.history[index];
    this.restoreState(entry.state);
    return true;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  private restoreState(state: T): void {
    if (this.restoreStateFn) {
      this.restoreStateFn(state);
    }
  }
}

/**
 * Restore state to the tree using v2.0 architecture
 * This needs to properly handle the deeply signalified structure
 */
function restoreStateToTree<T>(tree: SignalTree<T>, state: T): void {
  // Helper to apply state recursively
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyState(target: any, source: any): void {
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

      const targetProp = target[key];
      const sourceValue = source[key];

      if (targetProp === undefined) continue;

      // If it's a signal, set its value
      if (isSignal(targetProp)) {
        (targetProp as WritableSignal<unknown>).set(sourceValue);
      }
      // If it's a branch node with set method, use it
      else if (
        targetProp &&
        typeof targetProp === 'object' &&
        'set' in targetProp
      ) {
        targetProp.set(sourceValue);
      }
      // If both are objects, recurse
      else if (
        targetProp &&
        typeof targetProp === 'object' &&
        sourceValue &&
        typeof sourceValue === 'object'
      ) {
        applyState(targetProp, sourceValue);
      }
    }
  }

  applyState(tree.$, state);
}

/**
 * Enhances a SignalTree with time travel capabilities
 * Properly handles v2.0 architecture with recursive proxying
 */
export function withTimeTravel<T>(
  config: TimeTravelConfig = {}
): (
  tree: SignalTree<T>
) => SignalTree<T> & { __timeTravel: TimeTravelInterface<T> } {
  return (tree: SignalTree<T>) => {
    // Flag to prevent recording during restoration
    let isRestoring = false;

    // Create time travel manager
    const timeTravelManager = new TimeTravelManager(
      tree,
      config,
      (state: T) => {
        isRestoring = true;
        try {
          restoreStateToTree(tree, state);
        } finally {
          isRestoring = false;
        }
      }
    );

    // Track the last state to detect changes
    let lastState = unwrap(tree.$);

    /**
     * Create time travel proxy that recursively wraps all branch nodes
     * This ensures we capture ALL updates at any level
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function createTimeTravelProxy(target: any, path = ''): any {
      // Don't proxy signals
      if (isSignal(target)) {
        return target;
      }

      // Don't proxy non-objects
      if (!target || typeof target !== 'object') {
        return target;
      }

      return new Proxy(target, {
        get(obj, prop) {
          const value = obj[prop];

          // Intercept 'set' method on branch nodes
          if (prop === 'set' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (update: any) {
              const result = value.call(obj, update);

              if (!isRestoring) {
                // Check if state changed
                const newState = unwrap(tree.$);
                if (!deepEqual(lastState, newState)) {
                  timeTravelManager.addEntry('set', newState, update);
                  lastState = deepClone(newState);
                }
              }

              return result;
            };
          }

          // Intercept 'update' method on branch nodes
          if (prop === 'update' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (updater: any) {
              const result = value.call(obj, updater);

              if (!isRestoring) {
                // Check if state changed
                const newState = unwrap(tree.$);
                if (!deepEqual(lastState, newState)) {
                  timeTravelManager.addEntry('update', newState);
                  lastState = deepClone(newState);
                }
              }

              return result;
            };
          }

          // Recursively proxy nested objects (but not signals)
          if (value && typeof value === 'object' && !isSignal(value)) {
            const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
            return createTimeTravelProxy(value, nestedPath);
          }

          return value;
        },
      });
    }

    // Also need to intercept direct signal updates for leaf nodes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function wrapSignals(target: any): any {
      for (const key in target) {
        if (!Object.prototype.hasOwnProperty.call(target, key)) continue;

        const value = target[key];

        if (isSignal(value)) {
          // Only wrap WritableSignals that expose a set method
          const sig = value as unknown as WritableSignal<unknown>;
          if (sig && typeof (sig as { set?: unknown }).set === 'function') {
            const originalSet = sig.set.bind(sig);
            sig.set = function (newValue: unknown) {
              const result = originalSet(newValue);

              if (!isRestoring) {
                const newState = unwrap(tree.$);
                if (!deepEqual(lastState, newState)) {
                  timeTravelManager.addEntry('set', newState, {
                    [key]: newValue,
                  });
                  lastState = deepClone(newState);
                }
              }

              return result;
            };
          }
        } else if (value && typeof value === 'object' && !isSignal(value)) {
          // Recurse for nested objects
          wrapSignals(value);
        }
      }
      return target;
    }

    // Apply proxy to the tree's state
    const originalState = tree.$;
    const proxiedState = createTimeTravelProxy(originalState);

    // Also wrap direct signal updates
    wrapSignals(proxiedState);

    tree.$ = proxiedState as DeepSignalify<T>;
    tree.state = tree.$;

    // Return enhanced tree
    return {
      ...tree,
      __timeTravel: timeTravelManager,
    } as SignalTree<T> & { __timeTravel: TimeTravelInterface<T> };
  };
}

/**
 * Convenience functions
 */
export function enableTimeTravel<T>(maxHistorySize?: number) {
  return withTimeTravel<T>({ maxHistorySize });
}

export function getTimeTravel<T>(
  tree: SignalTree<T> & { __timeTravel?: TimeTravelInterface<T> }
): TimeTravelInterface<T> | undefined {
  return tree.__timeTravel;
}
