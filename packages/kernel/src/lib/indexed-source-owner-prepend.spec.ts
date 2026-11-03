import { describe, it, expect } from 'vitest';
import { signalTree, entityMap, transactions } from '../index';
const tick = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};
describe('indexed source prepend intent', () => {
  it('captures overwritten existing member at its final authored front placement', async () => {
    const t = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      const r = t.$.rows;
      r.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]);
      await tick();
      r.prependMany([{ id: 'c', n: 4 }], { mode: 'overwrite' });
      expect(r.ids()).toEqual(['c', 'a', 'b']);
      const c = r.byIdOrFail('c');
      await tick();
      const pending = t.transact(() => r.removeOne('c'));
      pending.rollback();
      expect(r.byIdOrFail('c')).toBe(c);
      expect(c.n()).toBe(4);
      expect(r.ids()).toEqual(['c', 'a', 'b']);
    } finally {
      t.destroy();
    }
  });
});
