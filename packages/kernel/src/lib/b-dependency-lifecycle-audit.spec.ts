import { describe, expect, it } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import type { EntitySubjectPhysicalInventory } from './entity-signal';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';

const row = (id: string) => ({ id, n: 0 });
const make = () => {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>(), marker: 0 },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
    'native-pending'
  );
  tree.$.rows.setAll([row('A'), row('B')]);
  return tree;
};
const controls = (tree: ReturnType<typeof make>) => {
  const value = getNativeOwnershipPublicExperiment(tree);
  if (!value) throw new Error('B authority unavailable');
  return value;
};
const create = (tree: ReturnType<typeof make>) =>
  tree.transact(() => {
    tree.$.marker(1);
    tree.$.rows.addOne(row('C'));
  });
const order = (tree: ReturnType<typeof make>, ...ids: string[]) =>
  tree.transact(() => tree.$.rows.setAll(ids.map(row)));

describe('B dependency lifecycle audit (qualification, not acceptance)', () => {
  it('refuses creator rollback atomically while independent explicit order needs C; rejection releases it', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      const ordering = order(tree, 'C', 'A', 'B');
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(tree.$.rows.byIdOrFail('C')).toBe(held);
      expect(held()).toEqual(row('C'));
      expect(tree.$.marker()).toBe(1);
      expect(controls(tree).stats().pending).toBe(2);
      ordering.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(tree.$.marker()).toBe(0);
      expect(held()).toBeUndefined();
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('releases a rejected order dependency even without first attempting creator rejection', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const ordering = order(tree, 'C', 'A', 'B');
      ordering.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(tree.$.marker()).toBe(0);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('confirmation retains the existence required by independent explicit order', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const ordering = order(tree, 'C', 'A', 'B');
      ordering.confirm();
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(tree.$.marker()).toBe(1);
      expect(controls(tree).stats().pending).toBe(1);
      creator.confirm();
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('failed order settlement preserves dependency and both retryable handles', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const ordering = order(tree, 'C', 'A', 'B');
      controls(tree).failPreparation(new Error('dependency settlement fault'));
      expect(() => ordering.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(controls(tree).stats().pending).toBe(2);
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      ordering.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('superseded pending order reemerges after the newer pending order is rejected', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const older = order(tree, 'C', 'A', 'B');
      const newer = order(tree, 'B', 'C', 'A');
      newer.rollback();
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(controls(tree).stats().pending).toBe(2);
      older.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
    } finally {
      tree.destroy();
    }
  });

  it('pending removal restores the same created lifetime before dependent order rejection', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      const ordering = order(tree, 'C', 'A', 'B');
      const removal = tree.transact(() => tree.$.rows.removeOne('C'));
      expect(held()).toBeUndefined();
      removal.rollback();
      expect(tree.$.rows.byIdOrFail('C')).toBe(held);
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      ordering.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
    } finally {
      tree.destroy();
    }
  });

  it('held references, reads and incidental append anchors do not require created existence', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      expect(tree.$.rows.all()).toEqual(['A', 'B', 'C'].map(row));
      expect(held()).toEqual(row('C'));
      const append = tree.transact(() => tree.$.rows.addOne(row('D')));
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'D']);
      expect(held()).toBeUndefined();
      append.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('ordinary rekey preserves its authored key without converting observed pending order to committed order', () => {
    const tree = make();
    try {
      tree.$.rows.addOne(row('C'));
      const held = tree.$.rows.byIdOrFail('A');
      const ordering = order(tree, 'C', 'A', 'B');
      tree.$.rows.changeId('A', 'A2');
      ordering.rollback();
      expect(tree.$.rows.ids()).toEqual(['A2', 'B', 'C']);
      expect(tree.$.rows.byIdOrFail('A2')).toBe(held);
      expect(held()).toEqual(row('A'));
    } finally {
      tree.destroy();
    }
  });

  it('later actual rekey of a created lifetime either survives creator rejection or causes atomic refusal', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      tree.$.rows.changeId('C', 'C2');
      // The established authority boundary prohibits silently discarding independent
      // authored truth. This probe does not decide preservation versus refusal.
      let refusal: unknown;
      try {
        creator.rollback();
      } catch (error) {
        refusal = error;
      }
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C2']);
      expect(tree.$.rows.byIdOrFail('C2')).toBe(held);
      // Audit hypothesis, not an accepted payload-dependency contract: rekey
      // authors the key, not these unchanged creator-owned fields. Preserve this
      // first failing assertion as an unresolved premise (see dependency-audit).
      expect(held()).toEqual(row('C'));
      if (refusal !== undefined) {
        expect(refusal).toBeInstanceOf(SignalTreeRollbackError);
        expect(tree.$.marker()).toBe(1);
        expect(controls(tree).stats().pending).toBe(1);
        creator.confirm();
      } else {
        expect(tree.$.marker()).toBe(0);
      }
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('ordinary removal and explicit replacement order supersede older order without resurrection', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      const ordering = order(tree, 'C', 'A', 'B');
      tree.$.rows.setAll(['B', 'A'].map(row));
      expect(held()).toBeUndefined();
      ordering.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      expect(held()).toBeUndefined();
      expect(tree.$.marker()).toBe(0);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('same-author order replacement removes its earlier need for C without resurrection', () => {
    const tree = make();
    try {
      const creator = create(tree);
      const held = tree.$.rows.byIdOrFail('C');
      const ordering = tree.transact(() => {
        tree.$.rows.setAll(['C', 'A', 'B'].map(row));
        tree.$.rows.setAll(['B', 'A'].map(row));
      });
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      expect(held()).toBeUndefined();
      ordering.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(held()).toBeUndefined();
      expect(tree.$.marker()).toBe(0);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('reclaims a released created lifetime after capture drains using physical inventory', async () => {
    const tree = make();
    const inventory = tree.$.rows as unknown as {
      __acquireEntityHandleForTesting(
        key: string
      ): { subjectId: number } | undefined;
      __inspectSubjectResources(
        subject: number
      ): EntitySubjectPhysicalInventory<string> | undefined;
      __listSubjectReclamationCandidates(): readonly number[];
    };
    try {
      const creator = create(tree);
      const handle = inventory.__acquireEntityHandleForTesting('C');
      if (!handle) throw new Error('Created C has no entity handle');
      const subject = handle.subjectId;
      expect(
        inventory.__inspectSubjectResources(subject)?.retainedSubjectState
      ).toBe(true);
      const ordering = order(tree, 'C', 'A', 'B');
      ordering.rollback();
      creator.rollback();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
      expect(inventory.__inspectSubjectResources(subject)).toBeUndefined();
      expect(inventory.__listSubjectReclamationCandidates()).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
});
