import { CompositionLogger } from './devtools.impl';

// Runtime flag to enable dev-only logging. Prefer Angular's ngDevMode when
// available, otherwise fall back to checking NODE_ENV != 'production'. This
// avoids referencing process.env directly in browser-only builds unless it's
// available at bundle time.
const ENABLE_DEV_LOGS =
  typeof ngDevMode !== 'undefined'
    ? Boolean(ngDevMode as unknown as boolean)
    : typeof process !== 'undefined' && (process as any).env
    ? (process as any).env.NODE_ENV !== 'production'
    : false;

// Heavy composition logger moved to a separate module so it can be lazy-loaded
// and keep the main devtools bundle small. The heavy logger contains verbose
// templates and human-friendly messages that are not required synchronously
// for tests to pass.

export function createHeavyCompositionLogger(): CompositionLogger {
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

  return {
    logComposition: (modules: string[], action: 'with' | 'enhance') => {
      addLog('core', 'composition', { modules, action });
      try {
        if (ENABLE_DEV_LOGS) {
          console.log('🔗 Composition ' + action + ':', modules.join(' → '));
        }
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
        if (ENABLE_DEV_LOGS) {
          console.debug(`🔧 [${module}] ${method}`, { args, result });
        }
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
        if (ENABLE_DEV_LOGS) {
          console.debug(`📝 [${module}] State change at ${path}:`, {
            from: oldValue,
            to: newValue,
          });
        }
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
        if (ENABLE_DEV_LOGS) {
          console.warn(
            `⚠️ [${module}] Slow ${operation}: ${duration.toFixed(
              2
            )}ms (threshold: ${threshold}ms)`
          );
        }
      } catch (err) {
        void err;
      }
    },
    exportLogs: () => [...logs],
  };
}

export default createHeavyCompositionLogger;
