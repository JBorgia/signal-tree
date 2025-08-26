import { signal, Signal } from '@angular/core';
import { SignalTree } from '@signaltree/core';

/**
 * Module metadata for tracking in the composition chain
 */
export interface ModuleMetadata {
  name: string;
  methods: string[];
  addedAt: Date;
  lastActivity: Date;
  operationCount: number;
  averageExecutionTime: number;
  errorCount: number;
}

/**
 * Performance metrics optimized for modular composition
 */
export interface ModularPerformanceMetrics {
  totalUpdates: number;
  moduleUpdates: Record<string, number>;
  modulePerformance: Record<string, number>;
  compositionChain: string[];
  signalGrowth: Record<string, number>;
  memoryDelta: Record<string, number>;
  moduleCacheStats: Record<string, { hits: number; misses: number }>;
}

export interface ModuleActivityTracker {
  trackMethodCall: (module: string, method: string, duration: number) => void;
  trackError: (module: string, error: Error, context?: string) => void;
  getModuleActivity: (module: string) => ModuleMetadata | undefined;
  getAllModules: () => ModuleMetadata[];
}

export interface CompositionLogger {
  logComposition: (modules: string[], action: 'pipe' | 'enhance') => void;
  logMethodExecution: (
    module: string,
    method: string,
    args: unknown[],
    result: unknown
  ) => void;
  logStateChange: (
    module: string,
    path: string,
    oldValue: unknown,
    newValue: unknown
  ) => void;
  logPerformanceWarning: (
    module: string,
    operation: string,
    duration: number,
    threshold: number
  ) => void;
  exportLogs: () => Array<{
    timestamp: Date;
    module: string;
    type: 'composition' | 'method' | 'state' | 'performance';
    data: unknown;
  }>;
}

export interface ModularDevToolsInterface<T> {
  activityTracker: ModuleActivityTracker;
  logger: CompositionLogger;
  // Real-time readonly signal carrying performance metrics
  metrics: Signal<ModularPerformanceMetrics>;
  // Phantom property to tie the interface to the tree's state type T and
  // satisfy strict compiler rules about unused generics.
  _treeType?: T;
  trackComposition: (modules: string[]) => void;
  startModuleProfiling: (module: string) => string;
  endModuleProfiling: (profileId: string) => void;
  connectDevTools: (treeName: string) => void;
  exportDebugSession: () => {
    metrics: ModularPerformanceMetrics;
    modules: ModuleMetadata[];
    logs: Array<unknown>;
    compositionHistory: Array<{ timestamp: Date; chain: string[] }>;
  };
}

function createActivityTracker(): ModuleActivityTracker {
  const modules = new Map<string, ModuleMetadata>();

  return {
    trackMethodCall: (module: string, method: string, duration: number) => {
      const existing = modules.get(module);
      if (existing) {
        existing.lastActivity = new Date();
        existing.operationCount++;
        existing.averageExecutionTime =
          (existing.averageExecutionTime * (existing.operationCount - 1) +
            duration) /
          existing.operationCount;
      } else {
        modules.set(module, {
          name: module,
          methods: [method],
          addedAt: new Date(),
          lastActivity: new Date(),
          operationCount: 1,
          averageExecutionTime: duration,
          errorCount: 0,
        });
      }
    },

    trackError: (module: string, error: Error, context?: string) => {
      const existing = modules.get(module);
      if (existing) existing.errorCount++;
      if (typeof console !== 'undefined') {
        try {
          // Include the same emoji prefix used by the noop shim so tests
          // observing console output receive a consistent string.
          if (context) {
            console.error(`\u274c [${module}] Error in ${context}:`, error);
          } else {
            console.error(`\u274c [${module}]`, error);
          }
        } catch (err) {
          void err;
        }
      }
    },

    getModuleActivity: (module: string) => modules.get(module),

    getAllModules: () => Array.from(modules.values()),
  };
}

