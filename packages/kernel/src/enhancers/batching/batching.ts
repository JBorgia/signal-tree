import { visitTree } from '../../lib/internals/visit-tree';
import {
  interceptLocationWrites,
  isWritableLocation,
} from '../../lib/internals/location-runtime';

import type {
  ISignalTree,
  Enhancer,
  EnhancerMeta,
} from '../../lib/types';
import type { BatchingConfig, BatchingMethods } from './batching.types';
import { ENHANCER_META } from '../../lib/types';
import { markOwnerInvalidatedFrom } from '../../lib/internals/owner-invalidation-port';

type ChangeDetectionAwareTree = {
  __notifyChangeDetection?: () => void;
};

/**
 * Batching enhancer for SignalTree.
 *
 * KEY PRINCIPLE: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 *
 * This aligns with the canonical location contract:
 * - location(x) updates the value immediately
 * - location() always returns the current value
 * - Effects/CD run on microtask
 *
 * @example
 * ```typescript
 * const tree = signalTree({ count: 0 }, { enhancers: [batching()] });
 *
 * tree.$.count(5);
 * console.log(tree.$.count()); // 5 - immediate!
 *
 * tree.batch(() => {
 *   tree.$.a(1);
 *   tree.$.b(2);
 *   // Values update immediately, CD notification batched
 * });
 * ```
 */
export function batching(
  config: BatchingConfig = {}
): Enhancer<BatchingMethods> {
  const enabled = config.enabled ?? true;
  const notificationDelayMs = config.notificationDelayMs ?? 0;

  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & BatchingMethods => {
    // ========================================
    // DISABLED PATH - passthrough
    // ========================================
    if (!enabled) {
      const passthrough: BatchingMethods = {
        batch: (fn) => fn(),
        coalesce: (fn) => fn(),
        hasPendingNotifications: () => false,
        flushNotifications: () => {
          /* empty */
        },
      };

      const enhanced = tree as ISignalTree<T> & BatchingMethods;
      Object.assign(enhanced, passthrough);

      return enhanced;
    }

    // ========================================
    // NOTIFICATION BATCHING STATE
    // ========================================
    let notificationPending = false;
    let notificationTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let inBatch = false;
    let inCoalesce = false;

    // For coalesce: track pending writes by path
    const coalescedUpdates = new Map<string, () => void>();
    const releaseWriteInterceptors: Array<() => void> = [];

    /**
     * Schedule CD notification on microtask or after delay.
     */
    const scheduleNotification = (): void => {
      if (notificationPending) return;
      notificationPending = true;
      markOwnerInvalidatedFrom(tree);

      if (notificationDelayMs > 0) {
        notificationTimeoutId = setTimeout(
          flushNotificationsInternal,
          notificationDelayMs
        );
      } else {
        queueMicrotask(flushNotificationsInternal);
      }
    };

    /**
     * Internal flush implementation
     */
    const flushNotificationsInternal = (): void => {
      if (!notificationPending) return;

      notificationPending = false;
      markOwnerInvalidatedFrom(tree);
      if (notificationTimeoutId !== undefined) {
        clearTimeout(notificationTimeoutId);
        notificationTimeoutId = undefined;
      }

      // Trigger Angular change detection if available
      // In Angular 17+, signals automatically notify
      // This is a hook for custom CD strategies
      (tree as ChangeDetectionAwareTree).__notifyChangeDetection?.();
    };

    /**
     * Execute coalesced updates.
     */
    const flushCoalescedUpdates = (): void => {
      const updates = Array.from(coalescedUpdates.values());
      coalescedUpdates.clear();

      for (const update of updates) update();
    };

    // ========================================
    // INTERCEPT LOCATION WRITES TO TRACK NOTIFICATIONS
    // ========================================

    /**
     * Recursively intercept canonical locations beneath their escaped callable
     * identity. Values remain synchronous except replacement writes explicitly
     * deduplicated inside `coalesce()`.
     */
    const interceptWrites = (rootNode: Record<string, unknown>): void => {
      visitTree(
        rootNode,
        (node, path) => {
          if (!isWritableLocation(node)) return true;
          releaseWriteInterceptors.push(
            interceptLocationWrites(node, (operation, proceed) => {
              if (operation.intent === 'replace' && inCoalesce) {
                coalescedUpdates.set(path, proceed);
              } else {
                if (inCoalesce) {
                  const pendingReplace = coalescedUpdates.get(path);
                  if (pendingReplace) {
                    coalescedUpdates.delete(path);
                    pendingReplace();
                  }
                }
                proceed();
              }
              if (!inBatch) scheduleNotification();
            })
          );
          return false;
        },
        { skipKey: (key) => key.startsWith('_') }
      );
    };

    // Wrap the tree's $ proxy
    if (tree.$) {
      interceptWrites(tree.$ as Record<string, unknown>);
    }

    // ========================================
    // BATCHING METHODS
    // ========================================

    const batchingMethods: BatchingMethods = {
      /**
       * batch() - Group CD notifications
       * Signal values update immediately inside the callback.
       */
      batch(fn: () => void): void {
        const wasBatching = inBatch;
        inBatch = true;

        try {
          fn();
        } finally {
          inBatch = wasBatching;

          // Schedule notification after outermost batch completes
          if (!inBatch) {
            scheduleNotification();
          }
        }
      },

      /**
       * coalesce() - Deduplicate same-path updates
       * Only the final value for each path is written.
       */
      coalesce(fn: () => void): void {
        const wasCoalescing = inCoalesce;
        const wasBatching = inBatch;
        const failures: unknown[] = [];
        inCoalesce = true;
        inBatch = true; // Also batch during coalesce

        try {
          fn();
        } catch (error) {
          failures.push(error);
        } finally {
          inCoalesce = wasCoalescing;
          inBatch = wasBatching;
        }

        if (!wasCoalescing) {
          try {
            flushCoalescedUpdates();
          } catch (error) {
            failures.push(error);
          }
        }

        if (!inBatch) {
          try {
            scheduleNotification();
          } catch (error) {
            failures.push(error);
          }
        }

        for (const secondary of failures.slice(1)) {
          console.error('[SignalTree] Secondary error in coalesce():', secondary);
        }
        if (failures.length > 0) throw failures[0];
      },

      hasPendingNotifications(): boolean {
        return notificationPending;
      },

      flushNotifications(): void {
        flushNotificationsInternal();
      },
    };

    const enhancedTree = tree;

    // Add batching methods
    Object.assign(enhancedTree, batchingMethods);

    // Register cleanup for tree destruction
    if (typeof tree.registerCleanup === 'function') {
      tree.registerCleanup(() => {
        if (notificationTimeoutId !== undefined) {
          clearTimeout(notificationTimeoutId);
          notificationTimeoutId = undefined;
        }
        coalescedUpdates.clear();
        for (const release of releaseWriteInterceptors) release();
        releaseWriteInterceptors.length = 0;
      });
    }

    return enhancedTree as unknown as ISignalTree<T> & BatchingMethods;
  };

  const meta: EnhancerMeta = { name: 'batching', provides: ['batching'] };
  (enhancerFn as unknown as { metadata: EnhancerMeta }).metadata = meta;
  (enhancerFn as unknown as Record<symbol, EnhancerMeta>)[ENHANCER_META] = meta;

  // THE ONE BOUNDARY CAST. `enhancerFn` reads the realized tree, so its
  // parameter is `ISignalTree<T>`; `Enhancer<TAdded>` takes the neutral
  // `EnhancerHost`. Function parameters are contravariant under
  // `strictFunctionTypes`, so a concrete-tree enhancer is not assignable to the
  // neutral type — that is the inversion `EnhancerHost` exists to prevent, not
  // an accident. Casting here is the single audited assertion that lets the
  // PUBLIC contract be neutral while the body keeps reading what it needs.
  //
  // The body is untouched by this migration.
  return enhancerFn as unknown as Enhancer<BatchingMethods>;
}

