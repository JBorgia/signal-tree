/**
 * PathNotifier - Simple internal notification system for all mutations
 *
 * Enables:
 * - Entity hooks (tap, intercept) to work without global state
 * - Enhancers (Persistence, Restoration, DevTools) to catch all mutations
 * - Clean path-based subscription pattern
 *
 * @internal
 */

import { getActiveWriteContext } from './write-context';
import {
  isRestorationDesignated,
  markMetaDesignated,
} from './internals/restoration-eligibility';

import { getWriteParticipation } from './write-participation';

import { installPathDeliveryRuntime } from './internals/path-observation-port';
import type { WriteMetadata } from './mutation-types';

export type PathNotifierHandler = (
  value: unknown,
  prev: unknown,
  path: string,
  ownerPath?: string,
  origin?: string,
  subjectIds?: number[],
  positionIds?: number[],
  meta?: WriteMetadata
) => void | Promise<void>;

type BatchIdentityMode =
  | 'path'
  | 'path-position'
  | 'path-position-subject'
  | 'path-position-subject-composite';

type PendingEntry = {
  path: string;
  newValue: unknown;
  oldValue: unknown;
  ownerPath?: string;
  origin?: string;
  meta?: WriteMetadata;
  subjectId?: number;
  positionId?: number;
  /**
   * NOTIFIER-SCOPE-0. `positionId` is allocated PER REGISTRY, so two trees both
   * call their first leaf 2 and `hasSameSemanticIdentity` coalesced them into
   * one delivery — silently dropping a write, and with it a restoration entry
   * and a transaction compensation. The namespace qualifies the number.
   */
  ownerId?: number;
  subjectIds?: number[];
  positionIds?: number[];
};

type PendingSlot = PendingEntry | PendingEntry[];

const materializeDeliveryMeta = (
  meta?: WriteMetadata
): WriteMetadata | undefined => {
  if (!meta?.structuralEffect) {
    return meta;
  }

  return {
    ...meta,
    structuralEffect: Object.freeze({ ...meta.structuralEffect }),
  };
};

/**
 * Simple path-based notification system
 * Used internally by SignalTree for entity hooks and enhancers.
 * Access via getPathNotifier().
 */
export class PathNotifier {
  private static readonly ownerBoundarySeparator = '\u0000';

  // Map of pattern -> Set of handlers
  private subscribers = new Map<string, Set<PathNotifierHandler>>();


  // Batching state
  private resetCallbacks = new Set<() => void>();
  private batchingEnabled = true;
  private batchIdentityMode: BatchIdentityMode =
    'path-position-subject';
  private pendingFlush = false;
  private pending = new Map<string, PendingSlot>();
  private flushCallbacks = new Set<() => void>();

  constructor(options?: { batching?: boolean }) {
    if (options && options.batching === false) this.batchingEnabled = false;
  }

  /**
   * Enable or disable batching at runtime (global opt-out)
   */
  setBatchingEnabled(enabled: boolean): void {
    this.batchingEnabled = enabled;
  }

  isBatchingEnabled(): boolean {
    return this.batchingEnabled;
  }

  hasObservers(): boolean {
    return (
      this.subscribers.size > 0 ||
      this.flushCallbacks.size > 0
    );
  }

  /**
   * ⚠️ RETURNS VOID SINCE 15.0. It used to return `{ blocked, value }`, the
   * result protocol of the deleted delivery interceptors. The only producer —
   * `owned-mutation` — already discarded it, and no surviving caller consumed
   * it. Keeping the shape would have preserved archaeological evidence of a
   * retired mechanism as though it were a contract.
   */
  // ⚠️ `emitMutation(envelope)` WAS DELETED IN 15.0 — ME-B,
  // MUTATION-ENVELOPE-OWNERSHIP-0.
  //
  // It was a pure adapter: unpack a `MutationEnvelope` produced by exactly one
  // caller and immediately call `this.notify(...)` field-for-field. No decision
  // was made at that boundary — it joined path segments the same caller had
  // just split, and rewrapped a position id the same caller had just unwrapped.
  //
  //     ONE SEMANTIC PUBLICATION JOB, ONE PORT OPERATION.
  //
  // `owned-mutation` now calls `notify` through the port directly. Do not
  // reintroduce a parameter object BESIDE this protocol; that recreates the
  // dual-protocol problem this deletion removed. Replacing the positional
  // signature IN PLACE, derived from all producers and consumers, is admissible
  // representation cleanup — adding a second entry point is not.

