import { afterEach, describe, expect, it } from 'vitest';
import {
  entityMap,
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';
import { restorationReader, transactionLifecycleReader } from '../../internals';
import { getPathNotifier } from '../../lib/path-notifier';

/**
 * v16 integration slice 8b: reversal of a registered location that an
 * omission has hidden — the location itself or a plain branch above it.
 *
 * Before 8b, undo/redo/jumpTo (and rollback, under an omitted ancestor)
 * wrote the retained slot and reported success while nothing could read the
 * value. Owner decisions (2026-10-05):
 *
 * - External omission keeps external truth's protection: undo, redo and
 *   jumpTo refuse with ST1034 and write nothing.
 * - An ordinary (non-designated) authored omission is reversed like a later
 *   ordinary write at the location (15.4.2, `external-authored-baseline`
 *   "keeps the baseline of an already recorded earlier authored turn"): the
 *   hidden member is re-added with the reversal's target. Re-adding a hidden
 *   branch keeps its other members' retained values (what they held when the
 *   branch was omitted) and leaves its hidden members absent.
 * - Pending rollback never overwrites a later write. A later membership
 *   change of the location or an enclosing member supersedes the pending
 *   contribution, as a later replacement does; the rest rolls back and the
 *   hidden slot is not written.
 *
 * Scalars and object terminals follow the same rules.
 */

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const historyOrders = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const shapes = {
  scalar: { initial: () => 0 as unknown, next: 1 as unknown },
  'object terminal': {
    initial: () => leaf<unknown>({ min: 0 }),
    next: { min: 1 } as unknown,
  },
};
const pre = (shape: keyof typeof shapes) =>
  shape === 'scalar' ? 0 : { min: 0 };

type Handle = (value?: unknown) => unknown;
type HistoryTree = {
  $: Handle & Record<string, unknown>;
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  canRedo(): boolean;
  destroy(): void;
};

/** Paths notified while `run` executes and its notifications are delivered. */
const notified = async (run: () => void): Promise<string[]> => {
  const paths: string[] = [];
  const off = getPathNotifier().subscribe('**', (_v, _p, path) => {
    paths.push(path);
  });
  try {
    run();
    await flush();
  } finally {
    off();
  }
  return paths;
};

function build(
  shape: keyof typeof shapes,
  nested: boolean,
  enhancers: unknown[]
) {
  const state = nested
    ? { a: { value: shapes[shape].initial(), keep: 0 }, count: 0 }
    : { value: shapes[shape].initial(), count: 0 };
  const tree = signalTree(state as never, {
    enhancers: enhancers as never,
  }) as unknown as HistoryTree;
  trees.push(tree);
  const holder = (nested ? tree.$['a'] : tree.$) as Record<string, Handle>;
  const count = tree.$['count'] as Handle;
  const omit = () => tree.$({ count: count() } as never);
  const valuePath = nested ? 'a.value' : 'value';
  const hiddenPath = nested ? 'a' : 'value';
  const current = (): unknown => {
    const snapshot = tree.$() as Record<string, unknown>;
    return nested
      ? (snapshot['a'] as Record<string, unknown> | undefined)?.['value']
      : snapshot['value'];
  };
  return {
    tree,
    value: holder['value'],
    count,
    omit,
    valuePath,
    hiddenPath,
    current,
  };
}

describe('ordinary authored omission: the hidden member is re-added', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const shape of Object.keys(shapes) as (keyof typeof shapes)[])
      for (const nested of [false, true]) {
        const label = `${shape}, ${
          nested ? 'omitted branch' : 'omitted itself'
        }, ${order}`;

        it(`undo re-adds with the pre-image; redo and undo stay symmetric (${label})`, async () => {
          const t = build(shape, nested, enhancers());
          undoable(() => {
            t.value(shapes[shape].next);
            t.count(1);
          });
          await flush();
          t.omit();
          await flush();
          expect(t.current()).toBeUndefined();
          t.tree.undo();
          expect(t.current()).toEqual(pre(shape));
          expect(t.value()).toEqual(pre(shape));
          expect(t.count()).toBe(0);
          if (nested)
            expect(t.tree.$()).toEqual({
              a: { value: pre(shape), keep: 0 },
              count: 0,
            });
          t.tree.redo();
          expect(t.current()).toEqual(shapes[shape].next);
          expect(t.count()).toBe(1);
          t.tree.undo();
          expect(t.current()).toEqual(pre(shape));
        });

        it(`redo after the omission re-adds with the after-image (${label})`, async () => {
          const t = build(shape, nested, enhancers());
          undoable(() => {
            t.value(shapes[shape].next);
            t.count(1);
          });
          await flush();
          t.tree.undo();
          await flush();
          t.omit();
          await flush();
          expect(t.current()).toBeUndefined();
          t.tree.redo();
          expect(t.current()).toEqual(shapes[shape].next);
          expect(t.count()).toBe(1);
        });

        it(`jumpTo re-adds the hidden member (${label})`, async () => {
          const t = build(shape, nested, enhancers());
          undoable(() => t.count(5));
          await flush();
          undoable(() => t.value(shapes[shape].next));
          await flush();
          t.omit();
          await flush();
          t.tree.jumpTo(0);
          expect(t.tree.getCurrentIndex()).toBe(0);
          expect(t.current()).toEqual(pre(shape));
          expect(t.count()).toBe(5);
        });
      }

  it.each(Object.keys(historyOrders))(
    'a re-added branch keeps its other members as they were when omitted (%s)',
    async (order) => {
      const tree = signalTree(
        { a: { value: leaf({ min: 0 }), keep: 0 }, count: 0 },
        {
          enhancers: historyOrders[order as keyof typeof historyOrders](),
        }
      );
      trees.push(tree);
      undoable(() => {
        tree.$.a.value({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      tree.$.a.keep(7);
      await flush();
      tree.$({ count: 1 } as never);
      await flush();
      tree.undo();
      expect(tree.$()).toEqual({ a: { value: { min: 0 }, keep: 7 }, count: 0 });
    }
  );

  it.each(Object.keys(historyOrders))(
    'hidden members on the way are re-added; other hidden members stay absent (%s)',
    async (order) => {
      type State = {
        a: {
          b?: { value: number; other?: number };
          keep?: number;
          gone?: number;
        };
        count: number;
      };
      const initial: State = {
        a: { b: { value: 0, other: 0 }, keep: 0, gone: 0 },
        count: 0,
      };
      const tree = signalTree(initial, {
        enhancers: historyOrders[order as keyof typeof historyOrders](),
      });
      trees.push(tree);
      // An optional plain member is typed as a location; it is a branch.
      const b = tree.$.a.b as unknown as { value(v?: number): number };
      undoable(() => {
        b.value(1);
        tree.$.count(1);
      });
      await flush();
      tree.$.a({ b: { value: 1 }, keep: 0 });
      tree.$.a({ keep: 0 });
      tree.$({ count: 1 } as never);
      await flush();
      expect(tree.$()).toEqual({ count: 1 });
      tree.undo();
      expect(tree.$()).toEqual({ a: { b: { value: 0 }, keep: 0 }, count: 0 });
    }
  );

  it('a turn that reorders a collection takes the declarative path and re-adds too', async () => {
    const tree = signalTree(
      {
        value: leaf<unknown>({ min: 0 }),
        rows: entityMap<{ id: string }, string>(),
        count: 0,
      },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    tree.$.rows.setAll([{ id: 'a' }, { id: 'b' }]);
    await flush();
    undoable(() => {
      tree.$.value({ min: 1 });
      tree.$.rows.setAll([{ id: 'b' }, { id: 'a' }]);
    });
    await flush();
    tree.$({ rows: undefined, count: 0 } as never);
    await flush();
    expect(Object.keys(tree.$())).not.toContain('value');
    tree.undo();
    expect(tree.$.value()).toEqual({ min: 0 });
    expect(Object.keys(tree.$())).toContain('value');
    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
    tree.redo();
    expect(tree.$.value()).toEqual({ min: 1 });
    expect(tree.$.rows.ids()).toEqual(['b', 'a']);
  });
});

describe('external omission: refused, nothing written', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const shape of Object.keys(shapes) as (keyof typeof shapes)[])
      for (const nested of [false, true])
        for (const operation of ['undo', 'redo', 'jumpTo'] as const) {
          it(`${operation} (${shape}, ${
            nested ? 'omitted branch' : 'omitted itself'
          }, ${order})`, async () => {
            const t = build(shape, nested, enhancers());
            if (operation === 'jumpTo') {
              undoable(() => t.count(5));
              await flush();
            }
            undoable(() => {
              t.value(shapes[shape].next);
              if (operation !== 'jumpTo') t.count(1);
            });
            await flush();
            if (operation === 'redo') {
              t.tree.undo();
              await flush();
            }
            external(t.omit);
            await flush();
            const before = t.tree.$();
            const index = t.tree.getCurrentIndex();
            const canRedo = t.tree.canRedo();
            let paths: string[] = [];
            paths = await notified(() => {
              expect(() =>
                operation === 'jumpTo' ? t.tree.jumpTo(0) : t.tree[operation]()
              ).toThrow(new RegExp(`ST1034.*'${t.hiddenPath}'`));
            });
            expect(t.tree.$()).toEqual(before);
            expect(t.tree.getCurrentIndex()).toBe(index);
            expect(t.tree.canRedo()).toBe(canRedo);
            expect(paths).toEqual([]);
          });
        }

  it.each(Object.keys(historyOrders))(
    'an external omission above an authored one still refuses (%s)',
    async (order) => {
      type State = {
        a: { b?: { value: number }; keep: number };
        count: number;
      };
      const initial: State = { a: { b: { value: 0 }, keep: 0 }, count: 0 };
      const tree = signalTree(initial, {
        enhancers: historyOrders[order as keyof typeof historyOrders](),
      });
      trees.push(tree);
      // An optional plain member is typed as a location; it is a branch.
      const b = tree.$.a.b as unknown as { value(v?: number): number };
      undoable(() => {
        b.value(1);
        tree.$.count(1);
      });
      await flush();
      tree.$.a({ keep: 0 });
      external(() => tree.$({ count: 1 } as never));
      await flush();
      expect(() => tree.undo()).toThrow(/ST1034.*'a'/);
      expect(tree.$()).toEqual({ count: 1 });
    }
  );

  it('the refusal is reported as refused by the restoration reader', async () => {
    const t = build('object terminal', true, [restoration()]);
    const reader = restorationReader(
      t.tree as unknown as Parameters<typeof restorationReader>[0]
    )!;
    undoable(() => t.value({ min: 1 }));
    await flush();
    external(t.omit);
    await flush();
    const events: unknown[] = [];
    reader.subscribe((event) => events.push(event));
    expect(() => t.tree.undo()).toThrow(/ST1034/);
    expect(events.at(-1)).toMatchObject({
      kind: 'operation',
      operation: 'undo',
      outcome: 'refused',
      affectedEntryIds: [],
    });
  });
});

describe('pending rollback: a later omission supersedes, nothing hidden is written', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    for (const shape of Object.keys(shapes) as (keyof typeof shapes)[])
      for (const nested of [false, true])
        for (const omission of ['ordinary', 'external'] as const) {
          it(`${omission} omission (${shape}, ${
            nested ? 'omitted branch' : 'omitted itself'
          }, ${order})`, async () => {
            const t = build(shape, nested, enhancers());
            const lifecycle = transactionLifecycleReader(
              t.tree as unknown as Parameters<
                typeof transactionLifecycleReader
              >[0]
            );
            const pending = (
              t.tree as unknown as {
                transact(fn: () => void): { rollback(): void };
              }
            ).transact(() => {
              t.value(shapes[shape].next);
              t.count(1);
            });
            await flush();
            if (omission === 'external') external(t.omit);
            else t.omit();
            await flush();
            const paths = await notified(() => pending.rollback());
            expect(t.tree.$()).toEqual({ count: 0 });
            expect(paths).not.toContain(t.valuePath);
            expect(lifecycle?.snapshot().pending).toHaveLength(0);
          });
        }
});

describe('only an enclosing member supersedes (structured addresses)', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders)) {
    it(`an unrelated omission does not supersede the pending value (${order})`, async () => {
      type State = { value: unknown; other?: number; count: number };
      const initial: State = {
        value: leaf<unknown>({ min: 0 }),
        other: 0,
        count: 0,
      };
      const tree = signalTree(initial, { enhancers: enhancers() });
      trees.push(tree);
      const pending = (
        tree as unknown as { transact(fn: () => void): { rollback(): void } }
      ).transact(() => {
        tree.$.value({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      tree.$({ value: { min: 1 }, count: 1 } as never);
      await flush();
      pending.rollback();
      expect(tree.$()).toEqual({ value: { min: 0 }, count: 0 });
    });

    it(`a literal dotted sibling key is not enclosed by its prefix (${order})`, async () => {
      type State = {
        a?: { b: number };
        'a.b': unknown;
        count: number;
      };
      const initial: State = {
        a: { b: 0 },
        'a.b': leaf<unknown>({ min: 0 }),
        count: 0,
      };
      const tree = signalTree(initial, { enhancers: enhancers() });
      trees.push(tree);
      const dotted = tree.$['a.b'] as unknown as (value?: unknown) => unknown;
      const pending = (
        tree as unknown as { transact(fn: () => void): { rollback(): void } }
      ).transact(() => {
        dotted({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      tree.$({ 'a.b': { min: 1 }, count: 1 } as never);
      await flush();
      pending.rollback();
      expect(tree.$()).toEqual({ 'a.b': { min: 0 }, count: 0 });
    });
  }
});

describe("the reversal's own membership effect wins over retained values", () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`a turn that wrote then omitted a branch restores its own before-image (${order})`, async () => {
      type State = { a?: { value: number; keep: number }; count: number };
      const initial: State = { a: { value: 0, keep: 0 }, count: 0 };
      const tree = signalTree(initial, { enhancers: enhancers() });
      trees.push(tree);
      const a = tree.$.a as unknown as {
        value(v?: number): number;
        keep(v?: number): number;
      };
      undoable(() => {
        a.value(1);
        tree.$({ count: 1 });
      });
      await flush();
      // A later ordinary write through a detached handle lands in the hidden
      // branch's retained slot; the branch stays omitted.
      a.keep(9);
      await flush();
      expect(tree.$()).toEqual({ count: 1 });
      tree.undo();
      expect(tree.$()).toEqual({ a: { value: 0, keep: 0 }, count: 0 });
    });
});
