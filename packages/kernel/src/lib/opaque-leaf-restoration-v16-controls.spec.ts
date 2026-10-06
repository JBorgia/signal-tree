import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  entityMap,
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import {
  confirmedTurnReader,
  restorationReader,
  transactionLifecycleReader,
} from '../internals';
import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
import { SignalTreeRollbackError } from './types';

/**
 * v16 controls for integration slice 8 (atomic registered-terminal reversal,
 * donor v15 2892b650). The donor fixtures are `opaque-leaf-restoration.spec.ts`,
 * `undo-nonscalar-leaf.spec.ts` and `conforming-collection-prototype.spec.ts`.
 * These cover the v16-only surfaces around them: pending inspection, recovery
 * handles, the confirmed-turn and restoration readers, queued (undelivered)
 * external truth, jumpTo, nested terminals, and the exact outcome of a pending
 * rollback after an external `undefined` (the donor case admits either
 * outcome).
 *
 * Before the repair a registered terminal holding a plain object was captured
 * as one effect per field at the terminal's own slot (`bounds.min`,
 * `bounds.max`), which no realization path can apply ("structural-drift"), and
 * restoration refused every non-scalar terminal value at admission.
 */

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const orders = {
  'transactions only': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
} as const;
const historyOrders = {
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
} as const;
type Bounds = { min: number; max?: number };
const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

describe('pending inspection reports one change per registered terminal', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it(`whole object replacement is one current change, then superseded by external truth (${order})`, async () => {
      const tree = signalTree(
        { bounds: leaf<Bounds | undefined>({ min: 0, max: 10 }), count: 0 },
        { enhancers: enhancers() }
      );
      trees.push(tree);
      const pending = tree.transact(() => {
        tree.$.bounds({ min: 1, max: 9 });
        tree.$.count(1);
      });
      expect(pending.inspect().changes).toEqual([
        { path: 'bounds', address: ['bounds'], status: 'current' },
        { path: 'count', address: ['count'], status: 'current' },
      ]);
      await flush();
      external(() => tree.$.bounds({ min: 2, max: 8 }));
      await flush();
      expect(pending.inspect().changes).toEqual([
        { path: 'bounds', address: ['bounds'], status: 'superseded' },
        { path: 'count', address: ['count'], status: 'current' },
      ]);
      pending.confirm();
    });
  }
});

describe('automatic compensation and recovery restore the whole terminal', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it(`a throwing callback is compensated atomically with no recovery handle (${order})`, () => {
      const tree = signalTree(
        { bounds: leaf<Bounds>({ min: 0, max: 10 }), count: 0 },
        { enhancers: enhancers() }
      );
      trees.push(tree);
      const lifecycle = transactionLifecycleReader(tree);
      const boom = new Error('boom');
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.bounds({ min: 1, max: 9 });
          tree.$.count(1);
          throw boom;
        });
      } catch (error) {
        thrown = error;
      }
      // Compensation applied: the callback's own error, unchanged, and no
      // retained authority to recover.
      expect(thrown).toBe(boom);
      expect((thrown as { recovery?: unknown }).recovery).toBeUndefined();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
      expect(tree.$.count()).toBe(0);
      expect(lifecycle?.snapshot().pending).toHaveLength(0);
    });

    it(`a refused compensation hands back a recovery whose inspection and rollback address the terminal (${order})`, () => {
      const tree = signalTree(
        { bounds: leaf<Bounds>({ min: 0, max: 10 }), count: 0 },
        { enhancers: enhancers() }
      );
      trees.push(tree);
      const port = getTreeRealizationPort(tree.$) as unknown as {
        validateEffects: (...args: unknown[]) => unknown;
      };
      const spy = vi
        .spyOn(port, 'validateEffects')
        .mockImplementation(() => ({ kind: 'structural-drift' }));
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.bounds({ min: 1, max: 9 });
          tree.$.count(1);
          throw undefined;
        });
      } catch (error) {
        thrown = error;
      } finally {
        spy.mockRestore();
      }
      expect(thrown).toBeInstanceOf(SignalTreeRollbackError);
      const recovery = (
        thrown as {
          recovery?: {
            transaction: {
              inspect(): { changes: readonly unknown[] };
              rollback(): void;
            };
            callbackFailed: boolean;
            callbackError?: unknown;
          };
        }
      ).recovery;
      expect(recovery?.callbackFailed).toBe(true);
      expect(recovery?.callbackError).toBeUndefined();
      expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
      expect(recovery?.transaction.inspect().changes).toEqual([
        { path: 'bounds', address: ['bounds'], status: 'current' },
        { path: 'count', address: ['count'], status: 'current' },
      ]);
      recovery?.transaction.rollback();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
      expect(tree.$.count()).toBe(0);
    });
  }
});

