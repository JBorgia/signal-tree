import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions, undoable } from '../../index';
import { getPathNotifier } from '../../lib/path-notifier';
import * as targets from '../../lib/internals/causal-runtime/target-transition';
import { peekInternalTransactionRuntime } from '../transactions/transactions';
import { restoration } from './restoration';

// Public writes construct the condition. The spy only records the unchanged
// planner inputs; no missing metadata or failed restore is injected by a mock.
describe('rollback with no surviving placement anchors', () => {
  for (const reverse of [false, true]) {
    for (const unrelatedRow of [false, true]) {
      it(`refuses a multi-restore without changing state or retiring authority (reverse=${reverse}, unrelated=${unrelatedRow})`, () => {
        const tree = signalTree(
          { scalar: 0, rows: entityMap<{ id: string }>() },
          {
            enhancers: reverse
              ? [transactions(), restoration()]
              : [restoration(), transactions()],
          }
        );
        const derive = vi.spyOn(targets, 'deriveDeclarativeTransitionTarget');
        try {
          tree.$.rows.addMany(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })));
          getPathNotifier().flushSync();
          const pending = tree.transact(() =>
            undoable(() => {
              tree.$.scalar(1);
              tree.$.rows.removeOne('b');
              tree.$.rows.removeOne('d');
            })
          );
          undoable(() => {
            tree.$.rows.removeOne('a');
            tree.$.rows.removeOne('c');
            tree.$.rows.removeOne('e');
            if (unrelatedRow) tree.$.rows.addOne({ id: 'z' });
          });
          getPathNotifier().flushSync();
          const runtime = peekInternalTransactionRuntime(tree)!;
          const ids = runtime.getPendingTurnIds();
          expect(ids).toHaveLength(1);
          const removes = runtime
            .describePendingTurn(ids[0])!
            .effects.filter((e) => e.kind === 'remove');
          expect(removes).toHaveLength(2);
          for (const remove of removes) {
            expect(remove.beforeSubject).toBeTypeOf('number');
            expect(remove.afterSubject).toBeTypeOf('number');
          }
          expect(tree.$.rows.ids()).toEqual(unrelatedRow ? ['z'] : []);
          const before = tree.$();
          const confirmed = runtime.getConfirmedTurnCount();
          derive.mockClear();
          expect(() => pending.rollback()).toThrow(/no live placement anchor/);

          // Demonstrate the exact failed precondition, not merely missing keys:
          // no live anchor subject, no same-target anchor restoration, and no
          // retained order delta that could supply an alternate endpoint.
          expect(derive).toHaveBeenCalledOnce();
          const input = derive.mock.calls[0][0];
          expect(input.orderDeltas).toEqual([]);
          const additions = input.effects.filter((e) => e.structural === 'add');
          expect(additions).toHaveLength(2);
          for (const effect of additions) {
            const source = input.collections.find(
              (c) => c.owner === effect.owner
            )!;
            const context = effect.structuralContext;
            expect(context?.kind).toBe('remove');
            if (context?.kind !== 'remove')
              throw new Error('Missing remove context');
            for (const anchor of [
              context.beforeSubject,
              context.afterSubject,
            ]) {
              expect(anchor).toBeTypeOf('number');
              expect(source.order).not.toContain(anchor);
              expect(source.subjects.some((s) => s.subject === anchor)).toBe(
                false
              );
              expect(
                additions.some(
                  (e) => e.owner === effect.owner && e.subjectId === anchor
                )
              ).toBe(false);
            }
          }
          expect(tree.$()).toEqual(before);
          expect(tree.$.scalar()).toBe(1);
          expect(runtime.getPendingTurnIds()).toEqual(ids);
          expect(runtime.getConfirmedTurnCount()).toBe(confirmed);
          expect(() => pending.rollback()).toThrow(/no live placement anchor/);
          expect(tree.$()).toEqual(before);
          expect(runtime.getPendingTurnIds()).toEqual(ids);

          // The refusal did not consume the caller's settlement authority.
          pending.confirm();
          expect(runtime.getPendingTurnCount()).toBe(0);
          expect(tree.$()).toEqual(before);
        } finally {
          derive.mockRestore();
          tree.destroy();
          getPathNotifier().flushSync();
        }
      });
    }
  }
});

