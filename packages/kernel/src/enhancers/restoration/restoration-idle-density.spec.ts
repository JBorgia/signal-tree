import { describe, expect, it, vi } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { getTreeRealizationDescriptors } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

type Row = { id: number; value: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = (maxHistorySize: number) =>
  signalTree(
    {
      counter: 0,
      rows: entityMap<Row, number>({ selectId: (row) => row.id }),
    },
    {
      enhancers: [restoration({ maxHistorySize })],
      capabilities: ['causal-runtime'],
    }
  );

const descriptorInventory = (
  tree: Parameters<typeof getTreeRealizationDescriptors>[0]
) => {
  const descriptors = getTreeRealizationDescriptors(tree) ?? new Map();
  let subjects = 0;
  let structuralEffects = 0;
  for (const descriptor of descriptors.values()) {
    subjects += descriptor.subjectDescriptors?.size ?? 0;
    structuralEffects += descriptor.structuralEffects?.size ?? 0;
    structuralEffects += descriptor.structuralEffectBySubject?.size ?? 0;
  }
  return { owners: descriptors.size, subjects, structuralEffects };
};

const claimInventory = (
  tree: Parameters<typeof getSubjectRestorationClaims>[0]
) =>
  getSubjectRestorationClaims(tree)?.snapshot() ?? {
    owners: 0,
    claimedSubjects: 0,
  };

describe('RESTORATION-IDLE-DENSITY-0', () => {
  it('retains no restoration history or subject representation for settled undesignated population', async () => {
    const tree = makeTree(20);
    tree.$.rows.setAll(
      Array.from({ length: 100 }, (_, id) => ({ id, value: id }))
    );
    await flush();

    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({
      owners: 0,
      claimedSubjects: 0,
    });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('captures the pre-turn truth when the first designated entity turn arrives', async () => {
    const tree = makeTree(20);
    tree.$.rows.setAll([{ id: 1, value: 1 }]);
    await flush();

    undoable(() => tree.$.rows.updateOne(1, { value: 2 }));
    await flush();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(2);
    expect(tree.canUndo()).toBe(true);

    tree.undo();
    await flush();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(1);
  });

  it('promotes earlier writes in the same settled turn when a later write is designated', async () => {
    const tree = makeTree(20);
    tree.$.rows.setAll([
      { id: 1, value: 1 },
      { id: 2, value: 2 },
    ]);
    await flush();

    tree.$.rows.updateOne(1, { value: 10 });
    undoable(() => tree.$.rows.updateOne(2, { value: 20 }));
    await flush();

    tree.undo();
    await flush();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(1);
    expect(tree.$.rows.byIdOrFail(2).value()).toBe(2);
  });

  it('retains no descriptor or history for a designated net-zero structural turn', async () => {
    const tree = makeTree(20);

    undoable(() => {
      tree.$.rows.addOne({ id: 1, value: 1 });
      tree.$.rows.removeOne(1);
    });
    await flush();

    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('retains no descriptor or history for a rolled-back designated transaction', async () => {
    const tree = signalTree(
      {
        counter: 0,
        rows: entityMap<Row, number>({ selectId: (row) => row.id }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 }), transactions()],
        capabilities: ['causal-runtime'],
      }
    );
    const pending = undoable(() =>
      tree.transaction(() => tree.$.rows.addOne({ id: 1, value: 1 }))
    );
    pending.rollback();
    await flush();

    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('retains no descriptor or history when a designated transaction confirms a net-zero turn', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
      {
        enhancers: [restoration({ maxHistorySize: 20 }), transactions()],
        capabilities: ['causal-runtime'],
      }
    );
    const pending = undoable(() =>
      tree.transaction(() => {
        tree.$.rows.addOne({ id: 1, value: 1 });
        tree.$.rows.removeOne(1);
      })
    );
    pending.confirm();
    await flush();

    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('retains nothing when history resets after staging but before confirmation', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
      {
        enhancers: [restoration({ maxHistorySize: 20 }), transactions()],
        capabilities: ['causal-runtime'],
      }
    );
    const pending = undoable(() =>
      tree.transaction(() => tree.$.rows.addOne({ id: 1, value: 1 }))
    );
    tree.resetRestorationHistory();
    pending.confirm();
    await flush();

    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('clears staged descriptor ownership when destroyed before transaction confirmation', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
      {
        enhancers: [restoration({ maxHistorySize: 20 }), transactions()],
        capabilities: ['causal-runtime'],
      }
    );
    const pending = undoable(() =>
      tree.transaction(() => tree.$.rows.addOne({ id: 1, value: 1 }))
    );

    tree.destroy();
    pending.confirm();

    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });
  });

  it('releases foreign restoration capture when a transaction callback throws', async () => {
    const tree = signalTree(
      {
        counter: 0,
        rows: entityMap<Row, number>({ selectId: (row) => row.id }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 }), transactions()],
        capabilities: ['causal-runtime'],
      }
    );

    expect(() =>
      tree.transaction(() => {
        tree.$.rows.addOne({ id: 1, value: 1 });
        throw new Error('abort');
      })
    ).toThrow('abort');
    await flush();

    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.getRestorationHistory()).toEqual([]);
    expect(claimInventory(tree)).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });

    undoable(() => tree.$.counter.set(1));
    await flush();
    expect(tree.getRestorationHistory()).toHaveLength(1);
    tree.undo();
    expect(tree.$.counter()).toBe(0);
  });
});

describe('ZERO-HISTORY-RETENTION-0', () => {
  it('retains no completed entries, claims, or reversal descriptors at capacity zero', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tree = makeTree(0);
    tree.$.rows.setAll([{ id: 1, value: 1 }]);
    await flush();

    undoable(() => tree.$.rows.updateOne(1, { value: 2 }));
    await flush();

    expect(error).not.toHaveBeenCalled();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(2);
    expect(tree.getRestorationHistory()).toEqual([]);
    expect(tree.canUndo()).toBe(false);
    expect(tree.canRedo()).toBe(false);
    expect(tree.getCurrentIndex()).toBe(-1);
    expect(claimInventory(tree)).toEqual({
      owners: 0,
      claimedSubjects: 0,
    });
    expect(descriptorInventory(tree)).toEqual({
      owners: 0,
      subjects: 0,
      structuralEffects: 0,
    });

    error.mockRestore();
  });

  it('retains exactly one completed turn and supports one undo/redo at capacity one', async () => {
    const tree = makeTree(1);
    undoable(() => tree.$.counter.set(1));
    await flush();

    expect(tree.getRestorationHistory()).toHaveLength(1);
    expect(tree.getCurrentIndex()).toBe(0);
    expect(tree.canUndo()).toBe(true);

    tree.undo();
    expect(tree.$.counter()).toBe(0);
    expect(tree.canUndo()).toBe(false);
    expect(tree.canRedo()).toBe(true);

    tree.redo();
    expect(tree.$.counter()).toBe(1);
    expect(tree.canUndo()).toBe(true);
    expect(tree.canRedo()).toBe(false);
  });
});
