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
type Row = { id: string; n: number; nest?: { x: number } };
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
  ids: tree.$.rows.ids(),
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
  // ── A removal's value snapshot (review of 4b28e3bf, defect 1) ─────────────
  'row field T edited, W removed the row: undo restores the row as before T': {
    tx: (tree) => tree.$.rows.updateOne('a', { n: 2 }),
    later: (tree) => tree.$.rows.removeOne('a'),
    undone: (seeded) => seeded,
  },
  'nested row field T edited, W removed the row': {
    tx: (tree) => tree.$.rows.updateOne('a', { nest: { x: 2 } }),
    later: (tree) => tree.$.rows.removeOne('a'),
    undone: (seeded) => seeded,
  },
  'row T replaced dropping a field, W removed the row: the dropped field returns':
    {
      tx: (tree) => tree.$.rows.replaceOne('a', { id: 'a', n: 2 }),
      later: (tree) => tree.$.rows.removeOne('a'),
      undone: (seeded) => seeded,
    },
  'row T replaced adding a field, W removed the row: the added field does not return':
    {
      tx: (tree) =>
        tree.$.rows.replaceOne('c', { id: 'c', n: 3, nest: { x: 7 } }),
      later: (tree) => tree.$.rows.removeOne('c'),
      undone: (seeded) => seeded,
    },
  'row field T edited, W edited another field then removed the row': {
    tx: (tree) => tree.$.rows.updateOne('a', { n: 2 }),
    later: (tree) => {
      tree.$.rows.updateOne('a', { nest: { x: 5 } });
      tree.$.rows.removeOne('a');
    },
    undone: (seeded) => seeded,
  },
  'row field T edited, W edited the same field then removed the row': {
    tx: (tree) => tree.$.rows.updateOne('a', { n: 2 }),
    later: (tree) => {
      tree.$.rows.updateOne('a', { n: 5 });
      tree.$.rows.removeOne('a');
    },
    undone: (seeded) => seeded,
  },
  'row field T edited, W cleared the collection': {
    tx: (tree) => tree.$.rows.updateOne('a', { n: 2 }),
    later: (tree) => tree.$.rows.clear(),
    undone: (seeded) => seeded,
  },
  // ── A rekey (defect 2) ───────────────────────────────────────────────────
  'row T renamed, W removed it: undo restores the original key': {
    tx: (tree) => tree.$.rows.changeId('a', 'a2'),
    later: (tree) => tree.$.rows.removeOne('a2'),
    undone: (seeded) => seeded,
  },
  'row T renamed and edited, W removed it': {
    tx: (tree) => {
      tree.$.rows.changeId('a', 'a2');
      tree.$.rows.updateOne('a2', { n: 2 });
    },
    later: (tree) => tree.$.rows.removeOne('a2'),
    undone: (seeded) => seeded,
  },
  // ── Anchors on rows only T created (defect 3) ────────────────────────────
  "row T created, W appended a row after it: undo removes only W's row": {
    tx: (tree) => tree.$.rows.addOne({ id: 'A', n: 1 }),
    later: (tree) => tree.$.rows.addOne({ id: 'B', n: 2 }),
    undone: (seeded) => seeded,
  },
  'rows T created, W appended a row after them': {
    tx: (tree) => {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      tree.$.rows.addOne({ id: 'A2', n: 1 });
    },
    later: (tree) => tree.$.rows.addOne({ id: 'B', n: 2 }),
    undone: (seeded) => seeded,
  },
  'row T prepended, W removed its neighbour: the neighbour returns in place': {
    tx: (tree) => tree.$.rows.prependOne({ id: 'A', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('z'),
    undone: (seeded) => seeded,
  },
  'row T created, W removed its neighbour: the neighbour returns in place': {
    tx: (tree) => tree.$.rows.addOne({ id: 'A', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('c'),
    undone: (seeded) => seeded,
  },
};

const seedRows = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1, nest: { x: 1 } });
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
          // History is materialized from the same records, from the undone
          // position too (it threw on a dangling anchor).
          expect(tree.getRestorationHistory()).toHaveLength(history.length);

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

    it('a later turn left with no effects is dropped, not kept as a no-op step', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        undoable(() => tree.$.x(5));
        await flush();
        const proposal = tree.transaction(() =>
          tree.$.rows.addOne({ id: 'A', n: 1 })
        );
        await flush();
        undoable(() => tree.$.rows.removeOne('A'));
        await flush();
        undoable(() => tree.$.y(2));
        await flush();
        expect(tree.getRestorationHistory()).toHaveLength(3);
        proposal.rollback();
        await flush();
        expect(
          tree.getRestorationHistory().map((entry) => entry.state?.y)
        ).toStrictEqual([0, 2]);
        expect(tree.getCurrentIndex()).toBe(1);
        tree.undo();
        await flush();
        expect([tree.$.x(), tree.$.y(), tree.getCurrentIndex()]).toStrictEqual([
          5, 0, 0,
        ]);
        tree.undo();
        await flush();
        expect([tree.$.x(), tree.$.y(), tree.getCurrentIndex()]).toStrictEqual([
          0, 0, -1,
        ]);
        expect(tree.canUndo()).toBe(false);
        tree.redo();
        tree.redo();
        await flush();
        expect([tree.$.x(), tree.$.y(), tree.canRedo()]).toStrictEqual([
          5,
          2,
          false,
        ]);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c']);
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

    it('an address is claimed by its first later record even when that record does not match', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        tree.$.x(5); // external: the first later record, based on 5
        await flush();
        undoable(() => tree.$.x(1)); // authored over 5
        await flush();
        undoable(() => tree.$.x(3)); // based on the authored 1, not on T
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(1);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(5);
      } finally {
        tree.destroy();
      }
    });

    it('only the FIRST later record per address is re-based, even if a later one matches', async () => {
      const tree = make(enhancers);
      try {
        await seedRows(tree);
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        undoable(() => tree.$.x(2));
        await flush();
        undoable(() => tree.$.x(1)); // the same value T wrote, but authored here
        await flush();
        undoable(() => tree.$.x(5));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(1);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(2);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
      } finally {
        tree.destroy();
      }
    });

    it('a restored row anchored only to rows T created lands where they were', async () => {
      const tree = make(enhancers);
      try {
        tree.$.rows.addOne({ id: 'z', n: 0 });
        tree.$.rows.addOne({ id: 's', n: 9 });
        await flush();
        const proposal = tree.transaction(() =>
          tree.$.rows.setAll([
            { id: 'A', n: 1 },
            { id: 'z', n: 0 },
            { id: 'B', n: 2 },
            { id: 's', n: 9 },
          ])
        );
        await flush();
        undoable(() => tree.$.rows.removeMany(['A', 'z', 'B']));
        await flush();
        proposal.rollback();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['s']);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual([
          { id: 'z', n: 0 },
          { id: 's', n: 9 },
        ]);
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

// ── Lossless addresses (review of 4b28e3bf, defect 4) ────────────────────────
// A plain address is its position plus exact keys, never a display path: the
// literal key 'd.e' and the nested path d.e are different places. A record
// write and a leaf write to the same place ARE the same address.
describe.each(Object.entries(orders))(
  'undo after a rejection: plain addresses (%s)',
  (_order, enhancers) => {
    const makeDotted = (dotted: number) =>
      signalTree(
        { 'd.e': dotted, d: { e: 2 }, a: { b: 1, c: 1 } },
        { enhancers: enhancers() as never }
      ) as unknown as {
        $: {
          'd.e': (value?: number) => number;
          d: { (): { e: number }; e: (value?: number) => number };
          a: {
            (value?: { b: number; c: number }): { b: number; c: number };
            b: (value?: number) => number;
          };
        };
        transaction(fn: () => void): { rollback(): void };
        undo(): void;
        destroy(): void;
      };
    const read = (tree: ReturnType<typeof makeDotted>) => ({
      dotted: tree.$['d.e'](),
      nested: tree.$.d.e(),
    });

    it('T writes the nested d.e; a later write to the literal key is not re-based onto it', async () => {
      const tree = makeDotted(5);
      try {
        const proposal = tree.transaction(() => tree.$.d.e(5));
        await flush();
        undoable(() => tree.$['d.e'](9));
        await flush();
        proposal.rollback();
        await flush();
        expect(read(tree)).toStrictEqual({ dotted: 9, nested: 2 });
        tree.undo();
        await flush();
        expect(read(tree)).toStrictEqual({ dotted: 5, nested: 2 });
      } finally {
        tree.destroy();
      }
    });

    it('T writes the literal key; a write to the nested d.e does not consume its re-base', async () => {
      const tree = makeDotted(1);
      try {
        const proposal = tree.transaction(() => tree.$['d.e'](5));
        await flush();
        undoable(() => tree.$.d.e(7));
        await flush();
        undoable(() => tree.$['d.e'](9));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(read(tree)).toStrictEqual({ dotted: 1, nested: 7 });
        tree.undo();
        await flush();
        expect(read(tree)).toStrictEqual({ dotted: 1, nested: 2 });
      } finally {
        tree.destroy();
      }
    });

    it('T writes the record, a later write to its leaf: one address', async () => {
      const tree = makeDotted(1);
      try {
        const proposal = tree.transaction(() => tree.$.a({ b: 2, c: 1 }));
        await flush();
        undoable(() => tree.$.a.b(3));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.a()).toStrictEqual({ b: 1, c: 1 });
      } finally {
        tree.destroy();
      }
    });

    it('T writes the leaf, a later write to its record: one address', async () => {
      const tree = makeDotted(1);
      try {
        const proposal = tree.transaction(() => tree.$.a.b(2));
        await flush();
        undoable(() => tree.$.a({ b: 3, c: 1 }));
        await flush();
        proposal.rollback();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.a()).toStrictEqual({ b: 1, c: 1 });
      } finally {
        tree.destroy();
      }
    });
  }
);

