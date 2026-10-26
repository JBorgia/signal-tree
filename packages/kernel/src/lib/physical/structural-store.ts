import {
  EntityPlacementStage,
  type EntityPlacement,
} from './entity-placement-stage';
import type { prepareStructuralTarget } from './prepare-structural-target';
import { recordProductionSubstrateStat } from '../internals/production-substrate-stats';

export type SubjectLifetimeRecord<K extends string | number> = {
  active: boolean;
  key?: K;
  restoreAllowed: boolean;
};

export type ResolvedSubjectRestorePlacement<K extends string | number> = {
  beforeSubject?: number;
  afterSubject?: number;
  beforeKey?: K;
  afterKey?: K;
};

export type AcquiredSubjectHandle = {
  subjectId: number;
  acquiredRevision: number;
  collectionIncarnation: number;
};

export type ResolvedSubjectHandle<K extends string | number> =
  | {
      state: 'active';
      subjectId: number;
      key: K;
      revision: number;
    }
  | {
      state: 'tombstoned';
      subjectId: number;
      restoreAllowed: boolean;
      revision: number;
    }
  | {
      state: 'missing';
      subjectId: number;
      acquiredRevision: number;
    };

export type StructuralTargetSubject<K extends string | number> = {
  readonly subjectId: number;
  readonly key: K;
};

export type ActiveNode<K extends string | number> = {
  key: K;
  subjectId: number;
  prev: ActiveNode<K> | undefined;
  next: ActiveNode<K> | undefined;
};

export type PreparedStructuralTarget<K extends string | number> = {
  readonly subjectIds: Map<K, number>;
  readonly subjectStates: Map<number, SubjectLifetimeRecord<K>>;
  readonly subjectRevisions: Map<number, number>;
  readonly activeNodesByKey: Map<K, ActiveNode<K>>;
  readonly activeNodesBySubject: Map<number, ActiveNode<K>>;
  readonly activeHead: ActiveNode<K> | undefined;
  readonly activeTail: ActiveNode<K> | undefined;
  readonly activeCount: number;
  readonly orderFrontier: unknown;
};

export class StructuralStore<K extends string | number> {
  private keysCache: readonly K[] | undefined;
  private subjectIds = new Map<K, number>();
  private subjectStates = new Map<number, SubjectLifetimeRecord<K>>();
  private subjectRevisions = new Map<number, number>();
  private activeNodesByKey = new Map<K, ActiveNode<K>>();
  private activeNodesBySubject = new Map<number, ActiveNode<K>>();
  private nextSubjectId = 1;
  private collectionIncarnation = 0;
  private activeHead: ActiveNode<K> | undefined;
  private activeTail: ActiveNode<K> | undefined;
  private activeCount = 0;
  private orderFrontier: object = {};

  placementForSubject(subject: number): EntityPlacement<K> {
    const node = this.activeNodesBySubject.get(subject);
    return node === undefined
      ? { present: false }
      : {
          present: true,
          key: node.key,
          beforeSubject: node.prev?.subjectId,
          afterSubject: node.next?.subjectId,
        };
  }
  preparePlacement(): EntityPlacementStage<K> {
    return new EntityPlacementStage(
      (subject) => this.placementForSubject(subject),
      this.activeHead?.subjectId,
      this.activeTail?.subjectId
    );
  }
  activeOrderFrontier(): unknown {
    return this.orderFrontier;
  }

  /** Only a complete, lineage-validated compensation may restore this token. */
  installCompensatedOrderFrontier(frontier: unknown): void {
    this.orderFrontier = frontier as object;
  }

  planFreshSubjectIds(count: number): readonly number[] {
    return Array.from(
      { length: count },
      (_, index) => this.nextSubjectId + index
    );
  }

  allocateFreshSubjectId(): number {
    const subjectId = this.nextSubjectId;
    this.nextSubjectId += 1;
    return subjectId;
  }

  subjectIdForKey(key: K): number | undefined {
    return this.subjectIds.get(key);
  }

