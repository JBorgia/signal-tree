import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Several order changes reversed in ONE transition (jumpTo, or returning from a
 * jumpTo view across them): each applies only at the exact order it recorded,
 * so they are applied one after another. Single-shot, jumpTo across two
 * consecutive setAll reorders threw "Declarative order replay requires
 * transition-level delta composition".
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const rows = (ids: string): Row[] => [...ids].map((id) => ({ id, n: 0 }));
const typed = () =>
  signalTree(
    { rows: entityMap<Row, string>(), x: 0 },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof typed>;

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('order changes reversed together (%s)', (_name, enhancers) => {
  const make = async (): Promise<Tree> => {
    const tree = signalTree(
      { rows: entityMap<Row, string>(), x: 0 },
      { enhancers: enhancers() as never }
    ) as unknown as Tree;
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    undoable(() => tree.$.x(1));
    await flush();
    undoable(() => tree.$.rows.setAll(rows('CBA')));
    await flush();
    undoable(() => tree.$.x(2));
    await flush();
    undoable(() => tree.$.rows.setAll(rows('BCA')));
    await flush();
    return tree;
  };
  const state = (tree: Tree) => ({ ids: tree.$.rows.ids(), x: tree.$.x() });

  it('jumpTo back across two reorders, then forward again', async () => {
    const tree = await make();
    try {
      tree.jumpTo(0);
      await flush();
      expect(state(tree)).toStrictEqual({ ids: ['A', 'B', 'C'], x: 1 });
      tree.jumpTo(3);
      await flush();
      expect(state(tree)).toStrictEqual({ ids: ['B', 'C', 'A'], x: 2 });
      tree.jumpTo(1);
      await flush();
      expect(state(tree)).toStrictEqual({ ids: ['C', 'B', 'A'], x: 1 });
    } finally {
      tree.destroy();
    }
  });

  it('undo from a jumpTo view returns across the reorders first', async () => {
    const tree = await make();
    try {
      tree.jumpTo(0);
      await flush();
      tree.undo();
      await flush();
      expect(state(tree)).toStrictEqual({ ids: ['C', 'B', 'A'], x: 2 });
      tree.redo();
      await flush();
      expect(state(tree)).toStrictEqual({ ids: ['B', 'C', 'A'], x: 2 });
    } finally {
      tree.destroy();
    }
  });

  it('undo and redo step through them one at a time', async () => {
    const tree = await make();
    try {
      const seen: unknown[] = [];
      for (let i = 0; i < 4; i++) {
        tree.undo();
        await flush();
        seen.push(state(tree));
      }
      expect(seen).toStrictEqual([
        { ids: ['C', 'B', 'A'], x: 2 },
        { ids: ['C', 'B', 'A'], x: 1 },
        { ids: ['A', 'B', 'C'], x: 1 },
        { ids: ['A', 'B', 'C'], x: 0 },
      ]);
      for (let i = 0; i < 4; i++) {
        tree.redo();
        await flush();
      }
      expect(state(tree)).toStrictEqual({ ids: ['B', 'C', 'A'], x: 2 });
    } finally {
      tree.destroy();
    }
  });
});
