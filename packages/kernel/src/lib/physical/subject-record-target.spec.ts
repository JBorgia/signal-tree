import { describe, expect, it } from 'vitest';
import {
  assertPhysicalSubjectSlots,
  composePreparedSubjectUpdates,
  preparePhysicalSubjectForget,
  preparePhysicalSubjectForgets,
  preparePhysicalSubjectSlotTarget,
  preparePhysicalSubjectTarget,
  preparePhysicalSubjectValueRelease,
  preparePhysicalSubjectValueReleases,
} from './subject-record-target';

describe('composePreparedSubjectUpdates', () => {
  it('composes revision and value contributions for the same subject', () => {
    const value = { id: 1, name: 'after' };

    const target = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 4 }],
      [{ subjectId: 1, value }]
    );

    expect(target).toEqual([{ subjectId: 1, revision: 4, value }]);
  });

  it('preserves authority-specific contributions when the other is absent', () => {
    const value = { id: 2, name: 'value-only' };

    const target = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 2 }],
      [{ subjectId: 2, value }]
    );

    expect(target).toEqual([
      { subjectId: 1, revision: 2 },
      { subjectId: 2, value },
    ]);
  });

  it('normalizes output by SubjectId without mutating authority inputs', () => {
    const structural = [
      { subjectId: 3, revision: 1 },
      { subjectId: 1, revision: 2 },
    ] as const;
    const values = [{ subjectId: 2, value: { id: 2 } }] as const;

    const target = composePreparedSubjectUpdates(structural, values);

    expect(target.map(({ subjectId }) => subjectId)).toEqual([1, 2, 3]);
    expect(structural.map(({ subjectId }) => subjectId)).toEqual([3, 1]);
    expect(Object.isFrozen(target)).toBe(true);
    expect(target.every(Object.isFrozen)).toBe(true);
  });

  it('treats prepared values as opaque authority-owned payloads', () => {
    const value = { id: 1, name: 'prepared' };

    const target = composePreparedSubjectUpdates([], [{ subjectId: 1, value }]);

    expect(target[0].value).toBe(value);
  });

  it('rejects undefined prepared values at the authority boundary', () => {
    expect(() =>
      composePreparedSubjectUpdates(
        [],
        [{ subjectId: 1, value: undefined as never }]
      )
    ).toThrow('Invalid prepared value for SubjectId 1');
  });

  it('rejects duplicate contributions from one authority', () => {
    expect(() =>
      composePreparedSubjectUpdates(
        [
          { subjectId: 1, revision: 1 },
          { subjectId: 1, revision: 2 },
        ],
        []
      )
    ).toThrow('Duplicate structural contribution for SubjectId 1');

    expect(() =>
      composePreparedSubjectUpdates(
        [],
        [
          { subjectId: 1, value: { id: 1 } },
          { subjectId: 1, value: { id: 1 } },
        ]
      )
    ).toThrow('Duplicate value contribution for SubjectId 1');
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid SubjectId %s',
    (subjectId) => {
      expect(() =>
        composePreparedSubjectUpdates([{ subjectId, revision: 1 }], [])
      ).toThrow(`Invalid SubjectId ${String(subjectId)}`);
    }
  );

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid subject revision %s',
    (revision) => {
      expect(() =>
        composePreparedSubjectUpdates([{ subjectId: 1, revision }], [])
      ).toThrow(`Invalid subject revision ${String(revision)}`);
    }
  );
});

