import { batching } from './batching';

import type {
  Enhancer,
} from '../../lib/types';

/**
 * `batching()` returns the NEUTRAL enhancer contract.
 *
 * This used to assert the realization-facing shape,
 * `<T>(tree: ISignalTree<T>) => ISignalTree<T> & BatchingMethods`. That was the
 * implementation vocabulary, and the 15.0 migration to `Enhancer<TAdded>` is
 * exactly what changed it — so the old row went red and was updated
 * deliberately rather than the migration being bent to keep it green.
 *
 * Note what this file does NOT do: it does not stand in for the consumer
 * contract. A row about `batching`'s own declared shape says nothing about
 * whether a call site still infers `batch`/`coalesce` without casts. That is
 * `batching-contract.typing.spec.ts`, which was written and proven green BEFORE
 * this signature changed and re-run unchanged afterwards.
 */
type BatchingEnhancer = ReturnType<typeof batching>;

type _IsNeutral = BatchingEnhancer extends Enhancer<BatchingMethods>
  ? true
  : false;
const _neutralTest: _IsNeutral = true;

export {};


// ─────────────────────────────────────────────────────────────────────────────
// MOVED HERE IN 15.0 — TYPE-BARREL-CONVERGENCE-0.
//
// These declarations lived in `lib/types.ts`, the KERNEL type barrel, even
// though this module owns them. That was co-location, not duplicate authority:
// `ISignalTree` never named a capability method bag, so the kernel type surface
// did not statically own optional machinery. The move corrects placement only —
// no rename, no semantic change, and the package root still re-exports every
// one of them from here.
//
//     A PUBLIC RE-EXPORT MAY SURVIVE A MOVE. A SECOND DECLARATION MAY NOT.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for the batching enhancer.
 *
 * IMPORTANT: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 */
export interface BatchingConfig {
  /**
   * Whether batching is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Delay before flushing CD notifications (ms).
   * 0 = microtask (default), >0 = setTimeout with delay.
   * @default 0
   */
  notificationDelayMs?: number;
}

/**
 * ⚠️ NOT generic. None of these members reference the tree's state type, and
 * carrying a phantom `<T = unknown>` made `BatchingMethods<A>` and
 * `BatchingMethods<B>` the same type — safety that reads real and is not.
 * Removed in 14.0.0.
 */
export interface BatchingMethods {
  /**
   * Group multiple updates into a single change detection cycle.
   * Signal values update immediately; CD notification is batched.
   *
   * @example
   * tree.batch(() => {
   *   tree.$.a.set(1);  // Value updates immediately
   *   tree.$.b.set(2);  // Value updates immediately
   *   console.log(tree.$.a()); // Returns 1 ✅
   * });
   * // Single CD notification after batch completes
   */
  batch(fn: () => void): void;
  // See `coalesce()` below for the observable difference: a value read back inside
  // a `batch()` callback is the NEW value; inside `coalesce()` it is the OLD one.

  /**
   * Coalesce rapid updates to the same path.
   * Only the final value for each path is written.
   *
   * ## `batch()` vs `coalesce()` — they are NOT interchangeable
   *
   * Both end with the same state, so the docstrings used to imply the same
   * operation reached two ways. They differ in WHEN the write lands, and the
   * difference is observable:
   *
   * | inside the callback | `batch()` | `coalesce()` |
   * | ------------------- | --------- | ------------ |
   * | reading a value you just wrote | the NEW value | the **OLD** value |
   *
   * MEASURED: writing `'X'` then reading inside the callback gives `'X'` under
   * `batch()` and `''` under `coalesce()`. `batch()` writes synchronously and
   * defers only change-detection notification; `coalesce()` defers the WRITE
   * itself and applies the last value per path on exit.
   *
   * So `coalesce()` is wrong for any callback that reads back what it wrote, and
   * `batch()` is wrong when you specifically want intermediate values discarded.
   *
   * ⚠️ An `update(fn)` inside `coalesce()` is NOT coalesced, deliberately. An
   * updater is a read-modify-write, so keeping only the last of three `+1`s would
   * mean `+1`. Updaters apply immediately, after draining any pending coalesced
   * `set` on the same path.
   * Use for high-frequency updates (typing, dragging, etc.)
   *
   * @example
   * tree.coalesce(() => {
   *   tree.$.query.set('h');
   *   tree.$.query.set('he');
   *   tree.$.query.set('hel');
   * });
   * // Only 'hel' is written to the signal
   */
  coalesce(fn: () => void): void;

  /**
   * Check if there are pending CD notifications.
   */
  hasPendingNotifications(): boolean;

  /**
   * Manually flush pending CD notifications.
   * Rarely needed - notifications flush automatically on microtask.
   */
  flushNotifications(): void;
}
