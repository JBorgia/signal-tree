import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';
import { transactions } from '../transactions/transactions';

type Row = { id: string; n: number };
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const profiles = [
  [
    'restoration',
    () => signalTree(declaration(), { enhancers: [restoration()] }),
  ],
  [
    'transactions then restoration',
    () =>
      signalTree(declaration(), { enhancers: [transactions(), restoration()] }),
  ],
  [
    'restoration then transactions',
    () =>
      signalTree(declaration(), { enhancers: [restoration(), transactions()] }),
  ],
] as const;
type Tree = ReturnType<(typeof profiles)[number][1]>;
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const state = (tree: Tree) => ({
  x: tree.$.x(),
  rows: tree.$.rows.ids().map((id) => tree.$.rows.byIdOrFail(id)()),
  ids: [...tree.$.rows.ids()],
});
const scenarios = [
  {
    name: 'separate add/field/remove/re-add/field turns',
    last: 5,
    rows: [{ id: 'a', n: 3 }],
    writes: (tree: Tree) => [
      () => tree.$.rows.addOne({ id: 'a', n: 0 }),
      () => tree.$.rows.updateOne('a', { n: 1 }),
      () => tree.$.rows.removeOne('a'),
      () => tree.$.rows.addOne({ id: 'a', n: 2 }),
      () => tree.$.rows.updateOne('a', { n: 3 }),
    ],
  },
  {
    name: 'separate add/rekey/field/remove turns',
    last: 4,
    rows: [],
    writes: (tree: Tree) => [
      () => tree.$.rows.addOne({ id: 'a', n: 0 }),
      () => tree.$.rows.changeId('a', 'b'),
      () => tree.$.rows.updateOne('b', { n: 1 }),
      () => tree.$.rows.removeOne('b'),
    ],
  },
  {
    name: 'net ghost turn followed by a live add',
    last: 1,
    rows: [{ id: 'a', n: 2 }],
    writes: (tree: Tree) => [
      () => {
        tree.$.rows.addOne({ id: 'a', n: 0 });
        tree.$.rows.updateOne('a', { n: 1 });
        tree.$.rows.removeOne('a');
      },
      () => tree.$.rows.addOne({ id: 'a', n: 2 }),
    ],
  },
] as const;

// Public counterpart to the raw helper fixtures. No observation of private plans:
// the earlier instrumented evidence found multi-turn applications; these assert
// only publicly observable source/history outcomes for the same 18 executions.
describe.each(profiles)('planner public boundaries: %s', (_name, make) => {
  describe.each(scenarios)('$name', (scenario) => {
    it.each(['jump', 'steps'] as const)(
      '%s preserves undo and redo outcomes',
      async (mode) => {
        const tree = make();
        try {
          undoable(() => tree.$.x(1));
          await flush();
          const base = state(tree);
          expect(base).toEqual({ x: 1, rows: [], ids: [] });
          expect(tree.getCurrentIndex()).toBe(0);
          for (const write of scenario.writes(tree)) {
            undoable(write);
            await flush();
          }
          const end = state(tree);
          expect(end).toEqual({
            x: 1,
            rows: scenario.rows,
            ids: scenario.rows.map((row) => row.id),
          });
          const last = tree.getCurrentIndex();
          expect(last).toBe(scenario.last);
          if (mode === 'jump') tree.jumpTo(0);
          else for (let i = last; i > 0; i--) tree.undo();
          await flush();
          expect(state(tree)).toEqual(base);
          if (mode === 'jump') tree.jumpTo(last);
          else for (let i = 0; i < last; i++) tree.redo();
          await flush();
          expect(state(tree)).toEqual(end);
        } finally {
          tree.destroy();
          await flush();
        }
      }
    );
  });
});
