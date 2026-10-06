import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import {
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * Registered-terminal reversal through the Solid adapter (v16 integration
 * slice 8b). Mirrors `packages/vue/src/lib/opaque-leaf-restoration.spec.ts`
 * (v15 2892b650, slice 8): an object terminal and a Map terminal undo and
 * redo as whole values, an external `undefined` refuses, and an ordinary
 * omission is re-added by undo (slice 8b). Each result is read through a
 * Solid memo, not only by a direct call.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

/** Run `body` inside a reactive root and dispose it afterwards. */
const inRoot = async (body: () => Promise<void>) => {
  let dispose = () => undefined as void;
  const done = createRoot((release) => {
    dispose = release;
    return body();
  });
  try {
    await done;
  } finally {
    dispose();
  }
};

describe.each(ORDERS)('registered terminals — Solid (%s)', (_, enhancers) => {
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

  it('undo and redo replace an object terminal and a Map terminal as one value', () =>
    inRoot(async () => {
      const tree = build();
      try {
        const bounds = createMemo(() => tree.$.bounds());
        const lookup = createMemo(() => [...tree.$.lookup()]);
        undoable(() => {
          tree.$.bounds.set({ min: 1, max: 9 });
          tree.$.lookup.set(new Map([['a', 2]]));
        });
        await flush();
        expect(bounds()).toEqual({ min: 1, max: 9 });
        expect(lookup()).toEqual([['a', 2]]);
        tree.undo();
        await flush();
        expect(bounds()).toEqual({ min: 0, max: 10 });
        expect(lookup()).toEqual([['a', 1]]);
        tree.redo();
        await flush();
        expect(bounds()).toEqual({ min: 1, max: 9 });
        expect(lookup()).toEqual([['a', 2]]);
      } finally {
        tree.destroy();
      }
    }));

  it('external undefined refuses the whole undo and nothing changes', () =>
    inRoot(async () => {
      const tree = build();
      try {
        const view = createMemo(() => [tree.$.bounds(), tree.$.count()]);
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
    }));

  it('undo re-adds an ordinarily omitted terminal with its pre-image', () =>
    inRoot(async () => {
      const tree = build();
      try {
        const keys = createMemo(() => Object.keys(tree.$()));
        const bounds = createMemo(() => tree.$.bounds());
        undoable(() => {
          tree.$.bounds.set({ min: 1, max: 9 });
          tree.$.count.set(1);
        });
        await flush();
        tree.$({ lookup: new Map([['a', 1]]), count: 1 } as never);
        await flush();
        expect(keys()).toEqual(['lookup', 'count']);
        expect(bounds()).toBeUndefined();
        tree.undo();
        await flush();
        expect(keys()).toEqual(['bounds', 'lookup', 'count']);
        expect(bounds()).toEqual({ min: 0, max: 10 });
        expect(tree.$.count()).toBe(0);
      } finally {
        tree.destroy();
      }
    }));
});
