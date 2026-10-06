import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * An add call refuses, before writing anything, when one of its interceptors
 * (or id selectors) changed the same collection's membership, keys or order —
 * the rule `setAll` already enforces (README, 15.4.0: "Prefer interceptors that
 * validate or transform input instead of changing the same collection's
 * topology"). The callback's own writes stand; field-only writes are allowed.
 *
 * Each call planned which of its ids exist, their subjects and its anchors
 * against the collection as it entered, so a topology change underneath left
 * that plan stale:
 *
 * - an interceptor adding the call's own id: two rows under one key;
 * - one removing a row an overwrite replaces: the call returned the id and the
 *   write was lost (`addMany([{ id: 'a' }], { mode: 'overwrite' })` -> ids
 *   `['b']`), prependMany the same;
 * - one removing the collection's last row: the row came back as an empty
 *   member (until ad275e33);
 * - one adding another row: misplaced on redo (until ad275e33).
 *
 * An updated row merges over its value as the interceptors left it, so an
 * interceptor's field write to the row it is upserting is kept.
 */
type Row = { id: string; n: number; p?: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[] = []): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const outers: Record<string, (tree: Tree) => unknown> = {
  addMany: (tree) =>
    tree.$.rows.addMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]),
  'addMany overwrite of an existing row': (tree) =>
    tree.$.rows.addMany([{ id: 'a', n: 9 }], { mode: 'overwrite' }),
  prependMany: (tree) =>
    tree.$.rows.prependMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]),
  'prependMany overwrite of an existing row': (tree) =>
    tree.$.rows.prependMany([{ id: 'a', n: 9 }], { mode: 'overwrite' }),
  prependOne: (tree) => tree.$.rows.prependOne({ id: 'x', n: 1 }),
  upsertMany: (tree) =>
    tree.$.rows.upsertMany([
      { id: 'x', n: 1 },
      { id: 'a', n: 9 },
    ]),
  addOne: (tree) => tree.$.rows.addOne({ id: 'x', n: 1 }),
};
const method = (outer: string) => outer.split(' ')[0];

type Nested = {
  run: (tree: Tree) => void;
  after: Row[];
  /** For a key change: only the calls that name the renamed key. */
  appliesTo?: (outer: string) => boolean;
};
const namesX = (outer: string) => !outer.includes('overwrite');
const namesA = (outer: string) =>
  outer.includes('overwrite') || outer === 'upsertMany';
const structural: Record<string, Nested> = {
  'appends another row': {
    run: (tree) => tree.$.rows.addOne({ id: 'r', n: 7 }),
    after: [...SEEDED, { id: 'r', n: 7 }],
  },
  'prepends another row': {
    run: (tree) => tree.$.rows.prependMany([{ id: 'r', n: 7 }]),
    after: [{ id: 'r', n: 7 }, ...SEEDED],
  },
  'upserts another row': {
    run: (tree) => tree.$.rows.upsertMany([{ id: 'r', n: 7 }]),
    after: [...SEEDED, { id: 'r', n: 7 }],
  },
  'removes the last row': {
    run: (tree) => tree.$.rows.removeOne('a'),
    after: [{ id: 'z', n: 0 }],
  },
  "adds the call's own id": {
    run: (tree) => tree.$.rows.addOne({ id: 'x', n: 77 }),
    after: [...SEEDED, { id: 'x', n: 77 }],
  },
  "renames a row to the call's own id": {
    run: (tree) => tree.$.rows.changeId('z', 'x'),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 1 },
    ],
    appliesTo: namesX,
  },
  'renames away the row the call names': {
    run: (tree) => tree.$.rows.changeId('a', 'q'),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 1 },
    ],
    appliesTo: namesA,
  },
};
// changeId keeps the row's value (its `id` field is not rewritten) and place.
const idsAfter: Record<string, string[]> = {
  "renames a row to the call's own id": ['x', 'a'],
  'renames away the row the call names': ['z', 'q'],
};

/** An interceptor that runs `nested` once, on the call's first add or update. */
const nestInInterceptor = (tree: Tree, nested: () => void) => {
  let fired = false;
  const once = () => {
    if (fired) return;
    fired = true;
    nested();
  };
  tree.$.rows.intercept({ onAdd: once, onUpdate: once });
};

const combos = Object.keys(outers).flatMap((outer) =>
  Object.keys(structural)
    .filter((nested) => structural[nested].appliesTo?.(outer) ?? true)
    .map((nested) => [outer, nested] as const)
);

