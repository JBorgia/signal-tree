import { describe, expect, it } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  restoration,
  undoable,
} from '../../index';
import type { EntitySubjectPhysicalInventory } from '../../lib/entity-signal';
import { selectNativeOwnershipTransactions } from '../../lib/internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from './native-ownership-public-experiment';

type Row = { id: string; n: number };
type Inventory = {
  __acquireEntityHandleForTesting(
    key: string
  ): { subjectId: number } | undefined;
  __inspectSubjectResources(
    subject: number
  ): EntitySubjectPhysicalInventory<string> | undefined;
  __listSubjectReclamationCandidates(): readonly number[];
};
const make = () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
    'native-pending'
  );
  return tree;
};
describe('B native lifetime retention obligations', () => {
  it.each([1, 16])(
    'reclaims %i settled speculative lifetimes while held references stay detached',
    (count) => {
      const tree = make();
      const inventory = tree.$.rows as unknown as Inventory;
      try {
        const subjects: number[] = [];
        const held: Array<ReturnType<typeof tree.$.rows.byIdOrFail>> = [];
        for (let i = 0; i < count; i++) {
          const pending = tree.transact(() =>
            tree.$.rows.addOne({ id: 'A', n: i })
          );
          subjects.push(
            inventory.__acquireEntityHandleForTesting('A')!.subjectId
          );
          held.push(tree.$.rows.byIdOrFail('A'));
          pending.rollback();
        }
        expect(tree.$.rows.ids()).toEqual([]);
        expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
        expect(
          subjects.filter(
            (subject) =>
              inventory.__inspectSubjectResources(subject)?.retainedSubjectState
          )
        ).toEqual([]);
        expect(inventory.__listSubjectReclamationCandidates()).toEqual([]);
        tree.$.rows.addOne({ id: 'A', n: 99 });
        expect(held.every((row) => row() === undefined)).toBe(true);
        expect(tree.$.rows.byIdOrFail('A')().n).toBe(99);
      } finally {
        tree.destroy();
      }
    }
  );
  it.each([1, 16])(
    'reclaims %i ordinary retired lifetimes after capture drains',
    async (count) => {
      const tree = make();
      const inventory = tree.$.rows as unknown as Inventory;
      try {
        const subjects: number[] = [];
        for (let i = 0; i < count; i++) {
          tree.$.rows.addOne({ id: 'A', n: i });
          subjects.push(
            inventory.__acquireEntityHandleForTesting('A')!.subjectId
          );
          tree.$.rows.removeOne('A');
        }
        // Native capture must finish before obligation-free reclamation can run.
        // One event-loop turn drains the scheduled capture and maintenance microtasks.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
        expect(
          subjects.filter(
            (subject) =>
              inventory.__inspectSubjectResources(subject)?.retainedSubjectState
          )
        ).toEqual([]);
        expect(inventory.__listSubjectReclamationCandidates()).toEqual([]);
      } finally {
        tree.destroy();
      }
    }
  );
  it('retains a pending removal through failed settlement and reclaims after terminal confirmation', () => {
    const tree = make();
    const inventory = tree.$.rows as unknown as Inventory;
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const subject = inventory.__acquireEntityHandleForTesting('A')!.subjectId;
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      const controls = getNativeOwnershipPublicExperiment(tree)!;
      controls.failPreparation(new Error('retention retry'));
      expect(() => pending.rollback()).toThrow();
      expect(controls.stats().pending).toBe(1);
      expect(
        inventory.__inspectSubjectResources(subject)?.retainedSubjectState
      ).toBe(true);
      expect(
        inventory.__inspectSubjectResources(subject)?.retainedValueBacking
      ).toBeDefined();
      expect(held()).toBeUndefined();
      pending.rollback();
      expect(held()).toEqual({ id: 'A', n: 1 });
      const finalRemoval = tree.transact(() => tree.$.rows.removeOne('A'));
      finalRemoval.confirm();
      expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
      expect(inventory.__inspectSubjectResources(subject)).toBeUndefined();
      expect(held()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });
  it('history eviction cannot reclaim a lifetime still required by B pending removal', async () => {
    const tree = signalTree(
      { marker: 0, rows: entityMap<Row, string>() },
      {
        enhancers: [
          selectNativeOwnershipTransactions(transactions()),
          restoration({ maxHistorySize: 1 }),
        ],
      }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    try {
      undoable(() => tree.$.rows.addOne({ id: 'A', n: 1 }));
      await tick();
      await tick();
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      await tick();
      await tick();
      for (let i = 1; i <= 3; i++) {
        undoable(() => tree.$.marker(i));
        await tick();
        await tick();
      }
      expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(1);
      expect(held()).toBeUndefined();
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
      expect(held()).toEqual({ id: 'A', n: 1 });
    } finally {
      tree.destroy();
    }
  });
});
