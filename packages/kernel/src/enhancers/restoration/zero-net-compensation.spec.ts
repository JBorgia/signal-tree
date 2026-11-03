import { describe, expect, it, vi } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';
import { StructuralStore } from '../../lib/physical/structural-store';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
async function setup() {
  const tree = signalTree(
    {
      value: 0,
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      other: entityMap<Row, string>({ selectId: (r) => r.id }),
    },
    { enhancers: [transactions(), restoration()] }
  );
  for (const id of ['a', 'b', 'c']) {
    tree.$.rows.addOne({ id, n: 1 });
    tree.$.other.addOne({ id, n: 1 });
  }
  await flush();
  undoable(() =>
    tree.$.rows.prependMany([{ id: 'c', n: 1 }], { mode: 'overwrite' })
  );
  await flush();
  return tree;
}
describe('known canceled structural contributions retain compensation lineage', () => {
  it('undoes after zero-net rejection without resurrecting the temporary lifetime or publishing synthetic rows/order', async () => {
    const tree = await setup();
    try {
      let held: ReturnType<typeof tree.$.rows.byIdOrFail> | undefined;
      const pending = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        held = tree.$.rows.byIdOrFail('temp');
        tree.$.rows.removeOne('temp');
      });
      expect(pending.inspect().changes).toStrictEqual([]);
      let rows = 0,
        orders = 0;
      tree.$.rows.tap({
        onAdd() {
          rows++;
        },
        onRemove() {
          rows++;
        },
        onUpdate() {
          rows++;
        },
      });
      const runtime = getMutationCaptureRuntime(tree);
      const release = runtime?.activateCapture();
      const off = runtime?.subscribeCollectionOrder?.(() => orders++);
      try {
        pending.rollback();
        await flush();
        expect(rows).toBe(0);
        expect(orders).toBe(0);
      } finally {
        off?.();
        release?.();
      }
      expect(held).toBeDefined();
      expect(held?.()).toBeUndefined();
      expect(() => pending.rollback()).not.toThrow();
      expect(() => pending.confirm()).toThrow(
        'Cannot confirm a rolled back transaction'
      );
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
      expect(held?.()).toBeUndefined();
      expect(() => tree.redo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['c', 'a', 'b']);
    } finally {
      tree.destroy();
    }
  });
  it('does not recover rejected lineage when the zero-net contribution was confirmed', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        tree.$.rows.removeOne('temp');
      });
      p.confirm();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.ids()).toStrictEqual(['c', 'a', 'b']);
    } finally {
      tree.destroy();
    }
  });
  it('empty no-write rollback leaves earlier undo useful', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => undefined);
      p.rollback();
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
    } finally {
      tree.destroy();
    }
  });
  it('does not erase independent ABA after the canceled contribution', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        tree.$.rows.removeOne('temp');
      });
      tree.$.rows.addOne({ id: 'external', n: 3 });
      tree.$.rows.removeOne('external');
      p.rollback();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.ids()).toStrictEqual(['c', 'a', 'b']);
    } finally {
      tree.destroy();
    }
  });
  it('retains empty contribution authority after a preinstall failure and supports retry', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        tree.$.rows.removeOne('temp');
      });
      const fault = vi
        .spyOn(StructuralStore.prototype, 'installCompensatedOrderFrontier')
        .mockImplementationOnce(() => {
          throw new Error('controlled frontier preinstall');
        });
      try {
        expect(() => p.rollback()).toThrow();
      } finally {
        fault.mockRestore();
      }
      expect(p.inspect().changes).toStrictEqual([]);
      expect(tree.$.rows.ids()).toStrictEqual(['c', 'a', 'b']);
      p.rollback();
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
    } finally {
      tree.destroy();
    }
  });
  it('installs canceled and nonempty collection contributions as one retryable unit', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        tree.$.rows.removeOne('temp');
        tree.$.other.removeOne('a');
        tree.$.other.removeOne('b');
      });
      const fault = vi
        .spyOn(StructuralStore.prototype, 'installPreparedTarget')
        .mockImplementationOnce(() => {
          throw new Error('controlled target preinstall');
        });
      try {
        expect(() => p.rollback()).toThrow();
      } finally {
        fault.mockRestore();
      }
      expect(tree.$.other.ids()).toStrictEqual(['c']);
      let observed: string[] | undefined;
      tree.$.other.tap({
        onAdd() {
          observed = tree.$.rows.ids();
        },
      });
      p.rollback();
      await flush();
      expect(observed).toStrictEqual(['c', 'a', 'b']);
      expect(tree.$.other.ids()).toStrictEqual(['a', 'b', 'c']);
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
    } finally {
      tree.destroy();
    }
  });
  it('carries canceled collection lineage alongside scalar compensation', async () => {
    const tree = await setup();
    try {
      const p = tree.transact(() => {
        tree.$.rows.addOne({ id: 'temp', n: 2 });
        tree.$.rows.removeOne('temp');
        tree.$.value(4);
      });
      p.rollback();
      expect(tree.$.value()).toBe(0);
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['a', 'b', 'c']);
    } finally {
      tree.destroy();
    }
  });
});
