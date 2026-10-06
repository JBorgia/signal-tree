import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * Taps observe every change a replay applies, symmetrically: a replay that
 * takes a row away taps `onRemove`, one that brings a row back taps `onAdd`,
 * and one that changes a row's value taps `onUpdate` — for undo, redo, jumpTo
 * and rollback alike, as path subscribers see them.
 *
 * On 15.4.3 (and until this change) a replay that removed a row tapped
 * `onRemove` but one that brought a row back tapped nothing: redo or jumpTo of
 * an add, undo of a remove, a rollback of a remove. Nothing documented either
 * behaviour (TapHandlers: "observe entity lifecycle events"), and subscribers
 * already saw both, so the adds now tap too.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const seed = async (tree: Tree) => {
  tree.$.rows.addOne({ id: 'z', n: 0 });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  await flush();
};
const watch = (tree: Tree) => {
  const taps: string[] = [];
  tree.$.rows.tap({
    onAdd: (_row, id) => void taps.push(`add:${id}`),
    onRemove: (id) => void taps.push(`remove:${id}`),
    onUpdate: (id) => void taps.push(`update:${id}`),
  });
  return taps;
};

type Case = {
  act: (tree: Tree) => unknown;
  /** Taps of undoing the act; redoing it taps the inverse. */
  undo: string[];
  redo: string[];
};
const cases: Record<string, Case> = {
  addOne: {
    act: (tree) => tree.$.rows.addOne({ id: 'b', n: 2 }),
    undo: ['remove:b'],
    redo: ['add:b'],
  },
  addMany: {
    act: (tree) =>
      tree.$.rows.addMany([
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]),
    undo: ['remove:b', 'remove:c'],
    redo: ['add:b', 'add:c'],
  },
  removeOne: {
    act: (tree) => tree.$.rows.removeOne('a'),
    undo: ['add:a'],
    redo: ['remove:a'],
  },
  updateOne: {
    act: (tree) => tree.$.rows.updateOne('a', { n: 5 }),
    undo: ['update:a'],
    redo: ['update:a'],
  },
  removeMany: {
    act: (tree) => tree.$.rows.removeMany(['z', 'a']),
    undo: ['add:z', 'add:a'],
    redo: ['remove:z', 'remove:a'],
  },
  upsertMany: {
    act: (tree) =>
      tree.$.rows.upsertMany([
        { id: 'a', n: 5 },
        { id: 'x', n: 6 },
      ]),
    undo: ['update:a', 'remove:x'],
    redo: ['update:a', 'add:x'],
  },
  setAll: {
    act: (tree) =>
      tree.$.rows.setAll([
        { id: 'a', n: 5 },
        { id: 'x', n: 6 },
      ]),
    undo: ['add:z', 'update:a', 'remove:x'],
    redo: ['remove:z', 'update:a', 'add:x'],
  },
  clear: {
    act: (tree) => tree.$.rows.clear(),
    undo: ['add:z', 'add:a'],
    redo: ['remove:z', 'remove:a'],
  },
};

const sorted = (taps: string[]) => [...taps].sort();

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('replay taps: undo, redo, jumpTo (%s)', (_name, enhancers) => {
  it.each(Object.keys(cases))('%s', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      undoable(() => cases[name].act(tree));
      await flush();
      const taps = watch(tree);
      tree.undo();
      await flush();
      expect(sorted(taps)).toStrictEqual(sorted(cases[name].undo));
      taps.length = 0;
      tree.redo();
      await flush();
      expect(sorted(taps)).toStrictEqual(sorted(cases[name].redo));
      tree.undo();
      await flush();
      taps.length = 0;
      tree.jumpTo(tree.getRestorationHistory().length - 1);
      await flush();
      expect(sorted(taps)).toStrictEqual(sorted(cases[name].redo));
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('replay taps: rollback (%s)', (_name, enhancers) => {
  it.each(Object.keys(cases))('%s', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transaction(() => cases[name].act(tree));
      await flush();
      const taps = watch(tree);
      pending.rollback();
      await flush();
      expect(sorted(taps)).toStrictEqual(sorted(cases[name].undo));
    } finally {
      tree.destroy();
    }
  });
});

describe('replay taps: a realized fresh subject', () => {
  it('taps onAdd when the realization adapter adds a subject that never existed', () => {
    const tree = make([restoration()]);
    try {
      const rows = tree.$.rows as unknown as {
        __planFreshAdd(
          key: string,
          entity: Row,
          subjectId: number
        ): { commit(): void; publish(): void };
      };
      const taps = watch(tree);
      const plan = rows.__planFreshAdd('f', { id: 'f', n: 1 }, 10_001);
      plan.commit();
      plan.publish();
      expect(taps).toStrictEqual(['add:f']);
      expect(tree.$.rows.ids()).toStrictEqual(['f']);
    } finally {
      tree.destroy();
    }
  });
});

/**
 * The exceptions TapHandlers documents (round-3 review): a rename and a
 * reorder tap nothing by themselves, and a forward setAll taps onUpdate for
 * every row it replaces even with an equal value, while its replay taps only
 * the rows whose value changes.
 */
describe('replay taps: the documented exceptions', () => {
  it.each([
    ['restoration()', () => [restoration()]],
    ['transactions(), restoration()', () => [transactions(), restoration()]],
    ['restoration(), transactions()', () => [restoration(), transactions()]],
  ] as const)('%s: changeId and a reorder-only setAll, forward and replayed', async (_name, enhancers) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const taps = watch(tree);
      undoable(() => tree.$.rows.changeId('a', 'b'));
      await flush();
      expect(taps).toStrictEqual([]);
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(taps).toStrictEqual([]);
      tree.undo();
      await flush();
      undoable(() =>
        tree.$.rows.setAll([
          { id: 'a', n: 1 },
          { id: 'z', n: 0 },
        ])
      );
      await flush();
      expect(sorted(taps)).toStrictEqual(['update:a', 'update:z']);
      taps.length = 0;
      tree.undo();
      await flush();
      tree.redo();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'z']);
      expect(taps).toStrictEqual([]);
    } finally {
      tree.destroy();
    }
  });
});