  acquireSubjectHandleForKey(key: K): AcquiredSubjectHandle | undefined {
    const subjectId = this.subjectIds.get(key);
    return subjectId === undefined
      ? undefined
      : {
          subjectId,
          acquiredRevision: this.subjectRevision(subjectId),
          collectionIncarnation: this.collectionIncarnation,
        };
  }

  resolveSubjectHandle(
    handle: AcquiredSubjectHandle
  ): ResolvedSubjectHandle<K> {
    if (handle.collectionIncarnation !== this.collectionIncarnation) {
      return {
        state: 'missing',
        subjectId: handle.subjectId,
        acquiredRevision: handle.acquiredRevision,
      };
    }

    const state = this.subjectStates.get(handle.subjectId);

    if (state === undefined) {
      return {
        state: 'missing',
        subjectId: handle.subjectId,
        acquiredRevision: handle.acquiredRevision,
      };
    }

    if (state.active) {
      if (state.key === undefined) {
        throw new Error(
          `Active subject ${String(
            handle.subjectId
          )} is missing its active key.`
        );
      }

      return {
        state: 'active',
        subjectId: handle.subjectId,
        key: state.key,
        revision: this.subjectRevision(handle.subjectId),
      };
    }

    return {
      state: 'tombstoned',
      subjectId: handle.subjectId,
      restoreAllowed: state.restoreAllowed,
      revision: this.subjectRevision(handle.subjectId),
    };
  }

  stateForSubject(subjectId: number): SubjectLifetimeRecord<K> | undefined {
    return this.subjectStates.get(subjectId);
  }

  hasSubject(subjectId: number): boolean {
    return this.subjectStates.has(subjectId);
  }

  subjectRevision(subjectId: number): number {
    return this.subjectRevisions.get(subjectId) ?? 0;
  }

  bumpSubjectRevision(subjectId: number): void {
    this.subjectRevisions.set(subjectId, this.subjectRevision(subjectId) + 1);
  }

  activeKeyForSubject(subjectId: number): K | undefined {
    const state = this.stateForSubject(subjectId);
    return state?.active ? state.key : undefined;
  }

  hasActiveKey(key: K): boolean {
    return this.subjectIds.has(key);
  }

  activeKeyCount(): number {
    return this.activeCount;
  }

  /**
   * Active keys in order, shared until the next list or key mutation. Every
   * mutator of the active list (or of a node's key) clears it; a field write
   * changes neither, so reading `ids()` after one no longer re-walks the list.
   * Callers must not mutate the result.
   */
  activeKeysSnapshot(): readonly K[] {
    if (this.keysCache) return this.keysCache;
    const keys: K[] = [];
    for (let node = this.activeHead; node !== undefined; node = node.next) {
      keys.push(node.key);
    }
    this.keysCache = keys;
    return keys;
  }

  /** Fills both arrays from one walk of the active order. */
  snapshotActiveOrder(keys: K[], subjectIds: number[]): void {
    for (let node = this.activeHead; node !== undefined; node = node.next) {
      keys.push(node.key);
      subjectIds.push(node.subjectId);
    }
  }

  firstActiveKey(): K | undefined {
    return this.activeHead?.key;
  }

  lastActiveKey(): K | undefined {
    return this.activeTail?.key;
  }

  prepareTarget(
    subjects: readonly StructuralTargetSubject<K>[],
    order: readonly number[],
    orderFrontier: unknown,
    prepare: typeof prepareStructuralTarget<K>
  ): PreparedStructuralTarget<K> {
    return prepare(
      this.subjectStates,
      this.subjectRevisions,
      subjects,
      order,
      orderFrontier
    );
  }

