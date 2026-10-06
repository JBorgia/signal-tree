import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * `prependOne(entity, opts?: AddOptions)` is strict and reads only what
 * `AddOptions` defines (`selectId`), as on 15.4.3.
 *
 * bf64f92e routed it through `addRows` with `opts` forwarded whole, so a JS
 * or cast caller's `{ mode }` leaked in: `{ mode: 'skip' }` on an existing id
 * returned `undefined` where the type says `K` (it threw), and
 * `{ mode: 'overwrite' }` silently replaced the row.
 */
type Row = { id: string; n: number; key?: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () => signalTree(declaration(), { enhancers: [restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[] = []): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;
const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  await flush();
};
const SEEDED = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
];

describe('prependOne options contract', () => {
  it.each([
    ['no options', undefined],
    ["a cast { mode: 'skip' }", { mode: 'skip' }],
    ["a cast { mode: 'overwrite' }", { mode: 'overwrite' }],
  ] as const)(
    'an existing id with %s: throws, writes nothing, intercepts nothing',
    async (_name, opts) => {
      const tree = make([restoration()]);
      try {
        await seed(tree);
        const calls: string[] = [];
        tree.$.rows.intercept({ onAdd: (row) => void calls.push(`i:${row.id}`) });
        tree.$.rows.tap({ onAdd: (row) => void calls.push(`t:${row.id}`) });
        const entries = tree.getRestorationHistory().length;
        expect(() =>
          undoable(() =>
            tree.$.rows.prependOne({ id: 'a', n: 9 }, opts as never)
          )
        ).toThrow('Entity with id a already exists');
        await flush();
        expect(calls).toStrictEqual([]);
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        expect(tree.getRestorationHistory()).toHaveLength(entries);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each([
    ["a cast { mode: 'skip' }", { mode: 'skip' }],
    ["a cast { mode: 'overwrite' }", { mode: 'overwrite' }],
  ] as const)('a new id with %s: prepended, its id returned', async (_name, opts) => {
    const tree = make();
    try {
      await seed(tree);
      expect(tree.$.rows.prependOne({ id: 'x', n: 5 }, opts as never)).toBe('x');
      expect(tree.$.rows.ids()).toStrictEqual(['x', 'z', 'a']);
    } finally {
      tree.destroy();
    }
  });

  it('selectId from AddOptions is honoured', async () => {
    const tree = make();
    try {
      await seed(tree);
      const id = tree.$.rows.prependOne(
        { id: 'ignored', n: 5, key: 'k' },
        { selectId: (row) => row.key as string }
      );
      expect(id).toBe('k');
      expect(tree.$.rows.ids()).toStrictEqual(['k', 'z', 'a']);
      expect(() =>
        tree.$.rows.prependOne(
          { id: 'other', n: 6, key: 'k' },
          { selectId: (row) => row.key as string }
        )
      ).toThrow('Entity with id k already exists');
    } finally {
      tree.destroy();
    }
  });
});
