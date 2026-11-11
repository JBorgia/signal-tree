import { describe, expect, it } from 'vitest';
import { createEntityEgressProjection } from './internals/entity-egress-projection';
import { EntityEgressKeys } from './internals/entity-egress-keys';
import type { EntityPublicationEvidence } from './internals/entity-publication';

function facts(label: string): EntityPublicationEvidence {
  const fact = { label };
  return {
    member: () => fact,
    field: () => fact,
    placement: () => fact,
    keyMapping: () => fact,
  };
}

describe('entity egress address interpretation', () => {
  it('preserves Map canonical subject identity after the address index is active', () => {
    const keys = new EntityEgressKeys();
    keys.set(1, 'same');
    expect(keys.subjectsAt('same')).toEqual([1]);
    keys.set(-0, 'same');
    expect([...keys.keys()]).toEqual([1, 0]);
    expect(keys.subjectsAt('same')).toEqual([1, 0]);
    expect(Object.is(keys.subjectsAt('same')[1], 0)).toBe(true);
    keys.delete(-0);
    expect(keys.subjectsAt('same')).toEqual([1]);
    keys.clear();
    keys.subjectsAt('new');
    keys.set(-0, 'new');
    expect(keys.subjectsAt('new')).toEqual([0]);
  });

  it('cleans every stale matching lifetime but reconciles only the first eligible address match', () => {
    const first = { id: 'A', n: 1 };
    const second = { id: 'A', n: 2 };
    const incoming = { id: 'A', n: 4 };
    const old = facts('old');
    const next = facts('next');
    const projection = createEntityEgressProjection(
      [{ subjectId: 1, key: 'A', row: first }], undefined, old
    );
    // Inspection changes physical addresses without changing eligible addresses.
    projection.apply(1, first, { kind: 'rekey', subject: 1, beforeKey: 'A', afterKey: 'X' }, true);
    projection.apply(2, second, { kind: 'add', subject: 2, key: 'A', value: second }, false, null, false, old);
    projection.apply(2, undefined, { kind: 'remove', subject: 2, key: 'A', value: second }, true);
    projection.apply(4, incoming, { kind: 'add', subject: 4, key: 'A', value: incoming }, false, null, false, next);
    // First matching subject 1 still exists physically, so reconcile returns.
    // The stale subject 2's support is cleaned even though its eligible row remains.
    expect(projection.value()).toEqual([first, incoming, second]);
    expect([...projection.state().keys]).toEqual([[1, 'A'], [2, 'A'], [4, 'A']]);
    expect(projection.support().get('2:m')).toBe(next.member(2, 'physical'));
    expect(projection.support().has('2:f:n')).toBe(false);
    expect(projection.support().get('1:f:n')).toBe(old.field(1, 'n', 'physical'));
  });

  it('preserves original subject insertion order when a subject is rekeyed into an existing address bucket', () => {
    const a = { id: 'A', n: 1 }, b = { id: 'B', n: 2 }, c = { id: 'C', n: 3 }, incoming = { id: 'B', n: 4 };
    const evidence = facts('facts');
    const projection = createEntityEgressProjection([
      { subjectId: 1, key: 'A', row: a }, { subjectId: 2, key: 'B', row: b }
    ], undefined, evidence);
    // Make any lazy lookup index active before the key change.
    projection.apply(3, c, { kind: 'add', subject: 3, key: 'C', value: c }, false, null, false, evidence);
    projection.apply(2, b, { kind: 'rekey', subject: 2, beforeKey: 'B', afterKey: 'D' }, true);
    projection.apply(1, a, { kind: 'rekey', subject: 1, beforeKey: 'A', afterKey: 'B' }, false, undefined, false, evidence);
    projection.apply(1, undefined, { kind: 'remove', subject: 1, key: 'B', value: a }, true);
    projection.apply(4, incoming, { kind: 'add', subject: 4, key: 'B', value: incoming }, false, null, false, evidence);
    // A naive Set bucket appends rekeyed 1 after 2 and would leave stale row 1.
    expect(projection.value()).toEqual([b, c, incoming]);
    expect([...projection.state().keys]).toEqual([[2, 'B'], [3, 'C'], [4, 'B']]);
  });

  it('keeps strict address equality for NaN and distinct numeric and string keys', () => {
    for (const [oldKey, newKey] of [[NaN, NaN], [1, '1']] as const) {
      const oldRow = { id: oldKey, n: 1 }, newRow = { id: newKey, n: 2 };
      const old = facts('old'), next = facts('next');
      const projection = createEntityEgressProjection([{ subjectId: 1, key: oldKey, row: oldRow }], undefined, old);
      projection.apply(1, undefined, { kind: 'remove', subject: 1, key: oldKey, value: oldRow }, true);
      projection.apply(2, newRow, { kind: 'add', subject: 2, key: newKey, value: newRow }, false, null, false, next);
      expect(projection.value()).toEqual([oldRow, newRow]);
      expect(projection.support().get('1:f:n')).toBe(old.field(1, 'n', 'physical'));
    }
    const oldRow = { id: -0, n: 1 }, newRow = { id: 0, n: 2 };
    const projection = createEntityEgressProjection([{ subjectId: 1, key: -0, row: oldRow }]);
    projection.apply(1, undefined, { kind: 'remove', subject: 1, key: -0, value: oldRow }, true);
    projection.apply(2, newRow, { kind: 'add', subject: 2, key: 0, value: newRow }, false, null);
    expect(projection.value()).toEqual([newRow]);
  });
});