describe('single restore requires retained placement proof', () => {
  for (const reverse of [false, true]) {
    for (const mixedScalar of [false, true]) {
      it(`refuses atomically and retains retry authority (reverse=${reverse}, scalar=${mixedScalar})`, () => {
        const tree = signalTree(
          { scalar: 0, rows: entityMap<{ id: string }>() },
          {
            enhancers: reverse
              ? [transactions(), restoration()]
              : [restoration(), transactions()],
          }
        );
        const subscriptions: (() => void)[] = [];
        try {
          tree.$.rows.addMany(['a', 'b', 'c'].map((id) => ({ id })));
          getPathNotifier().flushSync();
          const pending = tree.transact(() =>
            undoable(() => {
              if (mixedScalar) tree.$.scalar(1);
              tree.$.rows.removeOne('b');
            })
          );
          const runtime = peekInternalTransactionRuntime(tree)!;
          const ids = runtime.getPendingTurnIds();
          const removals = runtime
            .describePendingTurn(ids[0])!
            .effects.filter((e) => e.kind === 'remove');
          expect(removals).toHaveLength(1);
          expect(removals[0].beforeSubject).toBeTypeOf('number');
          expect(removals[0].afterSubject).toBeTypeOf('number');
          undoable(() => {
            tree.$.rows.removeOne('a');
            tree.$.rows.removeOne('c');
            tree.$.rows.addOne({ id: 'z' });
          });
          getPathNotifier().flushSync();
          // Both recorded anchor lifetimes were removed; z is a fresh lifetime.
          // No rekey or same-target anchor restoration can supply placement.
          expect(tree.$.rows.ids()).toEqual(['z']);
          const before = tree.$();
          const confirmed = runtime.getConfirmedTurnCount();
          const publications: unknown[] = [];
          subscriptions.push(
            getPathNotifier().subscribe('**', () => {
              publications.push(tree.$());
            }),
            tree.$.scalar.subscribe(() => publications.push(tree.$()))
          );
          for (let attempt = 0; attempt < 2; attempt++) {
            expect(() => pending.rollback()).toThrow(
              /no live placement anchor/
            );
            expect(tree.$()).toEqual(before);
            expect(runtime.getPendingTurnIds()).toEqual(ids);
            expect(runtime.getConfirmedTurnCount()).toBe(confirmed);
            expect(publications).toEqual([]);
            getPathNotifier().flushSync();
            expect(publications).toEqual([]);
            expect(tree.$()).toEqual(before);
          }
          pending.confirm();
          getPathNotifier().flushSync();
          expect(runtime.getPendingTurnCount()).toBe(0);
          expect(tree.$()).toEqual(before);
          expect(publications).toEqual([]);
        } finally {
          for (const off of subscriptions) off();
          tree.destroy();
          getPathNotifier().flushSync();
        }
      });
    }
  }
});

describe('single restore placement compatibility', () => {
  for (const scenario of [
    'before',
    'after',
    'none-original',
    'target-anchor',
    'rekey',
    'reversed',
  ] as const) {
    it(`preserves ${scenario} placement and held lifetime`, () => {
      const tree = signalTree(
        { scalar: 0, rows: entityMap<{ id: string }>() },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addMany(
          (scenario === 'none-original' ? ['b'] : ['a', 'b', 'c']).map(
            (id) => ({ id })
          )
        );
        getPathNotifier().flushSync();
        const held = tree.$.rows.byIdOrFail('b');
        const pending = tree.transact(() =>
          undoable(() => {
            tree.$.scalar(1);
            // Remove a first: its recorded after-anchor is b. Removing b
            // next records c, so the target has the dependency a -> b -> c.
            if (scenario === 'target-anchor') tree.$.rows.removeOne('a');
            tree.$.rows.removeOne('b');
          })
        );
        undoable(() => {
          if (scenario === 'before') tree.$.rows.removeOne('c');
          if (scenario === 'after') tree.$.rows.removeOne('a');
          if (scenario === 'none-original') tree.$.rows.addOne({ id: 'z' });
          if (scenario === 'rekey') tree.$.rows.changeId('a', 'aa');
          if (scenario === 'reversed')
            tree.$.rows.setAll([{ id: 'c' }, { id: 'a' }]);
        });
        getPathNotifier().flushSync();
        pending.rollback();
        getPathNotifier().flushSync();
        const expected = {
          before: ['a', 'b'],
          after: ['b', 'c'],
          'none-original': ['z', 'b'],
          'target-anchor': ['a', 'b', 'c'],
          rekey: ['aa', 'b', 'c'],
          reversed: ['b', 'c', 'a'],
        }[scenario];
        expect(tree.$.rows.ids()).toEqual(expected);
        expect(tree.$.rows.byIdOrFail('b')).toBe(held);
        expect(tree.$.scalar()).toBe(0);
        expect(
          peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
        ).toBe(0);
      } finally {
        tree.destroy();
        getPathNotifier().flushSync();
      }
    });
  }
});

