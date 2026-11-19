'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "StructuralStore", { enumerable: true, configurable: true, get(){ try { return StructuralStore } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/physical/entity-placement-stage.ts", {"importedNames":["EntityPlacementStage"]});


const __vite_ssr_import_1__ = await __vite_ssr_import__("/src/lib/internals/production-substrate-stats.ts", {"importedNames":["recordProductionSubstrateStat"]});
class StructuralStore {
  keysCache;
  subjectIds = /* @__PURE__ */ new Map();
  subjectStates = /* @__PURE__ */ new Map();
  subjectRevisions = /* @__PURE__ */ new Map();
  activeNodesByKey = /* @__PURE__ */ new Map();
  activeNodesBySubject = /* @__PURE__ */ new Map();
  nextSubjectId = 1;
  collectionIncarnation = 0;
  activeHead;
  activeTail;
  activeCount = 0;
  orderFrontier = {};
  placementForSubject(subject) {
    const node = this.activeNodesBySubject.get(subject);
    return node === void 0 ? { present: false } : {
      present: true,
      key: node.key,
      beforeSubject: node.prev?.subjectId,
      afterSubject: node.next?.subjectId
    };
  }
  preparePlacement() {
    return new __vite_ssr_import_0__.EntityPlacementStage(
      (subject) => this.placementForSubject(subject),
      this.activeHead?.subjectId,
      this.activeTail?.subjectId
    );
  }
  activeOrderFrontier() {
    return this.orderFrontier;
  }
  /** Only a complete, lineage-validated compensation may restore this token. */
  installCompensatedOrderFrontier(frontier) {
    this.orderFrontier = frontier;
  }
  planFreshSubjectIds(count) {
    return Array.from(
      { length: count },
      (_, index) => this.nextSubjectId + index
    );
  }
  allocateFreshSubjectId() {
    const subjectId = this.nextSubjectId;
    this.nextSubjectId += 1;
    return subjectId;
  }
  subjectIdForKey(key) {
    return this.subjectIds.get(key);
  }
  acquireSubjectHandleForKey(key) {
    const subjectId = this.subjectIds.get(key);
    return subjectId === void 0 ? void 0 : {
      subjectId,
      acquiredRevision: this.subjectRevision(subjectId),
      collectionIncarnation: this.collectionIncarnation
    };
  }
  resolveSubjectHandle(handle) {
    if (handle.collectionIncarnation !== this.collectionIncarnation) {
      return {
        state: "missing",
        subjectId: handle.subjectId,
        acquiredRevision: handle.acquiredRevision
      };
    };
    const state = this.subjectStates.get(handle.subjectId);
    if (state === void 0) {
      return {
        state: "missing",
        subjectId: handle.subjectId,
        acquiredRevision: handle.acquiredRevision
      };
    };
    if (state.active) {
      if (state.key === void 0) {
        throw new Error(
          `Active subject ${String(
            handle.subjectId
          )} is missing its active key.`
        );
      };
      return {
        state: "active",
        subjectId: handle.subjectId,
        key: state.key,
        revision: this.subjectRevision(handle.subjectId)
      };
    };
    return {
      state: "tombstoned",
      subjectId: handle.subjectId,
      restoreAllowed: state.restoreAllowed,
      revision: this.subjectRevision(handle.subjectId)
    };
  }
  stateForSubject(subjectId) {
    return this.subjectStates.get(subjectId);
  }
  hasSubject(subjectId) {
    return this.subjectStates.has(subjectId);
  }
  subjectRevision(subjectId) {
    return this.subjectRevisions.get(subjectId) ?? 0;
  }
  bumpSubjectRevision(subjectId) {
    this.subjectRevisions.set(subjectId, this.subjectRevision(subjectId) + 1);
  }
  activeKeyForSubject(subjectId) {
    const state = this.stateForSubject(subjectId);
    return state?.active ? state.key : void 0;
  }
  hasActiveKey(key) {
    return this.subjectIds.has(key);
  }
  activeKeyCount() {
    return this.activeCount;
  }
  /**
   * Active keys in order, shared until the next list or key mutation. Every
   * mutator of the active list (or of a node's key) clears it; a field write
   * changes neither, so reading `ids()` after one no longer re-walks the list.
   * Callers must not mutate the result.
   */
  activeKeysSnapshot() {
    if (this.keysCache) return this.keysCache;
    const keys = [];
    for (let node = this.activeHead; node !== void 0; node = node.next) {
      keys.push(node.key);
    };
    this.keysCache = keys;
    return keys;
  }
  /** Fills both arrays from one walk of the active order. */
  snapshotActiveOrder(keys, subjectIds) {
    for (let node = this.activeHead; node !== void 0; node = node.next) {
      keys.push(node.key);
      subjectIds.push(node.subjectId);
    }
  }
  firstActiveKey() {
    return this.activeHead?.key;
  }
  lastActiveKey() {
    return this.activeTail?.key;
  }
  prepareTarget(subjects, order, orderFrontier, prepare) {
    return prepare(
      this.subjectStates,
      this.subjectRevisions,
      subjects,
      order,
      orderFrontier
    );
  }
  installPreparedTarget(target) {
    this.keysCache = void 0;
    this.subjectIds = target.subjectIds;
    this.subjectStates = target.subjectStates;
    this.subjectRevisions = target.subjectRevisions;
    this.activeNodesByKey = target.activeNodesByKey;
    this.activeNodesBySubject = target.activeNodesBySubject;
    this.activeHead = target.activeHead;
    this.activeTail = target.activeTail;
    this.activeCount = target.activeCount;
    this.orderFrontier = target.orderFrontier;
  }
  moveKeysToFront(keys) {
    this.keysCache = void 0;
    const nodes = [
      ...new Set(
        keys.map((key) => this.activeNodesByKey.get(key)).filter((node) => node !== void 0)
      )
    ];
    for (const node of nodes) {
      this.detachNode(node);
    };
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      this.prependDetachedNode(nodes[index]);
    };
    if (nodes.length > 0) this.orderFrontier = {};
  }
  reorderActiveKeys(keys) {
    let current = this.activeHead;
    let unchanged = true;
    for (const key of keys) {
      const node = this.activeNodesByKey.get(key);
      if (node === void 0) continue;
      if (node !== current) {
        unchanged = false;
        break;
      };
      current = current.next;
    };
    if (unchanged && current === void 0) return;
    this.keysCache = void 0;
    this.activeHead = void 0;
    this.activeTail = void 0;
    for (const node of this.activeNodesByKey.values()) {
      node.prev = void 0;
      node.next = void 0;
    };
    let nextCount = 0;
    for (const key of keys) {
      const node = this.activeNodesByKey.get(key);
      if (node === void 0) {
        continue;
      };
      this.appendDetachedNode(node);
      nextCount += 1;
    };
    this.activeCount = nextCount;
    this.orderFrontier = {};
  }
  neighborSubjectsForKey(key) {
    const node = this.activeNodesByKey.get(key);
    if (node === void 0) {
      return {};
    };
    return {
      beforeSubject: node.prev?.subjectId,
      afterSubject: node.next?.subjectId
    };
  }
  tombstonedSubjectsSnapshot() {
    return [...this.subjectStates.entries()].filter(([, subjectState]) => !subjectState.active).map(([subjectId]) => subjectId).sort((left, right) => left - right);
  }
  createSubject(subjectId, key) {
    (0,__vite_ssr_import_1__.recordProductionSubstrateStat)("structuralSubjectsCreated");
    this.nextSubjectId = Math.max(this.nextSubjectId, subjectId + 1);
    this.activateSubject(subjectId, key);
    this.subjectRevisions.set(subjectId, 0);
    this.createAndAppendActiveNode(subjectId, key);
    this.orderFrontier = {};
  }
  transferSubject(subjectId, from, to, restoreAllowed = true) {
    (0,__vite_ssr_import_1__.recordProductionSubstrateStat)("structuralSubjectTransfers");
    const node = this.activeNodesByKey.get(from);
    this.subjectIds.delete(from);
    this.activateSubject(subjectId, to, restoreAllowed);
    if (node === void 0) {
      this.createAndAppendActiveNode(subjectId, to);
      return;
    };
    this.activeNodesByKey.delete(from);
    node.key = to;
    this.keysCache = void 0;
    this.activeNodesByKey.set(to, node);
    this.activeNodesBySubject.set(subjectId, node);
  }
  tombstoneSubject(subjectId, key, restoreAllowed) {
    (0,__vite_ssr_import_1__.recordProductionSubstrateStat)("structuralSubjectTombstones");
    this.subjectIds.delete(key);
    const node = this.activeNodesByKey.get(key);
    if (node !== void 0) {
      this.unregisterActiveNode(node);
      this.detachNode(node);
      this.activeCount -= 1;
    };
    this.subjectStates.set(subjectId, {
      active: false,
      restoreAllowed
    });
    this.orderFrontier = {};
  }
  restoreSubject(subjectId, key, beforeSubject, afterSubject, restoreAllowed = true) {
    const placement = this.resolveSubjectRestorePlacement(
      beforeSubject,
      afterSubject
    );
    this.restoreSubjectAtResolvedPlacement(
      subjectId,
      key,
      placement,
      restoreAllowed
    );
  }
  resolveSubjectRestorePlacement(beforeSubject, afterSubject) {
    const beforeNode = beforeSubject === void 0 ? void 0 : this.activeNodesBySubject.get(beforeSubject);
    const afterNode = afterSubject === void 0 ? void 0 : this.activeNodesBySubject.get(afterSubject);
    if (beforeNode !== void 0 && afterNode !== void 0) {
      if (this.nodePrecedes(beforeNode, afterNode)) {
        return {
          beforeSubject: beforeNode.subjectId,
          afterSubject: afterNode.subjectId,
          beforeKey: beforeNode.key,
          afterKey: afterNode.key
        };
      };
      return {
        beforeSubject: afterNode.prev?.subjectId,
        afterSubject: afterNode.subjectId,
        beforeKey: afterNode.prev?.key,
        afterKey: afterNode.key
      };
    };
    if (afterNode !== void 0) {
      return {
        beforeSubject: afterNode.prev?.subjectId,
        afterSubject: afterNode.subjectId,
        beforeKey: afterNode.prev?.key,
        afterKey: afterNode.key
      };
    };
    if (beforeNode !== void 0) {
      return {
        beforeSubject: beforeNode.subjectId,
        afterSubject: beforeNode.next?.subjectId,
        beforeKey: beforeNode.key,
        afterKey: beforeNode.next?.key
      };
    };
    return {
      beforeSubject: this.activeTail?.subjectId,
      beforeKey: this.activeTail?.key
    };
  }
  restoreSubjectAtResolvedPlacement(subjectId, key, placement, restoreAllowed = true) {
    this.activateSubject(subjectId, key, restoreAllowed);
    const node = {
      key,
      subjectId,
      prev: void 0,
      next: void 0
    };
    this.activeNodesByKey.set(key, node);
    this.activeNodesBySubject.set(subjectId, node);
    this.activeCount += 1;
    this.orderFrontier = {};
    const beforeNode = placement.beforeSubject === void 0 ? void 0 : this.activeNodesBySubject.get(placement.beforeSubject);
    const afterNode = placement.afterSubject === void 0 ? void 0 : this.activeNodesBySubject.get(placement.afterSubject);
    if (afterNode !== void 0) {
      this.insertDetachedNodeBefore(node, afterNode);
      return;
    };
    if (beforeNode !== void 0) {
      this.insertDetachedNodeAfter(node, beforeNode);
      return;
    };
    this.appendDetachedNode(node);
  }
  /** Relocate an active lifetime without retiring it or emitting lifecycle effects. */
  placeActiveSubject(subjectId, beforeSubject, afterSubject) {
    const node = this.activeNodesBySubject.get(subjectId);
    if (!node) throw new Error("Placement lifetime is not active");
    if (beforeSubject === subjectId || afterSubject === subjectId)
      throw new Error("Placement cannot name its own lifetime");
    const placement = this.resolveSubjectRestorePlacement(
      beforeSubject,
      afterSubject
    );
    const after = placement.afterSubject === subjectId ? void 0 : this.activeNodesBySubject.get(placement.afterSubject);
    const before = placement.beforeSubject === subjectId ? void 0 : this.activeNodesBySubject.get(placement.beforeSubject);
    this.detachNode(node);
    if (after) this.insertDetachedNodeBefore(node, after);
    else if (before) this.insertDetachedNodeAfter(node, before);
    else this.appendDetachedNode(node);
    this.keysCache = void 0;
    this.orderFrontier = {};
  }
  retireSubject(subjectId) {
    this.subjectStates.set(subjectId, {
      active: false,
      restoreAllowed: false
    });
  }
  /**
   * Drop a retired subject's lifetime ledger entirely — state AND revision.
   *
   * ⚠️ TRIAL. This is the null hypothesis for "is the ~117 B/retired lifetime
   * record earned?" (docs/architecture/retired-subject-churn.md, open question
   * 2). `retireSubject` above keeps a `{active:false, restoreAllowed:false}`
   * record forever, which is what makes zero-owner churn linear in every subject
   * that ever existed. This deletes it.
   *
   * SAFE ONLY FOR A TERMINAL, ZERO-OWNER RETIREMENT, and the reason is subject
   * id allocation: `nextSubjectId` only ever increases, and `tombstoneSubject`
   * has already removed the key -> subject mapping. A later add of the same
   * business key therefore gets a FRESH subject id and cannot collide with the
   * forgotten one. Deleting the record cannot resurrect or alias a subject.
   *
   * WHAT IT GIVES UP: `resolveSubjectHandle` reports `missing` rather than
   * `tombstoned` for the forgotten subject, and `planRestore`'s
   * "has retired backing and cannot be restored" guard loses its input. Both are
   * acceptable only because a tree with no restoration authority has no path to
   * a restore at all — the guard becomes unreachable rather than unenforced. If
   * a restorer can exist, DO NOT call this.
   */
  forgetSubject(subjectId) {
    this.subjectStates.delete(subjectId);
    this.subjectRevisions.delete(subjectId);
    this.activeNodesBySubject.delete(subjectId);
  }
  clear() {
    this.keysCache = void 0;
    this.subjectIds.clear();
    this.subjectStates.clear();
    this.subjectRevisions.clear();
    this.activeNodesByKey.clear();
    this.activeNodesBySubject.clear();
    this.activeHead = void 0;
    this.activeTail = void 0;
    this.activeCount = 0;
    this.nextSubjectId = 1;
    this.collectionIncarnation += 1;
    this.orderFrontier = {};
  }
  createAndAppendActiveNode(subjectId, key) {
    this.keysCache = void 0;
    const node = {
      key,
      subjectId,
      prev: void 0,
      next: void 0
    };
    this.activeNodesByKey.set(key, node);
    this.activeNodesBySubject.set(subjectId, node);
    this.appendDetachedNode(node);
    this.activeCount += 1;
  }
  unregisterActiveNode(node) {
    this.keysCache = void 0;
    this.activeNodesByKey.delete(node.key);
    this.activeNodesBySubject.delete(node.subjectId);
  }
  prependDetachedNode(node) {
    this.keysCache = void 0;
    node.prev = void 0;
    node.next = this.activeHead;
    if (this.activeHead !== void 0) {
      this.activeHead.prev = node;
    } else {
      this.activeTail = node;
    };
    this.activeHead = node;
  }
  appendDetachedNode(node) {
    this.keysCache = void 0;
    node.next = void 0;
    node.prev = this.activeTail;
    if (this.activeTail !== void 0) {
      this.activeTail.next = node;
    } else {
      this.activeHead = node;
    };
    this.activeTail = node;
  }
  insertDetachedNodeAfter(node, anchor) {
    this.keysCache = void 0;
    node.prev = anchor;
    node.next = anchor.next;
    if (anchor.next !== void 0) {
      anchor.next.prev = node;
    } else {
      this.activeTail = node;
    };
    anchor.next = node;
  }
  insertDetachedNodeBefore(node, anchor) {
    this.keysCache = void 0;
    node.next = anchor;
    node.prev = anchor.prev;
    if (anchor.prev !== void 0) {
      anchor.prev.next = node;
    } else {
      this.activeHead = node;
    };
    anchor.prev = node;
  }
  detachNode(node) {
    this.keysCache = void 0;
    if (node.prev !== void 0) {
      node.prev.next = node.next;
    } else {
      this.activeHead = node.next;
    };
    if (node.next !== void 0) {
      node.next.prev = node.prev;
    } else {
      this.activeTail = node.prev;
    };
    node.prev = void 0;
    node.next = void 0;
  }
  nodePrecedes(left, right) {
    let node = left;
    while (node !== void 0) {
      if (node === right) {
        return true;
      };
      node = node.next;
    };
    return false;
  }
  activateSubject(subjectId, key, restoreAllowed = true) {
    this.subjectIds.set(key, subjectId);
    this.subjectStates.set(subjectId, {
      active: true,
      key,
      restoreAllowed
    });
  }
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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QUNwQjtBQUNBLFdBQU8sT0FBTztBQUFBLEVBQ2hCO0FBQUEsRUFFUSx5QkFDTixNQUNBLFFBQ007QUFDTixTQUFLLFlBQVk7QUFDakIsU0FBSyxPQUFPO0FBQ1osU0FBSyxPQUFPLE9BQU87QUFDbkIsUUFBSSxPQUFPLFNBQVMsUUFBVztBQUM3QixhQUFPLEtBQUssT0FBTztBQUFBLElBQ3JCLE9BQU87QUFDTCxXQUFLLGFBQWE7QUFBQSxJQUNwQjtBQUNBLFdBQU8sT0FBTztBQUFBLEVBQ2hCO0FBQUEsRUFFUSxXQUFXLE1BQTJCO0FBQzVDLFNBQUssWUFBWTtBQUNqQixRQUFJLEtBQUssU0FBUyxRQUFXO0FBQzNCLFdBQUssS0FBSyxPQUFPLEtBQUs7QUFBQSxJQUN4QixPQUFPO0FBQ0wsV0FBSyxhQUFhLEtBQUs7QUFBQSxJQUN6QjtBQUVBLFFBQUksS0FBSyxTQUFTLFFBQVc7QUFDM0IsV0FBSyxLQUFLLE9BQU8sS0FBSztBQUFBLElBQ3hCLE9BQU87QUFDTCxXQUFLLGFBQWEsS0FBSztBQUFBLElBQ3pCO0FBRUEsU0FBSyxPQUFPO0FBQ1osU0FBSyxPQUFPO0FBQUEsRUFDZDtBQUFBLEVBRVEsYUFBYSxNQUFxQixPQUErQjtBQUN2RSxRQUFJLE9BQWtDO0FBQ3RDLFdBQU8sU0FBUyxRQUFXO0FBQ3pCLFVBQUksU0FBUyxPQUFPO0FBQ2xCLGVBQU87QUFBQSxNQUNUO0FBQ0EsYUFBTyxLQUFLO0FBQUEsSUFDZDtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFUSxnQkFDTixXQUNBLEtBQ0EsaUJBQWlCLE1BQ1g7QUFDTixTQUFLLFdBQVcsSUFBSSxLQUFLLFNBQVM7QUFDbEMsU0FBSyxjQUFjLElBQUksV0FBVztBQUFBLE1BQ2hDLFFBQVE7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRiIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsic3RydWN0dXJhbC1zdG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBFbnRpdHlQbGFjZW1lbnRTdGFnZSxcbiAgdHlwZSBFbnRpdHlQbGFjZW1lbnQsXG59IGZyb20gJy4vZW50aXR5LXBsYWNlbWVudC1zdGFnZSc7XG5pbXBvcnQgdHlwZSB7IHByZXBhcmVTdHJ1Y3R1cmFsVGFyZ2V0IH0gZnJvbSAnLi9wcmVwYXJlLXN0cnVjdHVyYWwtdGFyZ2V0JztcbmltcG9ydCB7IHJlY29yZFByb2R1Y3Rpb25TdWJzdHJhdGVTdGF0IH0gZnJvbSAnLi4vaW50ZXJuYWxzL3Byb2R1Y3Rpb24tc3Vic3RyYXRlLXN0YXRzJztcblxuZXhwb3J0IHR5cGUgU3ViamVjdExpZmV0aW1lUmVjb3JkPEsgZXh0ZW5kcyBzdHJpbmcgfCBudW1iZXI+ID0ge1xuICBhY3RpdmU6IGJvb2xlYW47XG4gIGtleT86IEs7XG4gIHJlc3RvcmVBbGxvd2VkOiBib29sZWFuO1xufTtcblxuZXhwb3J0IHR5cGUgUmVzb2x2ZWRTdWJqZWN0UmVzdG9yZVBsYWNlbWVudDxLIGV4dGVuZHMgc3RyaW5nIHwgbnVtYmVyPiA9IHtcbiAgYmVmb3JlU3ViamVjdD86IG51bWJlcjtcbiAgYWZ0ZXJTdWJqZWN0PzogbnVtYmVyO1xuICBiZWZvcmVLZXk/OiBLO1xuICBhZnRlcktleT86IEs7XG59O1xuXG5leHBvcnQgdHlwZSBBY3F1aXJlZFN1YmplY3RIYW5kbGUgPSB7XG4gIHN1YmplY3RJZDogbnVtYmVyO1xuICBhY3F1aXJlZFJldmlzaW9uOiBudW1iZXI7XG4gIGNvbGxlY3Rpb25JbmNhcm5hdGlvbjogbnVtYmVyO1xufTtcblxuZXhwb3J0IHR5cGUgUmVzb2x2ZWRTdWJqZWN0SGFuZGxlPEsgZXh0ZW5kcyBzdHJpbmcgfCBudW1iZXI+ID1cbiAgfCB7XG4gICAgICBzdGF0ZTogJ2FjdGl2ZSc7XG4gICAgICBzdWJqZWN0SWQ6IG51bWJlcjtcbiAgICAgIGtleTogSztcbiAgICAgIHJldmlzaW9uOiBudW1iZXI7XG4gICAgfVxuICB8IHtcbiAgICAgIHN0YXRlOiAndG9tYnN0b25lZCc7XG4gICAgICBzdWJqZWN0SWQ6IG51bWJlcjtcbiAgICAgIHJlc3RvcmVBbGxvd2VkOiBib29sZWFuO1xuICAgICAgcmV2aXNpb246IG51bWJlcjtcbiAgICB9XG4gIHwge1xuICAgICAgc3RhdGU6ICdtaXNzaW5nJztcbiAgICAgIHN1YmplY3RJZDogbnVtYmVyO1xuICAgICAgYWNxdWlyZWRSZXZpc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbmV4cG9ydCB0eXBlIFN0cnVjdHVyYWxUYXJnZXRTdWJqZWN0PEsgZXh0ZW5kcyBzdHJpbmcgfCBudW1iZXI+ID0ge1xuICByZWFkb25seSBzdWJqZWN0SWQ6IG51bWJlcjtcbiAgcmVhZG9ubHkga2V5OiBLO1xufTtcblxuZXhwb3J0IHR5cGUgQWN0aXZlTm9kZTxLIGV4dGVuZHMgc3RyaW5nIHwgbnVtYmVyPiA9IHtcbiAga2V5OiBLO1xuICBzdWJqZWN0SWQ6IG51bWJlcjtcbiAgcHJldjogQWN0aXZlTm9kZTxLPiB8IHVuZGVmaW5lZDtcbiAgbmV4dDogQWN0aXZlTm9kZTxLPiB8IHVuZGVmaW5lZDtcbn07XG5cbmV4cG9ydCB0eXBlIFByZXBhcmVkU3RydWN0dXJhbFRhcmdldDxLIGV4dGVuZHMgc3RyaW5nIHwgbnVtYmVyPiA9IHtcbiAgcmVhZG9ubHkgc3ViamVjdElkczogTWFwPEssIG51bWJlcj47XG4gIHJlYWRvbmx5IHN1YmplY3RTdGF0ZXM6IE1hcDxudW1iZXIsIFN1YmplY3RMaWZldGltZVJlY29yZDxLPj47XG4gIHJlYWRvbmx5IHN1YmplY3RSZXZpc2lvbnM6IE1hcDxudW1iZXIsIG51bWJlcj47XG4gIHJlYWRvbmx5IGFjdGl2ZU5vZGVzQnlLZXk6IE1hcDxLLCBBY3RpdmVOb2RlPEs+PjtcbiAgcmVhZG9ubHkgYWN0aXZlTm9kZXNCeVN1YmplY3Q6IE1hcDxudW1iZXIsIEFjdGl2ZU5vZGU8Sz4+O1xuICByZWFkb25seSBhY3RpdmVIZWFkOiBBY3RpdmVOb2RlPEs+IHwgdW5kZWZpbmVkO1xuICByZWFkb25seSBhY3RpdmVUYWlsOiBBY3RpdmVOb2RlPEs+IHwgdW5kZWZpbmVkO1xuICByZWFkb25seSBhY3RpdmVDb3VudDogbnVtYmVyO1xuICByZWFkb25seSBvcmRlckZyb250aWVyOiB1bmtub3duO1xufTtcblxuZXhwb3J0IGNsYXNzIFN0cnVjdHVyYWxTdG9yZTxLIGV4dGVuZHMgc3RyaW5nIHwgbnVtYmVyPiB7XG4gIHByaXZhdGUga2V5c0NhY2hlOiByZWFkb25seSBLW10gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgc3ViamVjdElkcyA9IG5ldyBNYXA8SywgbnVtYmVyPigpO1xuICBwcml2YXRlIHN1YmplY3RTdGF0ZXMgPSBuZXcgTWFwPG51bWJlciwgU3ViamVjdExpZmV0aW1lUmVjb3JkPEs+PigpO1xuICBwcml2YXRlIHN1YmplY3RSZXZpc2lvbnMgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICBwcml2YXRlIGFjdGl2ZU5vZGVzQnlLZXkgPSBuZXcgTWFwPEssIEFjdGl2ZU5vZGU8Sz4+KCk7XG4gIHByaXZhdGUgYWN0aXZlTm9kZXNCeVN1YmplY3QgPSBuZXcgTWFwPG51bWJlciwgQWN0aXZlTm9kZTxLPj4oKTtcbiAgcHJpdmF0ZSBuZXh0U3ViamVjdElkID0gMTtcbiAgcHJpdmF0ZSBjb2xsZWN0aW9uSW5jYXJuYXRpb24gPSAwO1xuICBwcml2YXRlIGFjdGl2ZUhlYWQ6IEFjdGl2ZU5vZGU8Sz4gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgYWN0aXZlVGFpbDogQWN0aXZlTm9kZTxLPiB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBhY3RpdmVDb3VudCA9IDA7XG4gIHByaXZhdGUgb3JkZXJGcm9udGllcjogb2JqZWN0ID0ge307XG5cbiAgcGxhY2VtZW50Rm9yU3ViamVjdChzdWJqZWN0OiBudW1iZXIpOiBFbnRpdHlQbGFjZW1lbnQ8Sz4ge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmdldChzdWJqZWN0KTtcbiAgICByZXR1cm4gbm9kZSA9PT0gdW5kZWZpbmVkXG4gICAgICA/IHsgcHJlc2VudDogZmFsc2UgfVxuICAgICAgOiB7XG4gICAgICAgICAgcHJlc2VudDogdHJ1ZSxcbiAgICAgICAgICBrZXk6IG5vZGUua2V5LFxuICAgICAgICAgIGJlZm9yZVN1YmplY3Q6IG5vZGUucHJldj8uc3ViamVjdElkLFxuICAgICAgICAgIGFmdGVyU3ViamVjdDogbm9kZS5uZXh0Py5zdWJqZWN0SWQsXG4gICAgICAgIH07XG4gIH1cbiAgcHJlcGFyZVBsYWNlbWVudCgpOiBFbnRpdHlQbGFjZW1lbnRTdGFnZTxLPiB7XG4gICAgcmV0dXJuIG5ldyBFbnRpdHlQbGFjZW1lbnRTdGFnZShcbiAgICAgIChzdWJqZWN0KSA9PiB0aGlzLnBsYWNlbWVudEZvclN1YmplY3Qoc3ViamVjdCksXG4gICAgICB0aGlzLmFjdGl2ZUhlYWQ/LnN1YmplY3RJZCxcbiAgICAgIHRoaXMuYWN0aXZlVGFpbD8uc3ViamVjdElkXG4gICAgKTtcbiAgfVxuICBhY3RpdmVPcmRlckZyb250aWVyKCk6IHVua25vd24ge1xuICAgIHJldHVybiB0aGlzLm9yZGVyRnJvbnRpZXI7XG4gIH1cblxuICAvKiogT25seSBhIGNvbXBsZXRlLCBsaW5lYWdlLXZhbGlkYXRlZCBjb21wZW5zYXRpb24gbWF5IHJlc3RvcmUgdGhpcyB0b2tlbi4gKi9cbiAgaW5zdGFsbENvbXBlbnNhdGVkT3JkZXJGcm9udGllcihmcm9udGllcjogdW5rbm93bik6IHZvaWQge1xuICAgIHRoaXMub3JkZXJGcm9udGllciA9IGZyb250aWVyIGFzIG9iamVjdDtcbiAgfVxuXG4gIHBsYW5GcmVzaFN1YmplY3RJZHMoY291bnQ6IG51bWJlcik6IHJlYWRvbmx5IG51bWJlcltdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShcbiAgICAgIHsgbGVuZ3RoOiBjb3VudCB9LFxuICAgICAgKF8sIGluZGV4KSA9PiB0aGlzLm5leHRTdWJqZWN0SWQgKyBpbmRleFxuICAgICk7XG4gIH1cblxuICBhbGxvY2F0ZUZyZXNoU3ViamVjdElkKCk6IG51bWJlciB7XG4gICAgY29uc3Qgc3ViamVjdElkID0gdGhpcy5uZXh0U3ViamVjdElkO1xuICAgIHRoaXMubmV4dFN1YmplY3RJZCArPSAxO1xuICAgIHJldHVybiBzdWJqZWN0SWQ7XG4gIH1cblxuICBzdWJqZWN0SWRGb3JLZXkoa2V5OiBLKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zdWJqZWN0SWRzLmdldChrZXkpO1xuICB9XG5cbiAgYWNxdWlyZVN1YmplY3RIYW5kbGVGb3JLZXkoa2V5OiBLKTogQWNxdWlyZWRTdWJqZWN0SGFuZGxlIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBzdWJqZWN0SWQgPSB0aGlzLnN1YmplY3RJZHMuZ2V0KGtleSk7XG4gICAgcmV0dXJuIHN1YmplY3RJZCA9PT0gdW5kZWZpbmVkXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7XG4gICAgICAgICAgc3ViamVjdElkLFxuICAgICAgICAgIGFjcXVpcmVkUmV2aXNpb246IHRoaXMuc3ViamVjdFJldmlzaW9uKHN1YmplY3RJZCksXG4gICAgICAgICAgY29sbGVjdGlvbkluY2FybmF0aW9uOiB0aGlzLmNvbGxlY3Rpb25JbmNhcm5hdGlvbixcbiAgICAgICAgfTtcbiAgfVxuXG4gIHJlc29sdmVTdWJqZWN0SGFuZGxlKFxuICAgIGhhbmRsZTogQWNxdWlyZWRTdWJqZWN0SGFuZGxlXG4gICk6IFJlc29sdmVkU3ViamVjdEhhbmRsZTxLPiB7XG4gICAgaWYgKGhhbmRsZS5jb2xsZWN0aW9uSW5jYXJuYXRpb24gIT09IHRoaXMuY29sbGVjdGlvbkluY2FybmF0aW9uKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0ZTogJ21pc3NpbmcnLFxuICAgICAgICBzdWJqZWN0SWQ6IGhhbmRsZS5zdWJqZWN0SWQsXG4gICAgICAgIGFjcXVpcmVkUmV2aXNpb246IGhhbmRsZS5hY3F1aXJlZFJldmlzaW9uLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3ViamVjdFN0YXRlcy5nZXQoaGFuZGxlLnN1YmplY3RJZCk7XG5cbiAgICBpZiAoc3RhdGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdGU6ICdtaXNzaW5nJyxcbiAgICAgICAgc3ViamVjdElkOiBoYW5kbGUuc3ViamVjdElkLFxuICAgICAgICBhY3F1aXJlZFJldmlzaW9uOiBoYW5kbGUuYWNxdWlyZWRSZXZpc2lvbixcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlLmFjdGl2ZSkge1xuICAgICAgaWYgKHN0YXRlLmtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQWN0aXZlIHN1YmplY3QgJHtTdHJpbmcoXG4gICAgICAgICAgICBoYW5kbGUuc3ViamVjdElkXG4gICAgICAgICAgKX0gaXMgbWlzc2luZyBpdHMgYWN0aXZlIGtleS5gXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgc3ViamVjdElkOiBoYW5kbGUuc3ViamVjdElkLFxuICAgICAgICBrZXk6IHN0YXRlLmtleSxcbiAgICAgICAgcmV2aXNpb246IHRoaXMuc3ViamVjdFJldmlzaW9uKGhhbmRsZS5zdWJqZWN0SWQpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdGU6ICd0b21ic3RvbmVkJyxcbiAgICAgIHN1YmplY3RJZDogaGFuZGxlLnN1YmplY3RJZCxcbiAgICAgIHJlc3RvcmVBbGxvd2VkOiBzdGF0ZS5yZXN0b3JlQWxsb3dlZCxcbiAgICAgIHJldmlzaW9uOiB0aGlzLnN1YmplY3RSZXZpc2lvbihoYW5kbGUuc3ViamVjdElkKSxcbiAgICB9O1xuICB9XG5cbiAgc3RhdGVGb3JTdWJqZWN0KHN1YmplY3RJZDogbnVtYmVyKTogU3ViamVjdExpZmV0aW1lUmVjb3JkPEs+IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zdWJqZWN0U3RhdGVzLmdldChzdWJqZWN0SWQpO1xuICB9XG5cbiAgaGFzU3ViamVjdChzdWJqZWN0SWQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnN1YmplY3RTdGF0ZXMuaGFzKHN1YmplY3RJZCk7XG4gIH1cblxuICBzdWJqZWN0UmV2aXNpb24oc3ViamVjdElkOiBudW1iZXIpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnN1YmplY3RSZXZpc2lvbnMuZ2V0KHN1YmplY3RJZCkgPz8gMDtcbiAgfVxuXG4gIGJ1bXBTdWJqZWN0UmV2aXNpb24oc3ViamVjdElkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnN1YmplY3RSZXZpc2lvbnMuc2V0KHN1YmplY3RJZCwgdGhpcy5zdWJqZWN0UmV2aXNpb24oc3ViamVjdElkKSArIDEpO1xuICB9XG5cbiAgYWN0aXZlS2V5Rm9yU3ViamVjdChzdWJqZWN0SWQ6IG51bWJlcik6IEsgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZUZvclN1YmplY3Qoc3ViamVjdElkKTtcbiAgICByZXR1cm4gc3RhdGU/LmFjdGl2ZSA/IHN0YXRlLmtleSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGhhc0FjdGl2ZUtleShrZXk6IEspOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zdWJqZWN0SWRzLmhhcyhrZXkpO1xuICB9XG5cbiAgYWN0aXZlS2V5Q291bnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5hY3RpdmVDb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY3RpdmUga2V5cyBpbiBvcmRlciwgc2hhcmVkIHVudGlsIHRoZSBuZXh0IGxpc3Qgb3Iga2V5IG11dGF0aW9uLiBFdmVyeVxuICAgKiBtdXRhdG9yIG9mIHRoZSBhY3RpdmUgbGlzdCAob3Igb2YgYSBub2RlJ3Mga2V5KSBjbGVhcnMgaXQ7IGEgZmllbGQgd3JpdGVcbiAgICogY2hhbmdlcyBuZWl0aGVyLCBzbyByZWFkaW5nIGBpZHMoKWAgYWZ0ZXIgb25lIG5vIGxvbmdlciByZS13YWxrcyB0aGUgbGlzdC5cbiAgICogQ2FsbGVycyBtdXN0IG5vdCBtdXRhdGUgdGhlIHJlc3VsdC5cbiAgICovXG4gIGFjdGl2ZUtleXNTbmFwc2hvdCgpOiByZWFkb25seSBLW10ge1xuICAgIGlmICh0aGlzLmtleXNDYWNoZSkgcmV0dXJuIHRoaXMua2V5c0NhY2hlO1xuICAgIGNvbnN0IGtleXM6IEtbXSA9IFtdO1xuICAgIGZvciAobGV0IG5vZGUgPSB0aGlzLmFjdGl2ZUhlYWQ7IG5vZGUgIT09IHVuZGVmaW5lZDsgbm9kZSA9IG5vZGUubmV4dCkge1xuICAgICAga2V5cy5wdXNoKG5vZGUua2V5KTtcbiAgICB9XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSBrZXlzO1xuICAgIHJldHVybiBrZXlzO1xuICB9XG5cbiAgLyoqIEZpbGxzIGJvdGggYXJyYXlzIGZyb20gb25lIHdhbGsgb2YgdGhlIGFjdGl2ZSBvcmRlci4gKi9cbiAgc25hcHNob3RBY3RpdmVPcmRlcihrZXlzOiBLW10sIHN1YmplY3RJZHM6IG51bWJlcltdKTogdm9pZCB7XG4gICAgZm9yIChsZXQgbm9kZSA9IHRoaXMuYWN0aXZlSGVhZDsgbm9kZSAhPT0gdW5kZWZpbmVkOyBub2RlID0gbm9kZS5uZXh0KSB7XG4gICAgICBrZXlzLnB1c2gobm9kZS5rZXkpO1xuICAgICAgc3ViamVjdElkcy5wdXNoKG5vZGUuc3ViamVjdElkKTtcbiAgICB9XG4gIH1cblxuICBmaXJzdEFjdGl2ZUtleSgpOiBLIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5hY3RpdmVIZWFkPy5rZXk7XG4gIH1cblxuICBsYXN0QWN0aXZlS2V5KCk6IEsgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmFjdGl2ZVRhaWw/LmtleTtcbiAgfVxuXG4gIHByZXBhcmVUYXJnZXQoXG4gICAgc3ViamVjdHM6IHJlYWRvbmx5IFN0cnVjdHVyYWxUYXJnZXRTdWJqZWN0PEs+W10sXG4gICAgb3JkZXI6IHJlYWRvbmx5IG51bWJlcltdLFxuICAgIG9yZGVyRnJvbnRpZXI6IHVua25vd24sXG4gICAgcHJlcGFyZTogdHlwZW9mIHByZXBhcmVTdHJ1Y3R1cmFsVGFyZ2V0PEs+XG4gICk6IFByZXBhcmVkU3RydWN0dXJhbFRhcmdldDxLPiB7XG4gICAgcmV0dXJuIHByZXBhcmUoXG4gICAgICB0aGlzLnN1YmplY3RTdGF0ZXMsXG4gICAgICB0aGlzLnN1YmplY3RSZXZpc2lvbnMsXG4gICAgICBzdWJqZWN0cyxcbiAgICAgIG9yZGVyLFxuICAgICAgb3JkZXJGcm9udGllclxuICAgICk7XG4gIH1cblxuICBpbnN0YWxsUHJlcGFyZWRUYXJnZXQodGFyZ2V0OiBQcmVwYXJlZFN0cnVjdHVyYWxUYXJnZXQ8Sz4pOiB2b2lkIHtcbiAgICB0aGlzLmtleXNDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnN1YmplY3RJZHMgPSB0YXJnZXQuc3ViamVjdElkcztcbiAgICB0aGlzLnN1YmplY3RTdGF0ZXMgPSB0YXJnZXQuc3ViamVjdFN0YXRlcztcbiAgICB0aGlzLnN1YmplY3RSZXZpc2lvbnMgPSB0YXJnZXQuc3ViamVjdFJldmlzaW9ucztcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkgPSB0YXJnZXQuYWN0aXZlTm9kZXNCeUtleTtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0ID0gdGFyZ2V0LmFjdGl2ZU5vZGVzQnlTdWJqZWN0O1xuICAgIHRoaXMuYWN0aXZlSGVhZCA9IHRhcmdldC5hY3RpdmVIZWFkO1xuICAgIHRoaXMuYWN0aXZlVGFpbCA9IHRhcmdldC5hY3RpdmVUYWlsO1xuICAgIHRoaXMuYWN0aXZlQ291bnQgPSB0YXJnZXQuYWN0aXZlQ291bnQ7XG4gICAgdGhpcy5vcmRlckZyb250aWVyID0gdGFyZ2V0Lm9yZGVyRnJvbnRpZXIgYXMgb2JqZWN0O1xuICB9XG5cbiAgbW92ZUtleXNUb0Zyb250KGtleXM6IHJlYWRvbmx5IEtbXSk6IHZvaWQge1xuICAgIHRoaXMua2V5c0NhY2hlID0gdW5kZWZpbmVkO1xuICAgIC8vIEVhY2ggbm9kZSBvbmNlLCBhdCBpdHMgZmlyc3QgcG9zaXRpb246IGEgbm9kZSBwcmVwZW5kZWQgdHdpY2UgbGlua3MgdG9cbiAgICAvLyBpdHNlbGYsIGFuZCBldmVyeSBsYXRlciB3YWxrIG9mIHRoZSBvcmRlciBuZXZlciBlbmRzICh2MTYgOGY7IHRoZVxuICAgIC8vIGNhbGxlcnMgcGFzcyB1bmlxdWUga2V5cyBzaW5jZSB0aGUgYmF0Y2ggZHVwbGljYXRlIHJ1bGUpLlxuICAgIGNvbnN0IG5vZGVzID0gW1xuICAgICAgLi4ubmV3IFNldChcbiAgICAgICAga2V5c1xuICAgICAgICAgIC5tYXAoKGtleSkgPT4gdGhpcy5hY3RpdmVOb2Rlc0J5S2V5LmdldChrZXkpKVxuICAgICAgICAgIC5maWx0ZXIoKG5vZGUpOiBub2RlIGlzIEFjdGl2ZU5vZGU8Sz4gPT4gbm9kZSAhPT0gdW5kZWZpbmVkKVxuICAgICAgKSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICB0aGlzLmRldGFjaE5vZGUobm9kZSk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaW5kZXggPSBub2Rlcy5sZW5ndGggLSAxOyBpbmRleCA+PSAwOyBpbmRleCAtPSAxKSB7XG4gICAgICB0aGlzLnByZXBlbmREZXRhY2hlZE5vZGUobm9kZXNbaW5kZXhdKTtcbiAgICB9XG4gICAgaWYgKG5vZGVzLmxlbmd0aCA+IDApIHRoaXMub3JkZXJGcm9udGllciA9IHt9O1xuICB9XG5cbiAgcmVvcmRlckFjdGl2ZUtleXMoa2V5czogcmVhZG9ubHkgS1tdKTogdm9pZCB7XG4gICAgLy8gQWxyZWFkeSBpbiB0aGlzIG9yZGVyIChldmVyeSBsb2FkIGludG8gYW4gZW1wdHkgY29sbGVjdGlvbiwgYW5kIG1vc3RcbiAgICAvLyByZWZldGNoZXMpOiBub3RoaW5nIHRvIHJlbGluayBhbmQgbm8gb3JkZXIgY2hhbmdlLCBzbyB0aGUga2V5IHNuYXBzaG90XG4gICAgLy8gYW5kIHRoZSBvcmRlciBmcm9udGllciBzdGF5IGFzIHRoZXkgYXJlLlxuICAgIGxldCBjdXJyZW50ID0gdGhpcy5hY3RpdmVIZWFkO1xuICAgIGxldCB1bmNoYW5nZWQgPSB0cnVlO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuZ2V0KGtleSk7XG4gICAgICBpZiAobm9kZSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcbiAgICAgIGlmIChub2RlICE9PSBjdXJyZW50KSB7XG4gICAgICAgIHVuY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gICAgfVxuICAgIGlmICh1bmNoYW5nZWQgJiYgY3VycmVudCA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5hY3RpdmVIZWFkID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuYWN0aXZlVGFpbCA9IHVuZGVmaW5lZDtcblxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkudmFsdWVzKCkpIHtcbiAgICAgIG5vZGUucHJldiA9IHVuZGVmaW5lZDtcbiAgICAgIG5vZGUubmV4dCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgbmV4dENvdW50ID0gMDtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5hY3RpdmVOb2Rlc0J5S2V5LmdldChrZXkpO1xuICAgICAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hcHBlbmREZXRhY2hlZE5vZGUobm9kZSk7XG4gICAgICBuZXh0Q291bnQgKz0gMTtcbiAgICB9XG5cbiAgICB0aGlzLmFjdGl2ZUNvdW50ID0gbmV4dENvdW50O1xuICAgIHRoaXMub3JkZXJGcm9udGllciA9IHt9O1xuICB9XG5cbiAgbmVpZ2hib3JTdWJqZWN0c0ZvcktleShrZXk6IEspOiB7XG4gICAgYmVmb3JlU3ViamVjdD86IG51bWJlcjtcbiAgICBhZnRlclN1YmplY3Q/OiBudW1iZXI7XG4gIH0ge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuZ2V0KGtleSk7XG4gICAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBiZWZvcmVTdWJqZWN0OiBub2RlLnByZXY/LnN1YmplY3RJZCxcbiAgICAgIGFmdGVyU3ViamVjdDogbm9kZS5uZXh0Py5zdWJqZWN0SWQsXG4gICAgfTtcbiAgfVxuXG4gIHRvbWJzdG9uZWRTdWJqZWN0c1NuYXBzaG90KCk6IHJlYWRvbmx5IG51bWJlcltdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuc3ViamVjdFN0YXRlcy5lbnRyaWVzKCldXG4gICAgICAuZmlsdGVyKChbLCBzdWJqZWN0U3RhdGVdKSA9PiAhc3ViamVjdFN0YXRlLmFjdGl2ZSlcbiAgICAgIC5tYXAoKFtzdWJqZWN0SWRdKSA9PiBzdWJqZWN0SWQpXG4gICAgICAuc29ydCgobGVmdCwgcmlnaHQpID0+IGxlZnQgLSByaWdodCk7XG4gIH1cblxuICBjcmVhdGVTdWJqZWN0KHN1YmplY3RJZDogbnVtYmVyLCBrZXk6IEspOiB2b2lkIHtcbiAgICByZWNvcmRQcm9kdWN0aW9uU3Vic3RyYXRlU3RhdCgnc3RydWN0dXJhbFN1YmplY3RzQ3JlYXRlZCcpO1xuICAgIHRoaXMubmV4dFN1YmplY3RJZCA9IE1hdGgubWF4KHRoaXMubmV4dFN1YmplY3RJZCwgc3ViamVjdElkICsgMSk7XG4gICAgdGhpcy5hY3RpdmF0ZVN1YmplY3Qoc3ViamVjdElkLCBrZXkpO1xuICAgIHRoaXMuc3ViamVjdFJldmlzaW9ucy5zZXQoc3ViamVjdElkLCAwKTtcbiAgICB0aGlzLmNyZWF0ZUFuZEFwcGVuZEFjdGl2ZU5vZGUoc3ViamVjdElkLCBrZXkpO1xuICAgIHRoaXMub3JkZXJGcm9udGllciA9IHt9O1xuICB9XG5cbiAgdHJhbnNmZXJTdWJqZWN0KFxuICAgIHN1YmplY3RJZDogbnVtYmVyLFxuICAgIGZyb206IEssXG4gICAgdG86IEssXG4gICAgcmVzdG9yZUFsbG93ZWQgPSB0cnVlXG4gICk6IHZvaWQge1xuICAgIHJlY29yZFByb2R1Y3Rpb25TdWJzdHJhdGVTdGF0KCdzdHJ1Y3R1cmFsU3ViamVjdFRyYW5zZmVycycpO1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuZ2V0KGZyb20pO1xuICAgIHRoaXMuc3ViamVjdElkcy5kZWxldGUoZnJvbSk7XG4gICAgdGhpcy5hY3RpdmF0ZVN1YmplY3Qoc3ViamVjdElkLCB0bywgcmVzdG9yZUFsbG93ZWQpO1xuXG4gICAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jcmVhdGVBbmRBcHBlbmRBY3RpdmVOb2RlKHN1YmplY3RJZCwgdG8pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYWN0aXZlTm9kZXNCeUtleS5kZWxldGUoZnJvbSk7XG4gICAgbm9kZS5rZXkgPSB0bztcbiAgICB0aGlzLmtleXNDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuc2V0KHRvLCBub2RlKTtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LnNldChzdWJqZWN0SWQsIG5vZGUpO1xuICB9XG5cbiAgdG9tYnN0b25lU3ViamVjdChzdWJqZWN0SWQ6IG51bWJlciwga2V5OiBLLCByZXN0b3JlQWxsb3dlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHJlY29yZFByb2R1Y3Rpb25TdWJzdHJhdGVTdGF0KCdzdHJ1Y3R1cmFsU3ViamVjdFRvbWJzdG9uZXMnKTtcbiAgICB0aGlzLnN1YmplY3RJZHMuZGVsZXRlKGtleSk7XG5cbiAgICBjb25zdCBub2RlID0gdGhpcy5hY3RpdmVOb2Rlc0J5S2V5LmdldChrZXkpO1xuICAgIGlmIChub2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMudW5yZWdpc3RlckFjdGl2ZU5vZGUobm9kZSk7XG4gICAgICB0aGlzLmRldGFjaE5vZGUobm9kZSk7XG4gICAgICB0aGlzLmFjdGl2ZUNvdW50IC09IDE7XG4gICAgfVxuXG4gICAgdGhpcy5zdWJqZWN0U3RhdGVzLnNldChzdWJqZWN0SWQsIHtcbiAgICAgIGFjdGl2ZTogZmFsc2UsXG4gICAgICByZXN0b3JlQWxsb3dlZCxcbiAgICB9KTtcbiAgICB0aGlzLm9yZGVyRnJvbnRpZXIgPSB7fTtcbiAgfVxuXG4gIHJlc3RvcmVTdWJqZWN0KFxuICAgIHN1YmplY3RJZDogbnVtYmVyLFxuICAgIGtleTogSyxcbiAgICBiZWZvcmVTdWJqZWN0PzogbnVtYmVyLFxuICAgIGFmdGVyU3ViamVjdD86IG51bWJlcixcbiAgICByZXN0b3JlQWxsb3dlZCA9IHRydWVcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgcGxhY2VtZW50ID0gdGhpcy5yZXNvbHZlU3ViamVjdFJlc3RvcmVQbGFjZW1lbnQoXG4gICAgICBiZWZvcmVTdWJqZWN0LFxuICAgICAgYWZ0ZXJTdWJqZWN0XG4gICAgKTtcbiAgICB0aGlzLnJlc3RvcmVTdWJqZWN0QXRSZXNvbHZlZFBsYWNlbWVudChcbiAgICAgIHN1YmplY3RJZCxcbiAgICAgIGtleSxcbiAgICAgIHBsYWNlbWVudCxcbiAgICAgIHJlc3RvcmVBbGxvd2VkXG4gICAgKTtcbiAgfVxuXG4gIHJlc29sdmVTdWJqZWN0UmVzdG9yZVBsYWNlbWVudChcbiAgICBiZWZvcmVTdWJqZWN0PzogbnVtYmVyLFxuICAgIGFmdGVyU3ViamVjdD86IG51bWJlclxuICApOiBSZXNvbHZlZFN1YmplY3RSZXN0b3JlUGxhY2VtZW50PEs+IHtcbiAgICBjb25zdCBiZWZvcmVOb2RlID1cbiAgICAgIGJlZm9yZVN1YmplY3QgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICA6IHRoaXMuYWN0aXZlTm9kZXNCeVN1YmplY3QuZ2V0KGJlZm9yZVN1YmplY3QpO1xuICAgIGNvbnN0IGFmdGVyTm9kZSA9XG4gICAgICBhZnRlclN1YmplY3QgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICA6IHRoaXMuYWN0aXZlTm9kZXNCeVN1YmplY3QuZ2V0KGFmdGVyU3ViamVjdCk7XG5cbiAgICBpZiAoYmVmb3JlTm9kZSAhPT0gdW5kZWZpbmVkICYmIGFmdGVyTm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodGhpcy5ub2RlUHJlY2VkZXMoYmVmb3JlTm9kZSwgYWZ0ZXJOb2RlKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJlZm9yZVN1YmplY3Q6IGJlZm9yZU5vZGUuc3ViamVjdElkLFxuICAgICAgICAgIGFmdGVyU3ViamVjdDogYWZ0ZXJOb2RlLnN1YmplY3RJZCxcbiAgICAgICAgICBiZWZvcmVLZXk6IGJlZm9yZU5vZGUua2V5LFxuICAgICAgICAgIGFmdGVyS2V5OiBhZnRlck5vZGUua2V5LFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBiZWZvcmVTdWJqZWN0OiBhZnRlck5vZGUucHJldj8uc3ViamVjdElkLFxuICAgICAgICBhZnRlclN1YmplY3Q6IGFmdGVyTm9kZS5zdWJqZWN0SWQsXG4gICAgICAgIGJlZm9yZUtleTogYWZ0ZXJOb2RlLnByZXY/LmtleSxcbiAgICAgICAgYWZ0ZXJLZXk6IGFmdGVyTm9kZS5rZXksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChhZnRlck5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmVmb3JlU3ViamVjdDogYWZ0ZXJOb2RlLnByZXY/LnN1YmplY3RJZCxcbiAgICAgICAgYWZ0ZXJTdWJqZWN0OiBhZnRlck5vZGUuc3ViamVjdElkLFxuICAgICAgICBiZWZvcmVLZXk6IGFmdGVyTm9kZS5wcmV2Py5rZXksXG4gICAgICAgIGFmdGVyS2V5OiBhZnRlck5vZGUua2V5LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoYmVmb3JlTm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBiZWZvcmVTdWJqZWN0OiBiZWZvcmVOb2RlLnN1YmplY3RJZCxcbiAgICAgICAgYWZ0ZXJTdWJqZWN0OiBiZWZvcmVOb2RlLm5leHQ/LnN1YmplY3RJZCxcbiAgICAgICAgYmVmb3JlS2V5OiBiZWZvcmVOb2RlLmtleSxcbiAgICAgICAgYWZ0ZXJLZXk6IGJlZm9yZU5vZGUubmV4dD8ua2V5LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYmVmb3JlU3ViamVjdDogdGhpcy5hY3RpdmVUYWlsPy5zdWJqZWN0SWQsXG4gICAgICBiZWZvcmVLZXk6IHRoaXMuYWN0aXZlVGFpbD8ua2V5LFxuICAgIH07XG4gIH1cblxuICByZXN0b3JlU3ViamVjdEF0UmVzb2x2ZWRQbGFjZW1lbnQoXG4gICAgc3ViamVjdElkOiBudW1iZXIsXG4gICAga2V5OiBLLFxuICAgIHBsYWNlbWVudDogUmVzb2x2ZWRTdWJqZWN0UmVzdG9yZVBsYWNlbWVudDxLPixcbiAgICByZXN0b3JlQWxsb3dlZCA9IHRydWVcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5hY3RpdmF0ZVN1YmplY3Qoc3ViamVjdElkLCBrZXksIHJlc3RvcmVBbGxvd2VkKTtcblxuICAgIGNvbnN0IG5vZGU6IEFjdGl2ZU5vZGU8Sz4gPSB7XG4gICAgICBrZXksXG4gICAgICBzdWJqZWN0SWQsXG4gICAgICBwcmV2OiB1bmRlZmluZWQsXG4gICAgICBuZXh0OiB1bmRlZmluZWQsXG4gICAgfTtcblxuICAgIHRoaXMuYWN0aXZlTm9kZXNCeUtleS5zZXQoa2V5LCBub2RlKTtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LnNldChzdWJqZWN0SWQsIG5vZGUpO1xuICAgIHRoaXMuYWN0aXZlQ291bnQgKz0gMTtcbiAgICB0aGlzLm9yZGVyRnJvbnRpZXIgPSB7fTtcblxuICAgIGNvbnN0IGJlZm9yZU5vZGUgPVxuICAgICAgcGxhY2VtZW50LmJlZm9yZVN1YmplY3QgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICA6IHRoaXMuYWN0aXZlTm9kZXNCeVN1YmplY3QuZ2V0KHBsYWNlbWVudC5iZWZvcmVTdWJqZWN0KTtcbiAgICBjb25zdCBhZnRlck5vZGUgPVxuICAgICAgcGxhY2VtZW50LmFmdGVyU3ViamVjdCA9PT0gdW5kZWZpbmVkXG4gICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgIDogdGhpcy5hY3RpdmVOb2Rlc0J5U3ViamVjdC5nZXQocGxhY2VtZW50LmFmdGVyU3ViamVjdCk7XG5cbiAgICBpZiAoYWZ0ZXJOb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuaW5zZXJ0RGV0YWNoZWROb2RlQmVmb3JlKG5vZGUsIGFmdGVyTm9kZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGJlZm9yZU5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5pbnNlcnREZXRhY2hlZE5vZGVBZnRlcihub2RlLCBiZWZvcmVOb2RlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcGVuZERldGFjaGVkTm9kZShub2RlKTtcbiAgfVxuXG4gIC8qKiBSZWxvY2F0ZSBhbiBhY3RpdmUgbGlmZXRpbWUgd2l0aG91dCByZXRpcmluZyBpdCBvciBlbWl0dGluZyBsaWZlY3ljbGUgZWZmZWN0cy4gKi9cbiAgcGxhY2VBY3RpdmVTdWJqZWN0KFxuICAgIHN1YmplY3RJZDogbnVtYmVyLFxuICAgIGJlZm9yZVN1YmplY3Q/OiBudW1iZXIsXG4gICAgYWZ0ZXJTdWJqZWN0PzogbnVtYmVyXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmdldChzdWJqZWN0SWQpO1xuICAgIGlmICghbm9kZSkgdGhyb3cgbmV3IEVycm9yKCdQbGFjZW1lbnQgbGlmZXRpbWUgaXMgbm90IGFjdGl2ZScpO1xuICAgIGlmIChiZWZvcmVTdWJqZWN0ID09PSBzdWJqZWN0SWQgfHwgYWZ0ZXJTdWJqZWN0ID09PSBzdWJqZWN0SWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsYWNlbWVudCBjYW5ub3QgbmFtZSBpdHMgb3duIGxpZmV0aW1lJyk7XG4gICAgY29uc3QgcGxhY2VtZW50ID0gdGhpcy5yZXNvbHZlU3ViamVjdFJlc3RvcmVQbGFjZW1lbnQoXG4gICAgICBiZWZvcmVTdWJqZWN0LFxuICAgICAgYWZ0ZXJTdWJqZWN0XG4gICAgKTtcbiAgICBjb25zdCBhZnRlciA9XG4gICAgICBwbGFjZW1lbnQuYWZ0ZXJTdWJqZWN0ID09PSBzdWJqZWN0SWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmdldChwbGFjZW1lbnQuYWZ0ZXJTdWJqZWN0IGFzIG51bWJlcik7XG4gICAgY29uc3QgYmVmb3JlID1cbiAgICAgIHBsYWNlbWVudC5iZWZvcmVTdWJqZWN0ID09PSBzdWJqZWN0SWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmdldChwbGFjZW1lbnQuYmVmb3JlU3ViamVjdCBhcyBudW1iZXIpO1xuICAgIHRoaXMuZGV0YWNoTm9kZShub2RlKTtcbiAgICBpZiAoYWZ0ZXIpIHRoaXMuaW5zZXJ0RGV0YWNoZWROb2RlQmVmb3JlKG5vZGUsIGFmdGVyKTtcbiAgICBlbHNlIGlmIChiZWZvcmUpIHRoaXMuaW5zZXJ0RGV0YWNoZWROb2RlQWZ0ZXIobm9kZSwgYmVmb3JlKTtcbiAgICBlbHNlIHRoaXMuYXBwZW5kRGV0YWNoZWROb2RlKG5vZGUpO1xuICAgIHRoaXMua2V5c0NhY2hlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMub3JkZXJGcm9udGllciA9IHt9O1xuICB9XG5cbiAgcmV0aXJlU3ViamVjdChzdWJqZWN0SWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc3ViamVjdFN0YXRlcy5zZXQoc3ViamVjdElkLCB7XG4gICAgICBhY3RpdmU6IGZhbHNlLFxuICAgICAgcmVzdG9yZUFsbG93ZWQ6IGZhbHNlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERyb3AgYSByZXRpcmVkIHN1YmplY3QncyBsaWZldGltZSBsZWRnZXIgZW50aXJlbHkg4oCUIHN0YXRlIEFORCByZXZpc2lvbi5cbiAgICpcbiAgICog4pqg77iPIFRSSUFMLiBUaGlzIGlzIHRoZSBudWxsIGh5cG90aGVzaXMgZm9yIFwiaXMgdGhlIH4xMTcgQi9yZXRpcmVkIGxpZmV0aW1lXG4gICAqIHJlY29yZCBlYXJuZWQ/XCIgKGRvY3MvYXJjaGl0ZWN0dXJlL3JldGlyZWQtc3ViamVjdC1jaHVybi5tZCwgb3BlbiBxdWVzdGlvblxuICAgKiAyKS4gYHJldGlyZVN1YmplY3RgIGFib3ZlIGtlZXBzIGEgYHthY3RpdmU6ZmFsc2UsIHJlc3RvcmVBbGxvd2VkOmZhbHNlfWBcbiAgICogcmVjb3JkIGZvcmV2ZXIsIHdoaWNoIGlzIHdoYXQgbWFrZXMgemVyby1vd25lciBjaHVybiBsaW5lYXIgaW4gZXZlcnkgc3ViamVjdFxuICAgKiB0aGF0IGV2ZXIgZXhpc3RlZC4gVGhpcyBkZWxldGVzIGl0LlxuICAgKlxuICAgKiBTQUZFIE9OTFkgRk9SIEEgVEVSTUlOQUwsIFpFUk8tT1dORVIgUkVUSVJFTUVOVCwgYW5kIHRoZSByZWFzb24gaXMgc3ViamVjdFxuICAgKiBpZCBhbGxvY2F0aW9uOiBgbmV4dFN1YmplY3RJZGAgb25seSBldmVyIGluY3JlYXNlcywgYW5kIGB0b21ic3RvbmVTdWJqZWN0YFxuICAgKiBoYXMgYWxyZWFkeSByZW1vdmVkIHRoZSBrZXkgLT4gc3ViamVjdCBtYXBwaW5nLiBBIGxhdGVyIGFkZCBvZiB0aGUgc2FtZVxuICAgKiBidXNpbmVzcyBrZXkgdGhlcmVmb3JlIGdldHMgYSBGUkVTSCBzdWJqZWN0IGlkIGFuZCBjYW5ub3QgY29sbGlkZSB3aXRoIHRoZVxuICAgKiBmb3Jnb3R0ZW4gb25lLiBEZWxldGluZyB0aGUgcmVjb3JkIGNhbm5vdCByZXN1cnJlY3Qgb3IgYWxpYXMgYSBzdWJqZWN0LlxuICAgKlxuICAgKiBXSEFUIElUIEdJVkVTIFVQOiBgcmVzb2x2ZVN1YmplY3RIYW5kbGVgIHJlcG9ydHMgYG1pc3NpbmdgIHJhdGhlciB0aGFuXG4gICAqIGB0b21ic3RvbmVkYCBmb3IgdGhlIGZvcmdvdHRlbiBzdWJqZWN0LCBhbmQgYHBsYW5SZXN0b3JlYCdzXG4gICAqIFwiaGFzIHJldGlyZWQgYmFja2luZyBhbmQgY2Fubm90IGJlIHJlc3RvcmVkXCIgZ3VhcmQgbG9zZXMgaXRzIGlucHV0LiBCb3RoIGFyZVxuICAgKiBhY2NlcHRhYmxlIG9ubHkgYmVjYXVzZSBhIHRyZWUgd2l0aCBubyByZXN0b3JhdGlvbiBhdXRob3JpdHkgaGFzIG5vIHBhdGggdG9cbiAgICogYSByZXN0b3JlIGF0IGFsbCDigJQgdGhlIGd1YXJkIGJlY29tZXMgdW5yZWFjaGFibGUgcmF0aGVyIHRoYW4gdW5lbmZvcmNlZC4gSWZcbiAgICogYSByZXN0b3JlciBjYW4gZXhpc3QsIERPIE5PVCBjYWxsIHRoaXMuXG4gICAqL1xuICBmb3JnZXRTdWJqZWN0KHN1YmplY3RJZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5zdWJqZWN0U3RhdGVzLmRlbGV0ZShzdWJqZWN0SWQpO1xuICAgIHRoaXMuc3ViamVjdFJldmlzaW9ucy5kZWxldGUoc3ViamVjdElkKTtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmRlbGV0ZShzdWJqZWN0SWQpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5zdWJqZWN0SWRzLmNsZWFyKCk7XG4gICAgdGhpcy5zdWJqZWN0U3RhdGVzLmNsZWFyKCk7XG4gICAgdGhpcy5zdWJqZWN0UmV2aXNpb25zLmNsZWFyKCk7XG4gICAgdGhpcy5hY3RpdmVOb2Rlc0J5S2V5LmNsZWFyKCk7XG4gICAgdGhpcy5hY3RpdmVOb2Rlc0J5U3ViamVjdC5jbGVhcigpO1xuICAgIHRoaXMuYWN0aXZlSGVhZCA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmFjdGl2ZVRhaWwgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5hY3RpdmVDb3VudCA9IDA7XG4gICAgdGhpcy5uZXh0U3ViamVjdElkID0gMTtcbiAgICB0aGlzLmNvbGxlY3Rpb25JbmNhcm5hdGlvbiArPSAxO1xuICAgIHRoaXMub3JkZXJGcm9udGllciA9IHt9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBbmRBcHBlbmRBY3RpdmVOb2RlKHN1YmplY3RJZDogbnVtYmVyLCBrZXk6IEspOiB2b2lkIHtcbiAgICB0aGlzLmtleXNDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCBub2RlOiBBY3RpdmVOb2RlPEs+ID0ge1xuICAgICAga2V5LFxuICAgICAgc3ViamVjdElkLFxuICAgICAgcHJldjogdW5kZWZpbmVkLFxuICAgICAgbmV4dDogdW5kZWZpbmVkLFxuICAgIH07XG5cbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuc2V0KGtleSwgbm9kZSk7XG4gICAgdGhpcy5hY3RpdmVOb2Rlc0J5U3ViamVjdC5zZXQoc3ViamVjdElkLCBub2RlKTtcbiAgICB0aGlzLmFwcGVuZERldGFjaGVkTm9kZShub2RlKTtcbiAgICB0aGlzLmFjdGl2ZUNvdW50ICs9IDE7XG4gIH1cblxuICBwcml2YXRlIHVucmVnaXN0ZXJBY3RpdmVOb2RlKG5vZGU6IEFjdGl2ZU5vZGU8Sz4pOiB2b2lkIHtcbiAgICB0aGlzLmtleXNDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlLZXkuZGVsZXRlKG5vZGUua2V5KTtcbiAgICB0aGlzLmFjdGl2ZU5vZGVzQnlTdWJqZWN0LmRlbGV0ZShub2RlLnN1YmplY3RJZCk7XG4gIH1cblxuICBwcml2YXRlIHByZXBlbmREZXRhY2hlZE5vZGUobm9kZTogQWN0aXZlTm9kZTxLPik6IHZvaWQge1xuICAgIHRoaXMua2V5c0NhY2hlID0gdW5kZWZpbmVkO1xuICAgIG5vZGUucHJldiA9IHVuZGVmaW5lZDtcbiAgICBub2RlLm5leHQgPSB0aGlzLmFjdGl2ZUhlYWQ7XG4gICAgaWYgKHRoaXMuYWN0aXZlSGVhZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmFjdGl2ZUhlYWQucHJldiA9IG5vZGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWN0aXZlVGFpbCA9IG5vZGU7XG4gICAgfVxuICAgIHRoaXMuYWN0aXZlSGVhZCA9IG5vZGU7XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZERldGFjaGVkTm9kZShub2RlOiBBY3RpdmVOb2RlPEs+KTogdm9pZCB7XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSB1bmRlZmluZWQ7XG4gICAgbm9kZS5uZXh0ID0gdW5kZWZpbmVkO1xuICAgIG5vZGUucHJldiA9IHRoaXMuYWN0aXZlVGFpbDtcbiAgICBpZiAodGhpcy5hY3RpdmVUYWlsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuYWN0aXZlVGFpbC5uZXh0ID0gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hY3RpdmVIZWFkID0gbm9kZTtcbiAgICB9XG4gICAgdGhpcy5hY3RpdmVUYWlsID0gbm9kZTtcbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0RGV0YWNoZWROb2RlQWZ0ZXIoXG4gICAgbm9kZTogQWN0aXZlTm9kZTxLPixcbiAgICBhbmNob3I6IEFjdGl2ZU5vZGU8Sz5cbiAgKTogdm9pZCB7XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSB1bmRlZmluZWQ7XG4gICAgbm9kZS5wcmV2ID0gYW5jaG9yO1xuICAgIG5vZGUubmV4dCA9IGFuY2hvci5uZXh0O1xuICAgIGlmIChhbmNob3IubmV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhbmNob3IubmV4dC5wcmV2ID0gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hY3RpdmVUYWlsID0gbm9kZTtcbiAgICB9XG4gICAgYW5jaG9yLm5leHQgPSBub2RlO1xuICB9XG5cbiAgcHJpdmF0ZSBpbnNlcnREZXRhY2hlZE5vZGVCZWZvcmUoXG4gICAgbm9kZTogQWN0aXZlTm9kZTxLPixcbiAgICBhbmNob3I6IEFjdGl2ZU5vZGU8Sz5cbiAgKTogdm9pZCB7XG4gICAgdGhpcy5rZXlzQ2FjaGUgPSB1bmRlZmluZWQ7XG4gICAgbm9kZS5uZXh0ID0gYW5jaG9yO1xuICAgIG5vZGUucHJldiA9IGFuY2hvci5wcmV2O1xuICAgIGlmIChhbmNob3IucHJldiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhbmNob3IucHJldi5uZXh0ID0gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hY3RpdmVIZWFkID0gbm9kZTtcbiAgICB9XG4gICAgYW5jaG9yLnByZXYgPSBub2RlO1xuICB9XG5cbiAgcHJpdmF0ZSBkZXRhY2hOb2RlKG5vZGU6IEFjdGl2ZU5vZGU8Sz4pOiB2b2lkIHtcbiAgICB0aGlzLmtleXNDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAobm9kZS5wcmV2ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG5vZGUucHJldi5uZXh0ID0gbm9kZS5uZXh0O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFjdGl2ZUhlYWQgPSBub2RlLm5leHQ7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubmV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBub2RlLm5leHQucHJldiA9IG5vZGUucHJldjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hY3RpdmVUYWlsID0gbm9kZS5wcmV2O1xuICAgIH1cblxuICAgIG5vZGUucHJldiA9IHVuZGVmaW5lZDtcbiAgICBub2RlLm5leHQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBwcml2YXRlIG5vZGVQcmVjZWRlcyhsZWZ0OiBBY3RpdmVOb2RlPEs+LCByaWdodDogQWN0aXZlTm9kZTxLPik6IGJvb2xlYW4ge1xuICAgIGxldCBub2RlOiBBY3RpdmVOb2RlPEs+IHwgdW5kZWZpbmVkID0gbGVmdDtcbiAgICB3aGlsZSAobm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAobm9kZSA9PT0gcmlnaHQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgYWN0aXZhdGVTdWJqZWN0KFxuICAgIHN1YmplY3RJZDogbnVtYmVyLFxuICAgIGtleTogSyxcbiAgICByZXN0b3JlQWxsb3dlZCA9IHRydWVcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5zdWJqZWN0SWRzLnNldChrZXksIHN1YmplY3RJZCk7XG4gICAgdGhpcy5zdWJqZWN0U3RhdGVzLnNldChzdWJqZWN0SWQsIHtcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGtleSxcbiAgICAgIHJlc3RvcmVBbGxvd2VkLFxuICAgIH0pO1xuICB9XG59XG4iXSwiZmlsZSI6Ii9zcmMvbGliL3BoeXNpY2FsL3N0cnVjdHVyYWwtc3RvcmUudHMifQ==

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2luZGV4ZWQvY2FuZGlkYXRlL3BhY2thZ2VzL2tlcm5lbC9zcmMvbGliL3BoeXNpY2FsL3N0cnVjdHVyYWwtc3RvcmUudHMiLCIvc3JjL2xpYi9waHlzaWNhbC9zdHJ1Y3R1cmFsLXN0b3JlLnRzIixbXV0=
}}