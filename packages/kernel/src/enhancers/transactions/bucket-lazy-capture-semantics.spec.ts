import { expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  const { signalTree } = await import('../../lib/signal-tree');
  const { entityMap } = await import('../../lib/markers/entity-map');
  const { transactions, peekInternalTransactionRuntime } = await import(
    './transactions'
  );
  const { getPathNotifier } = await import('../../lib/path-notifier');
  const make = () =>
    signalTree(
      { x: 0, rows: entityMap<{ id: string; n: number; m: number }, string>() },
      { enhancers: [transactions({ history: { retain: 0 } })] }
    );
  return {
    make,
    peekInternalTransactionRuntime,
    flush: () => getPathNotifier().flushSync(),
  };
}

for (const overlap of [true, false])
  it(`first entity work after scalar capture preserves open-owner dependency: ${overlap}`, async () => {
    const api = await load(),
      tree = api.make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 0, m: 0 });
      api.flush();
      const earlier = tree.transact(() => tree.$.rows.updateOne('a', { n: 1 }));
      let attempted = false,
        refused = false;
      const later = tree.transact(() => {
        tree.$.x(8);
        tree.$.rows.updateOne('a', overlap ? { n: 2 } : { m: 2 });
        attempted = true;
        try {
          earlier.rollback();
        } catch (error) {
          refused = true;
          expect(String(error)).toMatch(/later-confirmed-dependency/);
        }
        expect(tree.$.rows.byIdOrFail('a')()).toEqual({
          id: 'a',
          n: overlap ? 2 : 0,
          m: overlap ? 0 : 2,
        });
      });
      expect(attempted).toBe(true);
      expect(refused).toBe(overlap);
      expect(
        api.peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
      ).toBe(overlap ? 2 : 1);
      later.rollback();
      if (overlap) earlier.rollback();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 0, m: 0 }]);
      expect(
        api.peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
      ).toBe(0);
    } finally {
      tree.destroy();
      api.flush();
    }
  });

it('rejects nested transaction construction without losing outer capture or later tree isolation', async () => {
  const api = await load(),
    left = api.make(),
    right = api.make();
  try {
    left.$.rows.addOne({ id: 'same', n: 1, m: 0 });
    right.$.rows.addOne({ id: 'same', n: 2, m: 0 });
    api.flush();
    let nestedBody = 0,
      refused = false;
    const pending = left.transact(() => {
      left.$.x(7);
      left.$.rows.removeOne('same');
      try {
        right.transact(() => {
          nestedBody++;
          right.$.x(11);
        });
      } catch (error) {
        refused = true;
        expect(String(error)).toMatch(/Nested transaction is not supported/);
      }
      expect(left.$.rows.all()).toEqual([]);
      expect(right.$.rows.byIdOrFail('same')()).toEqual({
        id: 'same',
        n: 2,
        m: 0,
      });
    });
    expect(refused).toBe(true);
    expect(nestedBody).toBe(0);
    const other = right.transact(() => {
      right.$.x(11);
      right.$.rows.updateOne('same', { m: 13 });
    });
    pending.rollback();
    expect(left.$.x()).toBe(0);
    expect(left.$.rows.all()).toEqual([{ id: 'same', n: 1, m: 0 }]);
    expect(right.$.x()).toBe(11);
    expect(right.$.rows.all()).toEqual([{ id: 'same', n: 2, m: 13 }]);
    other.rollback();
    expect(right.$.x()).toBe(0);
    expect(right.$.rows.all()).toEqual([{ id: 'same', n: 2, m: 0 }]);
    expect(
      api.peekInternalTransactionRuntime(left)!.getPendingTurnCount()
    ).toBe(0);
    expect(
      api.peekInternalTransactionRuntime(right)!.getPendingTurnCount()
    ).toBe(0);
  } finally {
    left.destroy();
    right.destroy();
    api.flush();
  }
});

it('compensates a mixed callback throwing undefined and accepts useful later capture', async () => {
  const api = await load(),
    tree = api.make();
  let caught = false;
  try {
    tree.$.rows.addOne({ id: 'a', n: 1, m: 0 });
    api.flush();
    try {
      tree.transact(() => {
        tree.$.x(7);
        tree.$.rows.removeOne('a');
        tree.$.rows.addOne({ id: 'b', n: 2, m: 0 });
        throw undefined;
      });
    } catch (error) {
      caught = true;
      expect(error).toBeUndefined();
    }
    expect(caught).toBe(true);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1, m: 0 }]);
    expect(
      api.peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
    ).toBe(0);
    const next = tree.transact(() => {
      tree.$.x(9);
      tree.$.rows.updateOne('a', { m: 4 });
    });
    next.rollback();
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1, m: 0 }]);
  } finally {
    tree.destroy();
    api.flush();
  }
});
