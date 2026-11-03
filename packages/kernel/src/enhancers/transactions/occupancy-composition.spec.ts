import { describe, expect, it } from 'vitest';
import {
  composeOccupancy,
  occupancyEffect,
  type OccupancyComposition,
} from './occupancy-composition';
import type {
  CollectionAddEffect,
  CollectionRemoveEffect,
  CollectionRekeyEffect,
} from './transactions';
const base = { ownerPath: 'rows', path: 'rows', position: 10, subject: 1 };
const add = (key: string, n = 7): CollectionAddEffect => ({
  ...base,
  kind: 'add',
  key,
  value: { n },
});
const remove = (key: string, n = 7): CollectionRemoveEffect => ({
  ...base,
  kind: 'remove',
  key,
  value: { n },
});
const rekey = (beforeKey: string, afterKey: string): CollectionRekeyEffect => ({
  ...base,
  kind: 'rekey',
  beforeKey,
  afterKey,
});
const fold = (
  steps: Array<
    CollectionAddEffect | CollectionRemoveEffect | CollectionRekeyEffect
  >
) => {
  let state: OccupancyComposition | undefined;
  for (const step of steps) state = composeOccupancy(state, step);
  return state && occupancyEffect(state);
};
describe('capture-interval ordinary occupancy composition', () => {
  it('retains a later re-addition of the same lifetime at another key', () => {
    expect(fold([remove('a'), add('c')])).toEqual(rekey('a', 'c'));
  });
  it('cancels same-lifetime same-key endpoints', () => {
    expect(fold([remove('a'), add('a')])).toBeUndefined();
  });
  it('keeps the original interval after a canceled remove/re-add', () => {
    expect(fold([remove('a', 7), add('a', 99), remove('a', 99)])).toEqual(
      remove('a', 7)
    );
  });
  it('keeps originally absent state after canceled creation', () => {
    expect(fold([add('a'), remove('a'), add('b', 99)])).toEqual(add('b', 99));
  });
  it('uses original key and first removal payload across repeated removal', () => {
    expect(
      fold([rekey('a', 'b'), remove('b', 7), add('c', 99), remove('c', 99)])
    ).toEqual(remove('a', 7));
  });
  it('uses final addition payload when a created lifetime is re-added', () => {
    expect(
      fold([add('a', 7), remove('a', 7), add('b', 99), rekey('b', 'c')])
    ).toEqual(add('c', 99));
  });
  it('preserves first removal placement without borrowing final addition placement', () => {
    expect(
      fold([
        { ...remove('a'), beforeSubject: 2 },
        { ...add('b'), beforeSubject: 3 },
        remove('b'),
      ])
    ).toEqual({ ...remove('a'), beforeSubject: 2 });
  });
  it('refuses discontinuous evidence without modifying prepared state', () => {
    const state = composeOccupancy(undefined, remove('a'));
    expect(() => composeOccupancy(state, rekey('a', 'b'))).toThrow(
      'Discontinuous'
    );
    expect(occupancyEffect(state)).toEqual(remove('a'));
  });
});
