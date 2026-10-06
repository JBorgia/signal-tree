import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Found by the entity review: a transaction a tap opens while undo replays
 * (or while another transaction's rollback compensates) kept its write when
 * its callback threw. The same transaction outside a replay rolled back.
 *
 * Root cause: transaction() spread the surrounding write context into its
 * own, so its writes inherited the replay's provenance (`origin:
 * 'restoration'`, or `'transaction-rollback'` with `realized`); transactions
 * and restoration decline replay and compensation writes by that origin, so
 * nothing was captured for the transaction and its rollback had nothing to
 * undo. A transaction is authored work wherever it is opened: it no longer
 * inherits replay provenance.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  log: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

type Replay = [
  string,
  () => unknown[],
  (tree: Tree, replay: () => void) => Promise<void>
];
/** Each runs `replay` from a tap during a replay of a row update. */
const replays: Replay[] = [
  [
    'undo, transactions() then restoration()',
    () => [transactions(), restoration()],
    async (tree, inTap) => {
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      tapOnce(tree, inTap);
      tree.undo();
    },
  ],
  [
    'redo, restoration() then transactions()',
    () => [restoration(), transactions()],
    async (tree, inTap) => {
      undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
      await flush();
      tree.undo();
      await flush();
      tapOnce(tree, inTap);
      tree.redo();
    },
  ],
  [
    "another transaction's rollback, transactions() alone",
    () => [transactions()],
    async (tree, inTap) => {
      const pending = tree.transaction(() =>
        tree.$.rows.updateOne('a', { n: 5 })
      );
      await flush();
      tapOnce(tree, inTap);
      pending.rollback();
    },
  ],
];
const tapOnce = (tree: Tree, inTap: () => void) => {
  let armed = true;
  tree.$.rows.tap({
    onUpdate: () => {
      if (!armed) return;
      armed = false;
      inTap();
    },
  });
};

describe.each(replays)(
  'a transaction opened during %s',
  (_name, enhancers, run) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      return tree;
    };

    it('throwing in its callback rolls its write back', async () => {
      const tree = await make();
      try {
        let error: unknown;
        await run(tree, () => {
          try {
            tree.transaction(() => {
              tree.$.log.addOne({ id: 't1', n: 1 });
              throw new Error('boom');
            });
          } catch (thrown) {
            error = thrown;
          }
        });
        await flush();
        expect((error as Error | undefined)?.message).toBe('boom');
        expect(tree.$.log.ids()).toStrictEqual([]);
      } finally {
        tree.destroy();
      }
    });

    it('an explicit rollback() rolls its write back', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        await run(tree, () => {
          pending = tree.transaction(() =>
            tree.$.log.addOne({ id: 't1', n: 1 })
          );
        });
        await flush();
        expect(tree.$.log.ids()).toStrictEqual(['t1']);
        pending?.rollback();
        await flush();
        expect(tree.$.log.ids()).toStrictEqual([]);
      } finally {
        tree.destroy();
      }
    });

    it('confirming it keeps its write', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        await run(tree, () => {
          pending = tree.transaction(() =>
            tree.$.log.addOne({ id: 't1', n: 1 })
          );
        });
        await flush();
        pending?.confirm();
        await flush();
        expect(tree.$.log.ids()).toStrictEqual(['t1']);
      } finally {
        tree.destroy();
      }
    });
  }
);

// Combining add343ca with the entity line: an UNDOABLE transaction a tap
// opens while an undo, redo or jumpTo applies is authored work (intercepted;
// a rollback reverses its writes) but not an undo entry, as a plain
// `undoable()` write a callback makes then is not one. Entered as one, its
// pending entry truncated the redo future from the position before the
// operation: mid-redo it cut the entry being redone and emptied history (the
// entity line's entity-replay-wrapped-writes.spec.ts, "transaction > batch >
// undoable"); mid-undo it cut nothing, and the confirmed entry landed after
// a redo future it never discarded. Its writes now stand outside undo
// history and the redo future survives.
describe.each([
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'an undoable transaction a tap opens during an undo, redo or jumpTo (%s)',
  (_name, enhancers) => {
    const cases = [
      ['redo', 'confirm', 'a5/L', ['a5/L', 'a6/L'], ['a1/L']],
      ['redo', 'rollback', 'a5/', ['a5/', 'a6/'], ['a1/']],
      ['undo', 'confirm', 'a1/L', ['a5/L', 'a6/L'], []],
      ['undo', 'rollback', 'a1/', ['a5/', 'a6/'], []],
      ['jump', 'confirm', 'a6/L', ['a5/L', 'a6/L'], undefined],
      ['jump', 'rollback', 'a6/', ['a5/', 'a6/'], undefined],
    ] as const;
    it.each(cases)(
      'during %s, then %s: not an undo entry; the redo future survives',
      async (operation, settle, live, states, undone) => {
        const tree = signalTree(declaration(), {
          enhancers: enhancers() as never,
        }) as unknown as Tree;
        try {
          tree.$.rows.addOne({ id: 'a', n: 1 });
          await flush();
          let armed = false;
          let pending: ReturnType<Tree['transaction']> | undefined;
          tree.$.rows.tap({
            onUpdate: () => {
              if (!armed) return;
              armed = false;
              pending = tree.transaction(() =>
                undoable(() => tree.$.log.addOne({ id: 'L', n: 1 }))
              );
            },
          });
          undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
          await flush();
          undoable(() => tree.$.rows.updateOne('a', { n: 6 }));
          await flush();
          tree.undo();
          await flush();
          if (operation === 'redo') {
            tree.undo();
            await flush();
          }
          armed = true;
          if (operation === 'redo') tree.redo();
          else if (operation === 'undo') tree.undo();
          else tree.jumpTo(1);
          await flush();
          const read = () =>
            `${tree.$.rows
              .all()
              .map((row) => `${row.id}${row.n}`)}/${tree.$.log.ids()}`;
          const history = () =>
            tree.getRestorationHistory().map((entry) => {
              const state = entry.state as unknown as {
                rows: { all: Row[] };
                log: { all: Row[] };
              };
              return `${state.rows.all.map(
                (row) => `${row.id}${row.n}`
              )}/${state.log.all.map((row) => row.id)}`;
            });
          expect(pending).toBeDefined();
          expect(history()).toHaveLength(2);
          if (settle === 'confirm') pending?.confirm();
          else pending?.rollback();
          await flush();
          expect(read()).toBe(live);
          expect(history()).toStrictEqual([...states]);
          if (undone === undefined) return;
          const seen: string[] = [];
          while (tree.canUndo()) {
            tree.undo();
            await flush();
            seen.push(read());
          }
          expect(seen).toStrictEqual([...undone]);
          // The redo future survived: redo reaches the entry after a1.
          tree.redo();
          await flush();
          expect(read()).toBe(settle === 'confirm' ? 'a5/L' : 'a5/');
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

// A rollback that takes the declarative path (an order change with an edit
// here) writes back exactly what was recorded and runs no interceptor, while
// a write a tap makes during it is new work and is intercepted. Its entry
// passes the replay-start marker like every compensation entry point (the
// entity line's write-context rule); the prepared-target install it runs
// consults no interceptor itself, so this carries the behaviour, and the
// turn path's marker is carried by entity-replay-wrapped-writes.spec.
describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a declarative rollback is a replay (%s)', (_name, enhancers) => {
  it.each(['rollback()', 'automatic'] as const)(
    '%s: no interceptor for its own writes, a tap write intercepted',
    async (how) => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.setAll([
          { id: 'a', n: 1 },
          { id: 'b', n: 2 },
        ]);
        await flush();
        const calls: string[] = [];
        for (const name of ['rows', 'log'] as const) {
          tree.$[name].intercept({
            onAdd: (row, ctx) => {
              calls.push(`${name}:add:${row.id}`);
              ctx.transform({ ...row, n: row.n + 100 });
            },
            onUpdate: (id, changes, ctx) => {
              calls.push(`${name}:update:${String(id)}`);
              ctx.transform({ ...changes });
            },
          });
        }
        let armed = false;
        const tapWrite = () => {
          if (!armed) return;
          armed = false;
          tree.$.log.addOne({ id: 'T', n: 1 });
        };
        tree.$.rows.tap({
          onAdd: tapWrite,
          onUpdate: tapWrite,
          onRemove: tapWrite,
        });
        // An order change (declarative) that also edits a, so the rollback
        // taps a's update.
        const reorder = () =>
          tree.$.rows.setAll([
            { id: 'b', n: 2 },
            { id: 'a', n: 9 },
          ]);
        if (how === 'automatic') {
          expect(() =>
            tree.transaction(() => {
              reorder();
              calls.length = 0;
              armed = true;
              throw new Error('boom');
            })
          ).toThrow('boom');
        } else {
          const pending = tree.transaction(reorder);
          await flush();
          calls.length = 0;
          armed = true;
          pending.rollback();
        }
        await flush();
        expect(tree.$.rows.all()).toStrictEqual([
          { id: 'a', n: 1 },
          { id: 'b', n: 2 },
        ]);
        expect(calls).toStrictEqual(['log:add:T']);
        expect(tree.$.log.byId('T')?.()).toStrictEqual({ id: 'T', n: 101 });
      } finally {
        tree.destroy();
      }
    }
  );
});
