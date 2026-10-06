import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * jumpTo is one operation over several entries; undo and redo walk them one
 * at a time. Both must reach the same state, or jumpTo must refuse (typed)
 * and change nothing: never a silent partial restore (v15 port review of
 * 67012241..12187613, item 1).
 *
 * The review's shape: a jump across an omission of `rows`, `k` and `s` that
 * also wrote `h.y`, a write that re-added `rows` reusing a retained id, and
 * an omission of `g`. The jump took the declarative path (the retained id),
 * which installed every plain-branch member's value AFTER the scalars, so
 * `g`'s earlier image overwrote `h.y: 10` with 0, and in other orders dropped
 * `k` and `s`. Members now install first, as `applyAtomically` installs them.
 * Members first is not enough on its own: across the turns of one jump, a
 * value an earlier-applied turn wrote below a member that a later-applied
 * turn sets must give way to that member's image (`supersedeAcrossTurns`;
 * the fuzz seed 100029 carrier).
 *
 * The fuzz below drives random sequences of omissions, re-adds (writes under
 * omitted members, collection writes reusing retained ids) and ordinary
 * writes, then compares jumpTo against the undo or redo chain to the same
 * position. REVERSAL_JUMP_FUZZ_ITERATIONS and REVERSAL_JUMP_FUZZ_SEED widen
 * or move it.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const configurations = [
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const;

const declaration = () => ({
  g: {
    rows: entityMap<Row, string>(),
    k: 0,
    s: 0,
    h: { x: 0, y: 0 },
  },
  count: 0,
});
type History = {
  $: unknown;
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  destroy(): void;
};
type Handles = {
  root: (value?: unknown) => unknown;
  g: ((value?: unknown) => unknown) & {
    rows: {
      setAll(rows: Row[]): void;
      addOne(row: Row): void;
      removeOne(id: string): void;
      updateOne(id: string, changes: Partial<Row>): void;
      has(id: string): () => boolean;
    };
    k: (value?: number) => number;
    h: ((value?: unknown) => unknown) & {
      x: (value?: number) => number;
      y: (value?: number) => number;
    };
  };
  count: (value?: number) => number;
};
const make = (enhancers: () => readonly unknown[]) => {
  const tree = signalTree(declaration(), {
    enhancers: enhancers() as never,
  }) as unknown as History;
  const $ = tree.$ as Handles['root'] & Record<string, unknown>;
  const handles: Handles = {
    root: $,
    g: $['g'] as Handles['g'],
    count: $['count'] as Handles['count'],
  };
  return { tree, h: handles };
};
const state = (tree: History) => JSON.stringify((tree.$ as () => unknown)());

describe.each(configurations)(
  'jumpTo and the undo chain agree (%s)',
  (_name, enhancers) => {
    /** The review's j5 shape; returns the target index and its state. */
    const reviewShape = async ({ tree, h }: ReturnType<typeof make>) => {
      undoable(() =>
        h.g.rows.setAll([
          { id: 'a', n: 4 },
          { id: 'e', n: 6 },
        ])
      );
      await flush();
      undoable(() => h.g.h.y(10));
      await flush();
      const target = { index: tree.getCurrentIndex(), state: state(tree) };
      // Omits rows, k and s; y 10 -> 0.
      undoable(() => h.root({ g: { h: { x: 0, y: 0 } }, count: 9 }));
      await flush();
      // Re-adds rows, reusing the retained id e.
      undoable(() =>
        h.g.rows.setAll([
          { id: 'e', n: 11 },
          { id: 'd', n: 12 },
        ])
      );
      await flush();
      undoable(() => h.root({ count: 9 }));
      await flush();
      return target;
    };

    it('jumpTo back across an omission, a re-add reusing a retained id, and a later omission (review j5)', async () => {
      const jumped = make(enhancers);
      const walked = make(enhancers);
      try {
        const target = await reviewShape(jumped);
        await reviewShape(walked);
        const latest = jumped.tree.getCurrentIndex();
        jumped.tree.jumpTo(target.index);
        await flush();
        for (let i = 0; i < 3; i++) {
          walked.tree.undo();
          await flush();
        }
        expect(state(jumped.tree)).toBe(target.state);
        expect(state(walked.tree)).toBe(target.state);
        expect(state(jumped.tree)).toContain('"k":0,"s":0,"h":{"x":0,"y":10}');
        // And forward again.
        jumped.tree.jumpTo(latest);
        await flush();
        for (let i = 0; i < 3; i++) {
          walked.tree.redo();
          await flush();
        }
        expect(state(jumped.tree)).toBe(state(walked.tree));
        expect(state(jumped.tree)).toBe('{"count":9}');
      } finally {
        jumped.tree.destroy();
        walked.tree.destroy();
      }
    });

    // Found by the fuzz below: an earlier turn's write below a member that a
    // later turn re-adds is superseded by that member's image. Not the
    // declarative path: applyAtomically applied every value after the members.
    it('jumpTo back across a write of h.x, omissions of h, and a re-add of h (fuzz seed 100029)', async () => {
      const run = async ({ tree, h }: ReturnType<typeof make>) => {
        const target = { index: -1, state: '' };
        const writes: Array<() => void> = [
          () => h.g.h.y(15),
          () => h.g({ k: 10, s: 10 }),
          () => h.g.h.y(1),
          () => h.g({ k: 4, s: 4 }),
          () => h.g({ k: 0, s: 0 }),
          () => h.root({ g: { h: { x: 19, y: 19 } }, count: 19 }),
          () => h.g({ rows: [], h: { x: 6, y: 0 } }),
        ];
        for (const [at, write] of writes.entries()) {
          undoable(write);
          await flush();
          if (at === 0) {
            target.index = tree.getCurrentIndex();
            target.state = state(tree);
          }
        }
        return target;
      };
      const jumped = make(enhancers);
      const walked = make(enhancers);
      try {
        const target = await run(jumped);
        await run(walked);
        jumped.tree.jumpTo(target.index);
        await flush();
        while (walked.tree.getCurrentIndex() > target.index) {
          walked.tree.undo();
          await flush();
        }
        expect(state(walked.tree)).toBe(target.state);
        expect(state(jumped.tree)).toBe(target.state);
      } finally {
        jumped.tree.destroy();
        walked.tree.destroy();
      }
    });

    // Only a member above `x` changes membership here. Green before the fix
    // too: a whole value that re-adds `h` also records `h.x` and `h.y` as
    // value writes, and those land after the later write's before-image, so
    // the rule that drops writes below a later member is not what carries it
    // (that rule's mutant survives this file). Pinned so the whole-value path
    // stays equivalent to the chain.
    it('jumpTo back across a write below a branch that a later turn re-adds as a whole', async () => {
      const run = async ({ tree, h }: ReturnType<typeof make>) => {
        undoable(() => h.count(1));
        await flush();
        const target = { index: tree.getCurrentIndex(), state: state(tree) };
        for (const write of [
          // Omits h.
          () => h.g({ rows: [], k: 1, s: 1 }),
          // Re-adds h whole (and omits rows, k and s).
          () => h.root({ g: { h: { x: 19, y: 19 } }, count: 19 }),
          () => h.g.h.x(6),
        ]) {
          undoable(write);
          await flush();
        }
        return target;
      };
      const jumped = make(enhancers);
      const walked = make(enhancers);
      try {
        const target = await run(jumped);
        await run(walked);
        jumped.tree.jumpTo(target.index);
        await flush();
        while (walked.tree.getCurrentIndex() > target.index) {
          walked.tree.undo();
          await flush();
        }
        expect(state(walked.tree)).toBe(target.state);
        expect(state(jumped.tree)).toBe(target.state);
      } finally {
        jumped.tree.destroy();
        walked.tree.destroy();
      }
    });

    // A turn's own re-add of `h` does not supersede the write it then made
    // below `h`: within a turn the member's image is what the re-add wrote
    // ({x: 1}), and the later write (x: 2) still applies over it. The
    // single-turn form is membership-history-projection.spec.ts.
    it('jumpTo forward across a turn that re-adds h and then writes below it', async () => {
      const run = async ({ tree, h }: ReturnType<typeof make>) => {
        const x = h.g.h.x;
        undoable(() => h.g({ rows: [], k: 0, s: 0 }));
        await flush();
        const start = tree.getCurrentIndex();
        undoable(() => {
          h.g({ rows: [], k: 0, s: 0, h: { x: 1, y: 0 } });
          x(2);
        });
        await flush();
        undoable(() => h.count(5));
        await flush();
        return { start, latest: tree.getCurrentIndex(), state: state(tree) };
      };
      const jumped = make(enhancers);
      const walked = make(enhancers);
      try {
        const marks = await run(jumped);
        await run(walked);
        expect(marks.state).toContain('"h":{"x":2,"y":0}');
        // Back by undo on both (a jumpTo view would leave redo to the
        // confirmed position), then forward: jumpTo against the redo chain.
        for (const tree of [jumped.tree, walked.tree])
          for (let step = 0; step < 4; step++) {
            if (tree.getCurrentIndex() <= marks.start) break;
            tree.undo();
            await flush();
          }
        expect(jumped.tree.getCurrentIndex()).toBe(marks.start);
        expect(walked.tree.getCurrentIndex()).toBe(marks.start);
        jumped.tree.jumpTo(marks.latest);
        await flush();
        for (let step = 0; step < 4; step++) {
          if (walked.tree.getCurrentIndex() >= marks.latest) break;
          walked.tree.redo();
          await flush();
        }
        expect(walked.tree.getCurrentIndex()).toBe(marks.latest);
        expect(state(walked.tree)).toBe(marks.state);
        expect(state(jumped.tree)).toBe(marks.state);
      } finally {
        jumped.tree.destroy();
        walked.tree.destroy();
      }
    });

    it('jumpTo back across a re-add of rows, an omission of h, and the omission of g (review j2)', async () => {
      const run = async ({ tree, h }: ReturnType<typeof make>) => {
        undoable(() =>
          h.g.rows.setAll([
            { id: 'a', n: 4 },
            { id: 'b', n: 5 },
            { id: 'e', n: 6 },
          ])
        );
        await flush();
        undoable(() => h.g.h.y(10));
        await flush();
        const target = { index: tree.getCurrentIndex(), state: state(tree) };
        undoable(() => h.root({ g: { h: { x: 0, y: 0 } }, count: 0 }));
        await flush();
        undoable(() => h.g.rows.setAll([{ id: 'e', n: 7 }]));
        await flush();
        undoable(() => h.root({ count: 9 }));
        await flush();
        return target;
      };
      const jumped = make(enhancers);
      const walked = make(enhancers);
      try {
        const target = await run(jumped);
        await run(walked);
        jumped.tree.jumpTo(target.index);
        await flush();
        while (walked.tree.getCurrentIndex() > target.index) {
          walked.tree.undo();
          await flush();
        }
        expect(state(walked.tree)).toBe(target.state);
        expect(state(jumped.tree)).toBe(target.state);
      } finally {
        jumped.tree.destroy();
        walked.tree.destroy();
      }
    });
  }
);

// ─── fuzz ─────────────────────────────────────────────────────────────────

const ITERATIONS = Number(process.env['REVERSAL_JUMP_FUZZ_ITERATIONS'] ?? 40);
const SEED = Number(process.env['REVERSAL_JUMP_FUZZ_SEED'] ?? 1);
const random = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
};
const IDS = ['a', 'b', 'c', 'd', 'e'];
type Op = { label: string; run: (h: Handles) => void } | 'undo';
const palette = (next: () => number): Op => {
  // Sometimes an undo, so later writes discard a redo future and reuse what
  // the undo retained.
  if (next() < 0.15) return 'undo';
  // Every choice is drawn here, never when the op runs: both trees replay
  // the same ops.
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(next() * items.length)];
  const n = Math.floor(next() * 20);
  const id = pick(IDS);
  const rows = IDS.filter(() => next() < 0.5).map((each) => ({
    id: each,
    n: Math.floor(next() * 9),
  }));
  const ops: Array<[string, (h: Handles) => void]> = [
    // Ordinary writes.
    [`count(${n})`, (h) => h.count(n)],
    [`g.h.y(${n})`, (h) => h.g.h.y(n)],
    [`g.h.x(${n})`, (h) => h.g.h.x(n)],
    [`g.k(${n})`, (h) => h.g.k(n)],
    // Row writes; a collection write re-adds an omitted path, and retained
    // ids are reused.
    [`rows.setAll(${JSON.stringify(rows)})`, (h) => h.g.rows.setAll(rows)],
    [`rows.addOne(${id}${n})`, (h) => h.g.rows.addOne({ id, n })],
    [`rows.removeOne(${id})`, (h) => h.g.rows.removeOne(id)],
    [`rows.updateOne(${id}, ${n})`, (h) => h.g.rows.updateOne(id, { n })],
    // Omissions (whole values that leave members out).
    [`$({count:${n}})`, (h) => h.root({ count: n })],
    [
      `$({g:{h:{x:${n},y:${n}}},count:${n}})`,
      (h) => h.root({ g: { h: { x: n, y: n } }, count: n }),
    ],
    [`g({k:${n},s:${n}})`, (h) => h.g({ k: n, s: n })],
    [
      `g({rows:[],h:{x:${n},y:0}})`,
      (h) => h.g({ rows: [], h: { x: n, y: 0 } }),
    ],
    // A whole value that keeps every member.
    [
      `g({rows:[],k:${n},s:${n},h:{x:${n},y:${n}}})`,
      (h) => h.g({ rows: [], k: n, s: n, h: { x: n, y: n } }),
    ],
  ];
  const [label, run] = pick(ops);
  return { label, run };
};

