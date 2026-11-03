import { expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { withWriteContext } from './write-context';
import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
const flush = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
};
for (const reentry of [false, true])
  it(`hidden readd preparation preserves pending topology and history (${reentry})`, async () => {
    const t = signalTree(
      {
        count: 0,
        g: { rows: entityMap<{ id: string; n: number }, string>(), k: 0 },
      },
      { enhancers: [transactions(), restoration()] }
    );
    const r = t.$.g.rows;
    try {
      r.addOne({ id: 'a', n: 7 });
      await flush();
      const a = r.byIdOrFail('a');
      // Exercise the established runtime omission route without asserting that
      // a closed construction type permits omitting its required child.
      undoable(() => Reflect.apply(t.$, undefined, [{ count: 0, g: { k: 0 } }]));
      await flush();
      expect(r.all()).toEqual([]);
      const failure = new Error('hidden preparation');
      const off = r.intercept({
        onAdd: (row) => {
          if (row.id === 'b') {
            if (reentry) t.$.count(5);
            throw failure;
          }
        },
      });
      try {
        expect(() => t.transact(() => r.addOne({ id: 'b', n: 9 }))).toThrow(
          failure
        );
      } finally {
        off();
      }
      expect(r.all()).toEqual([]);
      expect(t.$.count()).toBe(0);
      const p = t.transact(() => r.addOne({ id: 'b', n: 9 }));
      expect(r.all()).toEqual([{ id: 'b', n: 9 }]);
      p.rollback();
      await flush();
      expect(r.all()).toEqual([]);
      t.undo();
      await flush();
      expect(r.all()).toEqual([{ id: 'a', n: 7 }]);
      expect(r.byIdOrFail('a')).toBe(a);
    } finally {
      t.destroy();
    }
  });
it('mixed inspected adoption history preparation throw refuses atomically and retries', async () => {
  const t = signalTree(
    { count: 0, rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions(), restoration()] }
  );
  const r = t.$.rows;
  try {
    r.setAll([
      { id: 'a', n: 7 },
      { id: 'b', n: 8 },
    ]);
    await flush();
    const a = r.byIdOrFail('a'),
      b = r.byIdOrFail('b');
    withWriteContext({ participation: 'inspection' }, () =>
      r.updateOne('a', { n: 99 })
    );
    await flush();
    undoable(() =>
      r.setAll([
        { id: 'a', n: 99 },
        { id: 'c', n: 9 },
      ])
    );
    await flush();
    const port = getTreeRealizationPort(t) ?? getTreeRealizationPort(t.$);
    if (!port?.prepareOrdinaryEffects)
      throw new Error('Prepared ordinary handoff unavailable');
    const original = port.prepareOrdinaryEffects;
    const failure = new Error('history ordinary preparation');
    let entered = false;
    port.prepareOrdinaryEffects = (effects) => {
      original(effects);
      entered = true;
      throw failure;
    };
    try {
      expect(() => t.undo()).toThrow(failure);
    } finally {
      port.prepareOrdinaryEffects = original;
    }
    expect(entered).toBe(true);
    expect(r.all()).toEqual([
      { id: 'a', n: 99 },
      { id: 'c', n: 9 },
    ]);
    expect(t.$.count()).toBe(0);
    t.undo();
    await flush();
    expect(r.all()).toEqual([
      { id: 'a', n: 7 },
      { id: 'b', n: 8 },
    ]);
    expect(r.byIdOrFail('a')).toBe(a);
    expect(r.byIdOrFail('b')).toBe(b);
  } finally {
    t.destroy();
  }
});
