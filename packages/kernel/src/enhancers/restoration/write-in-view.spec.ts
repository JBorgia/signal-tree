import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * A write made while viewing a `jumpTo()` position makes that view the
 * present: the entries after the viewed one are its future and are
 * discarded; the viewed entry and everything before it stay in history,
 * applied, so undo, redo and jumpTo walk the right states.
 *
 * Found during the 15.4.4 combination (both lines had it): after
 * `undo(); jumpTo(1)`, a FORWARD jump into a view, the scoped redo truncation
 * read the frontiers, which a view never moves, so it discarded the viewed
 * entry and everything after the confirmed position while their effects
 * stayed live. History read ["a6/", "a6/L"] and undo went from a6 straight
 * to a1. A transaction rolled back in a view kept the view's stale indexes
 * (undo then walked entries the truncation had removed).
 *
 * A plain (not undoable) write is no undo entry and does not end a view: the
 * view keeps its documented rule (undo and redo from a view return to the
 * confirmed position first), and history is unchanged. Pinned below.
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

type Kind =
  | 'undoable'
  | 'plain'
  | 'transaction confirmed'
  | 'transaction rolled back';
const configurations = [
  ['restoration()', () => [restoration()], ['undoable', 'plain']],
  [
    'transactions(), restoration()',
    () => [transactions(), restoration()],
    ['undoable', 'plain', 'transaction confirmed', 'transaction rolled back'],
  ],
  [
    'restoration(), transactions()',
    () => [restoration(), transactions()],
    ['undoable', 'plain', 'transaction confirmed', 'transaction rolled back'],
  ],
] as const;

const read = (tree: Tree) =>
  `${tree.$.rows.all().map((row) => `${row.id}${row.n}`)}/${tree.$.log.ids()}`;
const history = (tree: Tree) =>
  tree.getRestorationHistory().map((entry) => {
    const state = entry.state as unknown as {
      rows: { all: Row[] };
      log: { all: Row[] };
    };
    return `${state.rows.all.map(
      (row) => `${row.id}${row.n}`
    )}/${state.log.all.map((row) => row.id)}`;
  });

/** a5, a6, a7: the state after each of the three entries. */
const after = (index: number) => `a${5 + index}/`;
const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, at) => from + at);

