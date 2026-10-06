import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A batch call that names one id more than once runs its INTERCEPTORS once per
 * copy, in input order, exactly as successive single calls would (owner rule
 * for 15.4.4: a call behaves as if its rows were applied one at a time):
 *
 *   addMany / prependMany overwrite  onAdd for every copy; the last
 *                                    intercepted value wins
 *                         skip       only the first copy is intercepted
 *                         strict     throws before any interceptor runs
 *   upsertMany                       onAdd for a new id's first copy, then
 *                                    onUpdate for each later copy (the raw
 *                                    copy), merged over the running value;
 *                                    onUpdate for every copy of an existing id
 *
 * 778f86ef ran them once per DISTINCT id: overwrite intercepted only the last
 * copy and upsertMany only the merged copy, so a transform or a block that
 * successive calls would apply to an earlier copy never ran.
 *
 * The call still commits once, so TAPS (like path notifications) report each
 * key once, with its final value: onAdd(final) for a row the call added,
 * onUpdate(id, merged changes, final) for a row it updated.
 */
type Row = { id: string; n: number; p?: number; q?: number; t?: string };
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
const copies = (...rows: Row[]) => rows.map((row) => ({ ...row }));

type Log = unknown[][];
/**
 * Records every interceptor call, and TRANSFORMS each one so a lost or
 * reordered call changes the stored value: onAdd tags the row with the call
 * number, onUpdate tags its changes.
 */
const watch = (tree: Tree) => {
  const intercepted: Log = [];
  const tapped: Log = [];
  const stopIntercepting = tree.$.rows.intercept({
    onAdd: (row, ctx) => {
      intercepted.push(['onAdd', { ...row }]);
      ctx.transform({ ...row, t: `add${intercepted.length}` });
    },
    onUpdate: (id, changes, ctx) => {
      intercepted.push(['onUpdate', id, { ...changes }]);
      ctx.transform({ ...changes, t: `upd${intercepted.length}` });
    },
  });
  const stopTapping = tree.$.rows.tap({
    onAdd: (row, id) => tapped.push(['onAdd', { ...row }, id]),
    onUpdate: (id, changes, row) =>
      tapped.push(['onUpdate', id, { ...changes }, { ...row }]),
  });
  return {
    intercepted,
    tapped,
    // Undo, redo and rollback write through the interceptors too, so the
    // reversal carriers stop transforming once the call has run.
    stop: () => {
      stopIntercepting();
      stopTapping();
    },
  };
};

