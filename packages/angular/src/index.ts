/** Angular observation plus the complete SignalTree application surface. */
import './lib/carrier.js';
import { ANGULAR_OBSERVATION_ADAPTER } from './lib/observation-adapter.js';
import { createSignalTreeFactory } from '@signal-tree/kernel/adapter';
import { asReadonly as kernelAsReadonly } from '@signal-tree/kernel';
import type {
  EntityNodeOf,
  EntitySignalOf,
  ISignalTreeOf,
  LeafOf,
  ReadonlyStoreOf,
  ReadonlyViewOf,
  SignalTreeFactoryOf,
  TreeNodeOf,
} from '@signal-tree/kernel/adapter';

export const signalTree =
  createSignalTreeFactory(
    ANGULAR_OBSERVATION_ADAPTER
  ) as unknown as SignalTreeFactoryOf<'angular'>;

export type TreeNode<T> = TreeNodeOf<T, 'angular'>;
export type WritableLeaf<T> = LeafOf<T, 'angular'>;
export type ISignalTree<T, TAccum = TreeNode<T>> = ISignalTreeOf<
  T,
  'angular',
  TAccum
>;
export type SignalTree<T> = ISignalTree<T>;
export type EntityNode<E> = EntityNodeOf<E, 'angular'>;
export type EntitySignal<
  E,
  K extends string | number = string
> = EntitySignalOf<E, K, 'angular'>;
export type ReadonlyView<T> = ReadonlyViewOf<T, 'angular'>;
export type ReadonlyStore<
  TSource,
  TAccum = TreeNode<TSource>
> = ReadonlyStoreOf<TSource, TAccum, 'angular'>;

export const asReadonly = kernelAsReadonly as <TSource, TAccum>(
  tree: ISignalTreeOf<TSource, 'angular', TAccum>
) => ReadonlyStoreOf<TSource, TAccum, 'angular'>;

export * from '@signal-tree/kernel';

// Angular-owned API, which the kernel deliberately does not export.
export { defineStore, type DefineStoreConfig } from './lib/define-store.js';
export { toWritableSignal } from './lib/to-writable-signal.js';
