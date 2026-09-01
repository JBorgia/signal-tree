import { describe, expect, it } from 'vitest';
import {
  emptyPhysicalValuePool,
  preparePhysicalValueRelease,
  preparePhysicalValueTarget,
  resolvePhysicalValue,
  valueHandleForSubject,
} from './physical-value-pool';
import { composePreparedSubjectUpdates } from './subject-record-target';

type Item = { id: number; name: string };

const prepareValues = (
  pool: ReturnType<typeof emptyPhysicalValuePool<Item>>,
  values: readonly { readonly subjectId: number; readonly value: Item }[]
) =>
  preparePhysicalValueTarget(pool, composePreparedSubjectUpdates([], values));

describe('PhysicalValuePool', () => {
  it('does not expose a mutable value-address directory', () => {
    const pool = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value: { id: 1, name: 'one' } },
    ]);

    expect('set' in pool.handlesBySubject).toBe(false);
    expect('delete' in pool.handlesBySubject).toBe(false);
    expect(Object.isFrozen(pool.handlesBySubject)).toBe(true);
  });

  it('publishes value backing and its handle through one target assignment', () => {
    let live = emptyPhysicalValuePool<Item>();

    const target = prepareValues(live, [
      { subjectId: 1, value: { id: 1, name: 'one' } },
    ]);

    expect(valueHandleForSubject(live, 1)).toBeUndefined();
    const preparedHandle = valueHandleForSubject(target, 1);
    expect(preparedHandle).toBeDefined();
    expect(resolvePhysicalValue(target, preparedHandle!)).toEqual({
      id: 1,
      name: 'one',
    });

    live = target;
    expect(resolvePhysicalValue(live, preparedHandle!)).toEqual({
      id: 1,
      name: 'one',
    });
  });

  it('rejects a stale handle after its physical slot is recycled', () => {
    const initial = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value: { id: 1, name: 'one' } },
    ]);
    const staleHandle = valueHandleForSubject(initial, 1)!;
    const released = preparePhysicalValueRelease(initial, [1]);
    const reused = prepareValues(released, [
      { subjectId: 2, value: { id: 2, name: 'two' } },
    ]);

    const freshHandle = valueHandleForSubject(reused, 2)!;
    expect(freshHandle.slot).toBe(staleHandle.slot);
    expect(freshHandle.generation).toBeGreaterThan(staleHandle.generation);
    expect(resolvePhysicalValue(reused, staleHandle)).toBeUndefined();
    expect(resolvePhysicalValue(reused, freshHandle)).toEqual({
      id: 2,
      name: 'two',
    });
  });

  it('reacquires value backing for the original SubjectId without reviving an old handle', () => {
    const initial = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value: { id: 1, name: 'first' } },
    ]);
    const staleHandle = valueHandleForSubject(initial, 1)!;
    const released = preparePhysicalValueRelease(initial, [1]);
    const reacquired = prepareValues(released, [
      { subjectId: 1, value: { id: 1, name: 'second' } },
    ]);

    const currentHandle = valueHandleForSubject(reacquired, 1)!;
    expect(resolvePhysicalValue(reacquired, staleHandle)).toBeUndefined();
    expect(resolvePhysicalValue(reacquired, currentHandle)).toEqual({
      id: 1,
      name: 'second',
    });
  });

  it('preserves the live pool when release preparation fails', () => {
    const live = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value: { id: 1, name: 'one' } },
    ]);
    const handle = valueHandleForSubject(live, 1)!;

    expect(() => preparePhysicalValueRelease(live, [1, 2])).toThrow(
      'SubjectId 2 has no physical value'
    );
    expect(resolvePhysicalValue(live, handle)).toEqual({ id: 1, name: 'one' });
  });

  it('rejects duplicate authority updates and releases', () => {
    expect(() =>
      prepareValues(emptyPhysicalValuePool<Item>(), [
        { subjectId: 1, value: { id: 1, name: 'one' } },
        { subjectId: 1, value: { id: 1, name: 'other' } },
      ])
    ).toThrow('Duplicate value contribution for SubjectId 1');

    const live = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value: { id: 1, name: 'one' } },
    ]);
    expect(() => preparePhysicalValueRelease(live, [1, 1])).toThrow(
      'Duplicate physical SubjectId 1'
    );
  });

  it('preserves opaque authority-prepared value identity', () => {
    const value = { id: 1, name: 'prepared' };

    const pool = prepareValues(emptyPhysicalValuePool<Item>(), [
      { subjectId: 1, value },
    ]);
    const handle = valueHandleForSubject(pool, 1)!;

    expect(resolvePhysicalValue(pool, handle)).toBe(value);
  });

  it('refuses a recycled slot before its generation can repeat', () => {
    const exhausted = {
      handlesBySubject: new Map<number, never>(),
      subjects: [undefined],
      generations: [Number.MAX_SAFE_INTEGER],
      values: [undefined],
      freeSlots: [0],
    };

    expect(() =>
      prepareValues(exhausted, [
        { subjectId: 1, value: { id: 1, name: 'one' } },
      ])
    ).toThrow('Physical value generation exhausted for slot 0');
    expect(exhausted.freeSlots).toEqual([0]);
    expect(exhausted.subjects).toEqual([undefined]);
  });
});