type Case = {
  batch: (tree: Tree) => unknown;
  /** The same rows as successive single calls. */
  sequential: (tree: Tree) => void;
  intercepted: Log;
  tapped: Log;
  after: Row[];
};
const cases: Record<string, Case> = {
  'addMany overwrite, a new id twice around another': {
    batch: (tree) =>
      tree.$.rows.addMany(
        copies({ id: 'x', n: 1, p: 1 }, { id: 'y', n: 5 }, { id: 'x', n: 2 }),
        { mode: 'overwrite' }
      ),
    sequential: (tree) => {
      for (const row of copies(
        { id: 'x', n: 1, p: 1 },
        { id: 'y', n: 5 },
        { id: 'x', n: 2 }
      ))
        tree.$.rows.addMany([row], { mode: 'overwrite' });
    },
    intercepted: [
      ['onAdd', { id: 'x', n: 1, p: 1 }],
      ['onAdd', { id: 'y', n: 5 }],
      ['onAdd', { id: 'x', n: 2 }],
    ],
    tapped: [
      ['onAdd', { id: 'x', n: 2, t: 'add3' }, 'x'],
      ['onAdd', { id: 'y', n: 5, t: 'add2' }, 'y'],
    ],
    after: [
      ...SEEDED,
      { id: 'x', n: 2, t: 'add3' },
      { id: 'y', n: 5, t: 'add2' },
    ],
  },
  'addMany overwrite, an existing id twice': {
    batch: (tree) =>
      tree.$.rows.addMany(copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7 }), {
        mode: 'overwrite',
      }),
    sequential: (tree) => {
      for (const row of copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7 }))
        tree.$.rows.addMany([row], { mode: 'overwrite' });
    },
    intercepted: [
      ['onAdd', { id: 'a', n: 5, p: 1 }],
      ['onAdd', { id: 'a', n: 7 }],
    ],
    tapped: [['onAdd', { id: 'a', n: 7, t: 'add2' }, 'a']],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 7, t: 'add2' },
    ],
  },
  'prependMany overwrite, a new id twice around another': {
    batch: (tree) =>
      tree.$.rows.prependMany(
        copies({ id: 'x', n: 1 }, { id: 'y', n: 5 }, { id: 'x', n: 2 }),
        { mode: 'overwrite' }
      ),
    // Successive prepends would reverse the rows; the interceptor calls are
    // what is compared, and the order is checked by `after`.
    sequential: (tree) => {
      for (const row of copies(
        { id: 'x', n: 1 },
        { id: 'y', n: 5 },
        { id: 'x', n: 2 }
      ))
        tree.$.rows.addMany([row], { mode: 'overwrite' });
    },
    intercepted: [
      ['onAdd', { id: 'x', n: 1 }],
      ['onAdd', { id: 'y', n: 5 }],
      ['onAdd', { id: 'x', n: 2 }],
    ],
    tapped: [
      ['onAdd', { id: 'x', n: 2, t: 'add3' }, 'x'],
      ['onAdd', { id: 'y', n: 5, t: 'add2' }, 'y'],
    ],
    after: [
      { id: 'x', n: 2, t: 'add3' },
      { id: 'y', n: 5, t: 'add2' },
      ...SEEDED,
    ],
  },
  'addMany skip, an existing id and a new id twice': {
    batch: (tree) =>
      tree.$.rows.addMany(
        copies({ id: 'a', n: 9 }, { id: 'x', n: 1 }, { id: 'x', n: 2 }),
        { mode: 'skip' }
      ),
    sequential: (tree) => {
      for (const row of copies(
        { id: 'a', n: 9 },
        { id: 'x', n: 1 },
        { id: 'x', n: 2 }
      ))
        tree.$.rows.addMany([row], { mode: 'skip' });
    },
    intercepted: [['onAdd', { id: 'x', n: 1 }]],
    tapped: [['onAdd', { id: 'x', n: 1, t: 'add1' }, 'x']],
    after: [...SEEDED, { id: 'x', n: 1, t: 'add1' }],
  },
  'upsertMany, a new id twice': {
    batch: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'x', n: 1, p: 1 }, { id: 'x', n: 2, q: 2 })
      ),
    sequential: (tree) => {
      for (const row of copies({ id: 'x', n: 1, p: 1 }, { id: 'x', n: 2, q: 2 }))
        tree.$.rows.upsertOne(row);
    },
    intercepted: [
      ['onAdd', { id: 'x', n: 1, p: 1 }],
      ['onUpdate', 'x', { id: 'x', n: 2, q: 2 }],
    ],
    tapped: [['onAdd', { id: 'x', n: 2, p: 1, q: 2, t: 'upd2' }, 'x']],
    after: [...SEEDED, { id: 'x', n: 2, p: 1, q: 2, t: 'upd2' }],
  },
  'upsertMany, an existing id twice': {
    batch: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7, q: 2 })
      ),
    sequential: (tree) => {
      for (const row of copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7, q: 2 }))
        tree.$.rows.upsertOne(row);
    },
    intercepted: [
      ['onUpdate', 'a', { id: 'a', n: 5, p: 1 }],
      ['onUpdate', 'a', { id: 'a', n: 7, q: 2 }],
    ],
    tapped: [
      [
        'onUpdate',
        'a',
        { id: 'a', n: 7, p: 1, q: 2, t: 'upd2' },
        { id: 'a', n: 7, p: 1, q: 2, t: 'upd2' },
      ],
    ],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 7, p: 1, q: 2, t: 'upd2' },
    ],
  },
  'upsertMany, a new id twice around an existing id, in input order': {
    batch: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'x', n: 1 }, { id: 'a', n: 4 }, { id: 'x', n: 3, p: 3 })
      ),
    sequential: (tree) => {
      for (const row of copies(
        { id: 'x', n: 1 },
        { id: 'a', n: 4 },
        { id: 'x', n: 3, p: 3 }
      ))
        tree.$.rows.upsertOne(row);
    },
    intercepted: [
      ['onAdd', { id: 'x', n: 1 }],
      ['onUpdate', 'a', { id: 'a', n: 4 }],
      ['onUpdate', 'x', { id: 'x', n: 3, p: 3 }],
    ],
    tapped: [
      ['onAdd', { id: 'x', n: 3, p: 3, t: 'upd3' }, 'x'],
      [
        'onUpdate',
        'a',
        { id: 'a', n: 4, t: 'upd2' },
        { id: 'a', n: 4, t: 'upd2' },
      ],
    ],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 4, t: 'upd2' },
      { id: 'x', n: 3, p: 3, t: 'upd3' },
    ],
  },
};

