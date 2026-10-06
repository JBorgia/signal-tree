import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A batch call that names one id more than once behaves as if its rows were
 * applied ONE AT A TIME, in order, in the call's mode (owner decision for
 * 15.4.4):
 *
 *   addMany / prependMany  strict     throw before anything is written
 *                          skip       the first copy wins
 *                          overwrite  the last copy wins, in the first copy's
 *                                     place (as setAll)
 *   upsertMany                        each later copy upserts over the earlier
 *                                     result: { ...first, ...second }
 *
 * The collection never holds two rows under one key. On npm 15.4.3 addMany
 * inserted a second row under the same key in EVERY mode (ids() and all()
 * disagreed), prependMany crashed (RangeError: Invalid array length),
 * upsertMany of a new id did the same as addMany and its undo threw, and
 * upsertMany of an existing id dropped the earlier copy's fields.
 */
type Row = { id: string; n: number; p?: number; q?: number };
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

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};
const copies = (...rows: Row[]) => rows.map((row) => ({ ...row }));

type Case = {
  act: (tree: Tree) => unknown;
  returns: string[];
  after: Row[];
};
const cases: Record<string, Case> = {
  'addMany skip, a new id twice: the first copy wins': {
    act: (tree) =>
      tree.$.rows.addMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 }), {
        mode: 'skip',
      }),
    returns: ['x'],
    after: [...SEEDED, { id: 'x', n: 1 }],
  },
  'addMany skip, an existing id and a new id twice': {
    act: (tree) =>
      tree.$.rows.addMany(
        copies({ id: 'a', n: 9 }, { id: 'x', n: 1 }, { id: 'x', n: 2 }),
        { mode: 'skip' }
      ),
    returns: ['x'],
    after: [...SEEDED, { id: 'x', n: 1 }],
  },
  'addMany overwrite, a new id twice around another: the last copy wins in the first place':
    {
      act: (tree) =>
        tree.$.rows.addMany(
          copies({ id: 'x', n: 1, p: 1 }, { id: 'y', n: 5 }, { id: 'x', n: 2 }),
          { mode: 'overwrite' }
        ),
      returns: ['x', 'y'],
      after: [...SEEDED, { id: 'x', n: 2 }, { id: 'y', n: 5 }],
    },
  'addMany overwrite, an existing id twice': {
    act: (tree) =>
      tree.$.rows.addMany(copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7 }), {
        mode: 'overwrite',
      }),
    returns: ['a'],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 7 },
    ],
  },
  'prependMany skip, a new id twice': {
    act: (tree) =>
      tree.$.rows.prependMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 }), {
        mode: 'skip',
      }),
    returns: ['x'],
    after: [{ id: 'x', n: 1 }, ...SEEDED],
  },
  'prependMany overwrite, a new id twice around another': {
    act: (tree) =>
      tree.$.rows.prependMany(
        copies({ id: 'x', n: 1 }, { id: 'y', n: 5 }, { id: 'x', n: 2 }),
        { mode: 'overwrite' }
      ),
    returns: ['x', 'y'],
    after: [{ id: 'x', n: 2 }, { id: 'y', n: 5 }, ...SEEDED],
  },
  'upsertMany, a new id twice: the second upserts over the first': {
    act: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'x', n: 1, p: 1 }, { id: 'x', n: 2, q: 2 })
      ),
    returns: ['x'],
    after: [...SEEDED, { id: 'x', n: 2, p: 1, q: 2 }],
  },
  'upsertMany, an existing id twice': {
    act: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7, q: 2 })
      ),
    returns: ['a'],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 7, p: 1, q: 2 },
    ],
  },
  'upsertMany, a new id twice around an existing id': {
    act: (tree) =>
      tree.$.rows.upsertMany(
        copies({ id: 'x', n: 1 }, { id: 'a', n: 4 }, { id: 'x', n: 3, p: 3 })
      ),
    returns: ['x', 'a'],
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 4 },
      { id: 'x', n: 3, p: 3 },
    ],
  },
};

