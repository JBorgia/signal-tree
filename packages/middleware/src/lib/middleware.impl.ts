import type { Middleware } from '@signaltree/core';

export function createLoggingMiddlewareImpl<T>(
  treeName: string
): Middleware<T> {
  return {
    id: 'logging',
    before: (action, payload, state) => {
      try {
        console.group(`${treeName}: ${action}`);
        console.log('Prev:', state);
        console.log(
          'Payload:',
          typeof payload === 'function' ? 'Function' : payload
        );
      } catch (err) {
        void err;
      }
      return true;
    },
    after: (action, payload, state, newState) => {
      try {
        console.log('Next:', newState);
        console.groupEnd();
      } catch (err) {
        void err;
      }
    },
  };
}

export function createPerformanceMiddlewareImpl<T>(): Middleware<T> {
  return {
    id: 'performance',
    before: (action) => {
      try {
        console.time(`Update: ${action}`);
      } catch (err) {
        void err;
      }
      return true;
    },
    after: (action) => {
      try {
        console.timeEnd(`Update: ${action}`);
      } catch (err) {
        void err;
      }
    },
  };
}

export function createPersistenceMiddlewareImpl<T>(config: {
  key: string;
  storage?: Storage;
  debounceMs?: number;
  actions?: string[];
}): Middleware<T> {
  const {
    key,
    storage,
    debounceMs = 1000,
    actions = ['UPDATE', 'BATCH_UPDATE'],
  } = config;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let activeStorage: Storage | undefined = storage;

  const debouncedSave = (state: T) => {
    if (!activeStorage) return;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      try {
        activeStorage?.setItem(key, JSON.stringify(state));
        if (typeof console !== 'undefined') console.log(`State saved: ${key}`);
      } catch (err) {
        if (typeof console !== 'undefined')
          console.error('Failed to save state:', err);
      }
    }, debounceMs) as unknown as ReturnType<typeof setTimeout>;
  };

  return {
    id: 'persistence',
    after: (action, payload, state, newState) => {
      if (!actions.includes(action)) return;
      // Re-evaluate storage lazily in case environment changed
      activeStorage =
        typeof localStorage !== 'undefined' ? localStorage : storage;
      debouncedSave(newState);
    },
  };
}
