import { describe, expect, it } from 'vitest';

import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { getEntityMembershipInventory } from './internals/entity-membership-inventory';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

/**
 * LINK-COLLECTION-REORDER (15.4.4). A change to the ORDER of surviving rows
 * must reach a linked endpoint. Since 15.3.1 or earlier it never did: after
 * `setAll([D,C,B,A])` the tree held DCBA and the endpoint kept ABCD, because a
 * reorder publishes no row notification that carries order, and Link reads
 * order only from structural add/remove effects.
 *
 * Link now follows each linked collection's committed membership publication,
 * whose `reorder` change carries the complete order after `setAll()`,
 * `prependOne()`/`prependMany()` and every undo, redo, `jumpTo()` and rollback.
 * The collection-order capture channel that 16.x subscribes to is published
 * only by a forward `setAll()`, so it would have sent DCBA to the endpoint and
 * then left it there when undo or rollback restored ABCD.
 *
 * Inspection keeps its rule: an inspection reorder moves Link's LOCAL order and
 * never its eligible order, so it creates no send and no external-order
 * authority, and a later authored edit publishes the eligible order.
 */
type Row = { id: string; n: number };
const row = (id: string): Row => ({ id, n: id.charCodeAt(0) });
const rows = (ids: string): Row[] => [...ids].map(row);
const ids = (value: readonly Row[]) => value.map((r) => r.id).join('');

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;
const inspect = (fn: () => void) => withWriteContext(INSPECTION, fn);

type Kind = 'plain' | 'transactions' | 'restoration';
const declaration = () => ({
  n: 0,
  rows: entityMap<Row, string>(),
  data: { rows: entityMap<Row, string>(), label: 'x' },
});
const make = (kind: Kind = 'restoration') =>
  signalTree(declaration(), {
    enhancers: (kind === 'plain'
      ? []
      : kind === 'transactions'
      ? [transactions()]
      : [transactions(), restoration()]) as never,
  }) as unknown as ReturnType<typeof base>;
const base = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof base>;

async function linked(tree: Tree, seed: string) {
  tree.$.rows.setAll(rows(seed));
  await flush();
  const sent: string[] = [];
  const connection = link(tree.$.rows, {
    set: (value) => void sent.push(ids(value)),
  });
  return { sent, connection, endpoint: () => sent.at(-1) ?? seed };
}

const reorders: Array<[string, string, (t: Tree) => void]> = [
  ['setAll reversing every row', 'ABCD', (t) => t.$.rows.setAll(rows('DCBA'))],
  [
    'setAll reordering and dropping rows',
    'ABCD',
    (t) => t.$.rows.setAll(rows('CA')),
  ],
  [
    'setAll reordering, dropping and adding',
    'ABCD',
    (t) => t.$.rows.setAll(rows('CXA')),
  ],
  [
    'prependMany of new rows',
    'AB',
    (t) => void t.$.rows.prependMany(rows('XY')),
  ],
  [
    'prependMany moving an existing row to the front',
    'ABC',
    (t) =>
      void t.$.rows.prependMany([{ id: 'C', n: 99 }], { mode: 'overwrite' }),
  ],
  [
    'prependMany skipping an existing row',
    'AB',
    (t) => void t.$.rows.prependMany(rows('XB'), { mode: 'skip' }),
  ],
  ['prependOne', 'AB', (t) => void t.$.rows.prependOne(row('X'))],
];

