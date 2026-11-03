import { describe, it, expect } from 'vitest';
import { signalTree, entityMap, transactions } from '../index';
import { withWriteContext } from './write-context';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
describe('indexed source owner payload boundary', () => {
  it('retains the current ordinary payload when a placement exception survives a point update', async () => {
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
      const b = r.byIdOrFail('b');
      withWriteContext({ participation: 'inspection' }, () =>
        r.setAll([
          { id: 'c', n: 3 },
          { id: 'b', n: 2 },
          { id: 'a', n: 1 },
        ])
      );
      r.updateOne('b', { n: 44 });
      expect(b.n()).toBe(44);
      const p = t.transact(() => r.removeOne('b'));
      p.rollback();
      expect(r.byIdOrFail('b')).toBe(b);
      expect(b.n()).toBe(44);
    } finally {
      t.destroy();
    }
  });
});
