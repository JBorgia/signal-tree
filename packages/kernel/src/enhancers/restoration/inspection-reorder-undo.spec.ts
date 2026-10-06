import { afterEach, describe, expect, it } from 'vitest';

import {
  devTools,
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

/**
 * An inspection-only reorder (a devtools timeline jump) creates no history and
 * no external-order authority (15.4.2), and "a diagnostic snapshot must never
 * be able to refuse a legitimate undo" (DEVTOOLS-JUMP-0.1: the undo overwrites
 * the scrub). Undo of an authored order change after such a reorder refused:
 * "collection order frontier does not match the transition endpoint", because
 * the scrub replaced the order frontier the change recorded. Found by the v15
 * Link stream (repro zz-repro-reorder-undo-after-inspection; on f8ff7431 too).
 *
 * Decided: the undo applies and lands on the authored change's before order;
 * history and jumpTo read through the scrub the same way. Unrelated edits
 * still leave the scrubbed order alone (15.4.2), and a scrub that changed
 * membership rather than only order is not covered here.
 */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
type Row = { id: string; n: number };
const rows = (ids: string): Row[] =>
  [...ids].map((id) => ({ id, n: id.charCodeAt(0) }));

let jump: ((message: unknown) => void) | undefined;
const originalWindow = (globalThis as { window?: unknown }).window;
afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
  jump = undefined;
});
const installExtension = () => {
  (globalThis as { window?: unknown }).window = {
    __REDUX_DEVTOOLS_EXTENSION__: {
      connect: () => ({
        send: () => undefined,
        init: () => undefined,
        subscribe: (listener: (message: unknown) => void) => {
          jump = listener;
          return () => undefined;
        },
      }),
    },
  };
};
const inspectJumpTo = (state: unknown) =>
  jump?.({
    type: 'DISPATCH',
    payload: { type: 'JUMP_TO_STATE' },
    state: JSON.stringify(state),
  });
const base = () =>
  signalTree(
    { rows: entityMap<Row, string>(), x: 0 },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof base>;

describe.each([
  ['transactions(), restoration(), devTools()', 'tx-first'],
  ['restoration(), transactions(), devTools()', 'rest-first'],
] as const)(
  'undo of an authored reorder after an inspection reorder (%s)',
  (_name, order) => {
    const make = (): Tree =>
      signalTree(
        { rows: entityMap<Row, string>(), x: 0 },
        {
          enhancers: [
            ...(order === 'tx-first'
              ? [transactions(), restoration()]
              : [restoration(), transactions()]),
            devTools({ enabled: true, enableBrowserDevTools: true }),
          ] as never,
        }
      ) as unknown as Tree;
    const scrubbed = async () => {
      installExtension();
      const tree = make();
      tree.$.rows.setAll(rows('ABC'));
      await flush();
      undoable(() => tree.$.rows.setAll(rows('CBA')));
      await flush();
      inspectJumpTo({ rows: { all: rows('BAC') }, x: 0 });
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['B', 'A', 'C']);
      return tree;
    };

    it('undo applies, overwriting the scrub; redo and undo again follow', async () => {
      const tree = await scrubbed();
      try {
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('ABC'));
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('CBA'));
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('ABC'));
      } finally {
        tree.destroy();
      }
    });

    it('history and jumpTo read through the scrub', async () => {
      installExtension();
      const tree = make();
      try {
        tree.$.rows.setAll(rows('ABC'));
        await flush();
        undoable(() => tree.$.x(1));
        await flush();
        undoable(() => tree.$.rows.setAll(rows('CBA')));
        await flush();
        inspectJumpTo({ rows: { all: rows('BAC') }, x: 1 });
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['B', 'A', 'C']);
        // History holds authored states only: the scrub is not one.
        const states = tree
          .getRestorationHistory()
          .map(
            (entry) =>
              (entry.state as unknown as { rows: { all: Row[] } }).rows.all
          );
        expect(states).toStrictEqual([rows('ABC'), rows('CBA')]);
        tree.jumpTo(0);
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('ABC'));
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('an unrelated edit leaves the scrubbed order alone, and its undo too', async () => {
      const tree = await scrubbed();
      try {
        undoable(() => tree.$.x(1));
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['B', 'A', 'C']);
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
        expect(tree.$.rows.ids()).toStrictEqual(['B', 'A', 'C']);
      } finally {
        tree.destroy();
      }
    });

    it('two scrubs in a row: undo still lands on the authored before order', async () => {
      const tree = await scrubbed();
      try {
        inspectJumpTo({ rows: { all: rows('CAB') }, x: 0 });
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['C', 'A', 'B']);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('ABC'));
      } finally {
        tree.destroy();
      }
    });

    it('a reversal with no order change keeps the scrubbed order (a key swap)', async () => {
      const tree = await scrubbed();
      try {
        // Positions stay; keys move. Undo is declarative (a key handoff) but
        // changes no order, so it does not overwrite the scrub.
        undoable(() => {
          tree.$.rows.changeId('A', 'T');
          tree.$.rows.changeId('B', 'A');
          tree.$.rows.changeId('T', 'B');
        });
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['A', 'B', 'C']);
        tree.undo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['B', 'A', 'C']);
      } finally {
        tree.destroy();
      }
    });

    it('control: without the inspection reorder, the same undo applies', async () => {
      installExtension();
      const tree = make();
      try {
        tree.$.rows.setAll(rows('ABC'));
        await flush();
        undoable(() => tree.$.rows.setAll(rows('CBA')));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(rows('ABC'));
      } finally {
        tree.destroy();
      }
    });
  }
);
