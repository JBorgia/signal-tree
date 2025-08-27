import { WritableSignal, signal, isSignal } from '@angular/core';

export function createLazySignalTree<T extends object>(
  obj: T,
  equalityFn: (a: unknown, b: unknown) => boolean,
  basePath = ''
): unknown {
  const signalCache = new Map<string, WritableSignal<unknown>>();
  const nestedProxies = new Map<string, unknown>();
  const nestedCleanups = new Map<string, () => void>();

  const cleanup = () => {
    nestedCleanups.forEach((c) => {
      try {
        c();
      } catch (e) {
        void e;
      }
    });
    nestedCleanups.clear();
    signalCache.clear();
    nestedProxies.clear();
  };

  const isBuiltInObject = (v: unknown): boolean => {
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
      v instanceof Promise
    );
  };

  const proxy = new Proxy(obj, {
    get(target: object, prop: string | symbol) {
      if (prop === '__cleanup__') return cleanup;
      if (typeof prop === 'symbol')
        return (target as Record<string | symbol, unknown>)[prop];
      const key = prop as string;
      const path = basePath ? `${basePath}.${key}` : key;
      if (!(key in target)) return undefined;
      const value = (target as Record<string, unknown>)[key];
      if (isSignal(value)) return value;
      if (signalCache.has(path)) return signalCache.get(path);
      if (nestedProxies.has(path)) return nestedProxies.get(path);
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !isSignal(value) &&
        !isBuiltInObject(value)
      ) {
        try {
          // Lazy create nested proxy (this will be registered at runtime)
          const lazyFactory = (globalThis as any).__signaltree_lazy_factory__;
          if (typeof lazyFactory === 'function') {
            const nested = (lazyFactory as Function)(
              value as Record<string, unknown>,
              equalityFn,
              path
            );
            nestedProxies.set(path, nested);
            const proxyWithCleanup = nested as { __cleanup__?: () => void };
            if (typeof proxyWithCleanup.__cleanup__ === 'function') {
              nestedCleanups.set(path, proxyWithCleanup.__cleanup__);
            }
            return nested;
          }

          // Fallback: create signal
          const fallback = signal(value, { equal: equalityFn as any });
          signalCache.set(path, fallback);
          return fallback;
        } catch (err) {
          console.warn('Failed to create lazy proxy:', err);
          const fallback = signal(value, { equal: equalityFn as any });
          signalCache.set(path, fallback);
          return fallback;
        }
      }

      try {
        const newSignal = signal(value, { equal: equalityFn as any });
        signalCache.set(path, newSignal);
        return newSignal;
      } catch (err) {
        console.warn('Failed to create signal for path "' + path + '":', err);
        return value;
      }
    },
    set(target: object, prop: string | symbol, value: unknown) {
      if (typeof prop === 'symbol') {
        (target as Record<string | symbol, unknown>)[prop] = value;
        return true;
      }
      const key = prop as string;
      const path = basePath ? `${basePath}.${key}` : key;
      try {
        (target as Record<string, unknown>)[key] = value;
        const cachedSignal = signalCache.get(path);
        if (cachedSignal && 'set' in cachedSignal) {
          (cachedSignal as WritableSignal<unknown>).set(value);
        }
        if (nestedProxies.has(path)) {
          const nestedCleanup = nestedCleanups.get(path);
          if (nestedCleanup) {
            nestedCleanup();
            nestedCleanups.delete(path);
          }
          nestedProxies.delete(path);
        }
        return true;
      } catch (err) {
        console.warn('Failed to set value for path "' + path + '":', err);
        return false;
      }
    },
    has(target, prop) {
      return prop in target;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  return proxy as any;
}
