/**
 * `@signal-tree/solid` provides Solid-native accessors over kernel-owned state.
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
  type TreeNodeOf,
} from '@signal-tree/kernel/adapter';

import {
  prepareConstructionInput,
  type FrameworkSignalTreeFactory,
} from './lib/construction-input.js';

import { createSolidObservationAdapter } from './lib/solid-observation.js';

/** Construct a SignalTree whose leaves are native Solid accessors. */
export const signalTree = ((initialState: object, config?: unknown) =>
  (
    createSignalTreeFactory(createSolidObservationAdapter()) as (
      state: object,
      options?: unknown
    ) => unknown
  )(
    prepareConstructionInput(initialState),
    config
  )) as FrameworkSignalTreeFactory;

export type TreeNode<T> = TreeNodeOf<T, 'solid'>;
export type WritableLeaf<T> = LeafOf<T, 'solid'>;
export type AccessibleNode<T> = AccessibleNodeOf<T, 'solid'>;
export type ISignalTree<T, TAccum = TreeNode<T>> = ISignalTreeOf<
  T,
  'solid',
  TAccum
>;
export type SignalTree<T> = ISignalTree<T>;
export type EntityNode<E> = EntityNodeOf<E, 'solid'>;
export type EntitySignal<
  E,
  K extends string | number = string
> = EntitySignalOf<E, K, 'solid'>;
export type EntitySignalWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> = EntitySignalWithSlicesOf<E, K, Slices, 'solid'>;
export type ReadonlyView<T> = ReadonlyViewOf<T, 'solid'>;
export type ReadonlyStore<
  TSource,
  TAccum = TreeNode<TSource>
> = ReadonlyStoreOf<TSource, TAccum, 'solid'>;

export const asReadonly = kernelAsReadonly as <TSource, TAccum>(
  tree: ISignalTreeOf<TSource, 'solid', TAccum>
) => ReadonlyStoreOf<TSource, TAccum, 'solid'>;

export * from '@signal-tree/kernel';
