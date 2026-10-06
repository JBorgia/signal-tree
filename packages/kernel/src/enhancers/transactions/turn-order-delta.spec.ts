import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import {
  checkRollback,
  checkTurns,
  checkTurnsRollback,
  checkUndoRedo,
  type Op,
} from '../test-helpers/reversal-fuzz-harness';
import { transactions } from './transactions';

/**
 * (a) ONE net order delta per turn: an order change (setAll reordering
 * survivors, an overwriting prependMany moving a row) combined in the same
 * turn with adds, removes, a clear or a rename on the same collection
 * reverses exactly, whichever came first. The order change used to record
 * its own endpoints, not the turn's, and undo/rollback refused ("collection
 * order frontier does not match the transition endpoint"); before 15.4.4
 * the prependMany shapes deleted the overwritten row instead.
 *
 * Each case is one turn over [a, b, c, d, e]: undo, redo, undo again and
 * history (restoration in every order), and rollback of the same turn as a
 * pending transaction (transactions alone and in every order).
 */
const orderChanges: Record<string, Op> = {
  'setAll reorder': ['reorder'],
  'prependMany overwrite moving a row': ['preOver'],
};
const structural: Record<string, Op[]> = {
  addOne: [['add', 'w']],
  addMany: [['addMany', 'w1', 'w2']],
  removeOne: [['rm', 'a']],
  removeMany: [['rmMany', 'a', 'c']],
  clear: [['clear']],
  changeId: [['rename', 'c', 'c2']],
  'setAll adding a row': [['setAllAdd', 'w']],
};
const cases: Array<[string, Op[]]> = [];
for (const [orderName, order] of Object.entries(orderChanges)) {
  for (const [structuralName, ops] of Object.entries(structural)) {
    cases.push([`${structuralName}, then ${orderName}`, [...ops, order]]);
    cases.push([`${orderName}, then ${structuralName}`, [order, ...ops]]);
    cases.push([
      `${structuralName} around ${orderName}`,
      [...ops, order, ['add', 'z9']],
    ]);
  }
}
cases.push([
  'two order changes with removals between',
  [['reorder'], ['rm', 'b'], ['preOver'], ['rmMany', 'c', 'd']],
]);

