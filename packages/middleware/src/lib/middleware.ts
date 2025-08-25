import { SignalTree, Middleware, DeepSignalify } from '@signaltree/core';

// Per-tree middleware storage
const middlewareMap = new WeakMap<object, Middleware<unknown>[]>();

export function withMiddleware<T>(
  middlewares: Middleware<T>[] = []
): (tree: SignalTree<T>) => SignalTree<T> {
  return (tree: SignalTree<T>) => {
    middlewareMap.set(tree, [...(middlewares as Middleware<unknown>[])]);

    const createRootWrapper = (originalProxy: unknown) => {
      type HostWithMethods = ((...a: unknown[]) => unknown) & {
        update?: (u: (c: T) => Partial<T>) => unknown;
        batchUpdate?: (u: (c: T) => Partial<T>) => unknown;
        set?: (p: Partial<T>) => unknown;
        [k: string]: unknown;
      };

      const host = originalProxy as unknown as HostWithMethods;

      const wrapperFn = function (...args: unknown[]) {
        return (host as unknown as (...a: unknown[]) => unknown)(...args);
      };

      const wrapper = wrapperFn as unknown as DeepSignalify<T> &
        HostWithMethods;

      // Copy enumerable properties where possible
      try {
        const hostRec = host as unknown as Record<string, unknown>;
        const wrapperRec = wrapper as unknown as Record<string, unknown>;
        for (const k of Object.keys(hostRec || {})) {
          try {
            wrapperRec[k] = hostRec[k];
          } catch (err) {
            void err;
          }
        }
      } catch (err) {
        void err;
      }

      const getMiddlewares = () =>
        (middlewareMap.get(tree) as Middleware<T>[]) || [];

      wrapper.update = (updater: (current: T) => Partial<T>) => {
        const action = 'UPDATE';
        const currentState = tree.$();
        const payload = updater(currentState);
        const mws = getMiddlewares();

        for (const mw of mws) {
          if (mw.before && !mw.before(action, payload, currentState)) return;
        }

        const prev = currentState;
        if (host && typeof host.update === 'function') {
          (host.update as unknown as (u: (c: T) => Partial<T>) => unknown).call(
            host,
            updater
          );
        }
        const next = tree.$();

        for (const mw of mws) {
          if (mw.after) mw.after(action, payload, prev, next);
        }
      };

      wrapper.batchUpdate = (updater: (current: T) => Partial<T>) => {
        const action = 'BATCH_UPDATE';
        const currentState = tree.$();
        const payload = updater(currentState);
        const mws = getMiddlewares();

        for (const mw of mws) {
          if (mw.before && !mw.before(action, payload, currentState)) return;
        }

        const prev = currentState;
        if (host && typeof host.batchUpdate === 'function') {
          (
            host.batchUpdate as unknown as (u: (c: T) => Partial<T>) => unknown
          ).call(host, updater);
        }
        const next = tree.$();

        for (const mw of mws) {
          if (mw.after) mw.after(action, payload, prev, next);
        }
      };

      wrapper.set = (partial: Partial<T>) => {
        const action = 'SET';
        const currentState = tree.$();
        const mws = getMiddlewares();

        for (const mw of mws) {
          if (mw.before && !mw.before(action, partial, currentState)) return;
        }

        const prev = currentState;
        if (host && typeof host.set === 'function') {
          (host.set as unknown as (p: Partial<T>) => unknown).call(
            host,
            partial
          );
        }
        const next = tree.$();

        for (const mw of mws) {
          if (mw.after) mw.after(action, partial, prev, next);
        }
      };

      return wrapper as unknown as DeepSignalify<T>;
    };

    const enhancedTree: SignalTree<T> = Object.assign({}, tree, {
      $: createRootWrapper(tree.$),
      state: createRootWrapper(tree.state),
    });

    enhancedTree.addTap = (middleware: Middleware<T>) => {
      const mws = (middlewareMap.get(tree) as Middleware<T>[]) || [];
      const idx = mws.findIndex((m) => m.id === middleware.id);
      if (idx >= 0) mws[idx] = middleware;
      else mws.push(middleware);
      middlewareMap.set(tree, mws as Middleware<unknown>[]);
    };

    enhancedTree.removeTap = (id: string) => {
      const mws = (middlewareMap.get(tree) as Middleware<T>[]) || [];
      middlewareMap.set(
        tree,
        mws.filter((m) => m.id !== id) as Middleware<unknown>[]
      );
    };

    const originalDestroy = tree.destroy.bind(tree);
    enhancedTree.destroy = () => {
      middlewareMap.delete(tree);
      originalDestroy();
    };

    return enhancedTree;
  };
}

import * as factories from './middleware.factories';

export function createLoggingMiddleware<T>(treeName: string): Middleware<T> {
  return factories.createLoggingMiddleware(treeName) as Middleware<T>;
}

export function createPerformanceMiddleware<T>(): Middleware<T> {
  return factories.createPerformanceMiddleware() as Middleware<T>;
}

export function createValidationMiddleware<T>(
  validator: (state: T) => string | null
): Middleware<T> {
  return factories.createValidationMiddleware(validator) as Middleware<T>;
}

export function createPersistenceMiddleware<T>(config: {
  key: string;
  storage?: Storage;
  debounceMs?: number;
  actions?: string[];
}): Middleware<T> {
  return factories.createPersistenceMiddleware(config) as Middleware<T>;
}

export { Middleware };
