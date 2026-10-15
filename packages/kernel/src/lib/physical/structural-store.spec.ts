import { describe, expect, it } from 'vitest';

import { StructuralStore, type ActiveNode } from './structural-store';

// White-box integrity checks belong to the tests, not every consumer bundle.
// Bracket access keeps the actual private field types without a production hook.
function assertActiveOrderIntegrity<K extends string | number>(
  store: StructuralStore<K>
): void {
  if (store['activeHead']?.prev !== undefined) {
    throw new Error('Active head must not have a previous node.');
  }

  if (store['activeTail']?.next !== undefined) {
    throw new Error('Active tail must not have a next node.');
  }

  const reachableKeys = new Set<K>();
  const reachableSubjects = new Set<number>();
  let previous: ActiveNode<K> | undefined;
  let count = 0;
  let node = store['activeHead'];

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
      throw new Error(
        `Duplicate reachable subject ${String(node.subjectId)}.`
      );
    }

    if (store['activeNodesByKey'].get(node.key) !== node) {
      throw new Error(`Key lookup mismatch for ${String(node.key)}.`);
    }

    if (store['activeNodesBySubject'].get(node.subjectId) !== node) {
      throw new Error(
        `Subject lookup mismatch for ${String(node.subjectId)}.`
      );
    }

    if (store['subjectIds'].get(node.key) !== node.subjectId) {
      throw new Error(
        `Subject id mapping mismatch for key ${String(node.key)}.`
      );
    }

    const state = store['subjectStates'].get(node.subjectId);
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

  if (previous !== store['activeTail']) {
    throw new Error('Active tail does not match the reachable chain tail.');
  }

  if (count !== store['activeCount']) {
    throw new Error('Active count does not match the reachable chain size.');
  }

  if (store['activeNodesByKey'].size !== count) {
    throw new Error(
      'Active key index size does not match reachable node count.'
    );
  }

  if (store['activeNodesBySubject'].size !== count) {
    throw new Error(
      'Active subject index size does not match reachable node count.'
    );
  }
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
  it('integrity witness rejects a corrupted key index', () => {
    const store = seedStore();
    store['activeNodesByKey'].delete('B');
    expect(() => assertActiveOrderIntegrity(store)).toThrow('Key lookup mismatch for B');
  });

  it('integrity witness rejects a corrupted subject index', () => {
    const store = seedStore();
    store['activeNodesBySubject'].delete(2);
    expect(() => assertActiveOrderIntegrity(store)).toThrow('Subject lookup mismatch for 2');
  });

  it('moves each key to the front once, however often it is named (v16 8f)', () => {
    // A node prepended twice linked to itself, and the next walk of the order
    // never ended (prependMany with a duplicated id).
    const store = seedStore();
    store.moveKeysToFront(['C', 'B', 'C', 'B']);
    // The integrity walk stops at a revisited node; a plain walk would not.
    assertActiveOrderIntegrity(store);
    expect(store.activeKeysSnapshot()).toEqual(['C', 'B', 'A']);
  });

  it('tracks canonical active order across create, remove, rekey, and append', () => {
    const store = seedStore();

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);

    store.tombstoneSubject(2, 'B', true);
    expect(store.activeKeysSnapshot()).toEqual(['A', 'C']);

    store.restoreSubject(2, 'B', 1, 3);
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

    store.clear();
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

    store.restoreSubject(2, 'B', 1, 3);

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B', 'C']);
  });

  it('restores after the surviving before-neighbor when the after anchor is gone', () => {
    const store = seedStore();

    store.tombstoneSubject(2, 'B', true);
    store.tombstoneSubject(3, 'C', true);

    store.restoreSubject(2, 'B', 1, 3);

    expect(store.activeKeysSnapshot()).toEqual(['A', 'B']);
  });

  it('restores before the surviving after-neighbor when the before anchor is gone', () => {
    const store = seedStore();

    store.tombstoneSubject(1, 'A', true);
    store.tombstoneSubject(2, 'B', true);

    store.restoreSubject(2, 'B', 1, 3);

    expect(store.activeKeysSnapshot()).toEqual(['B', 'C']);
  });

  it('appends when neither historical neighbor survives', () => {
    const store = seedStore();
    store.createSubject(4, 'D');

    store.tombstoneSubject(2, 'B', true);
    store.tombstoneSubject(1, 'A', true);
    store.tombstoneSubject(3, 'C', true);

    store.restoreSubject(2, 'B', 1, 3);

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

    store.restoreSubject(2, 'B', 1, 3);

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
    store.restoreSubject(2, 'B', 1, 3);
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
