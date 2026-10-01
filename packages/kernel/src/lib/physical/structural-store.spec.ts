import { describe, expect, it } from 'vitest';

import {
  ActiveNode,
  SubjectLifetimeRecord,
  StructuralStore,
} from './structural-store';

// Test-only graph inspection must not ship as a production class method.
function assertActiveOrderIntegrity<K extends string | number>(
  store: StructuralStore<K>
): void {
  const graph = store as unknown as {
    activeHead: ActiveNode<K> | undefined;
    activeTail: ActiveNode<K> | undefined;
    activeCount: number;
    activeNodesByKey: Map<K, ActiveNode<K>>;
    activeNodesBySubject: Map<number, ActiveNode<K>>;
    subjectIds: Map<K, number>;
    subjectStates: Map<number, SubjectLifetimeRecord<K>>;
  };

  if (graph.activeHead?.prev !== undefined) {
    throw new Error('Active head must not have a previous node.');
  }

  if (graph.activeTail?.next !== undefined) {
    throw new Error('Active tail must not have a next node.');
  }

  const reachableKeys = new Set<K>();
  const reachableSubjects = new Set<number>();
  let previous: ActiveNode<K> | undefined;
  let count = 0;
  let node = graph.activeHead;

  while (node !== undefined) {
    if (node.prev !== previous) {
      throw new Error('Broken prev link in active node chain.');
    }

    if (previous !== undefined && previous.next !== node) {
      throw new Error('Broken next link in active node chain.');
    }

    if (reachableKeys.has(node.key)) {
      throw new Error(`Duplicate reachable key ${String(node.key)}.`);
    }

    if (reachableSubjects.has(node.subjectId)) {
      throw new Error(`Duplicate reachable subject ${String(node.subjectId)}.`);
    }

    if (graph.activeNodesByKey.get(node.key) !== node) {
      throw new Error(`Key lookup mismatch for ${String(node.key)}.`);
    }

    if (graph.activeNodesBySubject.get(node.subjectId) !== node) {
      throw new Error(`Subject lookup mismatch for ${String(node.subjectId)}.`);
    }

    if (graph.subjectIds.get(node.key) !== node.subjectId) {
      throw new Error(
        `Subject id mapping mismatch for key ${String(node.key)}.`
      );
    }

    const state = graph.subjectStates.get(node.subjectId);
    if (!state?.active || state.key !== node.key) {
      throw new Error(
        `Active state mismatch for subject ${String(node.subjectId)}.`
      );
    }

    reachableKeys.add(node.key);
    reachableSubjects.add(node.subjectId);
    count += 1;
    previous = node;
    node = node.next;
  }

  if (previous !== graph.activeTail) {
    throw new Error('Active tail does not match the reachable chain tail.');
  }

  if (count !== graph.activeCount) {
    throw new Error('Active count does not match the reachable chain size.');
  }

  if (graph.activeNodesByKey.size !== count) {
    throw new Error(
      'Active key index size does not match reachable node count.'
    );
  }

  if (graph.activeNodesBySubject.size !== count) {
    throw new Error(
      'Active subject index size does not match reachable node count.'
    );
  }
}

// A destructive reset is an adversarial fixture, not a production operation.
// Preserve reused-ID/old-handle coverage without shipping its reset machinery.
function resetStructureForTest<K extends string | number>(store: StructuralStore<K>): void {
  const graph = store as unknown as {
    keysCache: K[] | undefined;
    subjectIds: Map<K, number>;
    subjectStates: Map<number, SubjectLifetimeRecord<K>>;
    subjectRevisions: Map<number, number>;
    activeNodesByKey: Map<K, ActiveNode<K>>;
    activeNodesBySubject: Map<number, ActiveNode<K>>;
    activeHead: ActiveNode<K> | undefined;
    activeTail: ActiveNode<K> | undefined;
    activeCount: number;
    nextSubjectId: number;
    collectionIncarnation: number;
    orderFrontier: object;
  };
  graph.keysCache = undefined;
  graph.subjectIds.clear();
  graph.subjectStates.clear();
  graph.subjectRevisions.clear();
  graph.activeNodesByKey.clear();
  graph.activeNodesBySubject.clear();
  graph.activeHead = undefined;
  graph.activeTail = undefined;
  graph.activeCount = 0;
  graph.nextSubjectId = 1;
  graph.collectionIncarnation += 1;
  graph.orderFrontier = {};
}

const seedStore = () => {
  const store = new StructuralStore<string>();
  store.createSubject(1, 'A');
  store.createSubject(2, 'B');
  store.createSubject(3, 'C');
  return store;
};

const acquireExistingHandle = (store: StructuralStore<string>, key: string) => {
  const handle = store.acquireSubjectHandleForKey(key);
  if (handle === undefined) {
    throw new Error(`Expected active subject at ${key}`);
  }
  return handle;
};

