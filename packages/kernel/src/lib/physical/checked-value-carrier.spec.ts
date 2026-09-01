import { describe, expect, it } from 'vitest';
import { CheckedValueCarrier } from './checked-value-carrier';
import { composePreparedSubjectUpdates } from './subject-record-target';

type Item = { id: number; name: string };

const createSubject = (
  carrier: CheckedValueCarrier<Item>,
  subjectId: number,
  name: string
) =>
  carrier.prepare(
    composePreparedSubjectUpdates(
      [{ subjectId, revision: 0 }],
      [{ subjectId, value: { id: subjectId, name } }]
    )
  );

describe('CheckedValueCarrier', () => {
  it('releases value backing while preserving structural revision', () => {
    const active = createSubject(new CheckedValueCarrier<Item>(), 1, 'one');
    const oldHandle = active.recordForSubject(1)?.valueHandle;

    const retired = active.prepareValueRelease([1]);

    expect(active.valueForSubject(1)).toEqual({ id: 1, name: 'one' });
    expect(retired.recordForSubject(1)).toEqual({ revision: 0 });
    expect(retired.valueForSubject(1)).toBeUndefined();
    expect(oldHandle).toBeDefined();
  });

  it('recycles value capacity for a fresh SubjectId without aliasing stale handles', () => {
    const first = createSubject(new CheckedValueCarrier<Item>(), 1, 'first');
    const staleHandle = first.recordForSubject(1)?.valueHandle;
    const released = first.prepareValueRelease([1]);
    const second = createSubject(released, 2, 'second');

    const freshHandle = second.recordForSubject(2)?.valueHandle;
    expect(freshHandle?.slot).toBe(staleHandle?.slot);
    expect(freshHandle?.generation).toBeGreaterThan(
      staleHandle?.generation ?? 0
    );
    expect(second.valueForSubject(1)).toBeUndefined();
    expect(second.valueForSubject(2)).toEqual({ id: 2, name: 'second' });
  });

  it('reacquires value for the same SubjectId without reviving the old address', () => {
    const first = createSubject(new CheckedValueCarrier<Item>(), 1, 'first');
    const staleHandle = first.recordForSubject(1)?.valueHandle;
    const released = first.prepareValueRelease([1]);
    const restored = released.prepare(
      composePreparedSubjectUpdates(
        [],
        [{ subjectId: 1, value: { id: 1, name: 'restored' } }]
      )
    );

    const currentHandle = restored.recordForSubject(1)?.valueHandle;
    expect(currentHandle?.generation).toBeGreaterThan(
      staleHandle?.generation ?? 0
    );
    expect(restored.valueForSubject(1)).toEqual({ id: 1, name: 'restored' });
  });

  it('forgets terminal structural identity and releases any value backing', () => {
    const active = createSubject(new CheckedValueCarrier<Item>(), 1, 'one');

    const forgotten = active.prepareTerminalForget([1]);

    expect(active.recordForSubject(1)).toBeDefined();
    expect(forgotten.recordForSubject(1)).toBeUndefined();
    expect(forgotten.valueForSubject(1)).toBeUndefined();
    expect(forgotten.structuralSubjectCount()).toBe(0);
    expect(forgotten.valueCapacity()).toBe(1);
  });

  it('keeps the live carrier unchanged when release preparation fails', () => {
    const active = createSubject(new CheckedValueCarrier<Item>(), 1, 'one');

    expect(() => active.prepareValueRelease([1, 2])).toThrow(
      'Physical SubjectId 2 has no structural record'
    );
    expect(active.valueForSubject(1)).toEqual({ id: 1, name: 'one' });
    expect(active.recordForSubject(1)?.valueHandle).toBeDefined();
  });
});