describe('public restoration requires retained placement proof', () => {
  for (const direction of ['undo', 'redo'] as const) {
    for (const mixedScalar of [false, true]) {
      for (const unrelatedRow of [false, true]) {
        it(`refuses ${direction} atomically with retryable history (scalar=${mixedScalar}, unrelated=${unrelatedRow})`, () => {
          const tree = signalTree(
            {
              scalar: 0,
              'rows.with.dot': entityMap<
                { id: string | number },
                string | number
              >(),
            },
            { enhancers: [restoration()] }
          );
          const rows = tree.$['rows.with.dot'];
          const subscriptions: (() => void)[] = [];
          try {
            rows.addMany([{ id: 1 }, { id: '1' }, { id: 'x.y' }]);
            getPathNotifier().flushSync();
            if (direction === 'redo') {
              rows.removeOne('1');
              getPathNotifier().flushSync();
            }
            undoable(() => {
              if (mixedScalar) tree.$.scalar(1);
              if (direction === 'undo') rows.removeOne('1');
              else rows.addOne({ id: '1' });
            });
            getPathNotifier().flushSync();
            if (direction === 'redo') {
              tree.undo();
              getPathNotifier().flushSync();
            }
            // Ordinary writes do not replace the designated operation in
            // history. Both original neighboring lifetimes are now absent;
            // neither typed key spelling nor another row can supply proof.
            rows.removeOne(1);
            rows.removeOne('x.y');
            if (unrelatedRow) rows.addOne({ id: 'z' });
            getPathNotifier().flushSync();
            expect(rows.ids()).toEqual(unrelatedRow ? ['z'] : []);
            const before = tree.$();
            const index = tree.getCurrentIndex();
            const canUndo = tree.canUndo();
            const canRedo = tree.canRedo();
            expect(direction === 'undo' ? canUndo : canRedo).toBe(true);
            const publications: unknown[] = [];
            subscriptions.push(
              getPathNotifier().subscribe('**', () => {
                publications.push(tree.$());
              }),
              tree.$.scalar.subscribe(() => publications.push(tree.$()))
            );
            for (let attempt = 0; attempt < 2; attempt++) {
              expect(() => tree[direction]()).toThrow(
                /no live placement anchor/
              );
              expect(tree.$()).toEqual(before);
              expect(tree.getCurrentIndex()).toBe(index);
              expect(tree.canUndo()).toBe(canUndo);
              expect(tree.canRedo()).toBe(canRedo);
              expect(publications).toEqual([]);
              getPathNotifier().flushSync();
              expect(publications).toEqual([]);
              expect(tree.$()).toEqual(before);
            }
          } finally {
            for (const off of subscriptions) off();
            tree.destroy();
            getPathNotifier().flushSync();
          }
        });
      }
    }
  }
});

describe('placement dependencies are owner-qualified', () => {
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  for (const direction of ['rollback', 'undo'] as const) {
    it(`refuses cross-owner numeric identity aliases during ${direction}`, async () => {
      const tree = signalTree(
        {
          scalar: 0,
          left: entityMap<{ id: string }>(),
          right: entityMap<{ id: string }>(),
        },
        { enhancers: [restoration(), transactions()] }
      );
      let off: (() => void) | undefined;
      try {
        for (const rows of [tree.$.left, tree.$.right])
          rows.addMany(['a', 'b', 'c'].map((id) => ({ id })));
        await settle();
        const remove = () =>
          undoable(() => {
            tree.$.scalar(1);
            tree.$.left.removeOne('b');
            tree.$.right.removeOne('a');
            tree.$.right.removeOne('c');
          });
        const pending =
          direction === 'rollback' ? tree.transact(remove) : undefined;
        if (direction === 'undo') remove();
        await settle();
        tree.$.left.removeOne('a');
        tree.$.left.removeOne('c');
        tree.$.right.removeOne('b');
        tree.$.left.addOne({ id: 'z' });
        tree.$.right.addOne({ id: 'z' });
        await settle();
        expect(tree.$.left.ids()).toEqual(['z']);
        expect(tree.$.right.ids()).toEqual(['z']);
        const before = tree.$();
        const index = tree.getCurrentIndex();
        const canUndo = tree.canUndo();
        const canRedo = tree.canRedo();
        const pendingIds =
          peekInternalTransactionRuntime(tree)!.getPendingTurnIds();
        const publications: unknown[] = [];
        off = tree.$.scalar.subscribe(() => publications.push(tree.$()));
        for (let attempt = 0; attempt < 2; attempt++) {
          expect(() => (pending ? pending.rollback() : tree.undo())).toThrow(
            /no live placement anchor/
          );
          await settle();
          expect(tree.$()).toEqual(before);
          expect(tree.getCurrentIndex()).toBe(index);
          expect(tree.canUndo()).toBe(canUndo);
          expect(tree.canRedo()).toBe(canRedo);
          expect(
            peekInternalTransactionRuntime(tree)!.getPendingTurnIds()
          ).toEqual(pendingIds);
          expect(publications).toEqual([]);
        }
        pending?.confirm();
      } finally {
        off?.();
        tree.destroy();
        await settle();
      }
    });

    it(`preserves same-owner internal anchors during ${direction}`, async () => {
      const tree = signalTree(
        { rows: entityMap<{ id: string }>() },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addMany([{ id: 'a' }, { id: 'b' }]);
        await settle();
        const held = tree.$.rows.byIdOrFail('a');
        const remove = () =>
          undoable(() => {
            tree.$.rows.removeOne('a');
            tree.$.rows.removeOne('b');
          });
        const pending =
          direction === 'rollback' ? tree.transact(remove) : undefined;
        if (direction === 'undo') remove();
        await settle();
        expect(tree.$.rows.ids()).toEqual([]);
        if (pending) pending.rollback();
        else tree.undo();
        await settle();
        expect(tree.$.rows.ids()).toEqual(['a', 'b']);
        expect(tree.$.rows.byIdOrFail('a')).toBe(held);
      } finally {
        tree.destroy();
        await settle();
      }
    });
  }
});