  /** @internal Bench/test-only hook to isolate batching-key overhead. */
  setBatchIdentityModeForTesting(
    mode: BatchIdentityMode = 'path-position-subject'
  ): void {
    this.batchIdentityMode = mode;
  }

  /**
   * Subscribe to mutations matching a path pattern
   * Returns unsubscribe function
   */
  subscribe(pattern: string, handler: PathNotifierHandler): () => void {
    if (!this.subscribers.has(pattern)) {
      this.subscribers.set(pattern, new Set());
    }
    const handlers = this.subscribers.get(pattern);
    if (!handlers) {
      return () => {
        // No-op: pattern was not found
      };
    }
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(pattern);
      }
    };
  }

  /**
   * Notify all subscribers matching the path
   * When batching is enabled, notifications are queued and flushed at
   * the end of the current microtask (via queueMicrotask).
   */
  notify(
    path: string,
    value: unknown,
    prev: unknown,
    ownerPath?: string,
    subjectIds?: number[],
    positionIds?: number[],
    metaOverride?: WriteMetadata,
    ownerId?: number
  ): void {
    const ambientMeta = metaOverride ?? getActiveWriteContext();
    // HIST-C2. Captured HERE, at the synchronous observation of the write, for
    // exactly the reason the `origin` comment below gives: the flush that
    // delivers this entry is deferred to a microtask, so a designation scope
    // that has already returned is invisible to the recorder. Measured — all
    // three `captureIntoBucket` calls for one designated tick ran after the
    // scope had exited.
    const metaBeforeOwner: WriteMetadata | undefined = isRestorationDesignated()
      ? markMetaDesignated(ambientMeta)
      : ambientMeta;
    // Tag the batch with the ambient write origin (e.g. `restoration` during a
    // history restore). The flush that delivers this entry is DEFERRED to a
    // microtask, so consumers must be able to tell "this write came from a
    // restore" apart from a user change at flush time — `isRestoring`-style
    // flags that reset synchronously are already false by then.
    // The namespace travels WITH the write, so a `'**'` subscriber can tell
    // whose tree it belongs to. Folded in here rather than added as a delivery
    // parameter: every consumer already receives `meta`, and the handler
    // signature is enhancer-facing.
    const meta = ownerId === undefined
      ? metaBeforeOwner
      : { ...(metaBeforeOwner ?? {}), ownerId };

    const origin = meta?.origin;
    if (!this.batchingEnabled) {
      // Synchronous path: run subscribers immediately
      const deliveryMeta = materializeDeliveryMeta(meta);
      return this._runNotify(
        path,
        value,
        prev,
        ownerPath,
        origin,
        subjectIds,
        positionIds,
        deliveryMeta
      );
    }

    const entry: PendingEntry = {
      path,
      newValue: value,
      oldValue: prev,
      ownerPath,
      origin,
      meta,
      subjectId: subjectIds?.[0],
      positionId: positionIds?.[0],
      ownerId,
      subjectIds,
      positionIds,
    };

    this.enqueuePending(entry);

    if (!this.pendingFlush) {
      this.pendingFlush = true;
      queueMicrotask(() => this.flush());
    }

    // Queued: delivery happens at flush.
    return;
  }

  /**
   * Internal synchronous notification runner (subscribers)
   */
  private _runNotify(
    path: string,
    value: unknown,
    prev: unknown,
    ownerPath?: string,
    origin?: string,
    subjectIds?: number[],
    positionIds?: number[],
    meta?: WriteMetadata
  ): void {
    // ⚠️ THE INTERCEPTOR LOOP WAS DELETED IN 15.0 — PATH-NOTIFIER-INTERCEPT-
    // SURVIVAL-0. It ran here, before subscribers, and could suppress delivery
    // (`block`) or rewrite the delivered value (`transform`). Both WORKED; it
    // was postcommit delivery middleware, not mutation authority — `apply()`
    // commits before the envelope is even built.
    //
    // Deleted because nothing claimed it: zero production callers, zero spec
    // carriers on this surface, and no public API obligation (`PathNotifier`,
    // `PathNotifierInterceptor` and `getPathNotifier` are absent from the built
    // barrel).
    //
    //     SEMANTIC COHERENCE EARNS A CLASSIFICATION, NOT A PERMANENT OWNER.
    //
    // Understanding what it did was necessary to delete it deliberately rather
    // than mistake it for dead code — an earlier pass called it "unreachable"
    // and was wrong.
    const transformed = value;

    // Run subscribers
    for (const [pattern, handlers] of this.subscribers) {
      if (this.matches(pattern, path)) {
        for (const handler of handlers) {
          handler(
            transformed,
            prev,
            path,
            ownerPath,
            origin,
            subjectIds,
            positionIds,
            meta
          );
        }
      }
    }

    return;
  }

  /**
   * Flush pending batched notifications immediately.
   * This is re-entrant safe and will process notifications queued during
   * subscriber callbacks in subsequent rounds.
   */
  private flush(): void {
    // Snapshot and clear before notifying to allow re-entrant behavior
    const toNotify = new Map(this.pending);
    this.pending.clear();
    this.pendingFlush = false;

    for (const slot of toNotify.values()) {
      const entries = Array.isArray(slot) ? slot : [slot];
      for (const entry of entries) {
        const isOwnerOnlyMarkerSignal =
          entry.ownerPath !== undefined &&
          entry.newValue === undefined &&
          entry.oldValue === undefined;
        const hasStructuralEffect =
          entry.meta?.structuralEffect !== undefined;
        // If value didn't change compared to original oldValue, skip
        if (
          entry.newValue === entry.oldValue &&
          !isOwnerOnlyMarkerSignal &&
          !hasStructuralEffect
        ) {
          continue;
        }

        // Run subscribers synchronously for each path
        this._runNotify(
          entry.path,
          entry.newValue,
          entry.oldValue,
          entry.ownerPath,
          entry.origin,
          entry.subjectIds,
          entry.positionIds,
          materializeDeliveryMeta(entry.meta)
        );
      }
    }

    // Call flush listeners (e.g., restoration) once per flush
    for (const cb of Array.from(this.flushCallbacks)) {
      try {
        cb();
      } catch {
        // swallow callback errors to avoid breaking flush loop
      }
    }
  }

  /**
   * Force synchronous flush of pending notifications
   */
  flushSync(): void {
    // Process until no pending notifications exist
    while (this.pending.size > 0 || this.pendingFlush) {
      // If a pendingFlush was scheduled but not yet processed, clear flag and process
      if (this.pendingFlush && this.pending.size === 0) {
        // nothing queued - clear and continue
        this.pendingFlush = false;
        break;
      }
      this.flush();
    }
  }

  /**
   * Subscribe to flush events (called after a flush completes)
   */
  onFlush(callback: () => void): () => void {
    this.flushCallbacks.add(callback);
    return () => this.flushCallbacks.delete(callback);
  }

  /**
   * Check if there are pending notifications
   */
  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /**
   * Simple pattern matching
   * - 'users' matches exactly 'users'
   * - 'users.*' matches 'users.u1', 'users.u2', etc.
   * - '**' matches everything
   */
  private matches(pattern: string, path: string): boolean {
    if (pattern === '**') return true;
    if (pattern === path) return true;

    // Handle wildcard patterns like 'users.*'
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix + '.');
    }

    return false;
  }

  private enqueuePending(entry: PendingEntry): void {
    const path = entry.path;
    const existing = this.pending.get(path);
    if (!existing) {
      this.pending.set(path, entry);
      return;
    }

    if (this.batchIdentityMode === 'path') {
      if (Array.isArray(existing)) {
        const tail = existing[existing.length - 1];
        if (this.hasSameSemanticIdentity(tail, entry)) {
          this.coalesceEntry(tail, entry);
          return;
        }
        existing.push(entry);
        return;
      }

      if (this.hasSameSemanticIdentity(existing, entry)) {
        this.coalesceEntry(existing, entry);
        return;
      }

      this.pending.set(path, [existing, entry]);
      return;
    }

    if (this.batchIdentityMode === 'path-position-subject-composite') {
      this.enqueuePendingComposite(entry);
      return;
    }

    if (Array.isArray(existing)) {
      const tail = existing[existing.length - 1];
      if (this.hasSameSemanticIdentity(tail, entry)) {
        this.coalesceEntry(tail, entry);
        return;
      }
      existing.push(entry);
      return;
    }

    if (this.hasSameSemanticIdentity(existing, entry)) {
      this.coalesceEntry(existing, entry);
      return;
    }

    this.pending.set(path, [existing, entry]);
  }

  private enqueuePendingComposite(entry: PendingEntry): void {
    const compositeKey = this.getCompositeBatchKey(entry);
    const existing = this.pending.get(compositeKey);
    if (!existing) {
      this.pending.set(compositeKey, entry);
      return;
    }

    const target = Array.isArray(existing) ? existing[0] : existing;
    this.coalesceEntry(target, entry);
  }

  private hasSameSemanticIdentity(left: PendingEntry, right: PendingEntry): boolean {
    if (this.crossesStructuralBoundary(left, right)) {
      return false;
    }

    if (this.crossesScalarIntentBoundary(left, right)) {
      return false;
    }

    if (this.crossesCausalModeBoundary(left, right)) {
      return false;
    }

    // NOTIFIER-SCOPE-0. A position id is only meaningful WITHIN its registry,
    // so two entries are the same location only if they agree on the namespace
    // too. Entries from emitters that do not supply one both carry `undefined`
    // and compare exactly as they did before — the fix cannot make a
    // single-tree case newly distinct.
    if (left.ownerId !== right.ownerId) {
      return false;
    }

    if (this.batchIdentityMode === 'path-position') {
      return left.positionId === right.positionId;
    }

    return (
      left.positionId === right.positionId &&
      left.subjectId === right.subjectId
    );
  }

  private crossesStructuralBoundary(left: PendingEntry, right: PendingEntry): boolean {
    const leftEffect = left.meta?.structuralEffect;
    const rightEffect = right.meta?.structuralEffect;
    const leftStructural = leftEffect !== undefined;
    const rightStructural = rightEffect !== undefined;
    if (leftStructural !== rightStructural) {
      return true;
    }

    // RESTORE-P0. Two structural effects of DIFFERENT kinds on the same subject
    // are not the same event, and coalescing them silently discarded the first.
    //
    //   setAll([a,b]) then removeOne('a')   in one tick
    //     -> add(subject 1) coalesced INTO remove(subject 1)
    //     -> restoration only ever saw the remove, so undo re-added a row the
    //        turn had created, and the collection could not return to empty
    //
    // Keeping both entries is the notifier's whole job here: it must not lose
    // information. Deciding what the pair NETS to is a history concern and
    // belongs to the turn recorder, which composes them per subject.
    if (leftStructural && rightStructural && leftEffect.kind !== rightEffect.kind) {
      return true;
    }

    return false;
  }

  private crossesScalarIntentBoundary(left: PendingEntry, right: PendingEntry): boolean {
    const leftIntent = left.meta?.mutationIntent;
    const rightIntent = right.meta?.mutationIntent;
    return (
      leftIntent !== undefined &&
      rightIntent !== undefined &&
      leftIntent !== rightIntent
    );
  }

  private crossesCausalModeBoundary(left: PendingEntry, right: PendingEntry): boolean {
    return getWriteParticipation(left.meta) !== getWriteParticipation(right.meta);
  }

  private coalesceEntry(target: PendingEntry, next: PendingEntry): void {
    target.newValue = next.newValue;
    target.ownerPath = next.ownerPath;
    target.origin = this.mergeOrigin(target.origin, next.origin);
    target.meta = this.mergeMeta(target.meta, next.meta);
    target.subjectId = next.subjectId;
    target.positionId = next.positionId;
    target.subjectIds = next.subjectIds;
    target.positionIds = next.positionIds;
  }

  private mergeOrigin(left?: string, right?: string): string | undefined {
    if (!left && !right) return undefined;
    if (left === right) return left;
    return 'mixed';
  }

  private mergeMeta(
    left?: WriteMetadata,
    right?: WriteMetadata
  ): WriteMetadata | undefined {
    if (!left && !right) {
      return undefined;
    }
    if (!left || !right) {
      return undefined;
    }
    if (left.origin !== right.origin) {
      return undefined;
    }
    if (
      left.transactionId !== right.transactionId ||
      left.transactionOwner !== right.transactionOwner ||
      left.mutationIntent !== right.mutationIntent ||
      getWriteParticipation(left) !== getWriteParticipation(right)
    ) {
      return undefined;
    }
    if (left.structuralEffect && !right.structuralEffect) {
      return {
        ...right,
        structuralEffect: left.structuralEffect,
      };
    }
    return right;
  }

  private getCompositeBatchKey(entry: PendingEntry): string {
    const positionKey = entry.positionIds?.join(',') ?? '';
    const subjectKey = entry.subjectIds?.join(',') ?? '';
    const participation = getWriteParticipation(entry.meta);
    return `${entry.path}${PathNotifier.ownerBoundarySeparator}${positionKey}${PathNotifier.ownerBoundarySeparator}${subjectKey}${PathNotifier.ownerBoundarySeparator}${participation}`;
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.subscribers.clear();
    this.pending.clear();
    // Note: do NOT clear flush callbacks here. Enhancers may have
    // registered onFlush listeners that should survive a runtime reset
    // (e.g., resetPathNotifier) to avoid losing subscriptions silently.
    this.pendingFlush = false;
  }

  /** Reset queued runtime state but preserve registered listeners. */
  onReset(callback: () => void): () => void {
    this.resetCallbacks.add(callback);
    return () => this.resetCallbacks.delete(callback);
  }

  emitReset(): void {
    for (const cb of Array.from(this.resetCallbacks)) {
      try {
        cb();
      } catch {
        // swallow callback errors to avoid breaking reset flow
      }
    }
  }

  /**
   * Get count of active subscribers (for debugging)
   */
  getSubscriberCount(): number {
    let count = 0;
    for (const handlers of this.subscribers.values()) {
      count += handlers.size;
    }
    return count;
  }

}

