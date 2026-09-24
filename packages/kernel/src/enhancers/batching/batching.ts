import {
  getActiveWriteContext,
  withWriteContext,
} from '../../lib/write-context';
import {
  isRestorationDesignated,
  withCapturedRestorationDesignation,
} from '../../lib/internals/restoration-eligibility';
import { visitTree } from '../../lib/internals/visit-tree';
import {
  interceptLocationWrites,
  getLocationRuntime,
  createWritableProjection,
  isWritableLocation,
} from '../../lib/internals/location-runtime';

import type { LocationWriteOperation } from '../../lib/internals/location-runtime';
import type { Location } from '../../lib/internals/cell-runtime';
import type { ISignalTree, Enhancer, EnhancerMeta } from '../../lib/types';
import type { BatchingConfig, BatchingMethods } from './batching.types';
import { ENHANCER_META } from '../../lib/types';
import { markOwnerInvalidatedFrom } from '../../lib/internals/owner-invalidation-port';

type ChangeDetectionAwareTree = {
  __notifyChangeDetection?: () => void;
};

type WritePort = {
  intercept?: (
    node: Location<unknown>,
    operation: LocationWriteOperation<unknown>,
    proceed: () => void
  ) => void;
};

// Keep escaped locations outside the enhancer's lexical environment. Clearing
// this shared port on destruction detaches every lazy field without retaining
// fields through a collection of disposal closures.
function interceptThroughPort(
  node: Location<unknown>,
  port: WritePort
): () => void {
  return interceptLocationWrites(node, (operation, proceed) => {
    if (port.intercept) port.intercept(node, operation, proceed);
    else proceed();
  });
}

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
    let coalesceTransaction: number | undefined;
    let coalesceOwner: object | undefined;

    // Coalescing keys are physical locations, never presentation paths.
    const coalescedUpdates = new Map<object, () => void>();
    let active = true;
    const intercepted = new WeakSet<object>();
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

      let failed = false;
      let firstFailure: unknown;
      for (const update of updates) {
        try {
          update();
        } catch (error) {
          if (!failed) firstFailure = error;
          failed = true;
        }
      }
      if (failed) throw firstFailure;
    };

    // ========================================
    // INTERCEPT LOCATION WRITES TO TRACK NOTIFICATIONS
    // ========================================

    /**
     * Recursively intercept canonical locations beneath their escaped callable
     * identity. Values remain synchronous except replacement writes explicitly
     * deduplicated inside `coalesce()`.
     */
    const writePort: WritePort = {
      intercept(node, operation, proceed) {
        const meta = inCoalesce ? getActiveWriteContext() : undefined;
        // An updater can flush a preceding replacement, so it must pass the
        // same scope check before either the pending write or updater runs.
        if (
          inCoalesce &&
          (meta?.transactionId !== coalesceTransaction ||
            meta?.transactionOwner !== coalesceOwner)
        ) {
          throw new Error(
            'A transaction cannot defer its writes beyond its callback; put coalesce() inside the transaction'
          );
        }
        if (operation.intent === 'replace' && inCoalesce) {
          const capturedMeta = { ...(meta ?? {}) };
          const designated = isRestorationDesignated();
          coalescedUpdates.set(node, () =>
            withWriteContext(capturedMeta, () =>
              withCapturedRestorationDesignation(designated, proceed)
            )
          );
        } else {
          if (inCoalesce) {
            const pendingReplace = coalescedUpdates.get(node);
            if (pendingReplace) {
              coalescedUpdates.delete(node);
              pendingReplace();
            }
          }
          proceed();
        }
        if (!inBatch) scheduleNotification();
      },
    };
    const interceptWrite = (node: Location<unknown>): (() => void) => {
      if (!active || intercepted.has(node)) return () => undefined;
      intercepted.add(node);
      return interceptThroughPort(node, writePort);
    };
    const interceptWrites = (rootNode: Record<string, unknown>): void => {
      visitTree(
        rootNode,
        (node) => {
          if (!isWritableLocation(node)) return true;
          releaseWriteInterceptors.push(interceptWrite(node));
          return false;
        },
        { skipKey: (key) => key.startsWith('_') }
      );
    };

    // Entity fields materialize lazily using this tree's construction-local
    // runtime. Intercept at creation without materializing or retaining rows.
    const runtime = getLocationRuntime(tree);
    const originalProjection = runtime?.createWritableProjection;
    const createProjection = <V>(
      compute: () => V,
      write: (value: V, intent: 'replace' | 'derive') => void
    ): Location<V> => {
      if (!runtime) throw new Error('Missing tree location runtime');
      const location = originalProjection
        ? originalProjection<V>(compute, write)
        : createWritableProjection(runtime.createDerived(compute), write);
      // Do not store a release closure: it would keep retired fields alive.
      // The shared port detaches the callback from this tree at disposal.
      interceptWrite(location as Location<unknown>);
      return location;
    };
    if (runtime) runtime.createWritableProjection = createProjection;

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
        const previousTransaction = coalesceTransaction;
        const previousOwner = coalesceOwner;
        if (!wasCoalescing) {
          coalesceTransaction = getActiveWriteContext()?.transactionId;
          coalesceOwner = getActiveWriteContext()?.transactionOwner;
        }
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
          coalesceTransaction = previousTransaction;
          coalesceOwner = previousOwner;
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
          console.error(
            '[SignalTree] Secondary error in coalesce():',
            secondary
          );
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
        active = false;
        writePort.intercept = undefined;
        if (runtime?.createWritableProjection === createProjection) {
          if (originalProjection)
            runtime.createWritableProjection = originalProjection;
          else delete runtime.createWritableProjection;
        }
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