describe('an interceptor changing the topology: refused before writing', () => {
  it.each(combos)(
    '%s, interceptor %s: throws, writes nothing, the callback write stands',
    async (outer, nested) => {
      const tree = make();
      try {
        await seed(tree);
        let taps = 0;
        tree.$.rows.tap({ onAdd: () => taps++, onUpdate: () => taps++ });
        nestInInterceptor(tree, () => structural[nested].run(tree));
        const tapsBefore = taps;
        expect(() => outers[outer](tree)).toThrow(
          `Cannot ${method(outer)}: collection topology changed during staging`
        );
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(structural[nested].after);
        expect(tree.$.rows.ids()).toStrictEqual(
          idsAfter[nested] ?? structural[nested].after.map((row) => row.id)
        );
        expect(tree.$.rows.count()).toBe(structural[nested].after.length);
        // Only the nested write tapped; the refused call tapped nothing.
        expect(taps - tapsBefore).toBeLessThanOrEqual(1);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a refused call: undo/redo of the callback write (%s)', (_name, enhancers) => {
  it.each(combos)('%s, interceptor %s', async (outer, nested) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      nestInInterceptor(tree, () => structural[nested].run(tree));
      undoable(() => {
        expect(() => outers[outer](tree)).toThrow(/topology changed/);
      });
      await flush();
      const after = structural[nested].after;
      expect(tree.$.rows.all()).toStrictEqual(after);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(after);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a refused call: rollback (%s)', (_name, enhancers) => {
  it.each(combos)('%s, interceptor %s', async (outer, nested) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      nestInInterceptor(tree, () => structural[nested].run(tree));
      const pending = tree.transaction(() => {
        expect(() => outers[outer](tree)).toThrow(/topology changed/);
      });
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(structural[nested].after);
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
    } finally {
      tree.destroy();
    }
  });
});

const fieldOnly: Record<string, Row[]> = {
  addMany: [
    { id: 'z', n: 42 },
    { id: 'a', n: 1 },
    { id: 'x', n: 1 },
    { id: 'y', n: 2 },
  ],
  'addMany overwrite of an existing row': [
    { id: 'z', n: 42 },
    { id: 'a', n: 9 },
  ],
  prependMany: [
    { id: 'x', n: 1 },
    { id: 'y', n: 2 },
    { id: 'z', n: 42 },
    { id: 'a', n: 1 },
  ],
  'prependMany overwrite of an existing row': [
    { id: 'a', n: 9 },
    { id: 'z', n: 42 },
  ],
  prependOne: [
    { id: 'x', n: 1 },
    { id: 'z', n: 42 },
    { id: 'a', n: 1 },
  ],
  upsertMany: [
    { id: 'z', n: 42 },
    { id: 'a', n: 9 },
    { id: 'x', n: 1 },
  ],
  addOne: [
    { id: 'z', n: 42 },
    { id: 'a', n: 1 },
    { id: 'x', n: 1 },
  ],
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a field-only interceptor write is allowed (%s)', (_name, enhancers) => {
  it.each(Object.keys(outers))(
    '%s: proceeds; undo, redo, undo exact',
    async (outer) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        nestInInterceptor(tree, () => tree.$.rows.updateOne('z', { n: 42 }));
        undoable(() => outers[outer](tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(fieldOnly[outer]);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(fieldOnly[outer]);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('a key change the call does not depend on is not refused', () => {
  it('addMany proceeds when an interceptor renames an unrelated row', async () => {
    const tree = make();
    try {
      await seed(tree);
      nestInInterceptor(tree, () => tree.$.rows.changeId('z', 'q'));
      expect(tree.$.rows.addMany([{ id: 'x', n: 1 }])).toStrictEqual(['x']);
      expect(tree.$.rows.ids()).toStrictEqual(['q', 'a', 'x']);
    } finally {
      tree.destroy();
    }
  });
});

describe('upsertMany merges over the row as its interceptors left it', () => {
  it.each([
    ['no enhancers', () => []],
    ['restoration()', () => [restoration()]],
    ['transactions(), restoration()', () => [transactions(), restoration()]],
  ] as const)('%s: a field the interceptor wrote is kept', async (_name, enhancers) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      nestInInterceptor(tree, () => tree.$.rows.updateOne('a', { p: 1 }));
      tree.$.rows.upsertMany([{ id: 'a', n: 5 }]);
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'z', n: 0 },
        { id: 'a', n: 5, p: 1 },
      ]);
    } finally {
      tree.destroy();
    }
  });
});

describe('an id selector changing the topology', () => {
  it.each([
    ['addMany', (tree: Tree, selectId: (row: Row) => string) =>
      tree.$.rows.addMany([{ id: 'x', n: 1 }], { selectId })],
    ['prependMany', (tree: Tree, selectId: (row: Row) => string) =>
      tree.$.rows.prependMany([{ id: 'x', n: 1 }], { selectId })],
    ['prependOne', (tree: Tree, selectId: (row: Row) => string) =>
      tree.$.rows.prependOne({ id: 'x', n: 1 }, { selectId })],
    ['upsertMany', (tree: Tree, selectId: (row: Row) => string) =>
      tree.$.rows.upsertMany([{ id: 'x', n: 1 }], { selectId })],
    ['addOne', (tree: Tree, selectId: (row: Row) => string) =>
      tree.$.rows.addOne({ id: 'x', n: 1 }, { selectId })],
  ] as const)('%s: refused, as setAll refuses', async (api, act) => {
    const tree = make();
    try {
      await seed(tree);
      let fired = false;
      const selectId = (row: Row) => {
        if (!fired) {
          fired = true;
          tree.$.rows.removeOne('a');
        }
        return row.id;
      };
      expect(() => act(tree, selectId)).toThrow(
        `Cannot ${api}: collection topology changed during staging`
      );
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'z', n: 0 }]);
    } finally {
      tree.destroy();
    }
  });
});
