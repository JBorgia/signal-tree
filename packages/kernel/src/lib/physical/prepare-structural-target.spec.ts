import { describe, expect, it } from 'vitest';
import { StructuralStore } from './structural-store';
import { prepareStructuralTarget } from './prepare-structural-target';

describe('detached structural target preparation', () => {
  it('preserves inactive lifetimes and revisions, and reads current maps after installation', () => {
    const store = new StructuralStore<string | number>();
    store.createSubject(1, 1);
    store.createSubject(2, '1');
    store.createSubject(3, 'retired');
    store.tombstoneSubject(2, '1', true);
    store.tombstoneSubject(3, 'retired', false);
    store.bumpSubjectRevision(2);
    store.bumpSubjectRevision(3);
    const active = store.stateForSubject(1);
    const frontier = {};
    const target = store.prepareTarget(
      [{ subjectId: 1, key: 'a.b' }],
      [1],
      frontier,
      prepareStructuralTarget
    );
    expect(store.activeKeysSnapshot()).toEqual([1]);
    expect(store.stateForSubject(1)).toBe(active);
    expect(active?.key).toBe(1);
    expect(store.subjectRevision(1)).toBe(0);
    store.installPreparedTarget(target);
    expect(store.subjectRevision(1)).toBe(1);
    expect(store.subjectRevision(2)).toBe(1);
    expect(store.subjectRevision(3)).toBe(1);
    expect(store.stateForSubject(2)).toEqual({
      active: false,
      restoreAllowed: true,
    });
    expect(store.stateForSubject(3)).toEqual({
      active: false,
      restoreAllowed: false,
    });
    expect(store.activeOrderFrontier()).toBe(frontier);
    const next = store.prepareTarget(
      [
        { subjectId: 1, key: 'a.b' },
        { subjectId: 2, key: '1' },
      ],
      [2, 1],
      {},
      prepareStructuralTarget
    );
    store.installPreparedTarget(next);
    expect(store.activeKeysSnapshot()).toEqual(['1', 'a.b']);
    expect(store.subjectRevision(1)).toBe(1);
    expect(store.subjectRevision(2)).toBe(2);
    expect(store.planFreshSubjectIds(1)).toEqual([4]);
  });

  it('preserves typed keys and changes revisions only for structural changes', () => {
    const store = new StructuralStore<string | number>();
    store.createSubject(1, 1);
    store.createSubject(2, '1');
    const target = store.prepareTarget(
      [
        { subjectId: 1, key: 1 },
        { subjectId: 2, key: '1' },
      ],
      [2, 1],
      {},
      prepareStructuralTarget
    );
    store.installPreparedTarget(target);
    expect(store.activeKeysSnapshot()).toEqual(['1', 1]);
    expect(store.subjectIdForKey(1)).toBe(1);
    expect(store.subjectIdForKey('1')).toBe(2);
    expect([store.subjectRevision(1), store.subjectRevision(2)]).toEqual([
      0, 0,
    ]);
    const removal = store.prepareTarget(
      [{ subjectId: 2, key: '1' }],
      [2],
      {},
      prepareStructuralTarget
    );
    expect(store.activeKeysSnapshot()).toEqual(['1', 1]);
    store.installPreparedTarget(removal);
    expect(store.stateForSubject(1)?.active).toBe(false);
    expect([store.subjectRevision(1), store.subjectRevision(2)]).toEqual([
      1, 0,
    ]);
  });

  it('refuses malformed targets without changing live state or authority', () => {
    const store = new StructuralStore<string>();
    store.createSubject(1, 'a');
    store.createSubject(2, 'b');
    store.tombstoneSubject(2, 'b', false);
    const frontier = store.activeOrderFrontier();
    const cases = [
      {
        subjects: [
          { subjectId: 1, key: 'a' },
          { subjectId: 1, key: 'b' },
        ],
        order: [1],
      },
      { subjects: [{ subjectId: 2, key: 'b' }], order: [2] },
      { subjects: [{ subjectId: 99, key: 'z' }], order: [99] },
      { subjects: [{ subjectId: 1, key: 'a' }], order: [1, 1] },
      { subjects: [{ subjectId: 1, key: 'a' }], order: [99] },
    ];
    for (const { subjects, order } of cases) {
      expect(() =>
        store.prepareTarget(subjects, order, {}, prepareStructuralTarget)
      ).toThrow();
      expect(store.activeKeysSnapshot()).toEqual(['a']);
      expect(store.activeOrderFrontier()).toBe(frontier);
      expect(store.subjectRevision(1)).toBe(0);
      expect(store.stateForSubject(2)).toEqual({
        active: false,
        restoreAllowed: false,
      });
    }
  });
});