describe.each(configurations)(
  'jumpTo and the undo chain agree, fuzzed (%s)',
  (_name, enhancers) => {
    it(`${ITERATIONS} sequences from seed ${SEED}`, async () => {
      const failures: string[] = [];
      let compared = 0;
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const seed = SEED * 100003 + iteration;
        const steps = 6 + (iteration % 7);
        const next = random(seed);
        const ops = Array.from({ length: steps }, () => palette(next));
        const script = ops
          .map((op) => (op === 'undo' ? 'undo' : op.label))
          .join('; ');
        // The state at each history position when the history was written:
        // what both jumpTo and the chain must give back.
        const recorded = new Map<number, string>();
        const build = async (record: boolean) => {
          const made = make(enhancers);
          if (record) recorded.set(-1, state(made.tree));
          for (const op of ops) {
            const at = made.tree.getCurrentIndex();
            try {
              if (op === 'undo') made.tree.undo();
              else undoable(() => op.run(made.h));
            } catch {
              /* an op this state refuses (a row that is not there) */
            }
            await flush();
            const index = made.tree.getCurrentIndex();
            if (record && op !== 'undo' && index !== at) {
              for (const key of [...recorded.keys()])
                if (key > index) recorded.delete(key);
              recorded.set(index, state(made.tree));
            }
          }
          return made;
        };
        const jumped = await build(true);
        const walked = await build(false);
        try {
          const latest = jumped.tree.getCurrentIndex();
          if (latest < 1) continue;
          const target = Math.floor(next() * latest);
          // Back: jumpTo against the undo chain.
          for (const [direction, to] of [
            ['back', target],
            ['forward', latest],
          ] as const) {
            // The undo or redo chain, one entry at a time; it fails when a step
            // throws or does not move.
            let chainFailed = false;
            try {
              for (
                let guard = 0;
                walked.tree.getCurrentIndex() !== to && !chainFailed;
                guard++
              ) {
                const at = walked.tree.getCurrentIndex();
                if (at > to) walked.tree.undo();
                else walked.tree.redo();
                await flush();
                chainFailed =
                  walked.tree.getCurrentIndex() === at || guard > 64;
              }
            } catch {
              chainFailed = true;
            }
            const before = state(jumped.tree);
            const index = jumped.tree.getCurrentIndex();
            let refused = false;
            try {
              jumped.tree.jumpTo(to);
              await flush();
            } catch (error) {
              refused = true;
              // A refusal changes nothing.
              if (
                state(jumped.tree) !== before ||
                jumped.tree.getCurrentIndex() !== index
              )
                failures.push(
                  `seed ${seed} ${direction}: jumpTo threw (${String(
                    (error as Error).message
                  ).slice(0, 80)}) and changed state`
                );
            }
            const expected = recorded.get(to);
            if (
              !chainFailed &&
              expected !== undefined &&
              state(walked.tree) !== expected
            )
              failures.push(
                `seed ${seed} ${direction} to ${to}: undo/redo ${state(
                  walked.tree
                )} recorded ${expected}`
              );
            if (refused || chainFailed) break;
            compared++;
            if (state(jumped.tree) !== state(walked.tree))
              failures.push(
                `seed ${seed} ${direction} to ${to}: jumpTo ${state(
                  jumped.tree
                )} undo/redo ${state(walked.tree)} [${script}]`
              );
          }
        } finally {
          jumped.tree.destroy();
          walked.tree.destroy();
        }
      }
      expect(failures).toStrictEqual([]);
      expect(compared).toBeGreaterThan(0);
    }, 120_000);
  }
);

