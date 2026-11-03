import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { external } from './external';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import { interceptLeafSignals } from './internals/intercept-leaf-signals';
import { getPositionRegistry } from './internals/position-registry';
import { getPathNotifier } from './path-notifier';

// Used for cleanup before a subscription exists, and observers whose timing
// (rather than callback body) is under test.
const noop = (): void => {
  // Intentionally inert.
};

type Row = { id: string; n: number };
const state = () => ({ n: 0, branch: { rows: entityMap<Row, string>() } });
const typed = () =>
  signalTree(state(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (profile: 'neutral' | 'history' | 'both' = 'both'): Tree =>
  signalTree(state(), {
    enhancers:
      profile === 'neutral'
        ? []
        : profile === 'history'
        ? [restoration()]
        : [transactions(), restoration()],
  }) as Tree;
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const seed = async (tree: Tree) => {
  tree.$.branch.rows.addOne({ id: 'a', n: 1 });
  await flush();
};
const omit = (tree: Tree) =>
  (tree.$ as unknown as (value: { n: number }) => void)({ n: 0 });

/** Portable destination: packages/kernel/src/lib/. No expected-failure markers. */
describe('prependMany publication boundary', () => {
  it.each(['neutral', 'history', 'both'] as const)(
    'one public method observation sees final order (%s)',
    async (profile) => {
      const tree = make(profile);
      let off = noop;
      try {
        await seed(tree);
        const observations: string[][] = [];
        off = interceptLeafSignals(tree.$, (path) => {
          if (path === 'branch.rows')
            observations.push([...tree.$.branch.rows.ids()]);
        });
        tree.$.branch.rows.addMany([{ id: 'b', n: 2 }]);
        expect(observations).toEqual([['a', 'b']]); // Real observer positive control.
        observations.length = 0;
        tree.$.branch.rows.prependMany([{ id: 'x', n: 3 }]);
        expect(observations).toEqual([['x', 'a', 'b']]);
        expect(tree.$.branch.rows.ids()).toEqual(['x', 'a', 'b']);
      } finally {
        off();
        tree.destroy();
        await flush();
      }
    }
  );

  it('a flush inside onAdd preserves final anchors and one designated history step', async () => {
    const tree = make('history');
    let off = noop;
    try {
      await seed(tree);
      const index = tree.getCurrentIndex();
      const reads: Array<{ ids: string[]; all: string[] }> = [];
      off = tree.$.branch.rows.tap({
        onAdd: (_row, id) => {
          if (id !== 'x') return;
          reads.push({
            ids: [...tree.$.branch.rows.ids()],
            all: tree.$.branch.rows.all().map((r) => r.id),
          });
          getPathNotifier().flushSync();
        },
      });
      undoable(() => tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]));
      await flush();
      expect(reads).toEqual([{ ids: ['x', 'a'], all: ['x', 'a'] }]);
      expect(tree.getCurrentIndex()).toBe(index + 1);
      off();
      off = noop;
      tree.undo();
      await flush();
      expect(tree.$.branch.rows.all()).toEqual([{ id: 'a', n: 1 }]);
      tree.redo();
      await flush();
      expect(tree.$.branch.rows.all()).toEqual([
        { id: 'x', n: 2 },
        { id: 'a', n: 1 },
      ]);
    } finally {
      off();
      tree.destroy();
      await flush();
    }
  });

  it.each(['addMany', 'prependMany'] as const)(
    'nested %s from onAdd keeps distinct effects and replays exact order',
    async (nested) => {
      const tree = make('history');
      let off = noop;
      try {
        await seed(tree);
        let calls = 0;
        off = tree.$.branch.rows.tap({
          onAdd: (_row, id) => {
            if (id !== 'x') return;
            calls++;
            tree.$.branch.rows[nested]([{ id: 'y', n: 3 }]);
          },
        });
        undoable(() => tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]));
        await flush();
        const expected =
          nested === 'addMany' ? ['x', 'a', 'y'] : ['y', 'x', 'a'];
        expect(calls).toBe(1);
        expect(tree.$.branch.rows.ids()).toEqual(expected);
        const finalRows = tree.$.branch.rows.all();
        off();
        off = noop;
        tree.undo();
        await flush();
        expect(tree.$.branch.rows.all()).toEqual([{ id: 'a', n: 1 }]);
        tree.redo();
        await flush();
        expect(tree.$.branch.rows.ids()).toEqual(expected);
        expect(tree.$.branch.rows.all()).toEqual(finalRows);
      } finally {
        off();
        tree.destroy();
        await flush();
      }
    }
  );

  it('an omitted ancestor is re-added once with only written rows and reverses', async () => {
    const tree = make('history');
    let intercept = noop,
      tap = noop;
    try {
      await seed(tree);
      omit(tree);
      await flush();
      const absent = tree.$();
      let copies = 0;
      const reads: string[][] = [];
      intercept = tree.$.branch.rows.intercept({
        onAdd: () => {
          copies++;
        },
      });
      tap = tree.$.branch.rows.tap({
        onAdd: () => reads.push([...tree.$.branch.rows.ids()]),
      });
      undoable(() => tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]));
      await flush();
      expect(copies).toBe(1);
      expect(reads).toEqual([['x']]);
      expect(tree.$.branch.rows.all()).toEqual([{ id: 'x', n: 2 }]);
      tap();
      intercept();
      tap = intercept = noop;
      tree.undo();
      await flush();
      expect(tree.$()).toEqual(absent);
      tree.redo();
      await flush();
      expect(tree.$.branch.rows.all()).toEqual([{ id: 'x', n: 2 }]);
    } finally {
      tap();
      intercept();
      tree.destroy();
      await flush();
    }
  });

  it.each([false, true])(
    'blocked input leaves state and history intact (absent=%s)',
    async (absent) => {
      const tree = make('history');
      let off = noop;
      try {
        await seed(tree);
        if (absent) {
          omit(tree);
          await flush();
        }
        const before = tree.$(),
          index = tree.getCurrentIndex();
        let intercepted = 0;
        off = tree.$.branch.rows.intercept({
          onAdd: (row, ctx) => {
            intercepted++;
            if (row.id === 'bad') ctx.block('C blocked');
          },
        });
        expect(() =>
          undoable(() =>
            tree.$.branch.rows.prependMany([
              { id: 'x', n: 2 },
              { id: 'bad', n: 3 },
            ])
          )
        ).toThrow('C blocked');
        await flush();
        expect(intercepted).toBe(2);
        expect(tree.$()).toEqual(before);
        expect(tree.getCurrentIndex()).toBe(index);
        off();
        off = noop;
        tree.$.branch.rows.prependMany([{ id: 'q', n: 4 }]);
        await flush();
        expect(tree.$.branch.rows.ids()).toEqual(absent ? ['q'] : ['q', 'a']);
      } finally {
        off();
        tree.destroy();
        await flush();
      }
    }
  );

  it('a postcommit tap throw retains final order and does not poison a later call', async () => {
    const tree = make('neutral');
    let off = noop;
    try {
      await seed(tree);
      const marker = Object.freeze({ callback: 'C' });
      off = tree.$.branch.rows.tap({
        onAdd: () => {
          throw marker;
        },
      });
      let threw = false,
        caught: unknown;
      try {
        tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]);
      } catch (error) {
        threw = true;
        caught = error;
      }
      expect(threw).toBe(true);
      expect(caught).toBe(marker);
      expect(tree.$.branch.rows.ids()).toEqual(['x', 'a']);
      off();
      off = noop;
      tree.$.branch.rows.addMany([{ id: 'y', n: 3 }]);
      await flush();
      expect(tree.$.branch.rows.ids()).toEqual(['x', 'a', 'y']);
    } finally {
      off();
      tree.destroy();
      await flush();
    }
  });

  it('a later designated scalar undo preserves externally realized prepend state', async () => {
    const tree = make('history');
    try {
      await seed(tree);
      undoable(() => tree.$.n(1));
      await flush();
      external(() => tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]));
      await flush();
      undoable(() => tree.$.n(2));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.n()).toBe(1);
      expect(tree.$.branch.rows.all()).toEqual([
        { id: 'x', n: 2 },
        { id: 'a', n: 1 },
      ]);
    } finally {
      tree.destroy();
      await flush();
    }
  });

  it('internal synchronous notifier copies final anchors; no synchronous-history promise', async () => {
    const tree = make('history'),
      notifier = getPathNotifier();
    let off = noop,
      enqueue = noop;
    try {
      await seed(tree);
      const owner = getPositionRegistry(tree.$)!.id;
      const captured: Array<{ before?: number; after?: number }> = [],
        delivered: typeof captured = [];
      enqueue = notifier.observeEnqueue(owner, (entry) => {
        const effect = entry.meta?.structuralEffect;
        if (effect?.kind === 'add' && effect.key === 'x')
          captured.push({
            before: effect.beforeSubject,
            after: effect.afterSubject,
          });
      });
      off = notifier.subscribe(
        'branch.rows.*',
        (_v, _p, _path, _ownerPath, _origin, _subjects, _positions, meta) => {
          const effect = meta?.structuralEffect;
          if (
            meta?.ownerId === owner &&
            effect?.kind === 'add' &&
            effect.key === 'x'
          )
            delivered.push({
              before: effect.beforeSubject,
              after: effect.afterSubject,
            });
        }
      );
      notifier.setBatchingEnabled(false);
      tree.$.branch.rows.prependMany([{ id: 'x', n: 2 }]);
      expect(captured).toHaveLength(1);
      expect(delivered).toEqual(captured);
      expect(captured[0].before).toBeUndefined();
      expect(typeof captured[0].after).toBe('number');
      expect(tree.$.branch.rows.ids()).toEqual(['x', 'a']);
      // Deliberately no undo/redo assertion under batching-disabled history.
    } finally {
      notifier.setBatchingEnabled(true);
      off();
      enqueue();
      tree.destroy();
      await flush();
    }
  });
});
