import { Signal, signal, isSignal, WritableSignal } from '@angular/core';
import { unwrap } from '@signaltree/core';
import type { DeepSignalify, SignalTree } from '@signaltree/core';

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

/**
 * Module activity tracker for debugging
 */
export interface ModuleActivityTracker {
  trackMethodCall: (module: string, method: string, duration: number) => void;
  trackError: (module: string, error: Error, context?: string) => void;
  getModuleActivity: (module: string) => ModuleMetadata | undefined;
  getAllModules: () => ModuleMetadata[];
}

/**
 * Composition-aware DevTools logger
 */
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

/**
 * DevTools interface
 */
export interface ModularDevToolsInterface<T> {
  readonly __t?: T;
  activityTracker: ModuleActivityTracker;
  logger: CompositionLogger;
  metrics: Signal<ModularPerformanceMetrics>;
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
  cleanup: () => void;
}

function createDefaultMetrics(): ModularPerformanceMetrics {
  return {
    totalUpdates: 0,
    moduleUpdates: {},
    modulePerformance: {},
    compositionChain: [],
    signalGrowth: {},
    memoryDelta: {},
    moduleCacheStats: {},
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
        if (!existing.methods.includes(method)) {
          existing.methods.push(method);
        }
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
      if (existing) {
        existing.errorCount++;
      }
      console.error(
        `❌ [${module}] Error${context ? ` in ${context}` : ''}:`,
        error
      );
    },

    getModuleActivity: (module: string) => modules.get(module),
    getAllModules: () => Array.from(modules.values()),
  };
}

function createCompositionLogger(enableLogging = true): CompositionLogger {
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
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
  };

  return {
    logComposition: (modules: string[], action: 'pipe' | 'enhance') => {
      addLog('core', 'composition', { modules, action });
      if (enableLogging) {
        console.log('🔗 Composition pipe:', modules.join(' → '));
      }
    },

    logMethodExecution: (
      module: string,
      method: string,
      args: unknown[],
      result: unknown
    ) => {
      addLog(module, 'method', { method, args, result });
    },

    logStateChange: (
      module: string,
      path: string,
      oldValue: unknown,
      newValue: unknown
    ) => {
      addLog(module, 'state', { path, oldValue, newValue });
    },

    logPerformanceWarning: (
      module: string,
      operation: string,
      duration: number,
      threshold: number
    ) => {
      addLog(module, 'performance', { operation, duration, threshold });
      if (enableLogging) {
        console.warn(
          `⚠️ [${module}] Slow ${operation}: ${duration.toFixed(
            2
          )}ms (threshold: ${threshold}ms)`
        );
      }
    },

    exportLogs: () => [...logs],
  };
}

function createModularMetrics() {
  const metricsSignal = signal<ModularPerformanceMetrics>(
    createDefaultMetrics()
  );

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
        modulePerformance: {
          ...current.modulePerformance,
          [module]: duration,
        },
      }));
    },
  };
}

/**
 * Enhances a SignalTree with DevTools for v2.0 architecture
 * Properly tracks updates at all levels using recursive proxying
 */
