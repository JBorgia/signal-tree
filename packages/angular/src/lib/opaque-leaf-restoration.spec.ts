import { computed } from '@angular/core';

import {
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * Registered-terminal reversal through the Angular adapter (v16 integration
 * slice 8b). Mirrors `packages/vue/src/lib/opaque-leaf-restoration.spec.ts`
 * (v15 2892b650, slice 8): an object terminal and a Map terminal undo and
 * redo as whole values, an external `undefined` refuses, and an ordinary
 * omission is re-added by undo (slice 8b). Each result is read through a
 * native `computed`, not only by a direct call.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const orders = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

describe.each(orders)('registered terminals — Angular (%s)', (_, enhancers) => {
  const build = () =>
    signalTree(
      {
        bounds: leaf<{ min: number; max: number } | undefined>({
          min: 0,
          max: 10,
        }),
        lookup: new Map([['a', 1]]),
        count: 0,
      },
      { enhancers: enhancers() }
    );

  it('undo and redo replace an object terminal as one value', async () => {
    const tree = build();
    try {
      const bounds = computed(() => tree.$.bounds());
      expect(bounds()).toEqual({ min: 0, max: 10 });
      undoable(() => tree.$.bounds.set({ min: 1, max: 9 }));
      await flush();
      expect(bounds()).toEqual({ min: 1, max: 9 });
      tree.undo();
      await flush();
      expect(bounds()).toEqual({ min: 0, max: 10 });
      tree.redo();
      await flush();
      expect(bounds()).toEqual({ min: 1, max: 9 });
    } finally {
      tree.destroy();
    }
  });

  it('undo and redo replace a Map terminal as one value', async () => {
    const tree = build();
    try {
      const lookup = computed(() => [...tree.$.lookup()]);
      undoable(() => tree.$.lookup.set(new Map([['a', 2]])));
      await flush();
      expect(lookup()).toEqual([['a', 2]]);
      tree.undo();
      await flush();
      expect(lookup()).toEqual([['a', 1]]);
      tree.redo();
      await flush();
      expect(lookup()).toEqual([['a', 2]]);
    } finally {
      tree.destroy();
    }
  });

  it('external undefined refuses the whole undo and nothing changes', async () => {
    const tree = build();
    try {
      const view = computed(() => [tree.$.bounds(), tree.$.count()]);
      undoable(() => {
        tree.$.bounds.set({ min: 1, max: 9 });
        tree.$.count.set(1);
      });
      await flush();
      external(() => tree.$.bounds.set(undefined));
      await flush();
      expect(() => tree.undo()).toThrow(/ST1034/);
      await flush();
      expect(view()).toEqual([undefined, 1]);
    } finally {
      tree.destroy();
    }
  });

  it('undo re-adds an ordinarily omitted terminal with its pre-image', async () => {
    const tree = build();
    try {
      const snapshot = computed(() => tree.$());
      undoable(() => {
        tree.$.bounds.set({ min: 1, max: 9 });
        tree.$.count.set(1);
      });
      await flush();
      tree.$({ lookup: new Map([['a', 1]]), count: 1 } as never);
      await flush();
      expect(Object.keys(snapshot())).not.toContain('bounds');
      tree.undo();
      await flush();
      expect(snapshot()).toEqual({
        bounds: { min: 0, max: 10 },
        lookup: new Map([['a', 1]]),
        count: 0,
      });
    } finally {
      tree.destroy();
    }
  });
});