describe('pending rollback after external undefined (exact v16 outcome)', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it.each(['object terminal', 'scalar leaf'] as const)(
      `the later external write supersedes the terminal contribution; rollback completes the rest (%s, ${order})`,
      async (shape) => {
        const tree = signalTree(
          {
            bounds: leaf<Bounds | undefined>({ min: 0 }),
            n: 0 as number | undefined,
            count: 0,
          },
          { enhancers: enhancers() }
        );
        trees.push(tree);
        const lifecycle = transactionLifecycleReader(tree);
        const pending = tree.transact(() => {
          if (shape === 'object terminal') tree.$.bounds({ min: 1 });
          else tree.$.n(1);
          tree.$.count(1);
        });
        await flush();
        external(() =>
          shape === 'object terminal'
            ? tree.$.bounds(undefined)
            : tree.$.n(undefined)
        );
        await flush();
        expect(pending.inspect().changes[0]).toMatchObject({
          path: shape === 'object terminal' ? 'bounds' : 'n',
          status: 'superseded',
        });
        pending.rollback();
        const key = shape === 'object terminal' ? 'bounds' : 'n';
        expect((tree.$() as Record<string, unknown>)[key]).toBeUndefined();
        expect(hasOwn(tree.$(), key)).toBe(true);
        expect(tree.$.count()).toBe(0);
        expect(lifecycle?.snapshot().pending).toHaveLength(0);
      }
    );
  }
});

describe('registered container terminals stay atomic through transactions', () => {
  const cases = [
    ['array', [1], [1, 2]],
    ['Date', new Date(1), new Date(2)],
    ['Map', new Map([['a', 1]]), new Map([['a', 2]])],
    ['Set', new Set(['a']), new Set(['a', 'b'])],
    ['plain object', { a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 }, d: 4 }],
  ] as const;
  for (const [order, enhancers] of Object.entries(orders)) {
    it.each(cases)(
      `%s replacement rolls back as one value (${order})`,
      (_label, initial, next) => {
        const tree = signalTree(
          { value: leaf<unknown>(initial) },
          { enhancers: enhancers() }
        );
        trees.push(tree);
        const pending = tree.transact(() => tree.$.value(next));
        expect(pending.inspect().changes).toEqual([
          { path: 'value', address: ['value'], status: 'current' },
        ]);
        pending.rollback();
        expect(tree.$.value()).toEqual(initial);
      }
    );
  }
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it.each(cases)(
      `confirmed %s replacement undoes and redoes as one value (${order})`,
      async (_label, initial, next) => {
        const tree = signalTree(
          { value: leaf<unknown>(initial), count: 0 },
          { enhancers: enhancers() }
        );
        trees.push(tree);
        const pending = undoable(() =>
          tree.transact(() => {
            tree.$.value(next);
            tree.$.count(1);
          })
        );
        pending.confirm();
        await flush();
        tree.undo();
        expect(tree.$.value()).toEqual(initial);
        expect(tree.$.count()).toBe(0);
        tree.redo();
        expect(tree.$.value()).toEqual(next);
        expect(tree.$.count()).toBe(1);
      }
    );
  }
});

describe('external undefined is terminal truth whether queued or delivered', () => {
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    for (const delivered of [false, true]) {
      for (const operation of ['undo', 'redo'] as const) {
        it.each(['object terminal', 'scalar leaf'] as const)(
          `${operation} refuses atomically (%s, ${
            delivered ? 'delivered' : 'still queued'
          }, ${order})`,
          async (shape) => {
            const tree = signalTree(
              {
                bounds: leaf<Bounds | undefined>({ min: 0 }),
                n: 0 as number | undefined,
                count: 0,
              },
              { enhancers: enhancers() }
            );
            trees.push(tree);
            const write = (value: 'first' | 'external') =>
              shape === 'object terminal'
                ? tree.$.bounds(value === 'first' ? { min: 1 } : undefined)
                : tree.$.n(value === 'first' ? 1 : undefined);
            const key = shape === 'object terminal' ? 'bounds' : 'n';
            undoable(() => {
              write('first');
              tree.$.count(1);
            });
            await flush();
            if (operation === 'redo') {
              tree.undo();
              await flush();
              expect(tree.$.count()).toBe(0);
            }
            external(() => write('external'));
            if (delivered) await flush();
            const index = tree.getCurrentIndex();
            expect(() => tree[operation]()).toThrow(/ST1034/);
            expect((tree.$() as Record<string, unknown>)[key]).toBeUndefined();
            expect(hasOwn(tree.$(), key)).toBe(true);
            expect(tree.$.count()).toBe(operation === 'undo' ? 1 : 0);
            expect(tree.getCurrentIndex()).toBe(index);
            expect(tree.canRedo()).toBe(operation === 'redo');
          }
        );
      }
    }
  }

  it('an authored write releases the terminal from external truth', async () => {
    const tree = signalTree(
      { bounds: leaf<Bounds | undefined>({ min: 0 }), count: 0 },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => {
      tree.$.bounds({ min: 1 });
      tree.$.count(1);
    });
    await flush();
    external(() => tree.$.bounds(undefined));
    await flush();
    tree.$.bounds(undefined);
    tree.$.bounds({ min: 1 });
    await flush();
    tree.undo();
    expect(tree.$.bounds()).toEqual({ min: 0 });
    expect(tree.$.count()).toBe(0);
  });
});