describe('StructuralStore', () => {
  it('detects a broken active chain in the test-only integrity checker', () => {
    const store = seedStore();
    const graph = store as unknown as { activeHead: ActiveNode<string> };
    graph.activeHead.next!.prev = undefined;
    expect(() => assertActiveOrderIntegrity(store)).toThrow('Broken prev link');
  });

  it('tracks canonical active order across create, remove, rekey, and append', () => {
    const store = seedStore();

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);

    store.tombstoneSubject(2, 'B', true);
    expect(store.activeKeysSnapshot()).toEqual(['A', 'C']);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );
    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);

    store.transferSubject(2, 'B', 'X');
    expect(store.activeKeysSnapshot()).toEqual(['A', 'X', 'C']);

    store.createSubject(4, 'D');
    expect(store.activeKeysSnapshot()).toEqual(['A', 'X', 'C', 'D']);
  });

  it('rekeys structural address without changing subject identity or ordinal', () => {
    const store = seedStore();

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);
    expect(store.neighborSubjectsForKey('B')).toEqual({
      beforeSubject: 1,
      afterSubject: 3,
    });

    store.transferSubject(2, 'B', 'X');

    expect(store.activeKeysSnapshot()).toEqual(['A', 'X', 'C']);
    expect(store.subjectIdForKey('B')).toBeUndefined();
    expect(store.subjectIdForKey('X')).toBe(2);
    expect(store.activeKeyForSubject(2)).toBe('X');
    expect(store.neighborSubjectsForKey('X')).toEqual({
      beforeSubject: 1,
      afterSubject: 3,
    });
  });

  it('keeps keyed lookup address-based while acquired handles remain subject-based', () => {
    const store = seedStore();
    const handle = acquireExistingHandle(store, 'B');

    expect(handle).toEqual({
      subjectId: 2,
      acquiredRevision: 0,
      collectionIncarnation: 0,
    });

    store.tombstoneSubject(2, 'B', true);
    store.createSubject(4, 'B');

    expect(store.subjectIdForKey('B')).toBe(4);
    expect(store.resolveSubjectHandle(handle)).toEqual({
      state: 'tombstoned',
      subjectId: 2,
      restoreAllowed: true,
      revision: 0,
    });
  });

  it('does not let a whole structural reset retarget an acquired handle through reused subject ids', () => {
    const store = seedStore();
    const handle = acquireExistingHandle(store, 'B');

    resetStructureForTest(store);
    store.createSubject(2, 'B');

    expect(store.subjectIdForKey('B')).toBe(2);
    expect(store.resolveSubjectHandle(handle)).toEqual({
      state: 'missing',
      subjectId: 2,
      acquiredRevision: 0,
    });
  });

  it('resolves acquired handles through rekey without retargeting through the old key', () => {
    const store = seedStore();
    const handle = acquireExistingHandle(store, 'B');

    store.transferSubject(2, 'B', 'X');

    expect(store.subjectIdForKey('B')).toBeUndefined();
    expect(store.subjectIdForKey('X')).toBe(2);
    expect(store.resolveSubjectHandle(handle)).toEqual({
      state: 'active',
      subjectId: 2,
      key: 'X',
      revision: 0,
    });
  });

  it('restores a tombstoned subject between surviving neighbors', () => {
    const store = seedStore();

    store.tombstoneSubject(2, 'B', true);

    expect(store.activeKeysSnapshot()).toEqual(['A', 'C']);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);
  });

  it('restores after the surviving before-neighbor when the after anchor is gone', () => {
    const store = seedStore();

    store.tombstoneSubject(2, 'B', true);
    store.tombstoneSubject(3, 'C', true);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B']);
  });

  it('restores before the surviving after-neighbor when the before anchor is gone', () => {
    const store = seedStore();

    store.tombstoneSubject(1, 'A', true);
    store.tombstoneSubject(2, 'B', true);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );

    expect(store.activeKeysSnapshot()).toEqual(['B', 'C']);
  });

  it('appends when neither historical neighbor survives', () => {
    const store = seedStore();
    store.createSubject(4, 'D');

    store.tombstoneSubject(2, 'B', true);
    store.tombstoneSubject(1, 'A', true);
    store.tombstoneSubject(3, 'C', true);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );

    expect(store.activeKeysSnapshot()).toEqual(['D', 'B']);
  });

  it('prefers the surviving next-anchor when wholesale reorder reverses captured anchors', () => {
    const store = new StructuralStore<string>();
    store.createSubject(1, 'A');
    store.createSubject(2, 'B');
    store.createSubject(3, 'C');
    store.createSubject(4, 'D');

    store.tombstoneSubject(2, 'B', true);
    store.reorderActiveKeys(['D', 'C', 'A']);

    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );

    expect(store.activeKeysSnapshot()).toEqual(['D', 'B', 'C', 'A']);
  });

  it('treats move-to-front as a wholesale reorder in the order provided', () => {
    const store = seedStore();

    store.moveKeysToFront(['C', 'A']);

    expect(store.activeKeysSnapshot()).toEqual(['C', 'A', 'B']);
    expect(store.firstActiveKey()).toBe('C');
  });

  it('maintains linked order integrity across mixed structural operations', () => {
    const store = seedStore();

    store.tombstoneSubject(2, 'B', true);
    store.transferSubject(3, 'C', 'X');
    store.restoreSubjectAtResolvedPlacement(
      2, 'B', store.resolveSubjectRestorePlacement(1, 3)
    );
    store.createSubject(4, 'D');

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'X', 'D']);
    expect(() => assertActiveOrderIntegrity(store)).not.toThrow();
  });

  it('treats explicit reorder as wholesale canonical-order replacement', () => {
    const store = seedStore();

    store.reorderActiveKeys(['C', 'A', 'B']);

    expect(store.activeKeysSnapshot()).toEqual(['C', 'A', 'B']);
    expect(store.firstActiveKey()).toBe('C');
  });
});
