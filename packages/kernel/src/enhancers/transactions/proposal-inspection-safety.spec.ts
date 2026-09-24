import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const external = (write: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, write);

// Inspection reports contributions. It is not a rollback permission check.
describe('proposal inspection safety', () => {
  it.each([false, true])(
    'sees later pending contributions and restores older status after newer rejection (flush=%s)',
    async (deliver) => {
      const tree = signalTree(
        { x: 0, y: 0, z: 0 },
        { enhancers: [transactions()] }
      );
      try {
        await flush();
        const older = tree.propose(() => {
          tree.$.x(1);
          tree.$.y(1);
        });
        if (deliver) await flush();
        const newer = tree.propose(() => {
          tree.$.y(2);
          tree.$.z(2);
        });
        if (deliver) await flush();
        expect.soft(older.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
          { path: 'y', status: 'superseded' },
        ]);
        expect(newer.inspect().changes).toEqual([
          { path: 'y', status: 'current' },
          { path: 'z', status: 'current' },
        ]);
        newer.reject();
        expect({ x: tree.$.x(), y: tree.$.y(), z: tree.$.z() }).toEqual({
          x: 1,
          y: 1,
          z: 0,
        });
        expect(older.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
          { path: 'y', status: 'current' },
        ]);
        await flush();
        expect(older.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
          { path: 'y', status: 'current' },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'sees an external write without requiring notification delivery (flush=%s)',
    async (deliver) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      try {
        await flush();
        const proposal = tree.propose(() => {
          tree.$.x(1);
          tree.$.y(1);
        });
        await flush();
        external(() => tree.$.y(9));
        if (deliver) await flush();
        expect(tree.$.y()).toBe(9);
        expect(proposal.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
          { path: 'y', status: 'superseded' },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each(['pending', 'external', 'external-queued', 'external-aba'] as const)(
    'keeps literal entity field n.a independent of nested n under later %s work',
    async (writer) => {
      type Row = { id: string; 'n.a': number; n: { a: number } };
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: [transactions()] }
      );
      try {
        tree.$.rows.addOne({ id: 'A', 'n.a': 0, n: { a: 0 } });
        await flush();
        const proposal = tree.propose(() => {
          tree.$.rows.updateOne('A', { 'n.a': 1, n: { a: 1 } });
        });
        await flush();
        const write = () => tree.$.rows.updateOne('A', { n: { a: 2 } });
        if (writer === 'pending') tree.propose(write);
        else external(write);
        if (writer === 'external-aba') {
          external(() => tree.$.rows.updateOne('A', { n: { a: 1 } }));
        }
        if (writer === 'pending' || writer === 'external') await flush();
        expect(tree.$.rows.byIdOrFail('A')()).toEqual({
          id: 'A',
          'n.a': 1,
          n: { a: writer === 'external-aba' ? 1 : 2 },
        });
        expect(proposal.inspect().changes).toEqual([
          { path: 'rows.A.n.a', status: 'current' },
          { path: 'rows.A.n', status: 'superseded' },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );

  it('keeps a structural contribution current after a later field update', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      await flush();
      const proposal = tree.propose(() =>
        tree.$.rows.addOne({ id: 'A', value: 1 })
      );
      await flush();
      external(() => tree.$.rows.updateOne('A', { value: 2 }));
      await flush();
      expect(proposal.inspect().changes).toEqual([
        { path: 'rows.A', status: 'current' },
      ]);
    } finally {
      tree.destroy();
    }
  });
});
