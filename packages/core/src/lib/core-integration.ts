import { BatchingEngine } from './batching-engine';
import { ComputedSignalsEngine } from './computed-engine';
import { SignalTreeDiagnostics } from './diagnostics';
import { EnhancerManager } from './enhancer-lifecycle';
import { SignalMemoryManager } from './memory-manager';
import { SecurityValidator } from './security-validator';

/**
 * Integration point for all enhancements
 */

export function createEnhancedSignalTree<T>(data: T, config: any = {}): any {
  // Core security and memory
  const memoryManager = config.useLazy
    ? new (SignalMemoryManager as any)()
    : undefined;
  const security = new (SecurityValidator as any)(config.security);
  const diagnostics = new SignalTreeDiagnostics(config.diagnostics);

  // Validate input
  const validation = (security as any).validateObject
    ? (security as any).validateObject(data)
    : { isValid: true, data };
  if (!validation.isValid && config.security?.mode === 'strict') {
    throw new Error('Input validation failed');
  }

  // Create base tree (would use actual signalTree function)
  const createBaseTree =
    (globalThis as any).createBaseTree ||
    ((d: any, _cfg: any) => ({ $: d, state: d, config: _cfg }));
  const tree = createBaseTree(validation.data, {
    ...config,
    memoryManager,
  });

  // Add batching
  if (config.batching !== false) {
    const batcher = new (BatchingEngine as any)(config.batching);
    // naive wrapper
    (tree as any).__batcher = batcher;
  }

  // Add computed
  if (config.computed) {
    const computedEngine = new ComputedSignalsEngine();
    (tree as any).computed = computedEngine.createMany(config.computed as any);
  }

  // Add diagnostics
  (tree as any).diagnostics = diagnostics;

  // Apply modular enhancers
  if (config.enhancers) {
    const manager = new EnhancerManager();
    // Register built-in enhancers (if any provided via config)
    // registerBuiltInEnhancers(manager); // left as an integration step
    return manager.apply(tree, config.enhancers);
  }

  // Add disposal
  if (memoryManager) {
    (tree as any).dispose = () =>
      (memoryManager as any).dispose && (memoryManager as any).dispose();
  }

  return tree;
}