describe('preparePhysicalSubjectTarget', () => {
  it('installs same-subject revision and value through one target assignment', () => {
    const beforeValue = { id: 1, name: 'before' };
    const afterValue = { id: 1, name: 'after' };
    let live: ReadonlyMap<
      number,
      { readonly revision: number; readonly value: typeof beforeValue }
    > = new Map([[1, Object.freeze({ revision: 3, value: beforeValue })]]);
    const updates = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 4 }],
      [{ subjectId: 1, value: afterValue }]
    );

    const target = preparePhysicalSubjectTarget(live, updates);

    expect(live.get(1)).toEqual({ revision: 3, value: beforeValue });
    expect(target.get(1)).toEqual({ revision: 4, value: afterValue });

    live = target;
    expect(live.get(1)).toEqual({ revision: 4, value: afterValue });
  });

  it('preserves the other authority fact for a partial update', () => {
    const value = { id: 1, name: 'same' };
    const current: ReadonlyMap<
      number,
      { readonly revision: number; readonly value: { id: number; name: string } }
    > = new Map<
      number,
      { readonly revision: number; readonly value: { id: number; name: string } }
    >([
      [1, Object.freeze({ revision: 3, value })],
      [2, Object.freeze({ revision: 7, value: { id: 2, name: 'untouched' } })],
    ]);

    const revisionTarget = preparePhysicalSubjectTarget(
      current,
      composePreparedSubjectUpdates([{ subjectId: 1, revision: 4 }], [])
    );
    const valueTarget = preparePhysicalSubjectTarget(
      current,
      composePreparedSubjectUpdates(
        [],
        [{ subjectId: 1, value: { id: 1, name: 'changed' } }]
      )
    );

    expect(revisionTarget.get(1)).toEqual({ revision: 4, value });
    expect(valueTarget.get(1)).toEqual({
      revision: 3,
      value: { id: 1, name: 'changed' },
    });
    expect(revisionTarget.get(2)).toBe(current.get(2));
    expect(valueTarget.get(2)).toBe(current.get(2));
  });

  it('requires both authority facts before preparing a new subject', () => {
    const current = new Map<
      number,
      { revision: number; value: { id: number } }
    >();

    expect(() =>
      preparePhysicalSubjectTarget(
        current,
        composePreparedSubjectUpdates([{ subjectId: 1, revision: 0 }], [])
      )
    ).toThrow('New SubjectId 1 requires revision and value contributions');

    expect(() =>
      preparePhysicalSubjectTarget(
        current,
        composePreparedSubjectUpdates([], [{ subjectId: 1, value: { id: 1 } }])
      )
    ).toThrow('New SubjectId 1 requires revision and value contributions');
  });

  it('prepares a complete new subject without mutating the current map', () => {
    const current = new Map<
      number,
      { revision: number; value: { id: number } }
    >();
    const updates = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 0 }],
      [{ subjectId: 1, value: { id: 1 } }]
    );

    const target = preparePhysicalSubjectTarget(current, updates);

    expect(current.size).toBe(0);
    expect(target.get(1)).toEqual({ revision: 0, value: { id: 1 } });
    expect(Object.isFrozen(target.get(1))).toBe(true);
  });
});