// ─── v16 8g: jumps that cross rows (ported) ─────────────────────────────────
// v16 integrate/v16-slice8g 1dbc5e7e, cause 5: an addition anchored on a row
// another turn added. Physical placement resolves an addition's anchors as
// each addition lands, which holds for one turn's additions, not for a jump
// that concatenates turns: `d,e,a,b` came back for `a,b,d,e`. The other
// shapes are v16's supersession carriers, which b21ae8c1 already covers.
type Tree8g = {
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
const trees8g: Tree8g[] = [];
afterEach(() => {
  for (const tree of trees8g.splice(0)) tree.destroy();
});
const orders8g: Record<string, () => unknown[]> = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const make8g = (enhancers: unknown[]): Tree8g => {
  const tree = signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree8g;
  trees8g.push(tree);
  return tree;
};
const snap8g = (tree: Tree8g) => JSON.stringify(tree.$());

describe('jumps that cross rows, a path re-add and an omission (v16 8g, ported)', () => {
  const shapes: Record<
    string,
    { steps: (tree: Tree8g) => Array<() => unknown>; from: number; to: number }
  > = {
    // Back from 5 to 2 reverses the omission of g (which re-adds g with h),
    // a `setAll` and the path re-add of h. The rows' collection lies under g,
    // which is hidden while the reversal is planned, so its effects apply one
    // by one; the scalar x under h, which the reversal hides, must not
    // re-add h on the way.
    'a scalar under a member the jump hides, with rows under a member it re-adds':
      {
        steps: (tree: Tree8g) => [
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
      steps: (tree: Tree8g) => [
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
      steps: (tree: Tree8g) => [
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
      steps: (tree: Tree8g) => [
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
    // Forward from 1 to 4: d's recorded neighbour e is added by one turn and
    // removed by a later one, so only a turn-by-turn replay can place d.
    'an anchor another turn added and a later turn removed': {
      steps: (tree: Tree8g) => [
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
      steps: (tree: Tree8g) => [
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
  for (const [order, enhancers] of Object.entries(orders8g))
    for (const [shape, { steps, from, to }] of Object.entries(shapes))
      it(`${shape} (${order})`, async () => {
        const jumped = make8g(enhancers());
        const chained = make8g(enhancers());
        const states: string[] = [];
        for (const tree of [jumped, chained]) {
          await flush();
          for (const step of steps(tree)) {
            undoable(step);
            await flush();
            if (tree === jumped) states.push(snap8g(tree));
          }
        }
        const last = states.length - 1;
        // Both trees start the jump at `from`, by the chain.
        for (const tree of [jumped, chained])
          for (let i = last; i > from; i--) {
            tree.undo();
            await flush();
          }
        expect(snap8g(jumped)).toBe(states[from]);
        jumped.jumpTo(to);
        await flush();
        for (let i = from; i !== to; i += to > from ? 1 : -1) {
          if (to > from) chained.redo();
          else chained.undo();
          await flush();
        }
        expect(snap8g(jumped)).toBe(states[to]);
        expect(snap8g(chained)).toBe(states[to]);
      });
});
