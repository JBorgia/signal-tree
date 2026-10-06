import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { StructuralStore } from './physical/structural-store';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * A prepend that only adds fresh rows stays O(1) in the collection's size,
 * observed or not.
 *
 * bf64f92e moved prependMany's order-delta bookkeeping into addRows, and it
 * walked the whole order twice per call whenever a capture was active
 * (restoration(), or any open transaction) — even though a call that only adds
 * fresh rows can never reorder the rows that survive it. prependOne goes
 * through the same path: 300 calls on 20k rows took 3 ms on 8f0ecf29 and
 * 945 ms on 3e42c133 under restoration().
 *
 * Counted, not timed: every walk of the active order is a
 * `StructuralStore.snapshotActiveOrder` call, and its visits are the rows it
 * pushes. An overwrite that moves an existing row still needs the walk (its
 * order delta is what undo and rollback reverse) and is the control.
 */
type Row = { id: string; n: number };
const ROWS = 20_000;
const CALLS = 300;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const make = (enhancers: readonly unknown[]) =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: enhancers as never }
  );
type Tree = ReturnType<typeof make>;

/** Order rows visited by `snapshotActiveOrder` while `action` runs. */
function orderVisits(action: () => void): number {
  const original = StructuralStore.prototype.snapshotActiveOrder;
  let visits = 0;
  StructuralStore.prototype.snapshotActiveOrder = function (
    this: StructuralStore<string>,
    keys: string[],
    subjectIds: number[]
  ) {
    const before = subjectIds.length;
    original.call(this, keys, subjectIds);
    visits += subjectIds.length - before;
  };
  try {
    action();
  } finally {
    StructuralStore.prototype.snapshotActiveOrder = original;
  }
  return visits;
}

const seeded = async (enhancers: readonly unknown[]) => {
  const tree = make(enhancers);
  tree.$.rows.addMany(
    Array.from({ length: ROWS }, (_, i) => ({ id: `r${i}`, n: i }))
  );
  await flush();
  return tree;
};

const fresh: Record<string, (tree: Tree) => void> = {
  prependOne: (tree) => {
    for (let i = 0; i < CALLS; i++) tree.$.rows.prependOne({ id: `p${i}`, n: i });
  },
  prependMany: (tree) => {
    for (let i = 0; i < CALLS; i++)
      tree.$.rows.prependMany([{ id: `p${i}`, n: i }]);
  },
  'prependMany overwrite of new ids only': (tree) => {
    for (let i = 0; i < CALLS; i++)
      tree.$.rows.prependMany([{ id: `p${i}`, n: i }], { mode: 'overwrite' });
  },
};

describe.each([
  ['restoration()', () => [restoration()], false],
  ['transactions(), inside a transaction', () => [transactions()], true],
  [
    'transactions(), restoration(), inside a transaction',
    () => [transactions(), restoration()],
    true,
  ],
] as const)(
  'prepending fresh rows at scale (%s)',
  (_name, enhancers, inTransaction) => {
    it.each(Object.keys(fresh))(
      '%s: no walk of the existing rows',
      async (name) => {
        const tree = await seeded(enhancers());
        try {
          const run = () => fresh[name](tree);
          const visits = orderVisits(() =>
            inTransaction
              ? (tree as unknown as { transaction(f: () => void): void }).transaction(run)
              : run()
          );
          expect(visits).toBe(0);
          expect(tree.$.rows.count()).toBe(ROWS + CALLS);
          expect(tree.$.rows.ids()[0]).toBe(`p${CALLS - 1}`);
        } finally {
          tree.destroy();
        }
      },
      60_000
    );

    it.each([
      ['an existing row', [{ id: `r${ROWS - 1}`, n: -1 }]],
      [
        'an existing row beside a fresh one',
        [
          { id: `r${ROWS - 1}`, n: -1 },
          { id: 'p', n: 0 },
        ],
      ],
    ] as const)('control: an overwrite that moves %s still walks the order', async (_name, batch) => {
      const tree = await seeded(enhancers());
      try {
        const run = () =>
          tree.$.rows.prependMany(batch.map((row) => ({ ...row })), {
            mode: 'overwrite',
          });
        const visits = orderVisits(() =>
          inTransaction
            ? (tree as unknown as { transaction(f: () => void): void }).transaction(run)
            : run()
        );
        expect(visits).toBeGreaterThanOrEqual(2 * ROWS);
        expect(tree.$.rows.ids()[0]).toBe(`r${ROWS - 1}`);
      } finally {
        tree.destroy();
      }
    }, 60_000);
  }
);
