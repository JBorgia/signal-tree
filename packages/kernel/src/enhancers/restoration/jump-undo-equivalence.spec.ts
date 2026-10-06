import { describe, expect, it } from 'vitest';

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
