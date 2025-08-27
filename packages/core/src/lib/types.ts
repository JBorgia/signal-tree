/**
 * SignalTree Core Types - Simplified Architecture
 *
 * MIT License
 * Copyright (c) 2025 Jonathan D Borgia
 */

import { WritableSignal, Signal } from '@angular/core';

// ============================================
// RECURSIVE TYPING SYSTEM
// ============================================

/**
 * Primitive types for type checking
 */
export type Primitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | symbol;

/**
 * Built-in object types that should be treated as primitive values
 */
export type BuiltInObject =
  | Date
  | RegExp
  | ((...args: unknown[]) => unknown)
  | Map<unknown, unknown>
  | Set<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | DataView
  | Error
  | Promise<unknown>
  | URL
  | URLSearchParams
  | FormData
  | Blob
  | File;

/**
 * DeepSignalify type - recursively converts objects to signals
 * Branch nodes have set/update methods, leaf nodes are just signals
 */
export type DeepSignalify<T> = {
  [K in keyof T]: T[K] extends (infer U)[]
    ? WritableSignal<U[]>
    : T[K] extends object
    ? T[K] extends Signal<unknown>
      ? T[K] // Don't double-wrap signals
      : T[K] extends BuiltInObject
      ? WritableSignal<T[K]>
      : T[K] extends (...args: unknown[]) => unknown
      ? WritableSignal<T[K]>
      : DeepSignalify<T[K]> & {
          set(partial: Partial<T[K]>): void;
          update(updater: (current: T[K]) => Partial<T[K]>): void;
        }
    : WritableSignal<T[K]>;
};

/**
 * Minimal SignalTree with composable enhancers
 */
export type SignalTree<T> = {
  /**
   * The reactive state object with deep signal conversion
   */
  $: DeepSignalify<T>;

  /**
   * Alias for $ - backward compatibility
   */
  state: DeepSignalify<T>;

  /**
   * Compose enhancers to add functionality
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  with<R>(...enhancers: Array<(tree: any) => any>): R;
};

// ============================================
// CONFIGURATION TYPES
// ============================================

export type TreePreset = 'basic' | 'performance' | 'development' | 'production';

export interface TreeConfig {
  batchUpdates?: boolean;
  useMemoization?: boolean;
  enableTimeTravel?: boolean;
  useLazySignals?: boolean;
  useShallowComparison?: boolean;
  maxCacheSize?: number;
  trackPerformance?: boolean;
  treeName?: string;
  enableDevTools?: boolean;
  debugMode?: boolean;
  useStructuralSharing?: boolean;
}

// ============================================
// ENHANCER TYPES
// ============================================

export interface Middleware<T> {
  id: string;
  before?: (action: string, payload: unknown, state: T) => boolean;
  after?: (action: string, payload: unknown, state: T, newState: T) => void;
}

export interface PerformanceMetrics {
  updates: number;
  computations: number;
  cacheHits: number;
  cacheMisses: number;
  averageUpdateTime: number;
}

export interface EntityHelpers<E extends { id: string | number }> {
  add(entity: E): void;
  update(id: E['id'], updates: Partial<E>): void;
  remove(id: E['id']): void;
  upsert(entity: E): void;
  findById(id: E['id']): Signal<E | undefined>;
  findBy(predicate: (entity: E) => boolean): Signal<E[]>;
  selectIds(): Signal<Array<string | number>>;
  selectAll(): Signal<E[]>;
  selectTotal(): Signal<number>;
  findAll(): Signal<E[]>;
  clear(): void;
}

export interface AsyncActionConfig<T, TResult> {
  onStart?: (state: T) => Partial<T>;
  onSuccess?: (result: TResult, state: T) => Partial<T>;
  onError?: (error: Error, state: T) => Partial<T>;
  onComplete?: (state: T) => Partial<T>;
}

export interface AsyncAction<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
  pending: Signal<boolean>;
  error: Signal<Error | null>;
  result: Signal<TResult | null>;
}

export interface TimeTravelEntry<T> {
  action: string;
  timestamp: number;
  state: T;
  payload?: unknown;
}
