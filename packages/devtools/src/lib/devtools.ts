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
  logComposition: (modules: string[], action: 'pipe' | 'enhance') => void;
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

export function withDevTools(
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
    const createNoopInterface = () => {
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
          // update metrics
          metricsSignal.update((m) => ({
            ...m,
            totalUpdates: (m.totalUpdates || 0) + 1,
            moduleUpdates: {
              ...(m.moduleUpdates || {}),
              [module]: ((m.moduleUpdates || {})[module] || 0) + 1,
            },
          }));
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
        logComposition: (modules: string[], action: 'pipe' | 'enhance') => {
          logs.push({
            timestamp: new Date(),
            module: 'core',
            type: 'composition',
            data: { modules, action },
          });
          metricsSignal.update((m) => ({ ...m, compositionChain: modules }));
          compositionHistory.push({ timestamp: new Date(), chain: modules });
          if (enableLogging && typeof console !== 'undefined')
            console.log(
              '\ud83d\udd17 Composition ' + action + ':',
              modules.join(' \u2192 ')
            );
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
          if (enableLogging && typeof console !== 'undefined')
            console.debug(`\ud83d\udd27 [${module}] ${method}`, {
              args,
              result,
            });
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
          if (enableLogging && typeof console !== 'undefined')
            console.debug(`\ud83d\udcdd [${module}] State change at ${path}:`, {
              from: oldValue,
              to: newValue,
            });
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
          if (enableLogging && typeof console !== 'undefined')
            console.warn(
              `\u26a0\ufe0f [${module}] Slow ${operation}: ${duration.toFixed(
                2
              )}ms (threshold: ${threshold}ms)`
            );
        },
        exportLogs: () => [...logs],
      };

      return {
        activityTracker: tracker,
        logger,
        metrics: metricsSignal.asReadonly(),
        trackComposition: (modules: string[]) => {
          logger.logComposition(modules, 'pipe');
        },
        startModuleProfiling: (module: string) => `${module}_${Date.now()}`,
        endModuleProfiling: () => undefined,
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
    // immediately. If enabled, attempt to load the full impl in the
    // background and replace the interface when ready.
    Object.assign(tree, { __devTools: createNoopInterface() });

    if (enabled) {
      // Install a lightweight synchronous wrapper around tree.$.update so
      // tests that call update immediately see metrics increments and
      // performance warnings before the heavy devtools implementation is
      // loaded asynchronously. This wrapper is safe to leave in place; the
      // full implementation will replace the devtools interface and the
      // attached proxy when it loads.
      try {
        const stateAny = (
          tree as unknown as { $?: { update?: (updater?: unknown) => unknown } }
        )['$'];
        if (stateAny && typeof stateAny.update === 'function') {
          const originalUpdate = stateAny.update.bind(stateAny);
          stateAny.update = (updater: unknown) => {
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
              (
                tree as unknown as Record<string, unknown>
              ).__devTools?.activityTracker?.trackMethodCall(
                'core',
                'update',
                duration
              );

              if (duration > performanceThreshold) {
                (
                  tree as unknown as Record<string, unknown>
                ).__devTools?.logger?.logPerformanceWarning(
                  'core',
                  'update',
                  duration,
                  performanceThreshold
                );
              }
            } catch {
              /* ignore errors from devtools shim */
            }

            return result;
          };
        }
      } catch {
        /* ignore failures installing synchronous update wrapper */
      }

      // Fire-and-forget: load heavy impl asynchronously.
      (async () => {
        try {
          const mod = await import('./devtools.impl');
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
