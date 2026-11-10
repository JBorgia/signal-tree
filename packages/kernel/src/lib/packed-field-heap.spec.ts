import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';

it('preserves field proofs when a cold narrow row grows beyond packed capacity', () => {
  const tree = signalTree({
    rows: entityMap<{ id: string; x: number; y: number; z?: number }, string>(),
  });
  try {
    const rows = tree.$.rows;
    rows.setAll([{ id: 'a', x: 1, y: 2 }, { id: 'b', x: 3, y: 4 }]);
    const { source, subject } = getEntityPublicationBinding(rows.byIdOrFail('a'))!;
    const prior = source.evidence()!;
    const initial = prior.field(subject!, 'x', 'ordinary');
    const absent = prior.field(subject!, 'z', 'ordinary');

    rows.updateOne('a', { z: 7 });

    const evidence = source.evidence()!;
    expect(rows.byIdOrFail('a')()).toEqual({ id: 'a', x: 1, y: 2, z: 7 });
    expect(rows.byIdOrFail('b')()).toEqual({ id: 'b', x: 3, y: 4 });
    expect(evidence.field(subject!, 'x', 'ordinary')).toBe(initial);
    expect(evidence.field(subject!, 'x', 'physical')).toBe(initial);
    const added = evidence.field(subject!, 'z', 'ordinary');
    expect(added).not.toBe(absent);
    expect(evidence.field(subject!, 'z', 'physical')).toBe(added);

    rows.updateOne('a', { x: 9 });
    expect(source.evidence()?.field(subject!, 'z', 'physical')).toBe(added);
    expect(rows.byIdOrFail('a')().x).toBe(9);
  } finally {
    tree.destroy();
  }
});
