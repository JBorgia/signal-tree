import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * `getCurrentIndex()` is the history entry the visible state corresponds to:
 * after undo(), redo() or a write, the LATEST APPLIED entry (-1 when none);
 * during a jumpTo() view, the viewed entry. Public undo/redo is whole-tree
 * (undo the latest applied entry, redo the earliest unapplied one), so the
 * applied entries are always a prefix of history and, outside a jumpTo view,
 * this single number says how far you can go:
 *
 *   undo steps available   getCurrentIndex() + 1
 *   redo steps available   getRestorationHistory().length - 1 - getCurrentIndex()
 *
 * On npm 15.4.3 only jumpTo() and history changes moved it; undo() and redo()
 * left it where it was, contradicting docs/guides/time-travel-in-production.md
 * (found by the v15 known-issues audit).
 */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const typed = () =>
  signalTree({ n: 0 }, { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const typedTwoFields = () =>
  signalTree({ n: 0, m: 0 }, { enhancers: [transactions(), restoration()] });
type TwoFieldTree = ReturnType<typeof typedTwoFields>;

const steps = (tree: Tree) => ({
  index: tree.getCurrentIndex(),
  back: tree.getCurrentIndex() + 1,
  forward: tree.getRestorationHistory().length - 1 - tree.getCurrentIndex(),
  n: tree.$.n(),
});

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('getCurrentIndex (%s)', (_name, enhancers) => {
  const make = (): Tree =>
    signalTree(
      { n: 0 },
      { enhancers: enhancers() as never }
    ) as unknown as Tree;
  const write3 = async (tree: Tree) => {
    for (const value of [1, 2, 3]) {
      undoable(() => tree.$.n(value));
      await flush();
    }
  };

  it('follows undo and redo', async () => {
    const tree = make();
    try {
      expect(tree.getCurrentIndex()).toBe(-1);
      await write3(tree);
      expect(steps(tree)).toStrictEqual({
        index: 2,
        back: 3,
        forward: 0,
        n: 3,
      });
      tree.undo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 1,
        back: 2,
        forward: 1,
        n: 2,
      });
      tree.undo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 0,
        back: 1,
        forward: 2,
        n: 1,
      });
      tree.undo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: -1,
        back: 0,
        forward: 3,
        n: 0,
      });
      expect(tree.canUndo()).toBe(false);
      tree.redo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 0,
        back: 1,
        forward: 2,
        n: 1,
      });
      tree.redo();
      tree.redo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 2,
        back: 3,
        forward: 0,
        n: 3,
      });
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  // jumpTo() is a VIEW (temporal rewind/inspection), separate from the undo
  // cursor: the index shows the viewed entry, and undo()/redo() first return
  // to the confirmed position and step from there — the index follows.
  it('shows the jumpTo view, then follows undo/redo from the confirmed position', async () => {
    const tree = make();
    try {
      await write3(tree);
      tree.undo();
      tree.undo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 0,
        back: 1,
        forward: 2,
        n: 1,
      });
      tree.jumpTo(2);
      await flush();
      expect(tree.getCurrentIndex()).toBe(2);
      expect(tree.$.n()).toBe(3);
      tree.undo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: -1,
        back: 0,
        forward: 3,
        n: 0,
      });
      tree.jumpTo(1);
      await flush();
      expect(tree.getCurrentIndex()).toBe(1);
      expect(tree.$.n()).toBe(2);
      tree.redo();
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 0,
        back: 1,
        forward: 2,
        n: 1,
      });
    } finally {
      tree.destroy();
    }
  });

  it('the step counts are the number of undo/redo calls that succeed', async () => {
    const tree = make();
    try {
      await write3(tree);
      tree.undo();
      await flush();
      const { back, forward } = steps(tree);
      let undone = 0;
      while (tree.canUndo()) {
        tree.undo();
        await flush();
        undone += 1;
      }
      expect(undone).toBe(back);
      let redone = 0;
      while (tree.canRedo()) {
        tree.redo();
        await flush();
        redone += 1;
      }
      expect(redone).toBe(back + forward);
    } finally {
      tree.destroy();
    }
  });

  it('a new write after undo truncates the redo future and lands at the end', async () => {
    const tree = make();
    try {
      await write3(tree);
      tree.undo();
      tree.undo();
      await flush();
      undoable(() => tree.$.n(9));
      await flush();
      expect(steps(tree)).toStrictEqual({
        index: 1,
        back: 2,
        forward: 0,
        n: 9,
      });
    } finally {
      tree.destroy();
    }
  });
});