  installPreparedTarget(target: PreparedStructuralTarget<K>): void {
    this.keysCache = undefined;
    this.subjectIds = target.subjectIds;
    this.subjectStates = target.subjectStates;
    this.subjectRevisions = target.subjectRevisions;
    this.activeNodesByKey = target.activeNodesByKey;
    this.activeNodesBySubject = target.activeNodesBySubject;
    this.activeHead = target.activeHead;
    this.activeTail = target.activeTail;
    this.activeCount = target.activeCount;
    this.orderFrontier = target.orderFrontier as object;
  }

  moveKeysToFront(keys: readonly K[]): void {
    this.keysCache = undefined;
    // Each node once, at its first position: a node prepended twice links to
    // itself, and every later walk of the order never ends (v16 8f; the
    // callers pass unique keys since the batch duplicate rule).
    const nodes = [
      ...new Set(
        keys
          .map((key) => this.activeNodesByKey.get(key))
          .filter((node): node is ActiveNode<K> => node !== undefined)
      ),
    ];

    for (const node of nodes) {
      this.detachNode(node);
    }

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      this.prependDetachedNode(nodes[index]);
    }
    if (nodes.length > 0) this.orderFrontier = {};
  }

  reorderActiveKeys(keys: readonly K[]): void {
    // Already in this order (every load into an empty collection, and most
    // refetches): nothing to relink and no order change, so the key snapshot
    // and the order frontier stay as they are.
    let current = this.activeHead;
    let unchanged = true;
    for (const key of keys) {
      const node = this.activeNodesByKey.get(key);
      if (node === undefined) continue;
      if (node !== current) {
        unchanged = false;
        break;
      }
      current = current.next;
    }
    if (unchanged && current === undefined) return;
    this.keysCache = undefined;
    this.activeHead = undefined;
    this.activeTail = undefined;

    for (const node of this.activeNodesByKey.values()) {
      node.prev = undefined;
      node.next = undefined;
    }

    let nextCount = 0;
    for (const key of keys) {
      const node = this.activeNodesByKey.get(key);
      if (node === undefined) {
        continue;
      }

      this.appendDetachedNode(node);
      nextCount += 1;
    }

    this.activeCount = nextCount;
    this.orderFrontier = {};
  }

  neighborSubjectsForKey(key: K): {
    beforeSubject?: number;
    afterSubject?: number;
  } {
    const node = this.activeNodesByKey.get(key);
    if (node === undefined) {
      return {};
    }

    return {
      beforeSubject: node.prev?.subjectId,
      afterSubject: node.next?.subjectId,
    };
  }

  tombstonedSubjectsSnapshot(): readonly number[] {
    return [...this.subjectStates.entries()]
      .filter(([, subjectState]) => !subjectState.active)
      .map(([subjectId]) => subjectId)
      .sort((left, right) => left - right);
  }

  createSubject(subjectId: number, key: K): void {
    recordProductionSubstrateStat('structuralSubjectsCreated');
    this.nextSubjectId = Math.max(this.nextSubjectId, subjectId + 1);
    this.activateSubject(subjectId, key);
    this.subjectRevisions.set(subjectId, 0);
    this.createAndAppendActiveNode(subjectId, key);
    this.orderFrontier = {};
  }

  transferSubject(
    subjectId: number,
    from: K,
    to: K,
    restoreAllowed = true
  ): void {
    recordProductionSubstrateStat('structuralSubjectTransfers');
    const node = this.activeNodesByKey.get(from);
    this.subjectIds.delete(from);
    this.activateSubject(subjectId, to, restoreAllowed);

    if (node === undefined) {
      this.createAndAppendActiveNode(subjectId, to);
      return;
    }

    this.activeNodesByKey.delete(from);
    node.key = to;
    this.keysCache = undefined;
    this.activeNodesByKey.set(to, node);
    this.activeNodesBySubject.set(subjectId, node);
  }

  tombstoneSubject(subjectId: number, key: K, restoreAllowed: boolean): void {
    recordProductionSubstrateStat('structuralSubjectTombstones');
    this.subjectIds.delete(key);

    const node = this.activeNodesByKey.get(key);
    if (node !== undefined) {
      this.unregisterActiveNode(node);
      this.detachNode(node);
      this.activeCount -= 1;
    }

    this.subjectStates.set(subjectId, {
      active: false,
      restoreAllowed,
    });
    this.orderFrontier = {};
  }

  restoreSubject(
    subjectId: number,
    key: K,
    beforeSubject?: number,
    afterSubject?: number,
    restoreAllowed = true
  ): void {
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

  resolveSubjectRestorePlacement(
    beforeSubject?: number,
    afterSubject?: number
  ): ResolvedSubjectRestorePlacement<K> {
    const beforeNode =
      beforeSubject === undefined
        ? undefined
        : this.activeNodesBySubject.get(beforeSubject);
    const afterNode =
      afterSubject === undefined
        ? undefined
        : this.activeNodesBySubject.get(afterSubject);

    if (beforeNode !== undefined && afterNode !== undefined) {
      if (this.nodePrecedes(beforeNode, afterNode)) {
        return {
          beforeSubject: beforeNode.subjectId,
          afterSubject: afterNode.subjectId,
          beforeKey: beforeNode.key,
          afterKey: afterNode.key,
        };
      }

      return {
        beforeSubject: afterNode.prev?.subjectId,
        afterSubject: afterNode.subjectId,
        beforeKey: afterNode.prev?.key,
        afterKey: afterNode.key,
      };
    }

    if (afterNode !== undefined) {
      return {
        beforeSubject: afterNode.prev?.subjectId,
        afterSubject: afterNode.subjectId,
        beforeKey: afterNode.prev?.key,
        afterKey: afterNode.key,
      };
    }

    if (beforeNode !== undefined) {
      return {
        beforeSubject: beforeNode.subjectId,
        afterSubject: beforeNode.next?.subjectId,
        beforeKey: beforeNode.key,
        afterKey: beforeNode.next?.key,
      };
    }

    return {
      beforeSubject: this.activeTail?.subjectId,
      beforeKey: this.activeTail?.key,
    };
  }

  restoreSubjectAtResolvedPlacement(
    subjectId: number,
    key: K,
    placement: ResolvedSubjectRestorePlacement<K>,
    restoreAllowed = true
  ): void {
    this.activateSubject(subjectId, key, restoreAllowed);

    const node: ActiveNode<K> = {
      key,
      subjectId,
      prev: undefined,
      next: undefined,
    };

    this.activeNodesByKey.set(key, node);
    this.activeNodesBySubject.set(subjectId, node);
    this.activeCount += 1;
    this.orderFrontier = {};

    const beforeNode =
      placement.beforeSubject === undefined
        ? undefined
        : this.activeNodesBySubject.get(placement.beforeSubject);
    const afterNode =
      placement.afterSubject === undefined
        ? undefined
        : this.activeNodesBySubject.get(placement.afterSubject);

    if (afterNode !== undefined) {
      this.insertDetachedNodeBefore(node, afterNode);
      return;
    }

    if (beforeNode !== undefined) {
      this.insertDetachedNodeAfter(node, beforeNode);
      return;
    }

    this.appendDetachedNode(node);
  }

  /** Relocate an active lifetime without retiring it or emitting lifecycle effects. */
  placeActiveSubject(
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number
  ): void {
    const node = this.activeNodesBySubject.get(subjectId);
    if (!node) throw new Error('Placement lifetime is not active');
    if (beforeSubject === subjectId || afterSubject === subjectId)
      throw new Error('Placement cannot name its own lifetime');
    const placement = this.resolveSubjectRestorePlacement(
      beforeSubject,
      afterSubject
    );
    const after =
      placement.afterSubject === subjectId
        ? undefined
        : this.activeNodesBySubject.get(placement.afterSubject as number);
    const before =
      placement.beforeSubject === subjectId
        ? undefined
        : this.activeNodesBySubject.get(placement.beforeSubject as number);
    this.detachNode(node);
    if (after) this.insertDetachedNodeBefore(node, after);
    else if (before) this.insertDetachedNodeAfter(node, before);
    else this.appendDetachedNode(node);
    this.keysCache = undefined;
    this.orderFrontier = {};
  }

  retireSubject(subjectId: number): void {
    this.subjectStates.set(subjectId, {
      active: false,
      restoreAllowed: false,
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
  forgetSubject(subjectId: number): void {
    this.subjectStates.delete(subjectId);
    this.subjectRevisions.delete(subjectId);
    this.activeNodesBySubject.delete(subjectId);
  }

  clear(): void {
    this.keysCache = undefined;
    this.subjectIds.clear();
    this.subjectStates.clear();
    this.subjectRevisions.clear();
    this.activeNodesByKey.clear();
    this.activeNodesBySubject.clear();
    this.activeHead = undefined;
    this.activeTail = undefined;
    this.activeCount = 0;
    this.nextSubjectId = 1;
    this.collectionIncarnation += 1;
    this.orderFrontier = {};
  }

  private createAndAppendActiveNode(subjectId: number, key: K): void {
    this.keysCache = undefined;
    const node: ActiveNode<K> = {
      key,
      subjectId,
      prev: undefined,
      next: undefined,
    };

    this.activeNodesByKey.set(key, node);
    this.activeNodesBySubject.set(subjectId, node);
    this.appendDetachedNode(node);
    this.activeCount += 1;
  }

  private unregisterActiveNode(node: ActiveNode<K>): void {
    this.keysCache = undefined;
    this.activeNodesByKey.delete(node.key);
    this.activeNodesBySubject.delete(node.subjectId);
  }

  private prependDetachedNode(node: ActiveNode<K>): void {
    this.keysCache = undefined;
    node.prev = undefined;
    node.next = this.activeHead;
    if (this.activeHead !== undefined) {
      this.activeHead.prev = node;
    } else {
      this.activeTail = node;
    }
    this.activeHead = node;
  }

  private appendDetachedNode(node: ActiveNode<K>): void {
    this.keysCache = undefined;
    node.next = undefined;
    node.prev = this.activeTail;
    if (this.activeTail !== undefined) {
      this.activeTail.next = node;
    } else {
      this.activeHead = node;
    }
    this.activeTail = node;
  }

  private insertDetachedNodeAfter(
    node: ActiveNode<K>,
    anchor: ActiveNode<K>
  ): void {
    this.keysCache = undefined;
    node.prev = anchor;
    node.next = anchor.next;
    if (anchor.next !== undefined) {
      anchor.next.prev = node;
    } else {
      this.activeTail = node;
    }
    anchor.next = node;
  }

  private insertDetachedNodeBefore(
    node: ActiveNode<K>,
    anchor: ActiveNode<K>
  ): void {
    this.keysCache = undefined;
    node.next = anchor;
    node.prev = anchor.prev;
    if (anchor.prev !== undefined) {
      anchor.prev.next = node;
    } else {
      this.activeHead = node;
    }
    anchor.prev = node;
  }

  private detachNode(node: ActiveNode<K>): void {
    this.keysCache = undefined;
    if (node.prev !== undefined) {
      node.prev.next = node.next;
    } else {
      this.activeHead = node.next;
    }

    if (node.next !== undefined) {
      node.next.prev = node.prev;
    } else {
      this.activeTail = node.prev;
    }

    node.prev = undefined;
    node.next = undefined;
  }

  private nodePrecedes(left: ActiveNode<K>, right: ActiveNode<K>): boolean {
    let node: ActiveNode<K> | undefined = left;
    while (node !== undefined) {
      if (node === right) {
        return true;
      }
      node = node.next;
    }

    return false;
  }

  private activateSubject(
    subjectId: number,
    key: K,
    restoreAllowed = true
  ): void {
    this.subjectIds.set(key, subjectId);
    this.subjectStates.set(subjectId, {
      active: true,
      key,
      restoreAllowed,
    });
  }
}
