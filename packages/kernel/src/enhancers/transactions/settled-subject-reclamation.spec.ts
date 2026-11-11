import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityMap, restoration, signalTree, transactions } from '../../index';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { getPathNotifier } from '../../lib/path-notifier';
import { undoable } from '../../lib/undoable';

type Row = { id: number; value: number };
type Inventory = {
  __acquireEntityHandleForTesting(id: number): { subjectId: number };
  __inspectSubjectResources(id: number): unknown;
  __listSubjectReclamationCandidates(): readonly number[];
};
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const make = (
  order?: 'transactions-first' | 'restoration-first' | 'restoration-only'
) => {
  const tx = transactions(),
    history = restoration({ maxHistorySize: 2 });
  const tree = signalTree(
    { rows: entityMap<Row, number>(), other: entityMap<Row, number>(), n: 0 },
    {
      enhancers:
        order === undefined
          ? [tx]
          : order === 'restoration-only'
          ? [history]
          : order === 'transactions-first'
          ? [tx, history]
          : [history, tx],
    }
  );
  cleanups.push(() => tree.destroy());
  return tree;
};
const inventory = (rows: unknown) => rows as Inventory;
const subject = (rows: unknown, id = 1) =>
  inventory(rows).__acquireEntityHandleForTesting(id).subjectId;

