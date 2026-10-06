import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * A pending RENAME vacates its original key. Later work that put a DIFFERENT
 * row at that key depended on the rename having happened, so "the rename never
 * ran" is not a consistent counterfactual: rolling it back refuses as a
 * dependency (`later-confirmed-dependency`, or `later-pending-dependency`
 * while the re-occupying work is unsettled), even after the re-occupier was
 * removed again, because its own history still names the key.
 *
 * Found by the re-review of 23b750f0: the rollback was accepted (the renamed
 * row was gone, REKEY-SUPERSESSION-0), and the rejection rebase then wrote the
 * rename's original key back into a later removal, so two lifetimes held key
 * 'a' in history: getRestorationHistory() threw "duplicate keys" and undo
 * refused for good. On 15.4.3 the same rollback was accepted silently.
 *
 * While the renamed row and the occupier both still stand, this refused
 * through 15.4.3 too, as `effect-validation-failed` (the compensating rename
 * failed validation); it is now the planner's dependency refusal, before any
 * compensation is tried (restoration.spec.ts pins the new kind).
 *
 * A pending REMOVE whose key was re-occupied is a separate, pinned rule
 * (`effect-validation-failed`, proposal-rejection-0 case 15 and the
 * refusal-lifecycle gate's `replacement` cases); it is unchanged here.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const configurations = [
  ['transactions()', () => [transactions()], false],
  [
    'transactions(), restoration()',
    () => [transactions(), restoration()],
    true,
  ],
  [
    'restoration(), transactions()',
    () => [restoration(), transactions()],
    true,
  ],
] as const;

const refusalKind = (run: () => void): string | undefined => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SignalTreeRollbackError);
    return (error as { cause?: { kind?: string } }).cause?.kind;
  }
  return undefined;
};
const state = (tree: Tree) => ({ x: tree.$.x(), rows: tree.$.rows.all() });

const reoccupying: Record<string, Array<(tree: Tree) => void>> = {
  'a new row at the old key, then the renamed row removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'a new row at the old key, then both rows removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeMany(['a2', 'a']),
  ],
  'a new row at the old key, removed again, then the renamed row removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a'),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'another row renamed onto the old key, then the renamed row removed': [
    (tree) => tree.$.rows.changeId('z', 'a'),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'a new row at the old key while the renamed row stays': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
  ],
};

describe.each(configurations)(
  'rollback of a rename whose old key later work re-occupied (%s)',
  (_name, enhancers, withHistory) => {
    const make = (): Tree => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      tree.$.rows.addOne({ id: 'z', n: 0 });
      tree.$.rows.addOne({ id: 'a', n: 1 });
      return tree;
    };
    const later = (tree: Tree, write: (tree: Tree) => void) => {
      if (withHistory) undoable(() => write(tree));
      else write(tree);
    };

    it.each(Object.keys(reoccupying))(
      '%s: refuses as a settled dependency and changes nothing',
      async (shape) => {
        const tree = make();
        try {
          await flush();
          const proposal = tree.transaction(() => {
            tree.$.x(1);
            tree.$.rows.changeId('a', 'a2');
          });
          await flush();
          for (const write of reoccupying[shape]) {
            later(tree, write);
            await flush();
          }
          const before = state(tree);
          expect(refusalKind(() => proposal.rollback())).toBe(
            'later-confirmed-dependency'
          );
          await flush();
          expect(state(tree)).toStrictEqual(before);
          if (withHistory) {
            const history = tree.getRestorationHistory();
            expect(history).toHaveLength(reoccupying[shape].length);
          }
        } finally {
          tree.destroy();
        }
      }
    );

    it('refuses as a pending dependency while the re-occupier is unsettled', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        const occupier = tree.transaction(() =>
          tree.$.rows.addOne({ id: 'a', n: 50 })
        );
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-pending-dependency'
        );
        occupier.confirm();
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('control: a new row at a DIFFERENT key does not block the rollback', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        later(tree, (t) => t.$.rows.addOne({ id: 'b', n: 50 }));
        await flush();
        later(tree, (t) => t.$.rows.removeOne('a2'));
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({
          x: 0,
          rows: [
            { id: 'z', n: 0 },
            { id: 'b', n: 50 },
          ],
        });
        if (withHistory) {
          expect(tree.getRestorationHistory()).toHaveLength(2);
          tree.undo();
          await flush();
          // Undo of the removal brings the row back under its ORIGINAL key:
          // the rename never happened.
          expect(tree.$.rows.all()).toStrictEqual([
            { id: 'z', n: 0 },
            { id: 'a', n: 1 },
            { id: 'b', n: 50 },
          ]);
        }
      } finally {
        tree.destroy();
      }
    });

    it('a rename chain over the new key is accepted and history stays usable', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        later(tree, (t) => t.$.rows.changeId('a2', 'a3'));
        await flush();
        later(tree, (t) => t.$.rows.removeOne('a3'));
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({ x: 0, rows: [{ id: 'z', n: 0 }] });
        if (withHistory) {
          expect(tree.getRestorationHistory()).toHaveLength(2);
          tree.undo();
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual([
            { id: 'z', n: 0 },
            { id: 'a', n: 1 },
          ]);
        }
      } finally {
        tree.destroy();
      }
    });
  }
);