describe('restoration around registered terminals', () => {
  it('jumpTo moves an object terminal as one value and refuses external undefined atomically', async () => {
    const tree = signalTree(
      { bounds: leaf<Bounds | undefined>({ min: 0 }) },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.bounds({ min: 1, max: 5 }));
    await flush();
    undoable(() => tree.$.bounds({ min: 2 }));
    await flush();
    tree.jumpTo(0);
    expect(tree.getCurrentIndex()).toBe(0);
    expect(tree.$.bounds()).toEqual({ min: 1, max: 5 });
    external(() => tree.$.bounds(undefined));
    await flush();
    expect(() => tree.jumpTo(1)).toThrow(/ST1034/);
    expect(tree.$.bounds()).toBeUndefined();
    expect(tree.getCurrentIndex()).toBe(0);
  });

  it('a terminal nested in a plain branch restores atomically; branch siblings stay independent', async () => {
    const tree = signalTree(
      {
        settings: { bounds: leaf<Bounds>({ min: 0, max: 10 }), label: 'a' },
      },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.settings.bounds({ min: 1 }));
    await flush();
    tree.$.settings.label('b');
    await flush();
    tree.undo();
    expect(tree.$.settings()).toEqual({
      bounds: { min: 0, max: 10 },
      label: 'b',
    });
    tree.redo();
    expect(tree.$.settings()).toEqual({ bounds: { min: 1 }, label: 'b' });
  });

  it('the donor structural-drift refusal comes from the collection, not the terminal', async () => {
    const tree = signalTree(
      {
        bounds: leaf({ min: 0, max: 10 }),
        rows: entityMap<{ id: number }, number>(),
      },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    tree.$.rows.addOne({ id: 1 });
    await flush();
    undoable(() => {
      tree.$.bounds({ min: 1, max: 9 });
      tree.$.rows.changeId(1, 2);
    });
    await flush();
    // Same turn, no external rekey: nothing drifts, so the undo applies.
    tree.undo();
    expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
    expect(tree.$.rows.ids()).toEqual([1]);
  });

  it.each(Object.keys(historyOrders))(
    'readers see one terminal effect; entity rows still decompose by field (%s)',
    async (order) => {
      const tree = signalTree(
        {
          bounds: leaf<Bounds>({ min: 0, max: 10 }),
          rows: entityMap<
            { id: number; name: string; meta: { a: number } },
            number
          >(),
        },
        {
          // Confirmed turns are diagnostic evidence: opt in to retaining them.
          enhancers:
            order === 'transactions first'
              ? [transactions({ history: { retain: 2 } }), restoration()]
              : [restoration(), transactions({ history: { retain: 2 } })],
        }
      );
      trees.push(tree);
      tree.$.rows.addOne({ id: 1, name: 'Ada', meta: { a: 1 } });
      await flush();
      const confirmed = confirmedTurnReader(tree);
      const history = restorationReader(tree);
      const pending = undoable(() =>
        tree.transact(() => {
          tree.$.bounds({ min: 1, max: 9 });
          tree.$.rows.updateOne(1, { name: 'Grace', meta: { a: 2 } });
        })
      );
      pending.confirm();
      await flush();
      const effects = confirmed!.readConfirmedTurns().turns.at(-1)!.effects;
      const terminal = effects.filter((effect) =>
        effect.path.startsWith('bounds')
      );
      expect(terminal).toHaveLength(1);
      expect(terminal[0]).toMatchObject({ path: 'bounds' });
      expect(terminal[0].fieldSegments).toBeUndefined();
      // Entity rows keep v16's producer-known field coordinates (slice 1).
      const row = effects.filter((effect) => effect.subjectId !== undefined);
      expect(row.map((effect) => effect.fieldSegments)).toEqual([
        ['name'],
        ['meta'],
      ]);
      const [entry] = history!.snapshot().entries.slice(-1);
      tree.undo();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
      expect(tree.$.rows.byId(1)?.()).toEqual({
        id: 1,
        name: 'Ada',
        meta: { a: 1 },
      });
      expect(history!.snapshot().entries.slice(-1)[0]).toMatchObject({
        entryId: entry.entryId,
        status: 'unapplied',
      });
      tree.redo();
      expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
      expect(history!.snapshot().entries.slice(-1)[0].status).toBe('applied');
    }
  );
});
