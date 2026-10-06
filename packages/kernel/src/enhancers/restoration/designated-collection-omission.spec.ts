import { afterEach, describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';
import { restorationReader } from '../../internals';
import { createReactiveTestRealization } from '../../reactive-test-realization';
import { createSignalTreeFactory } from '../../lib/signal-tree';

/**
 * v16 integration slice 8d (b): reversing a designated omission of an entity
 * collection itself.
 *
 * A whole-value write that leaves out a collection key omits the collection,
 * as it omits any member. Before 8d its membership change was observed but
 * never recorded, so undo, redo, jumpTo and rollback of that write reported
 * success and left the collection omitted (`probe3.txt`). Owner instruction:
 * restore it fully, or refuse with a typed, informative error if that is
 * impossible; nothing silent.
 *
 * A collection is retained whole while omitted, so re-adding it restores it
 * exactly when its retained rows still equal the recorded before-image. A
 * write through a handle held on the omitted collection can change them;
 * re-adding it would then bring back rows the reversed operation never had
 * ("DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE"), so the reversal
 * refuses and changes nothing.
 */

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const historyOrders = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};

type Row = { id: string; n: number };
type Rows = {
  addOne(row: Row): void;
  updateOne(id: string, changes: Partial<Row>): void;
  all(): Row[];
};
type Tree = {
  $: ((value?: unknown) => unknown) & {
    count: (value?: number) => number;
    g: ((value?: unknown) => unknown) & { rows: Rows; k: (v?: number) => number };
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  transact(run: () => void): { rollback(): void; confirm(): void };
  destroy(): void;
};

const realization = createReactiveTestRealization();
const reactiveTree = createSignalTreeFactory(realization);
const computed = realization.locations.createDerived;

const build = (enhancers: unknown[], reactive = false): Tree => {
  const make = reactive ? reactiveTree : signalTree;
  const tree = make(
    { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
    { enhancers: enhancers as never }
  ) as unknown as Tree;
  trees.push(tree);
  tree.$.g.rows.addOne({ id: 'a', n: 0 });
  return tree;
};
const withRows = { g: { rows: { all: [{ id: 'a', n: 0 }] }, k: 0 }, count: 0 };

// `g` stays; only `rows` is left out of `g`'s whole value.
const shapes = {
  'nested, by a branch write': (t: Tree) => t.$.g({ k: 0 }),
  'nested, with another change': (t: Tree) => {
    t.$.g({ k: 0 });
    t.$.count(1);
  },
};

describe('undo, redo and jumpTo of a designated collection omission', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const [shape, omit] of Object.entries(shapes))
      it(`restore the collection fully (${shape}, ${order})`, async () => {
        const tree = build(enhancers());
        await flush();
        undoable(() => tree.$.count(5));
        await flush();
        const before = { ...withRows, count: 5 };
        undoable(() => omit(tree));
        await flush();
        const omitted = tree.$();
        expect(omitted).not.toHaveProperty('g.rows');

        tree.undo();
        expect(tree.$()).toEqual(before);
        expect(tree.$.g.rows.all()).toEqual([{ id: 'a', n: 0 }]);
        tree.redo();
        expect(tree.$()).toEqual(omitted);
        const index = tree.getCurrentIndex();
        tree.jumpTo(index - 1);
        expect(tree.$()).toEqual(before);
        tree.jumpTo(index);
        expect(tree.$()).toEqual(omitted);
        tree.undo();
        expect(tree.$()).toEqual(before);
      });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a root collection omitted by a root write is restored (${order})`, async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>(), count: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree & { $: { rows: Rows } };
      trees.push(tree);
      tree.$.rows.addOne({ id: 'a', n: 0 });
      await flush();
      undoable(() => tree.$({ count: 1 }));
      await flush();
      expect(tree.$()).toEqual({ count: 1 });
      tree.undo();
      expect(tree.$()).toEqual({ rows: { all: [{ id: 'a', n: 0 }] }, count: 0 });
      tree.redo();
      expect(tree.$()).toEqual({ count: 1 });
    });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a held consumer of the tree follows the restored collection (${order})`, async () => {
      const tree = build(enhancers(), true);
      await flush();
      const whole = computed(() => JSON.stringify(tree.$()));
      undoable(() => tree.$.g({ k: 0 }));
      await flush();
      expect(whole()).toBe('{"g":{"k":0},"count":0}');
      tree.undo();
      expect(JSON.parse(whole())).toEqual(withRows);
      tree.redo();
      expect(whole()).toBe('{"g":{"k":0},"count":0}');
    });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a designated re-add of a collection is undone and redone (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      // An ordinary omission, then a designated whole value that re-adds the
      // collection with new rows.
      tree.$.g({ k: 0 });
      await flush();
      undoable(() => tree.$.g({ k: 0, rows: [{ id: 'z', n: 9 }] }));
      await flush();
      const readded = { g: { rows: { all: [{ id: 'z', n: 9 }] }, k: 0 }, count: 0 };
      expect(tree.$()).toEqual(readded);
      tree.undo();
      expect(tree.$()).toEqual({ g: { k: 0 }, count: 0 });
      tree.redo();
      expect(tree.$()).toEqual(readded);
    });
});

