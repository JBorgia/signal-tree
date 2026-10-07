import { afterEach, describe, expect, it, vi } from 'vitest';

import { entityMap, restoration, signalTree, undoable } from '../../index';
import * as transitions from '../../lib/internals/causal-runtime/target-transition';

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
type Row = { id: number; n: number };
const make = () => {
  const tree = signalTree(
    {
      g: { rows: entityMap<Row, number>() },
      count: 0,
      stable: { label: 'kept' },
    },
    { enhancers: [restoration()] }
  );
  trees.push(tree);
  return tree;
};

// Count indexed reads of the target's subject array while history assembles
// its output. Stop counting that target when the next derivation starts:
// copying/validating its source is different work, owned by the target builder.
// This checks useful linear work, not a specific Map implementation or timing.
function countAssemblyReads() {
  const counts: Array<{
    size: number;
    reads: number;
    active: boolean;
    endpoint: 'before' | 'after' | undefined;
  }> = [];
  const derive = transitions.deriveDeclarativeTransitionTarget;
  vi.spyOn(transitions, 'deriveDeclarativeTransitionTarget').mockImplementation(
    (options) => {
      for (const count of counts) count.active = false;
      const target = derive(options);
      return {
        ...target,
        collections: new Map(
          [...target.collections].map(([owner, collection]) => {
            const count = {
              size: collection.subjects.length,
              reads: 0,
              active: true,
              endpoint: options.orderEndpoint,
            };
            counts.push(count);
            return [
              owner,
              {
                ...collection,
                subjects: new Proxy(collection.subjects, {
                  get(array, key, receiver) {
                    if (
                      count.active &&
                      typeof key === 'string' &&
                      /^(0|[1-9]\d*)$/.test(key)
                    )
                      count.reads++;
                    return Reflect.get(array, key, receiver);
                  },
                }),
              },
            ];
          })
        ),
      };
    }
  );
  return counts;
}

describe('history materialization local lookup work', () => {
  for (const undone of [false, true]) {
    it.each([8, 16, 32])(
      `assembles %i rows with linear subject reads (undone=${undone})`,
      async (size) => {
        const tree = make();
        const initial = Array.from({ length: size }, (_, id) => ({ id, n: 0 }));
        tree.$.g.rows.setAll(initial);
        await flush();
        undoable(() => tree.$.count(1));
        await flush();
        const changed = initial
          .map((row) => ({ ...row, n: row.id + 1 }))
          .reverse();
        undoable(() => tree.$.g.rows.setAll(changed));
        await flush();
        if (undone) tree.undo();
        const before = tree.$();
        const counts = countAssemblyReads();
        const history = tree.getRestorationHistory();
        // Output and live-state checks make a skipped reconstruction fail too.
        expect(history.map(({ state }) => state?.g.rows)).toMatchObject([
          { all: initial },
          { all: changed },
        ]);
        expect(tree.$()).toEqual(before);
        expect(counts.length).toBeGreaterThan(0);
        expect(counts.some(({ endpoint }) => endpoint === 'after')).toBe(
          undone
        );
        for (const count of counts) {
          expect(count.size).toBe(size);
          expect(count.reads).toBeGreaterThan(0);
          expect(count.reads).toBeLessThanOrEqual(size);
        }
      }
    );
  }

  it('reads each current collection source once per history read', async () => {
    const tree = make();
    tree.$.g.rows.setAll([{ id: 1, n: 0 }]);
    await flush();
    undoable(() => tree.$.count(1));
    await flush();
    const binding = (
      tree.$.g.rows as unknown as {
        __prepareTransitionTarget: transitions.CollectionTransitionTargetBinding;
      }
    ).__prepareTransitionTarget;
    const read = vi.spyOn(binding, 'readSource');
    expect(tree.getRestorationHistory()[0].state?.g.rows).toMatchObject({
      all: [{ id: 1, n: 0 }],
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'keeps the missing-subject error (undone=%s)',
    async (undone) => {
      const tree = make();
      tree.$.g.rows.setAll([{ id: 1, n: 0 }]);
      await flush();
      undoable(() => tree.$.g.rows.updateOne(1, { n: 1 }));
      await flush();
      if (undone) tree.undo();
      const before = tree.$();
      const derive = transitions.deriveDeclarativeTransitionTarget;
      let injected = 0;
      vi.spyOn(
        transitions,
        'deriveDeclarativeTransitionTarget'
      ).mockImplementation((options) => {
        const target = derive(options);
        return {
          ...target,
          collections: new Map(
            [...target.collections].map(([owner, collection]) => {
              injected++;
              return [
                owner,
                { ...collection, order: [...collection.order, -1] },
              ];
            })
          ),
        };
      });
      expect(() => tree.getRestorationHistory()).toThrow(
        'Historical materialization lost subject -1'
      );
      expect(injected).toBeGreaterThan(0);
      expect(tree.$()).toEqual(before);
    }
  );

  it('reconstructs hidden rows and leaves previously returned snapshots unchanged', async () => {
    const tree = make();
    const initial = [
      { id: 1, n: 0 },
      { id: 2, n: 0 },
    ];
    const changed = [
      { id: 2, n: 0 },
      { id: 1, n: 1 },
    ];
    tree.$.g.rows.setAll(initial);
    await flush();
    undoable(() => tree.$.count(1));
    await flush();
    undoable(() => tree.$.g.rows.setAll(changed));
    await flush();
    const history = tree.getRestorationHistory();
    const first = history[0].state;
    const last = history[1].state;
    expect(first?.g.rows).toMatchObject({ all: initial });
    expect(last?.g.rows).toMatchObject({ all: changed });
    expect(first?.stable).toBe(last?.stable);
    tree.$({ count: 1, stable: { label: 'kept' } } as never);
    await flush();
    expect(tree.$()).toEqual({ count: 1, stable: { label: 'kept' } });
    const hiddenHistory = tree.getRestorationHistory();
    expect(hiddenHistory.map(({ state }) => state?.g.rows)).toMatchObject([
      { all: initial },
      { all: changed },
    ]);
    expect(history[0].state).toBe(first);
    expect(history[1].state).toBe(last);
    expect(first?.g.rows).toMatchObject({ all: initial });
    expect(last?.g.rows).toMatchObject({ all: changed });
    const again = tree.getRestorationHistory();
    expect(again).toEqual(hiddenHistory);
    expect(again[0]).not.toBe(hiddenHistory[0]);
    expect(tree.$()).toEqual({ count: 1, stable: { label: 'kept' } });
  });
});
