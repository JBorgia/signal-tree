import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A write made from inside an add — by a tap — lands where it would after the
 * call, and undo, redo and rollback put every row back exactly.
 *
 * TAPS. `prependMany` was `addMany` followed by a move to the front, and
 * `prependOne` was `addOne` followed by the same move. The taps ran between
 * the two, so they saw the new rows at the END, and a row a tap added was
 * anchored next to rows that were about to move:
 *
 * - a nested `addOne` / `upsertMany` / `prependOne` anchored to that transient
 *   order, so redo put it in the wrong place;
 * - a nested `prependMany` emptied the shared `appendedAdds` list the outer
 *   call was about to re-anchor, so redo threw ("contradictory anchors");
 * - a nested `addMany` only worked because it pushed into that same list.
 *
 * The rows now move before any tap runs, and every fresh row is anchored to its
 * neighbours in the committed order. A tap sees the call's result, so its own
 * writes apply after it: the expected order below is `nested(outer(seed))`.
 *
 * INTERCEPTORS. They run before the call writes, so their writes apply first:
 * `outer(nested(seed))`. `addMany`, `upsertMany` and `addOne` read the last
 * row as their first anchor BEFORE the interceptors ran, so a row an
 * interceptor appended was skipped over: redo put the call's rows ahead of it.
 * (Had the interceptor removed that last row, the anchor lookup would have
 * allocated a subject for a key no longer present.) Anchors are now read from
 * the committed order, after every interceptor.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const SEEDED = ['z', 'a'];
const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  await flush();
};

type Op = {
  run: (tree: Tree) => unknown;
  /** The order this op produces from `ids`. */
  order: (ids: string[]) => string[];
};
const front = (rows: string[]) => (ids: string[]) => [...rows, ...ids];
const back = (rows: string[]) => (ids: string[]) => [...ids, ...rows];

const outers: Record<string, Op> = {
  prependMany: {
    run: (tree) =>
      tree.$.rows.prependMany([
        { id: 'x', n: 1 },
        { id: 'y', n: 2 },
      ]),
    order: front(['x', 'y']),
  },
  prependOne: {
    run: (tree) => tree.$.rows.prependOne({ id: 'x', n: 1 }),
    order: front(['x']),
  },
  addMany: {
    run: (tree) =>
      tree.$.rows.addMany([
        { id: 'x', n: 1 },
        { id: 'y', n: 2 },
      ]),
    order: back(['x', 'y']),
  },
  upsertMany: {
    run: (tree) =>
      tree.$.rows.upsertMany([
        { id: 'x', n: 1 },
        { id: 'y', n: 2 },
      ]),
    order: back(['x', 'y']),
  },
  addOne: {
    run: (tree) => tree.$.rows.addOne({ id: 'x', n: 1 }),
    order: back(['x']),
  },
};
const nesteds: Record<string, Op> = {
  addOne: { run: (t) => t.$.rows.addOne({ id: 'r', n: 7 }), order: back(['r']) },
  addMany: {
    run: (t) => t.$.rows.addMany([{ id: 'r', n: 7 }]),
    order: back(['r']),
  },
  upsertMany: {
    run: (t) => t.$.rows.upsertMany([{ id: 'r', n: 7 }]),
    order: back(['r']),
  },
  prependOne: {
    run: (t) => t.$.rows.prependOne({ id: 'r', n: 7 }),
    order: front(['r']),
  },
  prependMany: {
    run: (t) => t.$.rows.prependMany([{ id: 'r', n: 7 }]),
    order: front(['r']),
  },
};

const combos = Object.keys(outers).flatMap((outer) =>
  Object.keys(nesteds).map((nested) => [outer, nested] as const)
);

