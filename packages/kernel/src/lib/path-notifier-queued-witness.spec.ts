import { describe, expect, it, vi } from 'vitest';

import { PathNotifier } from './path-notifier';

const emitRow = (
  notifier: PathNotifier,
  before: unknown,
  after: unknown,
  ownerId = 10,
  subject = 20
): void => {
  // A display path is deliberately ambiguous; field names come from payloads.
  notifier.notify(
    'rows.customer.a.b',
    after,
    before,
    'rows',
    [subject],
    [3],
    undefined,
    ownerId
  );
};

describe('PathNotifier queued subject field witnesses', () => {
  it('retains an ABA field footprint across coalescing without flushing on repeated reads', () => {
    const notifier = new PathNotifier();
    const observer = vi.fn();
    const flushed = vi.fn();
    notifier.subscribe('**', observer);
    notifier.onFlush(flushed);
    const original = { a: 0, b: 0 };
    const intermediate = { a: 1, b: 0 };
    emitRow(notifier, original, intermediate);
    emitRow(notifier, intermediate, original);

    const first = notifier.readPending();
    const second = notifier.readPending();
    expect(first).toHaveLength(1);
    expect(first[0].oldValue).toBe(original);
    expect(first[0].newValue).toBe(original);
    expect(first[0].subjectFieldKeys).toEqual(['a']);
    expect(second).toEqual(first);
    expect(notifier.hasPending()).toBe(true);
    expect(observer).not.toHaveBeenCalled();
    expect(flushed).not.toHaveBeenCalled();
    notifier.clear();
  });

  it('unions touched fields in first-observed order, including fields that return to baseline', () => {
    const notifier = new PathNotifier();
    const zero = { a: 0, b: 0 };
    const one = { a: 1, b: 0 };
    const two = { a: 1, b: 2 };
    emitRow(notifier, zero, one);
    emitRow(notifier, one, two);
    emitRow(notifier, two, { a: 0, b: 2 });
    expect(notifier.readPending()[0].subjectFieldKeys).toEqual(['a', 'b']);
    notifier.clear();
  });

  it('records exact top-level keys without parsing literal dots or descending into objects', () => {
    const notifier = new PathNotifier();
    const shared = { inside: 1 };
    emitRow(
      notifier,
      { a: shared, b: 0, 'a.b': 0, removed: undefined, nested: { value: 0 } },
      { a: shared, b: 1, 'a.b': 2, nested: { value: 1 }, added: undefined }
    );
    expect(notifier.readPending()[0].subjectFieldKeys).toEqual([
      'b',
      'a.b',
      'removed',
      'nested',
      'added',
    ]);
    notifier.clear();
  });

  it('keeps owners and subjects distinct even at identical display paths and positions', () => {
    const notifier = new PathNotifier();
    emitRow(notifier, { a: 0, b: 0 }, { a: 1, b: 0 }, 10, 20);
    emitRow(notifier, { a: 0, b: 0 }, { a: 0, b: 1 }, 11, 20);
    emitRow(notifier, { a: 0, b: 0 }, { a: 0, b: 2 }, 10, 21);
    expect(
      notifier.readPending().map((entry) => ({
        owner: entry.ownerId,
        subject: entry.subjectId,
        fields: entry.subjectFieldKeys,
      }))
    ).toEqual([
      { owner: 10, subject: 20, fields: ['a'] },
      { owner: 11, subject: 20, fields: ['b'] },
      { owner: 10, subject: 21, fields: ['b'] },
    ]);
    notifier.clear();
  });

  it('returns detached field-key arrays so readers cannot corrupt the retained witness', () => {
    const notifier = new PathNotifier();
    emitRow(notifier, { a: 0 }, { a: 1 });
    const first = notifier.readPending()[0].subjectFieldKeys;
    const second = notifier.readPending()[0].subjectFieldKeys;
    expect(first).toEqual(['a']);
    expect(first).not.toBe(second);
    Reflect.set(first!, '0', 'corrupted');
    expect(notifier.readPending()[0].subjectFieldKeys).toEqual(['a']);
    notifier.clear();
  });

  it('captures the witness at notify time rather than rereading payloads during inspection', () => {
    const notifier = new PathNotifier();
    const before = { a: 0, b: 0 };
    const after = { a: 1, b: 0 };
    emitRow(notifier, before, after);
    before.a = 1;
    after.b = 7;
    expect(notifier.readPending()[0].subjectFieldKeys).toEqual(['a']);
    notifier.clear();
  });

  it('accepts null-prototype records and distinguishes known empty evidence from unknown', () => {
    const notifier = new PathNotifier();
    emitRow(
      notifier,
      Object.assign(Object.create(null), { a: 0 }),
      Object.assign(Object.create(null), { a: 1 })
    );
    notifier.notify(
      'other',
      { a: 0 },
      { a: 0 },
      'rows',
      [21],
      [3],
      undefined,
      10
    );
    expect(
      notifier.readPending().map((entry) => entry.subjectFieldKeys)
    ).toEqual([['a'], []]);
    notifier.clear();
  });

  it('does not invent a field witness for missing/multiple subjects or non-record payloads', () => {
    const notifier = new PathNotifier();
    class Row {
      a = 0;
    }
    const cases: Array<[unknown, unknown, number[] | undefined]> = [
      [{ a: 0 }, { a: 1 }, undefined],
      [{ a: 0 }, { a: 1 }, []],
      [{ a: 0 }, { a: 1 }, [20, 21]],
      [undefined, { a: 1 }, [20]],
      [{ a: 0 }, undefined, [20]],
      [[0], [1], [20]],
      [new Row(), new Row(), [20]],
    ];
    cases.forEach(([before, after, subjects], index) => {
      notifier.notify(
        String(index),
        after,
        before,
        'rows',
        subjects,
        [3],
        undefined,
        10
      );
    });
    expect(
      notifier.readPending().map((entry) => entry.subjectFieldKeys)
    ).toEqual(cases.map(() => undefined));
    notifier.clear();
  });

  for (const unknownFirst of [false, true]) {
    it(`keeps coalesced evidence unknown if either input lacks a complete footprint (unknownFirst=${unknownFirst})`, () => {
      const notifier = new PathNotifier();
      if (unknownFirst) {
        emitRow(notifier, undefined, { a: 0 });
        emitRow(notifier, { a: 0 }, { a: 1 });
      } else {
        emitRow(notifier, { a: 0 }, { a: 1 });
        emitRow(notifier, { a: 1 }, undefined);
      }
      expect(notifier.readPending()).toHaveLength(1);
      expect(notifier.readPending()[0].subjectFieldKeys).toBeUndefined();
      notifier.clear();
    });
  }
});
