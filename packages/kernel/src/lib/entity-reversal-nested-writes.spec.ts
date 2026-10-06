import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A replay of recorded state (undo, redo, jumpTo, rollback, automatic
 * compensation) skips interceptors for ITS OWN writes only. A write a user
 * callback makes while it runs — a tap, a location subscriber — is new
 * forward work and is intercepted like any other.
 *
 * b6aec5a3 keyed the skip on the ambient write origin alone. Taps run inside
 * the replay's `withWriteContext` frame, so a tap's write inherited
 * `origin: 'restoration'` (or `'transaction-rollback'`) and skipped every
 * interceptor — on another collection as well as the same one. 1e1503e0 ran
 * none of them; 8f0ecf29 ran them all (and re-ran them on the replay itself).
 */
type Row = { id: string; n: number; p?: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  log: entityMap<Row, string>({ selectId: (row) => row.id }),
  count: 0,
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

/**
 * Transforming interceptors on both collections, recording every call; they
 * are installed after the seed, so the seed is untransformed.
 */
const intercept = (tree: Tree) => {
  const calls: string[] = [];
  for (const name of ['rows', 'log'] as const) {
    tree.$[name].intercept({
      onAdd: (row, ctx) => {
        calls.push(`${name}:add:${row.id}`);
        ctx.transform({ ...row, p: 9 });
      },
      onUpdate: (id, changes, ctx) => {
        calls.push(`${name}:update:${id}`);
        ctx.transform({ ...changes, p: 9 });
      },
    });
  }
  return calls;
};

type Target = 'another collection' | 'the same collection';
/** A tap on `rows` that writes one fresh row per call, tagged with `phase`. */
const tapWrites = (tree: Tree, target: Target, phase: { name: string }) => {
  let k = 0;
  let writing = false;
  const write = () => {
    // Not for its own writes to `rows`, which tap it again.
    if (writing || phase.name === 'fwd') return;
    writing = true;
    try {
      const id = `${phase.name}${++k}`;
      if (target === 'another collection') tree.$.log.addOne({ id, n: 1 });
      else tree.$.rows.addOne({ id, n: 1 });
    } finally {
      writing = false;
    }
  };
  tree.$.rows.tap({ onAdd: write, onUpdate: write, onRemove: write });
};
const written = (tree: Tree, target: Target, prefix: string) =>
  (target === 'another collection' ? tree.$.log : tree.$.rows)
    .all()
    .filter((row) => row.id.startsWith(prefix));

const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'a', n: 1 });
  await flush();
};

const writes: Record<string, (tree: Tree) => void> = {
  'updateOne (a value replay)': (tree) => tree.$.rows.updateOne('a', { n: 5 }),
  'addOne (a structural replay)': (tree) =>
    void tree.$.rows.addOne({ id: 'b', n: 2 }),
};
const targets: Target[] = ['another collection', 'the same collection'];
const combos = Object.keys(writes).flatMap((write) =>
  targets.map((target) => [write, target] as const)
);

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a tap writing during undo, redo and jumpTo (%s)', (_name, enhancers) => {
  it.each(combos)(
    '%s, tap writes %s: the tap write is intercepted, the replay is not',
    async (write, target) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const phase = { name: 'fwd' };
        tapWrites(tree, target, phase);
        const calls = intercept(tree);
        undoable(() => writes[write](tree));
        await flush();
        let total = 0;
        for (const step of ['undo', 'redo', 'jump'] as const) {
          phase.name = step;
          calls.length = 0;
          if (step === 'undo') tree.undo();
          if (step === 'redo') tree.redo();
          if (step === 'jump') {
            phase.name = 'back';
            tree.undo();
            await flush();
            calls.length = 0;
            phase.name = 'jump';
            tree.jumpTo(tree.getRestorationHistory().length - 1);
          }
          await flush();
          // A replay that re-adds a row fires no tap (pre-existing), so a step
          // may have no tap write; across the three there must be some.
          const nested = written(tree, target, step);
          total += nested.length;
          // Every row the tap wrote went through the interceptor...
          expect(nested.every((row) => row.p === 9)).toBe(true);
          const name = target === 'another collection' ? 'log' : 'rows';
          // ...and the only interceptor calls are the tap's writes.
          expect(calls).toStrictEqual(
            nested.map((row) => `${name}:add:${row.id}`)
          );
        }
        expect(total).toBeGreaterThan(0);
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
] as const)('a tap writing during rollback (%s)', (_name, enhancers) => {
  it.each(combos)(
    '%s, tap writes %s: rollback() and automatic compensation',
    async (write, target) => {
      for (const automatic of [false, true]) {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const phase = { name: 'fwd' };
          tapWrites(tree, target, phase);
          const calls = intercept(tree);
          if (automatic) {
            expect(() =>
              tree.transaction(() => {
                writes[write](tree);
                phase.name = 'comp';
                calls.length = 0;
                throw new Error('boom');
              })
            ).toThrow('boom');
          } else {
            const pending = tree.transaction(() => writes[write](tree));
            await flush();
            phase.name = 'comp';
            calls.length = 0;
            pending.rollback();
          }
          await flush();
          expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 1 });
          const nested = written(tree, target, 'comp');
          expect(nested.length).toBeGreaterThan(0);
          expect(nested.every((row) => row.p === 9)).toBe(true);
          const name = target === 'another collection' ? 'log' : 'rows';
          expect(calls).toStrictEqual(
            nested.map((row) => `${name}:add:${row.id}`)
          );
        } finally {
          tree.destroy();
        }
      }
    }
  );
});

