import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { batching } from '../enhancers/batching/batching';

/**
 * A write a tap makes during a replay is intercepted however the tap wraps it
 * — in a transaction, a batch, a coalesce, an undoable, or several of them
 * nested.
 *
 * 31584797 snapshotted the replay whenever a write context with a replay
 * origin was entered. `transaction()` spreads the ambient context into its own
 * frame, so a transaction a tap opened during undo inherited
 * `origin: 'restoration'`, was snapshotted as a replay at the tap's depth, and
 * its writes skipped every interceptor (reviewer's probe A4: calls `[]` for the
 * transaction, intercepted for a batch or a plain write). A replay is now
 * recognised only where one begins: outside any replay, nested in the live one
 * at its own depth, or as a different kind of replay (a rollback inside an
 * undo's tap). A frame inside a user callback that merely inherits the
 * replay's origin is not one.
 */
type Row = { id: string; n: number; p?: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  log: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), {
    enhancers: [transactions(), restoration(), batching()],
  });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const wrappers: Record<string, (tree: Tree, write: () => void) => void> = {
  transaction: (tree, write) => void tree.transaction(write),
  batch: (tree, write) => tree.batch(write),
  coalesce: (tree, write) => tree.coalesce(write),
  undoable: (_tree, write) => undoable(write),
  'transaction > batch > undoable': (tree, write) =>
    void tree.transaction(() => tree.batch(() => undoable(write))),
  'batch > transaction > coalesce': (tree, write) =>
    tree.batch(() => void tree.transaction(() => tree.coalesce(write))),
};
const names = Object.keys(wrappers);
// A compensation runs under its transaction's id, and transactions do not
// nest: a tap that opens one during a rollback is refused by transactions()
// itself ("Nested transaction is not supported"), whoever intercepts.
const rollbackNames = names.filter((name) => !name.includes('transaction'));

/** Transforming interceptors on both collections, recording every call. */
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

/** A tap on `rows` that, while armed, writes one `log` row through `wrap`. */
const tapWrites = (tree: Tree, wrap: string) => {
  const state = { armed: false, k: 0, prefix: '' };
  const write = () => {
    if (!state.armed) return;
    state.armed = false;
    const id = `${state.prefix}${++state.k}`;
    wrappers[wrap](tree, () => void tree.$.log.addOne({ id, n: 1 }));
  };
  tree.$.rows.tap({ onAdd: write, onUpdate: write, onRemove: write });
  return state;
};

const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'a', n: 1 });
  await flush();
};

const expectIntercepted = (tree: Tree, calls: string[], prefix: string) => {
  const nested = tree.$.log.all().filter((row) => row.id.startsWith(prefix));
  expect(nested).toHaveLength(1);
  expect(nested[0].p).toBe(9);
  // The tap's write is the only interceptor call: the replay itself has none.
  expect(calls).toStrictEqual([`log:add:${nested[0].id}`]);
};

const undoConfigs = [
  ['transactions(), restoration(), batching()', () => [transactions(), restoration(), batching()]],
  ['restoration(), transactions(), batching()', () => [restoration(), transactions(), batching()]],
  ['batching(), transactions(), restoration()', () => [batching(), transactions(), restoration()]],
] as const;

describe.each(undoConfigs)('a wrapped tap write during undo, redo, jumpTo (%s)', (_name, enhancers) => {
  it.each(names)('wrapped in %s: intercepted at every step', async (wrap) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const tap = tapWrites(tree, wrap);
      const calls = intercept(tree);
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      for (const step of ['undo', 'redo', 'jump'] as const) {
        if (step === 'jump') {
          tree.undo();
          await flush();
        }
        calls.length = 0;
        tap.armed = true;
        tap.prefix = step;
        if (step === 'undo') tree.undo();
        if (step === 'redo') tree.redo();
        if (step === 'jump') tree.jumpTo(tree.getRestorationHistory().length - 1);
        await flush();
        tap.armed = false;
        expectIntercepted(tree, calls, step);
      }
      // The replay's own writes were exact: no interceptor touched row a.
      expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 5, p: 9 });
    } finally {
      tree.destroy();
    }
  });
});

describe.each(undoConfigs)('a wrapped tap write during rollback (%s)', (_name, enhancers) => {
  it.each(rollbackNames)('wrapped in %s: rollback() and automatic compensation', async (wrap) => {
    for (const automatic of [false, true]) {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const tap = tapWrites(tree, wrap);
        const calls = intercept(tree);
        if (automatic) {
          expect(() =>
            tree.transaction(() => {
              tree.$.rows.updateOne('a', { n: 5 });
              calls.length = 0;
              tap.armed = true;
              tap.prefix = 'comp';
              throw new Error('boom');
            })
          ).toThrow('boom');
        } else {
          const pending = tree.transaction(() =>
            tree.$.rows.updateOne('a', { n: 5 })
          );
          await flush();
          calls.length = 0;
          tap.armed = true;
          tap.prefix = 'comp';
          pending.rollback();
        }
        await flush();
        tap.armed = false;
        expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 1 });
        expectIntercepted(tree, calls, 'comp');
      } finally {
        tree.destroy();
      }
    }
  });
});

describe('a genuine replay started from a callback inside a wrapper', () => {
  it('undo() run inside a transaction-free batch in a tap still skips interceptors', async () => {
    const tree = make([transactions(), restoration(), batching()]);
    try {
      await seed(tree);
      const calls = intercept(tree);
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      let armed = true;
      tree.$.log.tap({
        onAdd: () => {
          if (!armed) return;
          armed = false;
          tree.batch(() => tree.undo());
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
