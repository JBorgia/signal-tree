import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * An ordinary later write (authored, not undoable) does not remove a turn's
 * undo eligibility, and undo restores the turn's pre-image (15.4.2): over a
 * scalar, `undoable(x(1)); x(2); undo()` gives 0 and redo gives 1.
 *
 * For a row the turn ADDED, the pre-image is "this lifetime absent". When an
 * ordinary later write already removed it, that holds, so undo leaves the row
 * as it is and reverses the rest of the turn. It threw instead, untyped,
 * "Unsupported scoped undo effect at structural-drift" (identical on 15.4.3;
 * a refused rollback then confirm reaches it too): the removal it planned
 * found no such row.
 *
 * Redo re-applies the turn's after-image, as over a scalar: it adds the row
 * back as the turn recorded it. If an ordinary write put a DIFFERENT lifetime
 * at that key, that row is not this turn's: undo and redo leave it alone, and
 * the turn's own row stays absent.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const configurations = [
  ['restoration()', () => [restoration()], false],
  [
    'transactions(), restoration()',
    () => [transactions(), restoration()],
    true,
  ],
  [
    'restoration(), transactions()',
    () => [restoration(), transactions()],
    true,
  ],
] as const;

const read = (tree: Tree) =>
  `x=${tree.$.x()} ${tree.$.rows
    .all()
    .map((row) => `${row.id}${row.n}`)
    .join(',')}`;

type Shape = {
  turn: (tree: Tree) => void;
  later: (tree: Tree) => void;
  /** Live state after the later work, after undo, after redo, after undo. */
  states: [string, string, string, string];
};
const shapes: Record<string, Shape> = {
  'an added row, removed by an ordinary write (the review shape)': {
    turn: (tree) => tree.$.rows.addOne({ id: 'a', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2', 'x=0 b2', 'x=0 b2,a1', 'x=0 b2'],
  },
  'an added row and a scalar, the row removed by an ordinary write': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.x(1);
    },
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a1', 'x=0 b2'],
  },
  'two added rows, one removed by an ordinary write': {
    turn: (tree) =>
      tree.$.rows.addMany([
        { id: 'a', n: 1 },
        { id: 'c', n: 3 },
      ]),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2,c3', 'x=0 b2', 'x=0 b2,a1,c3', 'x=0 b2'],
  },
  'a prepended row (an order change), removed by an ordinary write': {
    turn: (tree) => tree.$.rows.prependOne({ id: 'a', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2', 'x=0 b2', 'x=0 a1,b2', 'x=0 b2'],
  },
  'an added row edited, then removed, by ordinary writes': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.x(1);
    },
    later: (tree) => {
      tree.$.rows.updateOne('a', { n: 4 });
      tree.$.rows.removeOne('a');
    },
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a1', 'x=0 b2'],
  },
  'an added row written again in the same turn, removed by an ordinary write': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.rows.updateOne('a', { n: 3 });
      tree.$.x(1);
    },
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a3', 'x=0 b2'],
  },
  'the key re-occupied by a new lifetime': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.x(1);
    },
    later: (tree) => {
      tree.$.rows.removeOne('a');
      tree.$.rows.addOne({ id: 'a', n: 9 });
    },
    // Not this turn's row: undo and redo leave a9 alone.
    states: ['x=1 b2,a9', 'x=0 b2,a9', 'x=1 b2,a9', 'x=0 b2,a9'],
  },
};

describe.each(configurations)(
  'undo of a turn whose added row an ordinary later write removed (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(shapes))('%s', async (name) => {
      const shape = shapes[name];
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.addMany([{ id: 'b', n: 2 }]);
        await flush();
        undoable(() => shape.turn(tree));
        await flush();
        shape.later(tree);
        await flush();
        const seen = [read(tree)];
        tree.undo();
        await flush();
        expect(() => tree.getRestorationHistory()).not.toThrow();
        seen.push(read(tree));
        expect(tree.canUndo()).toBe(false);
        tree.redo();
        await flush();
        seen.push(read(tree));
        tree.undo();
        await flush();
        seen.push(read(tree));
        expect(seen).toStrictEqual(shape.states);
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each(
  configurations.filter(([, , withTransactions]) => withTransactions)
)(
  'a refused rollback, then confirm, then an ordinary removal (%s)',
  (_name, enhancers) => {
    it('undo reverses the rest of the turn; redo adds the row back', async () => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.addMany([{ id: 'b', n: 2 }]);
        await flush();
        const pending = tree.transaction(() =>
          undoable(() => {
            tree.$.rows.addOne({ id: 'a', n: 1 });
            tree.$.x(1);
          })
        );
        await flush();
        // Later work edits the created row and keeps it: a dependency.
        tree.$.rows.updateOne('a', { n: 2 });
        await flush();
        expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
        pending.confirm();
        await flush();
        tree.$.rows.removeOne('a');
        await flush();
        expect(read(tree)).toBe('x=1 b2');
        tree.undo();
        await flush();
        expect(read(tree)).toBe('x=0 b2');
        expect(() => tree.getRestorationHistory()).not.toThrow();
        tree.redo();
        await flush();
        expect(read(tree)).toBe('x=1 b2,a1');
      } finally {
        tree.destroy();
      }
    });
  }
);