/** Installs a tap that runs `nested` once, when the outer call adds `x`. */
const nestInTap = (tree: Tree, nested: string) => {
  let fired = false;
  tree.$.rows.tap({
    onAdd: (row) => {
      if (fired || row.id !== 'x') return;
      fired = true;
      nesteds[nested].run(tree);
    },
  });
};
const expectedInTap = (outer: string, nested: string) =>
  nesteds[nested].order(outers[outer].order(SEEDED));

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a write from a tap: undo/redo/jumpTo (%s)', (_name, enhancers) => {
  it.each(combos)(
    '%s, tap writes %s: forward, undo, redo, undo, jumpTo exact',
    async (outer, nested) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        nestInTap(tree, nested);
        undoable(() => outers[outer].run(tree));
        await flush();
        const forward = expectedInTap(outer, nested);
        expect(tree.$.rows.ids()).toStrictEqual(forward);
        tree.undo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(forward);
        tree.undo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
        tree.jumpTo(tree.getRestorationHistory().length - 1);
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(forward);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a write from a tap: rollback (%s)', (_name, enhancers) => {
  it.each(combos)(
    '%s, tap writes %s: forward, then rollback exact',
    async (outer, nested) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        nestInTap(tree, nested);
        const pending = tree.transaction(() => outers[outer].run(tree));
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(expectedInTap(outer, nested));
        pending.rollback();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );
});

/** Installs an interceptor that runs `nested` once, before `x` is added. */
const nestInInterceptor = (tree: Tree, nested: string) => {
  let fired = false;
  tree.$.rows.intercept({
    onAdd: (row) => {
      if (fired || row.id !== 'x') return;
      fired = true;
      nesteds[nested].run(tree);
    },
  });
};
const expectedInInterceptor = (outer: string, nested: string) =>
  outers[outer].order(nesteds[nested].order(SEEDED));

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'a write from an interceptor: undo/redo/jumpTo (%s)',
  (_name, enhancers) => {
    it.each(combos)(
      '%s, interceptor writes %s: forward, undo, redo, undo, jumpTo exact',
      async (outer, nested) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          nestInInterceptor(tree, nested);
          undoable(() => outers[outer].run(tree));
          await flush();
          const forward = expectedInInterceptor(outer, nested);
          expect(tree.$.rows.ids()).toStrictEqual(forward);
          tree.undo();
          await flush();
          expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
          tree.redo();
          await flush();
          expect(tree.$.rows.ids()).toStrictEqual(forward);
          tree.undo();
          await flush();
          expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
          tree.jumpTo(tree.getRestorationHistory().length - 1);
          await flush();
          expect(tree.$.rows.ids()).toStrictEqual(forward);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a write from an interceptor: rollback (%s)', (_name, enhancers) => {
  it.each(combos)(
    '%s, interceptor writes %s: forward, then rollback exact',
    async (outer, nested) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        nestInInterceptor(tree, nested);
        const pending = tree.transaction(() => outers[outer].run(tree));
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(
          expectedInInterceptor(outer, nested)
        );
        pending.rollback();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('an interceptor that removes the last row', () => {
  it.each([
    ['addMany', (tree: Tree) => tree.$.rows.addMany([{ id: 'x', n: 1 }])],
    ['upsertMany', (tree: Tree) => tree.$.rows.upsertMany([{ id: 'x', n: 1 }])],
    ['addOne', (tree: Tree) => tree.$.rows.addOne({ id: 'x', n: 1 })],
  ] as const)(
    '%s: no row comes back, and undo/redo are exact',
    async (_api, act) => {
      const tree = make([restoration()]);
      try {
        await seed(tree);
        let fired = false;
        tree.$.rows.intercept({
          onAdd: () => {
            if (fired) return;
            fired = true;
            tree.$.rows.removeOne('a');
          },
        });
        undoable(() => act(tree));
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'x']);
        expect(tree.$.rows.count()).toBe(2);
        tree.undo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'x']);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('a tap sees the call it observes', () => {
  it.each([
    ['prependMany', (tree: Tree) => tree.$.rows.prependMany([{ id: 'x', n: 1 }])],
    ['prependOne', (tree: Tree) => tree.$.rows.prependOne({ id: 'x', n: 1 })],
  ] as const)('%s: the row is already at the front', async (_api, act) => {
    const tree = make([]);
    try {
      await seed(tree);
      const seen: string[][] = [];
      tree.$.rows.tap({ onAdd: () => seen.push([...tree.$.rows.ids()]) });
      act(tree);
      expect(seen).toStrictEqual([['x', 'z', 'a']]);
    } finally {
      tree.destroy();
    }
  });
});
