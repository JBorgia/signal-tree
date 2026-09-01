import { describe, expect, it } from 'vitest';
import { composePreparedSubjectUpdates } from './subject-record-target';

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
