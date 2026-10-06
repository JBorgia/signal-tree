import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * `removeMany` and `updateMany` treat a repeated id as idempotent, ON PURPOSE
 * (kept for 15.4.4, unlike the add calls' one-at-a-time rule): the row is
 * removed or updated ONCE and announced once, and the call does not throw
 * where a second `removeOne` would. Every listing is still intercepted and
 * tapped. `updateMany` computes each listing from the row as it was before
 * the call, so the last listing's intercepted changes are what it holds.
 */
type Row = { id: string; n: number; t?: number };
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

const calls = {
  'removeMany, an id twice': {
    act: (tree: Tree) => tree.$.rows.removeMany(['a', 'a']),
    after: [{ id: 'z', n: 0 }],
  },
  'updateMany, an id twice': {
    act: (tree: Tree) => tree.$.rows.updateMany(['a', 'a'], { n: 5 }),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 5 },
    ],
  },
};
type Name = keyof typeof calls;
const names = Object.keys(calls) as Name[];

describe('duplicate ids in removeMany / updateMany: forward', () => {
  it.each(names)(
    '%s — written and announced once, intercepted and tapped per listing',
    async (name) => {
      const tree = make();
      const announced: string[] = [];
      const unsubscribe = getPathNotifier().subscribe('rows.*', (_v, _p, path) => {
        announced.push(path);
      });
      try {
        await seed(tree);
        announced.length = 0;
        const hooks: string[] = [];
        tree.$.rows.intercept({
          onRemove: (id) => void hooks.push(`i:remove:${id}`),
          onUpdate: (id) => void hooks.push(`i:update:${id}`),
        });
        tree.$.rows.tap({
          onRemove: (id) => void hooks.push(`t:remove:${id}`),
          onUpdate: (id, _changes, row) =>
            void hooks.push(`t:update:${id}:${row.n}`),
        });
        calls[name].act(tree);
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(calls[name].after);
        expect(tree.$.rows.count()).toBe(calls[name].after.length);
        expect(announced).toStrictEqual(['rows.a']);
        expect(hooks).toStrictEqual(
          name.startsWith('remove')
            ? ['i:remove:a', 'i:remove:a', 't:remove:a', 't:remove:a']
            : ['i:update:a', 'i:update:a', 't:update:a:5', 't:update:a:5']
        );
      } finally {
        unsubscribe();
        tree.destroy();
      }
    }
  );

  it('updateMany: each listing starts from the row the interceptors left; the last applies', async () => {
    const tree = make();
    try {
      await seed(tree);
      let listing = 0;
      tree.$.rows.intercept({
        onUpdate: (_id, changes, ctx) =>
          ctx.transform({ ...changes, t: ++listing }),
      });
      tree.$.rows.updateMany(['a', 'a'], { n: 5 });
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'z', n: 0 },
        { id: 'a', n: 5, t: 2 },
      ]);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'duplicate ids in removeMany / updateMany: undo/redo (%s)',
  (_name, enhancers) => {
    it.each(names)('%s — undo, redo, undo exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => calls[name].act(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(calls[name].after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(calls[name].after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
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
  'duplicate ids in removeMany / updateMany: rollback (%s)',
  (_name, enhancers) => {
    it.each(names)('%s — rollback exact', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const pending = tree.transaction(() => calls[name].act(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(calls[name].after);
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
      } finally {
        tree.destroy();
      }
    });
  }
);
