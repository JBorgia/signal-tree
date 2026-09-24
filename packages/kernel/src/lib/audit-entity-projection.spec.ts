import { describe, expect, it, vi } from 'vitest';
import { signalTree, entityMap } from '../index';
import { getPositionRegistry } from './internals/position-registry';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getEntityLocationBinding } from './internals/entity-projection-seed';
import { createEntityEgressProjection } from './internals/entity-egress-projection';

const seed = [1, 2, 3].map((subjectId) => ({
  subjectId,
  key: subjectId,
  row: subjectId,
}));

describe('entity ownership and order authority controls', () => {
  it('bare row and field metadata reuse one lazily allocated collection owner', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; value: number }, number>(),
    });
    const registry = getPositionRegistry(tree.$);
    if (!registry) throw new Error('Missing tree registry');
    const allocate = vi.spyOn(registry, 'allocate');
    try {
      tree.$.rows.setAll([
        { id: 1, value: 0 },
        { id: 2, value: 0 },
      ]);
      expect(allocate).not.toHaveBeenCalled();
      const row = tree.$.rows.byIdOrFail(1);
      const second = tree.$.rows.byIdOrFail(2);
      const owner = getOwnedPositionIds(tree.$.rows)?.[0];
      expect(owner).toBeDefined();
      expect(allocate).toHaveBeenCalledTimes(1);
      expect(getPositionRegistry(row)).toBe(registry);
      expect(getPositionRegistry(row.value)).toBe(registry);
      expect(getEntityLocationBinding(row)?.owner).toBe(owner);
      expect(getEntityLocationBinding(row.value)).toEqual({
        owner,
        subjectId: getEntityLocationBinding(row)?.subjectId,
        fieldKey: 'value',
      });
      expect(getEntityLocationBinding(second)?.owner).toBe(owner);
      expect(getEntityLocationBinding(second)?.subjectId).not.toBe(
        getEntityLocationBinding(row)?.subjectId
      );
      // Metadata contains no row, store, closure, or retained value reference.
      expect(
        Object.values(getEntityLocationBinding(row.value) ?? {}).every(
          (value) => typeof value === 'number' || typeof value === 'string'
        )
      ).toBe(true);
    } finally {
      allocate.mockRestore();
      tree.destroy();
    }
  });

  it('inspection reorder alone never changes eligible authority', () => {
    const projection = createEntityEgressProjection(seed);
    expect(projection.reorder([3, 1, 2], true)).toBe(false);
    expect(projection.value()).toEqual([1, 2, 3]);
    projection.apply(1, 10, undefined, false, null);
    expect(projection.value()).toEqual([10, 2, 3]);
    expect(projection.reorder([3, 1, 2], false)).toBe(true);
    expect(projection.value()).toEqual([3, 10, 2]);
  });

  it('authored reorder retains eligible rows removed only by inspection', () => {
    const projection = createEntityEgressProjection(seed);
    projection.apply(
      2,
      undefined,
      { kind: 'remove', subject: 2, key: 2 },
      true
    );
    projection.reorder([3, 1], false);
    expect(projection.value()).toEqual([3, 2, 1]);
  });

  it('inspection order informs later adoption without adopting other inspected rows', () => {
    const projection = createEntityEgressProjection(seed);
    projection.apply(4, 4, { kind: 'add', subject: 4, key: 4, value: 4 }, true);
    projection.apply(5, 5, { kind: 'add', subject: 5, key: 5, value: 5 }, true);
    projection.reorder([4, 5, 1, 2, 3], true);
    projection.apply(4, 40, undefined, false, null);
    expect(projection.value()).toEqual([40, 1, 2, 3]);
  });
});