describe('a location subscriber writing during undo', () => {
  it('its write is intercepted', async () => {
    const tree = make([restoration()]);
    try {
      await seed(tree);
      tree.$.count(0);
      await flush();
      const calls = intercept(tree);
      undoable(() => tree.$.count(5));
      await flush();
      let k = 0;
      const stop = (
        tree.$.count as unknown as { subscribe(listener: () => void): () => void }
      ).subscribe(() => tree.$.log.addOne({ id: `sub${++k}`, n: 1 }));
      calls.length = 0;
      tree.undo();
      await flush();
      stop();
      expect(tree.$.count()).toBe(0);
      const nested = tree.$.log.all().filter((row) => row.id.startsWith('sub'));
      expect(nested.length).toBeGreaterThan(0);
      expect(nested.every((row) => row.p === 9)).toBe(true);
      expect(calls).toStrictEqual(nested.map((row) => `log:add:${row.id}`));
    } finally {
      tree.destroy();
    }
  });
});

describe('a path subscriber delivered synchronously during undo', () => {
  it('its write is intercepted (batching disabled: delivery inside the replay)', async () => {
    const notifier = getPathNotifier();
    const tree = make([restoration()]);
    let stop = () => undefined as void;
    try {
      await seed(tree);
      const calls = intercept(tree);
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      notifier.setBatchingEnabled(false);
      let k = 0;
      stop = notifier.subscribe('rows.*', () => {
        if (k === 0) tree.$.log.addOne({ id: `path${++k}`, n: 1 });
      });
      calls.length = 0;
      tree.undo();
      expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 1 });
      expect(tree.$.log.all()).toStrictEqual([{ id: 'path1', n: 1, p: 9 }]);
      expect(calls).toStrictEqual(['log:add:path1']);
    } finally {
      stop();
      notifier.setBatchingEnabled(true);
      tree.destroy();
    }
  });
});

describe('the replay itself, run from inside a user callback', () => {
  it('undo() called from a tap still skips the interceptors for its own writes', async () => {
    const tree = make([restoration()]);
    try {
      await seed(tree);
      const calls = intercept(tree);
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 5, p: 9 });
      let armed = true;
      tree.$.log.tap({
        onAdd: () => {
          if (!armed) return;
          armed = false;
          tree.undo();
        },
      });
      calls.length = 0;
      tree.$.log.addOne({ id: 'trigger', n: 1 });
      await flush();
      expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 1 });
      expect(calls).toStrictEqual(['log:add:trigger']);
    } finally {
      tree.destroy();
    }
  });
});