describe('post-capture subject reclamation', () => {
  it('reclaims repeated rolled-back population while the empty tree stays alive', async () => {
    const tree = make();
    for (let cycle = 0; cycle < 3; cycle++) {
      const pending = tree.transaction(() =>
        tree.$.rows.setAll(
          Array.from({ length: 10 }, (_, id) => ({ id, value: cycle }))
        )
      );
      const ids = tree.$.rows.ids().map((id) => subject(tree.$.rows, id));
      await flush();
      expect(getSubjectRestorationClaims(tree)?.snapshot()).toEqual({
        owners: 1,
        claimedSubjects: 10,
      });
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toEqual([]);
      expect(getSubjectRestorationClaims(tree)?.snapshot()).toEqual({
        owners: 0,
        claimedSubjects: 0,
      });
      expect(
        inventory(tree.$.rows).__listSubjectReclamationCandidates()
      ).toEqual([]);
      for (const id of ids)
        expect(
          inventory(tree.$.rows).__inspectSubjectResources(id)
        ).toBeUndefined();
    }
  });

  it.each([
    undefined,
    'transactions-first',
    'restoration-first',
    'restoration-only',
  ] as const)(
    'reclaims never-claimed ordinary churn with %s',
    async (order) => {
      const tree = make(order);
      for (let cycle = 0; cycle < 3; cycle++) {
        tree.$.rows.addOne({ id: 1, value: cycle });
        await flush();
        const id = subject(tree.$.rows);
        tree.$.rows.removeOne(1);
        await flush();
        expect(tree.$.rows.ids()).toEqual([]);
        expect(
          inventory(tree.$.rows).__inspectSubjectResources(id)
        ).toBeUndefined();
      }
    }
  );

  it.each(['transactions-first', 'restoration-first'] as const)(
    'preserves pre-flush removal, undo and redo with %s',
    async (order) => {
      const tree = make(order);
      tree
        .transaction(() => tree.$.rows.addOne({ id: 1, value: 10 }))
        .confirm();
      const id = subject(tree.$.rows);
      undoable(() => tree.$.rows.removeOne(1));
      expect(getSubjectRestorationClaims(tree)?.isClaimed(id)).toBe(false);
      await flush();
      expect(getSubjectRestorationClaims(tree)?.isClaimed(id)).toBe(true);
      expect(
        inventory(tree.$.rows).__inspectSubjectResources(id)
      ).toBeDefined();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toEqual([{ id: 1, value: 10 }]);
      expect(subject(tree.$.rows)).toBe(id);
      tree.redo();
      await flush();
      expect(tree.$.rows.ids()).toEqual([]);
      expect(
        inventory(tree.$.rows).__inspectSubjectResources(id)
      ).toBeDefined();
      tree.resetRestorationHistory();
      await flush();
      expect(
        inventory(tree.$.rows).__inspectSubjectResources(id)
      ).toBeUndefined();
    }
  );

  it('keeps pending owners across colliding collection-local IDs', async () => {
    const tree = make();
    tree.$.rows.addOne({ id: 1, value: 10 });
    tree.$.other.addOne({ id: 1, value: 20 });
    await flush();
    const id = subject(tree.$.rows);
    expect(subject(tree.$.other)).toBe(id);
    const a = tree.transaction(() => tree.$.rows.removeOne(1));
    const b = tree.transaction(() => tree.$.other.removeOne(1));
    a.confirm();
    await flush();
    expect(inventory(tree.$.rows).__inspectSubjectResources(id)).toBeDefined();
    expect(inventory(tree.$.other).__inspectSubjectResources(id)).toBeDefined();
    b.rollback();
    await flush();
    expect(tree.$.other.all()).toEqual([{ id: 1, value: 20 }]);
    expect(
      inventory(tree.$.rows).__inspectSubjectResources(id)
    ).toBeUndefined();
    expect(subject(tree.$.other)).toBe(id);
  });

  it('defers past reentrant onFlush writes until their restoration capture', async () => {
    const tree = make('transactions-first');
    tree.$.rows.addOne({ id: 1, value: 10 });
    await flush();
    const id = subject(tree.$.rows);
    const pending = tree.transaction(() =>
      tree.$.rows.updateOne(1, { value: 20 })
    );
    let armed = true;
    cleanups.push(
      getPathNotifier().onFlush(() => {
        if (!armed) return;
        armed = false;
        pending.confirm();
        undoable(() => tree.$.rows.removeOne(1));
      })
    );
    tree.$.n(1);
    await flush();
    expect(armed).toBe(false);
    expect(getSubjectRestorationClaims(tree)?.isClaimed(id)).toBe(true);
    tree.undo();
    await flush();
    expect(tree.$.rows.all()).toEqual([{ id: 1, value: 20 }]);
  });

  it('does not hold unrelated retired rows behind a pending scalar transaction', async () => {
    const tree = make(),
      scalar = tree.transaction(() => tree.$.n(1));
    for (let i = 0; i < 5; i++) {
      const pending = tree.transaction(() =>
        tree.$.rows.addOne({ id: 1, value: i })
      );
      pending.rollback();
      await flush();
      expect(
        inventory(tree.$.rows).__listSubjectReclamationCandidates()
      ).toEqual([]);
    }
    scalar.rollback();
    expect(tree.$.n()).toBe(0);
  });

  it('cancels queued physical work on destruction', async () => {
    const tree = make();
    tree.$.rows.addOne({ id: 1, value: 10 });
    await flush();
    const rows = tree.$.rows as unknown as {
      __prepareSubjectReclamation: (...args: unknown[]) => unknown;
    };
    const prepare = vi.spyOn(rows, '__prepareSubjectReclamation');
    try {
      tree.$.rows.removeOne(1);
      tree.destroy();
      await flush();
      expect(prepare).not.toHaveBeenCalled();
    } finally {
      prepare.mockRestore();
    }
  });

  it('preserves v15 refusal ownership after an observer throws until explicit confirmation', async () => {
    const tree = make(),
      notifier = getPathNotifier();
    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 1, value: 10 })
    );
    const id = subject(tree.$.rows);
    notifier.setBatchingEnabled(false);
    const off = notifier.subscribe(
      '**',
      (_next, _prev, _path, _owner, origin) => {
        if (origin === 'transaction-rollback') throw undefined;
      }
    );
    try {
      let threw = false;
      try {
        pending.rollback();
      } catch (error) {
        threw = true;
        expect(error).toMatchObject({ code: 'SIGNALTREE_ROLLBACK_FAILED' });
      }
      expect(threw).toBe(true);
    } finally {
      off();
      notifier.setBatchingEnabled(true);
    }
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);
    expect(getSubjectRestorationClaims(tree)?.isClaimed(id)).toBe(true);
    expect(inventory(tree.$.rows).__inspectSubjectResources(id)).toBeDefined();
    pending.confirm();
    await flush();
    expect(
      inventory(tree.$.rows).__inspectSubjectResources(id)
    ).toBeUndefined();
  });

  it('wires nested collections through the registry callback installed by the enhancer', async () => {
    const tree = signalTree(
      { nested: { rows: entityMap<Row, number>() } },
      { enhancers: [transactions()] }
    );
    cleanups.push(() => tree.destroy());
    const rows = tree.$.nested.rows;
    rows.addOne({ id: 1, value: 10 });
    await flush();
    const id = subject(rows);
    rows.removeOne(1);
    await flush();
    expect(inventory(rows).__inspectSubjectResources(id)).toBeUndefined();
  });

  it('keeps old handles isolated after reclaim and same-key re-add', async () => {
    const tree = make();
    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 1, value: 10 })
    );
    const old = tree.$.rows.byIdOrFail(1),
      oldField = old.value,
      id = subject(tree.$.rows);
    pending.rollback();
    await flush();
    expect(
      inventory(tree.$.rows).__inspectSubjectResources(id)
    ).toBeUndefined();
    tree.$.rows.addOne({ id: 1, value: 20 });
    await flush();
    expect(subject(tree.$.rows)).not.toBe(id);
    expect(old()).toBeUndefined();
    expect(oldField()).toBeUndefined();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(20);
  });
});