const undoConfigurations = {
  'restoration()': () => [restoration()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};
const rollbackConfigurations = {
  'transactions()': () => [transactions()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};

describe.each(Object.entries(undoConfigurations))(
  'one order delta per turn: undo, redo, undo (%s)',
  (_name, enhancers) => {
    it.each(cases)('%s', async (_case, ops) => {
      expect(await checkUndoRedo(enhancers, ops)).toBe('ok');
    });
  }
);

describe.each(Object.entries(rollbackConfigurations))(
  'one order delta per turn: rollback (%s)',
  (_name, enhancers) => {
    it.each(cases)('%s', async (_case, ops) => {
      expect(await checkRollback(enhancers, ops)).toBe('ok');
    });
  }
);

// The delta's frontiers are the TURN's: a reversal reinstates the token the
// turn started from, which an earlier order change recorded as its end. With
// the order change's own (later) start token, the earlier one refused.
const laterTurns: Array<[string, Op[][]]> = [];
for (const [orderName, order] of Object.entries(orderChanges)) {
  for (const [structuralName, ops] of Object.entries(structural)) {
    if (structuralName === 'clear') continue;
    laterTurns.push([
      `${orderName}; then ${structuralName} and ${orderName}`,
      [[order], [...ops, order]],
    ]);
  }
}
describe.each(Object.entries(undoConfigurations))(
  'an order change, then a turn with a structural change before its own (%s)',
  (_name, enhancers) => {
    it.each(laterTurns)('%s', async (_case, turns) => {
      expect(await checkTurns(enhancers, turns)).toBe('ok');
    });
  }
);
describe.each(Object.entries(rollbackConfigurations))(
  'an order change, then a transaction with a structural change before its own, rolled back (%s)',
  (_name, enhancers) => {
    it.each(laterTurns)('%s', async (_case, turns) => {
      expect(await checkTurnsRollback(enhancers, turns)).toBe('ok');
    });
  }
);

/**
 * (d) The order frontier across turns. An order delta applies only while its
 * collection is at the exact token it recorded (invariant 3). A later turn
 * that adds or removes rows replaces the token; reversing that turn now
 * reinstates the token it replaced (the collection is then exactly at the
 * order that token named), so the order change reverses after it. Each case
 * undoes every turn, redoes them, undoes again, jumps to the newest and the
 * oldest entry and back, and materializes history at both ends; the same
 * turns as transactions roll back newest first.
 */
const crossTurns: Array<[string, Op[][]]> = [];
for (const [orderName, order] of Object.entries(orderChanges)) {
  for (const [structuralName, ops] of Object.entries(structural)) {
    crossTurns.push([`${orderName}; then ${structuralName}`, [[order], ops]]);
    // (After a clear there is nothing to reorder.)
    if (structuralName !== 'clear') {
      crossTurns.push([`${structuralName}; then ${orderName}`, [ops, [order]]]);
    }
  }
  crossTurns.push([
    `${orderName}; addOne; removeOne; ${orderName} again`,
    [[order], [['add', 'w']], [['rm', 'b']], [order]],
  ]);
  crossTurns.push([
    `addMany; ${orderName}; removeMany`,
    [[['addMany', 'w1', 'w2']], [order], [['rmMany', 'a', 'w1']]],
  ]);
}
describe.each(Object.entries(undoConfigurations))(
  'order frontier across turns: undo, redo, jumpTo, history (%s)',
  (_name, enhancers) => {
    it.each(crossTurns)('%s', async (_case, turns) => {
      expect(await checkTurns(enhancers, turns)).toBe('ok');
    });
  }
);
// A transaction that adds and removes the same row changes nothing but the
// token; its rollback reinstates the token too.
const crossTransactions: Array<[string, Op[][]]> = [
  ...crossTurns,
  ...Object.entries(orderChanges).map(
    ([orderName, order]): [string, Op[][]] => [
      `${orderName}; then a row added and removed`,
      [
        [order],
        [
          ['add', 'w'],
          ['rm', 'w'],
        ],
      ],
    ]
  ),
];
describe.each(Object.entries(rollbackConfigurations))(
  'order frontier across turns: rollback newest first (%s)',
  (_name, enhancers) => {
    it.each(crossTransactions)('%s', async (_case, turns) => {
      expect(await checkTurnsRollback(enhancers, turns)).toBe('ok');
    });
  }
);

/**
 * Found by the entity review (on 3e42c133 and 1e1503e0): a synchronous rows
 * subscriber that prepends during an overwriting prependMany. Undo refused
 * with a frontier mismatch, 6 of 6.
 *
 * The prepend is NOT part of the prependMany's turn. A subscriber runs while
 * the flush delivers, so its write is delivered, and recorded, by the NEXT
 * flush: its own turn, as for any write a subscriber makes (a nested addOne
 * stands after the outer turn is undone). Its order captures, though, arrive
 * synchronously and were filed with the turn being delivered, which then
 * claimed the prepend's frontier transitions without its row; they now wait
 * for that turn to be recorded.
 *
 * - Made restoration-eligible (`undoable` in the subscriber), the prepend is
 *   a second entry: undo twice, redo twice, and history, land exactly.
 * - Not eligible (the review's shape), it is a later change nobody can undo,
 *   standing on the collection after the prependMany. The prependMany's undo
 *   refuses with nothing changed, as any order change's undo does under a
 *   later standing structural change (identity, invariant 3: the order it
 *   recorded is no longer the collection's); history still reads.
 */
type Row = { id: string; n: number };
const flushAll = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const nestedShapes = [
  [
    'overwrite mix',
    [
      { id: 'x', n: 1 },
      { id: 'r', n: 9 },
      { id: 'y', n: 1 },
      { id: 'q', n: 8 },
    ],
  ],
  ['overwrite only', [{ id: 'r', n: 9 }]],
] as const;
const nested = async (
  enhancers: () => unknown[],
  incoming: readonly Row[],
  eligible: boolean
) => {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: enhancers() as never }
  ) as unknown as ReturnType<typeof typedNested>;
  for (const id of ['p', 'q', 'r']) tree.$.rows.addOne({ id, n: 0 });
  await flushAll();
  const before = tree.$.rows.all();
  let calls = 0;
  const stop = getPathNotifier().subscribe('rows.*', () => {
    if (calls++ > 0) return;
    const prepend = () => tree.$.rows.prependMany([{ id: 'S', n: 0 }]);
    if (eligible) undoable(prepend);
    else prepend();
  });
  undoable(() =>
    tree.$.rows.prependMany(
      incoming.map((row) => ({ ...row })),
      { mode: 'overwrite' }
    )
  );
  await flushAll();
  stop();
  return { tree, before, after: tree.$.rows.all() };
};
const typedNested = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions(), restoration()] }
  );
