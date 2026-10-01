import { afterEach, describe, expect, it, vi } from 'vitest';

import { deferOperationConsequence } from '../../lib/internals/commit-consequence';
import { getActiveWriteContext } from '../../lib/write-context';
import { observeWrites } from '../../internals';
import { getTreeRealizationDescriptors } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { peekInternalTransactionRuntime, transactions } from './transactions';

type Row = { id: number; value: number; other?: number };
type Order = 'transactions-first' | 'restoration-first';
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
});

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

const make = (order?: Order, retain = 0) => {
  const tx = transactions({ history: { retain } });
  const history = restoration({ maxHistorySize: 20 });
  const tree = signalTree(
    { rows: entityMap<Row, number>({ selectId: (row) => row.id }), counter: 0 },
    {
      enhancers:
        order === undefined
          ? [tx]
          : order === 'transactions-first'
          ? [tx, history]
          : [history, tx],
    }
  );
  cleanups.push(() => tree.destroy());
  return tree;
};

const descriptorsOf = (tree: ReturnType<typeof make>) => {
  const descriptors = getTreeRealizationDescriptors(tree);
  if (!descriptors) throw new Error('Missing realization descriptor store');
  return descriptors;
};

const inventory = (tree: ReturnType<typeof make>) => {
  const descriptors = descriptorsOf(tree);
  let subjects = 0;
  let structuralEffects = 0;
  let structuralEffectBySubject = 0;
  for (const descriptor of descriptors.values()) {
    subjects += descriptor.subjectDescriptors?.size ?? 0;
    structuralEffects += descriptor.structuralEffects?.size ?? 0;
    structuralEffectBySubject +=
      descriptor.structuralEffectBySubject?.size ?? 0;
  }
  return {
    owners: descriptors.size,
    subjects,
    structuralEffects,
    structuralEffectBySubject,
  };
};

const subjectOf = (tree: ReturnType<typeof make>, id: number): number => {
  const rows = tree.$.rows as unknown as {
    __acquireEntityHandleForTesting(id: number): { subjectId: number };
  };
  return rows.__acquireEntityHandleForTesting(id).subjectId;
};

const hasDescriptor = (tree: ReturnType<typeof make>, subject: number) =>
  [...descriptorsOf(tree).values()].some((descriptor) =>
    descriptor.subjectDescriptors?.has(String(subject))
  );

const churn = async (
  tree: ReturnType<typeof make>,
  start: number,
  count: number
) => {
  for (let id = start; id < start + count; id++) {
    tree.$.rows.addOne({ id, value: id });
    await flush();
    tree.$.rows.removeOne(id);
    await flush();
  }
};