describe.each<Kind>(['plain', 'transactions', 'restoration'])(
  'a forward reorder reaches the endpoint (%s)',
  (kind) => {
    it.each(reorders)('%s', async (_label, seed, op) => {
      const tree = make(kind);
      const { connection, endpoint } = await linked(tree, seed);
      try {
        op(tree);
        await flush();
        await connection.settled();
        expect(endpoint()).toBe(ids(tree.$.rows.all()));
        expect(endpoint()).not.toBe(seed);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    });
  }
);

describe('a reversed reorder reaches the endpoint', () => {
  const reversible = reorders.filter(([label]) => label.startsWith('setAll'));

  it.each(reversible)(
    'undo, redo and undo again of %s',
    async (_label, seed, op) => {
      const tree = make();
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

  it.each(reversible)('jumpTo across %s', async (_label, seed, op) => {
    const tree = make();
    const { connection, endpoint } = await linked(tree, seed);
    try {
      undoable(() => tree.$.n(1));
      await flush();
      undoable(() => op(tree));
      await flush();
      await connection.settled();
      const changed = ids(tree.$.rows.all());
      tree.jumpTo(0);
      await flush();
      await connection.settled();
      expect(endpoint()).toBe(seed);
      tree.jumpTo(1);
      await flush();
      await connection.settled();
      expect(endpoint()).toBe(changed);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it.each(reversible)('automatic rollback of %s', async (_label, seed, op) => {
    const tree = make('transactions');
    const { sent, connection, endpoint } = await linked(tree, seed);
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
      expect(sent.every((value) => value === seed)).toBe(true);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('a reorder inside a pending transaction', () => {
  it.each<Kind>(['transactions', 'restoration'])(
    'is held until confirm, then sent once (%s)',
    async (kind) => {
      const tree = make(kind);
      const { sent, connection } = await linked(tree, 'ABCD');
      try {
        const pending = tree.transaction(() =>
          tree.$.rows.setAll(rows('DCBA'))
        );
        await flush();
        expect(sent).toEqual([]);
        pending.confirm();
        await flush();
        await connection.settled();
        expect(sent).toEqual(['DCBA']);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it.each<Kind>(['transactions', 'restoration'])(
    'never reaches the endpoint when rolled back (%s)',
    async (kind) => {
      const tree = make(kind);
      const { sent, connection, endpoint } = await linked(tree, 'ABCD');
      try {
        const pending = tree.transaction(() =>
          tree.$.rows.setAll(rows('DCBA'))
        );
        await flush();
        expect(sent).toEqual([]);
        pending.rollback();
        await flush();
        await connection.settled();
        expect(ids(tree.$.rows.all())).toBe('ABCD');
        expect(sent).not.toContain('DCBA');
        expect(endpoint()).toBe('ABCD');
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('an ordinary reorder is held behind an unrelated pending transaction', async () => {
    const tree = make('transactions');
    const { sent, connection } = await linked(tree, 'ABC');
    const pending = tree.transaction(() => tree.$.n(1));
    try {
      tree.$.rows.setAll(rows('CAB'));
      await flush();
      expect(sent).toEqual([]);
      pending.confirm();
      await flush();
      await connection.settled();
      expect(sent).toEqual(['CAB']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('reorders sharing a tick with other collection work', () => {
  it.each<[string, (t: Tree) => void, string]>([
    [
      'rows added and then reordered before the first delivery',
      (t) => {
        t.$.rows.setAll(rows('ABC'));
        t.$.rows.setAll(rows('CAB'));
      },
      'CAB',
    ],
    [
      'a row added, then included in a reorder',
      (t) => {
        t.$.rows.addOne(row('E'));
        t.$.rows.setAll(rows('EDCBA'));
      },
      'EDCBA',
    ],
    [
      'a reorder, then a row appended',
      (t) => {
        t.$.rows.setAll(rows('DCBA'));
        t.$.rows.addOne(row('E'));
      },
      'DCBAE',
    ],
    [
      'a reorder, then a row removed',
      (t) => {
        t.$.rows.setAll(rows('DCBA'));
        t.$.rows.removeOne('C');
      },
      'DBA',
    ],
    [
      'a row removed, then a reorder of the rest',
      (t) => {
        t.$.rows.removeOne('C');
        t.$.rows.setAll(rows('DBA'));
      },
      'DBA',
    ],
  ])('%s', async (_label, op, expected) => {
    const tree = make();
    const { connection, endpoint } = await linked(tree, 'ABCD');
    try {
      op(tree);
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe(expected);
      expect(endpoint()).toBe(expected);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('inspection reorders acquire no external-order authority', () => {
  it('an inspection reorder alone sends nothing', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      inspect(() => tree.$.rows.setAll(rows('CAB')));
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe('CAB');
      expect(sent).toEqual([]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a later authored row edit publishes the eligible order, not the inspected one', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      inspect(() => tree.$.rows.setAll(rows('CAB')));
      await flush();
      tree.$.rows.updateOne('B', { n: 0 });
      await flush();
      await connection.settled();
      expect(sent).toEqual(['ABC']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a later authored reorder publishes the authored order', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      inspect(() => tree.$.rows.setAll(rows('CAB')));
      await flush();
      tree.$.rows.setAll(rows('BCA'));
      await flush();
      await connection.settled();
      expect(sent).toEqual(['BCA']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('an inspection removal does not ride out on an authored reorder', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      inspect(() => tree.$.rows.removeOne('B'));
      await flush();
      tree.$.rows.setAll(rows('CA'));
      await flush();
      await connection.settled();
      // B keeps its eligible slot; the authored reorder moves only A and C.
      expect(sent).toEqual(['CBA']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('an inspection prepend does not ride out on an authored edit', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree, 'AB');
    try {
      inspect(() => tree.$.rows.prependMany(rows('XY')));
      await flush();
      tree.$.rows.updateOne('A', { n: 0 });
      await flush();
      await connection.settled();
      expect(sent).toEqual(['AB']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('undo of an authored reorder after an inspection reorder never publishes the inspected order', async () => {
    const tree = make();
    const { sent, connection, endpoint } = await linked(tree, 'ABC');
    try {
      undoable(() => tree.$.rows.setAll(rows('CBA')));
      await flush();
      await connection.settled();
      expect(endpoint()).toBe('CBA');
      inspect(() => tree.$.rows.setAll(rows('BAC')));
      await flush();
      await connection.settled();
      expect(endpoint()).toBe('CBA');
      // Restoration may refuse this undo (the order frontier moved under it);
      // either way the endpoint holds eligible order, never the inspected one.
      let refused = false;
      try {
        tree.undo();
      } catch {
        refused = true;
      }
      await flush();
      await connection.settled();
      expect(endpoint()).toBe(refused ? 'CBA' : ids(tree.$.rows.all()));
      expect(sent).not.toContain('BAC');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('collections inside branch and root Links', () => {
  it.each(['forward', 'undo'] as const)(
    'a nested collection reorder through a branch Link (%s)',
    async (mode) => {
      const tree = make();
      tree.$.data.rows.setAll(rows('ABC'));
      await flush();
      const sent: Array<{ rows: { all: Row[] } }> = [];
      const connection = link(tree.$.data as never, {
        set: ((value: { rows: { all: Row[] } }) =>
          void sent.push(value)) as never,
      });
      try {
        undoable(() => tree.$.data.rows.setAll(rows('CAB')));
        await flush();
        await connection.settled();
        expect(ids(sent.at(-1)!.rows.all)).toBe('CAB');
        if (mode === 'undo') {
          tree.undo();
          await flush();
          await connection.settled();
          expect(ids(sent.at(-1)!.rows.all)).toBe('ABC');
        }
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('a collection reorder through the root Link', async () => {
    const tree = make();
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    const sent: Array<{ rows: { all: Row[] } }> = [];
    const connection = link(tree.$ as never, {
      set: ((value: { rows: { all: Row[] } }) =>
        void sent.push(value)) as never,
    });
    try {
      tree.$.rows.setAll(rows('CAB'));
      await flush();
      await connection.settled();
      expect(ids(sent.at(-1)!.rows.all)).toBe('CAB');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('relationship lifecycle', () => {
  it('settled() waits for an order-only asynchronous acknowledgement', async () => {
    const tree = make('plain');
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    let acknowledge!: () => void;
    const acknowledged = new Promise<void>(
      (resolve) => (acknowledge = resolve)
    );
    const sent: string[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(ids(value));
        return acknowledged;
      },
    });
    try {
      tree.$.rows.setAll(rows('CAB'));
      let done = false;
      const settled = connection.settled().then(() => void (done = true));
      await flush();
      expect(sent).toEqual(['CAB']);
      expect(done).toBe(false);
      acknowledge();
      await settled;
      expect(done).toBe(true);
    } finally {
      acknowledge();
      connection.dispose();
      tree.destroy();
    }
  });

  it('a reorder of the very rows already held is still sent', async () => {
    // Identical row objects: the flush delivers no value change, only order.
    const tree = make('plain');
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      tree.$.rows.setAll([...tree.$.rows.all()].reverse());
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe('CBA');
      expect(sent).toEqual(['CBA']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a prepend that moves a held row object unchanged is still sent', async () => {
    const tree = make('plain');
    const { sent, connection } = await linked(tree, 'ABC');
    try {
      const stored = tree.$.rows.all()[2];
      tree.$.rows.prependMany([stored], { mode: 'overwrite' });
      await flush();
      await connection.settled();
      expect(ids(tree.$.rows.all())).toBe('CAB');
      expect(sent).toEqual(['CAB']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('every relationship over the collection receives the reorder', async () => {
    const tree = make('plain');
    const { sent, connection } = await linked(tree, 'ABC');
    const other: string[] = [];
    const second = link(tree.$.rows, {
      set: (value) => void other.push(ids(value)),
    });
    try {
      tree.$.rows.setAll(rows('CAB'));
      await flush();
      await connection.settled();
      await second.settled();
      expect(sent).toEqual(['CAB']);
      expect(other).toEqual(['CAB']);
    } finally {
      connection.dispose();
      second.dispose();
      tree.destroy();
    }
  });

  it('dispose stops order delivery and releases the membership subscription', async () => {
    const tree = make('plain');
    const { sent, connection } = await linked(tree, 'ABC');
    const inventory = () => getEntityMembershipInventory(tree.$.rows as object);
    expect(inventory()?.observed()).toBe(true);
    tree.$.rows.setAll(rows('CAB'));
    connection.dispose();
    expect(inventory()?.observed()).toBe(false);
    await flush();
    expect(sent).toEqual([]);
    tree.destroy();
  });

  it('a failed endpoint subscription leaves no membership subscription', async () => {
    const tree = make('plain');
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    expect(() =>
      link(tree.$.rows, {
        set: () => undefined,
        subscribe: () => {
          throw new Error('subscribe');
        },
      })
    ).toThrow('subscribe');
    expect(
      getEntityMembershipInventory(tree.$.rows as object)?.observed() ?? false
    ).toBe(false);
    tree.destroy();
  });
});
