import { describe, expect, it } from 'vitest';

import { EntityMutationFrame } from './entity-mutation-frame';
import { resolveEntityHandle } from './entity-handle-resolution';
import { EntityValueStore } from './entity-value-store';
import { StructuralStore } from './structural-store';

type Item = {
  id: number;
  name: string;
};

function createHarness() {
  const valueStore = new EntityValueStore<Item>();
  const structuralStore = new StructuralStore<number>();
  const frame = new EntityMutationFrame(valueStore, structuralStore);

  return {
    valueStore,
    structuralStore,
    frame,
  };
}

function acquireExistingHandle(
  structuralStore: StructuralStore<number>,
  key: number
) {
  const handle = structuralStore.acquireSubjectHandleForKey(key);
  if (handle === undefined) {
    throw new Error(`Expected active subject at ${key}`);
  }
  return handle;
}

describe('resolveEntityHandle', () => {
  it('resolves an acquired handle to the same subject value after rekey', () => {
    const { frame, structuralStore, valueStore } = createHarness();
    structuralStore.createSubject(1, 1);
    valueStore.retainSubjectValue(1, { id: 1, name: 'Alice' });
    const handle = acquireExistingHandle(structuralStore, 1);

    frame.stageKeyTransfer({
      kind: 'transfer-key',
      subjectId: 1,
      fromKey: 1,
      toKey: 2,
    });
    frame.commit();

    expect(resolveEntityHandle(structuralStore, valueStore, handle)).toEqual({
      state: 'active',
      subjectId: 1,
      key: 2,
      revision: 0,
      value: { id: 1, name: 'Alice' },
    });
  });

  it('does not resolve an acquired handle to a fresh same-key replacement', () => {
    const { frame, structuralStore, valueStore } = createHarness();
    structuralStore.createSubject(1, 1);
    valueStore.retainSubjectValue(1, { id: 1, name: 'Alice' });
    const handle = acquireExistingHandle(structuralStore, 1);

    frame.stageSubjectTombstone({
      kind: 'tombstone-subject',
      subjectId: 1,
      key: 1,
      restoreAllowed: true,
    });
    frame.stageFreshSubject({
      kind: 'create-fresh-subject',
      key: 1,
      subjectId: 2,
      nextValue: { id: 1, name: 'Grace' },
    });
    frame.commit();

    expect(structuralStore.subjectIdForKey(1)).toBe(2);
    expect(valueStore.backingForSubject(2)).toEqual({ id: 1, name: 'Grace' });
    expect(resolveEntityHandle(structuralStore, valueStore, handle)).toEqual({
      state: 'tombstoned',
      subjectId: 1,
      restoreAllowed: true,
      revision: 0,
    });
  });
});