describe('rows written while the collection is present are its own', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a redo that omits it again keeps them for the next undo (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      undoable(() => tree.$.g({ k: 0 }));
      await flush();
      tree.undo();
      // An ordinary write while the collection is present: its own state.
      tree.$.g.rows.updateOne('a', { n: 7 });
      await flush();
      tree.redo();
      expect(tree.$()).toEqual({ g: { k: 0 }, count: 0 });
      tree.undo();
      expect(tree.$()).toEqual({
        g: { rows: { all: [{ id: 'a', n: 7 }] }, k: 0 },
        count: 0,
      });
    });
});

describe("the reversal's own row writes are not a change to refuse", () => {
  // A write through a held handle inside the same operation that omitted the
  // collection is that operation's own effect: reversing it restores the row,
  // so the collection comes back exactly as it was.
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo of an omission that also wrote a row (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      undoable(() => {
        tree.$.g({ k: 0 });
        rows.updateOne('a', { n: 5 });
      });
      await flush();
      tree.undo();
      expect(tree.$()).toEqual(withRows);
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback of an omission that also wrote a row (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => {
        tree.$.g({ k: 1 });
        rows.updateOne('a', { n: 5 });
      });
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual(withRows);
    });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a later write to another row is still refused (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      rows.addOne({ id: 'b', n: 0 });
      await flush();
      undoable(() => {
        tree.$.g({ k: 0 });
        rows.updateOne('a', { n: 5 });
      });
      await flush();
      rows.updateOne('b', { n: 9 });
      await flush();
      expect(() => tree.undo()).toThrow(/'g\.rows'.*changed after that/);
    });
});

describe('a collection changed while omitted is refused, typed and unchanged', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo refuses and names the collection (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      undoable(() => tree.$.g({ k: 0 }));
      await flush();
      // An ordinary write through a held handle changes the retained rows.
      rows.updateOne('a', { n: 7 });
      await flush();
      const index = tree.getCurrentIndex();
      let error: unknown;
      try {
        tree.undo();
      } catch (caught) {
        error = caught;
      }
      expect((error as Error | undefined)?.message).toMatch(
        /^Unsupported scoped undo effect at 'g\.rows': the entity collection was omitted and changed after that, so re-adding it would not restore it as it was\. Nothing was changed; the history position is unmoved\.$/
      );
      expect(tree.$()).toEqual({ g: { k: 0 }, count: 0 });
      expect(tree.getCurrentIndex()).toBe(index);
    });

  it('the refusal is reported as refused by the restoration reader', async () => {
    const tree = build([restoration()]);
    await flush();
    const reader = restorationReader(
      tree as unknown as Parameters<typeof restorationReader>[0]
    )!;
    undoable(() => tree.$.g({ k: 0 }));
    await flush();
    tree.$.g.rows.updateOne('a', { n: 7 });
    await flush();
    const events: unknown[] = [];
    reader.subscribe((event) => events.push(event));
    expect(() => tree.undo()).toThrow(/'g\.rows'/);
    expect(events.at(-1)).toMatchObject({
      kind: 'operation',
      operation: 'undo',
      outcome: 'refused',
      affectedEntryIds: [],
    });
  });
});

