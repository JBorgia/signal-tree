import { describe, expect, it } from 'vitest';

import {
  batching,
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { getPathNotifier } from './path-notifier';

/**
 * LINK-RESTORE-PLACEMENT (15.4.4). Rows a reversal or `setAll()` brings back
 * must reach a linked endpoint in the tree's order, not only as members.
 *
 * Every added row is published with the neighbours it has in the FINAL order
 * of its operation (`add A pred=- succ=B`, then `add B pred=A succ=C`), and a
 * reversal publishes restored rows in lifetime-id order, which need not be
 * their positional order. Link's topology could only place a row next to a
 * neighbour it already held, and otherwise appended it. From ABCD,
 * `removeMany(['A','B'])` followed by rollback or undo left the tree at ABCD
 * and the endpoint at CDAB, with or without `restoration()` and in either
 * enhancer order. A row whose neighbours both arrive later in the same
 * operation landed at the end too.
 *
 * Placement now treats "no predecessor" as the head and "no successor" as the
 * tail, holds a row whose neighbours are both still to come until one lands,
 * and bridges a neighbour that was removed before it ever arrived through that
 * removal's own neighbours.
 */
type Row = { id: string; n: number };
const row = (id: string): Row => ({ id, n: id.charCodeAt(0) });
const rows = (ids: string): Row[] => [...ids].map(row);
const ids = (value: readonly Row[]) => value.map((r) => r.id).join('');

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

type Order =
  | 'transactions-first'
  | 'restoration-first'
  | 'no-restoration'
  | 'batching';
const enhancersFor = (order: Order) =>
  order === 'transactions-first'
    ? [transactions(), restoration()]
    : order === 'restoration-first'
    ? [restoration(), transactions()]
    : order === 'batching'
    ? [batching(), transactions(), restoration()]
    : [transactions()];

const make = (order: Order = 'transactions-first') =>
  signalTree(
    {
      rows: entityMap<Row, string>(),
      data: { rows: entityMap<Row, string>(), label: 'x' },
    },
    { enhancers: enhancersFor(order) as never }
  ) as unknown as ReturnType<typeof base>;
const base = () =>
  signalTree(
    {
      rows: entityMap<Row, string>(),
      data: { rows: entityMap<Row, string>(), label: 'x' },
    },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof base>;

/** A linked collection recording every complete value the endpoint receives. */
async function linked(tree: Tree, seed: string) {
  tree.$.rows.setAll(rows(seed));
  await flush();
  const sent: string[] = [];
  const connection = link(tree.$.rows, {
    set: (value) => void sent.push(ids(value)),
  });
  const endpoint = () => sent.at(-1) ?? seed;
  return { sent, connection, endpoint };
}

const removals: Array<[string, string, (t: Tree) => void]> = [
  ['removeMany head run [A,B]', 'ABCD', (t) => t.$.rows.removeMany(['A', 'B'])],
  [
    'removeMany head run given tail-first [B,A]',
    'ABCD',
    (t) => t.$.rows.removeMany(['B', 'A']),
  ],
  [
    'sequential removeOne A then B',
    'ABCD',
    (t) => {
      t.$.rows.removeOne('A');
      t.$.rows.removeOne('B');
    },
  ],
  [
    'two runs, one at the head [A,B,D,E]',
    'ABCDEF',
    (t) => t.$.rows.removeMany(['A', 'B', 'D', 'E']),
  ],
  [
    'interleaved singles [A,C,E]',
    'ABCDEF',
    (t) => t.$.rows.removeMany(['A', 'C', 'E']),
  ],
  [
    'middle and tail runs [B,C,E,F]',
    'ABCDEF',
    (t) => t.$.rows.removeMany(['B', 'C', 'E', 'F']),
  ],
  ['clear', 'ABCD', (t) => t.$.rows.clear()],
  [
    'setAll keeping only the tail [C,D]',
    'ABCD',
    (t) => t.$.rows.setAll(rows('CD')),
  ],
  [
    'setAll replacing the head [X,C,D]',
    'ABCD',
    (t) => t.$.rows.setAll(rows('XCD')),
  ],
];

describe.each<Order>([
  'transactions-first',
  'restoration-first',
  'no-restoration',
  'batching',
])('restored rows reach Link in tree order (%s)', (order) => {
  it.each(removals)('explicit rollback of %s', async (_label, seed, op) => {
    const tree = make(order);
    const { connection, endpoint } = await linked(tree, seed);
    try {
      const pending = tree.transaction(() => op(tree));
      await flush();
      pending.rollback();
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe(seed);
      expect(endpoint()).toBe(seed);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it.each(removals)('automatic rollback of %s', async (_label, seed, op) => {
    const tree = make(order);
    const { connection, endpoint } = await linked(tree, seed);
    try {
      expect(() =>
        tree.transaction(() => {
          op(tree);
          throw new Error('boom');
        })
      ).toThrow('boom');
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe(seed);
      expect(endpoint()).toBe(seed);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  if (order !== 'no-restoration')
    it.each(removals)(
      'undo, redo and undo again of %s',
      async (_label, seed, op) => {
        const tree = make(order);
        const { connection, endpoint } = await linked(tree, seed);
        try {
          undoable(() => op(tree));
          await flush();
          await connection.settled();
          const changed = ids(tree.$.rows.all());
          expect(endpoint()).toBe(changed);

          tree.undo();
          await flush();
          await connection.settled();
          expect(ids(tree.$.rows.all())).toBe(seed);
          expect(endpoint()).toBe(seed);

          tree.redo();
          await flush();
          await connection.settled();
          expect(ids(tree.$.rows.all())).toBe(changed);
          expect(endpoint()).toBe(changed);

          tree.undo();
          await flush();
          await connection.settled();
          expect(endpoint()).toBe(seed);
        } finally {
          connection.dispose();
          tree.destroy();
        }
      }
    );
});

describe('restored rows whose lifetime ids do not follow their positions', () => {
  // S has the lowest lifetime id but sits between P and Q, so the reversal
  // publishes it first, while both of its neighbours are still absent.
  // In 'SXQPY' Q's lifetime precedes P's, so S is released by its successor.
  async function scrambled(created = 'SXPQY') {
    const tree = make();
    tree.$.rows.setAll(rows(created));
    await flush();
    tree.$.rows.setAll(rows('XPSQY'));
    await flush();
    const sent: string[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => void sent.push(ids(value)),
    });
    return { tree, connection, endpoint: () => sent.at(-1) };
  }

  it.each([
    ['rollback', 'SXPQY'],
    ['undo', 'SXPQY'],
    ['jumpTo', 'SXPQY'],
    ['rollback', 'SXQPY'],
    ['undo', 'SXQPY'],
  ] as const)(
    'a middle run restored out of order (%s, lifetimes created as %s)',
    async (mode, created) => {
      const { tree, connection, endpoint } = await scrambled(created);
      try {
        if (mode === 'rollback') {
          const pending = tree.transaction(() =>
            tree.$.rows.removeMany(['P', 'S', 'Q'])
          );
          await flush();
          pending.rollback();
        } else {
          // jumpTo needs an earlier designated turn to land on.
          if (mode === 'jumpTo') {
            undoable(() => tree.$.rows.updateOne('X', { n: 0 }));
            await flush();
          }
          undoable(() => tree.$.rows.removeMany(['P', 'S', 'Q']));
          await flush();
          await connection.settled();
          expect(endpoint()).toBe('XY');
          if (mode === 'undo') tree.undo();
          else tree.jumpTo(0);
        }
        await flush();
        await connection.settled();
        expect(ids(tree.$.rows.all())).toBe('XPSQY');
        expect(endpoint()).toBe('XPSQY');
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('a held row survives its neighbours being removed again in the same tick', async () => {
    // The undo publishes S, P and Q; the removal of P and Q is a separate
    // delivery in the same flush.
    const { tree, connection, endpoint } = await scrambled();
    try {
      undoable(() => tree.$.rows.removeMany(['P', 'S', 'Q']));
      await flush();
      await connection.settled();
      tree.undo();
      tree.$.rows.removeMany(['P', 'Q']);
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe('XSY');
      expect(endpoint()).toBe('XSY');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a held row is placed when two reversals share a tick', async () => {
    // Two undos in one tick: the first restores P, S and Q (S first, waiting
    // on both), the second removes P and Q again in the same delivery.
    const tree = make();
    tree.$.rows.setAll(rows('SXY'));
    await flush();
    tree.$.rows.setAll(rows('XSY'));
    await flush();
    undoable(() => tree.$.rows.setAll(rows('XPSQY')));
    await flush();
    undoable(() => tree.$.rows.removeMany(['P', 'S', 'Q']));
    await flush();
    const sent: string[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => void sent.push(ids(value)),
    });
    try {
      tree.undo();
      tree.undo();
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe('XSY');
      expect(sent.at(-1)).toBe('XSY');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('forward setAll that adds rows ahead of their neighbours', () => {
  it.each([
    ['new rows at the head', 'AB', 'XYAB'],
    ['new rows at the head of an emptied collection', 'AB', 'XY'],
    ['new rows before and between survivors', 'ABC', 'XAYBC'],
    ['new rows at head and tail', 'AB', 'XABZ'],
  ])('%s', async (_label, seed, next) => {
    const tree = make();
    const { connection, endpoint } = await linked(tree, seed);
    try {
      tree.$.rows.setAll(rows(next));
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe(next);
      expect(endpoint()).toBe(next);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('rekeyed rows inside a restored run', () => {
  it('undo of rekey-then-remove at the head restores the original keys and order', async () => {
    const tree = make();
    const { connection, endpoint } = await linked(tree, 'ABCD');
    try {
      undoable(() => {
        tree.$.rows.changeId('A', 'Z');
        tree.$.rows.removeMany(['Z', 'B']);
      });
      await flush();
      await connection.settled();
      expect(endpoint()).toBe('CD');
      tree.undo();
      await flush();
      await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C', 'D']);
      expect(endpoint()).toBe(ids(tree.$.rows.all()));
      expect(endpoint()).toBe('ABCD');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('rollback of a rekeyed survivor plus a head removal', async () => {
    const tree = make();
    const { connection, endpoint } = await linked(tree, 'ABCD');
    try {
      const pending = tree.transaction(() => {
        tree.$.rows.changeId('C', 'Z');
        tree.$.rows.removeMany(['A', 'B']);
      });
      await flush();
      pending.rollback();
      await flush();
      await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C', 'D']);
      expect(endpoint()).toBe('ABCD');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('collections inside branch and root Links', () => {
  it.each(['rollback', 'undo'] as const)(
    'a nested collection restored at its head through a branch Link (%s)',
    async (mode) => {
      const tree = make();
      tree.$.data.rows.setAll(rows('ABCD'));
      await flush();
      const sent: Array<{ rows: { all: Row[] }; label: string }> = [];
      const connection = link(tree.$.data as never, {
        set: ((value: { rows: { all: Row[] }; label: string }) =>
          void sent.push(value)) as never,
      });
      try {
        if (mode === 'rollback') {
          const pending = tree.transaction(() =>
            tree.$.data.rows.removeMany(['A', 'B'])
          );
          await flush();
          pending.rollback();
        } else {
          undoable(() => tree.$.data.rows.removeMany(['A', 'B']));
          await flush();
          await connection.settled();
          tree.undo();
        }
        await flush();
        await connection.settled();
        expect(ids(tree.$.data.rows.all())).toBe('ABCD');
        expect(ids(sent.at(-1)!.rows.all)).toBe('ABCD');
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('a collection restored at its head through the root Link', async () => {
    const tree = make();
    tree.$.rows.setAll(rows('ABCD'));
    await flush();
    const sent: Array<{ rows: { all: Row[] } }> = [];
    const connection = link(tree.$ as never, {
      set: ((value: { rows: { all: Row[] } }) =>
        void sent.push(value)) as never,
    });
    try {
      const pending = tree.transaction(() =>
        tree.$.rows.removeMany(['A', 'B'])
      );
      await flush();
      pending.rollback();
      await flush();
      await connection.settled();
      expect(ids(sent.at(-1)!.rows.all)).toBe('ABCD');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