function createCompositionLogger(): CompositionLogger {
  // Minimal synchronous logger used in the main bundle. Heavy, human-
  // friendly templates live in `devtools.logging.impl` and are loaded
  // asynchronously only when `enableLogging` is true.
  const logs: Array<{
    timestamp: Date;
    module: string;
    type: 'composition' | 'method' | 'state' | 'performance';
    data: unknown;
  }> = [];

  const addLog = (
    module: string,
    type: 'composition' | 'method' | 'state' | 'performance',
    data: unknown
  ) => {
    logs.push({ timestamp: new Date(), module, type, data });
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  };

  // Minimal console output to keep bundle size small. Tests that need
  // verbose output can rely on the heavy logger which is lazy-loaded.
  return {
    logComposition: (modules: string[], action: 'pipe' | 'enhance') => {
      addLog('core', 'composition', { modules, action });
      try {
        console.log('🔗 Composition ' + action + ':', modules.join(' → '));
      } catch (err) {
        void err;
      }
    },
    logMethodExecution: (
      module: string,
      method: string,
      args: unknown[],
      result: unknown
    ) => {
      addLog(module, 'method', { method, args, result });
      try {
        console.debug(`🔧 [${module}] ${method}`, { args, result });
      } catch (err) {
        void err;
      }
    },
    logStateChange: (
      module: string,
      path: string,
      oldValue: unknown,
      newValue: unknown
    ) => {
      addLog(module, 'state', { path, oldValue, newValue });
      try {
        console.debug(`📝 [${module}] State change at ${path}:`, {
          from: oldValue,
          to: newValue,
        });
      } catch (err) {
        void err;
      }
    },
    logPerformanceWarning: (
      module: string,
      operation: string,
      duration: number,
      threshold: number
    ) => {
      addLog(module, 'performance', { operation, duration, threshold });
      try {
        console.warn(
          `⚠️ [${module}] Slow ${operation}: ${duration.toFixed(
            2
          )}ms (threshold: ${threshold}ms)`
        );
      } catch (err) {
        void err;
      }
    },
    exportLogs: () => [...logs],
  };
}

function createModularMetrics() {
  const metricsSignal = signal<ModularPerformanceMetrics>({
    totalUpdates: 0,
    moduleUpdates: {},
    modulePerformance: {},
    compositionChain: [],
    signalGrowth: {},
    memoryDelta: {},
    moduleCacheStats: {},
  });

  return {
    signal: metricsSignal.asReadonly(),
    updateMetrics: (updates: Partial<ModularPerformanceMetrics>) => {
      metricsSignal.update((current) => ({ ...current, ...updates }));
    },
    trackModuleUpdate: (module: string, duration: number) => {
      metricsSignal.update((current) => ({
        ...current,
        totalUpdates: current.totalUpdates + 1,
        moduleUpdates: {
          ...current.moduleUpdates,
          [module]: (current.moduleUpdates[module] || 0) + 1,
        },
        modulePerformance: { ...current.modulePerformance, [module]: duration },
      }));
    },
  };
}

