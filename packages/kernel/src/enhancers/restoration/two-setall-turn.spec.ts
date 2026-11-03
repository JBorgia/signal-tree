import { afterEach, describe, expect, it } from 'vitest';

import { entityMap, signalTree, undoable } from '../../index';
import { isRestorationRefusal } from '../../lib/internals/restoration-source';
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
      rows: {
        setAll(rows: Row[]): void;
        addOne(row: Row): string;
        removeOne(id: string): void;
        ids(): string[];
      };
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
  // c is created, written and removed within the turn: its field write
  // names a row that exists at neither end, and is dropped with it.
  'redo of a turn that writes a row it then removes': {
    turns: [
      (tree) => {
        tree.$.g.rows.setAll([row('a', 9), row('c', 10)]);
        tree.$.g.rows.setAll([row('a', 9), row('c', 11)]);
        tree.$.g.rows.setAll([row('a', 6)]);
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

/**
 * The distinction the ghost rows rely on (v16 8g). A neighbour the turn
 * itself created and removed is in the turn's record, and redo places by it.
 * A neighbour a LATER write removed is not, and the retained-placement-proof
 * rule still refuses: nothing can say where the row went
 * (`restoration-missing-anchors.spec.ts`).
 */
describe('an anchor the turn removed versus one a later write removed (v16 8g)', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it(`a neighbour the turn created and removed: redo places by it (${order})`, async () => {
      const tree = signalTree(
        { g: { rows: entityMap<Row, string>() }, count: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      trees.push(tree);
      undoable(() => tree.$.count(100));
      await flush();
      undoable(() => {
        tree.$.g.rows.setAll([row('a', 1), row('c', 2)]);
        tree.$.g.rows.removeOne('c');
      });
      await flush();
      const after = snap(tree);
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(snap(tree)).toBe(after);
    });

    it(`a transient row no kept row names is not kept (${order})`, async () => {
      const tree = signalTree(
        { g: { rows: entityMap<Row, string>() }, count: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      trees.push(tree);
      undoable(() => tree.$.count(100));
      await flush();
      undoable(() => tree.$.g.rows.addOne(row('x', 0)));
      await flush();
      undoable(() => {
        // t lands after x and goes again: nothing kept names it.
        tree.$.g.rows.addOne(row('t', 9));
        tree.$.g.rows.removeOne('t');
        // a's right neighbour c goes again too: a names it, so it is kept.
        tree.$.g.rows.setAll([row('x', 0), row('a', 1), row('c', 2)]);
        tree.$.g.rows.removeOne('c');
      });
      await flush();
      tree.undo();
      await flush();
      // A later write removes x, t's only recorded neighbour. Kept as a
      // ghost, t would refuse the redo for a row nothing needs.
      tree.$.g.rows.removeOne('x');
      await flush();
      tree.redo();
      await flush();
      expect(tree.$.g.rows.ids()).toEqual(['a']);
    });

    it(`a neighbour a later write removed: redo refuses, nothing changed (${order})`, async () => {
      const tree = signalTree(
        { g: { rows: entityMap<Row, string>() }, count: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      trees.push(tree);
      undoable(() => tree.$.count(100));
      await flush();
      undoable(() => tree.$.g.rows.addOne(row('c', 2)));
      await flush();
      // a lands next to c, which an earlier turn added.
      undoable(() => tree.$.g.rows.addOne(row('a', 1)));
      await flush();
      tree.undo();
      await flush();
      // An ordinary write outside history removes c, a's recorded neighbour.
      tree.$.g.rows.removeOne('c');
      await flush();
      const before = snap(tree);
      let error: unknown;
      try {
        tree.redo();
      } catch (thrown) {
        error = thrown;
      }
      await flush();
      expect(isRestorationRefusal(error)).toBe(true);
      expect((error as Error).message).toMatch(/no live placement anchor/);
      expect(snap(tree)).toBe(before);
    });
  }
});
