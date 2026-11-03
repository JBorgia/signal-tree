import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { scheduleDurableConsequence } from '../../lib/internals/commit-consequence';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const makeTree = () =>
  signalTree({ x: 0, y: 0 }, { enhancers: [restoration(), transactions()] });

describe('restoration overlapping a pending transaction', () => {
  it('refuses overlap even when the pending value equals the undo target', async () => {
    const tree = makeTree();
    try {
      undoable(() => tree.$.x(1));
      await flush();
      const pending = tree.transact(() => tree.$.x(0));
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.x()).toBe(0);
      expect(tree.getCurrentIndex()).toBe(index);
      pending.rollback();
      tree.undo();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  // v16 adaptation of the v15.4.0 donor case of the same scenario. v15 settles
  // the commit scope ('commit') on an explicit rollback refusal, so its donor
  // expected `released === 1` straight after the refusal. v16 deliberately
  // keeps the durable hold until an actual settlement:
  // `transactions/rollback-refusal-scope.spec.ts` ("a refused rollback keeps
  // the turn AND the durable hold") is a destination anchor. Restoration's
  // protection of the still-pending handle is the part carried unchanged.
  it('protects the still-pending handle after explicit rollback refusal holds consequences', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', n: 0 });
      await flush();
      undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
      await flush();
      const pending = tree.transact(() => tree.$.rows.removeOne('a'));
      tree.$.rows.addOne({ id: 'a', n: 99 });
      await flush();
      let released = 0;
      scheduleDurableConsequence({
        claimant: tree.$,
        key: {},
        run: () => {
          released++;
        },
      });
      expect(released).toBe(0);
      expect(() => pending.rollback()).toThrow(/rollback/i);
      expect(released).toBe(0);
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 99 }]);
      pending.confirm();
      expect(released).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('refuses undoing an entity creation while that lifetime has pending edits', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      undoable(() => tree.$.rows.addOne({ id: 'a', n: 0 }));
      await flush();
      const pending = tree.transact(() => tree.$.rows.updateOne('a', { n: 1 }));
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1 }]);
      pending.rollback();
      tree.undo();
      expect(tree.$.rows.all()).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  for (const operation of ['undo', 'redo'] as const) {
    for (const decision of ['confirm', 'rollback'] as const) {
      it.each(operation === 'undo' ? [false, true] : [false])(
        `${operation} refuses a pending overlap (designated=%s) before ${decision}`,
        async (designated) => {
          const tree = makeTree();
          try {
            undoable(() => tree.$.x(1));
            await flush();
            if (operation === 'redo') {
              tree.undo();
              await flush();
            }
            const baseline = tree.$.x();
            const pending = tree.transact(() => {
              if (designated) undoable(() => tree.$.x(2));
              else tree.$.x(2);
            });
            const index = tree.getCurrentIndex();
            const canUndo = tree.canUndo();
            const canRedo = tree.canRedo();
            let error: unknown;
            try {
              tree[operation]();
            } catch (caught) {
              error = caught;
            }
            expect(
              tree.$.x(),
              'restoration must not overwrite pending truth'
            ).toBe(2);
            expect(error).toBeInstanceOf(Error);
            expect(String(error)).toMatch(/ST1034/);
            expect(tree.getCurrentIndex()).toBe(index);
            expect(tree.canUndo()).toBe(canUndo);
            expect(tree.canRedo()).toBe(canRedo);
            pending[decision]();
            await flush();
            expect(tree.$.x()).toBe(decision === 'confirm' ? 2 : baseline);
            if (decision === 'rollback') {
              tree[operation]();
              expect(tree.$.x()).toBe(operation === 'undo' ? 0 : 1);
            }
          } finally {
            tree.destroy();
          }
        }
      );

      it(`${operation} remains available on a disjoint location before ${decision}`, async () => {
        const tree = makeTree();
        try {
          undoable(() => tree.$.x(1));
          await flush();
          if (operation === 'redo') {
            tree.undo();
            await flush();
          }
          const pending = tree.transact(() => tree.$.y(2));
          tree[operation]();
          expect(tree.$.x()).toBe(operation === 'undo' ? 0 : 1);
          expect(tree.$.y()).toBe(2);
          pending[decision]();
          await flush();
          expect(tree.$.x()).toBe(operation === 'undo' ? 0 : 1);
          expect(tree.$.y()).toBe(decision === 'confirm' ? 2 : 0);
        } finally {
          tree.destroy();
        }
      });
    }

    it(`${operation} refuses the entire multi-location turn when only one location is pending`, async () => {
      const tree = makeTree();
      try {
        undoable(() => {
          tree.$.x(1);
          tree.$.y(1);
        });
        await flush();
        if (operation === 'redo') {
          tree.undo();
          await flush();
        }
        const pending = tree.transact(() => tree.$.x(2));
        const before = tree.$();
        expect(() => tree[operation]()).toThrow(/ST1034/);
        expect(tree.$()).toEqual(before);
        pending.rollback();
        await flush();
        tree[operation]();
        expect(tree.$()).toEqual(
          operation === 'undo' ? { x: 0, y: 0 } : { x: 1, y: 1 }
        );
      } finally {
        tree.destroy();
      }
    });

    it(`${operation} refuses overlap inside the still-running transaction callback`, async () => {
      const tree = makeTree();
      try {
        undoable(() => tree.$.x(1));
        await flush();
        if (operation === 'redo') {
          tree.undo();
          await flush();
        }
        const pending = tree.transact(() => {
          tree.$.x(2);
          expect(() => tree[operation]()).toThrow(/ST1034/);
          expect(tree.$.x()).toBe(2);
        });
        pending.rollback();
      } finally {
        tree.destroy();
      }
    });

    it(`${operation} permits disjoint work inside the transaction callback`, async () => {
      const tree = makeTree();
      try {
        undoable(() => tree.$.x(1));
        await flush();
        if (operation === 'redo') {
          tree.undo();
          await flush();
        }
        const pending = tree.transact(() => {
          tree.$.y(2);
          tree[operation]();
        });
        expect(tree.$()).toEqual({ x: operation === 'undo' ? 0 : 1, y: 2 });
        pending.rollback();
        expect(tree.$()).toEqual({ x: operation === 'undo' ? 0 : 1, y: 0 });
      } finally {
        tree.destroy();
      }
    });

    it.each(['same-field', 'sibling-field', 'other-row'] as const)(
      `${operation} checks entity overlap at %s`,
      async (overlap) => {
        const tree = signalTree(
          {
            rows: entityMap<{ id: string; n: number; m: number }, string>({
              selectId: (row) => row.id,
            }),
          },
          { enhancers: [restoration(), transactions()] }
        );
        try {
          tree.$.rows.setAll([
            { id: 'a', n: 0, m: 0 },
            { id: 'b', n: 0, m: 0 },
          ]);
          await flush();
          undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
          await flush();
          if (operation === 'redo') {
            tree.undo();
            await flush();
          }
          const pending = tree.transact(() =>
            tree.$.rows.updateOne(
              overlap === 'other-row' ? 'b' : 'a',
              overlap === 'sibling-field' ? { m: 2 } : { n: 2 }
            )
          );
          const before = tree.$.rows.all();
          if (overlap === 'same-field') {
            expect(() => tree[operation]()).toThrow(/ST1034/);
            expect(tree.$.rows.all()).toEqual(before);
          } else {
            tree[operation]();
            expect(tree.$.rows.all()).toEqual([
              {
                id: 'a',
                n: operation === 'undo' ? 0 : 1,
                m: overlap === 'sibling-field' ? 2 : 0,
              },
              { id: 'b', n: overlap === 'other-row' ? 2 : 0, m: 0 },
            ]);
          }
          pending.rollback();
          await flush();
          if (overlap === 'same-field') tree[operation]();
          expect(tree.$.rows.all()).toEqual([
            { id: 'a', n: operation === 'undo' ? 0 : 1, m: 0 },
            { id: 'b', n: 0, m: 0 },
          ]);
        } finally {
          tree.destroy();
        }
      }
    );
  }

  it('does not overwrite newer confirmed truth while an older transaction still owns the location', async () => {
    const tree = makeTree();
    try {
      const pending = tree.transact(() => tree.$.x(1));
      undoable(() => tree.$.x(2));
      await flush();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.x()).toBe(2);
      pending.confirm();
      tree.undo();
      expect(tree.$.x()).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  // v16 adaptation of the v15.4.0 donor case 'preserves existing redo
  // truncation when designated pending work is staged'. v15 truncates the redo
  // branch when designated pending work STAGES, so a later rollback leaves the
  // user with neither the rejected work nor the redo it destroyed. v16 truncates
  // only on admission (`prepareConfirmedInsertion`: "Only admitted work
  // replaces redo. Staging may still be abandoned."), which is what L3 asks of
  // a rejected contribution. While the work is pending, redo overlaps it and
  // is refused without moving anything — the protection this slice carries.
  it.each(['rollback', 'confirm'] as const)(
    'keeps redo until designated pending work is admitted (%s)',
    async (decision) => {
      const tree = makeTree();
      try {
        undoable(() => tree.$.x(1));
        await flush();
        tree.undo();
        const pending = tree.transact(() => undoable(() => tree.$.x(2)));
        const index = tree.getCurrentIndex();
        expect(tree.canRedo()).toBe(true);
        expect(() => tree.redo()).toThrow(/ST1034/);
        expect(tree.$.x()).toBe(2);
        expect(tree.getCurrentIndex()).toBe(index);
        pending[decision]();
        await flush();
        if (decision === 'confirm') {
          expect(tree.$.x()).toBe(2);
          expect(tree.canRedo()).toBe(false);
          tree.undo();
          expect(tree.$.x()).toBe(0);
        } else {
          expect(tree.$.x()).toBe(0);
          expect(tree.canRedo()).toBe(true);
          tree.redo();
          expect(tree.$.x()).toBe(1);
        }
      } finally {
        tree.destroy();
      }
    }
  );
});
