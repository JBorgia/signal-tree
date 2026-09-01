import { describe, expect, it } from 'vitest';
import {
  composePreparedSubjectUpdates,
  preparePhysicalSubjectTarget,
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
      composePreparedSubjectUpdates([], [
        { subjectId: 1, value: { id: 1 } },
        { subjectId: 1, value: { id: 1 } },
      ])
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
    let live: ReadonlyMap<number, { readonly revision: number; readonly value: typeof beforeValue }> =
      new Map([[1, Object.freeze({ revision: 3, value: beforeValue })]]);
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
    const current = new Map([
      [1, Object.freeze({ revision: 3, value })],
      [2, Object.freeze({ revision: 7, value: { id: 2, name: 'untouched' } })],
    ]);

    const revisionTarget = preparePhysicalSubjectTarget(
      current,
      composePreparedSubjectUpdates([{ subjectId: 1, revision: 4 }], [])
    );
    const valueTarget = preparePhysicalSubjectTarget(
      current,
      composePreparedSubjectUpdates([], [
        { subjectId: 1, value: { id: 1, name: 'changed' } },
      ])
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
    const current = new Map<number, { revision: number; value: { id: number } }>();

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

    expect(() =>
      preparePhysicalSubjectTarget(current, [
        { subjectId: 1, revision: 0, value: undefined },
      ])
    ).toThrow('New SubjectId 1 requires revision and value contributions');

    expect(() =>
      preparePhysicalSubjectTarget(current, [
        { subjectId: 1, revision: undefined, value: { id: 1 } },
      ])
    ).toThrow('New SubjectId 1 requires revision and value contributions');
  });

  it('prepares a complete new subject without mutating the current map', () => {
    const current = new Map<number, { revision: number; value: { id: number } }>();
    const updates = composePreparedSubjectUpdates(
      [{ subjectId: 1, revision: 0 }],
      [{ subjectId: 1, value: { id: 1 } }]
    );

    const target = preparePhysicalSubjectTarget(current, updates);

    expect(current.size).toBe(0);
    expect(target.get(1)).toEqual({ revision: 0, value: { id: 1 } });
    expect(Object.isFrozen(target.get(1))).toBe(true);
  });

  it('rejects duplicate physical updates before preparing the target', () => {
    const current = new Map([
      [1, Object.freeze({ revision: 1, value: { id: 1 } })],
    ]);

    expect(() =>
      preparePhysicalSubjectTarget(current, [
        { subjectId: 1, revision: 2 },
        { subjectId: 1, value: { id: 1 } },
      ])
    ).toThrow('Duplicate physical update for SubjectId 1');
    expect(current.get(1)).toEqual({ revision: 1, value: { id: 1 } });
  });
});
