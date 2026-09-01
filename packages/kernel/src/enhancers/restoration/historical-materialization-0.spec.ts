import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { restoration } from './restoration';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('RESTORATION-HISTORICAL-MATERIALIZATION-0', () => {
  it('keeps undesignated gap work out of the earlier retained boundary', async () => {
    const tree = signalTree(
      { designated: 0, ambient: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );

    undoable(() => tree.$.designated.set(1));
    await flush();
    tree.$.ambient.set(1);
    await flush();
    undoable(() => tree.$.designated.set(2));
    await flush();

    expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
      { designated: 1, ambient: 0 },
      { designated: 2, ambient: 1 },
    ]);
  });

  it('rewinds external tail truth when materializing the newest boundary', async () => {
    const tree = signalTree(
      { designated: 0, external: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );

    undoable(() => tree.$.designated.set(1));
    await flush();
    withWriteContext({ participation: 'realized' }, () =>
      tree.$.external.set(1)
    );
    await flush();

    expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
      { designated: 1, external: 0 },
    ]);
  });

  it('preserves independent later events when truncating a scoped redo branch', async () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() => tree.$.left.set(1));
    await flush();
    undoable(() => tree.$.right.set(1));
    await flush();
    const manager = (tree as unknown as {
      __restoration: {
        history: Array<{ __positionIds?: number[] }>;
        undoPosition(positionId: number): number[];
      };
    }).__restoration;
    const leftPosition = manager.history[0].__positionIds?.[0];
    if (leftPosition === undefined) {
      throw new Error('Expected left position');
    }
    manager.undoPosition(leftPosition);

    undoable(() => tree.$.left.set(2));
    await flush();

    expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 1 },
    ]);
  });
});
