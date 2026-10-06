import { describe, expect, it } from 'vitest';

import type { PositionId } from './causal-types';
import {
  composeTurnOrderDelta,
  composeTurnOrderEndpoints,
  type TurnOrderCapture,
  type TurnRows,
} from './net-order-delta';
import { applyCollectionOrderDelta } from './target-transition';

/**
 * Oracle: simulate a turn of forward collection operations (append, prepend,
 * remove, reorder) on a list, recording what the capture layer records (order
 * captures for reorders, creation and removal anchors for rows); the composed
 * delta must turn the true end order into the true start order and back.
 *
 * Rows are created with ids in creation order, as the structural store
 * allocates them; 'removeNewest' removes the most recently created row.
 */
type Op =
  | ['append']
  | ['prepend']
  | ['remove', number]
  | ['removeNewest']
  | ['reorder', (order: number[]) => number[]];
type Anchors = { beforeSubject?: number; afterSubject?: number };

const simulate = (start: number[], ops: Op[]) => {
  let list = [...start];
  const captures: TurnOrderCapture[] = [];
  const created = new Map<number, Anchors>();
  const removed = new Map<number, Anchors>();
  const neighbours = (subject: number): Anchors => {
    const at = list.indexOf(subject);
    return { beforeSubject: list[at - 1], afterSubject: list[at + 1] };
  };
  const remove = (subject: number | undefined) => {
    if (subject === undefined || !list.includes(subject)) return;
    removed.set(subject, neighbours(subject));
    list = list.filter((other) => other !== subject);
  };
  let frontier = 0;
  let fresh = 10;
  for (const op of ops) {
    if (op[0] === 'append' || op[0] === 'prepend') {
      const subject = fresh++;
      if (op[0] === 'append') list.push(subject);
      else list.unshift(subject);
      created.set(subject, neighbours(subject));
    } else if (op[0] === 'remove') {
      remove(op[1]);
    } else if (op[0] === 'removeNewest') {
      remove(fresh - 1);
    } else {
      const before = [...list];
      list = op[1]([...list]);
      captures.push({
        beforeSubjects: before,
        afterSubjects: [...list],
        beforeFrontier: frontier++,
        afterFrontier: frontier,
      });
    }
  }
  const rows: TurnRows = {
    created: [...created]
      .filter(([subject]) => !removed.has(subject))
      .map(([subject, anchors]) => ({ subject, anchors })),
    removed: [...removed]
      .filter(([subject]) => !created.has(subject))
      .map(([subject, anchors]) => ({ subject, anchors })),
    transient: [...created]
      .filter(([subject]) => removed.has(subject))
      .map(([subject, anchors]) => ({
        subject,
        created: anchors,
        removed: removed.get(subject),
      })),
  };
  return { end: list, captures, rows };
};

const OWNER = 5 as PositionId;
const check = (start: number[], ops: Op[]) => {
  const { end, captures, rows } = simulate(start, ops);
  if (captures.length === 0) return;
  const delta = composeTurnOrderDelta(OWNER, captures, rows, {
    start: 'S',
    end: 'E',
  });
  expect(applyCollectionOrderDelta(end, delta, 'before', 'E')).toStrictEqual(
    start
  );
  expect(applyCollectionOrderDelta(start, delta, 'after', 'S')).toStrictEqual(
    end
  );
};
const reverse = (order: number[]) => order.reverse();
const rotate = (order: number[]) => [...order.slice(1), order[0]];

const shapes: Array<[string, Op[]]> = [
  ['reorder alone', [['reorder', reverse]]],
  ['append, then reorder', [['append'], ['reorder', reverse]]],
  [
    'reorder, then remove',
    [
      ['reorder', reverse],
      ['remove', 2],
    ],
  ],
  [
    'remove, then reorder',
    [
      ['remove', 2],
      ['reorder', rotate],
    ],
  ],
  ['reorder, then append', [['reorder', reverse], ['append']]],
  [
    'prepend, remove, reorder, remove',
    [['prepend'], ['remove', 1], ['reorder', rotate], ['remove', 3]],
  ],
  [
    'two reorders with a remove between',
    [
      ['reorder', reverse],
      ['remove', 2],
      ['reorder', rotate],
    ],
  ],
  [
    'a row created and removed around the reorder',
    [['append'], ['reorder', reverse], ['removeNewest'], ['append']],
  ],
  [
    'a removed row anchored to a transient row',
    [
      ['append'],
      ['append'],
      ['removeNewest'],
      ['reorder', reverse],
      ['remove', 4],
    ],
  ],
  [
    'removals chained before the reorder',
    [
      ['remove', 2],
      ['remove', 3],
      ['reorder', reverse],
    ],
  ],
];

