import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';

type Row = { id: string; value: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('RESTORATION-POSITION-CAPTURE-0', () => {
  it.fails(
    'retains and reverses a designated pure reorder without replacing subjects',
    async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration({ maxHistorySize: 10 })] }
      );

      undoable(() =>
        tree.$.rows.setAll([
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
          { id: 'c', value: 3 },
        ])
      );
      await flush();

      const heldA = tree.$.rows.byIdOrFail('a');
      const heldB = tree.$.rows.byIdOrFail('b');
      const heldC = tree.$.rows.byIdOrFail('c');
      const before = tree.getRestorationHistory().length;

      undoable(() =>
        tree.$.rows.setAll([
          { id: 'c', value: 3 },
          { id: 'b', value: 2 },
          { id: 'a', value: 1 },
        ])
      );
      await flush();

      expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
      expect(tree.getRestorationHistory()).toHaveLength(before + 1);

      tree.undo();
      await flush();

      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(heldA()).toEqual({ id: 'a', value: 1 });
      expect(heldB()).toEqual({ id: 'b', value: 2 });
      expect(heldC()).toEqual({ id: 'c', value: 3 });

      tree.redo();
      await flush();

      expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
      expect(heldA()).toEqual({ id: 'a', value: 1 });
      expect(heldB()).toEqual({ id: 'b', value: 2 });
      expect(heldC()).toEqual({ id: 'c', value: 3 });
    }
  );
});
