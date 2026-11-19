'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "PathNotifier", { enumerable: true, configurable: true, get(){ try { return PathNotifier } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "getPathNotifier", { enumerable: true, configurable: true, get(){ try { return getPathNotifier } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "resetPathNotifier", { enumerable: true, configurable: true, get(){ try { return resetPathNotifier } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/internals/scalar-publication-coverage.ts", {"importedNames":["mergeScalarPublicationCoverage"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/src/lib/internals/entity-value-transition.ts", {"importedNames":["entityValueTransition","mergeEntityValueTransition"]});



const __vite_ssr_import_2__ = await __vite_ssr_import__("/src/lib/experimental-publication/private.ts", {"importedNames":["annotate","complete","stampSource","deliverEqual"]});





const __vite_ssr_import_3__ = await __vite_ssr_import__("/src/lib/write-context.ts", {"importedNames":["getActiveWriteContext"]});
const __vite_ssr_import_4__ = await __vite_ssr_import__("/src/lib/internals/write-observation-scope.ts", {"importedNames":["currentWriteObservationScopes","mergeWriteObservationScopes","withoutWriteObservationScopes"]});




const __vite_ssr_import_5__ = await __vite_ssr_import__("/src/lib/internals/restoration-eligibility.ts", {"importedNames":["isRestorationDesignated","isMetaDesignated","markMetaDesignated"]});




const __vite_ssr_import_6__ = await __vite_ssr_import__("/src/lib/write-participation.ts", {"importedNames":["getWriteParticipation"]});
const __vite_ssr_import_7__ = await __vite_ssr_import__("/src/lib/internals/path-observation-port.ts", {"importedNames":["installPathDeliveryRuntime","installBranchMembershipCapture"]});



const __vite_ssr_import_8__ = await __vite_ssr_import__("/src/lib/internals/plain-branch-membership.ts", {"importedNames":["capturePathReAdd","capturePlainBranchMembership","plainBranchMembershipChange"]});




