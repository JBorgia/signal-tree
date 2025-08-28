import type { SignalTree, DeepSignalify } from '@signaltree/core';
import { unwrap } from '@signaltree/core';
import { isSignal, WritableSignal } from '@angular/core';

/**
 * Deep equality check - properly handles all types
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle RegExp objects
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  // Handle Set objects
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  // Handle Map objects
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  // Handle objects
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
 * Deep clone helper - properly handles all types
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as T;

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
  dispose(): void;
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
  private isDisposed = false;

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
    if (this.isDisposed) return;

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
    if (this.isDisposed || !this.canUndo()) return false;
    this.currentIndex--;
    const entry = this.history[this.currentIndex];
    this.restoreState(entry.state);
    return true;
  }

  redo(): boolean {
    if (this.isDisposed || !this.canRedo()) return false;
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
    if (this.isDisposed) return;
    const currentState = unwrap(this.tree.$);
    this.history = [];
    this.currentIndex = -1;
    this.addEntry('RESET', currentState);
  }

  jumpTo(index: number): boolean {
    if (this.isDisposed || index < 0 || index >= this.history.length)
      return false;
    this.currentIndex = index;
    const entry = this.history[index];
    this.restoreState(entry.state);
    return true;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  canUndo(): boolean {
    return !this.isDisposed && this.currentIndex > 0;
  }

  canRedo(): boolean {
    return !this.isDisposed && this.currentIndex < this.history.length - 1;
  }

  dispose(): void {
    this.isDisposed = true;
    this.history = [];
  }

  private restoreState(state: T): void {
    if (this.isDisposed) return;
    if (this.restoreStateFn) {
      this.restoreStateFn(state);
    }
  }
}

/**
 * Restore state to the tree using v2.0 architecture
 */
function restoreStateToTree<T>(tree: SignalTree<T>, state: T): void {
  function applyState(target: any, source: any, path: string[] = []): void {
    if (!source || typeof source !== 'object') return;

    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

      const targetProp = target[key];
      const sourceValue = source[key];

      if (targetProp === undefined) {
        console.warn(
          `Cannot restore property at ${[...path, key].join(
            '.'
          )}: property does not exist`
        );
        continue;
      }

      // If it's a signal, set its value
      if (isSignal(targetProp)) {
        (targetProp as WritableSignal<unknown>).set(sourceValue);
      }
      // If it's a branch node with set method, use it
      else if (
        targetProp &&
        typeof targetProp === 'object' &&
        'set' in targetProp &&
        typeof targetProp.set === 'function'
      ) {
        targetProp.set(sourceValue);
      }
      // If both are objects (nested branches), recurse
      else if (
        targetProp &&
        typeof targetProp === 'object' &&
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        applyState(targetProp, sourceValue, [...path, key]);
      }
    }
  }

  applyState(tree.$, state);
}

/**
 * Intercept state changes for time travel tracking
 */
function interceptStateChanges<T>(
  tree: SignalTree<T>,
  manager: TimeTravelManager<T>,
  isRestoring: { value: boolean }
): void {
  let lastState = deepClone(unwrap(tree.$));
  const originalMethods = new WeakMap<any, any>();

  // Track changes and record if different
  function checkAndRecord(action: string, payload?: unknown): void {
    if (isRestoring.value) return;

    const newState = unwrap(tree.$);
    if (!deepEqual(lastState, newState)) {
      manager.addEntry(action, newState, payload);
      lastState = deepClone(newState);
    }
  }

  // Recursively intercept all signals and branch methods
  function interceptNode(node: any, path: string[] = []): void {
    if (!node || typeof node !== 'object') return;

    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;

      const value = node[key];
      const currentPath = [...path, key];

      if (isSignal(value)) {
        // Intercept signal.set() method
        const signal = value as WritableSignal<unknown> & { set?: any };
        if (signal.set && !originalMethods.has(signal)) {
          const originalSet = signal.set.bind(signal);
          originalMethods.set(signal, originalSet);

          signal.set = function (newValue: unknown) {
            const result = originalSet(newValue);
            checkAndRecord('SET', {
              path: currentPath.join('.'),
              value: newValue,
            });
            return result;
          };
        }
      } else if (value && typeof value === 'object') {
        // Intercept branch node methods
        if (
          'set' in value &&
          typeof value.set === 'function' &&
          !originalMethods.has(value)
        ) {
          const originalSet = value.set.bind(value);
          originalMethods.set(value, { set: originalSet });

          Object.defineProperty(value, 'set', {
            value: function (updates: any) {
              const result = originalSet(updates);
              checkAndRecord('SET', { path: currentPath.join('.'), updates });
              return result;
            },
            configurable: true,
            enumerable: false,
          });
        }

        if (
          'update' in value &&
          typeof value.update === 'function' &&
          !originalMethods.has(value)
        ) {
          const current = originalMethods.get(value) || {};
          const originalUpdate = value.update.bind(value);
          originalMethods.set(value, { ...current, update: originalUpdate });

          value.update = function (updater: any) {
            const result = originalUpdate(updater);
            checkAndRecord('UPDATE', { path: currentPath.join('.') });
            return result;
          };
        }

        // Recurse into nested objects
        interceptNode(value, currentPath);
      }
    }
  }

  // Start interception from root
  interceptNode(tree.$);
}

/**
 * Enhances a SignalTree with time travel capabilities
 */
export function withTimeTravel<T>(
  config: TimeTravelConfig = {}
): (
  tree: SignalTree<T>
) => SignalTree<T> & { __timeTravel: TimeTravelInterface<T> } {
  return (tree: SignalTree<T>) => {
    // Flag to prevent recording during restoration
    const isRestoring = { value: false };

    // Create time travel manager
    const timeTravelManager = new TimeTravelManager(
      tree,
      config,
      (state: T) => {
        isRestoring.value = true;
        try {
          restoreStateToTree(tree, state);
        } finally {
          isRestoring.value = false;
        }
      }
    );

    // Set up interception of state changes
    interceptStateChanges(tree, timeTravelManager, isRestoring);

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
