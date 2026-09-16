/** Angular observation plus the complete SignalTree application surface. */
import './lib/carrier.js';
import { ANGULAR_OBSERVATION_ADAPTER } from './lib/observation-adapter.js';
import { createSignalTreeFactory } from '@signal-tree/kernel/adapter';
import { asReadonly as kernelAsReadonly } from '@signal-tree/kernel';
import type {
  AccessibleNodeOf,
  EntityNodeOf,
  EntitySignalOf,
  EntitySignalWithSlicesOf,
  ISignalTreeOf,
  LeafOf,
  ReadonlyStoreOf,
  ReadonlyViewOf,
  TreeNodeOf,
} from '@signal-tree/kernel/adapter';

import {
  prepareConstructionInput,
  type FrameworkSignalTreeFactory,
} from './lib/construction-input.js';

const createAngularTree = createSignalTreeFactory(
  ANGULAR_OBSERVATION_ADAPTER
) as (state: object, config?: unknown) => unknown;

/** Construct native Angular leaves from values; external signals require leaf(). */
export const signalTree = ((initialState: object, config?: unknown) =>
  createAngularTree(
    prepareConstructionInput(initialState),
    config
  )) as FrameworkSignalTreeFactory;

export type TreeNode<T> = TreeNodeOf<T, 'angular'>;
export type WritableLeaf<T> = LeafOf<T, 'angular'>;
export type AccessibleNode<T> = AccessibleNodeOf<T, 'angular'>;
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
export type EntitySignalWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> = EntitySignalWithSlicesOf<E, K, Slices, 'angular'>;
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