/**
 * Lazy-initialized singleton PathNotifier
 * Created on first use, zero overhead if not used
 */
let globalPathNotifier: PathNotifier | null = null;

/**
 * Get or create the global PathNotifier
 * Lazy initialization ensures zero overhead if entities/enhancers aren't used.
 * Used by enhancers like guardrails for monitoring.
 */
export function getPathNotifier(): PathNotifier {
  if (!globalPathNotifier) {
    globalPathNotifier = new PathNotifier();
  }
  // ⚠️ INSTALLATION IS A SIDE EFFECT OF ASKING FOR THE ENGINE, deliberately.
  // Every optional consumer already calls this to subscribe, so none of them
  // needs to know the port exists — and the bare kernel, which reaches only
  // `path-observation-port`, can never trigger it. That is what lets the
  // delivery implementation tree-shake out of a subscriber-less bundle.
  // Re-installing the same singleton keeps ONE DELIVERY AUTHORITY.
  installPathDeliveryRuntime(globalPathNotifier);
  return globalPathNotifier;
}

/**
 * Reset the global PathNotifier (for testing)
 *
 * @internal
 */
export function resetPathNotifier(): void {
  // Preserve existing instance to keep subscribers registered (tests may call
  // reset after enhancers have subscribed). Instead of replacing the instance
  // we clear its internal state so listeners remain intact and later calls to
  // `getPathNotifier()` continue to return the same object.
  if (!globalPathNotifier) {
    globalPathNotifier = new PathNotifier();
    return;
  }

  globalPathNotifier.clear();
  globalPathNotifier.setBatchingEnabled(true);
  globalPathNotifier.emitReset();
}
