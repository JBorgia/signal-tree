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
