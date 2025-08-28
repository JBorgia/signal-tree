import { isSignal } from '@angular/core';
import type { SignalTree, Middleware } from '@signaltree/core';
import { unwrap } from '@signaltree/core';

// Global middleware storage
const middlewareMap = new WeakMap<SignalTree<any>, Middleware<any>[]>();

// Track proxies to prevent duplicates
const proxyCache = new WeakMap<object, any>();

/**
 * Enhanced SignalTree with middleware capabilities
 */
interface MiddlewareSignalTree<T> extends SignalTree<T> {
  addMiddleware: (middleware: Middleware<T>) => void;
  removeMiddleware: (id: string) => void;
  getMiddlewares: () => Middleware<T>[];
  clearMiddlewares: () => void;
}

/**
 * Enhances a SignalTree with middleware capabilities for v2.0 architecture
 * Recursively intercepts all update/set methods throughout the tree
 *
 * @param middlewares - Initial array of middleware to apply
 * @returns Function that enhances a SignalTree with middleware
 */
export function withMiddleware<T>(
  middlewares: Middleware<T>[] = []
): (tree: SignalTree<T>) => MiddlewareSignalTree<T> {
  return (tree: SignalTree<T>) => {
    // Initialize middleware array for this tree
    middlewareMap.set(tree, [...middlewares]);

    // Track if we're already processing middleware to prevent recursion
    let isProcessingMiddleware = false;

    /**
     * Execute middleware hooks
     */
    function executeMiddleware(
      action: string,
      payload: unknown,
      path: string,
      executeFn: () => void
    ): void {
      if (isProcessingMiddleware) {
        executeFn();
        return;
      }

      isProcessingMiddleware = true;
      try {
        const treeMiddlewares = middlewareMap.get(tree) || [];
        const beforeState = unwrap(tree.$);

        // Execute 'before' hooks
        for (const middleware of treeMiddlewares) {
          if (middleware.before) {
            const shouldContinue = middleware.before(
              action,
              payload,
              beforeState
            );
            if (!shouldContinue) {
              // Middleware blocked the update
              return;
            }
          }
        }

        // Execute the actual update
        executeFn();

        // Get new state after update
        const afterState = unwrap(tree.$);

        // Execute 'after' hooks
        for (const middleware of treeMiddlewares) {
          if (middleware.after) {
            middleware.after(action, payload, beforeState, afterState);
          }
        }
      } finally {
        isProcessingMiddleware = false;
      }
    }

    /**
     * Create middleware proxy that recursively wraps all branch nodes
     * This ensures middleware intercepts ALL updates at any level
     */
    function createMiddlewareProxy(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: any,
      path = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): any {
      // Check cache first
      if (proxyCache.has(target)) {
        return proxyCache.get(target);
      }

      // Don't proxy signals
      if (isSignal(target)) {
        return target;
      }

      // Don't proxy non-objects
      if (!target || typeof target !== 'object') {
        return target;
      }

      const proxy = new Proxy(target, {
        get(obj, prop) {
          const value = obj[prop];

          // Intercept 'set' method on branch nodes
          if (prop === 'set' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (partial: any) {
              const actionPath = path || 'root';
              return executeMiddleware('SET', partial, actionPath, () =>
                value.call(obj, partial)
              );
            };
          }

          // Intercept 'update' method on branch nodes
          if (prop === 'update' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (updater: any) {
              const actionPath = path || 'root';
              const currentBranch = unwrapBranch(obj);
              const updateResult = updater(currentBranch);

              return executeMiddleware('UPDATE', updateResult, actionPath, () =>
                value.call(obj, updater)
              );
            };
          }

          // Recursively proxy nested objects (but not signals)
          if (value && typeof value === 'object' && !isSignal(value)) {
            const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
            return createMiddlewareProxy(value, nestedPath);
          }

          return value;
        },
      });

      proxyCache.set(target, proxy);
      return proxy;
    }

    // Helper to unwrap just a branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function unwrapBranch(branch: any): any {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = {};
      for (const key in branch) {
        if (key === 'set' || key === 'update') continue;
        if (!Object.prototype.hasOwnProperty.call(branch, key)) continue;

        const value = branch[key];
        if (isSignal(value)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result[key] = (value as any)();
        } else if (value && typeof value === 'object') {
          result[key] = unwrapBranch(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    // Apply proxy to the tree's state
    const originalState = tree.$;
    const proxiedState = createMiddlewareProxy(originalState);
    tree.$ = proxiedState;
    tree.state = proxiedState;

    // Create enhanced tree with middleware management methods
    const enhancedTree = tree as MiddlewareSignalTree<T>;

    // Add middleware management methods
    enhancedTree.addMiddleware = (middleware: Middleware<T>) => {
      const treeMiddlewares = middlewareMap.get(tree) || [];

      // Check if middleware with same ID already exists
      const existingIndex = treeMiddlewares.findIndex(
        (m) => m.id === middleware.id
      );
      if (existingIndex >= 0) {
        // Replace existing middleware
        treeMiddlewares[existingIndex] = middleware;
      } else {
        treeMiddlewares.push(middleware);
      }

      middlewareMap.set(tree, treeMiddlewares);
    };

    enhancedTree.removeMiddleware = (id: string) => {
      const treeMiddlewares = middlewareMap.get(tree) || [];
      const filtered = treeMiddlewares.filter((m) => m.id !== id);
      middlewareMap.set(tree, filtered);
    };

    enhancedTree.getMiddlewares = () => {
      return middlewareMap.get(tree) || [];
    };

    enhancedTree.clearMiddlewares = () => {
      middlewareMap.set(tree, []);
    };

    return enhancedTree;
  };
}

/**
 * Creates a logging middleware that tracks all state changes
 */
export function createLoggingMiddleware<T>(
  treeName = 'SignalTree',
  options: {
    logPayload?: boolean;
    logState?: boolean;
    collapsed?: boolean;
  } = {}
): Middleware<T> {
  const { logPayload = true, logState = true, collapsed = false } = options;
  const groupMethod = collapsed ? console.groupCollapsed : console.group;

  return {
    id: 'logging',
    before: (action: string, payload: unknown, prev: T) => {
      groupMethod(`🌳 ${treeName}: ${action}`);
      if (logState) {
        console.log('Previous state:', prev);
      }
      if (logPayload) {
        console.log('Payload:', payload);
      }
      return true;
    },
    after: (action: string, _payload: unknown, _prev: T, next: T) => {
      if (logState) {
        console.log('Next state:', next);
      }
      console.groupEnd();
    },
  };
}

/**
 * Creates a performance measurement middleware
 */
export function createPerformanceMiddleware<T>(
  options: {
    threshold?: number;
    onSlow?: (action: string, duration: number) => void;
  } = {}
): Middleware<T> {
  const { threshold = 16, onSlow } = options;
  const timers = new Map<string, number>();

  return {
    id: 'performance',
    before: (action: string) => {
      timers.set(action, performance.now());
      return true;
    },
    after: (action: string) => {
      const start = timers.get(action);
      if (start) {
        const duration = performance.now() - start;
        timers.delete(action);

        if (duration > threshold) {
          console.warn(
            `⚠️ Slow ${action}: ${duration.toFixed(
              2
            )}ms (threshold: ${threshold}ms)`
          );
          onSlow?.(action, duration);
        }
      }
    },
  };
}

/**
 * Creates a validation middleware that validates state after updates
 */
export function createValidationMiddleware<T>(
  validator: (state: T) => string | null,
  options: {
    throwOnError?: boolean;
    logErrors?: boolean;
  } = {}
): Middleware<T> {
  const { throwOnError = false, logErrors = true } = options;

  return {
    id: 'validation',
    after: (action: string, _payload: unknown, _prev: T, next: T) => {
      const error = validator(next);
      if (error) {
        const message = `Validation failed after ${action}: ${error}`;

        if (logErrors) {
          console.error(`❌ ${message}`);
        }

        if (throwOnError) {
          throw new Error(message);
        }
      }
    },
  };
}

/**
 * Creates a middleware that prevents updates based on a condition
 */
export function createGuardMiddleware<T>(
  guard: (action: string, payload: unknown, state: T) => boolean,
  options: {
    logBlocked?: boolean;
    message?: string;
  } = {}
): Middleware<T> {
  const { logBlocked = true, message = 'Update blocked by guard' } = options;

  return {
    id: 'guard',
    before: (action: string, payload: unknown, state: T) => {
      const allowed = guard(action, payload, state);

      if (!allowed && logBlocked) {
        console.warn(`🛡️ ${message} - Action: ${action}`);
      }

      return allowed;
    },
  };
}

/**
 * Creates a middleware that tracks state history
 */
export function createHistoryMiddleware<T>(
  options: {
    maxHistory?: number;
    includePayload?: boolean;
  } = {}
): Middleware<T> & {
  getHistory: () => Array<{
    action: string;
    payload?: unknown;
    state: T;
    timestamp: number;
  }>;
  clearHistory: () => void;
} {
  const { maxHistory = 50, includePayload = false } = options;
  const history: Array<{
    action: string;
    payload?: unknown;
    state: T;
    timestamp: number;
  }> = [];

  return {
    id: 'history',
    after: (action: string, payload: unknown, _prev: T, next: T) => {
      const entry = {
        action,
        ...(includePayload && { payload }),
        state: structuredClone(next), // Deep clone the state
        timestamp: Date.now(),
      };

      history.push(entry);

      // Limit history size
      if (history.length > maxHistory) {
        history.shift();
      }
    },
    getHistory: () => [...history],
    clearHistory: () => {
      history.length = 0;
    },
  };
}

/**
 * Creates a middleware that debounces updates
 */
export function createDebounceMiddleware<T>(
  delay = 300,
  options: {
    leading?: boolean;
    trailing?: boolean;
  } = {}
): Middleware<T> {
  const { leading = false, trailing = true } = options;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, () => void>();

  return {
    id: 'debounce',
    before: (action: string, _payload: unknown, _state: T) => {
      const existingTimer = timers.get(action);

      if (existingTimer) {
        clearTimeout(existingTimer);
        timers.delete(action);
      }

      if (leading && !pending.has(action)) {
        return true; // Allow immediate execution
      }

      // Store the update to execute later
      pending.set(action, () => {
        // The actual update will be executed by the middleware system
      });

      if (trailing) {
        const timer = setTimeout(() => {
          pending.delete(action);
          timers.delete(action);
        }, delay);
        timers.set(action, timer);
      }

      return false; // Block immediate execution
    },
  };
}

/**
 * Convenience function to combine multiple middlewares
 */
export function combineMiddlewares<T>(
  ...middlewares: Middleware<T>[]
): Middleware<T>[] {
  return middlewares;
}
