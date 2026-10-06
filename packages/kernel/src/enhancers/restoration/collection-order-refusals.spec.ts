import { afterEach, describe, expect, it } from 'vitest';

import { entityMap, signalTree, undoable } from '../../index';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { isRestorationRefusal } from '../../lib/internals/restoration-source';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * v16 slice 8g: a collection order a transition cannot reconstruct is a typed
 * refusal that changes nothing.
 *
 * These shapes threw plain errors ("frontier does not match the transition
 * endpoint", "no live placement anchor", "Collection order does not match
 * active SubjectIds", "requires transition-level delta composition"). They
 * left state and cursor unchanged, but a reader reported a failure and the text
 * named no collection. They now refuse (ST1034, naming the collection and
 * why), and the reader reports `refused`.
 *
 * Making them succeed is the 15.4.x carry
 * (`.claude/evidence/v16/carry-15.4.x/DEFECTS.md`): A, B and C succeed on v15
 * from `d33138f6` (on `6b6badc7`, `7fdcb36d`, `faa9b1f7`). D never failed on v15;
 * it entered v16 with the research line (`0ce2a320`). When a shape succeeds,
 * replace its refusal case with the state the history recorded.
 */

type Row = { id: string; n: number };
type Rows = {
  setAll(rows: Row[]): void;
  addOne(row: Row): string;
};
type Tree = {
  $: (() => unknown) & {
    count: (value?: number) => number;
    g: { rows: Rows; h: { x: (value?: number) => number } };
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
const row = (id: string, n: number): Row => ({ id, n });
const snap = (tree: Tree) => JSON.stringify(tree.$());

type Step = ['jump', number] | ['undo'] | ['redo'];
const shapes: Record<
  string,
  {
    turns: Array<(tree: Tree) => void>;
    /** Applied first; each must succeed. */
    before: Step[];
    /** The step that is refused. */
    refused: Step;
    reason: RegExp;
  }
> = {
  // Reverses two order changes of g.rows in one jump (v15 7fdcb36d, d33138f6).
  'A: a jump over two order changes of one collection': {
    turns: [
      (tree) => tree.$.g.rows.setAll([row('d', 9), row('e', 10)]),
      (tree) => tree.$.count(19),
      (tree) => tree.$.g.h.x(1),
      (tree) => tree.$.g.rows.addOne(row('a', 5)),
      (tree) =>
        tree.$.g.rows.setAll([row('a', 15), row('c', 16), row('d', 17)]),
      (tree) => tree.$.g.rows.addOne(row('b', 3)),
      (tree) =>
        tree.$.g.rows.setAll([
          row('a', 2),
          row('b', 3),
          row('c', 4),
          row('e', 5),
        ]),
    ],
    before: [],
    refused: ['jump', 4],
    reason: /more than one of its order changes/,
  },
  // Redo of a setAll after undoing to the start (v15 d33138f6).
  'B: redo of a setAll that reorders after an add': {
    turns: [
      (tree) =>
        tree.$.g.rows.setAll([row('c', 19), row('d', 20), row('e', 21)]),
      (tree) => tree.$.g.rows.addOne(row('a', 0)),
      (tree) =>
        tree.$.g.rows.setAll([row('a', 18), row('b', 19), row('c', 20)]),
    ],
    before: [['undo'], ['undo'], ['undo'], ['redo'], ['redo']],
    refused: ['redo'],
    reason: /no longer applies to its current order/,
  },
  // A jump back over two adds and a setAll (v15 d33138f6).
  'C: a jump back over adds and a setAll': {
    turns: [
      (tree) => tree.$.g.rows.addOne(row('d', 19)),
      (tree) => tree.$.g.rows.addOne(row('b', 13)),
      (tree) => tree.$.g.rows.setAll([row('b', 6), row('d', 7), row('e', 8)]),
    ],
    before: [],
    refused: ['jump', 0],
    reason: /reconstructed order and its rows disagree/,
  },
  // Redo of one turn holding two setAlls (v16 only; correct on v15 4ceb24a2).
  'D: redo of a turn holding two setAlls': {
    turns: [
      (tree) => {
        tree.$.g.rows.setAll([row('a', 9), row('c', 10)]);
        tree.$.g.rows.setAll([row('a', 6)]);
      },
    ],
    before: [['undo']],
    refused: ['redo'],
    reason: /recorded neighbours are no longer in it/,
  },
};

describe('an order a transition cannot reconstruct is refused with nothing changed (v16 8g)', () => {
  for (const [order, enhancers] of Object.entries(orders))
    for (const [shape, { turns, before, refused, reason }] of Object.entries(
      shapes
    ))
      it(`${shape} (${order})`, async () => {
        const tree = signalTree(
          {
            g: {
              rows: entityMap<Row, string>(),
              k: 0,
              s: 0,
              h: { x: 0, y: 0 },
            },
            count: 0,
          },
          { enhancers: enhancers() as never }
        ) as unknown as Tree;
        trees.push(tree);
        await flush();
        undoable(() => tree.$.count(100));
        await flush();
        for (const turn of turns) {
          undoable(() => turn(tree));
          await flush();
        }
        const step = (which: Step) =>
          which[0] === 'jump'
            ? tree.jumpTo(which[1])
            : which[0] === 'undo'
            ? tree.undo()
            : tree.redo();
        for (const each of before) {
          step(each);
          await flush();
        }
        const state = snap(tree);
        const index = tree.getCurrentIndex();
        const reader = restorationReader(tree as never)!;
        const outcomes: unknown[] = [];
        const off = reader.subscribe((event) => {
          if ((event as { kind: string }).kind === 'operation')
            outcomes.push((event as { outcome: string }).outcome);
        });
        let error: unknown;
        try {
          step(refused);
        } catch (thrown) {
          error = thrown;
        }
        await flush();
        off();
        expect(isRestorationRefusal(error)).toBe(true);
        expect((error as Error).message).toMatch(
          /^ST1034: restoration refused — the order of 'g\.rows' cannot be restored: /
        );
        expect((error as Error).message).toMatch(reason);
        expect(snap(tree)).toBe(state);
        expect(tree.getCurrentIndex()).toBe(index);
        expect(outcomes).toEqual(['refused']);
      });
});
