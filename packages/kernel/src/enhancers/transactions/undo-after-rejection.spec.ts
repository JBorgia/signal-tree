import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * THE LAW (owner decision for 15.4.4): after a transaction is rolled back, no
 * undo, redo or jumpTo may reinstate a value or row that only that transaction
 * wrote. Undo of a later write restores what would have been there had the
 * rejected transaction never run:
 *
 *   T writes X over A, a later W writes Y over X, T is rejected  ->  undo W = A
 *   T creates a row, a later W removes it, T is rejected  ->  undo W leaves it gone
 *
 * Through 15.4.3 undo restored the state W replaced — the rejected
 * transaction's speculative value (documented as a known limitation in 15.4.2,
 * `undo-after-rejection-characterization.spec.ts`, now replaced by this file).
 * History states and jumpTo read the same records and showed it too, and
 * getRestorationHistory() threw after rejecting an undoable transaction that
 * created a row.
 */
type Row = { id: string; n: number };
type Profile = { name: string; age?: number };

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const declaration = (profile: Profile) => ({
  x: 0,
  y: 0,
  profile,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration({ name: 'Ada', age: 42 }), {
    enhancers: [transactions(), restoration()],
  });
type Tree = ReturnType<typeof typed>;

const orders = {
  'transactions, restoration': () => [transactions(), restoration()],
  'restoration, transactions': () => [restoration(), transactions()],
} as const;

const make = (
  enhancers: () => readonly unknown[],
  profile: Profile = { name: 'Ada', age: 42 }
): Tree =>
  signalTree(declaration(profile), {
    enhancers: enhancers() as never,
  }) as unknown as Tree;

const state = (tree: Tree) => ({
  x: tree.$.x(),
  y: tree.$.y(),
  profile: tree.$.profile(),
  rows: tree.$.rows.all(),
});

type Scenario = {
  profile?: Profile;
  /** Optional undoable history before T. */
  before?: (tree: Tree) => void;
  /** T, the transaction that will be rejected. */
  tx: (tree: Tree) => void;
  /** W, a later undoable write recorded while T is pending. */
  later: (tree: Tree) => void;
  /** State expected after undoing W once T is rejected. */
  undone: (seeded: ReturnType<typeof state>) => ReturnType<typeof state>;
};

const scenarios: Record<string, Scenario> = {
  'scalar: undo of a later overwrite restores what T replaced': {
    before: (tree) => tree.$.x(5),
    tx: (tree) => {
      tree.$.x(1);
      tree.$.y(1);
    },
    later: (tree) => tree.$.x(2),
    undone: (seeded) => ({ ...seeded, x: 5 }),
  },
  'scalar: T wrote twice': {
    tx: (tree) => {
      tree.$.x(1);
      tree.$.x(3);
    },
    later: (tree) => tree.$.x(2),
    undone: (seeded) => seeded,
  },
  'plain field: undo of a later overwrite restores what T replaced': {
    tx: (tree) => tree.$.profile.name('Bea'),
    later: (tree) => tree.$.profile.name('Cy'),
    undone: (seeded) => seeded,
  },
  'plain member T dropped, W re-added: undo restores the member T dropped': {
    tx: (tree) => tree.$.profile({ name: 'Ada' }),
    later: (tree) => tree.$.profile({ name: 'Ada', age: 50 }),
    undone: (seeded) => seeded,
  },
  'plain member T added, W dropped: undo does not bring it back': {
    profile: { name: 'Ada' },
    tx: (tree) => tree.$.profile({ name: 'Ada', age: 1 }),
    later: (tree) => tree.$.profile({ name: 'Ada' }),
    undone: (seeded) => seeded,
  },
  'row T created, W removed: undo does not bring it back': {
    tx: (tree) => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', n: 1 });
    },
    later: (tree) => tree.$.rows.removeOne('A'),
    undone: (seeded) => seeded,
  },
  'row T created, W updated then removed: undo does not bring it back': {
    tx: (tree) => tree.$.rows.addOne({ id: 'A', n: 1 }),
    later: (tree) => {
      tree.$.rows.updateOne('A', { n: 2 });
      tree.$.rows.removeOne('A');
    },
    undone: (seeded) => seeded,
  },
  'row T created, W removed it and an existing row: only the existing row returns, in place':
    {
      tx: (tree) => tree.$.rows.addOne({ id: 'A', n: 1 }),
      later: (tree) => tree.$.rows.removeMany(['A', 'c']),
      undone: (seeded) => seeded,
    },
};