function createDevToolsInterface<T>(
  tree: SignalTree<T>,
  config: {
    enabled?: boolean;
    treeName?: string;
    enableBrowserDevTools?: boolean;
    enableLogging?: boolean;
    performanceThreshold?: number;
  } = {}
): ModularDevToolsInterface<T> {
  const {
    enabled = true,
    treeName = 'ModularSignalTree',
    enableBrowserDevTools = true,
    enableLogging = true,
    performanceThreshold = 16,
  } = config;

  if (!enabled) {
    // Return minimal interface
    return {
      activityTracker: {
        trackMethodCall: () => undefined,
        trackError: () => undefined,
        getModuleActivity: () => undefined,
        getAllModules: () => [],
      },
      logger: {
        logComposition: () => undefined,
        logMethodExecution: () => undefined,
        logStateChange: () => undefined,
        logPerformanceWarning: () => undefined,
        exportLogs: () => [],
      },
      metrics: signal({
        totalUpdates: 0,
        moduleUpdates: {},
        modulePerformance: {},
        compositionChain: [],
        signalGrowth: {},
        memoryDelta: {},
        moduleCacheStats: {},
      }).asReadonly(),
      trackComposition: () => undefined,
      startModuleProfiling: () => '',
      endModuleProfiling: () => undefined,
      connectDevTools: () => undefined,
      exportDebugSession: () => ({
        metrics: {
          totalUpdates: 0,
          moduleUpdates: {},
          modulePerformance: {},
          compositionChain: [],
          signalGrowth: {},
          memoryDelta: {},
          moduleCacheStats: {},
        },
        modules: [],
        logs: [],
        compositionHistory: [],
      }),
    } as ModularDevToolsInterface<T>;
  }

  const activityTracker = createActivityTracker();
  const logger = enableLogging
    ? createCompositionLogger()
    : {
        logComposition: () => undefined,
        logMethodExecution: () => undefined,
        logStateChange: () => undefined,
        logPerformanceWarning: () => undefined,
        exportLogs: () => [],
      };
  const metrics = createModularMetrics();

  // If verbose logging is requested, asynchronously load the heavy
  // composition logger implementation to keep the main bundle small.
  if (enableLogging) {
    (async () => {
      try {
        const mod = await import('./devtools.logging.impl');
        // Replace the lightweight logger with the heavy one.
        // Keep existing logs by copying exported logs if provided.
        const heavy = mod.createHeavyCompositionLogger();
        // No direct mutation of `logger` (const) — update via indirection
        // by copying methods onto the existing object reference.
        try {
          (Object.keys(heavy) as Array<keyof typeof heavy>).forEach((k) => {
            (logger as unknown as Record<string, unknown>)[k as string] = (
              heavy as unknown as Record<string, unknown>
            )[k as string];
          });
        } catch (e) {
          void e;
        }
      } catch (err) {
        console.debug('devtools: lazy-load logger failed', err);
      }
    })();
  }

  // Expose a small global hook so other enhancers (like batching) can
  // notify the devtools metrics when they execute grouped updates. This
  // keeps the instrumentation robust across proxy/wrapper ordering.
  try {
    (
      globalThis as {
        __signaltree_devtools_track?: (m: string, d: number) => void;
      }
    ).__signaltree_devtools_track = metrics.trackModuleUpdate;
  } catch (err) {
    void err;
  }

  const compositionHistory: Array<{ timestamp: Date; chain: string[] }> = [];

  const activeProfiles = new Map<
    string,
    { module: string; operation: string; startTime: number }
  >();

  let browserDevTools: { send: (action: string, state: T) => void } | null =
    null;

  if (
    enableBrowserDevTools &&
    typeof window !== 'undefined' &&
    '__REDUX_DEVTOOLS_EXTENSION__' in window
  ) {
    const devToolsExt = (window as Record<string, unknown>)[
      '__REDUX_DEVTOOLS_EXTENSION__'
    ] as {
      connect: (config: Record<string, unknown>) => {
        send: (action: string, state: T) => void;
      };
    };
    const connection = devToolsExt.connect({
      name: treeName,
      features: { dispatch: true, jump: true, skip: true },
    });
    browserDevTools = { send: connection.send };
  }

  // Callable state shape: the callable proxy exposes an updater and may expose
  // an unwrap method. Keep this narrow to avoid `any` usage in instrumentation.
  type CallableStateWithUpdate<U> = (() => U) & {
    update?: (updater: ((current: U) => Partial<U>) | Partial<U>) => unknown;
    unwrap?: () => U;
    [k: string]: unknown;
  };

  // Instrument the callable state's update method (tree.$.update) when
  // available. Core places update on the callable proxy (`tree.$`), not on
  // the tree root, so we try to instrument the proxy-aware update method.
  try {
    const callableState = (tree as unknown as { $?: unknown }).$ ?? tree;
    // Prefer a previously-stored raw update (set by batching) so we can
    // instrument the actual implementation even when `tree.$` is wrapped.
    const maybeRaw = (callableState as Record<string, unknown>)['__rawUpdate'];
    const maybeOriginalUpdate =
      typeof maybeRaw === 'function'
        ? (maybeRaw as CallableStateWithUpdate<T>['update'])
        : (callableState as CallableStateWithUpdate<T>).update;
    if (typeof maybeOriginalUpdate === 'function') {
      const originalUpdate = maybeOriginalUpdate.bind(
        callableState as CallableStateWithUpdate<T>
      );
      (callableState as CallableStateWithUpdate<T>).update = (
        updater: ((current: T) => Partial<T>) | Partial<T>
      ) => {
        const start =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        const result = (
          originalUpdate as (u: ((c: T) => Partial<T>) | Partial<T>) => unknown
        )(updater as ((current: T) => Partial<T>) | Partial<T>);
        const duration =
          (typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now()) - start;
        try {
          metrics.trackModuleUpdate('core', duration);
        } catch (err) {
          console.debug('devtools: metrics.trackModuleUpdate failed', err);
        }
        if (duration > performanceThreshold) {
          try {
            logger.logPerformanceWarning(
              'core',
              'update',
              duration,
              performanceThreshold
            );
          } catch (err) {
            console.debug('devtools: logger.logPerformanceWarning failed', err);
          }
        }
        if (browserDevTools) {
          try {
            const currentState =
              typeof callableState === 'function'
                ? (callableState as CallableStateWithUpdate<T>)()
                : (tree as unknown as { unwrap?: () => T }).unwrap?.();
            browserDevTools.send('UPDATE', currentState as T);
          } catch (err) {
            console.debug('devtools: browserDevTools.send failed', err);
          }
        }
        return result;
      };
    }
  } catch (err) {
    // best-effort instrumentation
    void err;
  }

  type CallableState<S> = (() => S) & Record<PropertyKey, unknown>;

  const initialStateProxy = tree.$ as unknown as CallableState<T>;

  const stateProxy = new Proxy(initialStateProxy, {
    apply(target: CallableState<T>, thisArg, args) {
      return Reflect.apply(target as CallableState<T>, thisArg, args);
    },
    get(target, prop, receiver) {
      if (prop === 'update') {
        return (updater: ((current: T) => Partial<T>) | Partial<T>) => {
          if (enableLogging && typeof console !== 'undefined') {
            console.debug('[DevTools] Update method called');
          }
          const startTime =
            typeof performance !== 'undefined' && performance.now
              ? performance.now()
              : Date.now();

          const maybeUpdate = Reflect.get(target, 'update');
          const updateFn =
            typeof maybeUpdate === 'function'
              ? (maybeUpdate as (u: unknown) => unknown).bind(target)
              : undefined;

          const result = updateFn ? updateFn(updater) : undefined;

          const duration =
            typeof performance !== 'undefined' && performance.now
              ? performance.now() - startTime
              : Date.now() - startTime;

          const newState = (
            typeof target === 'function'
              ? (target as CallableState<T>)()
              : undefined
          ) as T;

          try {
            metrics.trackModuleUpdate('core', duration);
          } catch (err) {
            console.debug('devtools: metrics.trackModuleUpdate failed', err);
          }

          if (duration > performanceThreshold) {
            try {
              logger.logPerformanceWarning(
                'core',
                'update',
                duration,
                performanceThreshold
              );
            } catch (err) {
              console.debug(
                'devtools: logger.logPerformanceWarning failed',
                err
              );
            }
          }

          if (browserDevTools) {
            try {
              browserDevTools.send('UPDATE', newState as T);
            } catch (err) {
              console.debug('devtools: browserDevTools.send failed', err);
            }
          }

          return result;
        };
      }

      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function')
        return (val as (...a: unknown[]) => unknown).bind(
          target as CallableState<T>
        );
      return val;
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  try {
    (tree as unknown as { $?: unknown }).$ = stateProxy;
  } catch (assignErr) {
    console.debug('devtools: could not replace tree.$ with proxy', assignErr);
  }

  const devToolsInterface: ModularDevToolsInterface<T> = {
    activityTracker,
    logger,
    metrics: metrics.signal,

    trackComposition: (modules: string[]) => {
      compositionHistory.push({ timestamp: new Date(), chain: [...modules] });
      metrics.updateMetrics({ compositionChain: modules });
      logger.logComposition(modules, 'pipe');
    },

    startModuleProfiling: (module: string) => {
      const profileId = `${module}_${Date.now()}`;
      activeProfiles.set(profileId, {
        module,
        operation: 'profile',
        startTime: performance.now(),
      });
      return profileId;
    },

    endModuleProfiling: (profileId: string) => {
      const profile = activeProfiles.get(profileId);
      if (profile) {
        const duration = performance.now() - profile.startTime;
        activityTracker.trackMethodCall(
          profile.module,
          profile.operation,
          duration
        );
        activeProfiles.delete(profileId);
      }
    },

    connectDevTools: (name: string) => {
      if (browserDevTools) {
        browserDevTools.send('@@INIT', tree.$());
        console.log(`\ud83d\udd17 Connected to Redux DevTools as "${name}"`);
      }
    },

    exportDebugSession: () => ({
      metrics: metrics.signal(),
      modules: activityTracker.getAllModules(),
      logs: logger.exportLogs(),
      compositionHistory: [...compositionHistory],
    }),
  };

  return devToolsInterface;
}

export function attachDevToolsSync<T>(
  tree: SignalTree<T>,
  config: {
    enabled?: boolean;
    treeName?: string;
    enableBrowserDevTools?: boolean;
    enableLogging?: boolean;
    performanceThreshold?: number;
  } = {}
): ModularDevToolsInterface<T> {
  const impl = createDevToolsInterface(tree, config);
  try {
    Object.assign(tree, { __devTools: impl });
  } catch (e) {
    // best-effort assignment; swallow errors intentionally
    void e;
  }
  return impl;
}

export async function attachDevTools<T>(
  tree: SignalTree<T>,
  config: {
    enabled?: boolean;
    treeName?: string;
    enableBrowserDevTools?: boolean;
    enableLogging?: boolean;
    performanceThreshold?: number;
  } = {}
): Promise<ModularDevToolsInterface<T>> {
  const impl = createDevToolsInterface(tree, config);
  try {
    Object.assign(tree, { __devTools: impl });
  } catch (e) {
    // best-effort assignment; swallow errors intentionally
    void e;
  }
  return impl;
}
