import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { restoration } from './restoration';
import { transactions } from '../transactions/transactions';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('RESTORATION-HISTORICAL-MATERIALIZATION-0', () => {
  it('retains no strong state on confirmed turns while public state remains exact', async () => {
    const tree = signalTree(
      { count: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() => tree.$.count(1));
    await flush();

    const retained = (
      tree as unknown as {
        __restoration: { history: Array<{ state?: unknown }> };
      }
    ).__restoration.history;
    expect(retained).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(retained[0], 'state')).toBe(
      false
    );
    expect(tree.getRestorationHistory()[0].state).toEqual({ count: 1 });
  });

  it('keeps undesignated gap work out of the earlier retained boundary', async () => {
    const tree = signalTree(
      { designated: 0, ambient: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );

    undoable(() => tree.$.designated(1));
    await flush();
    tree.$.ambient(1);
    await flush();
    undoable(() => tree.$.designated(2));
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

    undoable(() => tree.$.designated(1));
    await flush();
    withWriteContext({ participation: 'realized' }, () =>
      tree.$.external(1)
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
    undoable(() => tree.$.left(1));
    await flush();
    undoable(() => tree.$.right(1));
    await flush();
    const manager = (
      tree as unknown as {
        __restoration: {
          history: Array<{ __positionIds?: number[] }>;
          undoPosition(positionId: number): number[];
        };
      }
    ).__restoration;
    const leftPosition = manager.history[0].__positionIds?.[0];
    if (leftPosition === undefined) {
      throw new Error('Expected left position');
    }
    manager.undoPosition(leftPosition);

    undoable(() => tree.$.left(2));
    await flush();

    expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: 1 },
    ]);
  });

  it('does not admit a pre-reset transaction when it confirms later', async () => {
    const tree = signalTree(
      { count: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    const pending = tree.transaction(() => undoable(() => tree.$.count(1)));

    tree.resetRestorationHistory();
    pending.confirm();
    await flush();

    expect(tree.getRestorationHistory()).toEqual([]);
  });
});
