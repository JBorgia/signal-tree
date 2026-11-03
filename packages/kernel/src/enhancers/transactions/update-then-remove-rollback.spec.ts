import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Rolling back a transaction that writes a row and then removes it must bring
 * the row back as it was BEFORE the transaction, not as it was when removed.
 *
 * Reproduced on npm 15.4.3:
 *
 *     rows.addOne({ id: 'a', n: 1 });
 *     transaction(() => { rows.updateOne('a', { n: 2 }); rows.removeOne('a'); })
 *       .rollback();
 *     rows.byId('a')()  // { id: 'a', n: 2 } — expected { id: 'a', n: 1 }
 *
 * The turn records both effects correctly: a field `set` n 1 -> 2 and a
 * `remove` carrying the row as removed ({ n: 2 }). Two rollback paths lost the
 * field reversal:
 *
 * - `createPendingRollbackEffects` (pending-rollback.ts) let a subject's
 *   structural effect DOMINATE every other effect on that subject. That is
 *   right for an `add` — removing a row the turn created reverses everything
 *   the turn did to it — and wrong for a `remove`, whose re-add restores the
 *   row as removed. The field reversal was dropped and the intermediate value
 *   came back silently.
 * - The declarative target (`rollbackPendingTarget`, taken when two or more
 *   re-adds need anchors, a key is handed off, or survivors reorder) applied
 *   the reversals in capture order, so the field reversal reached a row that
 *   was not there yet and the rollback refused with "Value effect has no
 *   active subject". This is the "lifetimes shared across collections" form:
 *   `left` and `right` both hold lifetime 1, two re-adds send it down this
 *   path, and it refused.
 *
 * `undo()` was already correct: it reverses the turn's effects in reverse
 * order, so the re-add precedes the field reversal. The undo rows below guard
 * that, in both enhancer orders.
 */
type Row = { id: string; n: number; tag?: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const configurations = {
  'transactions()': () => [transactions()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
} as const;

const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  other: entityMap<Row, string>({ selectId: (row) => row.id }),
});
// Typed with both enhancers; each test installs the list it names.
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: () => readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers() as never,
  }) as unknown as Tree;

// Lifetimes are per collection: rows z=1 a=2 c=3, other p=1 o=2. `rows.a` and
// `other.o` share lifetime 2; `rows.z` and `other.p` share lifetime 1.
const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  tree.$.rows.addOne({ id: 'c', n: 3 });
  tree.$.other.addOne({ id: 'p', n: 10 });
  tree.$.other.addOne({ id: 'o', n: 5 });
  await flush();
};
const SEEDED = {
  rows: [
    { id: 'z', n: 0 },
    { id: 'a', n: 1 },
    { id: 'c', n: 3 },
  ],
  other: [
    { id: 'p', n: 10 },
    { id: 'o', n: 5 },
  ],
};
const state = (tree: Tree) => ({
  rows: tree.$.rows.all(),
  other: tree.$.other.all(),
});

// Each case removes a row it has written earlier in the same turn.
const writeThenRemove: Record<string, (tree: Tree) => void> = {
  'updateOne then removeOne': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('a');
  },
  'replaceOne then removeOne': (tree) => {
    tree.$.rows.replaceOne('a', { id: 'a', n: 7 });
    tree.$.rows.removeOne('a');
  },
  'row set through byId then removeOne': (tree) => {
    (tree.$.rows.byId('a') as unknown as (row: Row) => void)({
      id: 'a',
      n: 8,
    });
    tree.$.rows.removeOne('a');
  },
  'field set through byId then removeOne': (tree) => {
    (tree.$.rows.byId('a') as unknown as { n: (n: number) => void }).n(4);
    tree.$.rows.removeOne('a');
  },
  'several updates, one adding a field, then removeOne': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.updateOne('a', { n: 3, tag: 'x' });
    tree.$.rows.removeOne('a');
  },
  'updateOne then clear': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.clear();
  },
  'changeId, updateOne, then removeOne': (tree) => {
    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.updateOne('a2', { n: 2 });
    tree.$.rows.removeOne('a2');
  },
  'updateOne, changeId, then removeOne': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.removeOne('a2');
  },
  // Declarative target: two re-adds whose anchors are not both re-added.
  'updateOne then removeMany': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeMany(['a', 'c']);
  },
  // Declarative target: survivors reorder, so an order delta is captured.
  'updateOne then setAll dropping the row': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.setAll([
      { id: 'c', n: 3 },
      { id: 'z', n: 0 },
    ]);
  },
  // Declarative target: key 'a' is handed to a fresh lifetime.
  'updateOne, removeOne, then re-add the same key': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'a', n: 5 });
  },
  // Shared lifetime 2: the field write on `other.o` must stay in `other`.
  'shared lifetime: update+remove rows.a, update other.o': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('a');
    tree.$.other.updateOne('o', { n: 6 });
  },
  // Shared lifetime 2 in BOTH collections, each written then removed.
  'shared lifetime: update+remove in both collections': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.other.updateOne('o', { n: 6 });
    tree.$.rows.removeOne('a');
    tree.$.other.removeOne('o');
  },
  // The v16 integration form: shared lifetime 1, two re-adds -> declarative.
  'shared lifetime: update+remove rows.z, then remove other.p': (tree) => {
    tree.$.rows.updateOne('z', { n: 9 });
    tree.$.rows.removeOne('z');
    tree.$.other.removeOne('p');
  },
  'shared lifetime: remove other.p, then update+remove rows.z': (tree) => {
    tree.$.other.removeOne('p');
    tree.$.rows.updateOne('z', { n: 9 });
    tree.$.rows.removeOne('z');
  },
};

