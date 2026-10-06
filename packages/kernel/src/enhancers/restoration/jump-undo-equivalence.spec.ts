import { afterEach, describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

/**
 * v16 slice 8g: jumpTo(i) restores exactly what undoing back to i restores.
 *
 * Found by the v15 port review (`.claude/evidence/reviews/v15-port/j5.spec.ts`,
 * `j2.spec.ts`), identical on v16 7a11905c. A jump across an omission, a
 * re-add that reuses a retained id, and a later omission took the declarative
 * path, which installed its scalar targets before its member targets: the
 * member it re-added carried an older value and overwrote the jump's own
 * target (`y` came back 0 instead of 10; with more history, `k` and `s` were
 * lost too). The undo chain, which installs members first, was right.
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
        ids(): string[];
      };
      h: { x: (value?: number) => number; y: (value?: number) => number };
      s: (value?: number) => number;
    };
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
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

describe('jumpTo across an omission and a re-add reusing a retained id (v16 8g)', () => {
  const steps = (tree: Tree): Array<() => void> => [
    () =>
      tree.$.g.rows.setAll([
        { id: 'a', n: 4 },
        { id: 'e', n: 6 },
      ]),
    () => tree.$.g.h.y(10),
    // Omits rows, k and s; y 10 -> 0.
    () => tree.$({ g: { h: { x: 0, y: 0 } }, count: 9 }),
    // Re-adds rows, reusing the retained id e.
    () =>
      tree.$.g.rows.setAll([
        { id: 'e', n: 11 },
        { id: 'd', n: 12 },
      ]),
    // Omits g.
    () => tree.$({ count: 9 }),
  ];
  for (const [order, enhancers] of Object.entries(orders))
    it(`jumpTo back equals the undo chain, and forward equals the redo chain (${order})`, async () => {
      const jumped = make(enhancers());
      const undone = make(enhancers());
      const states: string[] = [];
      for (const tree of [jumped, undone]) {
        await flush();
        for (const step of steps(tree)) {
          undoable(step);
          await flush();
          if (tree === jumped) states.push(snap(tree));
        }
      }
      // Entry i is the state after step i; undo does not move
      // getCurrentIndex(), so the chain counts its steps.
      const target = 1;
      const last = steps(jumped).length - 1;
      jumped.jumpTo(target);
      await flush();
      for (let i = last; i > target; i--) {
        undone.undo();
        await flush();
      }
      expect(snap(jumped)).toBe(snap(undone));
      expect(snap(jumped)).toBe(states[target]);
      expect(JSON.parse(snap(jumped)).g.h.y).toBe(10);
      jumped.jumpTo(last);
      await flush();
      for (let i = target; i < last; i++) {
        undone.redo();
        await flush();
      }
      expect(snap(jumped)).toBe(snap(undone));
      expect(snap(jumped)).toBe(states[last]);
    });
});

/**
 * A jump concatenates every turn it crosses into one application, which
 * installs member targets before value targets. A scalar target written
 * BEFORE a later member write that supplies the same location is stale: the
 * member's value is what the undo chain leaves there.
 */
describe('a member write supersedes an earlier scalar target for its location (v16 8g)', () => {
  const shapes: Record<string, (tree: Tree) => Array<() => unknown>> = {
    // Back to 0 reverses `y(9)`, `y(4)` (a path re-add of y), `x(7)` (a path
    // re-add of h, without y) and the omission, whose reversal re-adds g with
    // y 0. The scalar target y 4 is older than that re-add.
    'path re-adds, then a jump back past the omission': (tree) => [
      () => tree.$.count(1),
      () => tree.$({ count: 2 }),
      () => tree.$.g.h.x(7),
      () => tree.$.g.h.y(4),
      () => tree.$.g.h.y(9),
    ],
    // Forward from 0 sets s 4, omits s, then re-adds it with 6.
    'a scalar, an omission and a member re-add, then a jump forward': (
      tree
    ) => [
      () => tree.$.count(1),
      () => tree.$.g.s(4),
      () => tree.$({ g: { h: { x: 0, y: 1 } }, count: 9 }),
      () => tree.$.g({ rows: tree.$.g.rows.all(), k: 1, s: 6 }),
    ],
  };
  for (const [order, enhancers] of Object.entries(orders))
    for (const [shape, steps] of Object.entries(shapes))
      it(`${shape} (${order})`, async () => {
        const jumped = make(enhancers());
        const chained = make(enhancers());
        const states: string[] = [];
        for (const tree of [jumped, chained]) {
          await flush();
          for (const step of steps(tree)) {
            undoable(step);
            await flush();
            if (tree === jumped) states.push(snap(tree));
          }
        }
        const last = states.length - 1;
        jumped.jumpTo(0);
        await flush();
        for (let i = last; i > 0; i--) {
          chained.undo();
          await flush();
        }
        expect(snap(jumped)).toBe(states[0]);
        expect(snap(chained)).toBe(states[0]);
        jumped.jumpTo(last);
        await flush();
        for (let i = 0; i < last; i++) {
          chained.redo();
          await flush();
        }
        expect(snap(jumped)).toBe(states[last]);
        expect(snap(chained)).toBe(states[last]);
      });
});

/**
 * Shapes the generated histories found once the first causes were fixed
 * (v16 8g). Each jump is compared with the state its target recorded and with
 * the undo or redo chain.
 */
describe('jumps that cross rows, a path re-add and an omission (v16 8g)', () => {
  const shapes: Record<
    string,
    { steps: (tree: Tree) => Array<() => unknown>; from: number; to: number }
  > = {
    // Back from 5 to 2 reverses the omission of g (which re-adds g with h),
    // a `setAll` and the path re-add of h. The rows' collection lies under g,
    // which is hidden while the reversal is planned, so its effects apply one
    // by one; the scalar x under h, which the reversal hides, must not
    // re-add h on the way.
    'a scalar under a member the jump hides, with rows under a member it re-adds':
      {
        steps: (tree) => [
          () => tree.$.count(1),
          () => tree.$.g({ rows: [], k: 1, s: 1 }),
          () =>
            tree.$.g.rows.setAll([
              { id: 'b', n: 1 },
              { id: 'd', n: 2 },
            ]),
          () => tree.$.g.h.x(1),
          () =>
            tree.$.g.rows.setAll([
              { id: 'a', n: 3 },
              { id: 'b', n: 4 },
              { id: 'c', n: 5 },
            ]),
          () => tree.$({ count: 13 }),
        ],
        from: 5,
        to: 2,
      },
    // One turn writes y, omits and re-adds g with y 3, then writes y 5: its
    // scalar effect holds y 5, its member effect the older 3. A jump that
    // crosses it and another turn keeps the turn's own scalar.
    'a turn whose own scalar is newer than its member re-add': {
      steps: (tree) => [
        () => tree.$.count(1),
        () => tree.$.count(2),
        () => {
          tree.$.g.h.y(1);
          tree.$({ count: 3 });
          tree.$({ g: { h: { x: 0, y: 3 } }, count: 9 });
          tree.$.g.h.y(5);
        },
      ],
      from: 0,
      to: 2,
    },
    // The same supersession as 'path re-adds, then a jump back past the
    // omission', on the declarative path: the jump also reverses a reorder.
    'a member write supersedes an older scalar, with a reorder in the jump': {
      steps: (tree) => [
        () => tree.$.count(1),
        () =>
          tree.$.g.rows.setAll([
            { id: 'a', n: 1 },
            { id: 'b', n: 2 },
          ]),
        () =>
          tree.$.g.rows.setAll([
            { id: 'b', n: 2 },
            { id: 'a', n: 1 },
          ]),
        () => tree.$({ count: 2 }),
        () => tree.$.g.h.x(7),
        () => tree.$.g.h.y(4),
        () => tree.$.g.h.y(9),
      ],
      from: 6,
      to: 1,
    },
    // 'a turn whose own scalar is newer than its member re-add', on the
    // declarative path.
    'a turn keeps its own newer scalar, with a reorder in the jump': {
      steps: (tree) => [
        () => tree.$.count(1),
        () =>
          tree.$.g.rows.setAll([
            { id: 'a', n: 1 },
            { id: 'b', n: 2 },
          ]),
        () =>
          tree.$.g.rows.setAll([
            { id: 'b', n: 2 },
            { id: 'a', n: 1 },
          ]),
        () => {
          tree.$.g.h.y(1);
          tree.$({ count: 3 });
          tree.$({ g: { h: { x: 0, y: 3 } }, count: 9 });
          tree.$.g.h.y(5);
        },
      ],
      from: 1,
      to: 3,
    },
    // Back from 3 to 1 puts e back (removed by the last turn) and reverses a
    // setAll that placed a and c around it: the setAll's removals and additions
    // are anchored on rows the other turn changes, so only a turn-by-turn
    // replay of the order places them (J5b).
    'a jump back over a setAll and a removal of its anchor': {
      steps: (tree) => [
        () => tree.$.count(1),
        () =>
          tree.$.g.rows.setAll([
            { id: 'd', n: 6 },
            { id: 'e', n: 7 },
          ]),
        () =>
          tree.$.g.rows.setAll([
            { id: 'a', n: 12 },
            { id: 'c', n: 13 },
            { id: 'e', n: 14 },
          ]),
        () => tree.$.g.rows.removeOne('e'),
      ],
      from: 3,
      to: 1,
    },
    // Forward from 1 to 4: d's recorded neighbour e is added by one turn and
    // removed by a later one, so only a turn-by-turn replay can place d.
    'an anchor another turn added and a later turn removed': {
      steps: (tree) => [
        () => tree.$.count(1),
        () => tree.$({ g: { h: { x: 0, y: 0 } }, count: 9 }),
        () => tree.$.g.rows.addOne({ id: 'e', n: 0 }),
        () =>
          tree.$.g.rows.setAll([
            { id: 'a', n: 1 },
            { id: 'b', n: 2 },
            { id: 'd', n: 3 },
            { id: 'e', n: 4 },
          ]),
        () => tree.$.g.rows.removeOne('e'),
      ],
      from: 1,
      to: 4,
    },
    // Forward from 1 to 3 re-adds the rows with e, then `setAll` places a, b
    // and d around it: d's recorded neighbour e was added by the other turn.
    'additions anchored on a row another turn added': {
      steps: (tree) => [
        () => tree.$.count(1),
        () => tree.$({ g: { h: { x: 0, y: 0 } }, count: 9 }),
        () => tree.$.g.rows.addOne({ id: 'e', n: 0 }),
        () =>
          tree.$.g.rows.setAll([
            { id: 'a', n: 1 },
            { id: 'b', n: 2 },
            { id: 'd', n: 3 },
            { id: 'e', n: 4 },
          ]),
      ],
      from: 1,
      to: 3,
    },
  };
  for (const [order, enhancers] of Object.entries(orders))
    for (const [shape, { steps, from, to }] of Object.entries(shapes))
      it(`${shape} (${order})`, async () => {
        const jumped = make(enhancers());
        const chained = make(enhancers());
        const states: string[] = [];
        for (const tree of [jumped, chained]) {
          await flush();
          for (const step of steps(tree)) {
            undoable(step);
            await flush();
            if (tree === jumped) states.push(snap(tree));
          }
        }
        const last = states.length - 1;
        // Both trees start the jump at `from`, by the chain.
        for (const tree of [jumped, chained])
          for (let i = last; i > from; i--) {
            tree.undo();
            await flush();
          }
        expect(snap(jumped)).toBe(states[from]);
        jumped.jumpTo(to);
        await flush();
        for (let i = from; i !== to; i += to > from ? 1 : -1) {
          if (to > from) chained.redo();
          else chained.undo();
          await flush();
        }
        expect(snap(jumped)).toBe(states[to]);
        expect(snap(chained)).toBe(states[to]);
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

describe('jumpTo equals the undo and redo chains: generated histories (v16 8g)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  /** One generated operation; the same choice applied to either tree. */
  const operation = (next: () => number) => {
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
          // Omits h, keeps rows.
          return tree.$.g({ rows: rows.all(), k: 1, s: value });
        default:
          return tree.$.g.h.x(value);
      }
    };
  };
  const SEEDS = 40;
  for (const [order, enhancers] of Object.entries(orders))
    it(`${SEEDS} generated histories (${order})`, async () => {
      const failures: string[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const next = random(seed * 7919);
        const ops = Array.from({ length: 8 }, () => operation(next));
        const jumped = make(enhancers());
        const chained = make(enhancers());
        // The state each entry recorded, as the writes left it.
        const recorded: Record<number, string> = {};
        for (const tree of [jumped, chained]) {
          await flush();
          for (const op of ops) {
            try {
              undoable(() => op(tree));
            } catch {
              // A refused write (an id already present, absent) records nothing.
            }
            await flush();
            if (tree === jumped) recorded[tree.getCurrentIndex()] = snap(tree);
          }
        }
        // Entry i is the state after the i-th recorded write.
        const end = jumped.getCurrentIndex();
        if (end !== chained.getCurrentIndex() || end < 1) continue;
        const target = Math.floor(next() * end);
        let jumpError = '';
        try {
          jumped.jumpTo(target);
        } catch (error) {
          jumpError = (error as Error).message;
        }
        await flush();
        let chainError = '';
        try {
          for (let i = end; i > target; i--) {
            chained.undo();
            await flush();
          }
        } catch (error) {
          chainError = (error as Error).message;
        }
        // A refusal is not a wrong restore; only compare completed ones.
        if (jumpError || chainError) continue;
        if (snap(jumped) !== snap(chained))
          failures.push(
            `seed ${seed} back to ${target}: recorded ${recorded[target]} ` +
              `jump ${snap(jumped)} chain ${snap(chained)}`
          );
        let forward = '';
        try {
          jumped.jumpTo(end);
          await flush();
          for (let i = target; i < end; i++) {
            chained.redo();
            await flush();
          }
        } catch (error) {
          forward = (error as Error).message;
        }
        if (!forward && snap(jumped) !== snap(chained))
          failures.push(
            `seed ${seed} forward to ${end}: recorded ${recorded[end]} ` +
              `jump ${snap(jumped)} chain ${snap(chained)}`
          );
      }
      expect(failures).toEqual([]);
    });
});
