export type LazyFactory = <T extends object>(
  obj: T,
  equalityFn: (a: unknown, b: unknown) => boolean,
  basePath?: string
) => unknown;

let registered: LazyFactory | null = null;

export function registerLazyFactory(fn: LazyFactory) {
  registered = fn;
  try {
    // Also expose on globalThis for consumers that don't want to import the package
    (globalThis as any).__signaltree_lazy_factory__ = fn;
  } catch (e) {
    void e;
  }
}

export function getLazyFactory(): LazyFactory | null {
  return registered;
}
