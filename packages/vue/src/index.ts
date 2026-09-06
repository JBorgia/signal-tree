/**
 * `@signal-tree/vue` provides Vue-native refs over kernel-owned state.
 *
 * Values, writes, equality, and causal semantics remain kernel-owned.
 *
 * @packageDocumentation
 */
import './lib/carrier.js';
import { asReadonly as kernelAsReadonly } from '@signal-tree/kernel';
import {
  createSignalTreeFactory,
  type AccessibleNodeOf,
  type EntityNodeOf,
  type EntitySignalOf,
  type EntitySignalWithSlicesOf,
  type ISignalTreeOf,
  type LeafOf,
  type ReadonlyStoreOf,
  type ReadonlyViewOf,
  type SignalTreeFactoryOf,
  type TreeNodeOf,
} from '@signal-tree/kernel/adapter';

import { createVueObservationAdapter } from './lib/vue-observation.js';

/** Construct a SignalTree whose leaves are native Vue refs. */
export const signalTree = ((initialState: object, config?: unknown) =>
  (
    createSignalTreeFactory(createVueObservationAdapter()) as (
      state: object,
      options?: unknown
    ) => unknown
  )(initialState, config)) as SignalTreeFactoryOf<'vue'>;

export type TreeNode<T> = TreeNodeOf<T, 'vue'>;
export type WritableLeaf<T> = LeafOf<T, 'vue'>;
export type AccessibleNode<T> = AccessibleNodeOf<T, 'vue'>;
export type ISignalTree<T, TAccum = TreeNode<T>> = ISignalTreeOf<
  T,
  'vue',
  TAccum
>;
export type SignalTree<T> = ISignalTree<T>;
export type EntityNode<E> = EntityNodeOf<E, 'vue'>;
export type EntitySignal<
  E,
  K extends string | number = string
> = EntitySignalOf<E, K, 'vue'>;
export type EntitySignalWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> = EntitySignalWithSlicesOf<E, K, Slices, 'vue'>;
export type ReadonlyView<T> = ReadonlyViewOf<T, 'vue'>;
export type ReadonlyStore<
  TSource,
  TAccum = TreeNode<TSource>
> = ReadonlyStoreOf<TSource, TAccum, 'vue'>;

export const asReadonly = kernelAsReadonly as <TSource, TAccum>(
  tree: ISignalTreeOf<TSource, 'vue', TAccum>
) => ReadonlyStoreOf<TSource, TAccum, 'vue'>;

export * from '@signal-tree/kernel';
