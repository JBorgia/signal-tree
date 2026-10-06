import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * A refusal changes nothing. A jumpTo() from inside a view went back to the
 * confirmed state first, as its own transition, and then refused: the view
 * was gone and the tree showed the confirmed state. It is one transition from
 * the visible state now, so a refused jump leaves the view where it was:
 * state, getCurrentIndex() and history unchanged, and a later jump still
 * works from there.
 *
 * Also pinned here, found with these carriers: undoing an order change under
 * a later standing change refuses as a typed, legible ST1034 naming the
 * collection and the change; and reading history in that situation (an entry
 * undone, its anchor taken by the standing change) no longer throws.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  x: 0,
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('a refused jumpTo from a view (%s)', (_name, enhancers) => {
  // Entries: 0 x=1, 1 reverse, 2 prepend w, (standing: remove a, add y),
  // 3 prepend v. Jumping back across entry 1 refuses (identity: the
  // standing change replaced the order entry 1 recorded).
  const make = async (): Promise<Tree> => {
    const tree = signalTree(declaration(), {
      enhancers: enhancers() as never,
    }) as unknown as Tree;
    for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
    await flush();
    undoable(() => tree.$.x(1));
    await flush();
    undoable(() => tree.$.rows.setAll([...tree.$.rows.all()].reverse()));
    await flush();
    undoable(() => tree.$.rows.prependOne({ id: 'w', n: 0 }));
    await flush();
    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'y', n: 0 });
    await flush();
    undoable(() => tree.$.rows.prependOne({ id: 'v', n: 0 }));
    await flush();
    return tree;
  };
  const views: Array<[number, string]> = [
    [3, 'vwedcby'],
    [2, 'wedcby'],
    [1, 'edcby'],
  ];

  it.each(views)(
    'from the view at entry %i: the refused jumpTo(0) changes nothing',
    async (view, visible) => {
      const tree = await make();
      try {
        tree.jumpTo(view);
        await flush();
        expect(tree.$.rows.ids().join('')).toBe(visible);
        const history = JSON.stringify(tree.getRestorationHistory());
        expect(() => tree.jumpTo(0)).toThrow(
          "ST1034: restoration refused — the order of 'rows' changed after the order change being reversed, and a later change outside undo history stands on it (added 'y'; removed 'a')."
        );
        await flush();
        expect(tree.$.rows.ids().join('')).toBe(visible);
        expect(tree.$.x()).toBe(1);
        expect(tree.getCurrentIndex()).toBe(view);
        expect(JSON.stringify(tree.getRestorationHistory())).toBe(history);
        // Still a view: a jump from it works.
        tree.jumpTo(3);
        await flush();
        expect(tree.$.rows.ids().join('')).toBe('vwedcby');
        expect(tree.getCurrentIndex()).toBe(3);
      } finally {
        tree.destroy();
      }
    }
  );

  it('history reads while an entry anchored to a removed row is undone', async () => {
    // w was appended after a; the standing change removed a; with w's entry
    // undone, the history walk redoes it from the live state and found no
    // anchor ("no live placement anchor" out of getRestorationHistory()). A
    // read never throws: the walk places it without one (last), and the
    // entry's state, walked back across the standing change, is exact.
    const tree = signalTree(declaration(), {
      enhancers: enhancers() as never,
    }) as unknown as Tree;
    try {
      for (const id of 'abcde') tree.$.rows.addOne({ id, n: 0 });
      await flush();
      undoable(() => tree.$.rows.setAll([...tree.$.rows.all()].reverse()));
      await flush();
      undoable(() => tree.$.rows.addOne({ id: 'w', n: 0 }));
      await flush();
      tree.$.rows.removeOne('a');
      tree.$.rows.addOne({ id: 'y', n: 0 });
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.ids().join('')).toBe('edcby');
      const history = tree.getRestorationHistory();
      expect(history).toHaveLength(2);
      expect(
        (history[1].state as unknown as { rows: { all: Row[] } }).rows.all
          .map(({ id }) => id)
          .join('')
      ).toBe('edcbaw');
    } finally {
      tree.destroy();
    }
  });
});
