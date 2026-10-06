import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
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
 * Order-delta review of d27e55c8.
 *
 * CRITICAL (faa9b1f7): `transaction()` threw "Collection structural target
 * has no live placement anchor" AFTER its callback committed (the writes
 * stayed, no handle came back) when the turn's order could not be composed:
 * two rows the turn created and removed together at the front, anchored to a
 * row the turn created later, were placed right to left. A front run goes
 * right to left only when its right neighbour is in. Composition never
 * throws out of a drain any more: records it cannot compose are kept as an
 * UNRECORDED order change, whose reversal refuses (turn-order-record.spec).
 *
 * MAJOR (pre-existing): a turn whose reorders cancel (the same order at both
 * ends) recorded no order change and so no token transition: history threw,
 * and an earlier order change never undid again. A token-only change now
 * settles at once (the collection gets the earlier token back), recorded or
 * not.
 */
const rollbackConfigurations = {
  'transactions()': () => [transactions()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};
const undoConfigurations = {
  'restoration()': () => [restoration()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};

const frontRuns: Array<[string, Op[]]> = [
  [
    'the review shape',
    [['preOver'], ['clear'], ['setAllAdd', 'x1'], ['rmMany', 'a', 'b']],
  ],
  ['without the removal', [['preOver'], ['clear'], ['setAllAdd', 'x1']]],
  ['without the setAll', [['preOver'], ['clear'], ['rmMany', 'a', 'b']]],
  [
    'without the clear',
    [['preOver'], ['setAllAdd', 'x1'], ['rmMany', 'a', 'b']],
  ],
  ['without the move', [['clear'], ['setAllAdd', 'x1'], ['rmMany', 'a', 'b']]],
  [
    'removing the created row twice',
    [['preOver'], ['clear'], ['setAllAdd', 'x1'], ['rmMany', 'x1', 'x1']],
  ],
];

describe.each(Object.entries(rollbackConfigurations))(
  'a front run anchored to a later row: transaction() returns, rollback restores (%s)',
  (_name, enhancers) => {
    it.each(frontRuns)('%s', async (_case, ops) => {
      expect(await checkRollback(enhancers, ops)).toBe('ok');
    });
  }
);

describe.each(Object.entries(undoConfigurations))(
  'a front run anchored to a later row: undo, redo, undo (%s)',
  (_name, enhancers) => {
    it.each(frontRuns)('%s', async (_case, ops) => {
      expect(await checkUndoRedo(enhancers, ops)).toBe('ok');
    });
  }
);

const cancelling: Array<[string, Op[][]]> = [
  [
    'reorders that cancel, with an edit',
    [[['reorder']], [['reorder'], ['reorder'], ['upd', 'a']]],
  ],
  [
    'reorders that cancel, with a rename',
    [[['reorder']], [['reorder'], ['reorder'], ['rename', 'b', 'r0']]],
  ],
  [
    'a move to where the row already was, with an edit',
    [[['reorder']], [['preOver'], ['preOver'], ['upd', 'b']], [['add', 'w']]],
  ],
];
describe.each(Object.entries(undoConfigurations))(
  'a turn whose order changes cancel (%s)',
  (_name, enhancers) => {
    it.each(cancelling)('%s', async (_case, turns) => {
      expect(await checkTurns(enhancers, turns)).toBe('ok');
    });
  }
);
describe.each(Object.entries(rollbackConfigurations))(
  'a transaction whose order changes cancel (%s)',
  (_name, enhancers) => {
    it.each([
      ...cancelling,
      [
        'reorders that cancel, nothing else',
        [[['reorder']], [['reorder'], ['reorder']]],
      ] as [string, Op[][]],
    ])('%s: rollback newest first', async (_case, turns) => {
      expect(await checkTurnsRollback(enhancers, turns)).toBe('ok');
    });
  }
);

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

describe.each(Object.entries(undoConfigurations))(
  'a token-only undoable turn records nothing and breaks no chain (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(
        { rows: entityMap<Row, string>(), x: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      tree.$.rows.setAll(rows('ABC'));
      await flush();
      return tree;
    };
    const ids = (tree: Tree) => tree.$.rows.ids().join('');
    const shapes: Array<[string, (tree: Tree) => void]> = [
      [
        'reorders that cancel',
        (tree) => {
          tree.$.rows.setAll(rows('ABC'));
          tree.$.rows.setAll(rows('CBA'));
        },
      ],
      [
        'a row added and removed',
        (tree) => {
          tree.$.rows.addOne({ id: 'W', n: 0 });
          tree.$.rows.removeOne('W');
        },
      ],
      [
        'a move to where the row already was',
        (tree) =>
          tree.$.rows.prependMany([{ id: 'C', n: 0 }], { mode: 'overwrite' }),
      ],
    ];
    it.each(shapes)(
      '%s: undo, redo, jumpTo and history across it',
      async (_case, act) => {
        const tree = await make();
        try {
          undoable(() => tree.$.rows.setAll(rows('CBA')));
          await flush();
          undoable(() => act(tree));
          await flush();
          undoable(() => tree.$.rows.setAll(rows('BCA')));
          await flush();
          const history = () =>
            tree
              .getRestorationHistory()
              .map(({ state }) =>
                (state as unknown as { rows: { all: Row[] } }).rows.all
                  .map(({ id }) => id)
                  .join('')
              );
          expect(history()).toStrictEqual(['CBA', 'BCA']);
          const steps: Array<[() => void, string]> = [
            [() => tree.undo(), 'CBA'],
            [() => tree.undo(), 'ABC'],
            [() => tree.redo(), 'CBA'],
            [() => tree.redo(), 'BCA'],
            [() => tree.jumpTo(0), 'CBA'],
            [() => tree.jumpTo(1), 'BCA'],
          ];
          for (const [move, expected] of steps) {
            move();
            await flush();
            expect(ids(tree)).toBe(expected);
            expect(history()).toStrictEqual(['CBA', 'BCA']);
          }
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

// A token-only change by a plain write (no transaction, not undoable) is
// not settled: nothing records it, so a pending order change's rollback
// refuses it as later work (identity). Recorded writes are covered above.
describe.each(Object.entries(rollbackConfigurations))(
  'a token-only transaction after a pending order change does not block its rollback (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(
        { rows: entityMap<Row, string>(), x: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      tree.$.rows.setAll(rows('ABC'));
      await flush();
      return tree;
    };
    const later: Array<[string, (tree: Tree) => void]> = [
      [
        'a confirmed transaction whose reorders cancel',
        (tree) =>
          tree
            .transaction(() => {
              tree.$.rows.setAll(rows('ABC'));
              tree.$.rows.setAll(rows('CBA'));
            })
            .confirm(),
      ],
      [
        'a confirmed transaction adding and removing a row',
        (tree) =>
          tree
            .transaction(() => {
              tree.$.rows.addOne({ id: 'W', n: 0 });
              tree.$.rows.removeOne('W');
            })
            .confirm(),
      ],
    ];
    it.each(later)('%s', async (_case, act) => {
      const tree = await make();
      try {
        const pending = tree.transaction(() => tree.$.rows.setAll(rows('CBA')));
        await flush();
        act(tree);
        await flush();
        expect(tree.$.rows.ids().join('')).toBe('CBA');
        pending.rollback();
        await flush();
        expect(tree.$.rows.ids().join('')).toBe('ABC');
      } finally {
        tree.destroy();
      }
    });
  }
);
