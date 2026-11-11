import { describe, expect, it } from 'vitest';
import { createEntityEgressProjection } from './internals/entity-egress-projection';
import type { EntityPublicationEvidence } from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';

function evidence(label: string) {
  const values = {
    member: { label, kind: 'member' },
    field: { label, kind: 'field' },
    placement: { label, kind: 'placement' },
    key: { label, kind: 'key' },
  };
  const facts: EntityPublicationEvidence = {
    member: () => values.member,
    field: () => values.field,
    placement: () => values.placement,
    keyMapping: () => values.key,
  };
  return { values, facts };
}

describe('entity egress support replacement', () => {
  it('removes field-only support without a current row and preserves other lifetimes and literal colons', () => {
    const old = { old: true };
    const projection = createEntityEgressProjection(
      [],
      undefined,
      undefined,
      new Map([
        ['1:f:removed:field', old],
        ['1:k', old],
        ['10:f:other:field', old],
        ['20:m', old],
      ])
    );
    const { values, facts } = evidence('new');
    const row = { id: 'new', 'literal:field': 7 };
    expect(projection.value()).toEqual([]);
    expect(projection.support().size).toBe(4);
    projection.apply(
      1,
      row,
      { kind: 'add', subject: 1, key: 'new', value: row },
      false,
      null,
      false,
      facts
    );
    expect(projection.value()).toEqual([row]);
    expect([...projection.support()]).toEqual([
      ['10:f:other:field', old],
      ['20:m', old],
      ['1:m', values.member],
      ['1:p', values.placement],
      ['1:f:id', values.field],
      ['1:f:literal:field', values.field],
    ]);
    projection.apply(
      1,
      undefined,
      { kind: 'remove', subject: 1, key: 'new', value: row },
      false,
      null,
      false,
      facts
    );
    expect(projection.value()).toEqual([]);
    expect([...projection.support()]).toEqual([
      ['10:f:other:field', old],
      ['20:m', old],
      ['1:m', values.member],
    ]);
    const next = evidence('negative');
    projection.apply(
      1,
      undefined,
      { kind: 'remove', subject: 1, key: 'new', value: row },
      false,
      null,
      false,
      next.facts
    );
    expect(projection.support().get('1:m')).toBe(next.values.member);
    expect(projection.support().size).toBe(3);
  });

  it('indexes point-installation slots and clears them on subsequent removal and reseeding', () => {
    const row = { id: 'r', x: 0 };
    const projection = createEntityEgressProjection([
      { subjectId: 1, key: 'r', row },
    ]);
    const first = evidence('point');
    const after = { ...row, 'new:field': 2 };
    const edit = { subject: 1, before: row, after, fields: ['new:field'] };
    const staged = projection.prepare(
      { owner: 1, id: {}, meta: undefined, physical: [edit], ordinary: [edit] },
      first.facts
    );
    expect(projection.support().size).toBe(0);
    installTerminalRecord(staged.record);
    expect(projection.value()).toEqual([after]);
    expect([...projection.support()]).toEqual([
      ['1:f:new:field', first.values.field],
    ]);
    projection.apply(
      1,
      undefined,
      { kind: 'remove', subject: 1, key: 'r', value: after },
      false,
      null,
      false,
      first.facts
    );
    expect([...projection.support()]).toEqual([['1:m', first.values.member]]);
    const second = evidence('seed');
    const seedRow = { id: 'other', y: 3 };
    installTerminalRecord(
      projection.prepareSeed(
        [{ subjectId: 2, key: 'other', row: seedRow }],
        second.facts
      ).record
    );
    expect(projection.value()).toEqual([seedRow]);
    expect(projection.support().has('1:m')).toBe(false);
    expect(projection.support().size).toBe(4);
    const seedAfter = { ...seedRow, 'later:field': 4 };
    const seedEdit = {
      subject: 2,
      before: seedRow,
      after: seedAfter,
      fields: ['later:field'],
    };
    installTerminalRecord(
      projection.prepare(
        {
          owner: 1,
          id: {},
          meta: undefined,
          physical: [seedEdit],
          ordinary: [seedEdit],
        },
        second.facts
      ).record
    );
    expect(projection.value()).toEqual([seedAfter]);
    expect(projection.support().get('2:f:later:field')).toBe(
      second.values.field
    );
    expect(projection.support().size).toBe(5);
    projection.apply(
      2,
      undefined,
      { kind: 'remove', subject: 2, key: 'other', value: seedAfter },
      false,
      null,
      false,
      second.facts
    );
    expect([...projection.support()]).toEqual([['2:m', second.values.member]]);
  });

  it('keeps the existing ordering when incoming key support precedes replacement', () => {
    const old = { id: 'same', x: 1 };
    const first = evidence('old');
    const projection = createEntityEgressProjection(
      [{ subjectId: 1, key: 'same', row: old }],
      undefined,
      first.facts
    );
    // Inspection removes physical membership but does not remove eligible data.
    projection.apply(
      1,
      undefined,
      { kind: 'remove', subject: 1, key: 'same', value: old },
      true,
      null
    );
    expect(projection.value()).toEqual([old]);
    const next = { id: 'same', x: 2 };
    const second = evidence('replacement');
    projection.apply(
      2,
      next,
      { kind: 'add', subject: 2, key: 'same', value: next },
      false,
      null,
      false,
      second.facts
    );
    expect(projection.value()).toEqual([next]);
    expect([...projection.support()]).toEqual([
      ['1:m', second.values.member],
      ['2:m', second.values.member],
      ['2:p', second.values.placement],
      ['2:f:id', second.values.field],
      ['2:f:x', second.values.field],
    ]);
  });
});
