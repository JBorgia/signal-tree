import { afterEach, describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

/**
 * v16 slice 8g: undo and redo of ONE turn that omits and re-adds within
 * itself restore the turn's endpoints.
 *
 * A turn records one net effect per location, in first-occurrence order. A
 * member's images were taken when its presence changed, so they could hold a
 * mid-turn value, and a net no-op was dropped as soon as it composed, losing
 * the pre-turn value a later image needed. Found by a generated undo/redo
 * chain with multi-write turns (190 wrong steps over 74 of 300 histories on
 * 8f, df784a38). `settleTurnMemberEffects` now settles each member's images
 * to the turn's endpoints when the turn is drained.
 */

type Row = { id: string; n: number };
type Tree = {
  $: ((value?: unknown) => unknown) & {
    count: (value?: number) => number;
    g: ((value?: unknown) => unknown) & {
      rows: {
        all(): Row[];
        setAll(rows: Row[]): void;
        addOne(row: Row): string;
        removeOne(id: string): void;
      };
      h: { x: (value?: number) => number; y: (value?: number) => number };
    };
  };
  undo(): void;
  redo(): void;
  getCurrentIndex(): number;
  destroy(): void;
};

const trees: Tree[] = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const orders: Record<string, () => unknown[]> = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const make = (enhancers: unknown[]): Tree => {
  const tree = signalTree(
    {
      g: { rows: entityMap<Row, string>(), k: 0, s: 0, h: { x: 0, y: 0 } },
      count: 0,
    },
    { enhancers: enhancers as never }
  ) as unknown as Tree;
  trees.push(tree);
  return tree;
};
const snap = (tree: Tree) => JSON.stringify(tree.$());
/** Omits h (and keeps rows, k, s). */
const omitH = (tree: Tree, s: number) =>
  tree.$.g({ rows: tree.$.g.rows.all(), k: 1, s });

describe('one turn that omits and re-adds (v16 8g)', () => {
  const shapes: Record<string, Array<(tree: Tree) => void>> = {
    // g's before-image was taken after x(5); the no-op x 0 -> 5 -> 0 was
    // dropped. Undo came back with x 5.
    'a write, an omission and a re-add of its branch': [
      (tree) => {
        tree.$.g.h.x(5);
        tree.$({ count: 16 });
        tree.$({ g: { h: { x: 0, y: 18 } }, count: 9 });
        tree.$.g.h.y(13);
      },
    ],
    // y was made dormant by h's path re-add (first), then re-added: its one
    // effect preceded h's, whose after-image {x:3} hid it again. Redo lost y.
    'two path re-adds under one omitted member': [
      (tree) => omitH(tree, 19),
      (tree) => {
        tree.$.g.h.x(3);
        tree.$.g.h.y(15);
      },
    ],
    'two path re-adds, the other way round': [
      (tree) => omitH(tree, 1),
      (tree) => {
        tree.$.g.h.y(6);
        tree.$.g.h.x(14);
      },
    ],
    // h's after-image was read while g was still hidden: {}. Redo lost x.
    'an omission and a whole-value re-add that brings a member back': [
      (tree) => omitH(tree, 1),
      (tree) => {
        tree.$({ count: 7 });
        tree.$({ g: { h: { x: 0, y: 18 } }, count: 9 });
      },
    ],
    // The notifier coalesces y 0 -> 16 -> 0 to nothing, so no effect records
    // y's final value; only storage does. h's image still held 16.
    'a path re-add, then the re-added leaf written back': [
      (tree) => omitH(tree, 17),
      (tree) => {
        tree.$.g.h.y(16);
        tree.$.g.h.y(0);
      },
    ],
    'a path re-add of g, then a whole value writing the leaf back': [
      (tree) => tree.$({ count: 11 }),
      (tree) => {
        tree.$.g.h.x(11);
        tree.$({ g: { h: { x: 0, y: 17 } }, count: 9 });
      },
    ],
    // g came back and went again within the turn: its net no-op was dropped,
    // so undo and redo re-added g to reach the writes under it.
    'a path re-add and an omission of the same branch': [
      (tree) => tree.$({ count: 9 }),
      (tree) => {
        tree.$.g.h.x(5);
        tree.$({ count: 16 });
      },
    ],
    'a path re-add of h and an omission of h': [
      (tree) => omitH(tree, 11),
      (tree) => {
        tree.$.g.h.x(1);
        omitH(tree, 9);
      },
    ],
  };
  for (const [order, enhancers] of Object.entries(orders))
    for (const [shape, turns] of Object.entries(shapes))
      it(`${shape} (${order})`, async () => {
        const tree = make(enhancers());
        await flush();
        undoable(() => tree.$.count(100));
        await flush();
        const states = [snap(tree)];
        for (const turn of turns) {
          undoable(() => turn(tree));
          await flush();
          states.push(snap(tree));
        }
        for (let i = states.length - 1; i > 0; i--) {
          tree.undo();
          await flush();
          expect(snap(tree)).toBe(states[i - 1]);
        }
        for (let i = 1; i < states.length; i++) {
          tree.redo();
          await flush();
          expect(snap(tree)).toBe(states[i]);
        }
      });
});

describe('a turn whose re-add and omission cancel (v16 8g)', () => {
  for (const [order, enhancers] of Object.entries(orders))
    it(`records nothing (${order})`, async () => {
      const tree = make(enhancers());
      await flush();
      undoable(() => tree.$({ count: 1 }));
      await flush();
      const index = tree.getCurrentIndex();
      const state = snap(tree);
      // g comes back exactly as it is retained, and goes again: nothing
      // under it changes, so its absent -> absent effect is dropped.
      undoable(() => {
        tree.$({
          g: { rows: [], k: 0, s: 0, h: { x: 0, y: 0 } },
          count: 1,
        });
        tree.$({ count: 1 });
      });
      await flush();
      expect(snap(tree)).toBe(state);
      expect(tree.getCurrentIndex()).toBe(index);
    });
});

/** A small deterministic PRNG (mulberry32). */
const random = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('undo and redo restore every recorded state: generated multi-write turns (v16 8g)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const write = (next: () => number) => {
    const kind = Math.floor(next() * 9);
    const value = Math.floor(next() * 20);
    const pick = ids.filter(() => next() < 0.5);
    const id = ids[Math.floor(next() * ids.length)];
    return (tree: Tree) => {
      const rows = tree.$.g.rows;
      switch (kind) {
        case 0:
          return rows.setAll(pick.map((row, n) => ({ id: row, n: value + n })));
        case 1:
          return tree.$.g.h.y(value);
        case 2:
          return tree.$.count(value);
        case 3:
          // Omits rows, k and s.
          return tree.$({ g: { h: { x: 0, y: value } }, count: 9 });
        case 4:
          // Omits g.
          return tree.$({ count: value });
        case 5:
          return rows.addOne({ id, n: value });
        case 6:
          return rows.removeOne(id);
        case 7:
          // Omits h.
          return omitH(tree, value);
        default:
          return tree.$.g.h.x(value);
      }
    };
  };
  const SEEDS = 60;
  it(`${SEEDS} generated histories`, async () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const next = random(seed * 104729);
      const turns = Array.from({ length: 12 }, () => {
        const writes = Array.from(
          { length: next() < 0.3 ? 2 + Math.floor(next() * 2) : 1 },
          () => write(next)
        );
        return (tree: Tree) => {
          for (const each of writes) each(tree);
        };
      });
      const tree = make([restoration()]);
      await flush();
      const recorded: string[] = [];
      for (const turn of turns) {
        const before = tree.getCurrentIndex();
        try {
          undoable(() => turn(tree));
        } catch {
          // A refused write (an id already present, absent) records what it
          // wrote before refusing, if anything.
        }
        await flush();
        if (tree.getCurrentIndex() !== before) recorded.push(snap(tree));
        else if (recorded.length) recorded[recorded.length - 1] = snap(tree);
      }
      try {
        for (let i = recorded.length - 1; i > 0; i--) {
          tree.undo();
          await flush();
          if (snap(tree) !== recorded[i - 1])
            failures.push(`seed ${seed} undo to ${i - 1}: ${snap(tree)}`);
        }
        for (let i = 1; i < recorded.length; i++) {
          tree.redo();
          await flush();
          if (snap(tree) !== recorded[i])
            failures.push(`seed ${seed} redo to ${i}: ${snap(tree)}`);
        }
      } catch {
        // A refusal is not a wrong restore; refusals are counted elsewhere.
      }
    }
    expect(failures).toEqual([]);
  });
});
