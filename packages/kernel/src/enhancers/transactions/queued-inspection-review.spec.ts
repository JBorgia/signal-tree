import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions, peekInternalTransactionRuntime } from './transactions';
import { entityMap } from '../../lib/markers/entity-map';

const external = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);
const flush = () => getPathNotifier().flushSync();

describe('independent queued inspection review', () => {
  it('does not count external writes queued before construction as later', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    try {
      external(() => tree.$.x(9));
      const proposal = tree.propose(() => tree.$.x(1));
      expect(proposal.inspect().changes).toEqual([
        { path: 'x', status: 'current' },
      ]);
    } finally {
      tree.destroy();
    }
  });
  it.each(['before', 'after'] as const)(
    'orders realized %s authored contribution inside callback',
    (order) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      try {
        const proposal = tree.propose(() => {
          if (order === 'before') external(() => tree.$.x(9));
          tree.$.x(1);
          if (order === 'after') external(() => tree.$.x(9));
        });
        expect(tree.$.x()).toBe(order === 'before' ? 1 : 9);
        expect(proposal.inspect().changes).toEqual([
          { path: 'x', status: order === 'before' ? 'current' : 'superseded' },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );
  it.each(['flush', 'new-pending'] as const)(
    'does not lose later scalar ABA on %s',
    (delivery) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      try {
        const proposal = tree.propose(() => tree.$.x(1));
        external(() => {
          tree.$.x(9);
          tree.$.x(1);
        });
        expect
          .soft(proposal.inspect().changes)
          .toEqual([{ path: 'x', status: 'superseded' }]);
        if (delivery === 'flush') flush();
        else tree.propose(() => tree.$.y(1));
        expect(proposal.inspect().changes).toEqual([
          { path: 'x', status: 'superseded' },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );
  it('retains an entity field ABA footprint even when inspection first runs after flush', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; x: number; y: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', x: 0, y: 0 });
      flush();
      const proposal = tree.propose(() =>
        tree.$.rows.updateOne('a', { x: 1, y: 1 })
      );
      external(() => {
        tree.$.rows.updateOne('a', { x: 9 });
        tree.$.rows.updateOne('a', { x: 1 });
      });
      flush();
      expect(proposal.inspect().changes).toEqual([
        { path: 'rows.a.x', status: 'superseded' },
        { path: 'rows.a.y', status: 'current' },
      ]);
    } finally {
      tree.destroy();
    }
  });
  it('bounds accepted writer footprints while one older proposal remains pending', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    try {
      const older = tree.propose(() => tree.$.x(1));
      for (let x = 2; x <= 501; x++) tree.propose(() => tree.$.x(x)).accept();
      const runtime = peekInternalTransactionRuntime(tree)!;
      expect(runtime.getInspectionFootprintCountsForTesting()).toEqual({
        writers: 2,
        footprints: 2,
      });
      expect(older.inspect().changes).toEqual([
        { path: 'x', status: 'superseded' },
      ]);
      older.accept();
      expect(runtime.getInspectionFootprintCountsForTesting()).toEqual({
        writers: 0,
        footprints: 0,
      });
    } finally {
      tree.destroy();
    }
  });
  it('supersedes a proposed field when its entity lifetime is removed', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; x: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', x: 0 });
      flush();
      const proposal = tree.propose(() => tree.$.rows.updateOne('a', { x: 1 }));
      external(() => tree.$.rows.removeOne('a'));
      expect(proposal.inspect().changes).toEqual([
        { path: 'rows.a.x', status: 'superseded' },
      ]);
      flush();
      expect(proposal.inspect().changes).toEqual([
        { path: 'rows.a.x', status: 'superseded' },
      ]);
    } finally {
      tree.destroy();
    }
  });
  // Preserve deliberate net-effect admission (0a131c34, SIC-B d8ad11da5).
  // A no-turn authored callback is not the realized ABA footprint case above.
  it.each(['accept', 'reject'] as const)(
    'preserves older status when a no-turn proposal is %sed',
    (settlement) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      try {
        const older = tree.propose(() => tree.$.x(1));
        const newer = tree.propose(() => {
          tree.$.x(2);
          tree.$.x(1);
        });
        const runtime = peekInternalTransactionRuntime(tree)!;
        expect(runtime.getPendingTurnCount()).toBe(1);
        expect(newer.inspect().changes).toEqual([]);
        expect(older.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
        ]);
        newer[settlement]();
        expect(older.inspect().changes).toEqual([
          { path: 'x', status: 'current' },
        ]);
        expect(runtime.getPendingTurnCount()).toBe(1);
      } finally {
        tree.destroy();
      }
    }
  );
});
