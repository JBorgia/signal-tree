import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Rolling back a pending ORDER change (setAll reordering survivors, an
 * overwriting prependMany moving a row) while a later change to the same
 * collection's order or membership stands. The order change applies only at
 * the exact order it recorded (its frontier token, invariant 3 in
 * causal-runtime-contract.md), and the later change replaced that order: it
 * rests on the order change, so the rollback is refused as a DEPENDENCY,
 * `later-confirmed-dependency` when the later change is settled and
 * `later-pending-dependency` when it is another open transaction (settle
 * that one first). Nothing changes and the transaction stays pending.
 *
 * It used to refuse as `effect-validation-failed` ("collection order frontier
 * does not match the transition endpoint"), which reads as a broken
 * compensation rather than as later work depending on this one.
 *
 * Not admitted by rebasing the order change over the later one: identity is
 * the rule (a delta that would still fit is exactly the rebase it forbids;
 * see the identity carriers in turn-order-delta.spec.ts).
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const orderChanges: Array<[string, (tree: Tree) => void]> = [
  [
    'setAll reordering survivors',
    (tree) => tree.$.rows.setAll([...tree.$.rows.all()].reverse()),
  ],
  [
    'prependMany overwrite moving a row',
    (tree) =>
      tree.$.rows.prependMany([{ id: 'e', n: 9 }], { mode: 'overwrite' }),
  ],
];
const settled: Array<[string, (tree: Tree) => void]> = [
  ['a plain addOne', (tree) => tree.$.rows.addOne({ id: 'w', n: 0 })],
  ['a plain removeOne', (tree) => tree.$.rows.removeOne('c')],
  [
    'a plain setAll reorder',
    (tree) => tree.$.rows.setAll([...tree.$.rows.all()].reverse()),
  ],
  [
    'a confirmed transaction adding a row',
    (tree) =>
      tree.transaction(() => tree.$.rows.addOne({ id: 'w', n: 0 })).confirm(),
  ],
];

const cases = orderChanges.flatMap(([orderName, order]) =>
  settled.map(
    ([laterName, later]) =>
      [`${orderName}, then ${laterName}`, order, later] as const
  )
);

const refusal = (run: () => void) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the rollback to refuse');
};

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'rollback of an order change under a later change (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
      await flush();
      return tree;
    };

    it.each(cases)(
      '%s: refused as later-confirmed-dependency, nothing changes',
      async (_case, order, later) => {
        const tree = await make();
        try {
          const pending = tree.transaction(() => order(tree));
          await flush();
          later(tree);
          await flush();
          const standing = tree.$.rows.all();
          const error = refusal(() => pending.rollback());
          expect(error).toBeInstanceOf(SignalTreeRollbackError);
          expect((error as { cause?: { kind?: string } }).cause?.kind).toBe(
            'later-confirmed-dependency'
          );
          expect((error as Error).message).toContain(
            '[later-confirmed-dependency]'
          );
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(standing);
          // Still pending: it can be confirmed (and is then settled).
          expect(() => pending.confirm()).not.toThrow();
          expect(() => pending.rollback()).toThrow(
            'Cannot rollback a confirmed transaction'
          );
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s, then an open transaction adding a row: later-pending-dependency until it settles',
      async (_case, order) => {
        const tree = await make();
        try {
          const before = tree.$.rows.all();
          const first = tree.transaction(() => order(tree));
          await flush();
          const reordered = tree.$.rows.all();
          const second = tree.transaction(() =>
            tree.$.rows.addOne({ id: 'w', n: 0 })
          );
          await flush();
          const standing = tree.$.rows.all();
          const error = refusal(() => first.rollback());
          expect(error).toBeInstanceOf(SignalTreeRollbackError);
          expect((error as { cause?: { kind?: string } }).cause?.kind).toBe(
            'later-pending-dependency'
          );
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(standing);
          second.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(reordered);
          first.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(before);
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s: an open transaction that is EARLIER, or on another collection, is not the dependency',
      async (_case, order) => {
        const tree = signalTree(
          { ...declaration(), other: entityMap<Row, string>() },
          { enhancers: enhancers() as never }
        ) as unknown as Tree & {
          $: { other: Tree['$']['rows'] };
        };
        try {
          for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
          await flush();
          const earlier = tree.transaction(() =>
            tree.$.rows.updateOne('a', { n: 1 })
          );
          await flush();
          const pending = tree.transaction(() => order(tree));
          await flush();
          const elsewhere = tree.transaction(() =>
            tree.$.other.addOne({ id: 'w', n: 0 })
          );
          await flush();
          tree.$.rows.addOne({ id: 'v', n: 0 });
          await flush();
          const error = refusal(() => pending.rollback());
          expect((error as { cause?: { kind?: string } }).cause?.kind).toBe(
            'later-confirmed-dependency'
          );
          earlier.confirm();
          elsewhere.confirm();
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s, then settled work and an open transaction: later-confirmed-dependency, also once the open one settles',
      async (_case, order) => {
        // Order-delta review, item 5: settled work replaced the token first,
        // so settling the open transaction cannot bring it back; reporting
        // later-pending-dependency advised a retry that then refused.
        const tree = await make();
        try {
          const first = tree.transaction(() => order(tree));
          await flush();
          tree.$.rows.addOne({ id: 'v', n: 0 });
          await flush();
          const second = tree.transaction(() =>
            tree.$.rows.addOne({ id: 'w', n: 0 })
          );
          await flush();
          const kindOf = (error: unknown) =>
            (error as { cause?: { kind?: string } }).cause?.kind;
          expect(kindOf(refusal(() => first.rollback()))).toBe(
            'later-confirmed-dependency'
          );
          second.rollback();
          await flush();
          expect(kindOf(refusal(() => first.rollback()))).toBe(
            'later-confirmed-dependency'
          );
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s, then an open transaction and settled work after it: later-confirmed-dependency',
      async (_case, order) => {
        const tree = await make();
        try {
          const first = tree.transaction(() => order(tree));
          await flush();
          const second = tree.transaction(() =>
            tree.$.rows.addOne({ id: 'w', n: 0 })
          );
          await flush();
          tree.$.rows.addOne({ id: 'v', n: 0 });
          await flush();
          expect(
            (refusal(() => first.rollback()) as { cause?: { kind?: string } })
              .cause?.kind
          ).toBe('later-confirmed-dependency');
          second.confirm();
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s, then two open transactions: later-pending-dependency, naming the first, until both settle',
      async (_case, order) => {
        const tree = await make();
        try {
          const before = tree.$.rows.all();
          const first = tree.transaction(() => order(tree));
          await flush();
          const second = tree.transaction(() =>
            tree.$.rows.addOne({ id: 'v', n: 0 })
          );
          await flush();
          const third = tree.transaction(() => tree.$.rows.removeOne('a'));
          await flush();
          const error = refusal(() => first.rollback()) as {
            cause?: { kind?: string; conflictingTurnId?: number };
          };
          expect(error.cause?.kind).toBe('later-pending-dependency');
          third.rollback();
          await flush();
          second.rollback();
          await flush();
          first.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(before);
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(orderChanges)(
      '%s, then a later change to a different collection: rolls back',
      async (_case, order) => {
        const tree = signalTree(
          { ...declaration(), other: entityMap<Row, string>() },
          { enhancers: enhancers() as never }
        ) as unknown as Tree & {
          $: { other: Tree['$']['rows'] };
        };
        try {
          for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
          await flush();
          const before = tree.$.rows.all();
          const pending = tree.transaction(() => order(tree));
          await flush();
          tree.$.other.addOne({ id: 'w', n: 0 });
          await flush();
          pending.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(before);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
