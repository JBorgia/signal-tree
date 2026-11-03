import { describe, expect, it } from 'vitest';

import { entityMap, link, signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';

type Row = { id: string; n: number };
const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
const inspect = (work: () => void) =>
  withWriteContext({ participation: 'inspection' }, work);
const make = () =>
  signalTree(
    { branch: { rows: entityMap<Row, string>() } },
    { enhancers: [transactions()] }
  );
type Tree = ReturnType<typeof make>;
type Mode = 'collection' | 'nested branch';
const connect = (tree: Tree, mode: Mode) => {
  const sent: unknown[] = [];
  const endpoint = { set: (value: unknown) => void sent.push(structuredClone(value)) };
  // A declared branch containing EntityMapBuilder needs the established internal
  // branch-source cast; collection sources use the public typed surface.
  const connection =
    mode === 'collection'
      ? link(tree.$.branch.rows, endpoint)
      : link(tree.$.branch as never, endpoint as never);
  const lastRows = (): Row[] | undefined => {
    const value = sent.at(-1);
    return mode === 'collection'
      ? (value as Row[] | undefined)
      : (value as { rows: { all: Row[] } } | undefined)?.rows.all;
  };
  return { connection, sent, lastRows };
};

describe('ordinary order source and relationship boundaries', () => {
  it('captures current ordinary payload after placement-only inspection divergence', async () => {
    const tree = make();
    try {
      const rows = tree.$.branch.rows;
      rows.setAll([{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }]);
      await tick();
      const b = rows.byIdOrFail('b');
      inspect(() => rows.setAll([{ id: 'c', n: 3 }, { id: 'b', n: 2 }, { id: 'a', n: 1 }]));
      rows.updateOne('b', { n: 44 });
      expect(b.n()).toBe(44);
      const pending = tree.transact(() => rows.removeOne('b'));
      pending.rollback();
      expect(rows.byIdOrFail('b')).toBe(b);
      expect(b()).toEqual({ id: 'b', n: 44 });
    } finally {
      tree.destroy();
    }
  });

  for (const mode of ['collection', 'nested branch'] as const) {
    it(`preserves connection-relative ordinary remove and later adoption (${mode})`, async () => {
      const tree = make();
      const connections: ReturnType<typeof connect>[] = [];
      try {
        const rows = tree.$.branch.rows;
        rows.addOne({ id: 'a', n: 1 });
        await tick();
        const before = connect(tree, mode);
        connections.push(before);
        inspect(() => rows.addOne({ id: 'x', n: 9 }));
        await tick();
        const after = connect(tree, mode);
        connections.push(after);
        // X is absent from source ordinary state, but was adopted by the later
        // relationship's baseline. An ordinary remove still affects that link.
        rows.removeOne('x');
        await tick();
        await Promise.all(connections.map(({ connection }) => connection.settled()));
        expect(before.sent).toHaveLength(0);
        expect(after.lastRows()).toEqual([{ id: 'a', n: 1 }]);
        const publishedBefore = before.sent.length;
        const publishedAfter = after.sent.length;
        inspect(() => {
          rows.addOne({ id: 'x', n: 9 });
          rows.setAll([{ id: 'x', n: 9 }, { id: 'a', n: 1 }]);
        });
        await tick();
        await Promise.all(connections.map(({ connection }) => connection.settled()));
        expect(before.sent).toHaveLength(publishedBefore);
        expect(after.sent).toHaveLength(publishedAfter);
        rows.updateOne('x', { n: 10 });
        await tick();
        await Promise.all(connections.map(({ connection }) => connection.settled()));
        const adopted = [{ id: 'x', n: 10 }, { id: 'a', n: 1 }];
        expect(before.lastRows()).toEqual(adopted);
        expect(after.lastRows()).toEqual(adopted);
        expect(before.sent.length).toBeGreaterThan(publishedBefore);
        expect(after.sent.length).toBeGreaterThan(publishedAfter);
      } finally {
        for (const { connection } of connections) connection.dispose();
        tree.destroy();
      }
    });

    it(`applies a selected field inverse without replacing either connection baseline (${mode})`, async () => {
      const tree = make();
      const connections: ReturnType<typeof connect>[] = [];
      try {
        const rows = tree.$.branch.rows;
        rows.addOne({ id: 'a', n: 1 });
        await tick();
        const before = connect(tree, mode);
        connections.push(before);
        inspect(() => {
          rows.addOne({ id: 'x', n: 9 });
          rows.setAll([{ id: 'x', n: 9 }, { id: 'a', n: 1 }]);
        });
        await tick();
        const after = connect(tree, mode);
        connections.push(after);
        const pending = tree.transact(() => rows.updateOne('a', { n: 7 }));
        await tick();
        // Pending outbound work is held until terminal settlement. Waiting for
        // settled here would wait for the rollback that this test has not run.
        expect(before.sent).toHaveLength(0);
        expect(after.sent).toHaveLength(0);
        const beforeCount = before.sent.length;
        const afterCount = after.sent.length;
        pending.rollback();
        await tick();
        await Promise.all(connections.map(({ connection }) => connection.settled()));
        expect(before.lastRows()).toEqual([{ id: 'a', n: 1 }]);
        expect(after.lastRows()).toEqual([{ id: 'x', n: 9 }, { id: 'a', n: 1 }]);
        expect(before.sent.length).toBeGreaterThan(beforeCount);
        expect(after.sent.length).toBeGreaterThan(afterCount);
      } finally {
        for (const { connection } of connections) connection.dispose();
        tree.destroy();
      }
    });
  }
});
