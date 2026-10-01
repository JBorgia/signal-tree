import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { StudioTreeDestroyedError } from '../../lib/internals/confirmed-turn-view';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { restoration } from './restoration';
import { transactions } from '../transactions/transactions';
import { installTransactionLifecycleChannel } from '../../lib/internals/causal-runtime/transaction-lifecycle';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('restoration lineage reader', () => {
  it('attaches while pending without inventing a retained entry, and ignores late confirmation after destroy', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [transactions(), restoration()] }
    );
    try {
      const pending = tree.transaction(() => undoable(() => tree.$.n(1)));
      const reader = restorationReader(tree)!;
      expect(reader.snapshot().entries).toEqual([]);
      let delivered = 0;
      reader.subscribe(() => {
        delivered++;
      });
      tree.destroy();
      pending.confirm();
      await flush();
      expect(delivered).toBe(0);
      expect(() => reader.snapshot()).toThrow(StudioTreeDestroyedError);
      expect(() => reader.subscribe(() => undefined)).toThrow(
        StudioTreeDestroyedError
      );
    } finally {
      tree.destroy();
    }
  });

  it('reports no-op attempts without retrospective delivery or retained operation history', () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      tree.undo();
      const reader = restorationReader(tree)!;
      const boundary = reader.snapshot().sequence;
      const events: unknown[] = [];
      const off = reader.subscribe((event) => events.push(event));
      expect(events).toEqual([]);
      tree.redo();
      tree.jumpTo(42);
      expect(events).toMatchObject([
        {
          operation: 'redo',
          outcome: 'noop',
          affectedEntryIds: [],
          sequence: boundary + 1,
        },
        {
          operation: 'jump',
          outcome: 'noop',
          affectedEntryIds: [],
          sequence: boundary + 2,
        },
      ]);
      off();
      off();
      tree.undo();
      expect(events).toHaveLength(2);
      expect(reader.snapshot()).not.toHaveProperty('operations');
    } finally {
      tree.destroy();
    }
  });

  it('keeps the event and entry snapshots detached for every listener', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      undoable(() => tree.$.n(1));
      await flush();
      const reader = restorationReader(tree)!;
      const id = reader.snapshot().entries[0].entryId;
      reader.subscribe((event, snapshot) => {
        try {
          (snapshot.entries[0].transactionIds as number[]).push(99);
        } catch {
          /* frozen */
        }
        if (event.kind === 'operation') {
          try {
            (event.affectedEntryIds as string[]).splice(0);
          } catch {
            /* frozen */
          }
        }
      });
      let checked = false;
      reader.subscribe((event, snapshot) => {
        if (event.kind !== 'operation') return;
        expect(event.affectedEntryIds).toEqual([id]);
        expect(snapshot.entries[0].transactionIds).toEqual([]);
        checked = true;
      });
      tree.undo();
      expect(checked).toBe(true);
      expect(reader.snapshot().entries[0].transactionIds).toEqual([]);
      expect(tree.getRestorationHistory()[0]).not.toHaveProperty('entryId');
    } finally {
      tree.destroy();
    }
  });

  it('distinguishes missing, disabled, empty, and destroyed capability', () => {
    const bare = signalTree({ n: 0 });
    const disabled = signalTree(
      { n: 0 },
      { enhancers: [restoration({ enabled: false })] }
    );
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      expect(restorationReader(bare)).toBeUndefined();
      expect(restorationReader(disabled)).toBeUndefined();
      bare.destroy();
      disabled.destroy();
      expect(() => restorationReader(bare)).toThrow(StudioTreeDestroyedError);
      expect(() => restorationReader(disabled)).toThrow(
        StudioTreeDestroyedError
      );
      const reader = restorationReader(tree)!;
      expect(reader.snapshot()).toMatchObject({
        entries: [],
        currentIndex: -1,
        canUndo: false,
        canRedo: false,
      });
      tree.destroy();
      expect(() => restorationReader(tree)).toThrow(StudioTreeDestroyedError);
      expect(() => reader.snapshot()).toThrow(StudioTreeDestroyedError);
      expect(() => reader.subscribe(() => undefined)).toThrow(
        StudioTreeDestroyedError
      );
      expect(() => restorationReader(tree)!.snapshot()).toThrow(
        StudioTreeDestroyedError
      );
    } finally {
      bare.destroy();
      disabled.destroy();
      tree.destroy();
    }
  });

  it.each([false, true])(
    'records only actual transaction relations (transactions first=%s)',
    async (first) => {
      const tree = signalTree(
        { n: 0, m: 0 },
        {
          enhancers: first
            ? [transactions(), restoration()]
            : [restoration(), transactions()],
        }
      );
      try {
        const reader = restorationReader(tree)!;
        undoable(() => tree.$.n(1));
        await flush();
        let transactionId: number | undefined;
        const stop = installTransactionLifecycleChannel(tree).subscribe(
          (event) => {
            if (event.kind === 'opened') transactionId = event.id;
          }
        );
        const pending = tree.transaction(() => undoable(() => tree.$.m(1)));
        const snapshot = reader.snapshot();
        expect(snapshot.entries).toHaveLength(1);
        expect(snapshot.entries[0].transactionIds).toEqual([]);
        pending.confirm();
        expect(reader.snapshot().entries).toHaveLength(2);
        expect(transactionId).toBeTypeOf('number');
        expect(reader.snapshot().entries[1].transactionIds).toEqual([
          transactionId,
        ]);
        stop();
        expect(reader.snapshot().entries[0].entryId).toBe(
          snapshot.entries[0].entryId
        );
      } finally {
        tree.destroy();
      }
    }
  );

  it('keeps stable IDs through eviction and never reuses them after reset', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 2 })] }
    );
    try {
      const reader = restorationReader(tree)!;
      undoable(() => tree.$.n(1));
      await flush();
      undoable(() => tree.$.n(2));
      await flush();
      const before = reader.snapshot();
      undoable(() => tree.$.n(3));
      await flush();
      expect(reader.snapshot().entries[0].entryId).toBe(
        before.entries[1].entryId
      );
      const previousIds = [...before.entries, ...reader.snapshot().entries].map(
        (entry) => entry.entryId
      );
      tree.resetRestorationHistory();
      undoable(() => tree.$.n(4));
      await flush();
      expect(previousIds).not.toContain(reader.snapshot().entries[0].entryId);
    } finally {
      tree.destroy();
    }
  });

  it('reports undo/redo/jump outcomes and actual affected entries without values', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      const reader = restorationReader(tree)!;
      undoable(() => tree.$.n(1));
      await flush();
      undoable(() => tree.$.n(2));
      await flush();
      const ids = reader.snapshot().entries.map((entry) => entry.entryId);
      const events: ReturnType<typeof reader.snapshot>[] = [];
      const operations: unknown[] = [];
      const release = reader.subscribe((event, snapshot) => {
        if (event.kind === 'operation') {
          operations.push(event);
          events.push(snapshot);
        }
      });
      tree.undo();
      tree.redo();
      tree.jumpTo(0);
      const pending = tree.transaction(() => tree.$.n(99));
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(operations).toMatchObject([
        { operation: 'undo', outcome: 'applied', affectedEntryIds: [ids[1]] },
        { operation: 'redo', outcome: 'applied', affectedEntryIds: [ids[1]] },
        { operation: 'jump', outcome: 'applied', affectedEntryIds: [ids[1]] },
        { operation: 'undo', outcome: 'refused', affectedEntryIds: [] },
      ]);
      expect(
        new Set(
          operations.map(
            (event) => (event as { operationId: string }).operationId
          )
        ).size
      ).toBe(4);
      expect(events[2].currentIndex).toBe(0);
      expect(JSON.stringify(operations)).not.toMatch(
        /before|after|value|payload|exception/
      );
      release();
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('delivers reentrant operations FIFO with emission-time snapshots and audiences', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      undoable(() => tree.$.n(1));
      await flush();
      const reader = restorationReader(tree)!;
      const first: string[] = [],
        second: string[] = [],
        late: string[] = [];
      const snapshots: boolean[] = [];
      reader.subscribe((event) => {
        if (event.kind !== 'operation') return;
        first.push(event.operation);
        if (event.operation === 'undo') {
          tree.redo();
          reader.subscribe((next) => {
            if (next.kind === 'operation') late.push(next.operation);
          });
        }
      });
      reader.subscribe((event, snapshot) => {
        if (event.kind === 'operation') {
          second.push(event.operation);
          snapshots.push(snapshot.canRedo);
        }
      });
      tree.undo();
      expect(first).toEqual(['undo', 'redo']);
      expect(second).toEqual(['undo', 'redo']);
      expect(snapshots).toEqual([true, false]);
      expect(late).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it('isolates listener failures and snapshot mutation, and clears queued delivery at destroy', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    try {
      undoable(() => tree.$.n(1));
      await flush();
      const reader = restorationReader(tree)!;
      reader.subscribe(() => {
        throw new Error('observer');
      });
      let delivered = 0;
      reader.subscribe((event, snapshot) => {
        if (event.kind !== 'operation') return;
        try {
          (snapshot.entries as unknown[]).splice(0);
        } catch {
          /* frozen is also detached */
        }
        if (event.operation === 'undo') {
          tree.redo();
          tree.destroy();
        }
      });
      reader.subscribe(() => {
        delivered++;
      });
      expect(() => tree.undo()).not.toThrow();
      expect(delivered).toBe(0);
      expect(() => reader.snapshot()).toThrow(StudioTreeDestroyedError);
      expect(() => reader.subscribe(() => undefined)).toThrow(
        StudioTreeDestroyedError
      );
      tree.destroy();
    } finally {
      tree.destroy();
    }
  });

  it('scopes local entry and operation IDs to their tree', async () => {
    const trees = [0, 1].map(() =>
      signalTree({ n: 0 }, { enhancers: [restoration()] })
    );
    try {
      for (const tree of trees) {
        undoable(() => tree.$.n(1));
        await flush();
      }
      const snapshots = trees.map((tree) =>
        restorationReader(tree)!.snapshot()
      );
      expect(snapshots[0].treeId).not.toBe(snapshots[1].treeId);
      expect(snapshots[0].entries[0].entryId).toBe(
        snapshots[1].entries[0].entryId
      );
    } finally {
      for (const tree of trees) tree.destroy();
    }
  });
});