describe.each([
  ['no enhancers', () => []],
  ['restoration()', () => [restoration()]],
  ['transactions()', () => [transactions()]],
] as const)('duplicate ids in one call: forward (%s)', (_name, enhancers) => {
  it.each(Object.keys(cases))(
    '%s — one row per key, ids() and all() agree',
    async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const returned = cases[name].act(tree);
        await flush();
        expect(returned).toStrictEqual(cases[name].returns);
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
        expect(tree.$.rows.ids()).toStrictEqual(
          cases[name].after.map((row) => row.id)
        );
        expect(tree.$.rows.count()).toBe(cases[name].after.length);
      } finally {
        tree.destroy();
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
  ] as const)(
    '%s strict, a new id twice: throws and writes nothing',
    async (_api, act) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        expect(() => act(tree)).toThrow('Entity with id x already exists');
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
      } finally {
        tree.destroy();
      }
    }
  );
});

/**
 * v16 slice 8f: carried from v15 778f86ef and e02238f4 (the sequential
 * duplicate-id rule). Reversing some of these shapes depends on v15's 15.4.x
 * entity line, which v16 has not carried yet. They are expected failures
 * here, each naming the v15 commit that fixes it; the carry slice flips them
 * (`.claude/evidence/v16/carry-15.4.x/DEFECTS.md`):
 * - an overwrite of an existing row: undo removes the row and redo throws an
 *   anchor cycle (c775278e);
 * - prependMany's move to the front is not recorded, so redo appends
 *   (005399a7);
 * - upsertMany's added row is announced as a bare value, so undo throws and
 *   rollback leaves it (dbb8449b).
 */
const UNDO_BLOCKED: Record<string, string> = {
  'addMany overwrite, an existing id twice': 'c775278e',
  'upsertMany, a new id twice: the second upserts over the first': 'dbb8449b',
  'upsertMany, a new id twice around an existing id': 'dbb8449b',
};
const ROLLBACK_BLOCKED: Record<string, string> = {
  'addMany overwrite, an existing id twice': 'c775278e',
  'upsertMany, a new id twice: the second upserts over the first': 'dbb8449b',
  'upsertMany, a new id twice around an existing id': 'dbb8449b',
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('duplicate ids in one call: undo/redo (%s)', (_name, enhancers) => {
  // prependMany's undo/redo ORDER needs its move to the front recorded, which
  // the next commit adds; its rows join this table there.
  const undoNames = Object.keys(cases).filter(
    (name) => !name.startsWith('prependMany')
  );
  for (const blocked of [false, true])
    (blocked ? it.fails : it).each(
      undoNames.filter((name) => name in UNDO_BLOCKED === blocked)
    )('%s — undo, redo, undo exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => cases[name].act(tree));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
      } finally {
        tree.destroy();
      }
    });

  it('strict throw records no history', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const before = tree.canUndo();
      expect(() =>
        undoable(() =>
          tree.$.rows.addMany(copies({ id: 'x', n: 1 }, { id: 'x', n: 2 }))
        )
      ).toThrow('Entity with id x already exists');
      await flush();
      expect(tree.canUndo()).toBe(before);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('duplicate ids in one call: rollback (%s)', (_name, enhancers) => {
  for (const blocked of [false, true])
    (blocked ? it.fails : it).each(
      Object.keys(cases).filter((name) => name in ROLLBACK_BLOCKED === blocked)
    )('%s — rollback exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const pending = tree.transact(() => cases[name].act(tree));
        await flush();
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
      } finally {
        tree.destroy();
      }
    });
});

describe('duplicate ids in one call: path notifications', () => {
  it('announce each key once, with its final value', async () => {
    const tree = make([]);
    const seen: Array<[string, unknown, unknown]> = [];
    const unsubscribe = getPathNotifier().subscribe(
      'rows.*',
      (value, prev, path) => seen.push([path, value, prev])
    );
    try {
      await seed(tree);
      seen.length = 0;
      tree.$.rows.addMany(
        copies({ id: 'x', n: 1 }, { id: 'y', n: 5 }, { id: 'x', n: 2 }),
        { mode: 'overwrite' }
      );
      tree.$.rows.upsertMany(
        copies({ id: 'a', n: 5, p: 1 }, { id: 'a', n: 7 })
      );
      await flush();
      expect(seen).toStrictEqual([
        ['rows.x', { id: 'x', n: 2 }, undefined],
        ['rows.y', { id: 'y', n: 5 }, undefined],
        ['rows.a', { id: 'a', n: 7, p: 1 }, { id: 'a', n: 1 }],
      ]);
    } finally {
      unsubscribe();
      tree.destroy();
    }
  });
});