describe.each(Object.entries(undoConfigurations))(
  'a prependMany from a subscriber during an overwriting prependMany (%s)',
  (_name, enhancers) => {
    it.each(nestedShapes)(
      '%s, the prepend undoable: undo twice and redo twice land exactly',
      async (_shape, incoming) => {
        const { tree, before, after } = await nested(enhancers, incoming, true);
        try {
          const outerOnly = after.filter(({ id }) => id !== 'S');
          expect(after[0]).toStrictEqual({ id: 'S', n: 0 });
          expect(
            tree.getRestorationHistory().map(({ state }) => state.rows)
          ).toStrictEqual([{ all: outerOnly }, { all: after }]);
          tree.undo();
          await flushAll();
          expect(tree.$.rows.all()).toStrictEqual(outerOnly);
          tree.undo();
          await flushAll();
          expect(tree.$.rows.all()).toStrictEqual(before);
          tree.redo();
          await flushAll();
          tree.redo();
          await flushAll();
          expect(tree.$.rows.all()).toStrictEqual(after);
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(nestedShapes)(
      '%s, the prepend not undoable: the prependMany undo refuses, nothing changes, history reads',
      async (_shape, incoming) => {
        const { tree, after } = await nested(enhancers, incoming, false);
        try {
          expect(after[0]).toStrictEqual({ id: 'S', n: 0 });
          const history = () =>
            tree.getRestorationHistory().map(({ state }) => state.rows);
          expect(history()).toStrictEqual([
            { all: after.filter(({ id }) => id !== 'S') },
          ]);
          const index = tree.getCurrentIndex();
          // Legible and typed (ST1034), naming the collection and the
          // change that stands on it; it was the raw "collection order
          // frontier does not match the transition endpoint".
          expect(() => tree.undo()).toThrow(
            "ST1034: restoration refused — the order of 'rows' changed after the order change being reversed, and a later change outside undo history stands on it (added 'S')."
          );
          await flushAll();
          expect(tree.$.rows.all()).toStrictEqual(after);
          expect(tree.canUndo()).toBe(true);
          expect(tree.getCurrentIndex()).toBe(index);
          expect(history()).toStrictEqual([
            { all: after.filter(({ id }) => id !== 'S') },
          ]);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

/**
 * (d) keeps IDENTITY: a token is reinstated only where the collection is
 * still at the token the reversed turns left, so it holds exactly the order
 * the earlier token named. A change nobody can undo, standing between them
 * (here: a removal and an add of the same length, out of every reordered
 * row's way), leaves the earlier order change irreversible, even though its
 * delta would still fit the order: it would rebase the change over the
 * standing one, which identity does not allow.
 */
const identityTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      x: 0,
    },
    { enhancers: [transactions(), restoration()] }
  );
type IdentityTree = ReturnType<typeof identityTree>;
describe.each(Object.entries(undoConfigurations))(
  'order frontier identity under a standing later change (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<IdentityTree> => {
      const tree = signalTree(
        {
          rows: entityMap<Row, string>({ selectId: (row) => row.id }),
          x: 0,
        },
        { enhancers: enhancers() as never }
      ) as unknown as IdentityTree;
      for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
      await flushAll();
      return tree;
    };
    const reverse = (tree: IdentityTree) =>
      undoable(() => tree.$.rows.setAll([...tree.$.rows.all()].reverse()));
    const standing = async (tree: IdentityTree) => {
      tree.$.rows.removeOne('a');
      tree.$.rows.addOne({ id: 'y', n: 0 });
      await flushAll();
    };
    const refuses = async (tree: IdentityTree, move: () => void) => {
      const ids = tree.$.rows.ids();
      const index = tree.getCurrentIndex();
      const history = JSON.stringify(tree.getRestorationHistory());
      expect(move).toThrow(
        "ST1034: restoration refused — the order of 'rows' changed after the order change being reversed, and a later change outside undo history stands on it (added 'y'; removed 'a')."
      );
      await flushAll();
      expect(tree.$.rows.ids()).toStrictEqual(ids);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(JSON.stringify(tree.getRestorationHistory())).toBe(history);
    };

    it('undo of a later add, then of the order change', async () => {
      const tree = await make();
      try {
        reverse(tree);
        await flushAll();
        undoable(() => tree.$.rows.addOne({ id: 'w', n: 0 }));
        await flushAll();
        await standing(tree);
        tree.undo();
        await flushAll();
        expect(tree.$.rows.ids()).toStrictEqual(['e', 'd', 'c', 'b', 'y']);
        await refuses(tree, () => tree.undo());
      } finally {
        tree.destroy();
      }
    });

    it('undo of a later removeMany, then of the order change', async () => {
      const tree = await make();
      try {
        reverse(tree);
        await flushAll();
        undoable(() => tree.$.rows.removeMany(['c', 'b']));
        await flushAll();
        await standing(tree);
        tree.undo();
        await flushAll();
        expect(tree.$.rows.ids()).toStrictEqual(['e', 'd', 'c', 'b', 'y']);
        await refuses(tree, () => tree.undo());
      } finally {
        tree.destroy();
      }
    });

    it('jumpTo back across two later prepends with the change between them', async () => {
      const tree = await make();
      try {
        undoable(() => tree.$.x(1));
        await flushAll();
        reverse(tree);
        await flushAll();
        undoable(() => tree.$.rows.prependOne({ id: 'w', n: 0 }));
        await flushAll();
        await standing(tree);
        undoable(() => tree.$.rows.prependOne({ id: 'v', n: 0 }));
        await flushAll();
        // One transition: the two prepends, then the order change.
        await refuses(tree, () => tree.jumpTo(0));
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });
  }
);