describe('preparePhysicalSubjectSlotTarget', () => {
  const current = () => ({
    slotBySubject: new Map([
      [1, 0],
      [2, 1],
    ]),
    subjects: [1, 2],
    revisions: [3, 7],
    values: [
      { id: 1, name: 'before' },
      { id: 2, name: 'untouched' },
    ],
  });

  it('installs same-subject revision and value through one slot target assignment', () => {
    const live = current();
    const afterValue = { id: 1, name: 'after' };
    const updates = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 4 }],
      [{ subjectId: 1, value: afterValue }]
    );

    const target = preparePhysicalSubjectSlotTarget(live, updates);

    expect(live.revisions[0]).toBe(3);
    expect(live.values[0]).toEqual({ id: 1, name: 'before' });
    expect(target.revisions[0]).toBe(4);
    expect(target.values[0]).toBe(afterValue);
    expect(target.slotBySubject.get(1)).toBe(0);
  });

  it('preserves the other authority column for partial updates', () => {
    const live = current();

    const revisionTarget = preparePhysicalSubjectSlotTarget(
      live,
      composePreparedSubjectUpdates([{ subjectId: 1, revision: 4 }], [])
    );
    const afterValue = { id: 1, name: 'changed' };
    const valueTarget = preparePhysicalSubjectSlotTarget(
      live,
      composePreparedSubjectUpdates([], [{ subjectId: 1, value: afterValue }])
    );

    expect(revisionTarget.revisions).toEqual([4, 7]);
    expect(revisionTarget.values[0]).toBe(live.values[0]);
    expect(valueTarget.revisions).toEqual([3, 7]);
    expect(valueTarget.values[0]).toBe(afterValue);
  });

  it('allocates stable monotonic slots for complete new subjects', () => {
    const live = current();
    const updates = composePreparedSubjectUpdates(
      [
        { subjectId: 4, revision: 0 },
        { subjectId: 3, revision: 0 },
      ],
      [
        { subjectId: 3, value: { id: 3, name: 'three' } },
        { subjectId: 4, value: { id: 4, name: 'four' } },
      ]
    );

    const target = preparePhysicalSubjectSlotTarget(live, updates);

    expect(target.subjects).toEqual([1, 2, 3, 4]);
    expect(target.slotBySubject.get(3)).toBe(2);
    expect(target.slotBySubject.get(4)).toBe(3);
    expect(live.subjects).toEqual([1, 2]);
  });

  it('rejects incomplete updates before copying columns', () => {
    const live = current();

    expect(() =>
      preparePhysicalSubjectSlotTarget(
        live,
        composePreparedSubjectUpdates([{ subjectId: 3, revision: 0 }], [])
      )
    ).toThrow('New SubjectId 3 requires revision and value contributions');
    expect(live.revisions).toEqual([3, 7]);
  });

  it('exposes explicit integrity validation outside target preparation', () => {
    expect(() =>
      assertPhysicalSubjectSlots({
        slotBySubject: new Map([[1, 0]]),
        subjects: [1],
        revisions: [],
        values: [{ id: 1 }],
      })
    ).toThrow('Physical subject slot columns are inconsistent');

    expect(() =>
      assertPhysicalSubjectSlots({
        slotBySubject: new Map([[1, 1]]),
        subjects: [1],
        revisions: [0],
        values: [{ id: 1 }],
      })
    ).toThrow('Physical SubjectId 1 does not address slot 0');
  });

  it('releases value backing while preserving structural slot identity and revision', () => {
    const live = current();

    const target = preparePhysicalSubjectValueRelease(live, 1);

    expect(live.values[0]).toEqual({ id: 1, name: 'before' });
    expect(target.slotBySubject.get(1)).toBe(0);
    expect(target.subjects[0]).toBe(1);
    expect(target.revisions[0]).toBe(3);
    expect(target.values[0]).toBeUndefined();
    expect(() => assertPhysicalSubjectSlots(target)).not.toThrow();
  });

  it('updates structural revision after value backing has been released', () => {
    const withoutValue = preparePhysicalSubjectValueRelease(current(), 1);

    const target = preparePhysicalSubjectSlotTarget(
      withoutValue,
      composePreparedSubjectUpdates([{ subjectId: 1, revision: 4 }], [])
    );

    expect(target.revisions[0]).toBe(4);
    expect(target.values[0]).toBeUndefined();
  });

  it('forgets terminal structural identity without reusing its physical slot', () => {
    const live = current();
    const forgotten = preparePhysicalSubjectForget(live, 1);
    const target = preparePhysicalSubjectSlotTarget(
      forgotten,
      composePreparedSubjectUpdates(
        [{ subjectId: 3, revision: 0 }],
        [{ subjectId: 3, value: { id: 3, name: 'fresh' } }]
      )
    );

    expect(forgotten.slotBySubject.has(1)).toBe(false);
    expect(forgotten.subjects[0]).toBeUndefined();
    expect(forgotten.revisions[0]).toBeUndefined();
    expect(forgotten.values[0]).toBeUndefined();
    expect(target.slotBySubject.get(3)).toBe(2);
    expect(target.subjects).toEqual([undefined, 2, 3]);
    expect(() => assertPhysicalSubjectSlots(target)).not.toThrow();
  });

  it('rejects releasing or forgetting a missing SubjectId', () => {
    expect(() => preparePhysicalSubjectValueRelease(current(), 3)).toThrow(
      'Physical SubjectId 3 has no slot'
    );
    expect(() => preparePhysicalSubjectForget(current(), 3)).toThrow(
      'Physical SubjectId 3 has no slot'
    );
  });

  it('prepares batch value release and terminal forget atomically', () => {
    const live = current();

    const released = preparePhysicalSubjectValueReleases(live, [1, 2]);
    const forgotten = preparePhysicalSubjectForgets(live, [1, 2]);

    expect(released.values).toEqual([undefined, undefined]);
    expect(released.revisions).toEqual([3, 7]);
    expect(forgotten.slotBySubject.size).toBe(0);
    expect(forgotten.subjects).toEqual([undefined, undefined]);
    expect(forgotten.revisions).toEqual([undefined, undefined]);
    expect(forgotten.values).toEqual([undefined, undefined]);
    expect(live.values).toEqual([
      { id: 1, name: 'before' },
      { id: 2, name: 'untouched' },
    ]);
  });

  it('rejects an invalid batch before copying physical columns', () => {
    const live = current();

    expect(() => preparePhysicalSubjectValueReleases(live, [1, 3])).toThrow(
      'Physical SubjectId 3 has no slot'
    );
    expect(() => preparePhysicalSubjectForgets(live, [1, 1])).toThrow(
      'Duplicate physical SubjectId 1'
    );
    expect(live.values[0]).toEqual({ id: 1, name: 'before' });
  });
});
