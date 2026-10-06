import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import {
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { restorationReader } from '@signal-tree/kernel/internals';

/**
 * v16 controls beside the carried `opaque-leaf-restoration.spec.ts` (slice 8b):
 * a Map terminal, an ordinary omission re-added by undo, and an external
 * omission refused and reported as refused, each read through a Vue
 * `computed`. Angular, React and Solid have the same terminal-reversal spec.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const orders = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

describe.each(orders)('registered terminals — Vue (%s)', (_, enhancers) => {
  const build = () =>
    signalTree(
      {
        bounds: leaf({ min: 0, max: 10 }),
        lookup: new Map([['a', 1]]),
        count: 0,
      },
      { enhancers: enhancers() }
    );

  it('undo and redo replace a Map terminal as one value', async () => {
    const tree = build();
    try {
      const lookup = computed(() => [...tree.$.lookup.value]);
      undoable(() => (tree.$.lookup.value = new Map([['a', 2]])));
      await flush();
      expect(lookup.value).toEqual([['a', 2]]);
      tree.undo();
      await flush();
      expect(lookup.value).toEqual([['a', 1]]);
      tree.redo();
      await flush();
      expect(lookup.value).toEqual([['a', 2]]);
    } finally {
      tree.destroy();
    }
  });

  it('undo re-adds an ordinarily omitted terminal with its pre-image', async () => {
    const tree = build();
    try {
      const keys = computed(() => Object.keys(tree.$()));
      undoable(() => {
        tree.$.bounds.value = { min: 1, max: 9 };
        tree.$.count.value = 1;
      });
      await flush();
      tree.$({ lookup: new Map([['a', 1]]), count: 1 } as never);
      await flush();
      expect(keys.value).toEqual(['lookup', 'count']);
      tree.undo();
      await flush();
      expect(keys.value).toEqual(['bounds', 'lookup', 'count']);
      expect(tree.$.bounds.value).toEqual({ min: 0, max: 10 });
    } finally {
      tree.destroy();
    }
  });

  it('an external omission refuses undo and the reader reports it refused', async () => {
    const tree = build();
    try {
      const reader = restorationReader(tree);
      if (!reader) throw new Error('Expected the restoration reader');
      const keys = computed(() => Object.keys(tree.$()));
      undoable(() => {
        tree.$.bounds.value = { min: 1, max: 9 };
        tree.$.count.value = 1;
      });
      await flush();
      external(() =>
        tree.$({ lookup: new Map([['a', 1]]), count: 1 } as never)
      );
      await flush();
      const events: unknown[] = [];
      reader.subscribe((event) => events.push(event));
      expect(() => tree.undo()).toThrow(/ST1034/);
      await flush();
      expect(keys.value).toEqual(['lookup', 'count']);
      expect(events.at(-1)).toMatchObject({
        kind: 'operation',
        operation: 'undo',
        outcome: 'refused',
      });
    } finally {
      tree.destroy();
    }
  });
});
