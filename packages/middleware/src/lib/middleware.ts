import { SignalTree, Middleware, DeepSignalify } from '@signaltree/core';

// Per-tree middleware storage
const middlewareMap = new WeakMap<object, Middleware<unknown>[]>();
// Per-tree rebuild functions for precomputed chains (both $ and state wrappers)
const rebuildMap = new WeakMap<object, Set<() => void>>();

export function withMiddleware<T>(
  middlewares: Middleware<T>[] = []
): (tree: SignalTree<T>) => SignalTree<T> {
  return (tree: SignalTree<T>) => {
    middlewareMap.set(tree, [...(middlewares as Middleware<unknown>[])]);

    // If the core cleanup registry is available, register cleanup to delete
    // middleware references when the tree is destroyed. This ensures enhancers
    // don't need to remember to delete global registries manually.
    try {
      // @ts-ignore test/runtime helper
      const register = (tree as any).__registerCleanup as (
        fn: () => void
      ) => void;
      if (typeof register === 'function') {
        register(() => {
          try {
            middlewareMap.delete(tree);
          } catch (err) {
            void err;
          }
        });
      }
    } catch (err) {
      void err;
    }

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

      // Precomputed middleware chains for before/after; rebuilt on add/remove
      let beforeChain: (
        action: string,
        payload: unknown,
        state: T
      ) => boolean = () => true;
      let afterChain: (
        action: string,
        payload: unknown,
        prev: T,
        next: T
      ) => void = () => {};

      const rebuildChains = () => {
        const mws = (middlewareMap.get(tree) as Middleware<T>[]) || [];
        beforeChain = (action: string, payload: unknown, state: T) => {
          for (const mw of mws) {
            if (mw.before && !mw.before(action, payload, state)) return false;
          }
          return true;
        };
        afterChain = (action: string, payload: unknown, prev: T, next: T) => {
          for (const mw of mws) {
            if (mw.after) {
              try {
                mw.after(action, payload, prev, next);
              } catch (err) {
                // Guard middleware from blowing up the pipeline
                console.warn('[SignalTree][middleware] after hook error:', err);
              }
            }
          }
        };
      };

      // Initialize chains and register the rebuild function for this tree
      rebuildChains();
      try {
        let s = rebuildMap.get(tree as unknown as object);
        if (!s) {
          s = new Set();
          rebuildMap.set(tree as unknown as object, s);
        }
        s.add(rebuildChains);
      } catch (err) {
        void err;
      }

      wrapper.update = (updater: (current: T) => Partial<T>) => {
        const action = 'UPDATE';
        const currentState = tree.$();
        let payload: unknown;
        try {
          payload = updater(currentState);
        } catch (err) {
          // If payload computation throws, still allow afterChain to run
          // with prev === next
          try {
            afterChain(action, undefined, currentState, currentState);
          } catch (e) {
            void e;
          }
          throw err;
        }

        if (!beforeChain(action, payload, currentState)) return;

        const prev = currentState;
        try {
          if (host && typeof host.update === 'function') {
            (
              host.update as unknown as (u: (c: T) => Partial<T>) => unknown
            ).call(host, updater);
          }
        } catch (err) {
          // Ensure afterChain still runs with prev and prev
          try {
            afterChain(action, payload, prev, prev);
          } catch (e) {
            void e;
          }
          throw err;
        }

        const next = tree.$();
        try {
          afterChain(action, payload, prev, next);
        } catch (err) {
          void err;
        }
      };

      wrapper.batchUpdate = (updater: (current: T) => Partial<T>) => {
        const action = 'BATCH_UPDATE';
        const currentState = tree.$();
        let payload: unknown;
        try {
          payload = updater(currentState);
        } catch (err) {
          try {
            afterChain(action, undefined, currentState, currentState);
          } catch (e) {
            void e;
          }
          throw err;
        }

        if (!beforeChain(action, payload, currentState)) return;

        const prev = currentState;
        try {
          if (host && typeof host.batchUpdate === 'function') {
            (
              host.batchUpdate as unknown as (
                u: (c: T) => Partial<T>
              ) => unknown
            ).call(host, updater);
          }
        } catch (err) {
          try {
            afterChain(action, payload, prev, prev);
          } catch (e) {
            void e;
          }
          throw err;
        }

        const next = tree.$();
        try {
          afterChain(action, payload, prev, next);
        } catch (err) {
          void err;
        }
      };

      wrapper.set = (partial: Partial<T>) => {
        const action = 'SET';
        const currentState = tree.$();

        if (!beforeChain(action, partial, currentState)) return;

        const prev = currentState;
        try {
          if (host && typeof host.set === 'function') {
            (host.set as unknown as (p: Partial<T>) => unknown).call(
              host,
              partial
            );
          }
        } catch (err) {
          try {
            afterChain(action, partial, prev, prev);
          } catch (e) {
            void e;
          }
          throw err;
        }

        const next = tree.$();
        try {
          afterChain(action, partial, prev, next);
        } catch (err) {
          void err;
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
      // Rebuild precomputed chains if present
      try {
        const s = rebuildMap.get(tree as unknown as object);
        if (s) {
          for (const r of s) {
            try {
              r();
            } catch (err) {
              void err;
            }
          }
        }
      } catch (err) {
        void err;
      }
    };

    enhancedTree.removeTap = (id: string) => {
      const mws = (middlewareMap.get(tree) as Middleware<T>[]) || [];
      middlewareMap.set(
        tree,
        mws.filter((m) => m.id !== id) as Middleware<unknown>[]
      );
      // Rebuild precomputed chains if present
      try {
        const s = rebuildMap.get(tree as unknown as object);
        if (s) {
          for (const r of s) {
            try {
              r();
            } catch (err) {
              void err;
            }
          }
        }
      } catch (err) {
        void err;
      }
    };

    const originalDestroy = tree.destroy.bind(tree);
    enhancedTree.destroy = () => {
      middlewareMap.delete(tree);
      originalDestroy();
    };

    return enhancedTree;
  };
}

export async function createLoggingMiddleware<T>(
  treeName: string
): Promise<Middleware<T>> {
  const mod = await import('./middleware.factories');
  return mod.createLoggingMiddleware(treeName) as Middleware<T>;
}

export async function createPerformanceMiddleware<T>(): Promise<Middleware<T>> {
  const mod = await import('./middleware.factories');
  return mod.createPerformanceMiddleware() as Middleware<T>;
}

export async function createValidationMiddleware<T>(
  validator: (state: T) => string | null
): Promise<Middleware<T>> {
  const mod = await import('./middleware.factories');
  return mod.createValidationMiddleware(validator) as Middleware<T>;
}

export async function createPersistenceMiddleware<T>(config: {
  key: string;
  storage?: Storage;
  debounceMs?: number;
  actions?: string[];
}): Promise<Middleware<T>> {
  const mod = await import('./middleware.factories');
  return mod.createPersistenceMiddleware(config) as Middleware<T>;
}

export { Middleware };
