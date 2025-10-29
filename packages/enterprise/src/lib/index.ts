/**
 * SignalTree Enterprise Features
 * Separate package for large-scale applications
 */

export { OptimizedUpdateEngine } from './update-engine';
export { PathIndex } from './path-index';
export { DiffEngine } from './diff-engine';

export interface EnterpriseConfig {
  enablePathIndex?: boolean;
  enableDiffing?: boolean;
  enableMetrics?: boolean;
  maxTreeSize?: number;
}

export function withEnterprise(config: EnterpriseConfig = {}) {
  return (tree: any) => {
    if (config.enablePathIndex) {
      const pathIndex = new (require('./path-index').PathIndex)();
      // try to build from tree
      try {
        pathIndex.buildFromTree((tree as any).$);
      } catch {}
      (tree as any).pathIndex = pathIndex;
    }

    if (config.enableDiffing) {
      const UpdateEngine = require('./update-engine').OptimizedUpdateEngine;
      const updateEngine = new UpdateEngine((tree as any).$);
      (tree as any).updateOptimized = (updates: any) =>
        updateEngine.update((tree as any).$, updates);
    }

    if (config.enableMetrics) {
      (tree as any).getMetrics = () => ({
        signalCount: (tree as any).pathIndex?.getStats?.().cacheSize || 0,
        updateCount: 0,
        memoryUsage:
          (process &&
            (process as any).memoryUsage &&
            (process as any).memoryUsage()) ||
          {},
      });
    }

    return tree;
  };
}
