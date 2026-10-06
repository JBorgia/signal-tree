import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * A new write truncates the redo future (or the future of a jumpTo view).
 * The discarded entries' claims on rows were released BEFORE the new entry
 * took its own, so a row only the discarded entries claimed was offered for
 * reclamation although the new entry removes it: undo of `setAll(DCBA);
 * undo(); removeMany(A, B)` threw "Subject 1 cannot enter the structural
 * target" and the rows stayed removed. Found by the v15 Link stream
 * (repro zz-repro-undo-after-redo-truncation); on f8ff7431 too.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const rows = (ids: string): Row[] =>
  [...ids].map((id) => ({ id, n: id.charCodeAt(0) }));

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('undo after a truncated redo future (%s)', (_name, enhancers) => {
  const make = () =>
    signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: enhancers() as never }
    ) as unknown as ReturnType<
      typeof signalTree<{ rows: ReturnType<typeof entityMap<Row, string>> }>
    > & {
      undo(): void;
      redo(): void;
      jumpTo(index: number): void;
      canRedo(): boolean;
      getRestorationHistory(): unknown[];
    };

  it('a removal recorded after an undone reorder undoes and redoes', async () => {
    const tree = make();
    try {
      tree.$.rows.setAll(rows('ABCD'));
      await flush();
      undoable(() => tree.$.rows.setAll(rows('DCBA')));
      await flush();
      tree.undo();
      await flush();
      undoable(() => tree.$.rows.removeMany(['A', 'B']));
      await flush();
      expect(tree.canRedo()).toBe(false);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(rows('ABCD'));
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(rows('CD'));
      expect(tree.getRestorationHistory()).toHaveLength(1);
    } finally {
      tree.destroy();
    }
  });

  it('a removal recorded during a jumpTo view undoes', async () => {
    const tree = make();
    try {
      tree.$.rows.setAll(rows('ABCD'));
      await flush();
      undoable(() => tree.$.rows.updateOne('A', { n: 1 }));
      await flush();
      undoable(() => tree.$.rows.setAll(rows('DCBA')));
      await flush();
      tree.jumpTo(0);
      await flush();
      undoable(() => tree.$.rows.removeMany(['A', 'B']));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'A', n: 1 },
        ...rows('BCD'),
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('control: the removal alone undoes', async () => {
    const tree = make();
    try {
      tree.$.rows.setAll(rows('ABCD'));
      await flush();
      undoable(() => tree.$.rows.removeMany(['A', 'B']));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(rows('ABCD'));
    } finally {
      tree.destroy();
    }
  });
});
