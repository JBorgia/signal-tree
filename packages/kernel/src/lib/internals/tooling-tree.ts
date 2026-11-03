import type { CarrierKind, ISignalTreeOf } from '../types';

/**
 * Tree admission for the `/internals` tooling readers.
 *
 * Admission preserves the factory's accumulated surface (`TAccum`) and its
 * carrier (`C`). `T` alone has already unwrapped `leaf()` definitions and
 * cannot reconstruct their terminal boundaries, so a reader must never be
 * declared as `ISignalTree<T>` (which re-derives `TreeNode<T>` from `T`) or
 * weakened to `object`/`any`.
 *
 * The parameter order is v16's `<T, C, TAccum>`, unchanged from the existing
 * helpers, so explicit `<T>` and `<T, C>` callers keep compiling. Public
 * carriers may hide internal callable syntax (Vue presents a ref); the
 * observation adapter still supplies a ReadableCell to the kernel, so internal
 * lifecycle reads may recover that callable type without a wrapper.
 */
export type ToolingTree<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
> = ISignalTreeOf<T, C, TAccum>;

/** Destruction as the kernel sees it, whatever carrier the facade presents. */
export function isToolingTreeDestroyed(tree: {
  readonly destroyed: unknown;
}): boolean {
  return (tree.destroyed as () => boolean)() === true;
}
