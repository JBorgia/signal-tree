import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';

describe.each([false, true])(
  'committed entity admission (transactions first=%s)',
  (transactionsFirst) => {
    const enhancers = () =>
      transactionsFirst
        ? [transactions(), restoration()]
        : [restoration(), transactions()];
    for (const writer of [
      'updateOne',
      'updateMany',
      'byId',
      'upsertMany',
      'setAll',
    ] as const) {
      for (const overlap of [true, false]) {
        it.each(['undo', 'redo'] as const)(
          `protects an entity inside the active callback during %s (overlap=${overlap}, writer=${writer})`,
          async (operation) => {
            const tree = signalTree(
              {
                rows: entityMap<{ id: string; n: number; m: number }, string>({
                  selectId: (row) => row.id,
                }),
              },
              { enhancers: enhancers() }
            );
            try {
              tree.$.rows.addOne({ id: 'a', n: 0, m: 0 });
              for (let i = 0; i < 8; i++) await Promise.resolve();
              undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
              for (let i = 0; i < 8; i++) await Promise.resolve();
              if (operation === 'redo') tree.undo();
              let after: unknown;
              let failure: unknown;
              const pending = tree.transaction(() => {
                const patch = overlap ? { n: 2 } : { m: 2 };
                const value = {
                  id: 'a',
                  n: operation === 'undo' ? 1 : 0,
                  m: 0,
                  ...patch,
                };
                if (writer === 'updateMany')
                  tree.$.rows.updateMany(['a'], patch);
                else if (writer === 'byId') tree.$.rows.byIdOrFail('a')(value);
                else if (writer === 'upsertMany')
                  tree.$.rows.upsertMany([value]);
                else if (writer === 'setAll') tree.$.rows.setAll([value]);
                else tree.$.rows.updateOne('a', patch);
                try {
                  tree[operation]();
                } catch (error) {
                  failure = error;
                }
                after = tree.$.rows.all();
              });
              expect(after).toEqual([
                {
                  id: 'a',
                  n: overlap ? 2 : operation === 'undo' ? 0 : 1,
                  m: overlap ? 0 : 2,
                },
              ]);
              if (overlap) expect(String(failure)).toMatch(/ST1034/);
              else expect(failure).toBeUndefined();
              pending.confirm();
            } finally {
              tree.destroy();
            }
          }
        );
      }
    }

    for (const batching of [true, false]) {
      it.each(['undo', 'redo'] as const)(
        `protects committed entity truth before an earlier notifier subscriber can re-enter %s (batching=${batching})`,
        async (operation) => {
          const notifier = getPathNotifier();
          const previousBatching = notifier.isBatchingEnabled();
          notifier.setBatchingEnabled(true);

          let reenter: (() => void) | undefined;
          // This listener deliberately precedes both enhancer subscriptions.
          const off = notifier.subscribe('rows.a', (value) => {
            if ((value as { n?: number } | undefined)?.n === 2) {
              const callback = reenter;
              reenter = undefined;
              callback?.();
            }
          });
          const tree = signalTree(
            {
              rows: entityMap<{ id: string; n: number }, string>({
                selectId: (row) => row.id,
              }),
            },
            { enhancers: enhancers() }
          );
          try {
            tree.$.rows.addOne({ id: 'a', n: 0 });
            for (let i = 0; i < 8; i++) await Promise.resolve();
            undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
            for (let i = 0; i < 8; i++) await Promise.resolve();
            if (operation === 'redo') tree.undo();
            expect(operation === 'undo' ? tree.canUndo() : tree.canRedo()).toBe(
              true
            );
            notifier.setBatchingEnabled(batching);
            const cursor = {
              index: tree.getCurrentIndex(),
              canUndo: tree.canUndo(),
              canRedo: tree.canRedo(),
            };
            let after: unknown;
            let failure: unknown;
            let delivered = false;
            reenter = () => {
              delivered = true;
              try {
                tree[operation]();
              } catch (error) {
                failure = error;
              }
              after = {
                rows: tree.$.rows.all(),
                index: tree.getCurrentIndex(),
                canUndo: tree.canUndo(),
                canRedo: tree.canRedo(),
              };
            };
            const pending = tree.transaction(() =>
              tree.$.rows.updateOne('a', { n: 2 })
            );
            expect(delivered).toBe(true);
            expect(after).toEqual({ rows: [{ id: 'a', n: 2 }], ...cursor });
            expect(String(failure)).toMatch(/ST1034/);
            pending.confirm();
          } finally {
            reenter = undefined;
            off();
            tree.destroy();
            notifier.setBatchingEnabled(previousBatching);
          }
        }
      );
    }

    it.each(['confirm', 'rollback', 'destroy'] as const)(
      'releases committed observation after %s without losing pending ownership on history reset',
      (decision) => {
        const tree = signalTree(
          {
            rows: entityMap<{ id: string; n: number }, string>({
              selectId: (row) => row.id,
            }),
          },
          { enhancers: enhancers() }
        );
        const runtime = getMutationCaptureRuntime(tree);
        try {
          tree.$.rows.addOne({ id: 'a', n: 0 });
          expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
          const pending = tree.transaction(() =>
            tree.$.rows.updateOne('a', { n: 1 })
          );
          expect(runtime?.hasCommittedEntityObservers?.()).toBe(true);
          tree.resetRestorationHistory();
          expect(runtime?.hasCommittedEntityObservers?.()).toBe(true);
          if (decision === 'destroy') tree.destroy();
          else pending[decision]();
          expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
        } finally {
          tree.destroy();
        }
      }
    );

    it('retains observation and protection after explicit rollback refusal', async () => {
      const tree = signalTree(
        {
          rows: entityMap<{ id: string; n: number }, string>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: enhancers() }
      );
      const runtime = getMutationCaptureRuntime(tree);
      try {
        tree.$.rows.addOne({ id: 'a', n: 0 });
        for (let i = 0; i < 8; i++) await Promise.resolve();
        undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
        for (let i = 0; i < 8; i++) await Promise.resolve();
        const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
        tree.$.rows.addOne({ id: 'a', n: 9 });
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(() => pending.rollback()).toThrow();
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(true);
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 9 }]);
        pending.confirm();
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
      } finally {
        tree.destroy();
      }
    });
    it.each(['updateMany', 'upsertMany', 'setAll'] as const)(
      'captures every committed row before the first %s notification re-enters undo',
      async (writer) => {
        const notifier = getPathNotifier();
        let reenter: (() => void) | undefined;
        const off = notifier.subscribe('rows.a', (value) => {
          if ((value as { n?: number } | undefined)?.n === 2) reenter?.();
        });
        const tree = signalTree(
          {
            rows: entityMap<{ id: string; n: number }, string>({
              selectId: (row) => row.id,
            }),
          },
          { enhancers: enhancers() }
        );
        try {
          tree.$.rows.setAll([
            { id: 'a', n: 0 },
            { id: 'b', n: 0 },
          ]);
          for (let i = 0; i < 8; i++) await Promise.resolve();
          undoable(() => tree.$.rows.updateOne('b', { n: 1 }));
          for (let i = 0; i < 8; i++) await Promise.resolve();
          let failure: unknown;
          reenter = () => {
            reenter = undefined;
            try {
              tree.undo();
            } catch (error) {
              failure = error;
            }
          };
          const pending = tree.transaction(() => {
            if (writer === 'updateMany')
              tree.$.rows.updateMany(['a', 'b'], { n: 2 });
            else
              tree.$.rows[writer]([
                { id: 'a', n: 2 },
                { id: 'b', n: 2 },
              ]);
          });
          expect(String(failure)).toMatch(/ST1034/);
          expect(tree.$.rows.all()).toEqual([
            { id: 'a', n: 2 },
            { id: 'b', n: 2 },
          ]);
          pending.rollback();
        } finally {
          reenter = undefined;
          off();
          tree.destroy();
        }
      }
    );

    it('releases its observer after callback failure and permits retry', async () => {
      const tree = signalTree(
        {
          rows: entityMap<{ id: string; n: number }, string>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: enhancers() }
      );
      const runtime = getMutationCaptureRuntime(tree);
      try {
        tree.$.rows.addOne({ id: 'a', n: 0 });
        for (let i = 0; i < 8; i++) await Promise.resolve();
        undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
        for (let i = 0; i < 8; i++) await Promise.resolve();
        const error = new Error('callback failed');
        expect(() =>
          tree.transaction(() => {
            tree.$.rows.updateOne('a', { n: 2 });
            throw error;
          })
        ).toThrow(error);
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
        expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1 }]);
        tree.undo();
        expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 0 }]);
      } finally {
        tree.destroy();
      }
    });
  }
);
