import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * `updateMany` and `removeMany` refuse, before writing anything, when one of
 * their interceptors changed the collection's membership or order, or the key
 * of a row the call names — as the add calls do (c01d84ac).
 *
 * Each call resolves its rows (value, subject) before running each row's
 * interceptor, so a reentrant change left that plan stale. Reviewer's probeE:
 * an interceptor renaming a named row made `updateMany` announce `rows.q` but
 * lose the rename (`all()` still showed the row's old value under `a`), and
 * one removing a named row was written over its tombstone; on 8f0ecf29 the
 * announcement even allocated a fresh subject for the vanished key.
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
const make = (enhancers: readonly unknown[] = []): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const calls: Record<string, (tree: Tree) => void> = {
  updateMany: (tree) => tree.$.rows.updateMany(['z', 'a'], { n: 5 }),
  removeMany: (tree) => tree.$.rows.removeMany(['z', 'a']),
};

type Change = { run: (tree: Tree) => void; ids: string[]; all: Row[] };
const changes: Record<string, Change> = {
  'appends another row': {
    run: (tree) => tree.$.rows.addOne({ id: 'r', n: 7 }),
    ids: ['z', 'a', 'c', 'r'],
    all: [...SEEDED, { id: 'r', n: 7 }],
  },
  'prepends another row': {
    run: (tree) => tree.$.rows.prependOne({ id: 'r', n: 7 }),
    ids: ['r', 'z', 'a', 'c'],
    all: [{ id: 'r', n: 7 }, ...SEEDED],
  },
  'upserts another row': {
    run: (tree) => tree.$.rows.upsertMany([{ id: 'r', n: 7 }]),
    ids: ['z', 'a', 'c', 'r'],
    all: [...SEEDED, { id: 'r', n: 7 }],
  },
  'removes the last row': {
    run: (tree) => tree.$.rows.removeOne('c'),
    ids: ['z', 'a'],
    all: SEEDED.slice(0, 2),
  },
  // The interceptor runs on the call's first row, `z`, already resolved.
  'removes the row being intercepted': {
    run: (tree) => tree.$.rows.removeOne('z'),
    ids: ['a', 'c'],
    all: SEEDED.slice(1),
  },
  'renames the row being intercepted': {
    run: (tree) => tree.$.rows.changeId('z', 'q'),
    ids: ['q', 'a', 'c'],
    // changeId keeps the row's value (its `id` field is not rewritten).
    all: SEEDED,
  },
};

/** An interceptor that runs `change` once, on the call's first row. */
const nest = (tree: Tree, change: () => void) => {
  let fired = false;
  const once = () => {
    if (fired) return;
    fired = true;
    change();
  };
  tree.$.rows.intercept({ onUpdate: once, onRemove: once });
};

const combos = Object.keys(calls).flatMap((call) =>
  Object.keys(changes).map((change) => [call, change] as const)
);

describe('updateMany / removeMany: an interceptor changing the topology', () => {
  it.each(combos)(
    '%s, interceptor %s: throws, writes nothing, the callback write stands',
    async (call, change) => {
      const tree = make();
      const announced: string[] = [];
      const stop = getPathNotifier().subscribe('rows.*', (_v, _p, path) => {
        announced.push(path);
      });
      try {
        await seed(tree);
        announced.length = 0;
        nest(tree, () => changes[change].run(tree));
        expect(() => calls[call](tree)).toThrow(
          `Cannot ${call}: collection topology changed during staging`
        );
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(changes[change].ids);
        expect(tree.$.rows.all()).toStrictEqual(changes[change].all);
        // Nothing of the call is announced: the rows it names stay unwritten.
        expect(announced).not.toContain('rows.a');
      } finally {
        stop();
        tree.destroy();
      }
    }
  );

  it.each(Object.keys(calls))(
    '%s: a field-only interceptor write and an unrelated rename proceed',
    async (call) => {
      const tree = make();
      try {
        await seed(tree);
        nest(tree, () => {
          tree.$.rows.updateOne('c', { n: 30 });
          tree.$.rows.changeId('c', 'w');
        });
        calls[call](tree);
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(
          call === 'updateMany' ? ['z', 'a', 'w'] : ['w']
        );
        expect(tree.$.rows.byId('w')?.().n).toBe(30);
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
] as const)('a refused updateMany / removeMany: undo/redo (%s)', (_name, enhancers) => {
  it.each(combos)('%s, interceptor %s', async (call, change) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      nest(tree, () => changes[change].run(tree));
      undoable(() => {
        expect(() => calls[call](tree)).toThrow(/topology changed/);
      });
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(changes[change].ids);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c']);
      tree.redo();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(changes[change].ids);
      expect(tree.$.rows.all()).toStrictEqual(changes[change].all);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a refused updateMany / removeMany: rollback (%s)', (_name, enhancers) => {
  it.each(combos)('%s, interceptor %s', async (call, change) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      nest(tree, () => changes[change].run(tree));
      const pending = tree.transaction(() => {
        expect(() => calls[call](tree)).toThrow(/topology changed/);
      });
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(changes[change].ids);
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c']);
    } finally {
      tree.destroy();
    }
  });
});

/**
 * The CHANGELOG's compatibility note for this refusal, pinned: a cascade
 * delete written as an onRemove interceptor now makes removeMany throw; the
 * migration — the same cascade in a tap, or a separate call — works.
 */
describe('removeMany: cascade deletes, before and after migration', () => {
  type Item = { id: string; parent?: string };
  const cascadeTree = () =>
    signalTree({
      items: entityMap<Item, string>({ selectId: (item) => item.id }),
    });
  const seedItems = (tree: ReturnType<typeof cascadeTree>) =>
    tree.$.items.addMany([
      { id: 'p1' },
      { id: 'p2' },
      { id: 'c1', parent: 'p1' },
      { id: 'c2', parent: 'p2' },
    ]);
  const children = (tree: ReturnType<typeof cascadeTree>, parent: string) =>
    tree.$.items
      .all()
      .filter((item) => item.parent === parent)
      .map((item) => item.id);

  it('a cascade in an onRemove interceptor is refused: the parents stay', () => {
    const tree = cascadeTree();
    try {
      seedItems(tree);
      tree.$.items.intercept({
        onRemove: (id) => {
          const dependants = children(tree, String(id));
          if (dependants.length) tree.$.items.removeMany(dependants);
        },
      });
      expect(() => tree.$.items.removeMany(['p1', 'p2'])).toThrow(
        'Cannot removeMany: collection topology changed during staging'
      );
      // Every row's interceptor ran before the check, so both nested
      // removals stand; the call itself removed nothing.
      expect(tree.$.items.ids()).toStrictEqual(['p1', 'p2']);
    } finally {
      tree.destroy();
    }
  });

  it('the same cascade in a tap removes the parents and their children', () => {
    const tree = cascadeTree();
    try {
      seedItems(tree);
      tree.$.items.tap({
        onRemove: (id) => {
          const dependants = children(tree, String(id));
          if (dependants.length) tree.$.items.removeMany(dependants);
        },
      });
      tree.$.items.removeMany(['p1', 'p2']);
      expect(tree.$.items.ids()).toStrictEqual([]);
    } finally {
      tree.destroy();
    }
  });
});
