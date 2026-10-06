import { afterEach, describe, expect, it } from 'vitest';

import { entityMap, signalTree, undoable } from '../../index';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * v16 slice 8g: a turn holding two `setAll`s redoes exactly.
 *
 * Redo of `setAll([a, c]); setAll([a])` in one turn threw "Collection
 * structural target has no live placement anchor" (refused from 8g 5fcac0dd),
 * and so did a jump over a turn like it. Correct on v15 at v16's base
 * (`4ceb24a2`) and on every later v15 commit tested; it entered v16 with the
 * research-line merge `0ce2a320` (`.claude/evidence/v16/slice8g/probes/order`).
 * v15's results are the oracle: each step must give the recorded state.
 */

type Row = { id: string; n: number };
type Tree = {
  $: (() => unknown) & {
    count: (value?: number) => number;
    g: {
      rows: { setAll(rows: Row[]): void; addOne(row: Row): string };
    };
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
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
const row = (id: string, n: number): Row => ({ id, n });
const snap = (tree: Tree) => JSON.stringify(tree.$());

type Step = ['undo'] | ['redo'] | ['jump', number];
const shapes: Record<
  string,
  { turns: Array<(tree: Tree) => void>; steps: Step[] }
> = {
  // The second setAll removes c, the first's anchor for its own placement.
  'redo of a turn holding two setAlls': {
    turns: [
      (tree) => {
        tree.$.g.rows.setAll([row('a', 9), row('c', 10)]);
        tree.$.g.rows.setAll([row('a', 6)]);
      },
    ],
    steps: [['undo'], ['redo']],
  },
  'redo of a turn whose second setAll keeps nothing of the first': {
    turns: [
      (tree) => {
        tree.$.g.rows.setAll([row('a', 11), row('e', 12)]);
        tree.$.g.rows.setAll([row('a', 5), row('c', 6)]);
      },
    ],
    steps: [['undo'], ['redo']],
  },
  'a jump over an add and a turn holding two setAlls': {
    turns: [
      (tree) => tree.$.g.rows.addOne(row('e', 5)),
      (tree) => {
        tree.$.g.rows.setAll([row('d', 14), row('e', 15)]);
        tree.$.g.rows.setAll([row('a', 1), row('b', 2), row('c', 3)]);
      },
    ],
    steps: [
      ['jump', 0],
      ['jump', 2],
      ['jump', 1],
    ],
  },
};

describe('a turn holding two setAlls (v16 8g)', () => {
  for (const [order, enhancers] of Object.entries(orders))
    for (const [shape, { turns, steps }] of Object.entries(shapes))
      it(`${shape} (${order})`, async () => {
        const tree = signalTree(
          { g: { rows: entityMap<Row, string>() }, count: 0 },
          { enhancers: enhancers() as never }
        ) as unknown as Tree;
        trees.push(tree);
        await flush();
        undoable(() => tree.$.count(100));
        await flush();
        const states = [snap(tree)];
        for (const turn of turns) {
          undoable(() => turn(tree));
          await flush();
          states.push(snap(tree));
        }
        let index = states.length - 1;
        for (const step of steps) {
          if (step[0] === 'undo') {
            tree.undo();
            index--;
          } else if (step[0] === 'redo') {
            tree.redo();
            index++;
          } else {
            tree.jumpTo(step[1]);
            index = step[1];
          }
          await flush();
          expect(snap(tree)).toBe(states[index]);
        }
      });
});