const seedRows = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  tree.$.rows.addOne({ id: 'c', n: 3 });
  await flush();
};

describe.each(Object.entries(orders))(
  'undo after a rejection (%s)',
  (_order, enhancers) => {
    describe.each([
      ['T outside undoable()', false],
      ['T inside undoable()', true],
    ] as const)('%s', (_label, designated) => {
      it.each(Object.keys(scenarios))('%s', async (name) => {
        const scenario = scenarios[name];
        const tree = make(enhancers, scenario.profile);
        try {
          await seedRows(tree);
          if (scenario.before) {
            undoable(() => scenario.before?.(tree));
            await flush();
          }
          const seeded = state(tree);
          let proposal: { rollback(): void } | undefined;
          const open = () => {
            proposal = tree.transaction(() => scenario.tx(tree));
          };
          if (designated) undoable(open);
          else open();
          await flush();
          undoable(() => scenario.later(tree));
          await flush();

          proposal?.rollback();
          await flush();
          // Rollback keeps W (it superseded T where they overlap).
          const afterRejection = state(tree);

          const history = tree.getRestorationHistory();
          tree.undo();
          await flush();
          const undone = scenario.undone(seeded);
          expect(state(tree)).toStrictEqual(undone);

          tree.redo();
          await flush();
          expect(state(tree)).toStrictEqual(afterRejection);

          tree.undo();
          await flush();
          expect(state(tree)).toStrictEqual(undone);

          // jumpTo walks the same records: the newest entry is W's state,
          // and nothing in history shows a value only T wrote.
          tree.jumpTo(history.length - 1);
          await flush();
          expect(state(tree)).toStrictEqual(afterRejection);
        } finally {
          tree.destroy();
        }
      });
    });

    it('jumpTo(0) and history states show no rejected value', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        undoable(() => tree.$.x(5));
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.addOne({ id: 'A', n: 1 });
        });
        await flush();
        undoable(() => tree.$.x(2));
        await flush();
        proposal.rollback();
        await flush();

        const history = tree.getRestorationHistory();
        expect(history.map((entry) => entry.state?.x)).toStrictEqual([5, 2]);
        tree.jumpTo(0);
        await flush();
        expect(tree.$.x()).toBe(5);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c']);
      } finally {
        tree.destroy();
      }
    });

    // A later overlapping transaction must settle first (rolling T back while
    // it is open refuses, later-pending-dependency); once confirmed it is an
    // ordinary later turn.
    it('a later undoable transaction, confirmed before the rejection, undoes to what T replaced', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        let later: { confirm(): void } | undefined;
        undoable(() => {
          later = tree.transaction(() => tree.$.x(2));
        });
        await flush();
        later?.confirm();
        await flush();
        proposal.rollback();
        await flush();
        expect(tree.$.x()).toBe(2);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
        tree.redo();
        await flush();
        expect(tree.$.x()).toBe(2);
      } finally {
        tree.destroy();
      }
    });

    it('control: a CONFIRMED transaction stays in the undo chain', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        undoable(() => tree.$.x(2));
        await flush();
        proposal.confirm();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('a later write over an EXTERNAL value written after T is not re-based', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        tree.$.x(5); // not undoable: external to history
        await flush();
        undoable(() => tree.$.x(2));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(5);
      } finally {
        tree.destroy();
      }
    });

    it('a chain of later writes: only the first is re-based', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        undoable(() => tree.$.x(3));
        await flush();
        undoable(() => tree.$.x(4));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(3);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
      } finally {
        tree.destroy();
      }
    });
  }
);