// Behaviour that was already correct and must stay so.
const controls: Record<string, (tree: Tree) => void> = {
  'removeOne alone': (tree) => tree.$.rows.removeOne('a'),
  'updateOne alone': (tree) => tree.$.rows.updateOne('a', { n: 2 }),
  'removeMany alone': (tree) => tree.$.rows.removeMany(['a', 'c']),
  'clear alone': (tree) => tree.$.rows.clear(),
  'remove in two collections sharing a lifetime': (tree) => {
    tree.$.rows.removeOne('z');
    tree.$.other.removeOne('p');
  },
  // An `add` still dominates: the row the turn created simply goes away.
  'addOne then updateOne': (tree) => {
    tree.$.rows.addOne({ id: 'x', n: 1 });
    tree.$.rows.updateOne('x', { n: 9, tag: 'y' });
  },
  'two addOne then updateOne': (tree) => {
    tree.$.rows.addOne({ id: 'x', n: 1 });
    tree.$.rows.addOne({ id: 'y', n: 1 });
    tree.$.rows.updateOne('x', { n: 9 });
  },
  'update a row, remove another': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('c');
  },
};

describe.each(Object.entries(configurations))(
  'transaction rollback of write-then-remove (%s)',
  (_name, enhancers) => {
    it.each(Object.entries({ ...writeThenRemove, ...controls }))(
      '%s restores the pre-transaction rows',
      async (_case, act) => {
        const tree = make(enhancers);
        try {
          await seed(tree);
          const pending = tree.transact(() => act(tree));
          await flush();
          pending.rollback();
          await flush();
          expect(state(tree)).toEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

// Undo was correct before the repair; these rows keep it that way. Cases whose
// undo already failed for unrelated reasons on 15.4.3 are listed in the report,
// not here: `updateOne then clear` (restored ORDER) and `changeId, updateOne,
// then removeOne` (refused as structural drift).
const undoCases = [
  'updateOne then removeOne',
  'replaceOne then removeOne',
  'row set through byId then removeOne',
  'field set through byId then removeOne',
  'several updates, one adding a field, then removeOne',
  'updateOne, changeId, then removeOne',
  'updateOne then removeMany',
  'updateOne then setAll dropping the row',
  'updateOne, removeOne, then re-add the same key',
  'shared lifetime: update+remove rows.a, update other.o',
  'shared lifetime: update+remove in both collections',
  'shared lifetime: update+remove rows.z, then remove other.p',
  'shared lifetime: remove other.p, then update+remove rows.z',
] as const;

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('undo/redo of write-then-remove (%s)', (_name, enhancers) => {
  it.each(undoCases)(
    '%s undoes to the pre-turn rows and redoes',
    async (name) => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        undoable(() => writeThenRemove[name](tree));
        await flush();
        const after = state(tree);
        tree.undo();
        await flush();
        expect(state(tree)).toEqual(SEEDED);
        tree.redo();
        await flush();
        expect(state(tree)).toEqual(after);
      } finally {
        tree.destroy();
      }
    }
  );
});
