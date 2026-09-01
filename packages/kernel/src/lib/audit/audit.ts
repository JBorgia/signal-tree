import { getChanges } from '../internals/utilities/get-changes';

/**
 * SignalTree Audit Tracker
 *
 * Tree-shakeable audit-logging utility for tracking state changes on any
 * SignalTree. Framework-agnostic (depends only on kernel internals and the
 * core tree type), so it lives in `@signal-tree/kernel` — a within-tree mechanic,
 * not an Angular-forms concern (RFC 0007). Only included in the bundle if
 * explicitly imported.
 *
 * @packageDocumentation
 */

import { readCanonicalSnapshotInternal } from '../internals/canonical-snapshot';

/**
 * Audit log entry recording state changes.
 */
export interface AuditEntry<T = unknown> {
  /** Timestamp when change occurred */
  timestamp: number;
  /** Changed fields and their new values */
  changes: Partial<T>;
  /** Previous values before the change */
  previousValues?: Partial<T>;
  /** Optional metadata about the change */
  metadata?: AuditMetadata;
}

/**
 * Metadata that can be attached to audit entries.
 */
export interface AuditMetadata {
  /** User ID who made the change */
  userId?: string;
  /** Source of the change (e.g., 'ui', 'api', 'import') */
  source?: string;
  /** Human-readable description */
  description?: string;
  /** Any additional custom metadata */
  [key: string]: unknown;
}

/**
 * Configuration options for the audit tracker.
 */
export interface AuditTrackerConfig<T> {
  /** Function to provide metadata for each audit entry */
  getMetadata?: () => AuditMetadata;
  /** Whether to include previous values in audit entries */
  includePreviousValues?: boolean;
  /** Filter function to determine which changes to audit */
  filter?: (changes: Partial<T>) => boolean;
  /** Maximum number of entries to keep (0 = unlimited) */
  maxEntries?: number;
}

/**
 * Creates an audit tracker for tree change tracking.
 *
 * ⚠️ IT POLLS, AT 100ms. This said "Uses `tree.subscribe()` for reactive change
 * detection in Angular contexts, providing zero-polling overhead" — and that was
 * FALSE for every tree a caller can construct.
 *
 * Measured: `signalTree({...})` has no `subscribe` property at all, so the
 * detector below (`'subscribe' in tree && typeof tree.subscribe === 'function'`)
 * can never select the fast path for a public tree. The detector itself is
 * fine — a positive control handing it a subscribe-capable object DOES take that
 * branch — so this was a documentation defect, not an implementation one.
 *
 * The claim is corrected rather than rescued. Giving the tree a `subscribe` to
 * make the sentence true would add a second subscription architecture, and
 * framework observation belongs at committed publication
 * (GREENFIELD-FRAMEWORK-HANDOFF-0). A 100ms poll is the honest description of
 * what this does today.
 *
 * This function is tree-shakeable - if not imported, it won't be included in
 * your bundle.
 *
 * @param tree - The tree (or slice accessor) to track. Accepts the value
 *   returned by `signalTree()` directly — no cast needed.
 * @param auditLog - Array to collect audit entries
 * @param config - Optional configuration
 * @returns Unsubscribe function to stop tracking
 *
 * @example
 * ```typescript
 * import { signalTree, createAuditTracker, AuditEntry } from '@signal-tree/kernel';
 *
 * const auditLog: AuditEntry<MyData>[] = [];
 * const tree = signalTree({ name: '', email: '' });
 *
 * const stopTracking = createAuditTracker(tree, auditLog, {
 *   getMetadata: () => ({ userId: currentUser.id, source: 'form-editor' }),
 *   includePreviousValues: true,
 * });
 *
 * tree.$.name.set('John');
 * stopTracking();
 * ```
 */
export function createAuditTracker<T extends Record<string, unknown>>(
  tree: { readonly $: object },
  auditLog: AuditEntry<T>[],
  config: AuditTrackerConfig<T> = {}
): () => void {
  const {
    getMetadata,
    includePreviousValues = false,
    filter,
    maxEntries = 0,
  } = config;

  let previousState = structuredClone(readCanonicalSnapshotInternal<T>(tree));
  let isTracking = true;

  const handleChange = () => {
    if (!isTracking) return;

    const currentState = readCanonicalSnapshotInternal<T>(tree);
    const changes = getChanges(previousState, currentState) as Partial<T>;

    if (Object.keys(changes).length > 0) {
      // Apply filter if provided
      if (filter && !filter(changes)) {
        previousState = structuredClone(currentState) as T;
        return;
      }

      const entry: AuditEntry<T> = {
        timestamp: Date.now(),
        changes,
        metadata: getMetadata?.(),
      };

      if (includePreviousValues) {
        const prevValues: Partial<T> = {};
        for (const key of Object.keys(changes)) {
          prevValues[key as keyof T] = previousState[key as keyof T];
        }
        entry.previousValues = prevValues;
      }

      auditLog.push(entry);

      // Enforce max entries limit
      if (maxEntries > 0 && auditLog.length > maxEntries) {
        auditLog.splice(0, auditLog.length - maxEntries);
      }
    }

    previousState = structuredClone(currentState) as T;
  };

  // Try to use reactive subscription (zero polling in Angular)
  let unsubscribe: (() => void) | undefined;
  let pollingId: ReturnType<typeof setInterval> | undefined;

  if (
    'subscribe' in (tree as unknown as Record<string, unknown>) &&
    typeof (tree as unknown as { subscribe?: unknown }).subscribe === 'function'
  ) {
    try {
      unsubscribe = (
        tree as unknown as { subscribe: (cb: () => void) => () => void }
      ).subscribe(handleChange);
    } catch {
      // Fall back to polling for non-Angular environments
      pollingId = setInterval(handleChange, 100);
    }
  } else {
    // Fall back to polling for non-Angular environments
    pollingId = setInterval(handleChange, 100);
  }

  // Return cleanup function
  return () => {
    isTracking = false;
    if (unsubscribe) {
      unsubscribe();
    }
    if (pollingId) {
      clearInterval(pollingId);
    }
  };
}

// TOMBSTONE: `createAuditCallback`.
//
// ⚠️ ITS DOCUMENTED PURPOSE WAS FALSE. It returned
// `(previousState: T, currentState: T) => void` and said it was "suitable for
// `tree.subscribe()`" — but the public `subscribe` takes a `PathHandler`
// `(value, prev, path, ownerPath?, source?, subjectIds?, …)`. Proven with a
// `@ts-expect-error`: the two-state callback cannot be passed to it. Zero
// consumers anywhere, and no public wiring it could satisfy.
//
// `createAuditTracker(tree, log, config)` survives — it attaches itself and
// samples, so it needs no handler signature from the caller.
