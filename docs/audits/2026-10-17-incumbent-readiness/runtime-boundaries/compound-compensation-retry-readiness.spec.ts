import { describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
  type PendingTransaction,
} from '@signal-tree/kernel';

type Row = { id: string; n: number };
const seeded: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
  { id: 'd', n: 4 },
];
const outerInstalled: Row[] = [
  { id: 'w', n: 5 },
  { id: 'c', n: 30 },
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'd', n: 4 },
];
const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

async function scenario(assertRetry: boolean): Promise<void> {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions(), restoration()] }
  );
  try {
    for (const row of seeded) tree.$.rows.addOne({ ...row });
    await flush();
    const heldA = tree.$.rows.byIdOrFail('a');
    const heldD = tree.$.rows.byIdOrFail('d');
    let pending: PendingTransaction | undefined;
    let callbackEntered = false;
    tree.$.rows.tap({
      onAdd() {
        if (callbackEntered) return;
        callbackEntered = true;
        // Reentry from delivery, not an unsupported transact-inside-transact.
        pending = tree.transact(() => {
          tree.$.rows.removeOne('a');
          tree.$.rows.removeOne('d');
        });
      },
    });
    undoable(() => {
      tree.$.rows.prependMany(
        [{ id: 'w', n: 5 }, { id: 'c', n: 30 }],
        { mode: 'overwrite' }
      );
    });
    await flush();
    expect(callbackEntered).toBe(true);
    if (!pending) throw new Error('onAdd did not return transaction authority');
    const transaction = pending;
    const speculative = tree.$.rows.all();
    expect(speculative).toStrictEqual(outerInstalled.slice(0, 3));
    const index = tree.getCurrentIndex();
    const inspection = transaction.inspect();
    expect(inspection.changes).toHaveLength(2);
    expect(inspection.changes.map((change) => change.address)).toStrictEqual([
      ['rows'], ['rows'],
    ]);
    // Entity addresses are collection-relative; subject identifies lifetime.
    expect(inspection.changes.map((change) => change.path)).toStrictEqual(['rows.a', 'rows.d']);
    expect(new Set(inspection.changes.map((change) => change.subject)).size).toBe(2);
    expect(inspection.changes.every((change) => typeof change.subject === 'number')).toBe(true);
    expect(inspection.changes.every((change) => change.status === 'current')).toBe(true);
    expect(() => tree.undo()).toThrow(/ST1034: restoration refused.*overlapping transaction is pending/);
    expect(tree.getCurrentIndex()).toBe(index);
    expect(tree.$.rows.all()).toStrictEqual(speculative);
    expect(transaction.inspect()).toStrictEqual(inspection);

    expect(() => transaction.rollback()).not.toThrow();
    await flush();
    expect(tree.$.rows.all()).toStrictEqual(outerInstalled);
    expect(tree.$.rows.byIdOrFail('a')).toBe(heldA);
    expect(tree.$.rows.byIdOrFail('d')).toBe(heldD);
    // Settled public inspection is the retained pre-settlement inspection;
    // it is not a pending-count API. Repeated rollback performs no work;
    // opposite settlement preserves the existing terminal-state refusal.
    const settledInspection = transaction.inspect();
    expect(settledInspection).toStrictEqual(inspection);
    expect(() => transaction.rollback()).not.toThrow();
    expect(() => transaction.confirm()).toThrow('Cannot confirm a rolled back transaction');
    expect(transaction.inspect()).toStrictEqual(settledInspection);
    expect(tree.$.rows.all()).toStrictEqual(outerInstalled);
    expect(tree.getCurrentIndex()).toBe(index);

    if (assertRetry) {
      // Unchanged desired behavior: successful compensation must allow retry
      // of the original designated turn once its pending blocker is gone.
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(seeded);
      expect(tree.$.rows.byIdOrFail('a')).toBe(heldA);
      expect(tree.$.rows.byIdOrFail('d')).toBe(heldD);
      expect(tree.getCurrentIndex()).toBe(index - 1);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(outerInstalled);
      expect(tree.getCurrentIndex()).toBe(index);
    }
  } finally {
    tree.destroy();
  }
}

describe('compound compensation preserves useful restoration retry', () => {
  it('restores both removed lifetimes and terminal transaction behavior', async () => {
    await scenario(false);
  });
  it('allows the refused designated reorder to undo and redo after compensation', async () => {
    await scenario(true);
  });
});
