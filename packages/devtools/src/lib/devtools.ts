import { Signal, signal } from '@angular/core';
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
  /** Total state updates across all modules */
  totalUpdates: number;
  /** Updates per module in the composition chain */
  moduleUpdates: Record<string, number>;
  /** Average execution time per module */
  modulePerformance: Record<string, number>;
  /** Current composition chain order */
  compositionChain: string[];
  /** Signal count after each module enhancement */
  signalGrowth: Record<string, number>;
  /** Memory impact per module */
  memoryDelta: Record<string, number>;
  /** Cache efficiency per module */
  moduleCacheStats: Record<string, { hits: number; misses: number }>;
}

/**
 * Module activity tracker for debugging
 */
export interface ModuleActivityTracker {
  /** Track when a module method is called */
  trackMethodCall: (module: string, method: string, duration: number) => void;
  /** Track module errors */
  trackError: (module: string, error: Error, context?: string) => void;
  /** Get activity summary for a module */
  getModuleActivity: (module: string) => ModuleMetadata | undefined;
  /** Get all tracked modules */
  getAllModules: () => ModuleMetadata[];
}

/**
 * Composition-aware DevTools logger
 */
export interface CompositionLogger {
  /** Log module composition events */
  logComposition: (modules: string[], action: 'with' | 'enhance') => void;
  /** Log method execution with module context */
  logMethodExecution: (
    module: string,
    method: string,
    args: unknown[],
    result: unknown
  ) => void;
  /** Log state changes with composition context */
  logStateChange: (
    module: string,
    path: string,
    oldValue: unknown,
    newValue: unknown
  ) => void;
  /** Log performance warnings for specific modules */
  logPerformanceWarning: (
    module: string,
    operation: string,
    duration: number,
    threshold: number
  ) => void;
  /** Export logs for analysis */
  exportLogs: () => Array<{
    timestamp: Date;
    module: string;
    type: 'composition' | 'method' | 'state' | 'performance';
    data: unknown;
  }>;
}

/**
 * DevTools interface specifically for modular SignalTree
 */
export interface ModularDevToolsInterface<T> {
  /** Activity tracker for all modules */
  activityTracker: ModuleActivityTracker;
  /** Composition-aware logger */
  logger: CompositionLogger;
  /** Real-time performance metrics */
  metrics: Signal<ModularPerformanceMetrics>;
  /** Track module composition */
  trackComposition: (modules: string[]) => void;
  /** Start profiling a specific module */
  startModuleProfiling: (module: string) => string;
  /** End module profiling */
  endModuleProfiling: (profileId: string) => void;
  /** Connect to browser DevTools */
  connectDevTools: (treeName: string) => void;
  /** Export complete debug session */
  exportDebugSession: () => {
    metrics: ModularPerformanceMetrics;
    modules: ModuleMetadata[];
    logs: Array<unknown>;
    compositionHistory: Array<{ timestamp: Date; chain: string[] }>;
  };
}

/**
 * Creates an activity tracker for monitoring module behavior
 */
