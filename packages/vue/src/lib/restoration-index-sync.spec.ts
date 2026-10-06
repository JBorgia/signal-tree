import { watch } from 'vue';
import { describe, expect, it } from 'vitest';

import { restoration, signalTree, undoable } from '../index';

/**
 * `getCurrentIndex()` and `canUndo()`/`canRedo()` change together: a
 * synchronous watcher never sees one updated and the other stale. Undo and
 * redo moved the index only after the frontier change that `canUndo()` reads
 * had been published (review of 30c6a90e).
 */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('restoration index and frontier under synchronous watchers', () => {
  it('undo and redo publish the index and canUndo/canRedo together', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      for (const value of [1, 2]) {
        undoable(() => tree.$({ n: value }));
        await flush();
      }
      const seen: Array<[number, boolean, boolean]> = [];
      const stop = watch(
        () =>
          [tree.getCurrentIndex(), tree.canUndo(), tree.canRedo()] as [
            number,
            boolean,
            boolean
          ],
        (state) => seen.push(state),
        { flush: 'sync' }
      );
      tree.undo();
      tree.undo();
      tree.redo();
      stop();
      const consistent = ([index, canUndo, canRedo]: [
        number,
        boolean,
        boolean
      ]) => canUndo === index >= 0 && canRedo === index < 1;
      expect(seen.filter((state) => !consistent(state))).toStrictEqual([]);
      expect(seen.at(-1)).toStrictEqual([0, true, true]);
    } finally {
      tree.destroy();
    }
  });
});
