import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A reversal — undo, redo, jumpTo, rollback — writes back exactly what was
 * recorded. Interceptors do not run on it: they shaped the value when it was
 * first written, and that value (or the pre-image before it) is what the
 * reversal restores. Taps and path subscribers are still told.
 *
 * Before 15.4.4 (and on 15.4.3) a reversal of a row's VALUE went through the
 * collection's `onUpdate` interceptors, twice: a transforming interceptor
 * re-transformed the pre-image an undo restored (`{ n: 1 }` came back as
 * `{ n: 1, p: 9 }`), and a blocking one made undo, redo and rollback throw.
 * Undoing an `upsertMany` or `setAll` add ran `onRemove` the same way.
 * Nothing documented either; restoration.ts stamps its writes
 * `origin: 'restoration'` precisely so enhancers can tell a replay apart.
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

const writes: Record<string, (tree: Tree) => void> = {
  updateOne: (tree) => tree.$.rows.updateOne('a', { n: 5 }),
  replaceOne: (tree) => tree.$.rows.replaceOne('a', { id: 'a', n: 5 }),
  updateMany: (tree) => tree.$.rows.updateMany(['z', 'a'], { n: 5 }),
  'row node write': (tree) => tree.$.rows.byId('a')?.({ id: 'a', n: 5 }),
  'field write': (tree) => tree.$.rows.byId('a')?.n(5),
  addOne: (tree) => void tree.$.rows.addOne({ id: 'x', n: 5 }),
  addMany: (tree) => void tree.$.rows.addMany([{ id: 'x', n: 5 }]),
  'addMany overwrite': (tree) =>
    void tree.$.rows.addMany([{ id: 'a', n: 5 }], { mode: 'overwrite' }),
  prependOne: (tree) => void tree.$.rows.prependOne({ id: 'x', n: 5 }),
  removeOne: (tree) => tree.$.rows.removeOne('a'),
  removeMany: (tree) => tree.$.rows.removeMany(['z', 'a']),
  upsertMany: (tree) =>
    void tree.$.rows.upsertMany([
      { id: 'a', n: 5 },
      { id: 'x', n: 6 },
    ]),
  setAll: (tree) =>
    tree.$.rows.setAll([
      { id: 'a', n: 5 },
      { id: 'x', n: 6 },
    ]),
  clear: (tree) => tree.$.rows.clear(),
};
const names = Object.keys(writes);

type Hooks = {
  /** Interceptor calls made while a reversal ran. */
  intercepted: string[];
  tapped: string[];
  notified: string[];
  /** From now on, every interceptor blocks. */
  block(): void;
  /** Start recording (after the forward write). */
  record(): void;
  stop(): void;
};
/**
 * Transforming interceptors (they tag what they touch with `p: 9`), which can
 * be switched to blocking once the forward write has run, plus a tap and a
 * path subscriber.
 */
const hook = (tree: Tree): Hooks => {
  let recording = false;
  let blocking = false;
  const hooks = {
    intercepted: [] as string[],
    tapped: [] as string[],
    notified: [] as string[],
  };
  const seen = (list: string[], entry: string) => {
    if (recording) list.push(entry);
  };
  tree.$.rows.intercept({
    onAdd: (row, ctx) => {
      seen(hooks.intercepted, `add:${row.id}`);
      if (blocking) ctx.block('blocked');
      ctx.transform({ ...row, p: 9 });
    },
    onUpdate: (id, changes, ctx) => {
      seen(hooks.intercepted, `update:${id}`);
      if (blocking) ctx.block('blocked');
      ctx.transform({ ...changes, p: 9 });
    },
    onRemove: (id, _row, ctx) => {
      seen(hooks.intercepted, `remove:${id}`);
      if (blocking) ctx.block('blocked');
    },
  });
  tree.$.rows.tap({
    onAdd: (_row, id) => seen(hooks.tapped, `add:${id}`),
    onUpdate: (id) => seen(hooks.tapped, `update:${id}`),
    onRemove: (id) => seen(hooks.tapped, `remove:${id}`),
  });
  const stop = getPathNotifier().subscribe('rows.*', (_v, _p, path) =>
    seen(hooks.notified, path)
  );
  return {
    ...hooks,
    block: () => {
      blocking = true;
    },
    record: () => {
      recording = true;
    },
    stop,
  };
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('reversal writes skip interceptors (%s)', (_name, enhancers) => {
  it.each(names)(
    '%s, transforming interceptors: undo, redo, undo, jumpTo exact; no interceptor call',
    async (name) => {
      const tree = make(enhancers());
      await seed(tree);
      const hooks = hook(tree);
      try {
        undoable(() => writes[name](tree));
        await flush();
        const after = tree.$.rows.all();
        hooks.record();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.jumpTo(tree.getRestorationHistory().length - 1);
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        expect(hooks.intercepted).toStrictEqual([]);
        // Observers are still told about every reversal.
        expect(hooks.notified.length).toBeGreaterThan(0);
      } finally {
        hooks.stop();
        tree.destroy();
      }
    }
  );

  it.each(names)(
    '%s, interceptors that block: undo, redo, undo, jumpTo still apply',
    async (name) => {
      const tree = make(enhancers());
      await seed(tree);
      const hooks = hook(tree);
      try {
        undoable(() => writes[name](tree));
        await flush();
        const after = tree.$.rows.all();
        hooks.block();
        hooks.record();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.jumpTo(tree.getRestorationHistory().length - 1);
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        expect(hooks.intercepted).toStrictEqual([]);
      } finally {
        hooks.stop();
        tree.destroy();
      }
    }
  );
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('rollback writes skip interceptors (%s)', (_name, enhancers) => {
  it.each(names)(
    '%s, transforming then blocking interceptors: rollback exact, no interceptor call',
    async (name) => {
      for (const blocking of [false, true]) {
        const tree = make(enhancers());
        await seed(tree);
        const hooks = hook(tree);
        try {
          const pending = tree.transaction(() => writes[name](tree));
          await flush();
          if (blocking) hooks.block();
          hooks.record();
          pending.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
          expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
          expect(hooks.intercepted).toStrictEqual([]);
        } finally {
          hooks.stop();
          tree.destroy();
        }
      }
    }
  );
});

describe('reversal writes still reach taps', () => {
  it.each([
    ['updateOne', 'update:a'],
    ['upsertMany', 'update:a'],
  ] as const)('%s undo taps %s', async (name, expected) => {
    const tree = make([restoration()]);
    await seed(tree);
    const hooks = hook(tree);
    try {
      undoable(() => writes[name](tree));
      await flush();
      hooks.record();
      tree.undo();
      await flush();
      expect(hooks.tapped).toContain(expected);
    } finally {
      hooks.stop();
      tree.destroy();
    }
  });
});

describe('forward writes are still intercepted', () => {
  it('a write inside undoable() is transformed and can be blocked', async () => {
    const tree = make([restoration()]);
    await seed(tree);
    const hooks = hook(tree);
    try {
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 5, p: 9 });
      hooks.block();
      expect(() => tree.$.rows.updateOne('a', { n: 6 })).toThrow(/blocked/);
    } finally {
      hooks.stop();
      tree.destroy();
    }
  });
});