describe('composeTurnOrderDelta', () => {
  it.each(shapes)('%s', (_name, ops) => {
    check([1, 2, 3, 4], ops);
  });

  it('a removed row whose neighbours were both transient rows', () => {
    // [1]: prepend x(10), append y(11) -> [x, 1, y]; remove 1 (x, y), then
    // x and y; two new rows, then the reorder. Only the transient rows place 1.
    check(
      [1],
      [
        ['prepend'],
        ['append'],
        ['remove', 1],
        ['remove', 10],
        ['remove', 11],
        ['append'],
        ['append'],
        ['reorder', reverse],
      ]
    );
  });

  it('2,000 random turns', () => {
    let seed = 99;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const start = [1, 2, 3, 4, 5, 6];
    const pick = () => start[Math.floor(next() * start.length)];
    for (let iteration = 0; iteration < 2_000; iteration++) {
      const ops: Op[] = [['reorder', reverse]];
      for (let i = 0; i < 1 + Math.floor(next() * 7); i++) {
        const choice = next();
        const op: Op =
          choice < 0.2
            ? ['append']
            : choice < 0.32
            ? ['prepend']
            : choice < 0.62
            ? ['remove', pick()]
            : choice < 0.75
            ? ['removeNewest']
            : ['reorder', next() < 0.5 ? reverse : rotate];
        ops.splice(Math.floor(next() * (ops.length + 1)), 0, op);
      }
      check(start, ops);
    }
  });
});

describe('composeTurnOrderEndpoints work', () => {
  /**
   * Order-delta review, item 6: a chain of transient rows each anchored to
   * the previous one, listed last first, made the placeable pass rescan
   * every row once per row released (16k rows: 22 s). Counted, not timed:
   * every anchor read is counted, and the reads must grow linearly.
   */
  const reads = (k: number): number => {
    let count = 0;
    const counted = (beforeSubject: number) => ({
      get beforeSubject() {
        count += 1;
        return beforeSubject;
      },
      get afterSubject() {
        count += 1;
        return undefined;
      },
    });
    const base = Array.from({ length: 10 }, (_, i) => i + 1);
    const transient = [];
    for (let i = k - 1; i >= 0; i--) {
      const anchor = i === 0 ? 10 : 1000 + i - 1;
      transient.push({
        subject: 1000 + i,
        created: counted(anchor),
        removed: counted(anchor),
      });
    }
    const { start, end } = composeTurnOrderEndpoints(
      [
        {
          beforeSubjects: base,
          afterSubjects: base,
          beforeFrontier: 0,
          afterFrontier: 1,
        },
      ],
      { created: [], removed: [], transient }
    );
    expect(start).toStrictEqual(base);
    expect(end).toStrictEqual(base);
    return count;
  };

  it('a removed row anchored to the end of a transient chain is placed through it', () => {
    // Transient 10 then 11 were after 2; 3 was removed after 11. The chain is
    // listed last first, so 11 waits on 10 before 3 can be placed.
    const { start } = composeTurnOrderEndpoints(
      [
        {
          beforeSubjects: [1, 2],
          afterSubjects: [2, 1],
          beforeFrontier: 0,
          afterFrontier: 1,
        },
      ],
      {
        created: [],
        removed: [{ subject: 3, anchors: { beforeSubject: 11 } }],
        transient: [
          {
            subject: 11,
            created: { beforeSubject: 10 },
            removed: { beforeSubject: 10 },
          },
          {
            subject: 10,
            created: { beforeSubject: 2 },
            removed: { beforeSubject: 2 },
          },
        ],
      }
    );
    expect(start).toStrictEqual([1, 2, 3]);
  });

  it('a chain of transient rows anchored last first is linear in anchor reads', () => {
    const small = reads(500);
    const large = reads(4000);
    expect(large).toBeLessThanOrEqual(small * 8 * 1.05);
    expect(large / 4000).toBeLessThan(20);
  });
});
