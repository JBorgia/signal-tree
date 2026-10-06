import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { getPathNotifier } from '../../lib/path-notifier';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import {
  checkRollback,
  checkUndoRedo,
  configurations,
  type Op,
} from '../test-helpers/reversal-fuzz-harness';
import { transactions } from './transactions';

/**
 * Carriers for the reversal order model (`insertion-order.ts`): a reversal
 * re-inserts rows first and deletes last; restores replay later removals
 * first, rows removed together go back as one block, creations go back in
 * creation order; a row created and removed in the turn takes part as a
 * ghost. Found by the reversal-engine review and its differential fuzz
 * (`reversal-differential-fuzz.spec.ts`).
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

// The review's fuzz failures at d1058290, each a whole turn over a seeded
// [a, b, c, d, e]. `undo` = undo, redo, undo again (and history); `rollback`
// = the same turn as a pending transaction, rolled back.
const reviewFailures: Array<['undo' | 'rollback', Op[]]> = [
  [
    'rollback',
    [
      ['add', 'x0'],
      ['rmAdd', 'b'],
      ['rmMany', 'c', 'd'],
      ['rmMany', 'c', 'x0'],
    ],
  ],
  ['rollback', [['rm', 'b'], ['clear'], ['rm', 'e']]],
  ['rollback', [['rm', 'b'], ['clear'], ['rmMany', 'c', 'b'], ['clear']]],
  [
    'rollback',
    [
      ['rm', 'b'],
      ['rmMany', 'b', 'b'],
      ['clear'],
      ['add', 'x0'],
      ['rmAdd', 'd'],
    ],
  ],
  ['rollback', [['rm', 'c'], ['clear'], ['rm', 'b'], ['add', 'x0']]],
  [
    'rollback',
    [
      ['rm', 'c'],
      ['rm', 'b'],
      ['rmMany', 'd', 'e'],
      ['rm', 'd'],
    ],
  ],
  ['rollback', [['rm', 'd'], ['clear']]],
  [
    'rollback',
    [['rm', 'e'], ['clear'], ['rm', 'b'], ['rmAdd', 'a'], ['rm', 'a']],
  ],
  ['rollback', [['rm', 'e'], ['clear']]],
  [
    'rollback',
    [['rm', 'e'], ['rm', 'c'], ['rm', 'e'], ['clear'], ['rmMany', 'd', 'c']],
  ],
  ['rollback', [['rmMany', 'a', 'e'], ['clear']]],
  ['rollback', [['rmMany', 'b', 'b'], ['clear']]],
  [
    'rollback',
    [
      ['rmMany', 'c', 'c'],
      ['clear'],
      ['rmMany', 'b', 'd'],
      ['rmMany', 'e', 'a'],
    ],
  ],
  [
    'rollback',
    [
      ['rmMany', 'c', 'c'],
      ['rmMany', 'b', 'c'],
      ['rmMany', 'b', 'a'],
    ],
  ],
  [
    'rollback',
    [
      ['rmMany', 'd', 'a'],
      ['pre', 'x0'],
      ['upd', 'x0'],
      ['rmAdd', 'x0'],
      ['upd', 'x0'],
    ],
  ],
  ['rollback', [['rmMany', 'e', 'b'], ['clear'], ['rm', 'a']]],
  [
    'rollback',
    [
      ['rmMany', 'e', 'b'],
      ['rmMany', 'd', 'c'],
      ['upd', 'a'],
    ],
  ],
  [
    'rollback',
    [
      ['upd', 'e'],
      ['rmMany', 'c', 'e'],
      ['rmMany', 'e', 'b'],
      ['clear'],
      ['pre', 'x0'],
    ],
  ],
  [
    'undo',
    [
      ['add', 'x0'],
      ['rm', 'e'],
      ['add', 'x1'],
      ['rm', 'x0'],
      ['add', 'x2'],
    ],
  ],
  [
    'undo',
    [
      ['pre', 'x0'],
      ['upd', 'x0'],
      ['rmMany', 'a', 'e'],
    ],
  ],
  [
    'undo',
    [
      ['rm', 'b'],
      ['rmAdd', 'c'],
      ['rmAdd', 'e'],
      ['rmMany', 'c', 'c'],
    ],
  ],
  [
    'undo',
    [
      ['rm', 'd'],
      ['add', 'x0'],
      ['add', 'x1'],
      ['rmAdd', 'x0'],
      ['upd', 'x1'],
    ],
  ],
  [
    'undo',
    [
      ['rmMany', 'd', 'a'],
      ['pre', 'x0'],
      ['upd', 'x0'],
      ['rmAdd', 'x0'],
      ['upd', 'x0'],
    ],
  ],
  // Found by this repair's own fuzz runs (chain-head choice across batches).
  [
    'undo',
    [
      ['upd', 'd'],
      ['rmMany', 'c', 'b'],
      ['add', 'x0'],
      ['rmMany', 'd', 'e'],
      ['rmMany', 'x0', 'a'],
    ],
  ],
  [
    'undo',
    [
      ['add', 'x0'],
      ['pre', 'x1'],
      ['rmMany', 'a', 'x0'],
    ],
  ],
];

describe.each(Object.entries(configurations))(
  'reversal order: review fuzz failures (%s)',
  (name, enhancers) => {
    const cases = reviewFailures.filter(
      ([path]) => path === 'undo' || name !== 'restoration()'
    );
    it.each(
      cases.map(
        ([path, ops]) => [`${path} ${JSON.stringify(ops)}`, path, ops] as const
      )
    )('%s', async (_label, path, ops) => {
      const outcome =
        path === 'undo'
          ? await checkUndoRedo(enhancers, ops)
          : await checkRollback(enhancers, ops);
      expect(outcome).toBe('ok');
      // Each case also holds on the other path where it applies.
      if (name !== 'restoration()') {
        expect(await checkRollback(enhancers, ops)).toBe('ok');
      }
      expect(await checkUndoRedo(enhancers, ops)).toBe('ok');
    });
  }
);

const _typedTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof _typedTree>;
const seededTree = (enhancers: readonly unknown[]): Tree => {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: enhancers as never }
  ) as unknown as Tree;
  for (const id of ['a', 'b', 'c', 'd', 'e']) tree.$.rows.addOne({ id, n: 0 });
  return tree;
};
const ids = (tree: Tree) => tree.$.rows.ids();

describe.each([
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('reversal order: review items (%s)', (_name, enhancers) => {
  it('item 1: removeOne then clear rolls back to the original order', async () => {
    for (const turn of [
      (tree: Tree) => {
        tree.$.rows.removeOne('e');
        tree.$.rows.clear();
      },
      (tree: Tree) => {
        tree.$.rows.removeMany(['b', 'd']);
        tree.$.rows.clear();
      },
    ]) {
      const tree = seededTree(enhancers());
      try {
        await flush();
        const pending = tree.transaction(() => turn(tree));
        await flush();
        pending.rollback();
        await flush();
        expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
      } finally {
        tree.destroy();
      }
    }
  });

  it('item 2: rows anchored to different removed rows in one gap redo in place', async () => {
    const tree = seededTree(enhancers());
    try {
      await flush();
      undoable(() => {
        tree.$.rows.prependMany([{ id: 'p', n: 1 }]);
        tree.$.rows.addOne({ id: 'x', n: 1 });
        tree.$.rows.removeMany(['a', 'b', 'c', 'd', 'e']);
      });
      await flush();
      expect(ids(tree)).toStrictEqual(['p', 'x']);
      tree.undo();
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
      tree.redo();
      await flush();
      expect(ids(tree)).toStrictEqual(['p', 'x']);
    } finally {
      tree.destroy();
    }
  });

  it('item 7: redo places a row anchored to a row the same turn removes', async () => {
    const tree = seededTree(enhancers());
    try {
      await flush();
      undoable(() => {
        tree.$.rows.prependMany([{ id: 'x0', n: 1 }]);
        tree.$.rows.updateOne('x0', { n: 9 });
        tree.$.rows.removeMany(['a', 'e']);
      });
      await flush();
      const after = tree.$.rows.all();
      expect(after.map((row) => row.id)).toStrictEqual(['x0', 'b', 'c', 'd']);
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(after);
    } finally {
      tree.destroy();
    }
  });

  it('item 8: redo places rows anchored to a row created and removed in the turn', async () => {
    const tree = seededTree(enhancers());
    try {
      await flush();
      undoable(() => {
        tree.$.rows.addOne({ id: 'x0', n: 1 });
        tree.$.rows.removeOne('e');
        tree.$.rows.addOne({ id: 'x1', n: 1 });
        tree.$.rows.removeOne('x0');
        tree.$.rows.addOne({ id: 'x2', n: 1 });
      });
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'x1', 'x2']);
      tree.undo();
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
      tree.redo();
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'x1', 'x2']);
      tree.jumpTo(0);
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'x1', 'x2']);
      expect(tree.getRestorationHistory()).toHaveLength(1);
    } finally {
      tree.destroy();
    }
  });

  it('a two-ghost creation chain redoes in place', async () => {
    const tree = seededTree(enhancers());
    try {
      await flush();
      undoable(() => {
        tree.$.rows.addOne({ id: 'x0', n: 1 });
        tree.$.rows.addOne({ id: 'x1', n: 1 });
        tree.$.rows.addOne({ id: 'x2', n: 1 });
        tree.$.rows.removeOne('x0');
        tree.$.rows.removeOne('x1');
      });
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'x2']);
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'x2']);
    } finally {
      tree.destroy();
    }
  });

  it('a ghost row is never published while a reversal places its neighbours', async () => {
    const tree = seededTree(enhancers());
    const published: string[] = [];
    const stop = getPathNotifier().subscribe('**', (_next, _prev, path) => {
      if (String(path).includes('x0')) published.push(String(path));
    });
    try {
      await flush();
      undoable(() => {
        tree.$.rows.addOne({ id: 'x0', n: 1 });
        tree.$.rows.addOne({ id: 'x1', n: 1 });
        tree.$.rows.removeOne('x0');
      });
      await flush();
      published.length = 0;
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'x1']);
      expect(published).toStrictEqual([]);
      const pending = tree.transaction(() => {
        tree.$.rows.addOne({ id: 'x0', n: 1 });
        tree.$.rows.addOne({ id: 'y1', n: 1 });
        tree.$.rows.removeOne('x0');
      });
      await flush();
      published.length = 0;
      pending.rollback();
      await flush();
      expect(published).toStrictEqual([]);
      expect(ids(tree)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'x1']);
    } finally {
      stop();
      tree.destroy();
    }
  });
});