describe('duplicate ids in one call: interceptors and taps', () => {
  it.each(Object.keys(cases))(
    '%s — interceptors per copy in input order, taps once per key',
    async (name) => {
      const tree = make();
      try {
        await seed(tree);
        const { intercepted, tapped } = watch(tree);
        cases[name].batch(tree);
        await flush();
        expect(intercepted).toStrictEqual(cases[name].intercepted);
        expect(tapped).toStrictEqual(cases[name].tapped);
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each(Object.keys(cases))(
    '%s — the same interceptor calls as successive single calls',
    async (name) => {
      const batch = make();
      const sequential = make();
      try {
        await seed(batch);
        await seed(sequential);
        const fromBatch = watch(batch);
        const fromSequence = watch(sequential);
        cases[name].batch(batch);
        cases[name].sequential(sequential);
        await flush();
        expect(fromBatch.intercepted).toStrictEqual(fromSequence.intercepted);
      } finally {
        batch.destroy();
        sequential.destroy();
      }
    }
  );

  it.each([
    [
      'addMany',
      (tree: Tree) =>
        tree.$.rows.addMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 })),
    ],
    [
      'prependMany',
      (tree: Tree) =>
        tree.$.rows.prependMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 })),
    ],
    [
      'addMany, an existing id after a new one',
      (tree: Tree) =>
        tree.$.rows.addMany(copies({ id: 'x', n: 1 }, { id: 'a', n: 2 })),
    ],
  ] as const)(
    '%s strict: throws before any interceptor runs or anything is written',
    async (_api, act) => {
      const tree = make();
      try {
        await seed(tree);
        const { intercepted, tapped } = watch(tree);
        expect(() => act(tree)).toThrow(/already exists/);
        await flush();
        expect(intercepted).toStrictEqual([]);
        expect(tapped).toStrictEqual([]);
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each([
    [
      'addMany overwrite blocks the FIRST copy',
      (tree: Tree) =>
        tree.$.rows.addMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 }), {
          mode: 'overwrite',
        }),
      1,
    ],
    [
      'upsertMany blocks the first copy of a new id',
      (tree: Tree) =>
        tree.$.rows.upsertMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 })),
      1,
    ],
    [
      'upsertMany blocks a later copy of an existing id',
      (tree: Tree) =>
        tree.$.rows.upsertMany(copies({ id: 'a', n: 5 }, { id: 'a', n: 1 })),
      1,
    ],
  ] as const)(
    '%s: the call throws and writes nothing',
    async (_name, act, blockedN) => {
      const tree = make();
      try {
        await seed(tree);
        let taps = 0;
        tree.$.rows.tap({ onAdd: () => taps++, onUpdate: () => taps++ });
        tree.$.rows.intercept({
          onAdd: (row, ctx) => {
            if (row.n === blockedN) ctx.block('no');
          },
          onUpdate: (_id, changes, ctx) => {
            if (changes.n === blockedN) ctx.block('no');
          },
        });
        expect(() => act(tree)).toThrow(/no/);
        await flush();
        expect(taps).toBe(0);
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
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
] as const)(
  'duplicate ids with transforming interceptors: undo/redo (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(cases))('%s — undo, redo, undo exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const { stop } = watch(tree);
        undoable(() => cases[name].batch(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
        stop();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'duplicate ids with transforming interceptors: rollback (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(cases))('%s — rollback exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const { stop } = watch(tree);
        const pending = tree.transaction(() => cases[name].batch(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
        stop();
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });
  }
);