// `highPerformanceBatching()` used to live here — a two-line preset returning
// `batching({ enabled: true, notificationDelayMs: 0 })`.
//
// v9.0.0 (`566a0065`) removed it from the public barrel as one of "~37
// deprecated/alias exports". The export went; the function body did not, so for
// five majors core carried an exported symbol that reached no entry point — not
// the root barrel, not any of the six subpaths in `exports`. `dead-exports`
// never flagged it, because its own spec imported it and an internal import
// satisfies that gate's reachability test.
//
// The cost was not the dead code. It was that the demo's benchmark service
// needed the preset, could not import it, and re-implemented it locally — while
// a reader checking the barrel would conclude the name was fictional. One did.
//
// Deleted rather than re-exported: re-exporting would reverse a deliberate
// v9.0.0 breaking change. Callers write the config, which is the whole preset:
//
//     batching({ enabled: true, notificationDelayMs: 0 })

// ========================================
// DEPRECATED EXPORTS (for backwards compat)
// ========================================

/**
 * @deprecated Use batching() instead.
 *
 * NOT PUBLIC — absent from `tools/api-baseline.json` and from every barrel, so
 * it reaches no entry point. Migrated with `batching()` rather than left
 * declaring the pre-15.0 shape; it is a deletion candidate for the
 * deletion-first utility audit, which is where the same "exported symbol that
 * reaches no entry point" problem is already recorded for
 * `highPerformanceBatching` (see the note above).
 */
export function batchingWithConfig(
  config: BatchingConfig = {}
): Enhancer<BatchingMethods> {
  return batching(config);
}

// v12: removed the deprecated legacy batching surface — `flushBatchedUpdates()`
// (use `tree.flushNotifications()`), `hasPendingUpdates()` (use
// `tree.hasPendingNotifications()`), `getBatchQueueSize()` (obsolete — signal
// writes are synchronous), and the `withBatching` alias (use `batching()`).