describe('a collection under a branch the reversal re-adds', () => {
  // The collection is not itself omitted, but it is hidden with its branch
  // and becomes current again when the branch is re-added (review of
  // 370d2f48). The same rule applies: restored fully, or refused.
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`undo of the branch omission restores it (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      undoable(() => tree.$({ count: 1 }));
      await flush();
      expect(tree.$()).toEqual({ count: 1 });
      tree.undo();
      expect(tree.$()).toEqual(withRows);
    });

    it(`a write to its rows while hidden refuses the undo (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      undoable(() => tree.$({ count: 1 }));
      await flush();
      rows.addOne({ id: 'z', n: 9 });
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(
        /^Unsupported scoped undo effect at 'g\.rows': the entity collection was omitted and changed after that/
      );
      expect(tree.$()).toEqual({ count: 1 });
      expect(tree.getCurrentIndex()).toBe(index);
    });

    it(`a re-add for an earlier turn refuses too (ordinary omission) (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      undoable(() => tree.$.g.k(1));
      await flush();
      // An ordinary omission, then a write through the held handle.
      tree.$({ count: 0 });
      await flush();
      rows.addOne({ id: 'z', n: 9 });
      await flush();
      expect(() => tree.undo()).toThrow(/'g\.rows'.*changed after that/);
      expect(tree.$()).toEqual({ count: 0 });
    });
  }

  for (const [order, enhancers] of Object.entries(rollbackOrders)) {
    it(`rollback of the branch omission restores it (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const pending = tree.transact(() => tree.$({ count: 1 }));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual(withRows);
    });

    it(`a plain write to its rows while hidden refuses the rollback (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => tree.$({ count: 1 }));
      await flush();
      rows.addOne({ id: 'z', n: 9 });
      await flush();
      let error: unknown;
      try {
        pending.rollback();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'SIGNALTREE_ROLLBACK_FAILED' });
      expect((error as Error).message).toContain(
        "the entity collection at 'g.rows' was omitted and changed after that"
      );
      expect(tree.$()).toEqual({ count: 1 });
    });

    it(`the transaction's own row write is undone with the omission (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => {
        tree.$({ count: 1 });
        rows.addOne({ id: 'z', n: 9 });
      });
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual(withRows);
    });
  }

  for (const [order, enhancers] of Object.entries(historyOrders).filter(
    ([name]) => name !== 'restoration alone'
  ))
    it(`rows a rollback compensates while hidden are expected by a later undo (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => rows.addOne({ id: 'b', n: 1 }));
      await flush();
      undoable(() => tree.$({ count: 1 }));
      await flush();
      pending.rollback();
      await flush();
      tree.undo();
      expect(tree.$()).toEqual(withRows);
    });
});

describe('rollback of a collection omission', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`restores the collection (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const pending = tree.transact(() => tree.$.g({ k: 1 }));
      await flush();
      expect(tree.$()).toEqual({ g: { k: 1 }, count: 0 });
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual(withRows);
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`refuses, typed, when a plain write added a row while omitted (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => tree.$.g({ k: 1 }));
      await flush();
      rows.addOne({ id: 'z', n: 9 });
      await flush();
      let error: unknown;
      try {
        pending.rollback();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'SIGNALTREE_ROLLBACK_FAILED' });
      expect(tree.$()).toEqual({ g: { k: 1 }, count: 0 });
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`refuses, typed, when the collection changed while omitted (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => tree.$.g({ k: 1 }));
      await flush();
      // A later write to the omitted collection depends on the omission the
      // rollback would reverse: the existing dependency refusal.
      rows.updateOne('a', { n: 7 });
      await flush();
      let error: unknown;
      try {
        pending.rollback();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'SIGNALTREE_ROLLBACK_FAILED' });
      expect((error as Error).message).toMatch(/later-confirmed-dependency/);
      expect(tree.$()).toEqual({ g: { k: 1 }, count: 0 });
      // Refused, not settled: the transaction can still be confirmed.
      pending.confirm();
      expect(tree.$()).toEqual({ g: { k: 1 }, count: 0 });
    });

  for (const [order, enhancers] of Object.entries(historyOrders).filter(
    ([name]) => name !== 'restoration alone'
  ))
    it(`a rolled-back row does not come back when undo re-adds the collection (${order})`, async () => {
      const tree = build(enhancers());
      await flush();
      const rows = tree.$.g.rows;
      const pending = tree.transact(() => rows.addOne({ id: 'b', n: 1 }));
      await flush();
      undoable(() => tree.$.g({ k: 0 }));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual({ g: { k: 0 }, count: 0 });
      tree.undo();
      // "Nothing a rejected transaction wrote can come back later" (8c).
      expect(tree.$()).toEqual(withRows);
    });
});
