import { describe, expect, it, vi } from 'vitest';

import {
  EntityMutationFrame,
  type PreparedFreshSubject,
} from './entity-mutation-frame';
import { EntityValueStore } from './entity-value-store';
import { StructuralStore } from './structural-store';

type Item = {
  id: number;
  name: string;
};

function createFrameHarness() {
  const valueStore = new EntityValueStore<Item>();
  const structuralStore = new StructuralStore<number>();
  const frame = new EntityMutationFrame(valueStore, structuralStore);

  return {
    valueStore,
    structuralStore,
    frame,
  };
}

describe('EntityMutationFrame', () => {
  it('commits prepared fresh subjects without allocating ids during commit', () => {
    const { frame, structuralStore, valueStore } = createFrameHarness();
    const plannedSubjectId = structuralStore.planFreshSubjectIds(1)[0];
    const freshSubject: PreparedFreshSubject<number, Item> = {
      kind: 'create-fresh-subject',
      key: 1,
      subjectId: plannedSubjectId,
      nextValue: { id: 1, name: 'Alice' },
    };

    frame.stageFreshSubject(freshSubject);

    const allocateSpy = vi
      .spyOn(structuralStore, 'allocateFreshSubjectId')
      .mockImplementation(() => {
        throw new Error('commit must not allocate fresh subject ids');
      });

    const result = frame.commit();

    expect(result.allocatedSubjectIds).toEqual([plannedSubjectId]);
    expect(structuralStore.subjectIdForKey(1)).toBe(plannedSubjectId);
    expect(valueStore.backingForSubject(plannedSubjectId)).toEqual({
      id: 1,
      name: 'Alice',
    });

    allocateSpy.mockRestore();
  });






  it('keeps earlier frame work side-effect free when later restore preparation fails', () => {
    const { frame, structuralStore, valueStore, projection } = createFrameHarness();

    structuralStore.createSubject(1, 1);
    structuralStore.createSubject(2, 2);
    structuralStore.createSubject(3, 3);
    valueStore.retainSubjectValue(1, { id: 1, name: 'Alice' });
    valueStore.retainSubjectValue(2, { id: 2, name: 'Bob' });
    valueStore.retainSubjectValue(3, { id: 3, name: 'Cara' });

    structuralStore.tombstoneSubject(2, 2, true);

    frame.stageFreshSubject({
      kind: 'create-fresh-subject',
      key: 4,
      subjectId: 4,
      nextValue: { id: 4, name: 'Delta' },
    });
    frame.stageSubjectRestore({
      kind: 'restore-subject',
      key: 2,
      subjectId: 2,
      restoreAllowed: true,
      beforeSubject: 1,
      afterSubject: 3,
      realizedValue: { id: 2, name: 'Bob' },
    });

    const resolvePlacementSpy = vi
      .spyOn(structuralStore, 'resolveSubjectRestorePlacement')
      .mockImplementation(() => {
        throw new Error('restore planning failed');
      });

    expect(() => frame.commit()).toThrow('restore planning failed');
    expect(structuralStore.subjectIdForKey(4)).toBeUndefined();
    expect(structuralStore.stateForSubject(4)).toBeUndefined();
    expect(structuralStore.activeKeysSnapshot()).toEqual([1, 3]);
    expect(structuralStore.stateForSubject(2)).toEqual({
      active: false,
      restoreAllowed: true,
    });
    expect(valueStore.backingForSubject(4)).toBeUndefined();

    resolvePlacementSpy.mockRestore();
  });


  it('projects fresh add followed by rekey in the same frame as the final committed address', () => {
    const { frame, structuralStore, valueStore, projection } = createFrameHarness();

    frame.stageFreshSubject({
      kind: 'create-fresh-subject',
      key: 1,
      subjectId: 1,
      nextValue: { id: 1, name: 'Alice' },
    });
    frame.stageKeyTransfer({
      kind: 'transfer-key',
      subjectId: 1,
      fromKey: 1,
      toKey: 2,
    });

    const result = frame.commit();

    expect(structuralStore.subjectIdForKey(1)).toBeUndefined();
    expect(structuralStore.subjectIdForKey(2)).toBe(1);
  });

});
