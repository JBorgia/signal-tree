import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

type Row = { id: string | number; n: number; 'a.b': number; a: { b: number } };
const initial = (id: Row['id']): Row => ({ id, n: 0, 'a.b': 10, a: { b: 20 } });
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const make = (order?: 'transactions-first' | 'restoration-first') =>
  signalTree(
    { rows: entityMap<Row, Row['id']>({ selectId: (row) => row.id }) },
    {
      enhancers:
        order === undefined
          ? [transactions()]
          : order === 'transactions-first'
          ? [transactions(), restoration()]
          : [restoration(), transactions()],
    }
  );

describe.each(['jo.doe@example.com', '1.2.3', 'a/b', 'a::b', 1, '1'])(
  'typed entity address, key=%j',
  (id) => {
    it('rolls back a field using entity lifetime rather than splitting its key', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne(initial(id));
        await flush();
        tree.transaction(() => tree.$.rows.updateOne(id, { n: 1 })).rollback();
        expect(tree.$.rows.byIdOrFail(id)()).toEqual(initial(id));
      } finally {
        tree.destroy();
      }
    });

    it('keeps a literal dotted field distinct from a nested field', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne(initial(id));
        await flush();
        tree
          .transaction(() =>
            tree.$.rows.updateOne(id, { 'a.b': 11, a: { b: 21 } })
          )
          .rollback();
        expect(tree.$.rows.byIdOrFail(id)()).toEqual(initial(id));
      } finally {
        tree.destroy();
      }
    });

    it('preserves a later confirmed nested-field write when rolling back the literal field', async () => {
      const tree = make();
      try {
        tree.$.rows.addOne(initial(id));
        await flush();
        const pending = tree.transaction(() =>
          tree.$.rows.updateOne(id, { 'a.b': 11 })
        );
        tree
          .transaction(() => tree.$.rows.updateOne(id, { a: { b: 25 } }))
          .confirm();
        pending.rollback();
        expect(tree.$.rows.byIdOrFail(id)()).toEqual({
          ...initial(id),
          a: { b: 25 },
        });
      } finally {
        tree.destroy();
      }
    });
  }
);

describe('typed entity address across rekey and supersession', () => {
  it('reverses a field edit and rekey within the same transaction', async () => {
    const tree = make();
    try {
      const id = 'jo.doe@example.com';
      tree.$.rows.addOne(initial(id));
      await flush();
      const pending = tree.transaction(() => {
        tree.$.rows.updateOne(id, { n: 1 });
        tree.$.rows.changeId(id, '1.2.3');
        tree.$.rows.updateOne('1.2.3', { 'a.b': 12 });
      });
      pending.rollback();
      expect(tree.$.rows.all()).toEqual([initial(id)]);
    } finally {
      tree.destroy();
    }
  });

  it('does not erase a confirmed superseding write to the same field', async () => {
    const tree = make();
    try {
      const id = 'jo.doe@example.com';
      tree.$.rows.addOne(initial(id));
      await flush();
      const pending = tree.transaction(() =>
        tree.$.rows.updateOne(id, { n: 1 })
      );
      tree.transaction(() => tree.$.rows.updateOne(id, { n: 2 })).confirm();
      try {
        pending.rollback();
      } catch {
        /* Atomic v15 refusal is safe. */
        pending.confirm();
      }
      expect(tree.$.rows.byIdOrFail(id)()).toEqual({ ...initial(id), n: 2 });
    } finally {
      tree.destroy();
    }
  });
});

describe.each(['transactions-first', 'restoration-first'] as const)(
  'typed restoration address: %s',
  (order) => {
    it('undoes and redoes literal and nested fields independently in one entry', async () => {
      const tree = make(order);
      try {
        const id = 'jo.doe@example.com';
        tree.$.rows.addOne(initial(id));
        await flush();
        undoable(() => tree.$.rows.updateOne(id, { 'a.b': 11, a: { b: 21 } }));
        await flush();
        tree.undo();
        expect(tree.$.rows.byIdOrFail(id)()).toEqual(initial(id));
        tree.redo();
        expect(tree.$.rows.byIdOrFail(id)()).toEqual({
          ...initial(id),
          'a.b': 11,
          a: { b: 21 },
        });
      } finally {
        tree.destroy();
      }
    });

    it('undoes and redoes field edits around a rekey', async () => {
      const tree = make(order);
      try {
        const id = 'jo.doe@example.com';
        tree.$.rows.addOne(initial(id));
        await flush();
        undoable(() => {
          tree.$.rows.updateOne(id, { n: 1 });
          tree.$.rows.changeId(id, '1.2.3');
          tree.$.rows.updateOne('1.2.3', { 'a.b': 12 });
        });
        await flush();
        const updated = tree.$.rows.all();
        tree.undo();
        expect(tree.$.rows.all()).toEqual([initial(id)]);
        tree.redo();
        expect(tree.$.rows.all()).toEqual(updated);
      } finally {
        tree.destroy();
      }
    });
  }
);

it('preserves a confirmed nested sibling while reversing an independent nested field', async () => {
  const tree = signalTree(
    {
      rows: entityMap<
        { id: string; data: { left: number; right: number } },
        string
      >({ selectId: (row) => row.id }),
    },
    { enhancers: [transactions()] }
  );
  try {
    tree.$.rows.addOne({ id: 'a.b', data: { left: 0, right: 0 } });
    await flush();
    const pending = tree.transaction(() =>
      tree.$.rows.updateOne('a.b', { data: { left: 1, right: 0 } })
    );
    tree
      .transaction(() =>
        tree.$.rows.updateOne('a.b', { data: { left: 1, right: 2 } })
      )
      .confirm();
    pending.rollback();
    expect(tree.$.rows.byIdOrFail('a.b')().data).toEqual({ left: 0, right: 2 });
  } finally {
    tree.destroy();
  }
});

it('reverses a field by lifetime after a later confirmed rekey', async () => {
  const tree = make();
  try {
    tree.$.rows.addOne(initial('jo.doe@example.com'));
    await flush();
    const pending = tree.transaction(() =>
      tree.$.rows.updateOne('jo.doe@example.com', { 'a.b': 11 })
    );
    tree
      .transaction(() => tree.$.rows.changeId('jo.doe@example.com', '1.2.3'))
      .confirm();
    pending.rollback();
    expect(tree.$.rows.ids()).toEqual(['1.2.3']);
    expect(tree.$.rows.byIdOrFail('1.2.3')()).toEqual(
      initial('jo.doe@example.com')
    );
    expect(tree.$.rows.byId('jo.doe@example.com')).toBeUndefined();
  } finally {
    tree.destroy();
  }
});