// ── A history reset is not a settlement (review of 4b28e3bf, defect 5) ───────
describe.each(Object.entries(orders))(
  'undo after a rejection: history reset while T is pending (%s)',
  (_order, enhancers) => {
    it('the rejection still re-bases writes recorded after the reset', async () => {
      const tree = make(enhancers);
      try {
        undoable(() => tree.$.y(1));
        await flush();
        const proposal = tree.transaction(() => tree.$.x(1));
        await flush();
        (
          tree as unknown as { resetRestorationHistory(): void }
        ).resetRestorationHistory();
        await flush();
        undoable(() => tree.$.x(2));
        await flush();
        proposal.rollback();
        await flush();
        expect(tree.$.x()).toBe(2);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
      } finally {
        tree.destroy();
      }
    });
  }
);

// ── Key order of a re-based removal snapshot (re-review of 23b750f0, item 4) ──
// Values matched the no-T control but the dropped fields came back at the end:
// `m, nest` after `n` in the control, `nest, m` re-based. Serialization and
// persistence see key order, so the re-based snapshot keeps the pre-T order.
describe.each(Object.entries(orders))(
  'undo after a rejection: key order of a re-based snapshot (%s)',
  (_order, enhancers) => {
    type Wide = { id: string; n: number; m?: number; nest?: { x: number } };
    const makeWide = () => {
      const tree = signalTree(
        { rows: entityMap<Wide, string>({ selectId: (row) => row.id }) },
        { enhancers: enhancers() as never }
      ) as unknown as {
        $: {
          rows: {
            addOne(row: Wide): void;
            replaceOne(id: string, row: Wide): void;
            updateOne(id: string, patch: Partial<Wide>): void;
            removeOne(id: string): void;
            byId(id: string): (() => Wide) | undefined;
          };
        };
        transaction(fn: () => void): { rollback(): void };
        undo(): void;
        destroy(): void;
      };
      tree.$.rows.addOne({ id: 'a', n: 1, m: 1, nest: { x: 1 } });
      return tree;
    };
    const shapes: Record<
      string,
      Array<(tree: ReturnType<typeof makeWide>) => void>
    > = {
      'T dropped two fields, W removed the row': [
        (tree) => tree.$.rows.removeOne('a'),
      ],
      'T dropped two fields, W re-set one, W2 removed the row': [
        (tree) => tree.$.rows.updateOne('a', { m: 7 }),
        (tree) => tree.$.rows.removeOne('a'),
      ],
    };
    it.each(Object.keys(shapes))(
      '%s: undo gives the no-T keys in the no-T order',
      async (shape) => {
        const run = async (withT: boolean) => {
          const tree = makeWide();
          try {
            await flush();
            const proposal = withT
              ? tree.transaction(() =>
                  tree.$.rows.replaceOne('a', { id: 'a', n: 1 })
                )
              : undefined;
            await flush();
            for (const write of shapes[shape]) {
              undoable(() => write(tree));
              await flush();
            }
            proposal?.rollback();
            await flush();
            tree.undo();
            await flush();
            const row = tree.$.rows.byId('a')?.();
            return { keys: row ? Object.keys(row) : [], row };
          } finally {
            tree.destroy();
          }
        };
        const control = await run(false);
        const rebased = await run(true);
        expect(rebased).toStrictEqual(control);
        expect(rebased.keys).toStrictEqual(['id', 'n', 'm', 'nest']);
      }
    );
  }
);
