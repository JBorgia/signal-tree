import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('typed addresses remain distinct through Link and transaction replay', () => {
  it('links a literal dotted object key separately from a nested path', async () => {
    const tree = signalTree({ data: { 'a.b': 0, a: { b: 10 } } });
    const sent: unknown[] = [];
    const connection = link(tree.$.data, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      tree.$.data['a.b'](1);
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toEqual({ 'a.b': 1, a: { b: 10 } });
      tree.$.data.a.b(11);
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toEqual({ 'a.b': 1, a: { b: 11 } });
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it.each(['jo.doe@example.com', '1.2.3', 'a/b', 'a::b'])(
    'rolls back an entity field with key %s',
    async (id) => {
      const tree = signalTree(
        { rows: entityMap<{ id: string; n: number }, string>() },
        { enhancers: [transactions()] }
      );
      tree.$.rows.addOne({ id, n: 0 });
      await flush();
      try {
        const pending = tree.transaction(() =>
          tree.$.rows.updateOne(id, { n: 1 })
        );
        pending.rollback();
        expect(tree.$.rows.byId(id)?.n()).toBe(0);
      } finally {
        tree.destroy();
      }
    }
  );
  it('does not alias numeric and string entity keys during settlement', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string | number; n: number }, string | number>(),
      },
      { enhancers: [transactions()] }
    );
    tree.$.rows.setAll([
      { id: 1, n: 0 },
      { id: '1', n: 10 },
    ]);
    await flush();
    try {
      const pending = tree.transaction(() =>
        tree.$.rows.updateOne(1, { n: 2 })
      );
      tree.$.rows.updateOne('1', { n: 11 });
      await flush();
      pending.rollback();
      expect(tree.$.rows.byId(1)?.n()).toBe(0);
      expect(tree.$.rows.byId('1')?.n()).toBe(11);
    } finally {
      tree.destroy();
    }
  });
});
