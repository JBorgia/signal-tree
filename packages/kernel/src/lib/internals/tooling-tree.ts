import type { CarrierKind, ISignalTreeOf } from '../types';

/**
 * Tree admission preserves the factory's accumulated surface and carrier.
 * Preserve construction's accumulated surface: T alone has already unwrapped
 * leaf() definitions and cannot reconstruct their terminal boundaries.
 * Public carriers may hide internal callable syntax (Vue presents a ref).
 * The observation adapter still supplies a ReadableCell to the kernel, so
 * internal lifecycle reads may recover that callable type without a wrapper.
 */
export type ToolingTree<T, TAccum = unknown> = ISignalTreeOf<
  T,
  CarrierKind,
  TAccum
>;