// ── The index is the latest applied entry after every history change ────────
// (review of 30c6a90e: insertConfirmedTurn set it to the last entry, so a
// confirmation after an undo claimed an undone entry was applied; and leaving
// a jumpTo view did not move it, so a throwing undo left it at the view).
describe.each([
  [
    'transactions(), restoration()',
    (maxHistorySize?: number) => [
      transactions(),
      restoration(maxHistorySize === undefined ? {} : { maxHistorySize }),
    ],
  ],
  [
    'restoration(), transactions()',
    (maxHistorySize?: number) => [
      restoration(maxHistorySize === undefined ? {} : { maxHistorySize }),
      transactions(),
    ],
  ],
] as const)(
  'getCurrentIndex after history changes (%s)',
  (_name, enhancers) => {
    const make = (maxHistorySize?: number): Tree =>
      signalTree(
        { n: 0 },
        { enhancers: enhancers(maxHistorySize) as never }
      ) as unknown as Tree;
    const write = async (tree: Tree, value: number) => {
      undoable(() => tree.$.n(value));
      await flush();
    };

    it('a transaction confirmed after a later write was undone lands at the applied prefix', async () => {
      const tree = signalTree(
        { n: 0, m: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as TwoFieldTree;
      try {
        let pending: { confirm(): void } | undefined;
        undoable(() => {
          pending = tree.transaction(() => tree.$.m(1));
        });
        await flush();
        undoable(() => tree.$.n(2));
        await flush();
        tree.undo();
        await flush();
        expect(tree.getCurrentIndex()).toBe(-1);
        pending?.confirm();
        await flush();
        expect(tree.getRestorationHistory()).toHaveLength(2);
        expect(tree.getCurrentIndex()).toBe(0);
        expect([tree.canUndo(), tree.canRedo()]).toStrictEqual([true, true]);
        tree.redo();
        await flush();
        expect([tree.getCurrentIndex(), tree.$.n(), tree.$.m()]).toStrictEqual([
          1, 2, 1,
        ]);
      } finally {
        tree.destroy();
      }
    });

    it('a write during a jumpTo view truncates the future and lands at the end', async () => {
      const tree = make();
      try {
        for (const value of [1, 2, 3]) await write(tree, value);
        tree.jumpTo(0);
        await flush();
        await write(tree, 9);
        expect(steps(tree)).toStrictEqual({
          index: 1,
          back: 2,
          forward: 0,
          n: 9,
        });
      } finally {
        tree.destroy();
      }
    });

    it('eviction keeps the index on the latest applied entry', async () => {
      const tree = make(2);
      try {
        for (const value of [1, 2, 3]) await write(tree, value);
        expect(steps(tree)).toStrictEqual({
          index: 1,
          back: 2,
          forward: 0,
          n: 3,
        });
        tree.undo();
        await flush();
        expect(steps(tree)).toStrictEqual({
          index: 0,
          back: 1,
          forward: 1,
          n: 2,
        });
        await write(tree, 7);
        expect(steps(tree)).toStrictEqual({
          index: 1,
          back: 2,
          forward: 0,
          n: 7,
        });
      } finally {
        tree.destroy();
      }
    });

    it('a reset empties history and the index', async () => {
      const tree = make();
      try {
        for (const value of [1, 2]) await write(tree, value);
        tree.undo();
        await flush();
        (
          tree as unknown as { resetRestorationHistory(): void }
        ).resetRestorationHistory();
        expect(steps(tree)).toStrictEqual({
          index: -1,
          back: 0,
          forward: 0,
          n: 1,
        });
        await write(tree, 5);
        expect(steps(tree)).toStrictEqual({
          index: 0,
          back: 1,
          forward: 0,
          n: 5,
        });
      } finally {
        tree.destroy();
      }
    });

    it('an undo that throws after leaving a jumpTo view leaves the index at the undo position', async () => {
      const tree = make();
      const realIndexOf = Array.prototype.indexOf;
      try {
        for (const value of [1, 2, 3]) await write(tree, value);
        tree.undo();
        await flush();
        tree.jumpTo(2);
        await flush();
        expect([tree.getCurrentIndex(), tree.$.n()]).toStrictEqual([2, 3]);
        // The next indexOf inside undoPosition throws: after the view has gone
        // back to the undo position, before the undo itself applies. (Fault
        // injection by instrumenting a builtin, as entity-large-batches does.)
        Array.prototype.indexOf = function (
          this: unknown[],
          ...args: [unknown, number?]
        ) {
          if ((new Error().stack ?? '').includes('undoPosition')) {
            Array.prototype.indexOf = realIndexOf;
            throw new Error('INJECTED undo fault');
          }
          return realIndexOf.apply(this, args);
        } as typeof realIndexOf;
        expect(() => tree.undo()).toThrow('INJECTED undo fault');
        Array.prototype.indexOf = realIndexOf;
        await flush();
        expect(steps(tree)).toStrictEqual({
          index: 1,
          back: 2,
          forward: 1,
          n: 2,
        });
      } finally {
        Array.prototype.indexOf = realIndexOf;
        tree.destroy();
      }
    });
  }
);
