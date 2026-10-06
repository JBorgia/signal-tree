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
import { getOwnedPositionIds } from '../../lib/internals/owned-metadata';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
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
 *   branch brings back only the reversal's own locations; its other members
 *   stay absent and retained storage supplies nothing (slice 8c, which
 *   withdrew 8b's "retained values on re-add").
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

/**
 * The retained slot behind a registered location. No public read exposes it
 * while the location is absent (slice 8d), so the compensation that rollback
 * writes there is read through the slot runtime.
 */
const retained = (tree: { $: unknown }, location: unknown): unknown => {
  const runtime = getTreeScalarSlotRuntime(tree.$);
  const position = getOwnedPositionIds(location)?.[0];
  const slot =
    position === undefined ? undefined : runtime?.resolveScalarSlot(position);
  if (!runtime || slot === undefined) throw new Error('no retained slot');
  const frame = runtime.beginFrame();
  let value: unknown;
  frame.update(slot, (current) => (value = current));
  frame.discard();
  return value;
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
            // The branch's other member is not the turn's location; the
            // ordinary omission still holds for it (slice 8c).
            expect(t.tree.$()).toEqual({
              a: { value: pre(shape) },
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
    "a re-added branch carries only the reversal's locations; retained storage supplies nothing (%s)",
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
      // "DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE"
      // (whole-value-membership.spec.ts 18): `keep` stays absent, as the
      // ordinary omission left it, rather than coming back as 7 (slice 8c).
      expect(tree.$()).toEqual({ a: { value: { min: 0 } }, count: 0 });
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
      expect(tree.$()).toEqual({ a: { b: { value: 0 } }, count: 0 });
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

describe('pending rollback: the rest rolls back, no rolled-back value is retained', () => {
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
            expect(lifecycle?.snapshot().pending).toHaveLength(0);
            if (nested) {
              // Under an omitted branch the location's retained slot is
              // compensated, so a later re-add of the branch cannot bring the
              // rolled-back value back. The branch stays omitted, and a held
              // read of the location is absent (slice 8d).
              expect(retained(t.tree, t.value)).toEqual(pre(shape));
              expect(t.value()).toBeUndefined();
            } else {
              // The omission of the location itself supersedes the pending
              // contribution (a later replacement at the location).
              expect(paths).not.toContain(t.valuePath);
            }
          });
        }
});

describe('rollback compensates a location no later omission covers', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders)) {
    it(`an unrelated omission leaves the pending value to roll back (${order})`, async () => {
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

    it(`a literal dotted sibling key is not covered by its prefix (${order})`, async () => {
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
      // A later ordinary write through a detached handle re-adds the branch
      // with only that location (slice 8d). Undo restores the turn's own
      // before-image of the branch over it (15.4.2).
      a.keep(9);
      await flush();
      expect(tree.$()).toEqual({ a: { keep: 9 }, count: 1 });
      tree.undo();
      expect(tree.$()).toEqual({ a: { value: 0, keep: 0 }, count: 0 });
    });
});

describe('review follow-up: retained state, pending work and entity collections', () => {
  for (const [order, enhancers] of Object.entries(historyOrders).filter(
    ([name]) => name !== 'restoration alone'
  )) {
    it(`a rolled-back contribution does not resurface when its branch is re-added (${order})`, async () => {
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
        tree.$.count(1);
      });
      await flush();
      const pending = tree.transact(() => a.keep(9));
      await flush();
      tree.$({ count: 1 });
      await flush();
      pending.rollback();
      tree.undo();
      expect(tree.$()).toEqual({ a: { value: 0 }, count: 0 });
    });

    it(`re-adding a branch that holds pending work refuses until it settles (${order})`, async () => {
      type State = { a?: { value: number; keep: number }; count: number };
      for (const settle of ['confirm', 'rollback'] as const) {
        const initial: State = { a: { value: 0, keep: 0 }, count: 0 };
        const tree = signalTree(initial, { enhancers: enhancers() });
        trees.push(tree);
        const a = tree.$.a as unknown as {
          value(v?: number): number;
          keep(v?: number): number;
        };
        undoable(() => {
          a.value(1);
          tree.$.count(1);
        });
        await flush();
        const pending = tree.transact(() => a.keep(9));
        await flush();
        tree.$({ count: 1 });
        await flush();
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(/ST1034.*pending/);
        expect(tree.$()).toEqual({ count: 1 });
        expect(tree.getCurrentIndex()).toBe(index);
        pending[settle]();
        tree.undo();
        expect(tree.$()).toEqual({ a: { value: 0 }, count: 0 });
      }
    });

    it(`a member hidden by a pending transaction refuses until it settles (${order})`, async () => {
      type State = { a?: { value: number; keep: number }; count: number };
      for (const settle of ['confirm', 'rollback'] as const) {
        const initial: State = { a: { value: 0, keep: 0 }, count: 0 };
        const tree = signalTree(initial, { enhancers: enhancers() });
        trees.push(tree);
        const a = tree.$.a as unknown as { value(v?: number): number };
        undoable(() => {
          a.value(1);
          tree.$.count(1);
        });
        await flush();
        const pending = tree.transact(() => tree.$({ count: 1 }));
        await flush();
        expect(() => tree.undo()).toThrow(/ST1034.*pending/);
        expect(tree.$()).toEqual({ count: 1 });
        pending[settle]();
        await flush();
        tree.undo();
        // Rolled back, the omission's own before-image returns `keep`; confirmed,
        // the ordinary omission still holds for it.
        expect(tree.$()).toEqual({
          a: settle === 'rollback' ? { value: 0, keep: 0 } : { value: 0 },
          count: 0,
        });
      }
    });
  }

  for (const [order, enhancers] of Object.entries(historyOrders)) {
    type Row = { id: string; n: number };
    const make = () => {
      const tree = signalTree(
        { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
        { enhancers: enhancers() }
      );
      trees.push(tree);
      return tree;
    };
    for (const change of ['update', 'add'] as const) {
      it(`an ordinary omission of a branch holding a collection is reversed through it (${change}, ${order})`, async () => {
        const tree = make();
        const rows = tree.$.g.rows;
        rows.addOne({ id: 'a', n: 0 });
        await flush();
        undoable(() => {
          if (change === 'update') rows.updateOne('a', { n: 1 });
          else rows.addOne({ id: 'b', n: 1 });
          tree.$.count(1);
        });
        await flush();
        tree.$({ count: 1 } as never);
        await flush();
        expect(tree.$()).toEqual({ count: 1 });
        tree.undo();
        expect(tree.$()).toEqual({
          g: { rows: { all: [{ id: 'a', n: 0 }] } },
          count: 0,
        });
        tree.redo();
        expect(
          (tree.$() as { g: { rows: { all: Row[] } } }).g.rows.all
        ).toEqual(
          change === 'update'
            ? [{ id: 'a', n: 1 }]
            : [
                { id: 'a', n: 0 },
                { id: 'b', n: 1 },
              ]
        );
      });

      it(`an external omission of a branch holding a collection refuses, nothing written (${change}, ${order})`, async () => {
        const tree = make();
        const rows = tree.$.g.rows;
        rows.addOne({ id: 'a', n: 0 });
        await flush();
        undoable(() => {
          if (change === 'update') rows.updateOne('a', { n: 1 });
          else rows.addOne({ id: 'b', n: 1 });
          tree.$.count(1);
        });
        await flush();
        external(() => tree.$({ count: 1 } as never));
        await flush();
        const before = rows.all();
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(/ST1034.*'g'/);
        expect(tree.$()).toEqual({ count: 1 });
        expect(rows.all()).toEqual(before);
        expect(tree.getCurrentIndex()).toBe(index);
      });
    }

    it(`a branch holding a collection is re-added for a slot target (${order})`, async () => {
      const tree = make();
      tree.$.g.rows.addOne({ id: 'a', n: 0 });
      await flush();
      undoable(() => tree.$.g.k(1));
      await flush();
      tree.$({ count: 0 } as never);
      await flush();
      tree.undo();
      expect(tree.$()).toEqual({
        g: { rows: { all: [{ id: 'a', n: 0 }] }, k: 0 },
        count: 0,
      });
    });
  }

  for (const [order, enhancers] of Object.entries(historyOrders)) {
    type Row = { id: string; n: number };
    for (const change of ['reorder', 'remove', 'slot and reorder'] as const) {
      const run = async (omission: 'ordinary' | 'external') => {
        const tree = signalTree(
          { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
          { enhancers: enhancers() }
        );
        trees.push(tree);
        const rows = tree.$.g.rows;
        rows.setAll([
          { id: 'a', n: 0 },
          { id: 'b', n: 0 },
        ]);
        await flush();
        undoable(() => {
          if (change === 'remove') rows.removeOne('a');
          else
            rows.setAll([
              { id: 'b', n: 0 },
              { id: 'a', n: 0 },
            ]);
          if (change === 'slot and reorder') tree.$.g.k(1);
          tree.$.count(1);
        });
        await flush();
        const omit = () => tree.$({ count: 1 } as never);
        if (omission === 'external') external(omit);
        else omit();
        await flush();
        return { tree, rows };
      };
      it(`declarative path: an ordinary omission is reversed through the collection (${change}, ${order})`, async () => {
        const { tree, rows } = await run('ordinary');
        tree.undo();
        expect(tree.$()).toEqual({
          g: {
            rows: {
              all: [
                { id: 'a', n: 0 },
                { id: 'b', n: 0 },
              ],
            },
            ...(change === 'slot and reorder' ? { k: 0 } : {}),
          },
          count: 0,
        });
        tree.redo();
        expect(rows.ids()).toEqual(change === 'remove' ? ['b'] : ['b', 'a']);
        expect(tree.$.count()).toBe(1);
      });
      it(`declarative path: an external omission refuses, nothing written (${change}, ${order})`, async () => {
        const { tree, rows } = await run('external');
        const before = rows.ids();
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(/ST1034.*'g'/);
        expect(tree.$()).toEqual({ count: 1 });
        expect(rows.ids()).toEqual(before);
        expect(tree.getCurrentIndex()).toBe(index);
      });
    }
  }

  for (const [order, enhancers] of Object.entries(rollbackOrders)) {
    it(`a later pending omission of the branch keeps an earlier rollback pending, as a later pending write does (${order})`, async () => {
      type State = { a?: { value: number; keep: number }; count: number };
      const initial: State = { a: { value: 0, keep: 0 }, count: 0 };
      const tree = signalTree(initial, { enhancers: enhancers() });
      trees.push(tree);
      const a = tree.$.a as unknown as { value(v?: number): number };
      const earlier = (
        tree as unknown as { transact(fn: () => void): { rollback(): void } }
      ).transact(() => a.value(1));
      await flush();
      const later = (
        tree as unknown as { transact(fn: () => void): { rollback(): void } }
      ).transact(() => tree.$({ count: 0 } as never));
      await flush();
      // The later omission's before-image holds the earlier value; reversing
      // the earlier contribution first would let the later rollback bring it
      // back. Refused, with the earlier transaction still pending.
      expect(() => earlier.rollback()).toThrow(/could not rollback/);
      later.rollback();
      expect(tree.$()).toEqual({ a: { value: 1, keep: 0 }, count: 0 });
      earlier.rollback();
      expect(tree.$()).toEqual({ a: { value: 0, keep: 0 }, count: 0 });
    });
  }
});

describe('refusal messages name the location and the reason (slice 8c)', () => {
  const unmoved = 'Nothing was changed; the history position is unmoved.';
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`external omission of the location itself (${order})`, async () => {
      const t = build('scalar', false, enhancers());
      undoable(() => t.value(1));
      await flush();
      external(t.omit);
      await flush();
      expect(() => t.tree.undo()).toThrow(
        `ST1034: restoration refused — 'value' was omitted by external truth after the operation being reversed; restoring 'value' would overwrite that omission. ${unmoved}`
      );
    });

    it(`external omission of an enclosing branch (${order})`, async () => {
      const t = build('object terminal', true, enhancers());
      undoable(() => t.value({ min: 1 }));
      await flush();
      external(t.omit);
      await flush();
      expect(() => t.tree.undo()).toThrow(
        `ST1034: restoration refused — 'a' was omitted by external truth after the operation being reversed, and 'a.value' lies under it; restoring 'a.value' would overwrite that omission. ${unmoved}`
      );
    });

    for (const change of ['reorder', 'add'] as const)
      it(`a ${change} under an externally omitted branch names the collection (${order})`, async () => {
        type Row = { id: string; n: number };
        const tree = signalTree(
          { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
          { enhancers: enhancers() }
        );
        trees.push(tree);
        const rows = tree.$.g.rows;
        rows.setAll([
          { id: 'a', n: 0 },
          { id: 'b', n: 0 },
        ]);
        await flush();
        undoable(() =>
          change === 'reorder'
            ? rows.setAll([
                { id: 'b', n: 0 },
                { id: 'a', n: 0 },
              ])
            : rows.addOne({ id: 'c', n: 0 })
        );
        await flush();
        external(() => tree.$({ count: 0 } as never));
        await flush();
        let message = '';
        try {
          tree.undo();
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).toMatch(
          /^ST1034: restoration refused — 'g' was omitted by external truth after the operation being reversed, and '(g\.rows[^']*)' lies under it; restoring '\1' would overwrite that omission\. Nothing was changed; the history position is unmoved\.$/
        );
        expect(message).not.toContain('undefined');
      });

    it(`an omitted entity collection cannot be re-added, and says why (${order})`, async () => {
      type Row = { id: string; n: number };
      const tree = signalTree(
        { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
        { enhancers: enhancers() }
      );
      trees.push(tree);
      const rows = tree.$.g.rows;
      rows.addOne({ id: 'a', n: 0 });
      await flush();
      undoable(() => {
        rows.updateOne('a', { n: 1 });
        tree.$.count(1);
      });
      await flush();
      // An ordinary whole-value write to `g` omits the collection itself.
      (tree.$.g as unknown as (value: unknown) => void)({ k: 0 });
      await flush();
      const index = tree.getCurrentIndex();
      let message = '';
      try {
        tree.undo();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(
        /^Unsupported scoped undo effect at 'g\.rows[^']*': (it was omitted|its enclosing member 'g\.rows' was omitted) and cannot be re-added, because it is not a plain state location \(an entity collection, for example\)\. Nothing was changed; the history position is unmoved\.$/
      );
      expect(tree.$()).toEqual({ g: { k: 0 }, count: 1 });
      // Retained, unchanged; the omitted collection reads absent (v16 8e).
      expect(
        (
          rows as unknown as {
            __prepareTransitionTarget: {
              readSource(): { subjects: readonly { value: unknown }[] };
            };
          }
        ).__prepareTransitionTarget
          .readSource()
          .subjects.map(({ value }) => value)
      ).toEqual([{ id: 'a', n: 1 }]);
      expect(rows.byId('a')).toBeUndefined();
      expect(tree.getCurrentIndex()).toBe(index);
    });
  }
});
