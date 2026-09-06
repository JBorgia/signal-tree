import { undoable } from '../../lib/undoable';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { restoration } from './restoration';

/**
 * `canUndo()`, `canRedo()` and `getRestorationHistory()` are REACTIVE.
 *
 * They read a plain number and a plain array before this. Called imperatively
 * they were always correct, which is why it survived — and a
 * `computed(() => tree.canUndo())` evaluated exactly once and cached the answer
 * forever, because it took a dependency on nothing at all.
 *
 * Zone-based change detection hid it: the template re-read the method on every
 * cycle, so the button looked right. Zoneless has nothing to trigger that
 * re-read, so an undo button in a zoneless app never enabled — in a library
 * whose entire premise is signals, for its flagship enhancer.
 *
 * Every test here wraps the call in a `computed`, because calling the method
 * directly cannot fail and is what let this ship. The recompute COUNTS are
 * asserted too: a `computed` that returns the right value while never
 * re-evaluating is the exact bug, and value assertions alone would pass against
 * it if the initial value happened to match.
 */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the imperative API is unchanged', () => {
  it('direct calls still return the same answers', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    expect(tree.canUndo()).toBe(false);

    undoable(() => tree.$.n(1));
    await flush();
    expect(tree.canUndo()).toBe(true);
    expect(tree.canRedo()).toBe(false);

    tree.undo();
    await flush();
    expect(tree.$.n()).toBe(0);
    expect(tree.canRedo()).toBe(true);
  });

  it('maxHistorySize still evicts, and the position follows', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 3 })] }
    );
    for (let i = 1; i <= 6; i++) {
      undoable(() => tree.$.n(i));
      await flush();
    }
    expect(tree.getRestorationHistory().length).toBeLessThanOrEqual(3);
    expect(tree.getCurrentIndex()).toBe(tree.getRestorationHistory().length - 1);
  });
});