const __vite_ssr_import_9__ = await __vite_ssr_import__("/src/lib/internals/error-reporter.ts", {"importedNames":["reportContainedObserverError"]});
const isPlainRowRecord = (value) => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};
const changedSubjectFieldKeys = (before, after, subjectIds) => {
  if (subjectIds?.length !== 1 || !isPlainRowRecord(before) || !isPlainRowRecord(after)) {
    return void 0;
  };
  return [.../* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => Object.prototype.hasOwnProperty.call(before, key) !== Object.prototype.hasOwnProperty.call(after, key) || !Object.is(before[key], after[key])
  );
};
const materializeDeliveryMeta = (meta) => {
  if (!meta?.structuralEffect) {
    return meta;
  };
  return {
    ...meta,
    structuralEffect: Object.freeze({ ...meta.structuralEffect })
  };
};
class PathNotifier {
  static ownerBoundarySeparator = "\0";
  // Map of pattern -> Set of handlers
  subscribers = /* @__PURE__ */ new Map();
  projectionHandlers = /* @__PURE__ */ new WeakSet();
  // Batching state
  resetCallbacks = /* @__PURE__ */ new Set();
  batchingEnabled = true;
  batchIdentityMode = "path-position-subject";
  pendingFlush = false;
  pending = /* @__PURE__ */ new Map();
  pendingBeforeMembership = [];
  flushCallbacks = /* @__PURE__ */ new Set();
  /**
   * @internal Installed while a reversal or rollback applies
   * (`publishingExposedOnly`): true for a realized write to a location the
   * operation leaves absent, which is then not published. Path observers see
   * what the tree exposes, never retained storage (v15 c6258aab, v16 8g).
   */
  absentRealized;
  enqueueObservers = /* @__PURE__ */ new Map();
  /** @internal Owner-scoped evidence before batching can discard chronology. */
  observeEnqueue(ownerId, listener) {
    let listeners = this.enqueueObservers.get(ownerId);
    if (!listeners) this.enqueueObservers.set(ownerId, listeners = /* @__PURE__ */ new Set());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && this.enqueueObservers.get(ownerId) === listeners)
        this.enqueueObservers.delete(ownerId);
    };
  }
  constructor(options) {
    if (options && options.batching === false) this.batchingEnabled = false;
  }
  /**
   * Enable or disable batching at runtime (global opt-out)
   */
  setBatchingEnabled(enabled) {
    this.batchingEnabled = enabled;
  }
  isBatchingEnabled() {
    return this.batchingEnabled;
  }
  hasObservers() {
    return this.subscribers.size > 0 || this.flushCallbacks.size > 0;
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
  setBatchIdentityModeForTesting(mode = "path-position-subject") {
    this.batchIdentityMode = mode;
  }
  /**
   * Subscribe to mutations matching a path pattern
   * Returns unsubscribe function
   */
  /** Internal projection view retains constituent receipts without changing
   * ordinary subscribers' coalesced metadata or callback count. */
  subscribeProjection(handler) {
    this.projectionHandlers.add(handler);
    const release = this.subscribe("**", handler);
    return () => {
      this.projectionHandlers.delete(handler);
      release();
    };
  }
  subscribe(pattern, handler) {
    if (!this.subscribers.has(pattern)) {
      this.subscribers.set(pattern, /* @__PURE__ */ new Set());
    };
    const handlers = this.subscribers.get(pattern);
    if (!handlers) {
      return () => {
      };
    };
    handlers.add(handler);
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
  notify(path, value, prev, ownerPath, subjectIds, positionIds, metaOverride, ownerId, subjectFieldFootprint) {
    const ambientMeta = metaOverride ?? (0,__vite_ssr_import_3__.getActiveWriteContext)();
    if (this.absentRealized?.(positionIds, ambientMeta)) return;
    const metaBeforeOwner = (0,__vite_ssr_import_5__.isRestorationDesignated)() ? (0,__vite_ssr_import_5__.markMetaDesignated)(ambientMeta) : ambientMeta;
    let meta = ownerId === void 0 ? metaBeforeOwner : { ...metaBeforeOwner ?? {}, ownerId };
    const declaredScopes = (0,__vite_ssr_import_4__.currentWriteObservationScopes)(ownerId);
    const origin = meta?.origin;
    const evidenceOwner = ownerId ?? meta?.ownerId;
    const evidenceListeners = evidenceOwner === void 0 ? void 0 : this.enqueueObservers.get(evidenceOwner);
    if (evidenceListeners?.size) {
      const snapshot = Object.freeze({
        path,
        newValue: value,
        oldValue: prev,
        ownerPath,
        origin,
        ownerId: evidenceOwner,
        meta: meta ? Object.freeze({ ...materializeDeliveryMeta(meta) }) : void 0,
        positionIds: positionIds ? [...positionIds] : void 0,
        subjectIds: subjectIds ? [...subjectIds] : void 0
      });
      if (snapshot.positionIds) Object.freeze(snapshot.positionIds);
      if (snapshot.subjectIds) Object.freeze(snapshot.subjectIds);
      for (const listener of [...evidenceListeners]) {
        try {
          (0,__vite_ssr_import_4__.withoutWriteObservationScopes)(() => listener(snapshot));
        } catch (error) {
          try {
            console.error("SignalTree: enqueue observation failed.", error);
          } catch {
          }
        }
      }
    };
    const transition = (0,__vite_ssr_import_1__.entityValueTransition)(meta);
    const fieldKeys = changedSubjectFieldKeys(
      transition ? transition.ordinaryBefore : prev,
      transition ? transition.ordinaryAfter : value,
      subjectIds
    );
    const footprintKeys = subjectFieldFootprint ?? fieldKeys;
    const knownFootprint = subjectFieldFootprint === null ? null : footprintKeys === void 0 ? void 0 : Object.freeze([...footprintKeys]);
    meta = (0,__vite_ssr_import_2__.annotate)(
      (0,__vite_ssr_import_2__.stampSource)(meta, subjectIds, knownFootprint, value, prev),
      ownerId ?? meta?.ownerId,
      positionIds,
      (0,__vite_ssr_import_6__.getWriteParticipation)(meta) === "authored",
      value
    );
    if (!this.batchingEnabled) {
      const deliveryMeta = materializeDeliveryMeta(meta);
      return this._runNotify(
        path,
        value,
        prev,
        ownerPath,
        origin,
        subjectIds,
        positionIds,
        deliveryMeta,
        declaredScopes,
        ownerId,
        knownFootprint
      );
    };
    const entry = {
      path,
      newValue: value,
      oldValue: prev,
      ownerPath,
      origin,
      meta,
      projectionMeta: meta,
      declaredScopes,
      subjectId: subjectIds?.[0],
      positionId: positionIds?.[0],
      ownerId,
      subjectIds,
      positionIds,
      subjectFieldKeys: fieldKeys,
      subjectFieldFootprint: knownFootprint
    };
    this.enqueuePending(entry);
    if (!this.pendingFlush) {
      this.pendingFlush = true;
      queueMicrotask(() => this.flush());
    };
    return;
  }
  /**
   * Internal synchronous notification runner (subscribers)
   */
  _runNotify(path, value, prev, ownerPath, origin, subjectIds, positionIds, meta, declaredScopes, ownerId, subjectFieldFootprint, isolateSubscribers = false, projectionMeta) {
    const transformed = value;
    for (const [pattern, handlers] of this.subscribers) {
      if (this.matches(pattern, path)) {
        for (const handler of handlers) {
          try {
            (0,__vite_ssr_import_4__.withoutWriteObservationScopes)(
              () => handler(
                transformed,
                prev,
                path,
                ownerPath,
                origin,
                subjectIds,
                positionIds,
                this.projectionHandlers.has(handler) ? projectionMeta ?? meta : meta,
                declaredScopes,
                ownerId,
                subjectFieldFootprint
              )
            );
          } catch (error) {
            if (!isolateSubscribers) throw error;
            (0,__vite_ssr_import_9__.reportContainedObserverError)({
              error,
              operation: "notify:subscriber",
              // Entity and compensation writes name their tree in meta only.
              treeId: ownerId ?? meta?.ownerId,
              path
            });
          }
        }
      }
    };
    return;
  }
  /**
   * Flush pending batched notifications immediately.
   * This is re-entrant safe and will process notifications queued during
   * subscriber callbacks in subsequent rounds.
   */
  flush() {
    const toNotify = [
      ...this.pendingBeforeMembership,
      ...this.pending.values()
    ];
    this.pendingBeforeMembership = [];
    this.pending.clear();
    this.pendingFlush = false;
    for (const slot of toNotify)
      for (const entry of Array.isArray(slot) ? slot : [slot])
        (0,__vite_ssr_import_2__.complete)(entry.meta);
    for (const slot of toNotify) {
      const entries = Array.isArray(slot) ? slot : [slot];
      for (const entry of entries) {
        const isOwnerOnlyMarkerSignal = entry.ownerPath !== void 0 && entry.newValue === void 0 && entry.oldValue === void 0;
        const hasStructuralEffect = entry.meta?.structuralEffect !== void 0;
        if (entry.newValue === entry.oldValue && !entry.subjectFieldKeys?.length && !isOwnerOnlyMarkerSignal && !hasStructuralEffect) {
          (0,__vite_ssr_import_2__.deliverEqual)(entry);
          continue;
        };
        this._runNotify(
          entry.path,
          entry.newValue,
          entry.oldValue,
          entry.ownerPath,
          entry.origin,
          entry.subjectIds,
          entry.positionIds,
          materializeDeliveryMeta(entry.meta),
          entry.declaredScopes,
          entry.ownerId,
          entry.subjectFieldFootprint,
          true,
          entry.projectionMeta
        );
      }
    };
    for (const cb of Array.from(this.flushCallbacks)) {
      try {
        (0,__vite_ssr_import_4__.withoutWriteObservationScopes)(cb);
      } catch {
      }
    }
  }
  /**
   * Force synchronous flush of pending notifications
   */
  flushSync() {
    while (this.hasPending() || this.pendingFlush) {
      if (this.pendingFlush && !this.hasPending()) {
        this.pendingFlush = false;
        break;
      };
      this.flush();
    }
  }
  /**
   * Subscribe to flush events (called after a flush completes)
   */
  onFlush(callback) {
    this.flushCallbacks.add(callback);
    return () => this.flushCallbacks.delete(callback);
  }
  /** Internal evidence only: never drains the queue or invokes observers.
   * Include net-equal entries: an ABA write still changed ownership.
   */
  readPending() {
    return [...this.pendingBeforeMembership, ...this.pending.values()].flatMap(
      (slot) => (Array.isArray(slot) ? slot : [slot]).map((entry) => ({
        ...entry,
        subjectFieldKeys: entry.subjectFieldKeys ? [...entry.subjectFieldKeys] : void 0
      }))
    );
  }
  /**
   * Check if there are pending notifications
   */
  hasPending() {
    return this.pending.size > 0 || this.pendingBeforeMembership.length > 0;
  }
  /**
   * Simple pattern matching
   * - 'users' matches exactly 'users'
   * - 'users.*' matches 'users.u1', 'users.u2', etc.
   * - '**' matches everything
   */
  matches(pattern, path) {
    if (pattern === "**") return true;
    if (pattern === path) return true;
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix + ".");
    };
    return false;
  }
  enqueuePending(entry) {
    if ((0,__vite_ssr_import_8__.plainBranchMembershipChange)(entry.meta)) {
      for (const slot of this.pending.values())
        this.pendingBeforeMembership.push(slot);
      this.pendingBeforeMembership.push(entry);
      this.pending.clear();
      return;
    };
    const path = entry.path;
    const existing = this.pending.get(path);
    if (!existing) {
      this.pending.set(path, entry);
      return;
    };
    if (this.batchIdentityMode === "path") {
      if (Array.isArray(existing)) {
        const tail = existing[existing.length - 1];
        if (this.hasSameSemanticIdentity(tail, entry)) {
          this.coalesceEntry(tail, entry);
          return;
        };
        existing.push(entry);
        return;
      };
      if (this.hasSameSemanticIdentity(existing, entry)) {
        this.coalesceEntry(existing, entry);
        return;
      };
      this.pending.set(path, [existing, entry]);
      return;
    };
    if (this.batchIdentityMode === "path-position-subject-composite") {
      this.enqueuePendingComposite(entry);
      return;
    };
    if (Array.isArray(existing)) {
      const tail = existing[existing.length - 1];
      if (this.hasSameSemanticIdentity(tail, entry)) {
        this.coalesceEntry(tail, entry);
        return;
      };
      existing.push(entry);
      return;
    };
    if (this.hasSameSemanticIdentity(existing, entry)) {
      this.coalesceEntry(existing, entry);
      return;
    };
    this.pending.set(path, [existing, entry]);
  }
  enqueuePendingComposite(entry) {
    const compositeKey = this.getCompositeBatchKey(entry);
    const existing = this.pending.get(compositeKey);
    if (!existing) {
      this.pending.set(compositeKey, entry);
      return;
    };
    const target = Array.isArray(existing) ? existing[0] : existing;
    this.coalesceEntry(target, entry);
  }
  hasSameSemanticIdentity(left, right) {
    if (this.crossesStructuralBoundary(left, right)) {
      return false;
    };
    if (this.crossesScalarIntentBoundary(left, right)) {
      return false;
    };
    if (this.crossesCausalModeBoundary(left, right)) {
      return false;
    };
    if ((left.ownerId ?? left.meta?.ownerId) !== (right.ownerId ?? right.meta?.ownerId)) {
      return false;
    };
    if (this.batchIdentityMode === "path-position") {
      return left.positionId === right.positionId;
    };
    return left.positionId === right.positionId && left.subjectId === right.subjectId;
  }
  crossesStructuralBoundary(left, right) {
    const leftEffect = left.meta?.structuralEffect;
    const rightEffect = right.meta?.structuralEffect;
    const leftStructural = leftEffect !== void 0;
    const rightStructural = rightEffect !== void 0;
    if (leftStructural !== rightStructural) {
      return true;
    };
    if (leftStructural && rightStructural && leftEffect.kind !== rightEffect.kind) {
      return true;
    };
    return false;
  }
  crossesScalarIntentBoundary(left, right) {
    const leftIntent = left.meta?.mutationIntent;
    const rightIntent = right.meta?.mutationIntent;
    return leftIntent !== void 0 && rightIntent !== void 0 && leftIntent !== rightIntent;
  }
  crossesCausalModeBoundary(left, right) {
    return (0,__vite_ssr_import_6__.getWriteParticipation)(left.meta) !== (0,__vite_ssr_import_6__.getWriteParticipation)(right.meta) || left.origin !== right.origin || left.meta?.transactionId !== right.meta?.transactionId || left.meta?.transactionOwner !== right.meta?.transactionOwner;
  }
  coalesceEntry(target, next) {
    target.subjectFieldFootprint = target.subjectFieldFootprint === void 0 || next.subjectFieldFootprint === void 0 ? void 0 : target.subjectFieldFootprint === null || next.subjectFieldFootprint === null ? null : Object.freeze([
      .../* @__PURE__ */ new Set([
        ...target.subjectFieldFootprint,
        ...next.subjectFieldFootprint
      ])
    ]);
    target.subjectFieldKeys = target.subjectFieldKeys !== void 0 && next.subjectFieldKeys !== void 0 ? [.../* @__PURE__ */ new Set([...target.subjectFieldKeys, ...next.subjectFieldKeys])] : void 0;
    target.declaredScopes = (0,__vite_ssr_import_4__.mergeWriteObservationScopes)(
      target.declaredScopes,
      next.declaredScopes
    );
    target.newValue = next.newValue;
    target.ownerPath = next.ownerPath;
    target.origin = this.mergeOrigin(target.origin, next.origin);
    const merged = this.mergeMeta(target.meta, next.meta);
    target.projectionMeta = (0,__vite_ssr_import_0__.mergeScalarPublicationCoverage)(target.projectionMeta ?? {}, next.projectionMeta ?? {}, merged);
    target.meta = merged;
    target.subjectId = next.subjectId;
    target.positionId = next.positionId;
    target.subjectIds = next.subjectIds;
    target.positionIds = next.positionIds;
  }
  mergeOrigin(left, right) {
    if (!left && !right) return void 0;
    if (left === right) return left;
    return "mixed";
  }
  mergeMeta(left, right) {
    if (!left && !right) {
      return void 0;
    };
    if (!left || !right) {
      return void 0;
    };
    if (left.origin !== right.origin) {
      return void 0;
    };
    if (left.transactionId !== right.transactionId || left.transactionOwner !== right.transactionOwner || left.mutationIntent !== right.mutationIntent || (0,__vite_ssr_import_6__.getWriteParticipation)(left) !== (0,__vite_ssr_import_6__.getWriteParticipation)(right)) {
      return void 0;
    };
    const merged = left.structuralEffect && !right.structuralEffect ? { ...right, structuralEffect: left.structuralEffect } : right;
    return (0,__vite_ssr_import_1__.mergeEntityValueTransition)(
      left,
      right,
      (0,__vite_ssr_import_5__.isMetaDesignated)(left) ? { ...merged, ...(0,__vite_ssr_import_5__.markMetaDesignated)(void 0) } : merged
    );
  }
  getCompositeBatchKey(entry) {
    const positionKey = entry.positionIds?.join(",") ?? "";
    const subjectKey = entry.subjectIds?.join(",") ?? "";
    const participation = (0,__vite_ssr_import_6__.getWriteParticipation)(entry.meta);
    return `${entry.path}${PathNotifier.ownerBoundarySeparator}${positionKey}${PathNotifier.ownerBoundarySeparator}${subjectKey}${PathNotifier.ownerBoundarySeparator}${participation}`;
  }
  /**
   * Clear all subscribers
   */
  clear() {
    this.subscribers.clear();
    this.pending.clear();
    this.pendingBeforeMembership = [];
    this.pendingFlush = false;
  }
  /** Reset queued runtime state but preserve registered listeners. */
  onReset(callback) {
    this.resetCallbacks.add(callback);
    return () => this.resetCallbacks.delete(callback);
  }
  emitReset() {
    for (const cb of Array.from(this.resetCallbacks)) {
      try {
        (0,__vite_ssr_import_4__.withoutWriteObservationScopes)(cb);
      } catch {
      }
    }
  }
  /**
   * Get count of active subscribers (for debugging)
   */
  getSubscriberCount() {
    let count = 0;
    for (const handlers of this.subscribers.values()) {
      count += handlers.size;
    };
    return count;
  }
};
let globalPathNotifier = null;
function getPathNotifier() {
  if (!globalPathNotifier) {
    globalPathNotifier = new PathNotifier();
  };
  (0,__vite_ssr_import_7__.installPathDeliveryRuntime)(globalPathNotifier);
  (0,__vite_ssr_import_7__.installBranchMembershipCapture)(
    (0,__vite_ssr_import_8__.capturePlainBranchMembership),
    (0,__vite_ssr_import_8__.capturePathReAdd)
  );
  return globalPathNotifier;
};
function resetPathNotifier() {
  if (!globalPathNotifier) {
    globalPathNotifier = new PathNotifier();
    return;
  };
  globalPathNotifier.clear();
  globalPathNotifier.setBatchingEnabled(true);
  globalPathNotifier.emitReset();
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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V0FBTyxNQUFNLEtBQUssZUFBZSxPQUFPLFFBQVE7QUFBQSxFQUNsRDtBQUFBLEVBRUEsWUFBa0I7QUFDaEIsZUFBVyxNQUFNLE1BQU0sS0FBSyxLQUFLLGNBQWMsR0FBRztBQUNoRCxVQUFJO0FBQ0YsZ0VBQThCLEVBQUU7QUFBQSxNQUNsQyxRQUFRO0FBQUEsTUFFUjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxxQkFBNkI7QUFDM0IsUUFBSSxRQUFRO0FBQ1osZUFBVyxZQUFZLEtBQUssWUFBWSxPQUFPLEdBQUc7QUFDaEQsZUFBUyxTQUFTO0FBQUEsSUFDcEI7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUNGO0FBTUEsSUFBSSxxQkFBMEM7QUFPdkMsU0FBUyxrQkFBZ0M7QUFDOUMsTUFBSSxDQUFDLG9CQUFvQjtBQUN2Qix5QkFBcUIsSUFBSSxhQUFhO0FBQUEsRUFDeEM7QUFPQSx1REFBMkIsa0JBQWtCO0FBQzdDO0FBQUEsT0FDRTtBQUFBLE9BQ0E7QUFBQSxFQUNGO0FBQ0EsU0FBTztBQUNUO0FBT08sU0FBUyxvQkFBMEI7QUFLeEMsTUFBSSxDQUFDLG9CQUFvQjtBQUN2Qix5QkFBcUIsSUFBSSxhQUFhO0FBQ3RDO0FBQUEsRUFDRjtBQUVBLHFCQUFtQixNQUFNO0FBQ3pCLHFCQUFtQixtQkFBbUIsSUFBSTtBQUMxQyxxQkFBbUIsVUFBVTtBQUMvQiIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsicGF0aC1ub3RpZmllci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtZXJnZVNjYWxhclB1YmxpY2F0aW9uQ292ZXJhZ2UgfSBmcm9tICcuL2ludGVybmFscy9zY2FsYXItcHVibGljYXRpb24tY292ZXJhZ2UnO1xuaW1wb3J0IHtcbiAgZW50aXR5VmFsdWVUcmFuc2l0aW9uLFxuICBtZXJnZUVudGl0eVZhbHVlVHJhbnNpdGlvbixcbn0gZnJvbSAnLi9pbnRlcm5hbHMvZW50aXR5LXZhbHVlLXRyYW5zaXRpb24nO1xuaW1wb3J0IHtcbiAgYW5ub3RhdGUgYXMgcmVzZWFyY2hBbm5vdGF0ZSxcbiAgY29tcGxldGUgYXMgcmVzZWFyY2hDb21wbGV0ZSxcbiAgc3RhbXBTb3VyY2UgYXMgcmVzZWFyY2hTdGFtcFNvdXJjZSxcbiAgZGVsaXZlckVxdWFsIGFzIHJlc2VhcmNoRGVsaXZlckVxdWFsLFxufSBmcm9tICcuL2V4cGVyaW1lbnRhbC1wdWJsaWNhdGlvbi9wcml2YXRlJztcbi8qKlxuICogUGF0aE5vdGlmaWVyIC0gU2ltcGxlIGludGVybmFsIG5vdGlmaWNhdGlvbiBzeXN0ZW0gZm9yIGFsbCBtdXRhdGlvbnNcbiAqXG4gKiBFbmFibGVzOlxuICogLSBFbnRpdHkgaG9va3MgKHRhcCwgaW50ZXJjZXB0KSB0byB3b3JrIHdpdGhvdXQgZ2xvYmFsIHN0YXRlXG4gKiAtIEVuaGFuY2VycyAoUGVyc2lzdGVuY2UsIFJlc3RvcmF0aW9uLCBEZXZUb29scykgdG8gY2F0Y2ggYWxsIG11dGF0aW9uc1xuICogLSBDbGVhbiBwYXRoLWJhc2VkIHN1YnNjcmlwdGlvbiBwYXR0ZXJuXG4gKlxuICogQGludGVybmFsXG4gKi9cblxuaW1wb3J0IHsgZ2V0QWN0aXZlV3JpdGVDb250ZXh0IH0gZnJvbSAnLi93cml0ZS1jb250ZXh0JztcbmltcG9ydCB7XG4gIGN1cnJlbnRXcml0ZU9ic2VydmF0aW9uU2NvcGVzLFxuICBtZXJnZVdyaXRlT2JzZXJ2YXRpb25TY29wZXMsXG4gIHdpdGhvdXRXcml0ZU9ic2VydmF0aW9uU2NvcGVzLFxuICB0eXBlIERlY2xhcmVkV3JpdGVTY29wZXMsXG59IGZyb20gJy4vaW50ZXJuYWxzL3dyaXRlLW9ic2VydmF0aW9uLXNjb3BlJztcbmltcG9ydCB7XG4gIGlzUmVzdG9yYXRpb25EZXNpZ25hdGVkLFxuICBpc01ldGFEZXNpZ25hdGVkLFxuICBtYXJrTWV0YURlc2lnbmF0ZWQsXG59IGZyb20gJy4vaW50ZXJuYWxzL3Jlc3RvcmF0aW9uLWVsaWdpYmlsaXR5JztcblxuaW1wb3J0IHsgZ2V0V3JpdGVQYXJ0aWNpcGF0aW9uIH0gZnJvbSAnLi93cml0ZS1wYXJ0aWNpcGF0aW9uJztcblxuaW1wb3J0IHtcbiAgaW5zdGFsbFBhdGhEZWxpdmVyeVJ1bnRpbWUsXG4gIGluc3RhbGxCcmFuY2hNZW1iZXJzaGlwQ2FwdHVyZSxcbn0gZnJvbSAnLi9pbnRlcm5hbHMvcGF0aC1vYnNlcnZhdGlvbi1wb3J0JztcbmltcG9ydCB7XG4gIGNhcHR1cmVQYXRoUmVBZGQsXG4gIGNhcHR1cmVQbGFpbkJyYW5jaE1lbWJlcnNoaXAsXG4gIHBsYWluQnJhbmNoTWVtYmVyc2hpcENoYW5nZSxcbn0gZnJvbSAnLi9pbnRlcm5hbHMvcGxhaW4tYnJhbmNoLW1lbWJlcnNoaXAnO1xuaW1wb3J0IHsgcmVwb3J0Q29udGFpbmVkT2JzZXJ2ZXJFcnJvciB9IGZyb20gJy4vaW50ZXJuYWxzL2Vycm9yLXJlcG9ydGVyJztcbmltcG9ydCB0eXBlIHsgVHJlZUlkIH0gZnJvbSAnLi9pbnRlcm5hbHMvcG9zaXRpb24tcmVnaXN0cnknO1xuaW1wb3J0IHR5cGUgeyBXcml0ZU1ldGFkYXRhIH0gZnJvbSAnLi9tdXRhdGlvbi10eXBlcyc7XG5cbmV4cG9ydCB0eXBlIFBhdGhOb3RpZmllckhhbmRsZXIgPSAoXG4gIHZhbHVlOiB1bmtub3duLFxuICBwcmV2OiB1bmtub3duLFxuICBwYXRoOiBzdHJpbmcsXG4gIG93bmVyUGF0aD86IHN0cmluZyxcbiAgb3JpZ2luPzogc3RyaW5nLFxuICBzdWJqZWN0SWRzPzogbnVtYmVyW10sXG4gIHBvc2l0aW9uSWRzPzogbnVtYmVyW10sXG4gIG1ldGE/OiBXcml0ZU1ldGFkYXRhLFxuICBkZWNsYXJlZFNjb3Blcz86IERlY2xhcmVkV3JpdGVTY29wZXMsXG4gIG93bmVySWQ/OiBudW1iZXIsXG4gIC8qKiBAaW50ZXJuYWwgbnVsbCBtZWFucyBleHBsaWNpdCB3aG9sZS1yb3cgcmVwbGFjZW1lbnQ7IHVuZGVmaW5lZCB1bmF2YWlsYWJsZS4gKi9cbiAgc3ViamVjdEZpZWxkRm9vdHByaW50PzogcmVhZG9ubHkgc3RyaW5nW10gfCBudWxsXG4pID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG50eXBlIEJhdGNoSWRlbnRpdHlNb2RlID1cbiAgfCAncGF0aCdcbiAgfCAncGF0aC1wb3NpdGlvbidcbiAgfCAncGF0aC1wb3NpdGlvbi1zdWJqZWN0J1xuICB8ICdwYXRoLXBvc2l0aW9uLXN1YmplY3QtY29tcG9zaXRlJztcblxudHlwZSBQZW5kaW5nRW50cnkgPSB7XG4gIHBhdGg6IHN0cmluZztcbiAgbmV3VmFsdWU6IHVua25vd247XG4gIG9sZFZhbHVlOiB1bmtub3duO1xuICBvd25lclBhdGg/OiBzdHJpbmc7XG4gIG9yaWdpbj86IHN0cmluZztcbiAgbWV0YT86IFdyaXRlTWV0YWRhdGE7XG4gIHByb2plY3Rpb25NZXRhPzogV3JpdGVNZXRhZGF0YTtcbiAgZGVjbGFyZWRTY29wZXM/OiBEZWNsYXJlZFdyaXRlU2NvcGVzO1xuICBzdWJqZWN0SWQ/OiBudW1iZXI7XG4gIHBvc2l0aW9uSWQ/OiBudW1iZXI7XG4gIC8qKlxuICAgKiBOT1RJRklFUi1TQ09QRS0wLiBgcG9zaXRpb25JZGAgaXMgYWxsb2NhdGVkIFBFUiBSRUdJU1RSWSwgc28gdHdvIHRyZWVzIGJvdGhcbiAgICogY2FsbCB0aGVpciBmaXJzdCBsZWFmIDIgYW5kIGBoYXNTYW1lU2VtYW50aWNJZGVudGl0eWAgY29hbGVzY2VkIHRoZW0gaW50b1xuICAgKiBvbmUgZGVsaXZlcnkg4oCUIHNpbGVudGx5IGRyb3BwaW5nIGEgd3JpdGUsIGFuZCB3aXRoIGl0IGEgcmVzdG9yYXRpb24gZW50cnlcbiAgICogYW5kIGEgdHJhbnNhY3Rpb24gY29tcGVuc2F0aW9uLiBUaGUgbmFtZXNwYWNlIHF1YWxpZmllcyB0aGUgbnVtYmVyLlxuICAgKi9cbiAgb3duZXJJZD86IG51bWJlcjtcbiAgc3ViamVjdElkcz86IG51bWJlcltdO1xuICBwb3NpdGlvbklkcz86IG51bWJlcltdO1xuICAvKipcbiAgICogQ29tcGxldGUgdG9wLWxldmVsIGZpZWxkIGZvb3RwcmludCBmcm9tIHF1ZXVlZCBzaW5nbGUtc3ViamVjdCByb3cgd3JpdGVzLlxuICAgKiBMaXRlcmFsIGtleXMsIG5ldmVyIHBhcnNlZCBwYXRocy4gRW1wdHkgbWVhbnMga25vd24gdW5jaGFuZ2VkOyB1bmRlZmluZWRcbiAgICogbWVhbnMgdGhpcyBxdWV1ZSBlbnRyeSBjYW5ub3Qgc3VwcGx5IGEgY29tcGxldGUgZmllbGQgZm9vdHByaW50LlxuICAgKi9cbiAgc3ViamVjdEZpZWxkS2V5cz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuICBzdWJqZWN0RmllbGRGb290cHJpbnQ/OiByZWFkb25seSBzdHJpbmdbXSB8IG51bGw7XG59O1xuXG50eXBlIFBlbmRpbmdTbG90ID0gUGVuZGluZ0VudHJ5IHwgUGVuZGluZ0VudHJ5W107XG5cbmNvbnN0IGlzUGxhaW5Sb3dSZWNvcmQgPSAodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9PiB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIHJldHVybiBwcm90b3R5cGUgPT09IG51bGwgfHwgcHJvdG90eXBlID09PSBPYmplY3QucHJvdG90eXBlO1xufTtcblxuY29uc3QgY2hhbmdlZFN1YmplY3RGaWVsZEtleXMgPSAoXG4gIGJlZm9yZTogdW5rbm93bixcbiAgYWZ0ZXI6IHVua25vd24sXG4gIHN1YmplY3RJZHM/OiByZWFkb25seSBudW1iZXJbXVxuKTogcmVhZG9ubHkgc3RyaW5nW10gfCB1bmRlZmluZWQgPT4ge1xuICBpZiAoXG4gICAgc3ViamVjdElkcz8ubGVuZ3RoICE9PSAxIHx8XG4gICAgIWlzUGxhaW5Sb3dSZWNvcmQoYmVmb3JlKSB8fFxuICAgICFpc1BsYWluUm93UmVjb3JkKGFmdGVyKVxuICApIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiBbLi4ubmV3IFNldChbLi4uT2JqZWN0LmtleXMoYmVmb3JlKSwgLi4uT2JqZWN0LmtleXMoYWZ0ZXIpXSldLmZpbHRlcihcbiAgICAoa2V5KSA9PlxuICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGJlZm9yZSwga2V5KSAhPT1cbiAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFmdGVyLCBrZXkpIHx8XG4gICAgICAhT2JqZWN0LmlzKGJlZm9yZVtrZXldLCBhZnRlcltrZXldKVxuICApO1xufTtcblxuY29uc3QgbWF0ZXJpYWxpemVEZWxpdmVyeU1ldGEgPSAoXG4gIG1ldGE/OiBXcml0ZU1ldGFkYXRhXG4pOiBXcml0ZU1ldGFkYXRhIHwgdW5kZWZpbmVkID0+IHtcbiAgaWYgKCFtZXRhPy5zdHJ1Y3R1cmFsRWZmZWN0KSB7XG4gICAgcmV0dXJuIG1ldGE7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLm1ldGEsXG4gICAgc3RydWN0dXJhbEVmZmVjdDogT2JqZWN0LmZyZWV6ZSh7IC4uLm1ldGEuc3RydWN0dXJhbEVmZmVjdCB9KSxcbiAgfTtcbn07XG5cbi8qKlxuICogU2ltcGxlIHBhdGgtYmFzZWQgbm90aWZpY2F0aW9uIHN5c3RlbVxuICogVXNlZCBpbnRlcm5hbGx5IGJ5IFNpZ25hbFRyZWUgZm9yIGVudGl0eSBob29rcyBhbmQgZW5oYW5jZXJzLlxuICogQWNjZXNzIHZpYSBnZXRQYXRoTm90aWZpZXIoKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhdGhOb3RpZmllciB7XG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IG93bmVyQm91bmRhcnlTZXBhcmF0b3IgPSAnXFx1MDAwMCc7XG5cbiAgLy8gTWFwIG9mIHBhdHRlcm4gLT4gU2V0IG9mIGhhbmRsZXJzXG4gIHByaXZhdGUgc3Vic2NyaWJlcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PFBhdGhOb3RpZmllckhhbmRsZXI+PigpO1xuICBwcml2YXRlIHByb2plY3Rpb25IYW5kbGVycyA9IG5ldyBXZWFrU2V0PFBhdGhOb3RpZmllckhhbmRsZXI+KCk7XG5cbiAgLy8gQmF0Y2hpbmcgc3RhdGVcbiAgcHJpdmF0ZSByZXNldENhbGxiYWNrcyA9IG5ldyBTZXQ8KCkgPT4gdm9pZD4oKTtcbiAgcHJpdmF0ZSBiYXRjaGluZ0VuYWJsZWQgPSB0cnVlO1xuICBwcml2YXRlIGJhdGNoSWRlbnRpdHlNb2RlOiBCYXRjaElkZW50aXR5TW9kZSA9ICdwYXRoLXBvc2l0aW9uLXN1YmplY3QnO1xuICBwcml2YXRlIHBlbmRpbmdGbHVzaCA9IGZhbHNlO1xuICBwcml2YXRlIHBlbmRpbmcgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ1Nsb3Q+KCk7XG4gIHByaXZhdGUgcGVuZGluZ0JlZm9yZU1lbWJlcnNoaXA6IFBlbmRpbmdTbG90W10gPSBbXTtcbiAgcHJpdmF0ZSBmbHVzaENhbGxiYWNrcyA9IG5ldyBTZXQ8KCkgPT4gdm9pZD4oKTtcblxuICAvKipcbiAgICogQGludGVybmFsIEluc3RhbGxlZCB3aGlsZSBhIHJldmVyc2FsIG9yIHJvbGxiYWNrIGFwcGxpZXNcbiAgICogKGBwdWJsaXNoaW5nRXhwb3NlZE9ubHlgKTogdHJ1ZSBmb3IgYSByZWFsaXplZCB3cml0ZSB0byBhIGxvY2F0aW9uIHRoZVxuICAgKiBvcGVyYXRpb24gbGVhdmVzIGFic2VudCwgd2hpY2ggaXMgdGhlbiBub3QgcHVibGlzaGVkLiBQYXRoIG9ic2VydmVycyBzZWVcbiAgICogd2hhdCB0aGUgdHJlZSBleHBvc2VzLCBuZXZlciByZXRhaW5lZCBzdG9yYWdlICh2MTUgYzYyNThhYWIsIHYxNiA4ZykuXG4gICAqL1xuICBhYnNlbnRSZWFsaXplZD86IChcbiAgICBwb3NpdGlvbklkczogbnVtYmVyW10gfCB1bmRlZmluZWQsXG4gICAgbWV0YTogV3JpdGVNZXRhZGF0YSB8IHVuZGVmaW5lZFxuICApID0+IGJvb2xlYW47XG4gIHByaXZhdGUgZW5xdWV1ZU9ic2VydmVycyA9IG5ldyBNYXA8XG4gICAgbnVtYmVyLFxuICAgIFNldDwoZW50cnk6IFJlYWRvbmx5PFBlbmRpbmdFbnRyeT4pID0+IHZvaWQ+XG4gID4oKTtcblxuICAvKiogQGludGVybmFsIE93bmVyLXNjb3BlZCBldmlkZW5jZSBiZWZvcmUgYmF0Y2hpbmcgY2FuIGRpc2NhcmQgY2hyb25vbG9neS4gKi9cbiAgb2JzZXJ2ZUVucXVldWUoXG4gICAgb3duZXJJZDogbnVtYmVyLFxuICAgIGxpc3RlbmVyOiAoZW50cnk6IFJlYWRvbmx5PFBlbmRpbmdFbnRyeT4pID0+IHZvaWRcbiAgKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuZW5xdWV1ZU9ic2VydmVycy5nZXQob3duZXJJZCk7XG4gICAgaWYgKCFsaXN0ZW5lcnMpIHRoaXMuZW5xdWV1ZU9ic2VydmVycy5zZXQob3duZXJJZCwgKGxpc3RlbmVycyA9IG5ldyBTZXQoKSkpO1xuICAgIGxpc3RlbmVycy5hZGQobGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBsaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgIGlmIChcbiAgICAgICAgbGlzdGVuZXJzLnNpemUgPT09IDAgJiZcbiAgICAgICAgdGhpcy5lbnF1ZXVlT2JzZXJ2ZXJzLmdldChvd25lcklkKSA9PT0gbGlzdGVuZXJzXG4gICAgICApXG4gICAgICAgIHRoaXMuZW5xdWV1ZU9ic2VydmVycy5kZWxldGUob3duZXJJZCk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiB7IGJhdGNoaW5nPzogYm9vbGVhbiB9KSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5iYXRjaGluZyA9PT0gZmFsc2UpIHRoaXMuYmF0Y2hpbmdFbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogRW5hYmxlIG9yIGRpc2FibGUgYmF0Y2hpbmcgYXQgcnVudGltZSAoZ2xvYmFsIG9wdC1vdXQpXG4gICAqL1xuICBzZXRCYXRjaGluZ0VuYWJsZWQoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuYmF0Y2hpbmdFbmFibGVkID0gZW5hYmxlZDtcbiAgfVxuXG4gIGlzQmF0Y2hpbmdFbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmJhdGNoaW5nRW5hYmxlZDtcbiAgfVxuXG4gIGhhc09ic2VydmVycygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zdWJzY3JpYmVycy5zaXplID4gMCB8fCB0aGlzLmZsdXNoQ2FsbGJhY2tzLnNpemUgPiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIOKaoO+4jyBSRVRVUk5TIFZPSUQgU0lOQ0UgMTUuMC4gSXQgdXNlZCB0byByZXR1cm4gYHsgYmxvY2tlZCwgdmFsdWUgfWAsIHRoZVxuICAgKiByZXN1bHQgcHJvdG9jb2wgb2YgdGhlIGRlbGV0ZWQgZGVsaXZlcnkgaW50ZXJjZXB0b3JzLiBUaGUgb25seSBwcm9kdWNlciDigJRcbiAgICogYG93bmVkLW11dGF0aW9uYCDigJQgYWxyZWFkeSBkaXNjYXJkZWQgaXQsIGFuZCBubyBzdXJ2aXZpbmcgY2FsbGVyIGNvbnN1bWVkXG4gICAqIGl0LiBLZWVwaW5nIHRoZSBzaGFwZSB3b3VsZCBoYXZlIHByZXNlcnZlZCBhcmNoYWVvbG9naWNhbCBldmlkZW5jZSBvZiBhXG4gICAqIHJldGlyZWQgbWVjaGFuaXNtIGFzIHRob3VnaCBpdCB3ZXJlIGEgY29udHJhY3QuXG4gICAqL1xuICAvLyDimqDvuI8gYGVtaXRNdXRhdGlvbihlbnZlbG9wZSlgIFdBUyBERUxFVEVEIElOIDE1LjAg4oCUIE1FLUIsXG4gIC8vIE1VVEFUSU9OLUVOVkVMT1BFLU9XTkVSU0hJUC0wLlxuICAvL1xuICAvLyBJdCB3YXMgYSBwdXJlIGFkYXB0ZXI6IHVucGFjayBhIGBNdXRhdGlvbkVudmVsb3BlYCBwcm9kdWNlZCBieSBleGFjdGx5IG9uZVxuICAvLyBjYWxsZXIgYW5kIGltbWVkaWF0ZWx5IGNhbGwgYHRoaXMubm90aWZ5KC4uLilgIGZpZWxkLWZvci1maWVsZC4gTm8gZGVjaXNpb25cbiAgLy8gd2FzIG1hZGUgYXQgdGhhdCBib3VuZGFyeSDigJQgaXQgam9pbmVkIHBhdGggc2VnbWVudHMgdGhlIHNhbWUgY2FsbGVyIGhhZFxuICAvLyBqdXN0IHNwbGl0LCBhbmQgcmV3cmFwcGVkIGEgcG9zaXRpb24gaWQgdGhlIHNhbWUgY2FsbGVyIGhhZCBqdXN0IHVud3JhcHBlZC5cbiAgLy9cbiAgLy8gICAgIE9ORSBTRU1BTlRJQyBQVUJMSUNBVElPTiBKT0IsIE9ORSBQT1JUIE9QRVJBVElPTi5cbiAgLy9cbiAgLy8gYG93bmVkLW11dGF0aW9uYCBub3cgY2FsbHMgYG5vdGlmeWAgdGhyb3VnaCB0aGUgcG9ydCBkaXJlY3RseS4gRG8gbm90XG4gIC8vIHJlaW50cm9kdWNlIGEgcGFyYW1ldGVyIG9iamVjdCBCRVNJREUgdGhpcyBwcm90b2NvbDsgdGhhdCByZWNyZWF0ZXMgdGhlXG4gIC8vIGR1YWwtcHJvdG9jb2wgcHJvYmxlbSB0aGlzIGRlbGV0aW9uIHJlbW92ZWQuIFJlcGxhY2luZyB0aGUgcG9zaXRpb25hbFxuICAvLyBzaWduYXR1cmUgSU4gUExBQ0UsIGRlcml2ZWQgZnJvbSBhbGwgcHJvZHVjZXJzIGFuZCBjb25zdW1lcnMsIGlzIGFkbWlzc2libGVcbiAgLy8gcmVwcmVzZW50YXRpb24gY2xlYW51cCDigJQgYWRkaW5nIGEgc2Vjb25kIGVudHJ5IHBvaW50IGlzIG5vdC5cblxuICAvKiogQGludGVybmFsIEJlbmNoL3Rlc3Qtb25seSBob29rIHRvIGlzb2xhdGUgYmF0Y2hpbmcta2V5IG92ZXJoZWFkLiAqL1xuICBzZXRCYXRjaElkZW50aXR5TW9kZUZvclRlc3RpbmcoXG4gICAgbW9kZTogQmF0Y2hJZGVudGl0eU1vZGUgPSAncGF0aC1wb3NpdGlvbi1zdWJqZWN0J1xuICApOiB2b2lkIHtcbiAgICB0aGlzLmJhdGNoSWRlbnRpdHlNb2RlID0gbW9kZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgdG8gbXV0YXRpb25zIG1hdGNoaW5nIGEgcGF0aCBwYXR0ZXJuXG4gICAqIFJldHVybnMgdW5zdWJzY3JpYmUgZnVuY3Rpb25cbiAgICovXG4gIC8qKiBJbnRlcm5hbCBwcm9qZWN0aW9uIHZpZXcgcmV0YWlucyBjb25zdGl0dWVudCByZWNlaXB0cyB3aXRob3V0IGNoYW5naW5nXG4gICAqIG9yZGluYXJ5IHN1YnNjcmliZXJzJyBjb2FsZXNjZWQgbWV0YWRhdGEgb3IgY2FsbGJhY2sgY291bnQuICovXG4gIHN1YnNjcmliZVByb2plY3Rpb24oaGFuZGxlcjogUGF0aE5vdGlmaWVySGFuZGxlcik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMucHJvamVjdGlvbkhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgICBjb25zdCByZWxlYXNlPXRoaXMuc3Vic2NyaWJlKCcqKicsaGFuZGxlcik7XG4gICAgcmV0dXJuICgpPT57dGhpcy5wcm9qZWN0aW9uSGFuZGxlcnMuZGVsZXRlKGhhbmRsZXIpO3JlbGVhc2UoKTt9O1xuICB9XG5cbiAgc3Vic2NyaWJlKHBhdHRlcm46IHN0cmluZywgaGFuZGxlcjogUGF0aE5vdGlmaWVySGFuZGxlcik6ICgpID0+IHZvaWQge1xuICAgIGlmICghdGhpcy5zdWJzY3JpYmVycy5oYXMocGF0dGVybikpIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnMuc2V0KHBhdHRlcm4sIG5ldyBTZXQoKSk7XG4gICAgfVxuICAgIGNvbnN0IGhhbmRsZXJzID0gdGhpcy5zdWJzY3JpYmVycy5nZXQocGF0dGVybik7XG4gICAgaWYgKCFoYW5kbGVycykge1xuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgLy8gTm8tb3A6IHBhdHRlcm4gd2FzIG5vdCBmb3VuZFxuICAgICAgfTtcbiAgICB9XG4gICAgaGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuXG4gICAgLy8gUmV0dXJuIHVuc3Vic2NyaWJlIGZ1bmN0aW9uXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGhhbmRsZXJzLmRlbGV0ZShoYW5kbGVyKTtcbiAgICAgIGlmIChoYW5kbGVycy5zaXplID09PSAwKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaWJlcnMuZGVsZXRlKHBhdHRlcm4pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogTm90aWZ5IGFsbCBzdWJzY3JpYmVycyBtYXRjaGluZyB0aGUgcGF0aFxuICAgKiBXaGVuIGJhdGNoaW5nIGlzIGVuYWJsZWQsIG5vdGlmaWNhdGlvbnMgYXJlIHF1ZXVlZCBhbmQgZmx1c2hlZCBhdFxuICAgKiB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IG1pY3JvdGFzayAodmlhIHF1ZXVlTWljcm90YXNrKS5cbiAgICovXG4gIG5vdGlmeShcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgdmFsdWU6IHVua25vd24sXG4gICAgcHJldjogdW5rbm93bixcbiAgICBvd25lclBhdGg/OiBzdHJpbmcsXG4gICAgc3ViamVjdElkcz86IG51bWJlcltdLFxuICAgIHBvc2l0aW9uSWRzPzogbnVtYmVyW10sXG4gICAgbWV0YU92ZXJyaWRlPzogV3JpdGVNZXRhZGF0YSxcbiAgICBvd25lcklkPzogbnVtYmVyLFxuICAgIHN1YmplY3RGaWVsZEZvb3RwcmludD86IHJlYWRvbmx5IHN0cmluZ1tdIHwgbnVsbFxuICApOiB2b2lkIHtcbiAgICBjb25zdCBhbWJpZW50TWV0YSA9IG1ldGFPdmVycmlkZSA/PyBnZXRBY3RpdmVXcml0ZUNvbnRleHQoKTtcbiAgICBpZiAodGhpcy5hYnNlbnRSZWFsaXplZD8uKHBvc2l0aW9uSWRzLCBhbWJpZW50TWV0YSkpIHJldHVybjtcbiAgICAvLyBISVNULUMyLiBDYXB0dXJlZCBIRVJFLCBhdCB0aGUgc3luY2hyb25vdXMgb2JzZXJ2YXRpb24gb2YgdGhlIHdyaXRlLCBmb3JcbiAgICAvLyBleGFjdGx5IHRoZSByZWFzb24gdGhlIGBvcmlnaW5gIGNvbW1lbnQgYmVsb3cgZ2l2ZXM6IHRoZSBmbHVzaCB0aGF0XG4gICAgLy8gZGVsaXZlcnMgdGhpcyBlbnRyeSBpcyBkZWZlcnJlZCB0byBhIG1pY3JvdGFzaywgc28gYSBkZXNpZ25hdGlvbiBzY29wZVxuICAgIC8vIHRoYXQgaGFzIGFscmVhZHkgcmV0dXJuZWQgaXMgaW52aXNpYmxlIHRvIHRoZSByZWNvcmRlci4gTWVhc3VyZWQg4oCUIGFsbFxuICAgIC8vIHRocmVlIGBjYXB0dXJlSW50b0J1Y2tldGAgY2FsbHMgZm9yIG9uZSBkZXNpZ25hdGVkIHRpY2sgcmFuIGFmdGVyIHRoZVxuICAgIC8vIHNjb3BlIGhhZCBleGl0ZWQuXG4gICAgY29uc3QgbWV0YUJlZm9yZU93bmVyOiBXcml0ZU1ldGFkYXRhIHwgdW5kZWZpbmVkID0gaXNSZXN0b3JhdGlvbkRlc2lnbmF0ZWQoKVxuICAgICAgPyBtYXJrTWV0YURlc2lnbmF0ZWQoYW1iaWVudE1ldGEpXG4gICAgICA6IGFtYmllbnRNZXRhO1xuICAgIC8vIFRhZyB0aGUgYmF0Y2ggd2l0aCB0aGUgYW1iaWVudCB3cml0ZSBvcmlnaW4gKGUuZy4gYHJlc3RvcmF0aW9uYCBkdXJpbmcgYVxuICAgIC8vIGhpc3RvcnkgcmVzdG9yZSkuIFRoZSBmbHVzaCB0aGF0IGRlbGl2ZXJzIHRoaXMgZW50cnkgaXMgREVGRVJSRUQgdG8gYVxuICAgIC8vIG1pY3JvdGFzaywgc28gY29uc3VtZXJzIG11c3QgYmUgYWJsZSB0byB0ZWxsIFwidGhpcyB3cml0ZSBjYW1lIGZyb20gYVxuICAgIC8vIHJlc3RvcmVcIiBhcGFydCBmcm9tIGEgdXNlciBjaGFuZ2UgYXQgZmx1c2ggdGltZSDigJQgYGlzUmVzdG9yaW5nYC1zdHlsZVxuICAgIC8vIGZsYWdzIHRoYXQgcmVzZXQgc3luY2hyb25vdXNseSBhcmUgYWxyZWFkeSBmYWxzZSBieSB0aGVuLlxuICAgIC8vIFRoZSBuYW1lc3BhY2UgdHJhdmVscyBXSVRIIHRoZSB3cml0ZSwgc28gYSBgJyoqJ2Agc3Vic2NyaWJlciBjYW4gdGVsbFxuICAgIC8vIHdob3NlIHRyZWUgaXQgYmVsb25ncyB0by4gRm9sZGVkIGluIGhlcmUgcmF0aGVyIHRoYW4gYWRkZWQgYXMgYSBkZWxpdmVyeVxuICAgIC8vIHBhcmFtZXRlcjogZXZlcnkgY29uc3VtZXIgYWxyZWFkeSByZWNlaXZlcyBgbWV0YWAsIGFuZCB0aGUgaGFuZGxlclxuICAgIC8vIHNpZ25hdHVyZSBpcyBlbmhhbmNlci1mYWNpbmcuXG4gICAgbGV0IG1ldGEgPVxuICAgICAgb3duZXJJZCA9PT0gdW5kZWZpbmVkXG4gICAgICAgID8gbWV0YUJlZm9yZU93bmVyXG4gICAgICAgIDogeyAuLi4obWV0YUJlZm9yZU93bmVyID8/IHt9KSwgb3duZXJJZCB9O1xuXG4gICAgY29uc3QgZGVjbGFyZWRTY29wZXMgPSBjdXJyZW50V3JpdGVPYnNlcnZhdGlvblNjb3Blcyhvd25lcklkKTtcbiAgICBjb25zdCBvcmlnaW4gPSBtZXRhPy5vcmlnaW47XG4gICAgY29uc3QgZXZpZGVuY2VPd25lciA9IG93bmVySWQgPz8gbWV0YT8ub3duZXJJZDtcbiAgICBjb25zdCBldmlkZW5jZUxpc3RlbmVycyA9XG4gICAgICBldmlkZW5jZU93bmVyID09PSB1bmRlZmluZWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiB0aGlzLmVucXVldWVPYnNlcnZlcnMuZ2V0KGV2aWRlbmNlT3duZXIpO1xuICAgIGlmIChldmlkZW5jZUxpc3RlbmVycz8uc2l6ZSkge1xuICAgICAgLy8gQ29weSBtZXRhZGF0YSBhbmQgaWRlbnRpdGllcyBiZWZvcmUgY29hbGVzY2luZyBtdXRhdGVzIHRoZSBxdWV1ZWQgZW50cnkuXG4gICAgICAvLyBQYXlsb2FkcyByZW1haW4gb3BhcXVlOyBjb25zdW1lcnMgcmV0YWluIGZvb3RwcmludHMsIG5vdCB0aGVzZSB2YWx1ZXMuXG4gICAgICBjb25zdCBzbmFwc2hvdCA9IE9iamVjdC5mcmVlemUoe1xuICAgICAgICBwYXRoLFxuICAgICAgICBuZXdWYWx1ZTogdmFsdWUsXG4gICAgICAgIG9sZFZhbHVlOiBwcmV2LFxuICAgICAgICBvd25lclBhdGgsXG4gICAgICAgIG9yaWdpbixcbiAgICAgICAgb3duZXJJZDogZXZpZGVuY2VPd25lcixcbiAgICAgICAgbWV0YTogbWV0YVxuICAgICAgICAgID8gT2JqZWN0LmZyZWV6ZSh7IC4uLm1hdGVyaWFsaXplRGVsaXZlcnlNZXRhKG1ldGEpIH0pXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIHBvc2l0aW9uSWRzOiBwb3NpdGlvbklkcyA/IFsuLi5wb3NpdGlvbklkc10gOiB1bmRlZmluZWQsXG4gICAgICAgIHN1YmplY3RJZHM6IHN1YmplY3RJZHMgPyBbLi4uc3ViamVjdElkc10gOiB1bmRlZmluZWQsXG4gICAgICB9KTtcbiAgICAgIGlmIChzbmFwc2hvdC5wb3NpdGlvbklkcykgT2JqZWN0LmZyZWV6ZShzbmFwc2hvdC5wb3NpdGlvbklkcyk7XG4gICAgICBpZiAoc25hcHNob3Quc3ViamVjdElkcykgT2JqZWN0LmZyZWV6ZShzbmFwc2hvdC5zdWJqZWN0SWRzKTtcbiAgICAgIGZvciAoY29uc3QgbGlzdGVuZXIgb2YgWy4uLmV2aWRlbmNlTGlzdGVuZXJzXSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdpdGhvdXRXcml0ZU9ic2VydmF0aW9uU2NvcGVzKCgpID0+IGxpc3RlbmVyKHNuYXBzaG90KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgLy8gT2JzZXJ2YXRpb24gY2Fubm90IHZldG8gYSBtdXRhdGlvbiB0aGF0IGhhcyBhbHJlYWR5IGhhcHBlbmVkLlxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdTaWduYWxUcmVlOiBlbnF1ZXVlIG9ic2VydmF0aW9uIGZhaWxlZC4nLCBlcnJvcik7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvKiByZXBvcnRpbmcgY2Fubm90IHZldG8gZWl0aGVyICovXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHRyYW5zaXRpb24gPSBlbnRpdHlWYWx1ZVRyYW5zaXRpb24obWV0YSk7XG4gICAgY29uc3QgZmllbGRLZXlzID0gY2hhbmdlZFN1YmplY3RGaWVsZEtleXMoXG4gICAgICB0cmFuc2l0aW9uID8gdHJhbnNpdGlvbi5vcmRpbmFyeUJlZm9yZSA6IHByZXYsXG4gICAgICB0cmFuc2l0aW9uID8gdHJhbnNpdGlvbi5vcmRpbmFyeUFmdGVyIDogdmFsdWUsXG4gICAgICBzdWJqZWN0SWRzXG4gICAgKTtcbiAgICBjb25zdCBmb290cHJpbnRLZXlzID0gc3ViamVjdEZpZWxkRm9vdHByaW50ID8/IGZpZWxkS2V5cztcbiAgICBjb25zdCBrbm93bkZvb3RwcmludCA9XG4gICAgICBzdWJqZWN0RmllbGRGb290cHJpbnQgPT09IG51bGxcbiAgICAgICAgPyBudWxsXG4gICAgICAgIDogZm9vdHByaW50S2V5cyA9PT0gdW5kZWZpbmVkXG4gICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgIDogT2JqZWN0LmZyZWV6ZShbLi4uZm9vdHByaW50S2V5c10pO1xuICAgIG1ldGEgPSByZXNlYXJjaEFubm90YXRlKFxuICAgICAgcmVzZWFyY2hTdGFtcFNvdXJjZShtZXRhLCBzdWJqZWN0SWRzLCBrbm93bkZvb3RwcmludCwgdmFsdWUsIHByZXYpLFxuICAgICAgb3duZXJJZCA/PyBtZXRhPy5vd25lcklkLFxuICAgICAgcG9zaXRpb25JZHMsXG4gICAgICBnZXRXcml0ZVBhcnRpY2lwYXRpb24obWV0YSkgPT09ICdhdXRob3JlZCcsXG4gICAgICB2YWx1ZVxuICAgICk7XG4gICAgaWYgKCF0aGlzLmJhdGNoaW5nRW5hYmxlZCkge1xuICAgICAgLy8gU3luY2hyb25vdXMgcGF0aDogcnVuIHN1YnNjcmliZXJzIGltbWVkaWF0ZWx5XG4gICAgICBjb25zdCBkZWxpdmVyeU1ldGEgPSBtYXRlcmlhbGl6ZURlbGl2ZXJ5TWV0YShtZXRhKTtcbiAgICAgIHJldHVybiB0aGlzLl9ydW5Ob3RpZnkoXG4gICAgICAgIHBhdGgsXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBwcmV2LFxuICAgICAgICBvd25lclBhdGgsXG4gICAgICAgIG9yaWdpbixcbiAgICAgICAgc3ViamVjdElkcyxcbiAgICAgICAgcG9zaXRpb25JZHMsXG4gICAgICAgIGRlbGl2ZXJ5TWV0YSxcbiAgICAgICAgZGVjbGFyZWRTY29wZXMsXG4gICAgICAgIG93bmVySWQsXG4gICAgICAgIGtub3duRm9vdHByaW50XG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGVudHJ5OiBQZW5kaW5nRW50cnkgPSB7XG4gICAgICBwYXRoLFxuICAgICAgbmV3VmFsdWU6IHZhbHVlLFxuICAgICAgb2xkVmFsdWU6IHByZXYsXG4gICAgICBvd25lclBhdGgsXG4gICAgICBvcmlnaW4sXG4gICAgICBtZXRhLFxuICAgICAgcHJvamVjdGlvbk1ldGE6bWV0YSxcbiAgICAgIGRlY2xhcmVkU2NvcGVzLFxuICAgICAgc3ViamVjdElkOiBzdWJqZWN0SWRzPy5bMF0sXG4gICAgICBwb3NpdGlvbklkOiBwb3NpdGlvbklkcz8uWzBdLFxuICAgICAgb3duZXJJZCxcbiAgICAgIHN1YmplY3RJZHMsXG4gICAgICBwb3NpdGlvbklkcyxcbiAgICAgIHN1YmplY3RGaWVsZEtleXM6IGZpZWxkS2V5cyxcbiAgICAgIHN1YmplY3RGaWVsZEZvb3RwcmludDoga25vd25Gb290cHJpbnQsXG4gICAgfTtcblxuICAgIHRoaXMuZW5xdWV1ZVBlbmRpbmcoZW50cnkpO1xuXG4gICAgaWYgKCF0aGlzLnBlbmRpbmdGbHVzaCkge1xuICAgICAgdGhpcy5wZW5kaW5nRmx1c2ggPSB0cnVlO1xuICAgICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gdGhpcy5mbHVzaCgpKTtcbiAgICB9XG5cbiAgICAvLyBRdWV1ZWQ6IGRlbGl2ZXJ5IGhhcHBlbnMgYXQgZmx1c2guXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIHN5bmNocm9ub3VzIG5vdGlmaWNhdGlvbiBydW5uZXIgKHN1YnNjcmliZXJzKVxuICAgKi9cbiAgcHJpdmF0ZSBfcnVuTm90aWZ5KFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICB2YWx1ZTogdW5rbm93bixcbiAgICBwcmV2OiB1bmtub3duLFxuICAgIG93bmVyUGF0aD86IHN0cmluZyxcbiAgICBvcmlnaW4/OiBzdHJpbmcsXG4gICAgc3ViamVjdElkcz86IG51bWJlcltdLFxuICAgIHBvc2l0aW9uSWRzPzogbnVtYmVyW10sXG4gICAgbWV0YT86IFdyaXRlTWV0YWRhdGEsXG4gICAgZGVjbGFyZWRTY29wZXM/OiBEZWNsYXJlZFdyaXRlU2NvcGVzLFxuICAgIG93bmVySWQ/OiBudW1iZXIsXG4gICAgc3ViamVjdEZpZWxkRm9vdHByaW50PzogcmVhZG9ubHkgc3RyaW5nW10gfCBudWxsLFxuICAgIGlzb2xhdGVTdWJzY3JpYmVycyA9IGZhbHNlLFxuICAgIHByb2plY3Rpb25NZXRhPzogV3JpdGVNZXRhZGF0YVxuICApOiB2b2lkIHtcbiAgICAvLyDimqDvuI8gVEhFIElOVEVSQ0VQVE9SIExPT1AgV0FTIERFTEVURUQgSU4gMTUuMCDigJQgUEFUSC1OT1RJRklFUi1JTlRFUkNFUFQtXG4gICAgLy8gU1VSVklWQUwtMC4gSXQgcmFuIGhlcmUsIGJlZm9yZSBzdWJzY3JpYmVycywgYW5kIGNvdWxkIHN1cHByZXNzIGRlbGl2ZXJ5XG4gICAgLy8gKGBibG9ja2ApIG9yIHJld3JpdGUgdGhlIGRlbGl2ZXJlZCB2YWx1ZSAoYHRyYW5zZm9ybWApLiBCb3RoIFdPUktFRDsgaXRcbiAgICAvLyB3YXMgcG9zdGNvbW1pdCBkZWxpdmVyeSBtaWRkbGV3YXJlLCBub3QgbXV0YXRpb24gYXV0aG9yaXR5IOKAlCBgYXBwbHkoKWBcbiAgICAvLyBjb21taXRzIGJlZm9yZSB0aGUgZW52ZWxvcGUgaXMgZXZlbiBidWlsdC5cbiAgICAvL1xuICAgIC8vIERlbGV0ZWQgYmVjYXVzZSBub3RoaW5nIGNsYWltZWQgaXQ6IHplcm8gcHJvZHVjdGlvbiBjYWxsZXJzLCB6ZXJvIHNwZWNcbiAgICAvLyBjYXJyaWVycyBvbiB0aGlzIHN1cmZhY2UsIGFuZCBubyBwdWJsaWMgQVBJIG9ibGlnYXRpb24gKGBQYXRoTm90aWZpZXJgLFxuICAgIC8vIGBQYXRoTm90aWZpZXJJbnRlcmNlcHRvcmAgYW5kIGBnZXRQYXRoTm90aWZpZXJgIGFyZSBhYnNlbnQgZnJvbSB0aGUgYnVpbHRcbiAgICAvLyBiYXJyZWwpLlxuICAgIC8vXG4gICAgLy8gICAgIFNFTUFOVElDIENPSEVSRU5DRSBFQVJOUyBBIENMQVNTSUZJQ0FUSU9OLCBOT1QgQSBQRVJNQU5FTlQgT1dORVIuXG4gICAgLy9cbiAgICAvLyBVbmRlcnN0YW5kaW5nIHdoYXQgaXQgZGlkIHdhcyBuZWNlc3NhcnkgdG8gZGVsZXRlIGl0IGRlbGliZXJhdGVseSByYXRoZXJcbiAgICAvLyB0aGFuIG1pc3Rha2UgaXQgZm9yIGRlYWQgY29kZSDigJQgYW4gZWFybGllciBwYXNzIGNhbGxlZCBpdCBcInVucmVhY2hhYmxlXCJcbiAgICAvLyBhbmQgd2FzIHdyb25nLlxuICAgIGNvbnN0IHRyYW5zZm9ybWVkID0gdmFsdWU7XG5cbiAgICAvLyBSdW4gc3Vic2NyaWJlcnNcbiAgICAvL1xuICAgIC8vIFRYLU9CU0VSVkVSLVNUUkFORC0wLiBBIERFRkVSUkVEIGRlbGl2ZXJ5IGlzb2xhdGVzIGVhY2ggaGFuZGxlci4gVGhlXG4gICAgLy8gd3JpdGUgaXMgYWxyZWFkeSBhcHBsaWVkLCBzbyBhIHN1YnNjcmliZXIncyB0aHJvdyBjYW5ub3QgdW5kbyBpdDsgaXRcbiAgICAvLyBjb3VsZCBvbmx5IGVzY2FwZSBpbnRvIHdob2V2ZXIgZmx1c2hlZC4gVGhhdCB3YXMgYSBgdHJhbnNhY3QoKWAgdGhhdFxuICAgIC8vIHRoZW4gcmV0dXJuZWQgbm8gaGFuZGxlIGFuZCBsZWZ0IGl0cyBjb21taXQgc2NvcGUgb3BlbiAoaG9sZGluZyBldmVyeVxuICAgIC8vIGxhdGVyIExpbmsgY29uc2VxdWVuY2UpLCBvciBhIG1pY3JvdGFzayB0aGF0IGRyb3BwZWQgdGhlIHJlc3Qgb2YgdGhlXG4gICAgLy8gYmF0Y2ggYW5kIHRoZSBmbHVzaCBjYWxsYmFja3MuIFJlcG9ydCBpdCAob25UcmVlRXJyb3IgYW5kIFtTVDIwMzRdKVxuICAgIC8vIGFuZCBrZWVwIGRlbGl2ZXJpbmcuXG4gICAgLy9cbiAgICAvLyBTWU5DSFJPTk9VUyBkZWxpdmVyeSAoYmF0Y2hpbmcgZGlzYWJsZWQsIGFuIGludGVybmFsIHNlYW0pIGlzIG5vdFxuICAgIC8vIGlzb2xhdGVkIGhlcmUsIHdoaWNoIGlzIHVuY2hhbmdlZDogYW4gZW50aXR5IHdyaXRlJ3Mgb2JzZXJ2ZXIgZXJyb3JcbiAgICAvLyB0aHJvd3MgaW50byB0aGUgd3JpdGVyLCB3aGljaCBpcyB3aGVyZSByb2xsYmFjaygpIGRlbGliZXJhdGVseSBzZXR0bGVzXG4gICAgLy8gZmlyc3QgYW5kIHRoZW4gc3VyZmFjZXMgaXQgKHRyYW5zYWN0aW9uLXNhZmV0eS5zcGVjLnRzKTsgYSBzY2FsYXJcbiAgICAvLyB3cml0ZSdzIGlzIGNhdWdodCBlYXJsaWVyIGJ5IHRoZSBpbnRyaW5zaWMtbXV0YXRpb24gb2JzZXJ2ZXIgY29tcG9zaXRpb24uXG4gICAgZm9yIChjb25zdCBbcGF0dGVybiwgaGFuZGxlcnNdIG9mIHRoaXMuc3Vic2NyaWJlcnMpIHtcbiAgICAgIGlmICh0aGlzLm1hdGNoZXMocGF0dGVybiwgcGF0aCkpIHtcbiAgICAgICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIGhhbmRsZXJzKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdpdGhvdXRXcml0ZU9ic2VydmF0aW9uU2NvcGVzKCgpID0+XG4gICAgICAgICAgICAgIGhhbmRsZXIoXG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtZWQsXG4gICAgICAgICAgICAgICAgcHJldixcbiAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgIG93bmVyUGF0aCxcbiAgICAgICAgICAgICAgICBvcmlnaW4sXG4gICAgICAgICAgICAgICAgc3ViamVjdElkcyxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbklkcyxcbiAgICAgICAgICAgICAgICB0aGlzLnByb2plY3Rpb25IYW5kbGVycy5oYXMoaGFuZGxlcikgPyBwcm9qZWN0aW9uTWV0YSA/PyBtZXRhIDogbWV0YSxcbiAgICAgICAgICAgICAgICBkZWNsYXJlZFNjb3BlcyxcbiAgICAgICAgICAgICAgICBvd25lcklkLFxuICAgICAgICAgICAgICAgIHN1YmplY3RGaWVsZEZvb3RwcmludFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBpZiAoIWlzb2xhdGVTdWJzY3JpYmVycykgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICByZXBvcnRDb250YWluZWRPYnNlcnZlckVycm9yKHtcbiAgICAgICAgICAgICAgZXJyb3IsXG4gICAgICAgICAgICAgIG9wZXJhdGlvbjogJ25vdGlmeTpzdWJzY3JpYmVyJyxcbiAgICAgICAgICAgICAgLy8gRW50aXR5IGFuZCBjb21wZW5zYXRpb24gd3JpdGVzIG5hbWUgdGhlaXIgdHJlZSBpbiBtZXRhIG9ubHkuXG4gICAgICAgICAgICAgIHRyZWVJZDogKG93bmVySWQgPz9cbiAgICAgICAgICAgICAgICAobWV0YSBhcyB7IG93bmVySWQ/OiBudW1iZXIgfSB8IHVuZGVmaW5lZCk/Lm93bmVySWQpIGFzXG4gICAgICAgICAgICAgICAgfCBUcmVlSWRcbiAgICAgICAgICAgICAgICB8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbHVzaCBwZW5kaW5nIGJhdGNoZWQgbm90aWZpY2F0aW9ucyBpbW1lZGlhdGVseS5cbiAgICogVGhpcyBpcyByZS1lbnRyYW50IHNhZmUgYW5kIHdpbGwgcHJvY2VzcyBub3RpZmljYXRpb25zIHF1ZXVlZCBkdXJpbmdcbiAgICogc3Vic2NyaWJlciBjYWxsYmFja3MgaW4gc3Vic2VxdWVudCByb3VuZHMuXG4gICAqL1xuICBwcml2YXRlIGZsdXNoKCk6IHZvaWQge1xuICAgIC8vIFNuYXBzaG90IGFuZCBjbGVhciBiZWZvcmUgbm90aWZ5aW5nIHRvIGFsbG93IHJlLWVudHJhbnQgYmVoYXZpb3JcbiAgICBjb25zdCB0b05vdGlmeSA9IFtcbiAgICAgIC4uLnRoaXMucGVuZGluZ0JlZm9yZU1lbWJlcnNoaXAsXG4gICAgICAuLi50aGlzLnBlbmRpbmcudmFsdWVzKCksXG4gICAgXTtcbiAgICB0aGlzLnBlbmRpbmdCZWZvcmVNZW1iZXJzaGlwID0gW107XG4gICAgdGhpcy5wZW5kaW5nLmNsZWFyKCk7XG4gICAgdGhpcy5wZW5kaW5nRmx1c2ggPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgdG9Ob3RpZnkpXG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIEFycmF5LmlzQXJyYXkoc2xvdCkgPyBzbG90IDogW3Nsb3RdKVxuICAgICAgICByZXNlYXJjaENvbXBsZXRlKGVudHJ5Lm1ldGEpO1xuXG4gICAgZm9yIChjb25zdCBzbG90IG9mIHRvTm90aWZ5KSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gQXJyYXkuaXNBcnJheShzbG90KSA/IHNsb3QgOiBbc2xvdF07XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgaXNPd25lck9ubHlNYXJrZXJTaWduYWwgPVxuICAgICAgICAgIGVudHJ5Lm93bmVyUGF0aCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgZW50cnkubmV3VmFsdWUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgIGVudHJ5Lm9sZFZhbHVlID09PSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IGhhc1N0cnVjdHVyYWxFZmZlY3QgPSBlbnRyeS5tZXRhPy5zdHJ1Y3R1cmFsRWZmZWN0ICE9PSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIElmIHZhbHVlIGRpZG4ndCBjaGFuZ2UgY29tcGFyZWQgdG8gb3JpZ2luYWwgb2xkVmFsdWUsIHNraXBcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGVudHJ5Lm5ld1ZhbHVlID09PSBlbnRyeS5vbGRWYWx1ZSAmJlxuICAgICAgICAgICFlbnRyeS5zdWJqZWN0RmllbGRLZXlzPy5sZW5ndGggJiZcbiAgICAgICAgICAhaXNPd25lck9ubHlNYXJrZXJTaWduYWwgJiZcbiAgICAgICAgICAhaGFzU3RydWN0dXJhbEVmZmVjdFxuICAgICAgICApIHtcbiAgICAgICAgICByZXNlYXJjaERlbGl2ZXJFcXVhbChlbnRyeSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSdW4gc3Vic2NyaWJlcnMgc3luY2hyb25vdXNseSBmb3IgZWFjaCBwYXRoXG4gICAgICAgIHRoaXMuX3J1bk5vdGlmeShcbiAgICAgICAgICBlbnRyeS5wYXRoLFxuICAgICAgICAgIGVudHJ5Lm5ld1ZhbHVlLFxuICAgICAgICAgIGVudHJ5Lm9sZFZhbHVlLFxuICAgICAgICAgIGVudHJ5Lm93bmVyUGF0aCxcbiAgICAgICAgICBlbnRyeS5vcmlnaW4sXG4gICAgICAgICAgZW50cnkuc3ViamVjdElkcyxcbiAgICAgICAgICBlbnRyeS5wb3NpdGlvbklkcyxcbiAgICAgICAgICBtYXRlcmlhbGl6ZURlbGl2ZXJ5TWV0YShlbnRyeS5tZXRhKSxcbiAgICAgICAgICBlbnRyeS5kZWNsYXJlZFNjb3BlcyxcbiAgICAgICAgICBlbnRyeS5vd25lcklkLFxuICAgICAgICAgIGVudHJ5LnN1YmplY3RGaWVsZEZvb3RwcmludCxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICAgIGVudHJ5LnByb2plY3Rpb25NZXRhXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2FsbCBmbHVzaCBsaXN0ZW5lcnMgKGUuZy4sIHJlc3RvcmF0aW9uKSBvbmNlIHBlciBmbHVzaFxuICAgIGZvciAoY29uc3QgY2Igb2YgQXJyYXkuZnJvbSh0aGlzLmZsdXNoQ2FsbGJhY2tzKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgd2l0aG91dFdyaXRlT2JzZXJ2YXRpb25TY29wZXMoY2IpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIHN3YWxsb3cgY2FsbGJhY2sgZXJyb3JzIHRvIGF2b2lkIGJyZWFraW5nIGZsdXNoIGxvb3BcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9yY2Ugc3luY2hyb25vdXMgZmx1c2ggb2YgcGVuZGluZyBub3RpZmljYXRpb25zXG4gICAqL1xuICBmbHVzaFN5bmMoKTogdm9pZCB7XG4gICAgLy8gUHJvY2VzcyB1bnRpbCBubyBwZW5kaW5nIG5vdGlmaWNhdGlvbnMgZXhpc3RcbiAgICB3aGlsZSAodGhpcy5oYXNQZW5kaW5nKCkgfHwgdGhpcy5wZW5kaW5nRmx1c2gpIHtcbiAgICAgIC8vIElmIGEgcGVuZGluZ0ZsdXNoIHdhcyBzY2hlZHVsZWQgYnV0IG5vdCB5ZXQgcHJvY2Vzc2VkLCBjbGVhciBmbGFnIGFuZCBwcm9jZXNzXG4gICAgICBpZiAodGhpcy5wZW5kaW5nRmx1c2ggJiYgIXRoaXMuaGFzUGVuZGluZygpKSB7XG4gICAgICAgIC8vIG5vdGhpbmcgcXVldWVkIC0gY2xlYXIgYW5kIGNvbnRpbnVlXG4gICAgICAgIHRoaXMucGVuZGluZ0ZsdXNoID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGhpcy5mbHVzaCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgdG8gZmx1c2ggZXZlbnRzIChjYWxsZWQgYWZ0ZXIgYSBmbHVzaCBjb21wbGV0ZXMpXG4gICAqL1xuICBvbkZsdXNoKGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5mbHVzaENhbGxiYWNrcy5hZGQoY2FsbGJhY2spO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLmZsdXNoQ2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG4gIH1cblxuICAvKiogSW50ZXJuYWwgZXZpZGVuY2Ugb25seTogbmV2ZXIgZHJhaW5zIHRoZSBxdWV1ZSBvciBpbnZva2VzIG9ic2VydmVycy5cbiAgICogSW5jbHVkZSBuZXQtZXF1YWwgZW50cmllczogYW4gQUJBIHdyaXRlIHN0aWxsIGNoYW5nZWQgb3duZXJzaGlwLlxuICAgKi9cbiAgcmVhZFBlbmRpbmcoKTogcmVhZG9ubHkgUmVhZG9ubHk8UGVuZGluZ0VudHJ5PltdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMucGVuZGluZ0JlZm9yZU1lbWJlcnNoaXAsIC4uLnRoaXMucGVuZGluZy52YWx1ZXMoKV0uZmxhdE1hcChcbiAgICAgIChzbG90KSA9PlxuICAgICAgICAoQXJyYXkuaXNBcnJheShzbG90KSA/IHNsb3QgOiBbc2xvdF0pLm1hcCgoZW50cnkpID0+ICh7XG4gICAgICAgICAgLi4uZW50cnksXG4gICAgICAgICAgc3ViamVjdEZpZWxkS2V5czogZW50cnkuc3ViamVjdEZpZWxkS2V5c1xuICAgICAgICAgICAgPyBbLi4uZW50cnkuc3ViamVjdEZpZWxkS2V5c11cbiAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICB9KSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZXJlIGFyZSBwZW5kaW5nIG5vdGlmaWNhdGlvbnNcbiAgICovXG4gIGhhc1BlbmRpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZy5zaXplID4gMCB8fCB0aGlzLnBlbmRpbmdCZWZvcmVNZW1iZXJzaGlwLmxlbmd0aCA+IDA7XG4gIH1cblxuICAvKipcbiAgICogU2ltcGxlIHBhdHRlcm4gbWF0Y2hpbmdcbiAgICogLSAndXNlcnMnIG1hdGNoZXMgZXhhY3RseSAndXNlcnMnXG4gICAqIC0gJ3VzZXJzLionIG1hdGNoZXMgJ3VzZXJzLnUxJywgJ3VzZXJzLnUyJywgZXRjLlxuICAgKiAtICcqKicgbWF0Y2hlcyBldmVyeXRoaW5nXG4gICAqL1xuICBwcml2YXRlIG1hdGNoZXMocGF0dGVybjogc3RyaW5nLCBwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAocGF0dGVybiA9PT0gJyoqJykgcmV0dXJuIHRydWU7XG4gICAgaWYgKHBhdHRlcm4gPT09IHBhdGgpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gSGFuZGxlIHdpbGRjYXJkIHBhdHRlcm5zIGxpa2UgJ3VzZXJzLionXG4gICAgaWYgKHBhdHRlcm4uZW5kc1dpdGgoJy4qJykpIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IHBhdHRlcm4uc2xpY2UoMCwgLTIpO1xuICAgICAgcmV0dXJuIHBhdGguc3RhcnRzV2l0aChwcmVmaXggKyAnLicpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgZW5xdWV1ZVBlbmRpbmcoZW50cnk6IFBlbmRpbmdFbnRyeSk6IHZvaWQge1xuICAgIGlmIChwbGFpbkJyYW5jaE1lbWJlcnNoaXBDaGFuZ2UoZW50cnkubWV0YSkpIHtcbiAgICAgIC8vIE1lbWJlcnNoaXAgaXMgYSBjaHJvbm9sb2dpY2FsIGJhcnJpZXIgYWNyb3NzIHBhdGhzLiBLZWVwIHF1ZXVlZFxuICAgICAgLy8gZGVzY2VuZGFudCB3cml0ZXMgb24gdGhlIHNpZGUgb2YgdGhlIHRyYW5zaXRpb24gd2hlcmUgdGhleSBvY2N1cnJlZC5cbiAgICAgIGZvciAoY29uc3Qgc2xvdCBvZiB0aGlzLnBlbmRpbmcudmFsdWVzKCkpXG4gICAgICAgIHRoaXMucGVuZGluZ0JlZm9yZU1lbWJlcnNoaXAucHVzaChzbG90KTtcbiAgICAgIHRoaXMucGVuZGluZ0JlZm9yZU1lbWJlcnNoaXAucHVzaChlbnRyeSk7XG4gICAgICB0aGlzLnBlbmRpbmcuY2xlYXIoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwYXRoID0gZW50cnkucGF0aDtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMucGVuZGluZy5nZXQocGF0aCk7XG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhpcy5wZW5kaW5nLnNldChwYXRoLCBlbnRyeSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYmF0Y2hJZGVudGl0eU1vZGUgPT09ICdwYXRoJykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXhpc3RpbmcpKSB7XG4gICAgICAgIGNvbnN0IHRhaWwgPSBleGlzdGluZ1tleGlzdGluZy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRoaXMuaGFzU2FtZVNlbWFudGljSWRlbnRpdHkodGFpbCwgZW50cnkpKSB7XG4gICAgICAgICAgdGhpcy5jb2FsZXNjZUVudHJ5KHRhaWwsIGVudHJ5KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZXhpc3RpbmcucHVzaChlbnRyeSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaGFzU2FtZVNlbWFudGljSWRlbnRpdHkoZXhpc3RpbmcsIGVudHJ5KSkge1xuICAgICAgICB0aGlzLmNvYWxlc2NlRW50cnkoZXhpc3RpbmcsIGVudHJ5KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnBlbmRpbmcuc2V0KHBhdGgsIFtleGlzdGluZywgZW50cnldKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iYXRjaElkZW50aXR5TW9kZSA9PT0gJ3BhdGgtcG9zaXRpb24tc3ViamVjdC1jb21wb3NpdGUnKSB7XG4gICAgICB0aGlzLmVucXVldWVQZW5kaW5nQ29tcG9zaXRlKGVudHJ5KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShleGlzdGluZykpIHtcbiAgICAgIGNvbnN0IHRhaWwgPSBleGlzdGluZ1tleGlzdGluZy5sZW5ndGggLSAxXTtcbiAgICAgIGlmICh0aGlzLmhhc1NhbWVTZW1hbnRpY0lkZW50aXR5KHRhaWwsIGVudHJ5KSkge1xuICAgICAgICB0aGlzLmNvYWxlc2NlRW50cnkodGFpbCwgZW50cnkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBleGlzdGluZy5wdXNoKGVudHJ5KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5oYXNTYW1lU2VtYW50aWNJZGVudGl0eShleGlzdGluZywgZW50cnkpKSB7XG4gICAgICB0aGlzLmNvYWxlc2NlRW50cnkoZXhpc3RpbmcsIGVudHJ5KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnBlbmRpbmcuc2V0KHBhdGgsIFtleGlzdGluZywgZW50cnldKTtcbiAgfVxuXG4gIHByaXZhdGUgZW5xdWV1ZVBlbmRpbmdDb21wb3NpdGUoZW50cnk6IFBlbmRpbmdFbnRyeSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbXBvc2l0ZUtleSA9IHRoaXMuZ2V0Q29tcG9zaXRlQmF0Y2hLZXkoZW50cnkpO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5wZW5kaW5nLmdldChjb21wb3NpdGVLZXkpO1xuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRoaXMucGVuZGluZy5zZXQoY29tcG9zaXRlS2V5LCBlbnRyeSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gQXJyYXkuaXNBcnJheShleGlzdGluZykgPyBleGlzdGluZ1swXSA6IGV4aXN0aW5nO1xuICAgIHRoaXMuY29hbGVzY2VFbnRyeSh0YXJnZXQsIGVudHJ5KTtcbiAgfVxuXG4gIHByaXZhdGUgaGFzU2FtZVNlbWFudGljSWRlbnRpdHkoXG4gICAgbGVmdDogUGVuZGluZ0VudHJ5LFxuICAgIHJpZ2h0OiBQZW5kaW5nRW50cnlcbiAgKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuY3Jvc3Nlc1N0cnVjdHVyYWxCb3VuZGFyeShsZWZ0LCByaWdodCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jcm9zc2VzU2NhbGFySW50ZW50Qm91bmRhcnkobGVmdCwgcmlnaHQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY3Jvc3Nlc0NhdXNhbE1vZGVCb3VuZGFyeShsZWZ0LCByaWdodCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBOT1RJRklFUi1TQ09QRS0wLiBBIHBvc2l0aW9uIGlkIGlzIG9ubHkgbWVhbmluZ2Z1bCBXSVRISU4gaXRzIHJlZ2lzdHJ5LFxuICAgIC8vIHNvIHR3byBlbnRyaWVzIGFyZSB0aGUgc2FtZSBsb2NhdGlvbiBvbmx5IGlmIHRoZXkgYWdyZWUgb24gdGhlIG5hbWVzcGFjZVxuICAgIC8vIHRvby4gRW50cmllcyBmcm9tIGVtaXR0ZXJzIHRoYXQgZG8gbm90IHN1cHBseSBvbmUgYm90aCBjYXJyeSBgdW5kZWZpbmVkYFxuICAgIC8vIGFuZCBjb21wYXJlIGV4YWN0bHkgYXMgdGhleSBkaWQgYmVmb3JlIOKAlCB0aGUgZml4IGNhbm5vdCBtYWtlIGFcbiAgICAvLyBzaW5nbGUtdHJlZSBjYXNlIG5ld2x5IGRpc3RpbmN0LlxuICAgIGlmIChcbiAgICAgIChsZWZ0Lm93bmVySWQgPz8gbGVmdC5tZXRhPy5vd25lcklkKSAhPT1cbiAgICAgIChyaWdodC5vd25lcklkID8/IHJpZ2h0Lm1ldGE/Lm93bmVySWQpXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYmF0Y2hJZGVudGl0eU1vZGUgPT09ICdwYXRoLXBvc2l0aW9uJykge1xuICAgICAgcmV0dXJuIGxlZnQucG9zaXRpb25JZCA9PT0gcmlnaHQucG9zaXRpb25JZDtcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgbGVmdC5wb3NpdGlvbklkID09PSByaWdodC5wb3NpdGlvbklkICYmIGxlZnQuc3ViamVjdElkID09PSByaWdodC5zdWJqZWN0SWRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBjcm9zc2VzU3RydWN0dXJhbEJvdW5kYXJ5KFxuICAgIGxlZnQ6IFBlbmRpbmdFbnRyeSxcbiAgICByaWdodDogUGVuZGluZ0VudHJ5XG4gICk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGxlZnRFZmZlY3QgPSBsZWZ0Lm1ldGE/LnN0cnVjdHVyYWxFZmZlY3Q7XG4gICAgY29uc3QgcmlnaHRFZmZlY3QgPSByaWdodC5tZXRhPy5zdHJ1Y3R1cmFsRWZmZWN0O1xuICAgIGNvbnN0IGxlZnRTdHJ1Y3R1cmFsID0gbGVmdEVmZmVjdCAhPT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHJpZ2h0U3RydWN0dXJhbCA9IHJpZ2h0RWZmZWN0ICE9PSB1bmRlZmluZWQ7XG4gICAgaWYgKGxlZnRTdHJ1Y3R1cmFsICE9PSByaWdodFN0cnVjdHVyYWwpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFJFU1RPUkUtUDAuIFR3byBzdHJ1Y3R1cmFsIGVmZmVjdHMgb2YgRElGRkVSRU5UIGtpbmRzIG9uIHRoZSBzYW1lIHN1YmplY3RcbiAgICAvLyBhcmUgbm90IHRoZSBzYW1lIGV2ZW50LCBhbmQgY29hbGVzY2luZyB0aGVtIHNpbGVudGx5IGRpc2NhcmRlZCB0aGUgZmlyc3QuXG4gICAgLy9cbiAgICAvLyAgIHNldEFsbChbYSxiXSkgdGhlbiByZW1vdmVPbmUoJ2EnKSAgIGluIG9uZSB0aWNrXG4gICAgLy8gICAgIC0+IGFkZChzdWJqZWN0IDEpIGNvYWxlc2NlZCBJTlRPIHJlbW92ZShzdWJqZWN0IDEpXG4gICAgLy8gICAgIC0+IHJlc3RvcmF0aW9uIG9ubHkgZXZlciBzYXcgdGhlIHJlbW92ZSwgc28gdW5kbyByZS1hZGRlZCBhIHJvdyB0aGVcbiAgICAvLyAgICAgICAgdHVybiBoYWQgY3JlYXRlZCwgYW5kIHRoZSBjb2xsZWN0aW9uIGNvdWxkIG5vdCByZXR1cm4gdG8gZW1wdHlcbiAgICAvL1xuICAgIC8vIEtlZXBpbmcgYm90aCBlbnRyaWVzIGlzIHRoZSBub3RpZmllcidzIHdob2xlIGpvYiBoZXJlOiBpdCBtdXN0IG5vdCBsb3NlXG4gICAgLy8gaW5mb3JtYXRpb24uIERlY2lkaW5nIHdoYXQgdGhlIHBhaXIgTkVUUyB0byBpcyBhIGhpc3RvcnkgY29uY2VybiBhbmRcbiAgICAvLyBiZWxvbmdzIHRvIHRoZSB0dXJuIHJlY29yZGVyLCB3aGljaCBjb21wb3NlcyB0aGVtIHBlciBzdWJqZWN0LlxuICAgIGlmIChcbiAgICAgIGxlZnRTdHJ1Y3R1cmFsICYmXG4gICAgICByaWdodFN0cnVjdHVyYWwgJiZcbiAgICAgIGxlZnRFZmZlY3Qua2luZCAhPT0gcmlnaHRFZmZlY3Qua2luZFxuICAgICkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBjcm9zc2VzU2NhbGFySW50ZW50Qm91bmRhcnkoXG4gICAgbGVmdDogUGVuZGluZ0VudHJ5LFxuICAgIHJpZ2h0OiBQZW5kaW5nRW50cnlcbiAgKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbGVmdEludGVudCA9IGxlZnQubWV0YT8ubXV0YXRpb25JbnRlbnQ7XG4gICAgY29uc3QgcmlnaHRJbnRlbnQgPSByaWdodC5tZXRhPy5tdXRhdGlvbkludGVudDtcbiAgICByZXR1cm4gKFxuICAgICAgbGVmdEludGVudCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICByaWdodEludGVudCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICBsZWZ0SW50ZW50ICE9PSByaWdodEludGVudFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNyb3NzZXNDYXVzYWxNb2RlQm91bmRhcnkoXG4gICAgbGVmdDogUGVuZGluZ0VudHJ5LFxuICAgIHJpZ2h0OiBQZW5kaW5nRW50cnlcbiAgKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIGdldFdyaXRlUGFydGljaXBhdGlvbihsZWZ0Lm1ldGEpICE9PSBnZXRXcml0ZVBhcnRpY2lwYXRpb24ocmlnaHQubWV0YSkgfHxcbiAgICAgIGxlZnQub3JpZ2luICE9PSByaWdodC5vcmlnaW4gfHxcbiAgICAgIGxlZnQubWV0YT8udHJhbnNhY3Rpb25JZCAhPT0gcmlnaHQubWV0YT8udHJhbnNhY3Rpb25JZCB8fFxuICAgICAgbGVmdC5tZXRhPy50cmFuc2FjdGlvbk93bmVyICE9PSByaWdodC5tZXRhPy50cmFuc2FjdGlvbk93bmVyXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY29hbGVzY2VFbnRyeSh0YXJnZXQ6IFBlbmRpbmdFbnRyeSwgbmV4dDogUGVuZGluZ0VudHJ5KTogdm9pZCB7XG4gICAgdGFyZ2V0LnN1YmplY3RGaWVsZEZvb3RwcmludCA9XG4gICAgICB0YXJnZXQuc3ViamVjdEZpZWxkRm9vdHByaW50ID09PSB1bmRlZmluZWQgfHxcbiAgICAgIG5leHQuc3ViamVjdEZpZWxkRm9vdHByaW50ID09PSB1bmRlZmluZWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiB0YXJnZXQuc3ViamVjdEZpZWxkRm9vdHByaW50ID09PSBudWxsIHx8XG4gICAgICAgICAgbmV4dC5zdWJqZWN0RmllbGRGb290cHJpbnQgPT09IG51bGxcbiAgICAgICAgPyBudWxsXG4gICAgICAgIDogT2JqZWN0LmZyZWV6ZShbXG4gICAgICAgICAgICAuLi5uZXcgU2V0KFtcbiAgICAgICAgICAgICAgLi4udGFyZ2V0LnN1YmplY3RGaWVsZEZvb3RwcmludCxcbiAgICAgICAgICAgICAgLi4ubmV4dC5zdWJqZWN0RmllbGRGb290cHJpbnQsXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgICBdKTtcbiAgICAvLyBQcmVzZXJ2ZSBpbnRlcm1lZGlhdGUgd3JpdGVzLCBpbmNsdWRpbmcgQUJBLiBPbmUgdW5rbm93biBjb250cmlidXRpb25cbiAgICAvLyBtYWtlcyB0aGUgY29tcGxldGUgZm9vdHByaW50IHVua25vd247IGEgcGFydGlhbCB1bmlvbiBpcyBub3QgZXZpZGVuY2UuXG4gICAgdGFyZ2V0LnN1YmplY3RGaWVsZEtleXMgPVxuICAgICAgdGFyZ2V0LnN1YmplY3RGaWVsZEtleXMgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgbmV4dC5zdWJqZWN0RmllbGRLZXlzICE9PSB1bmRlZmluZWRcbiAgICAgICAgPyBbLi4ubmV3IFNldChbLi4udGFyZ2V0LnN1YmplY3RGaWVsZEtleXMsIC4uLm5leHQuc3ViamVjdEZpZWxkS2V5c10pXVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICB0YXJnZXQuZGVjbGFyZWRTY29wZXMgPSBtZXJnZVdyaXRlT2JzZXJ2YXRpb25TY29wZXMoXG4gICAgICB0YXJnZXQuZGVjbGFyZWRTY29wZXMsXG4gICAgICBuZXh0LmRlY2xhcmVkU2NvcGVzXG4gICAgKTtcbiAgICB0YXJnZXQubmV3VmFsdWUgPSBuZXh0Lm5ld1ZhbHVlO1xuICAgIHRhcmdldC5vd25lclBhdGggPSBuZXh0Lm93bmVyUGF0aDtcbiAgICB0YXJnZXQub3JpZ2luID0gdGhpcy5tZXJnZU9yaWdpbih0YXJnZXQub3JpZ2luLCBuZXh0Lm9yaWdpbik7XG4gICAgY29uc3QgbWVyZ2VkPXRoaXMubWVyZ2VNZXRhKHRhcmdldC5tZXRhLCBuZXh0Lm1ldGEpO1xuICAgIHRhcmdldC5wcm9qZWN0aW9uTWV0YT1tZXJnZVNjYWxhclB1YmxpY2F0aW9uQ292ZXJhZ2UodGFyZ2V0LnByb2plY3Rpb25NZXRhID8/IHt9LG5leHQucHJvamVjdGlvbk1ldGEgPz8ge30sbWVyZ2VkKTtcbiAgICB0YXJnZXQubWV0YSA9IG1lcmdlZDtcbiAgICB0YXJnZXQuc3ViamVjdElkID0gbmV4dC5zdWJqZWN0SWQ7XG4gICAgdGFyZ2V0LnBvc2l0aW9uSWQgPSBuZXh0LnBvc2l0aW9uSWQ7XG4gICAgdGFyZ2V0LnN1YmplY3RJZHMgPSBuZXh0LnN1YmplY3RJZHM7XG4gICAgdGFyZ2V0LnBvc2l0aW9uSWRzID0gbmV4dC5wb3NpdGlvbklkcztcbiAgfVxuXG4gIHByaXZhdGUgbWVyZ2VPcmlnaW4obGVmdD86IHN0cmluZywgcmlnaHQ/OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGlmICghbGVmdCAmJiAhcmlnaHQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKGxlZnQgPT09IHJpZ2h0KSByZXR1cm4gbGVmdDtcbiAgICByZXR1cm4gJ21peGVkJztcbiAgfVxuXG4gIHByaXZhdGUgbWVyZ2VNZXRhKFxuICAgIGxlZnQ/OiBXcml0ZU1ldGFkYXRhLFxuICAgIHJpZ2h0PzogV3JpdGVNZXRhZGF0YVxuICApOiBXcml0ZU1ldGFkYXRhIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIWxlZnQgJiYgIXJpZ2h0KSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBpZiAoIWxlZnQgfHwgIXJpZ2h0KSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBpZiAobGVmdC5vcmlnaW4gIT09IHJpZ2h0Lm9yaWdpbikge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgbGVmdC50cmFuc2FjdGlvbklkICE9PSByaWdodC50cmFuc2FjdGlvbklkIHx8XG4gICAgICBsZWZ0LnRyYW5zYWN0aW9uT3duZXIgIT09IHJpZ2h0LnRyYW5zYWN0aW9uT3duZXIgfHxcbiAgICAgIGxlZnQubXV0YXRpb25JbnRlbnQgIT09IHJpZ2h0Lm11dGF0aW9uSW50ZW50IHx8XG4gICAgICBnZXRXcml0ZVBhcnRpY2lwYXRpb24obGVmdCkgIT09IGdldFdyaXRlUGFydGljaXBhdGlvbihyaWdodClcbiAgICApIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGNvbnN0IG1lcmdlZCA9XG4gICAgICBsZWZ0LnN0cnVjdHVyYWxFZmZlY3QgJiYgIXJpZ2h0LnN0cnVjdHVyYWxFZmZlY3RcbiAgICAgICAgPyB7IC4uLnJpZ2h0LCBzdHJ1Y3R1cmFsRWZmZWN0OiBsZWZ0LnN0cnVjdHVyYWxFZmZlY3QgfVxuICAgICAgICA6IHJpZ2h0O1xuICAgIC8vIENvbnNpc3RlbnQgYXR0cmlidXRpb24gcGVybWl0cyBjb2FsZXNjaW5nIHZhbHVlcywgYnV0IGVsaWdpYmlsaXR5IGJlbG9uZ3NcbiAgICAvLyB0byB0aGUgZW50aXJlIGF1dGhvcmVkIHR1cm46IGEgbGF0ZXIgdW5kZXNpZ25hdGVkIHdyaXRlIGNhbm5vdCBlcmFzZSBpdC5cbiAgICByZXR1cm4gbWVyZ2VFbnRpdHlWYWx1ZVRyYW5zaXRpb24oXG4gICAgICBsZWZ0LFxuICAgICAgcmlnaHQsXG4gICAgICBpc01ldGFEZXNpZ25hdGVkKGxlZnQpXG4gICAgICAgID8geyAuLi5tZXJnZWQsIC4uLm1hcmtNZXRhRGVzaWduYXRlZCh1bmRlZmluZWQpIH1cbiAgICAgICAgOiBtZXJnZWRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb21wb3NpdGVCYXRjaEtleShlbnRyeTogUGVuZGluZ0VudHJ5KTogc3RyaW5nIHtcbiAgICBjb25zdCBwb3NpdGlvbktleSA9IGVudHJ5LnBvc2l0aW9uSWRzPy5qb2luKCcsJykgPz8gJyc7XG4gICAgY29uc3Qgc3ViamVjdEtleSA9IGVudHJ5LnN1YmplY3RJZHM/LmpvaW4oJywnKSA/PyAnJztcbiAgICBjb25zdCBwYXJ0aWNpcGF0aW9uID0gZ2V0V3JpdGVQYXJ0aWNpcGF0aW9uKGVudHJ5Lm1ldGEpO1xuICAgIHJldHVybiBgJHtlbnRyeS5wYXRofSR7UGF0aE5vdGlmaWVyLm93bmVyQm91bmRhcnlTZXBhcmF0b3J9JHtwb3NpdGlvbktleX0ke1BhdGhOb3RpZmllci5vd25lckJvdW5kYXJ5U2VwYXJhdG9yfSR7c3ViamVjdEtleX0ke1BhdGhOb3RpZmllci5vd25lckJvdW5kYXJ5U2VwYXJhdG9yfSR7cGFydGljaXBhdGlvbn1gO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIGFsbCBzdWJzY3JpYmVyc1xuICAgKi9cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpYmVycy5jbGVhcigpO1xuICAgIHRoaXMucGVuZGluZy5jbGVhcigpO1xuICAgIHRoaXMucGVuZGluZ0JlZm9yZU1lbWJlcnNoaXAgPSBbXTtcbiAgICAvLyBOb3RlOiBkbyBOT1QgY2xlYXIgZmx1c2ggY2FsbGJhY2tzIGhlcmUuIEVuaGFuY2VycyBtYXkgaGF2ZVxuICAgIC8vIHJlZ2lzdGVyZWQgb25GbHVzaCBsaXN0ZW5lcnMgdGhhdCBzaG91bGQgc3Vydml2ZSBhIHJ1bnRpbWUgcmVzZXRcbiAgICAvLyAoZS5nLiwgcmVzZXRQYXRoTm90aWZpZXIpIHRvIGF2b2lkIGxvc2luZyBzdWJzY3JpcHRpb25zIHNpbGVudGx5LlxuICAgIHRoaXMucGVuZGluZ0ZsdXNoID0gZmFsc2U7XG4gIH1cblxuICAvKiogUmVzZXQgcXVldWVkIHJ1bnRpbWUgc3RhdGUgYnV0IHByZXNlcnZlIHJlZ2lzdGVyZWQgbGlzdGVuZXJzLiAqL1xuICBvblJlc2V0KGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5yZXNldENhbGxiYWNrcy5hZGQoY2FsbGJhY2spO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnJlc2V0Q2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG4gIH1cblxuICBlbWl0UmVzZXQoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBjYiBvZiBBcnJheS5mcm9tKHRoaXMucmVzZXRDYWxsYmFja3MpKSB7XG4gICAgICB0cnkge1xuICAgICAgICB3aXRob3V0V3JpdGVPYnNlcnZhdGlvblNjb3BlcyhjYik7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gc3dhbGxvdyBjYWxsYmFjayBlcnJvcnMgdG8gYXZvaWQgYnJlYWtpbmcgcmVzZXQgZmxvd1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY291bnQgb2YgYWN0aXZlIHN1YnNjcmliZXJzIChmb3IgZGVidWdnaW5nKVxuICAgKi9cbiAgZ2V0U3Vic2NyaWJlckNvdW50KCk6IG51bWJlciB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBmb3IgKGNvbnN0IGhhbmRsZXJzIG9mIHRoaXMuc3Vic2NyaWJlcnMudmFsdWVzKCkpIHtcbiAgICAgIGNvdW50ICs9IGhhbmRsZXJzLnNpemU7XG4gICAgfVxuICAgIHJldHVybiBjb3VudDtcbiAgfVxufVxuXG4vKipcbiAqIExhenktaW5pdGlhbGl6ZWQgc2luZ2xldG9uIFBhdGhOb3RpZmllclxuICogQ3JlYXRlZCBvbiBmaXJzdCB1c2UsIHplcm8gb3ZlcmhlYWQgaWYgbm90IHVzZWRcbiAqL1xubGV0IGdsb2JhbFBhdGhOb3RpZmllcjogUGF0aE5vdGlmaWVyIHwgbnVsbCA9IG51bGw7XG5cbi8qKlxuICogR2V0IG9yIGNyZWF0ZSB0aGUgZ2xvYmFsIFBhdGhOb3RpZmllclxuICogTGF6eSBpbml0aWFsaXphdGlvbiBlbnN1cmVzIHplcm8gb3ZlcmhlYWQgaWYgZW50aXRpZXMvZW5oYW5jZXJzIGFyZW4ndCB1c2VkLlxuICogVXNlZCBieSBlbmhhbmNlcnMgbGlrZSBndWFyZHJhaWxzIGZvciBtb25pdG9yaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGF0aE5vdGlmaWVyKCk6IFBhdGhOb3RpZmllciB7XG4gIGlmICghZ2xvYmFsUGF0aE5vdGlmaWVyKSB7XG4gICAgZ2xvYmFsUGF0aE5vdGlmaWVyID0gbmV3IFBhdGhOb3RpZmllcigpO1xuICB9XG4gIC8vIOKaoO+4jyBJTlNUQUxMQVRJT04gSVMgQSBTSURFIEVGRkVDVCBPRiBBU0tJTkcgRk9SIFRIRSBFTkdJTkUsIGRlbGliZXJhdGVseS5cbiAgLy8gRXZlcnkgb3B0aW9uYWwgY29uc3VtZXIgYWxyZWFkeSBjYWxscyB0aGlzIHRvIHN1YnNjcmliZSwgc28gbm9uZSBvZiB0aGVtXG4gIC8vIG5lZWRzIHRvIGtub3cgdGhlIHBvcnQgZXhpc3RzIOKAlCBhbmQgdGhlIGJhcmUga2VybmVsLCB3aGljaCByZWFjaGVzIG9ubHlcbiAgLy8gYHBhdGgtb2JzZXJ2YXRpb24tcG9ydGAsIGNhbiBuZXZlciB0cmlnZ2VyIGl0LiBUaGF0IGlzIHdoYXQgbGV0cyB0aGVcbiAgLy8gZGVsaXZlcnkgaW1wbGVtZW50YXRpb24gdHJlZS1zaGFrZSBvdXQgb2YgYSBzdWJzY3JpYmVyLWxlc3MgYnVuZGxlLlxuICAvLyBSZS1pbnN0YWxsaW5nIHRoZSBzYW1lIHNpbmdsZXRvbiBrZWVwcyBPTkUgREVMSVZFUlkgQVVUSE9SSVRZLlxuICBpbnN0YWxsUGF0aERlbGl2ZXJ5UnVudGltZShnbG9iYWxQYXRoTm90aWZpZXIpO1xuICBpbnN0YWxsQnJhbmNoTWVtYmVyc2hpcENhcHR1cmUoXG4gICAgY2FwdHVyZVBsYWluQnJhbmNoTWVtYmVyc2hpcCxcbiAgICBjYXB0dXJlUGF0aFJlQWRkXG4gICk7XG4gIHJldHVybiBnbG9iYWxQYXRoTm90aWZpZXI7XG59XG5cbi8qKlxuICogUmVzZXQgdGhlIGdsb2JhbCBQYXRoTm90aWZpZXIgKGZvciB0ZXN0aW5nKVxuICpcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRQYXRoTm90aWZpZXIoKTogdm9pZCB7XG4gIC8vIFByZXNlcnZlIGV4aXN0aW5nIGluc3RhbmNlIHRvIGtlZXAgc3Vic2NyaWJlcnMgcmVnaXN0ZXJlZCAodGVzdHMgbWF5IGNhbGxcbiAgLy8gcmVzZXQgYWZ0ZXIgZW5oYW5jZXJzIGhhdmUgc3Vic2NyaWJlZCkuIEluc3RlYWQgb2YgcmVwbGFjaW5nIHRoZSBpbnN0YW5jZVxuICAvLyB3ZSBjbGVhciBpdHMgaW50ZXJuYWwgc3RhdGUgc28gbGlzdGVuZXJzIHJlbWFpbiBpbnRhY3QgYW5kIGxhdGVyIGNhbGxzIHRvXG4gIC8vIGBnZXRQYXRoTm90aWZpZXIoKWAgY29udGludWUgdG8gcmV0dXJuIHRoZSBzYW1lIG9iamVjdC5cbiAgaWYgKCFnbG9iYWxQYXRoTm90aWZpZXIpIHtcbiAgICBnbG9iYWxQYXRoTm90aWZpZXIgPSBuZXcgUGF0aE5vdGlmaWVyKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2xvYmFsUGF0aE5vdGlmaWVyLmNsZWFyKCk7XG4gIGdsb2JhbFBhdGhOb3RpZmllci5zZXRCYXRjaGluZ0VuYWJsZWQodHJ1ZSk7XG4gIGdsb2JhbFBhdGhOb3RpZmllci5lbWl0UmVzZXQoKTtcbn1cbiJdLCJmaWxlIjoiL3NyYy9saWIvcGF0aC1ub3RpZmllci50cyJ9

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2luZGV4ZWQvY2FuZGlkYXRlL3BhY2thZ2VzL2tlcm5lbC9zcmMvbGliL3BhdGgtbm90aWZpZXIudHMiLCIvc3JjL2xpYi9wYXRoLW5vdGlmaWVyLnRzIixbXV0=
}}