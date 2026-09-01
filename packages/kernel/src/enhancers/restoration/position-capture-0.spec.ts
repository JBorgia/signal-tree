import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';
import { transactions } from '../transactions/transactions';
import { withWriteContext } from '../../lib/write-context';

type Row = { id: string; value: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('RESTORATION-POSITION-CAPTURE-0', () => {
  it(
    'retains and reverses a designated pure reorder without replacing subjects',
    async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration({ maxHistorySize: 10 })] }
      );

      undoable(() =>
        tree.$.rows.setAll([
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
          { id: 'c', value: 3 },
        ])
      );
      await flush();

      const heldA = tree.$.rows.byIdOrFail('a');
      const heldB = tree.$.rows.byIdOrFail('b');
      const heldC = tree.$.rows.byIdOrFail('c');
      const before = tree.getRestorationHistory().length;

      undoable(() =>
        tree.$.rows.setAll([
          { id: 'c', value: 3 },
          { id: 'b', value: 2 },
          { id: 'a', value: 1 },
        ])
      );
      await flush();

      expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
      expect(tree.getRestorationHistory()).toHaveLength(before + 1);
      const internal = tree as unknown as {
        __restoration: {
          getTurns(): Array<{
            __orderDeltas?: Array<{ afterFrontier: unknown }>;
          }>;
        };
      };
      const binding = tree.$.rows as unknown as {
        __prepareTransitionTarget: {
          readSource(): { orderFrontier: unknown };
        };
      };
      expect(
        binding.__prepareTransitionTarget.readSource().orderFrontier
      ).toBe(internal.__restoration.getTurns().at(-1)?.__orderDeltas?.[0].afterFrontier);

      tree.undo();
      await flush();

      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(heldA()).toEqual({ id: 'a', value: 1 });
      expect(heldB()).toEqual({ id: 'b', value: 2 });
      expect(heldC()).toEqual({ id: 'c', value: 3 });

      tree.redo();
      await flush();

      expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
      expect(heldA()).toEqual({ id: 'a', value: 1 });
      expect(heldB()).toEqual({ id: 'b', value: 2 });
      expect(heldC()).toEqual({ id: 'c', value: 3 });
    }
  );

  it('reverses a reorder and field write as one target transition', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'c', value: 3 },
      ])
    );
    await flush();

    undoable(() => {
      tree.$.rows.updateOne('b', { value: 20 });
      tree.$.rows.setAll([
        { id: 'c', value: 3 },
        { id: 'b', value: 20 },
        { id: 'a', value: 1 },
      ]);
    });
    await flush();

    expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
    expect(tree.$.rows.byIdOrFail('b')()).toEqual({ id: 'b', value: 20 });

    tree.undo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
    expect(tree.$.rows.byIdOrFail('b')()).toEqual({ id: 'b', value: 2 });

    tree.redo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
    expect(tree.$.rows.byIdOrFail('b')()).toEqual({ id: 'b', value: 20 });
  });

  it('reverses a confirmed transaction containing reorder and scalar work', async () => {
    const tree = signalTree(
      {
        count: 0,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 10 }), transactions()],
      }
    );
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'c', value: 3 },
      ])
    );
    await flush();

    const pending = tree.transaction(() =>
      undoable(() => {
        tree.$.count.set(1);
        tree.$.rows.setAll([
          { id: 'c', value: 3 },
          { id: 'b', value: 2 },
          { id: 'a', value: 1 },
        ]);
      })
    );
    pending.confirm();
    await flush();

    tree.undo();
    await flush();

    expect(tree.$.count()).toBe(0);
    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);

    tree.redo();
    await flush();

    expect(tree.$.count()).toBe(1);
    expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
  });

  it('rolls back a pending transaction containing reorder and scalar work', async () => {
    const tree = signalTree(
      {
        count: 0,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 10 }), transactions()],
      }
    );
    tree.$.rows.setAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ]);
    await flush();

    const pending = tree.transaction(() => {
      tree.$.count.set(1);
      tree.$.rows.setAll([
        { id: 'c', value: 3 },
        { id: 'b', value: 2 },
        { id: 'a', value: 1 },
      ]);
    });
    pending.rollback();
    await flush();

    expect(tree.$.count()).toBe(0);
    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
  });

  it('rolls back a pure reorder when the transaction callback throws', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [transactions()] }
    );
    tree.$.rows.setAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ]);
    await flush();

    expect(() =>
      tree.transaction(() => {
        tree.$.rows.setAll([
          { id: 'c', value: 3 },
          { id: 'b', value: 2 },
          { id: 'a', value: 1 },
        ]);
        throw new Error('boom');
      })
    ).toThrow('boom');
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
  });

  it('refuses to overwrite a later realized collection order', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'c', value: 3 },
      ])
    );
    await flush();
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'c', value: 3 },
        { id: 'b', value: 2 },
        { id: 'a', value: 1 },
      ])
    );
    await flush();

    withWriteContext({ intent: 'system', participation: 'realized' }, () =>
      tree.$.rows.setAll([
        { id: 'b', value: 2 },
        { id: 'c', value: 3 },
        { id: 'a', value: 1 },
      ])
    );
    await flush();

    expect(() => tree.undo()).toThrow(/ST1034/);
    expect(tree.$.rows.ids()).toEqual(['b', 'c', 'a']);
    expect(tree.getCurrentIndex()).toBe(1);
  });
});
