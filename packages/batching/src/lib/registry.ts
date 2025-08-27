export type BatchingFactory = <T>(...args: any[]) => any;

export function registerBatchingFactory(fn: BatchingFactory) {
  try {
    (globalThis as any).__signaltree_batching_factory__ = fn;
  } catch (err) {
    void err;
  }
}

export function getBatchingFactory(): BatchingFactory | undefined {
  try {
    return (globalThis as any).__signaltree_batching_factory__;
  } catch (err) {
    void err;
  }
  return undefined;
}
