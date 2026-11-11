import { expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../../index';

it('skips active-row metadata on settlement while still preparing retired rows', async () => {
  const tree = signalTree(
    { rows: entityMap<{ id: number; value: number }, number>() },
    { enhancers: [transactions()] }
  );
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const rows = tree.$.rows as typeof tree.$.rows & {
    __acquireEntityHandleForTesting(id: number): { subjectId: number };
    __prepareSubjectReclamation(
      id: number,
      options: { causallyEligible: boolean; reclaimLifetimeRecord: boolean }
    ): unknown;
  };
  let restore = () => undefined as void;
  try {
    rows.addOne({
      id: 1,
      value: 0,
      ...Object.fromEntries(Array.from({ length: 64 }, (_, i) => ['f' + i, i])),
    });
    await flush();
    const id = rows.__acquireEntityHandleForTesting(1).subjectId;
    const options = { causallyEligible: true, reclaimLifetimeRecord: true };
    expect(rows.__prepareSubjectReclamation(id, options)).toBeUndefined();
    const held = rows.byIdOrFail(1);
    held.value();
    const keys = Object.keys,
      width = keys(held).length,
      visits: number[] = [];
    expect(width).toBeGreaterThanOrEqual(66);
    const spy = vi.spyOn(Object, 'keys').mockImplementation((value) => {
      const result = keys(value);
      if (value === held) visits.push(result.length);
      return result;
    });
    restore = () => spy.mockRestore();
    expect(rows.__prepareSubjectReclamation(id, options)).toBeUndefined();
    tree.transact(() => rows.updateOne(1, { value: 99 })).confirm();
    await flush();
    expect(visits).toEqual([]);
    const pending = tree.transact(() => rows.removeOne(1));
    await flush();
    expect(rows.__prepareSubjectReclamation(id, options)).toBeDefined();
    expect(visits).toEqual([width]);
    pending.rollback();
    await flush();
    expect(held.value()).toBe(99);
  } finally {
    restore();
    tree.destroy();
  }
});