describe('transaction descriptor retention follows reversal responsibility', () => {
  it.each([
    ['ordinary', 1],
    ['confirmed', 1],
    ['ordinary', 2],
    ['confirmed', 2],
  ] as const)(
    'protects open capture during a reentrant %s write to row %i',
    async (kind, observerRow) => {
      const tree = make(undefined, 10);
      tree.$.rows.setAll([
        { id: 1, value: 10, other: 0 },
        { id: 2, value: 20, other: 0 },
      ]);
      await flush();
      const subject = subjectOf(tree, 1);
      const unrelated = subjectOf(tree, 2);
      let armed = true;
      cleanups.push(
        observeWrites((frame) => {
          if (!armed || frame.path !== 'rows.1') return;
          armed = false;
          const write = () => tree.$.rows.updateOne(observerRow, { other: 30 });
          if (kind === 'confirmed') tree.transaction(write).confirm();
          else write();
        })
      );
      const pending = tree.transaction(() =>
        tree.$.rows.updateOne(1, { value: 11 })
      );
      expect(armed).toBe(false);
      const retainedDuringPending = hasDescriptor(tree, subject);
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, unrelated)).toBe(false);
      pending.rollback();
      await flush();
      expect(tree.$.rows.byIdOrFail(1).value()).toBe(10);
      expect(tree.$.rows.byIdOrFail(observerRow)().other).toBe(30);
      // Diagnostic records are still retained, but none grants reversal rights.
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnCount()
      ).toBeGreaterThan(0);
      expect(inventory(tree).subjects).toBe(0);
      expect(retainedDuringPending).toBe(true);
    }
  );

  it.each([0, 5])(
    'ordinary churn releases inner entries with diagnostic retention %i',
    async (retain) => {
      const tree = make(undefined, retain);
      await churn(tree, 1, 8);
      const early = inventory(tree);
      await churn(tree, 9, 32);
      const late = inventory(tree);
      const empty = {
        owners: 1,
        subjects: 0,
        structuralEffects: 0,
        structuralEffectBySubject: 0,
      };
      expect({ early, late }).toEqual({ early: empty, late: empty });
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnCount()
      ).toBe(retain);
    }
  );

  it('releases live, unclaimed addresses and recaptures them for a later pending rollback', async () => {
    const tree = make();
    tree.$.rows.addOne({ id: 1, value: 10 });
    await flush();
    const subject = subjectOf(tree, 1);
    const unclaimedDescriptor = hasDescriptor(tree, subject);
    const pending = tree.transaction(() => tree.$.rows.removeOne(1));
    expect(hasDescriptor(tree, subject)).toBe(true);
    expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
    pending.rollback();
    await flush();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(10);
    expect(subjectOf(tree, 1)).toBe(subject);
    expect(hasDescriptor(tree, subject)).toBe(false);
    expect(unclaimedDescriptor).toBe(false);
  });

  it.each(['confirm', 'rollback'] as const)(
    'keeps pending addresses through ordinary churn until %s',
    async (settle) => {
      const tree = make();
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const subject = subjectOf(tree, 1);
      const pending = tree.transaction(() => tree.$.rows.removeOne(1));
      await flush();
      await churn(tree, 2, 20);
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, subject)).toBe(true);
      // Later confirmed records classify dependencies; they do not resolve
      // reversal addresses. Their continued retention must not pin churn rows.
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnCount()
      ).toBe(40);
      const pendingSubjects = inventory(tree).subjects;
      pending[settle]();
      await flush();
      expect(tree.$.rows.ids()).toEqual(settle === 'rollback' ? [1] : []);
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(false);
      expect(hasDescriptor(tree, subject)).toBe(false);
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnCount()
      ).toBe(0);
      expect(pendingSubjects).toBe(1);
    }
  );

  it('distinguishes descriptor release from physical subject reclamation', async () => {
    const tree = make();
    const rows = tree.$.rows as unknown as {
      __listSubjectReclamationCandidates(): readonly number[];
      __inspectSubjectResources(subject: number): {
        retainedSubjectState: boolean;
        retainedValueBacking: unknown;
      };
    };
    tree.$.rows.addOne({ id: 1, value: 10 });
    await flush();
    const subject = subjectOf(tree, 1);
    tree.$.rows.removeOne(1);
    await flush();
    // This slice does not drive the physical sink. Keep the distinction
    // executable instead of interpreting an empty descriptor map as flat heap.
    expect(rows.__listSubjectReclamationCandidates()).toContain(subject);
    expect(rows.__inspectSubjectResources(subject).retainedSubjectState).toBe(
      true
    );
    expect(
      rows.__inspectSubjectResources(subject).retainedValueBacking
    ).toBeTruthy();
    expect(hasDescriptor(tree, subject)).toBe(false);
  });

  it('drops same-flush net-zero structural capture without dropping the position shell', async () => {
    const tree = make();
    for (let id = 0; id < 40; id++) {
      tree.$.rows.addOne({ id, value: id });
      tree.$.rows.removeOne(id);
      await flush();
    }
    expect(inventory(tree)).toEqual({
      owners: 1,
      subjects: 0,
      structuralEffects: 0,
      structuralEffectBySubject: 0,
    });
  });

  it('preserves a pending subject when an ordinary write captures that same subject', async () => {
    const tree = make();
    tree.$.rows.addOne({ id: 1, value: 10 });
    await flush();
    const subject = subjectOf(tree, 1);
    const pending = tree.transaction(() =>
      tree.$.rows.updateOne(1, { value: 20 })
    );
    tree.$.rows.updateOne(1, { value: 30 });
    await flush();
    expect(hasDescriptor(tree, subject)).toBe(true);
    expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
    expect(() => pending.rollback()).toThrow(/later-confirmed-dependency/);
    expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
    expect(hasDescriptor(tree, subject)).toBe(true);
    pending.confirm();
    await flush();
    expect(tree.$.rows.byIdOrFail(1).value()).toBe(30);
    expect(hasDescriptor(tree, subject)).toBe(false);
  });
});