describe.each(configurations)(
  'a write in a jumpTo view (%s)',
  (_name, enhancers, kinds) => {
    for (const direction of ['forward', 'backward'] as const)
      for (const [position, view] of [
        ['start', 0],
        ['middle', 1],
        ['newest', 2],
      ] as const)
        it.each(kinds as readonly Kind[])(
          `${direction} into the ${position} entry, then %s`,
          async (kind) => {
            const tree = signalTree(declaration(), {
              enhancers: enhancers() as never,
            }) as unknown as Tree;
            try {
              tree.$.rows.addOne({ id: 'a', n: 1 });
              await flush();
              for (const n of [5, 6, 7]) {
                undoable(() => tree.$.rows.updateOne('a', { n }));
                await flush();
              }
              // Forward: from before every entry; backward: from the newest.
              if (direction === 'forward')
                for (let step = 0; step < 3; step++) {
                  tree.undo();
                  await flush();
                }
              tree.jumpTo(view);
              await flush();
              expect(read(tree)).toBe(after(view));

              const write = () => tree.$.log.addOne({ id: 'L', n: 1 });
              if (kind === 'undoable') undoable(write);
              else if (kind === 'plain') write();
              else {
                const pending = tree.transaction(() => undoable(write));
                if (kind === 'transaction confirmed') pending.confirm();
                else pending.rollback();
              }
              await flush();

              const undone: string[] = [];
              const redone: string[] = [];
              const walk = async () => {
                while (tree.canUndo()) {
                  tree.undo();
                  await flush();
                  undone.push(read(tree));
                }
                while (tree.canRedo()) {
                  tree.redo();
                  await flush();
                  redone.push(read(tree));
                }
              };

              if (kind === 'plain') {
                // No undo entry: the view and history stay as they were.
                expect(read(tree)).toBe(`${after(view)}L`);
                expect(history(tree)).toStrictEqual([
                  after(0),
                  after(1),
                  after(2),
                ]);
                expect(tree.getCurrentIndex()).toBe(view);
                await walk();
                const confirmed = direction === 'forward' ? -1 : 2;
                expect(undone).toStrictEqual(
                  range(0, confirmed - 1)
                    .reverse()
                    .map((index) => `${after(index)}L`)
                    .concat(confirmed >= 0 ? ['a1/L'] : [])
                );
                expect(redone).toStrictEqual(
                  range(0, 2).map((index) => `${after(index)}L`)
                );
                return;
              }

              const kept = range(0, view).map(after);
              if (kind === 'transaction rolled back') {
                // The view's future is discarded with the pending entry; the
                // viewed entry and those before it stay, applied.
                expect(read(tree)).toBe(after(view));
                expect(history(tree)).toStrictEqual(kept);
                expect(tree.getCurrentIndex()).toBe(view);
                await walk();
                expect(undone).toStrictEqual(
                  range(0, view - 1)
                    .reverse()
                    .map(after)
                    .concat(['a1/'])
                );
                expect(redone).toStrictEqual(kept);
                return;
              }

              expect(read(tree)).toBe(`${after(view)}L`);
              expect(history(tree)).toStrictEqual([...kept, `${after(view)}L`]);
              expect(tree.getCurrentIndex()).toBe(view + 1);
              await walk();
              expect(undone).toStrictEqual(
                range(0, view).reverse().map(after).concat(['a1/'])
              );
              expect(redone).toStrictEqual([...kept, `${after(view)}L`]);
              // And a jump back into the history lands exactly.
              tree.jumpTo(view);
              await flush();
              expect(read(tree)).toBe(after(view));
            } finally {
              tree.destroy();
            }
          }
        );
  }
);

// The same with plain writes standing between the entries (historical gaps):
// the viewed entry's state keeps the gaps made before it, the new entry's
// every gap, and undo walks the entries with the gaps standing.
describe.each(configurations)(
  'a write in a jumpTo view, gaps between the entries (%s)',
  (_name, enhancers) => {
    for (const direction of ['forward', 'backward'] as const)
      it.each([0, 1, 2])(
        `${direction} into entry %i, then an undoable write`,
        async (view) => {
          const tree = signalTree(declaration(), {
            enhancers: enhancers() as never,
          }) as unknown as Tree;
          try {
            tree.$.rows.addOne({ id: 'a', n: 1 });
            await flush();
            for (const n of [5, 6, 7]) {
              undoable(() => tree.$.rows.updateOne('a', { n }));
              await flush();
              tree.$.log.addOne({ id: `g${n}`, n });
              await flush();
            }
            if (direction === 'forward')
              for (let step = 0; step < 3; step++) {
                tree.undo();
                await flush();
              }
            tree.jumpTo(view);
            await flush();
            undoable(() => tree.$.log.addOne({ id: 'L', n: 1 }));
            await flush();
            const gaps = 'g5,g6,g7';
            expect(history(tree)).toStrictEqual([
              ...range(0, view).map(
                (index) =>
                  `${after(index)}${range(5, 4 + index).map((n) => `g${n}`)}`
              ),
              `${after(view)}${gaps},L`,
            ]);
            expect(tree.getCurrentIndex()).toBe(view + 1);
            const undone: string[] = [];
            while (tree.canUndo()) {
              tree.undo();
              await flush();
              undone.push(read(tree));
            }
            expect(undone).toStrictEqual([
              ...range(0, view)
                .reverse()
                .map((index) => `${after(index)}${gaps}`),
              `a1/${gaps}`,
            ]);
          } finally {
            tree.destroy();
          }
        }
      );
  }
);
