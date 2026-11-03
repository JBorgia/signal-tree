import { describe, expect, it } from 'vitest';
import { peekInternalTransactionRuntime } from './transactions';
import { entityMap, signalTree, transactions } from '../../index';
import { observeWrites } from '../../internals';
import { withWriteContext } from '../../lib/write-context';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { getPathNotifier } from '../../lib/path-notifier';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const foreign = (work: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, work);
const make = () =>
  signalTree(
    {
      x: 0,
      rows: entityMap<{ id: string; n: number }, string>(),
      other: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
type Tree = ReturnType<typeof make>;
const seed = async (tree: Tree) => {
  for (const rows of [tree.$.rows, tree.$.other])
    rows.setAll(['a', 'b', 'c'].map((id, n) => ({ id, n })));
  await tick();
};
const order = (rows: Tree['$']['rows'], ids: string) =>
  rows.setAll([...ids].map((id) => rows.byIdOrFail(id)()));

describe('native interleaved independent order refusal', () => {
  for (const last of ['acb', 'abc'])
    for (const aba of [false, true]) {
      it(`retains order interference for own endpoint ${last} and foreign ABA ${aba}`, async () => {
        const tree = make();
        const writes: string[] = [];
        const values: unknown[] = [];
        const off = observeWrites((frame) => {
          writes.push(frame.path);
        });
        const unsubscribe = getPathNotifier().subscribe('**', (value) => {
          values.push(value);
        });
        try {
          await seed(tree);
          const a = tree.$.rows.byIdOrFail('a');
          const pending = tree.transact(() => {
            tree.$.x(8);
            order(tree.$.rows, 'cba');
            foreign(() => {
              order(tree.$.rows, 'bca');
              if (aba) order(tree.$.rows, 'cba');
            });
            order(tree.$.rows, last);
          });
          expect(tree.$.rows.ids()).toEqual([...last]);
          expect(() => pending.inspect()).not.toThrow();
          expect(writes.length).toBeGreaterThan(0);
          expect(values.length).toBeGreaterThan(0);
          writes.length = 0;
          values.length = 0;
          expect(() => pending.rollback()).toThrow(/ordering conflict/i);
          expect(() => pending.rollback()).toThrow(/ordering conflict/i);
          await tick();
          expect(tree.$.rows.ids()).toEqual([...last]);
          expect(tree.$.rows.byIdOrFail('a')).toBe(a);
          expect(tree.$.x()).toBe(8);
          expect(writes).toEqual([]);
          expect(values).toEqual([]);
          expect(() => pending.inspect()).not.toThrow();
          pending.confirm();
          pending.confirm();
          expect(() => pending.rollback()).toThrow(/confirmed/i);
        } finally {
          off();
          unsubscribe();
          tree.destroy();
        }
      });
    }

  it('keeps safe own order rejection useful without an independent order', async () => {
    const tree = make();
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        order(tree.$.rows, 'cba');
        order(tree.$.rows, 'acb');
        tree.$.x(8);
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('does not classify a foreign field as order interference', async () => {
    const tree = make();
    try {
      await seed(tree);
      const a = tree.$.rows.byIdOrFail('a');
      const pending = tree.transact(() => {
        order(tree.$.rows, 'cba');
        foreign(() => a.n(123));
        order(tree.$.rows, 'acb');
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(a.n()).toBe(123);
    } finally {
      tree.destroy();
    }
  });

  it('keeps collection-local order evidence separate', async () => {
    const tree = make();
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        order(tree.$.rows, 'cba');
        foreign(() => order(tree.$.other, 'bca'));
        order(tree.$.rows, 'acb');
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(tree.$.other.ids()).toEqual(['b', 'c', 'a']);
    } finally {
      tree.destroy();
    }
  });

  it('uses a foreign order before the first own order as its actual inverse baseline', async () => {
    const tree = make();
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        foreign(() => order(tree.$.rows, 'bca'));
        order(tree.$.rows, 'cba');
        order(tree.$.rows, 'acb');
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['b', 'c', 'a']);
    } finally {
      tree.destroy();
    }
  });
  it('keeps scalar rejection useful when only an independent collection order changed', async () => {
    const tree = make();
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        tree.$.x(8);
        foreign(() => order(tree.$.rows, 'bca'));
      });
      pending.rollback();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.ids()).toEqual(['b', 'c', 'a']);
    } finally {
      tree.destroy();
    }
  });

  it('exposes the unresolved ordering conflict through failed-callback recovery', async () => {
    const tree = make();
    const failure = new Error('callback after interleaved order');
    try {
      await seed(tree);
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.x(8);
          order(tree.$.rows, 'cba');
          foreign(() => order(tree.$.rows, 'bca'));
          order(tree.$.rows, 'acb');
          throw failure;
        });
      } catch (error) {
        thrown = error;
      }
      expect(String(thrown)).toMatch(/ordering conflict/i);
      const recovery = (
        thrown as {
          recovery?: {
            transaction: {
              inspect(): unknown;
              rollback(): void;
              confirm(): void;
            };
            callbackError: unknown;
          };
        }
      ).recovery;
      expect(recovery).toBeDefined();
      expect(recovery!.callbackError).toBe(failure);
      expect(tree.$.rows.ids()).toEqual(['a', 'c', 'b']);
      expect(tree.$.x()).toBe(8);
      expect(() => recovery!.transaction.inspect()).not.toThrow();
      expect(() => recovery!.transaction.rollback()).toThrow(
        /ordering conflict/i
      );
      recovery!.transaction.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('does not record an independent order whose preparation failed before installation', async () => {
    const tree = make();
    const runtime = getMutationCaptureRuntime(tree)!;
    const original = runtime.prepareEntityResponsibility;
    const failure = new Error('foreign order preparation aborted');
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        order(tree.$.rows, 'cba');
        runtime.prepareEntityResponsibility = (capture) => {
          const plan = original?.(capture);
          if (capture.meta?.participation === 'realized') throw failure;
          return plan;
        };
        expect(() =>
          foreign(() =>
            tree.$.rows.setAll(['b', 'c', 'a'].map((id) => ({ id, n: 99 })))
          )
        ).toThrow(failure);
        runtime.prepareEntityResponsibility = original;
        order(tree.$.rows, 'acb');
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(tree.$.rows.byIdOrFail('a').n()).toBe(0);
    } finally {
      runtime.prepareEntityResponsibility = original;
      tree.destroy();
    }
  });

  it('retains pure order-only authority when own endpoints cancel to the original order', async () => {
    const tree = make();
    try {
      await seed(tree);
      const pending = tree.transact(() => {
        order(tree.$.rows, 'cba');
        foreign(() => order(tree.$.rows, 'bca'));
        order(tree.$.rows, 'abc');
      });
      const runtime = peekInternalTransactionRuntime(tree)!;
      expect(runtime.getPendingTurnCount()).toBe(1);
      expect(() => pending.rollback()).toThrow(/ordering conflict/i);
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(runtime.getPendingTurnCount()).toBe(1);
      expect(() => pending.inspect()).not.toThrow();
      pending.confirm();
      expect(runtime.getPendingTurnCount()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
});