export function withDevTools<T>(
  config: {
    enabled?: boolean;
    treeName?: string;
    enableBrowserDevTools?: boolean;
    enableLogging?: boolean;
    performanceThreshold?: number;
  } = {}
) {
  const {
    enabled = true,
    treeName = 'SignalTree',
    enableBrowserDevTools = true,
    enableLogging = true,
    performanceThreshold = 16,
  } = config;

  return (
    tree: SignalTree<T>
  ): SignalTree<T> & { __devTools: ModularDevToolsInterface<T> } => {
    if (!enabled) {
      // Return no-op implementation
      const noop: ModularDevToolsInterface<T> = {
        activityTracker: {
          trackMethodCall: () => {
            // No-op when disabled
          },
          trackError: () => {
            // No-op when disabled
          },
          getModuleActivity: () => undefined,
          getAllModules: () => [],
        },
        logger: {
          logComposition: () => {
            // No-op when disabled
          },
          logMethodExecution: () => {
            // No-op when disabled
          },
          logStateChange: () => {
            // No-op when disabled
          },
          logPerformanceWarning: () => {
            // No-op when disabled
          },
          exportLogs: () => [],
        },
        metrics: signal(createDefaultMetrics()).asReadonly(),
        trackComposition: () => {
          // No-op when disabled
        },
        startModuleProfiling: () => '',
        endModuleProfiling: () => {
          // No-op when disabled
        },
        connectDevTools: () => {
          // No-op when disabled
        },
        exportDebugSession: () => ({
          metrics: createDefaultMetrics(),
          modules: [],
          logs: [],
          compositionHistory: [],
        }),
        cleanup: () => {
          // No-op when disabled
        },
      };
      return Object.assign(tree, { __devTools: noop });
    }

    // Create devtools components
    const activityTracker = createActivityTracker();
    const logger = createCompositionLogger(enableLogging);
    const metrics = createModularMetrics();
    const compositionHistory: Array<{ timestamp: Date; chain: string[] }> = [];
    const activeProfiles = new Map<
      string,
      { module: string; operation: string; startTime: number }
    >();

    // Track proxies to prevent duplicates
    const proxyCache = new WeakMap<object, unknown>();

    // Track wrapped signals for cleanup
    const wrappedSignals = new Map<WritableSignal<unknown>, () => void>();

    // Browser DevTools connection
    let browserDevTools: { send: (action: string, state: T) => void } | null =
      null;
    if (
      enableBrowserDevTools &&
      typeof window !== 'undefined' &&
      '__REDUX_DEVTOOLS_EXTENSION__' in window
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const devToolsExt = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
        const connection = devToolsExt.connect({
          name: treeName,
          features: { dispatch: true, jump: true, skip: true },
        });
        browserDevTools = {
          send: (action: string, state: T) => connection.send(action, state),
        };
      } catch (error) {
        console.warn('Failed to connect to Redux DevTools:', error);
      }
    }

    /**
     * Wrap a signal to track its updates without modifying it directly
     */
    function wrapSignal(
      signal: WritableSignal<unknown>,
      path: string
    ): WritableSignal<unknown> {
      // Check if already wrapped
      if (wrappedSignals.has(signal)) {
        return signal;
      }

      // Create a proxy for the signal
      const proxy = new Proxy(signal, {
        apply(target, thisArg, args) {
          // For when the signal is called as a function (reading)
          return Reflect.apply(target, thisArg, args);
        },
        get(target, prop) {
          if (prop === 'set') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (value: any) {
              const start = performance.now();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const beforeValue = (target as any)();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const result = (target as any).set.call(target, value);
              const duration = performance.now() - start;

              metrics.trackModuleUpdate('core', duration);
              logger.logStateChange('core', path, beforeValue, value);

              if (duration > performanceThreshold) {
                logger.logPerformanceWarning(
                  'core',
                  `signal.set:${path}`,
                  duration,
                  performanceThreshold
                );
              }

              if (browserDevTools) {
                browserDevTools.send(`SIGNAL_SET ${path}`, unwrap(tree.$));
              }

              return result;
            };
          }
          return Reflect.get(target, prop);
        },
      });

      // Store for cleanup
      wrappedSignals.set(signal, () => {
        // Cleanup logic if needed
      });

      return proxy as WritableSignal<unknown>;
    }

    /**
     * Create DevTools proxy that tracks all updates in v2.0 architecture
     * Recursively wraps all branch nodes to intercept their methods
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function createDevToolsProxy(target: any, path = ''): any {
      // Check cache first
      if (proxyCache.has(target)) {
        return proxyCache.get(target);
      }

      // Handle signals - wrap them without modifying
      if (isSignal(target)) {
        const wrapped = wrapSignal(target as WritableSignal<unknown>, path);
        proxyCache.set(target, wrapped);
        return wrapped;
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
            return function (update: any) {
              const start = performance.now();
              const beforeState =
                path === '' ? unwrap(tree.$) : unwrapBranch(obj);
              const result = value.call(obj, update);
              const duration = performance.now() - start;

              const actionPath = path || 'root';
              activityTracker.trackMethodCall('core', 'set', duration);
              metrics.trackModuleUpdate('core', duration);
              logger.logStateChange('core', actionPath, beforeState, update);

              if (duration > performanceThreshold) {
                logger.logPerformanceWarning(
                  'core',
                  `set:${actionPath}`,
                  duration,
                  performanceThreshold
                );
              }

              if (browserDevTools) {
                browserDevTools.send(`SET ${actionPath}`, unwrap(tree.$));
              }

              return result;
            };
          }

          // Intercept 'update' method on branch nodes
          if (prop === 'update' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (updater: any) {
              const start = performance.now();
              const result = value.call(obj, updater);
              const duration = performance.now() - start;

              const actionPath = path || 'root';
              activityTracker.trackMethodCall('core', 'update', duration);
              metrics.trackModuleUpdate('core', duration);

              if (duration > performanceThreshold) {
                logger.logPerformanceWarning(
                  'core',
                  `update:${actionPath}`,
                  duration,
                  performanceThreshold
                );
              }

              if (browserDevTools) {
                browserDevTools.send(`UPDATE ${actionPath}`, unwrap(tree.$));
              }

              return result;
            };
          }

          // Recursively proxy nested objects (but not signals)
          if (value && typeof value === 'object') {
            const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
            return createDevToolsProxy(value, nestedPath);
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
          result[key] = (value as Signal<unknown>)();
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
    tree.$ = createDevToolsProxy(originalState) as DeepSignalify<T>;
    tree.state = tree.$;

    // Create the devtools interface
    const devToolsInterface: ModularDevToolsInterface<T> = {
      activityTracker,
      logger,
      metrics: metrics.signal,
      trackComposition: (modules: string[]) => {
        compositionHistory.push({
          timestamp: new Date(),
          chain: [...modules],
        });
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
      connectDevTools: () => {
        if (browserDevTools) {
          browserDevTools.send('@@INIT', unwrap(tree.$));
        }
      },
      exportDebugSession: () => ({
        metrics: metrics.signal(),
        modules: activityTracker.getAllModules(),
        logs: logger.exportLogs(),
        compositionHistory: [...compositionHistory],
      }),
      cleanup: () => {
        // Cleanup wrapped signals
        wrappedSignals.clear();
        proxyCache.delete(originalState);
      },
    };

    return Object.assign(tree, { __devTools: devToolsInterface });
  };
}

/**
 * Convenience functions
 */
export function enableDevTools<T>(treeName = 'SignalTree') {
  return withDevTools<T>({ treeName, enabled: true });
}

export function withFullDevTools<T>(treeName = 'SignalTree') {
  return withDevTools<T>({
    treeName,
    enabled: true,
    enableBrowserDevTools: true,
    enableLogging: true,
    performanceThreshold: 10,
  });
}

export function withProductionDevTools<T>() {
  return withDevTools<T>({
    enabled: true,
    enableBrowserDevTools: false,
    enableLogging: false,
    performanceThreshold: 50,
  });
}
