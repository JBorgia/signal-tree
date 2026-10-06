import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * An observed `addMany` row's structural effect is not retained by the
 * collection.
 *
 * Each fresh row's `add` effect carries a deep clone of the row. 005399a7 kept
 * every one of them in a closure array (`appendedAdds`) so `prependMany` could
 * re-anchor its rows at the front — but only `prependMany` emptied it, so
 * every `addMany` of an observed tree (transactions or restoration) retained
 * one clone per added row for the life of the collection: measured 12.4 MB
 * retained after 300 adds of 20 KB rows and their removal, against 6.4 MB on
 * the base.
 *
 * Two kinds of arm, because one would not discriminate:
 *
 * ```text
 * a pending transaction holds the effect   clone must LIVE -> the WeakRef is
 *                                                            the effect's clone
 * nothing else holds it                    clone must DIE  -> the collection
 *                                                            holds none
 * ```
 *
 * Requires `--expose-gc` (vitest.retention.config.ts). Without the flag this
 * FAILS rather than skipping: a skipped retention test reads as evidence.
 */

type Row = { id: string; n: number; big?: string };

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  for (let pass = 0; pass < 6; pass++) gc?.();
};

const applyPressure = async () => {
  for (let round = 0; round < 4; round++) {
    collect();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  let ballast: object[] = [];
  for (let index = 0; index < 200_000; index++) ballast.push({ index });
  ballast = [];
  collect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  collect();
};

const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

/**
 * Adds row `k` through `addMany` and keeps only a WeakRef to the clone its
 * published `add` effect carries.
 */
const captureAdd = async (
  tree: Tree,
  add: (run: () => void) => void = (run) => run()
): Promise<WeakRef<object>> => {
  const refs: WeakRef<object>[] = [];
  const unsubscribe = getPathNotifier().subscribe(
    'rows.*',
    (_value, _prev, path, _ownerPath, _origin, _subjects, _positions, meta) => {
      const effect = (
        meta as { structuralEffect?: { kind: string; value?: object } }
      )?.structuralEffect;
      if (path === 'rows.k' && effect?.kind === 'add' && effect.value) {
        refs.push(new WeakRef(effect.value));
      }
    }
  );
  try {
    add(() => {
      tree.$.rows.addMany([{ id: 'k', n: 1, big: 'x'.repeat(20_000) }]);
    });
    await flush();
  } finally {
    unsubscribe();
  }
  expect(refs).toHaveLength(1);
  return refs[0];
};

describe('addMany add-effect retention', () => {
  it('runs with a real collector', () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  });

  it('control: a pending transaction holds the effect, so the clone lives', async () => {
    const tree = make([transactions()]);
    try {
      const ref = await captureAdd(tree, (run) => {
        tree.transaction(run);
      });
      await applyPressure();
      expect(ref.deref()).toBeDefined();
    } finally {
      tree.destroy();
    }
  });

  it.each([
    ['transactions()', () => [transactions()]],
    [
      'restoration({ maxHistorySize: 0 })',
      () => [restoration({ maxHistorySize: 0 })],
    ],
    [
      'transactions(), restoration({ maxHistorySize: 0 })',
      () => [transactions(), restoration({ maxHistorySize: 0 })],
    ],
    [
      'restoration({ maxHistorySize: 0 }), transactions()',
      () => [restoration({ maxHistorySize: 0 }), transactions()],
    ],
  ] as const)(
    '%s: a removed row leaves no clone behind in the live tree',
    async (_name, enhancers) => {
      const tree = make(enhancers());
      try {
        const ref = await captureAdd(tree);
        tree.$.rows.removeOne('k');
        await flush();
        await applyPressure();
        // The tree is still alive and still observed: the collection itself
        // must not be what keeps the clone.
        expect(tree.$.rows.count()).toBe(0);
        expect(ref.deref()).toBeUndefined();
      } finally {
        tree.destroy();
      }
    }
  );
});
