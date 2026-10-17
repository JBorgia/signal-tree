import { scheduleDurableConsequence } from '../../lib/internals/commit-consequence';
import { getPathNotifier } from '../../lib/path-notifier';
import { entityMembershipReader } from '../../lib/internals/entity-membership-view';
import { describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
  SignalTreeRollbackError,
} from '../../index';
import { observeOwnerInvalidation } from '../../adapter';
import { selectNativeOwnershipTransactions } from '../../lib/internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from './native-ownership-public-experiment';

type Row = { id: string; n: number; other?: number };
const make = () => {
  const tree = signalTree(
    { marker: 0, rows: entityMap<Row, string>() },
    {
      enhancers: [
        selectNativeOwnershipTransactions(transactions()),
        restoration(),
      ],
    }
  );
  expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
    'native-pending'
  );
  return tree;
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('B public entity ownership discriminators', () => {
  it('rejects overlapping field writers usefully and preserves an independent field', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1, other: 10 });
      const first = tree.transact(() => tree.$.rows.updateOne('A', { n: 2 }));
      const second = tree.transact(() => tree.$.rows.updateOne('A', { n: 3 }));
      tree.$.rows.updateOne('A', { other: 20 });
      first.rollback();
      expect(tree.$.rows.byIdOrFail('A')()).toEqual({
        id: 'A',
        n: 3,
        other: 20,
      });
      second.rollback();
      expect(tree.$.rows.byIdOrFail('A')()).toEqual({
        id: 'A',
        n: 1,
        other: 20,
      });
      second.rollback();
      expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
        pending: 0,
        ledgers: 0,
      });
    } finally {
      tree.destroy();
    }
  });

  it('settles an ordinary addition usefully', () => {
    const tree = make();
    try {
      const pending = tree.transact(() =>
        tree.$.rows.addOne({ id: 'A', n: 1 })
      );
      const held = tree.$.rows.byIdOrFail('A');
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual([]);
      expect(held()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });

  it('preserves later dependent truth or refuses the entire creation settlement', () => {
    const tree = make();
    try {
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.addOne({ id: 'A', n: 1 });
      });
      tree.$.rows.updateOne('A', { n: 9 });
      let refused = false;
      try {
        pending.rollback();
      } catch {
        refused = true;
      }
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(9);
      expect(tree.$.marker()).toBe(refused ? 1 : 0);
      expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(
        refused ? 1 : 0
      );
      if (refused) {
        pending.confirm();
        expect(tree.$.rows.byIdOrFail('A')().n).toBe(9);
      }
    } finally {
      tree.destroy();
    }
  });

  it('does not retarget held retired references after same-key replacement', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      tree.$.rows.addOne({ id: 'A', n: 9 });
      let refused = false;
      try {
        pending.rollback();
      } catch {
        refused = true;
      }
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(9);
      expect(held()).toBeUndefined();
      expect(() => held({ id: 'A', n: 100 })).toThrow();
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(9);
      if (refused) pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('rolls back rekey while retaining the same held lifetime', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => tree.$.rows.changeId('A', 'Z'));
      expect(tree.$.rows.byIdOrFail('Z')).toBe(held);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A']);
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
    } finally {
      tree.destroy();
    }
  });

  it('installs prepend order before callback writes and rolls both additions back', () => {
    const tree = make();
    let off = () => {
      /* No subscription exists until setup succeeds. */
    };
    try {
      tree.$.rows.addMany([
        { id: 'A', n: 1 },
        { id: 'B', n: 2 },
      ]);
      const observed: string[][] = [];
      off = tree.$.rows.tap({
        onAdd: (_row, id) => {
          if (id === 'C') {
            observed.push([...tree.$.rows.ids()]);
            tree.$.rows.prependOne({ id: 'D', n: 4 });
          }
        },
      });
      const pending = tree.transact(() =>
        tree.$.rows.prependOne({ id: 'C', n: 3 })
      );
      expect(observed).toEqual([['C', 'A', 'B']]);
      expect(tree.$.rows.ids()).toEqual(['D', 'C', 'A', 'B']);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('uses current entity truth after restoration undo', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      await flush();
      undoable(() => tree.$.rows.updateOne('A', { n: 2 }));
      await flush();
      tree.undo();
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(1);
      const pending = tree.transact(() => tree.$.rows.updateOne('A', { n: 3 }));
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('distinguishes omitted fields from present undefined during row replacement', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1, other: undefined });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => held({ id: 'A', n: 2 }));
      expect(Object.prototype.hasOwnProperty.call(held(), 'other')).toBe(false);
      pending.rollback();
      expect(held()).toEqual({ id: 'A', n: 1, other: undefined });
      expect(Object.prototype.hasOwnProperty.call(held(), 'other')).toBe(true);
    } finally {
      tree.destroy();
    }
  });

  it('delivers coherent mixed scalar/entity rollback to an active owner observer', async () => {
    const tree = make();
    let off = () => {
      /* No subscription exists until setup succeeds. */
    };
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      await flush();
      const seen: number[][] = [];
      off = observeOwnerInvalidation(tree, () =>
        seen.push([
          tree.$.marker(),
          tree.$.rows.byIdOrFail('A')().n,
          tree.$.rows.all()[0].n,
        ])
      );
      const pending = tree.transact(() => {
        tree.$.marker(2);
        tree.$.rows.updateOne('A', { n: 3 });
      });
      await flush();
      expect(seen).toContainEqual([2, 3, 3]);
      seen.length = 0;
      pending.rollback();
      await flush();
      expect(seen).toContainEqual([0, 1, 1]);
      expect(seen.every((value) => value.join(',') === '0,1,1')).toBe(true);
    } finally {
      off();
      tree.destroy();
    }
  });
  it('restores a removed middle lifetime at its original position', () => {
    const tree = make();
    try {
      tree.$.rows.addMany([
        { id: 'A', n: 1 },
        { id: 'B', n: 2 },
        { id: 'C', n: 3 },
      ]);
      const held = tree.$.rows.byIdOrFail('B');
      const pending = tree.transact(() => tree.$.rows.removeOne('B'));
      expect(held()).toBeUndefined();
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      expect(tree.$.rows.byIdOrFail('B')).toBe(held);
      expect(held().n).toBe(2);
    } finally {
      tree.destroy();
    }
  });

  it('restores adjacent removed lifetimes with their placement dependencies', () => {
    const tree = make();
    try {
      tree.$.rows.addMany([
        { id: 'A', n: 1 },
        { id: 'B', n: 2 },
        { id: 'C', n: 3 },
        { id: 'D', n: 4 },
      ]);
      const pending = tree.transact(() => tree.$.rows.removeMany(['B', 'C']));
      expect(tree.$.rows.ids()).toEqual(['A', 'D']);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C', 'D']);
    } finally {
      tree.destroy();
    }
  });

  it('reverses an existing-lifetime exact order change', () => {
    const tree = make();
    try {
      const rows = [
        { id: 'A', n: 1 },
        { id: 'B', n: 2 },
        { id: 'C', n: 3 },
      ];
      tree.$.rows.addMany(rows);
      const held = tree.$.rows.byIdOrFail('B');
      const pending = tree.transact(() =>
        tree.$.rows.setAll([rows[2], rows[0], rows[1]])
      );
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      expect(tree.$.rows.byIdOrFail('B')).toBe(held);
    } finally {
      tree.destroy();
    }
  });

  it('settles overlapping object-valued fields and preserves newer whole-field truth', () => {
    const tree = signalTree(
      {
        rows: entityMap<
          { id: string; detail: { a: number; b: number } },
          string
        >(),
      },
      {
        enhancers: [
          selectNativeOwnershipTransactions(transactions()),
          restoration(),
        ],
      }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    try {
      tree.$.rows.addOne({ id: 'A', detail: { a: 1, b: 10 } });
      const held = tree.$.rows.byIdOrFail('A');
      const first = tree.transact(() => held.detail({ a: 2, b: 10 }));
      const second = tree.transact(() => held.detail({ a: 3, b: 10 }));
      first.rollback();
      expect(held().detail).toEqual({ a: 3, b: 10 });
      second.rollback();
      expect(held().detail).toEqual({ a: 1, b: 10 });
      const third = tree.transact(() => held.detail({ a: 2, b: 10 }));
      held.detail({ a: 3, b: 20 });
      third.rollback();
      expect(held().detail).toEqual({ a: 3, b: 20 });
    } finally {
      tree.destroy();
    }
  });

  it('preparation refusal installs no entity and failed settlement stays retryable', () => {
    const tree = make();
    const fault = Object.freeze(new Error('entity preparation fault'));
    try {
      const controls = getNativeOwnershipPublicExperiment(tree)!;
      controls.failPreparation(fault);
      let thrown: unknown;
      try {
        tree.transact(() => tree.$.rows.addOne({ id: 'A', n: 1 }));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(fault);
      expect(tree.$.rows.ids()).toEqual([]);
      const pending = tree.transact(() =>
        tree.$.rows.addOne({ id: 'A', n: 1 })
      );
      controls.failPreparation(fault);
      let failure: unknown;
      try {
        pending.rollback();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(SignalTreeRollbackError);
      expect(failure).toHaveProperty('cause', fault);
      expect(tree.$.rows.ids()).toEqual(['A']);
      expect(controls.stats().pending).toBe(1);
      pending.rollback();
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual([]);
      expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('preserves selected key and restores active entity with the same lifetime', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      tree.$.rows.setActiveId('A');
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      expect(tree.$.rows.activeId()).toBe('A');
      expect(tree.$.rows.activeEntity()).toBeUndefined();
      pending.rollback();
      expect(tree.$.rows.activeId()).toBe('A');
      expect(tree.$.rows.activeEntity()).toEqual({ id: 'A', n: 1 });
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
    } finally {
      tree.destroy();
    }
  });

  it.each(['creator-first', 'dependent-first'] as const)(
    'settles created-lifetime dependencies in %s rejection order',
    (order) => {
      const tree = make();
      try {
        const creator = tree.transact(() =>
          tree.$.rows.addOne({ id: 'A', n: 1 })
        );
        const dependent = tree.transact(() =>
          tree.$.rows.updateOne('A', { n: 2 })
        );
        if (order === 'creator-first') {
          let refused = false;
          try {
            creator.rollback();
          } catch {
            refused = true;
          }
          expect(tree.$.rows.byIdOrFail('A')().n).toBe(2);
          dependent.rollback();
          if (refused) creator.rollback();
        } else {
          dependent.rollback();
          expect(tree.$.rows.byIdOrFail('A')().n).toBe(1);
          creator.rollback();
        }
        expect(tree.$.rows.ids()).toEqual([]);
        expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
      } finally {
        tree.destroy();
      }
    }
  );

  it('settlement callback sees the complete mixed unit and its newer scalar write survives', () => {
    const tree = make();
    let off = () => {
      /* No subscription exists until setup succeeds. */
    };
    try {
      const pending = tree.transact(() => {
        tree.$.marker(2);
        tree.$.rows.addOne({ id: 'A', n: 1 });
      });
      const seen: unknown[] = [];
      off = tree.$.rows.tap({
        onRemove: () => {
          seen.push([
            tree.$.marker(),
            [...tree.$.rows.ids()],
            getNativeOwnershipPublicExperiment(tree)?.stats().pending,
          ]);
          tree.$.marker(9);
        },
      });
      pending.rollback();
      expect(seen).toEqual([[0, [], 0]]);
      expect(tree.$.marker()).toBe(9);
      pending.rollback();
      expect(tree.$.marker()).toBe(9);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('inspection keeps authored field address and subject across rekey and same-key reuse', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const first = tree.transact(() => tree.$.rows.updateOne('A', { n: 2 }));
      const original = first.inspect().changes;
      expect(original).toHaveLength(1);
      expect(original[0].address).toEqual(['rows', 'n']);
      expect(original[0].subject).toEqual(expect.any(Number));
      const subject = original[0].subject;
      tree.$.rows.changeId('A', 'Z');
      tree.$.rows.addOne({ id: 'A', n: 10 });
      const second = tree.transact(() => tree.$.rows.updateOne('A', { n: 11 }));
      const after = first.inspect().changes;
      expect(after).toHaveLength(1);
      expect(after[0].address).toEqual(['rows', 'n']);
      expect(after[0].subject).toBe(subject);
      const replacement = second.inspect().changes;
      expect(replacement).toHaveLength(1);
      expect(replacement[0].address).toEqual(['rows', 'n']);
      expect(replacement[0].subject).not.toBe(subject);
      first.confirm();
      second.rollback();
      expect(tree.$.rows.byIdOrFail('Z')().n).toBe(2);
      expect(tree.$.rows.byIdOrFail('A')().n).toBe(10);
    } finally {
      tree.destroy();
    }
  });

  it('inspection preserves existing literal versus object-valued field address granularity', () => {
    const tree = signalTree(
      {
        rows: entityMap<
          { id: string; 'n.a': number; n: { a: number } },
          string
        >(),
      },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    try {
      tree.$.rows.addOne({ id: 'A', 'n.a': 0, n: { a: 0 } });
      const pending = tree.transact(() =>
        tree.$.rows.updateOne('A', { 'n.a': 1, n: { a: 1 } })
      );
      const changes = pending.inspect().changes;
      expect(changes).toHaveLength(2);
      expect(changes.map((change) => change.address)).toEqual([
        ['rows', 'n.a'],
        ['rows', 'n'],
      ]);
      expect(new Set(changes.map((change) => change.subject)).size).toBe(1);
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('A')()).toEqual({
        id: 'A',
        'n.a': 0,
        n: { a: 0 },
      });
    } finally {
      tree.destroy();
    }
  });

  it('restores pending removal without the restoration enhancer and keeps held lifetime', () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      expect(held()).toBeUndefined();
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
      expect(held()).toEqual({ id: 'A', n: 1 });
    } finally {
      tree.destroy();
    }
  });

  it('holds membership delivery until both collections and responsibility have settled', () => {
    const tree = signalTree(
      {
        marker: 0,
        left: entityMap<Row, string>(),
        right: entityMap<Row, string>(),
      },
      {
        enhancers: [
          selectNativeOwnershipTransactions(transactions()),
          restoration(),
        ],
      }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    let off = () => {
      /* No subscription exists until setup succeeds. */
    };
    try {
      const pending = tree.transact(() => {
        tree.$.marker(2);
        tree.$.left.addOne({ id: 'A', n: 1 });
        tree.$.right.addOne({ id: 'B', n: 2 });
      });
      const reader = entityMembershipReader(tree)!;
      expect(reader).toBeDefined();
      const seen: unknown[] = [];
      off = reader.subscribe(() => {
        seen.push([
          [...tree.$.left.ids()],
          [...tree.$.right.ids()],
          getNativeOwnershipPublicExperiment(tree)?.stats().pending,
        ]);
        tree.$.marker(9);
      });
      pending.rollback();
      expect(seen.length).toBeGreaterThan(0);
      expect(seen).toEqual(seen.map(() => [[], [], 0]));
      expect(tree.$.marker()).toBe(9);
      pending.rollback();
      expect(tree.$.marker()).toBe(9);
    } finally {
      off();
      tree.destroy();
    }
  });

  it.each(['creator-first', 'ordering-first'] as const)(
    'preserves ordering dependencies on a created lifetime in %s rejection order',
    (order) => {
      const tree = make();
      try {
        tree.$.rows.addMany([
          { id: 'A', n: 1 },
          { id: 'B', n: 2 },
        ]);
        const creator = tree.transact(() =>
          tree.$.rows.addOne({ id: 'C', n: 3 })
        );
        const ordering = tree.transact(() =>
          tree.$.rows.setAll([
            { id: 'C', n: 3 },
            { id: 'A', n: 1 },
            { id: 'B', n: 2 },
          ])
        );
        expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
        if (order === 'creator-first') {
          let refused = false;
          try {
            creator.rollback();
          } catch {
            refused = true;
          }
          expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
          if (refused)
            expect(
              getNativeOwnershipPublicExperiment(tree)?.stats().pending
            ).toBe(2);
          ordering.rollback();
          if (refused) creator.rollback();
        } else {
          ordering.rollback();
          expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
          creator.rollback();
        }
        expect(tree.$.rows.ids()).toEqual(['A', 'B']);
        expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
      } finally {
        tree.destroy();
      }
    }
  );

  it('attempts every collection publication after one settlement callback throws', async () => {
    const tree = signalTree(
      {
        marker: 0,
        left: entityMap<Row, string>(),
        right: entityMap<Row, string>(),
      },
      {
        enhancers: [
          selectNativeOwnershipTransactions(transactions()),
          restoration(),
        ],
      }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    let offLeft = () => {
        /* No subscription exists until setup succeeds. */
      },
      offRight = () => {
        /* No subscription exists until setup succeeds. */
      },
      offPath = () => {
        /* No subscription exists until setup succeeds. */
      };
    const failure = new Error('left removal delivery');
    try {
      const pending = tree.transact(() => {
        tree.$.marker(2);
        tree.$.left.addOne({ id: 'A', n: 1 });
        tree.$.right.addOne({ id: 'B', n: 2 });
      });
      await flush();
      let rightCalls = 0;
      const paths: unknown[] = [];
      offLeft = tree.$.left.tap({
        onRemove: () => {
          throw failure;
        },
      });
      offRight = tree.$.right.tap({
        onRemove: () => {
          rightCalls++;
        },
      });
      offPath = getPathNotifier().subscribe('right.B', (value) => {
        paths.push(value);
      });
      let caught: unknown;
      try {
        pending.rollback();
      } catch (error) {
        caught = error;
      }
      await flush();
      expect(caught).toBe(failure);
      expect(tree.$.marker()).toBe(0);
      expect(tree.$.left.ids()).toEqual([]);
      expect(tree.$.right.ids()).toEqual([]);
      expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(0);
      expect(rightCalls).toBe(1);
      expect(paths).toEqual([undefined]);
      pending.rollback();
      expect(rightCalls).toBe(1);
    } finally {
      offPath();
      offRight();
      offLeft();
      tree.destroy();
    }
  });

  it('releases tree-held consequences only after owned entity projections are coherent', () => {
    const tree = make();
    try {
      const pending = tree.transact(() =>
        tree.$.rows.addOne({ id: 'A', n: 1 })
      );
      expect(tree.$.rows.all()).toEqual([{ id: 'A', n: 1 }]);
      expect(tree.$.rows.ids()).toEqual(['A']);
      expect(tree.$.rows.count()).toBe(1);
      const seen: unknown[] = [];
      scheduleDurableConsequence({
        claimant: tree,
        key: 'projection-check',
        run: () =>
          seen.push({
            all: tree.$.rows.all(),
            ids: tree.$.rows.ids(),
            count: tree.$.rows.count(),
            direct: tree.$.rows.byId('A')?.(),
            pending: getNativeOwnershipPublicExperiment(tree)?.stats().pending,
          }),
      });
      expect(seen).toEqual([]);
      pending.rollback();
      expect(seen).toEqual([
        { all: [], ids: [], count: 0, direct: undefined, pending: 0 },
      ]);
    } finally {
      tree.destroy();
    }
  });
});