describe.each(['transactions-first', 'restoration-first'] as const)(
  'restoration handoff: %s',
  (order) => {
    it('characterizes actual flush listener order and claim admission', async () => {
      const notifier = getPathNotifier();
      const register = notifier.onFlush.bind(notifier);
      let nextListener = 0;
      let inspect: (() => boolean) | undefined;
      const trace: { listener: number; before: boolean; after: boolean }[] = [];
      const spy = vi
        .spyOn(notifier, 'onFlush')
        .mockImplementation((callback) => {
          const listener = nextListener++;
          return register(() => {
            const before = inspect?.();
            callback();
            if (before !== undefined)
              trace.push({ listener, before, after: inspect?.() ?? false });
          });
        });
      const tree = make(order);
      spy.mockRestore();
      expect(nextListener).toBe(2);
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const subject = subjectOf(tree, 1);
      inspect = () =>
        getSubjectRestorationClaims(tree)?.isClaimed(subject) ?? false;
      undoable(() => tree.$.rows.removeOne(1));
      await flush();
      expect(trace).toEqual(
        order === 'transactions-first'
          ? [
              { listener: 0, before: false, after: false },
              { listener: 1, before: false, after: true },
            ]
          : [
              { listener: 0, before: false, after: true },
              { listener: 1, before: true, after: true },
            ]
      );
      expect(hasDescriptor(tree, subject)).toBe(true);
      inspect = undefined;
    });

    it('admits a previously unclaimed removal at flush and notifies undo/redo', async () => {
      const notifier = getPathNotifier();
      const tree = make(order);
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const subject = subjectOf(tree, 1);
      expect(
        getSubjectRestorationClaims(tree)?.isClaimed(subject) ?? false
      ).toBe(false);
      undoable(() => tree.$.rows.removeOne(1));
      expect(
        getSubjectRestorationClaims(tree)?.isClaimed(subject) ?? false
      ).toBe(false);
      await flush();
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, subject)).toBe(true);
      expect(tree.getRestorationHistory()).toHaveLength(1);
      const notified = vi.fn();
      cleanups.push(notifier.subscribe('**', notified));
      tree.undo();
      await flush();
      expect(tree.$.rows.byIdOrFail(1).value()).toBe(10);
      expect(subjectOf(tree, 1)).toBe(subject);
      expect(notified).toHaveBeenCalled();
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, subject)).toBe(true);
      notified.mockClear();
      tree.redo();
      await flush();
      expect(tree.$.rows.ids()).toEqual([]);
      expect(notified).toHaveBeenCalled();
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      tree.resetRestorationHistory();
      expect(hasDescriptor(tree, subject)).toBe(false);
    });

    it('keeps redo-owned subject addresses through unrelated ordinary churn', async () => {
      const tree = make(order);
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const subject = subjectOf(tree, 1);
      undoable(() => tree.$.rows.updateOne(1, { value: 20 }));
      await flush();
      tree.undo();
      await flush();
      await churn(tree, 2, 8);
      expect(tree.canRedo()).toBe(true);
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, subject)).toBe(true);
      const redoSubjects = inventory(tree).subjects;
      tree.redo();
      await flush();
      expect(tree.$.rows.byIdOrFail(1).value()).toBe(20);
      expect(tree.$.rows.ids()).toEqual([1]);
      expect(redoSubjects).toBe(1);
    });

    it('hands an immediately confirmed pending removal to restoration', async () => {
      const tree = make(order);
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const subject = subjectOf(tree, 1);
      const pending = undoable(() =>
        tree.transaction(() => tree.$.rows.removeOne(1))
      );
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      pending.confirm();
      await flush();
      expect(getSubjectRestorationClaims(tree)?.isClaimed(subject)).toBe(true);
      expect(hasDescriptor(tree, subject)).toBe(true);
      tree.undo();
      await flush();
      expect(tree.$.rows.byIdOrFail(1).value()).toBe(10);
      tree.redo();
      await flush();
      expect(tree.$.rows.ids()).toEqual([]);
    });
  }
);

it('releases unclaimed descriptors when a confirmed consequence throws', async () => {
  const tree = make();
  tree.$.rows.addOne({ id: 1, value: 0 });
  await flush();
  const pending = tree.transaction(() => {
    tree.$.rows.removeOne(1);
    const context = getActiveWriteContext()!;
    deferOperationConsequence(
      context.transactionOwner!,
      context.transactionId!,
      'failure',
      () => {
        throw new Error('consequence failure');
      }
    );
  });
  expect(inventory(tree).subjects).toBeGreaterThan(0);
  expect(() => pending.confirm()).toThrow('consequence failure');
  expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(0);
  expect(inventory(tree).subjects).toBe(0);
});