// The actual heavy implementation has been moved to `devtools.impl.ts`.
// Here we provide a tiny shim that attaches a no-op/minimal devtools
// interface synchronously so consumers get a stable API. If `enabled` is
// truthy we'll asynchronously load the full implementation and replace the
// interface on the tree when ready. This keeps the main bundle small while
// preserving the original public API.

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
    treeName = 'ModularSignalTree',
    enableBrowserDevTools = true,
    // Default to true in tests to provide visible behavior from the noop shim
    enableLogging = true,
    performanceThreshold = 16,
  } = config;

  return (
    tree: SignalTree<T>
  ): SignalTree<T> & { __devTools: ModularDevToolsInterface<T> } => {
    const createNoopInterface = (active: boolean) => {
      // Minimal in-memory state that behaves enough for unit tests until the
      // full implementation is loaded asynchronously.
      const logs: Array<{
        timestamp: Date;
        module: string;
        type: 'composition' | 'method' | 'state' | 'performance';
        data: unknown;
      }> = [];

      const metricsSignal = signal<ModularPerformanceMetrics>({
        totalUpdates: 0,
        moduleUpdates: {} as Record<string, number>,
        modulePerformance: {} as Record<string, number>,
        compositionChain: [] as string[],
        signalGrowth: {} as Record<string, number>,
        memoryDelta: {} as Record<string, number>,
        moduleCacheStats: {} as Record<
          string,
          { hits: number; misses: number }
        >,
      });

      // Only enable logging when both the config and the active flag allow it
      const effectiveEnableLogging = enableLogging && active;

      const activityMap = new Map<string, ModuleMetadata>();
      const compositionHistory: Array<{ timestamp: Date; chain: string[] }> =
        [];

      const tracker = {
        trackMethodCall: (
          module: string,
          _method: string,
          duration: number
        ) => {
          // If the devtools feature is disabled we should be a noop here
          if (!enabled) return undefined as unknown as void;

          const existing = activityMap.get(module) || {
            name: module,
            methods: [],
            addedAt: new Date(),
            lastActivity: new Date(),
            operationCount: 0,
            averageExecutionTime: 0,
            errorCount: 0,
          };

          existing.operationCount++;
          existing.lastActivity = new Date();
          existing.averageExecutionTime =
            (existing.averageExecutionTime * (existing.operationCount - 1) +
              duration) /
            existing.operationCount;
          activityMap.set(module, existing);
          // update metrics only when active (noop when disabled)
          if (active) {
            metricsSignal.update((m) => ({
              ...m,
              totalUpdates: (m.totalUpdates || 0) + 1,
              moduleUpdates: {
                ...(m.moduleUpdates || {}),
                [module]: ((m.moduleUpdates || {})[module] || 0) + 1,
              },
            }));
          }
        },
        trackError: (module: string, error: Error, context?: string) => {
          const existing = activityMap.get(module);
          if (existing) existing.errorCount++;
          console.error(
            '\u274c [' +
              module +
              '] Error' +
              (context ? ` in ${context}` : '') +
              ':',
            error
          );
        },
        getModuleActivity: (module: string) => activityMap.get(module),
        getAllModules: () => Array.from(activityMap.values()),
      };

      const logger = {
        logComposition: (modules: string[], action: 'with' | 'enhance') => {
          logs.push({
            timestamp: new Date(),
            module: 'core',
            type: 'composition',
            data: { modules, action },
          });
          // only mutate metrics when active
          if (active)
            metricsSignal.update((m) => ({ ...m, compositionChain: modules }));
          compositionHistory.push({ timestamp: new Date(), chain: modules });
          if (effectiveEnableLogging && typeof console !== 'undefined') {
            try {
              console.log('Composition ' + action + ':', modules.join(' -> '));
            } catch (err) {
              void err;
            }
          }
        },
        logMethodExecution: (
          module: string,
          method: string,
          args: unknown[],
          result: unknown
        ) => {
          logs.push({
            timestamp: new Date(),
            module,
            type: 'method',
            data: { method, args, result },
          });
          if (effectiveEnableLogging && typeof console !== 'undefined') {
            try {
              console.debug(`[${module}] ${method}`, { args, result });
            } catch (err) {
              void err;
            }
          }
        },
        logStateChange: (
          module: string,
          path: string,
          oldValue: unknown,
          newValue: unknown
        ) => {
          logs.push({
            timestamp: new Date(),
            module,
            type: 'state',
            data: { path, oldValue, newValue },
          });
          if (effectiveEnableLogging && typeof console !== 'undefined') {
            try {
              console.debug(`[${module}] State ${path}:`, {
                from: oldValue,
                to: newValue,
              });
            } catch (err) {
              void err;
            }
          }
        },
        logPerformanceWarning: (
          module: string,
          operation: string,
          duration: number,
          threshold: number
        ) => {
          logs.push({
            timestamp: new Date(),
            module,
            type: 'performance',
            data: { operation, duration, threshold },
          });
          if (effectiveEnableLogging && typeof console !== 'undefined') {
            try {
              console.warn(
                `[${module}] Slow ${operation}: ${duration.toFixed(
                  2
                )}ms (th:${threshold}ms)`
              );
            } catch (err) {
              void err;
            }
          }
        },
        exportLogs: () => [...logs],
      };

      return {
        activityTracker: tracker,
        logger,
        metrics: metricsSignal.asReadonly(),
        trackComposition: (modules: string[]) => {
          logger.logComposition(modules, 'with');
        },
        startModuleProfiling: (module: string) => `${module}_${Date.now()}`,
        endModuleProfiling: (_id: string) => undefined,
        connectDevTools: () => undefined,
        exportDebugSession: () => ({
          metrics: metricsSignal(),
          modules: tracker.getAllModules(),
          logs: logger.exportLogs(),
          compositionHistory,
        }),
      } as ModularDevToolsInterface<T>;
    };

    // Attach the noop interface synchronously so callers can read `.__devTools`
    // immediately. The noop interface is non-mutating when `enabled` is false.
    Object.assign(tree, { __devTools: createNoopInterface(enabled) });

    // Register cleanup with the core registry so we remove any global hooks
    // and reset the devtools interface when the tree is destroyed.
    try {
      const register = (
        tree as unknown as {
          __registerCleanup?: (fn: () => void) => void;
        }
      ).__registerCleanup;
      if (typeof register === 'function') {
        register(() => {
          try {
            const g = globalThis as unknown as Record<string, unknown>;
            if (g && '__signaltree_devtools_track' in g) {
              try {
                Reflect.deleteProperty(
                  g as Record<string, unknown>,
                  '__signaltree_devtools_track'
                );
              } catch {
                // best-effort: fallback to undefined using safe index access
                try {
                  (g as Record<string, unknown>)[
                    '__signaltree_devtools_track'
                  ] = undefined;
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore
          }

          try {
            // Reset the devtools interface on the tree to a disabled noop
            Object.assign(tree, { __devTools: createNoopInterface(false) });
          } catch {
            // ignore
          }
        });
      }
    } catch {
      // ignore
    }

    // When enabled, instrument the tree's update/set methods so the noop
    // interface reflects immediate metrics updates without loading the heavy
    // implementation. Do not introduce test-only checks; behavior is driven
    // solely by the `enabled` flag.
    if (enabled) {
      try {
        type CallableStateWithUpdate = (() => T) & {
          update?: (
            updaterOrPartial: ((current: T) => Partial<T>) | Partial<T>
          ) => unknown;
          set?: (p: Partial<T>) => unknown;
          [k: string]: unknown;
        };

        const dev = (
          tree as unknown as {
            __devTools?: ModularDevToolsInterface<T>;
          }
        ).__devTools;
        const signalRoot = (tree as unknown as { $?: CallableStateWithUpdate })
          .$;

        if (signalRoot && typeof signalRoot.update === 'function') {
          const origUpdate = signalRoot.update.bind(signalRoot) as (
            u: ((current: T) => Partial<T>) | Partial<T>
          ) => unknown;
          signalRoot.update = function (
            fn: ((current: T) => Partial<T>) | Partial<T>
          ) {
            const start = Date.now();
            const res = origUpdate(fn);
            try {
              dev?.activityTracker?.trackMethodCall(
                'core',
                'update',
                Date.now() - start
              );
            } catch {
              // ignore
            }
            return res;
          };
        }

        if (signalRoot && typeof signalRoot.set === 'function') {
          const origSet = signalRoot.set.bind(signalRoot) as (
            v: Partial<T>
          ) => unknown;
          signalRoot.set = function (value: Partial<T>) {
            const res = origSet(value);
            try {
              dev?.activityTracker?.trackMethodCall('core', 'set', 0);
            } catch {
              // ignore
            }
            return res;
          };
        }
      } catch {
        // instrumentation is best-effort; do not fail tree creation
      }
    }

    if (enabled) {
      // Install a lightweight synchronous wrapper around tree.$.update so
      // tests that call update immediately see metrics increments and
      // performance warnings before the heavy devtools implementation is
      // loaded asynchronously. This wrapper is safe to leave in place; the
      // full implementation will replace the devtools interface and the
      // attached proxy when it loads.
      try {
        type CallableStateWithUpdate = (() => T) & {
          update?: (
            updaterOrPartial: ((current: T) => Partial<T>) | Partial<T>
          ) => unknown;
          unwrap?: () => T;
          [k: string]: unknown;
        };

        const stateAny = (tree as unknown as { $?: CallableStateWithUpdate }).$;
        if (stateAny && typeof stateAny.update === 'function') {
          const originalUpdate = stateAny.update.bind(stateAny) as (
            u: ((current: T) => Partial<T>) | Partial<T>
          ) => unknown;
          stateAny.update = (
            updater: ((current: T) => Partial<T>) | Partial<T>
          ) => {
            const start =
              typeof performance !== 'undefined' && performance.now
                ? performance.now()
                : Date.now();

            const result = originalUpdate(updater);

            const duration =
              typeof performance !== 'undefined' && performance.now
                ? performance.now() - start
                : Date.now() - start;

            try {
              // Inform the noop activity tracker which will update the
              // in-memory metrics signal created above.
              const dev = (
                tree as unknown as {
                  __devTools?: ModularDevToolsInterface<T>;
                }
              ).__devTools;
              dev?.activityTracker?.trackMethodCall('core', 'update', duration);

              if (duration > performanceThreshold) {
                dev?.logger?.logPerformanceWarning(
                  'core',
                  'update',
                  duration,
                  performanceThreshold
                );
              }
            } catch (err) {
              void err;
            }

            return result;
          };
        }
      } catch (err) {
        void err;
      }

      // Fire-and-forget: load heavy impl asynchronously.
      (async () => {
        try {
          let mod: any;
          try {
            mod = await import('@signaltree/devtools-impl');
          } catch (e) {
            // Fallback to local impl during build or when devtools-impl isn't installed
            mod = await import('./devtools.impl');
          }
          const real = await mod.attachDevTools(tree, {
            enabled,
            treeName,
            enableBrowserDevTools,
            enableLogging,
            performanceThreshold,
          });
          Object.assign(tree, { __devTools: real });
        } catch (err) {
          console.debug('devtools: failed to load implementation', err);
        }
      })();
    }

    return tree as SignalTree<T> & { __devTools: ModularDevToolsInterface<T> };
  };
}

/**
 * Simple devtools for development
 */
export function enableDevTools<T>(treeName = 'SignalTree') {
  return withDevTools<T>({ treeName, enabled: true });
}

/**
 * Full-featured devtools for intensive debugging
 */
export function withFullDevTools<T>(treeName = 'SignalTree') {
  return withDevTools<T>({
    treeName,
    enabled: true,
    enableBrowserDevTools: true,
    enableLogging: true,
    performanceThreshold: 10,
  });
}

/**
 * Lightweight devtools for production
 */
export function withProductionDevTools<T>() {
  return withDevTools<T>({
    enabled: true,
    enableBrowserDevTools: false,
    enableLogging: false,
    performanceThreshold: 50,
  });
}

// Provide wrapper accessors for the full implementation so bundles that
// import the compact shim don't statically pull the heavy implementation.
// `attachDevTools` is asynchronous and will dynamic import the heavy module.
// `attachDevToolsSync` is provided for Node-based tests and will `require`
// the module at call-time (best-effort synchronous access).
export function attachDevToolsSync<T>(
  tree: import('@signaltree/core').SignalTree<T>,
  config?: Record<string, unknown>
) {
  try {
    // Prefer the published package if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@signaltree/devtools-impl');
    return mod.attachDevToolsSync(tree, config);
  } catch (e) {
    // Fallback to local implementation during build/tests
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./devtools.impl');
    return mod.attachDevToolsSync(tree, config);
  }
}

export async function attachDevTools<T>(
  tree: import('@signaltree/core').SignalTree<T>,
  config?: Record<string, unknown>
) {
  try {
    return (await import('@signaltree/devtools-impl')).attachDevTools(
      tree,
      config
    );
  } catch (e) {
    return (await import('./devtools.impl')).attachDevTools(tree, config);
  }
}
