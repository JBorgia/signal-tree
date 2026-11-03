import { describe, expect, it, vi } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
  type PendingTransaction,
} from '../../index';
import { StructuralStore } from '../../lib/physical/structural-store';

type Row = { id: string; n: number };
const seed: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
  { id: 'd', n: 4 },
];
const outer: Row[] = [
  { id: 'w', n: 5 },
  { id: 'c', n: 30 },
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'd', n: 4 },
];
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

async function setup(mixed = false) {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions(), restoration()] }
  );
  seed.forEach((row) => tree.$.rows.addOne({ ...row }));
  await flush();
  const held = tree.$.rows.byIdOrFail('a');
  let pending: PendingTransaction | undefined;
  let entered = false;
  tree.$.rows.tap({
    onAdd() {
      if (entered) return;
      entered = true;
      pending = tree.transact(() => {
        tree.$.rows.removeOne('a');
        if (mixed) tree.$.rows.addOne({ id: 'x', n: 6 });
        else tree.$.rows.removeOne('d');
      });
    },
  });
  undoable(() =>
    tree.$.rows.prependMany(
      [
        { id: 'w', n: 5 },
        { id: 'c', n: 30 },
      ],
      { mode: 'overwrite' }
    )
  );
  await flush();
  if (!pending) {
    tree.destroy();
    throw new Error('Missing pending authority');
  }
  return { tree, pending, held };
}

describe('complete structural compensation lineage controls', () => {
  for (const mixed of [false, true])
    it(`useful undo and redo after ${
      mixed ? 'remove/add' : 'two removals'
    }`, async () => {
      const { tree, pending, held } = await setup(mixed);
      try {
        expect(() => tree.undo()).toThrow(/ST1034/);
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(outer);
        expect(tree.$.rows.byIdOrFail('a')).toBe(held);
        expect(() => tree.undo()).not.toThrow();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(seed);
        expect(tree.canRedo()).toBe(true);
        expect(() => tree.redo()).not.toThrow();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(outer);
      } finally {
        tree.destroy();
      }
    });
  it('retains authority after preinstall failure, then permits useful retry', async () => {
    const { tree, pending } = await setup();
    try {
      const state = tree.$.rows.all();
      const inspection = pending.inspect();
      const fault = vi
        .spyOn(StructuralStore.prototype, 'installPreparedTarget')
        .mockImplementationOnce(() => {
          throw new Error('controlled preinstall fault');
        });
      try {
        expect(() => pending.rollback()).toThrow();
      } finally {
        fault.mockRestore();
      }
      expect(tree.$.rows.all()).toStrictEqual(state);
      expect(pending.inspect()).toStrictEqual(inspection);
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(outer);
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(seed);
    } finally {
      tree.destroy();
    }
  });
  it('preserves later independent field truth through compensation', async () => {
    const { tree, pending } = await setup();
    try {
      tree.$.rows.updateOne('z', { n: 99 });
      pending.rollback();
      await flush();
      expect(tree.$.rows.byIdOrFail('z').n()).toBe(99);
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c', 'd']);
      expect(tree.$.rows.byIdOrFail('z').n()).toBe(99);
    } finally {
      tree.destroy();
    }
  });
  it('does not erase independent topology ABA', async () => {
    const { tree, pending } = await setup();
    try {
      tree.$.rows.prependMany([{ id: 'z', n: 0 }], { mode: 'overwrite' });
      tree.$.rows.prependMany(
        [
          { id: 'w', n: 5 },
          { id: 'c', n: 30 },
        ],
        { mode: 'overwrite' }
      );
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(outer);
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.all()).toStrictEqual(outer);
    } finally {
      tree.destroy();
    }
  });
  it('refuses occupied replacement lifetime without retargeting the held reference', async () => {
    const { tree, pending, held } = await setup();
    try {
      tree.$.rows.addOne({ id: 'a', n: 100 });
      const replacement = tree.$.rows.byIdOrFail('a');
      expect(replacement).not.toBe(held);
      const state = tree.$.rows.all();
      expect(() => pending.rollback()).toThrow();
      expect(tree.$.rows.all()).toStrictEqual(state);
      expect(tree.$.rows.byIdOrFail('a')).toBe(replacement);
      expect(held()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });
  it('installs lineage before restoration callbacks can author a newer order', async () => {
    const { tree, pending } = await setup();
    try {
      let seen: string[] | undefined;
      tree.$.rows.tap({
        onAdd(_row, id) {
          if (id === 'a') {
            seen = tree.$.rows.ids();
            tree.$.rows.prependMany([{ id: 'z', n: 0 }], { mode: 'overwrite' });
          }
        },
      });
      pending.rollback();
      await flush();
      expect(seen).toStrictEqual(['w', 'c', 'z', 'a', 'd']);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'w', 'c', 'a', 'd']);
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'w', 'c', 'a', 'd']);
    } finally {
      tree.destroy();
    }
  });
  it('rejects preparation reentry before installing compensation or old lineage', async () => {
    const { tree, pending } = await setup();
    try {
      const original = StructuralStore.prototype.prepareTarget;
      const reentry = vi
        .spyOn(StructuralStore.prototype, 'prepareTarget')
        .mockImplementationOnce(function (
          this: StructuralStore<string | number>,
          ...args
        ) {
          tree.$.rows.prependMany([{ id: 'z', n: 0 }], { mode: 'overwrite' });
          return original.apply(this, args);
        });
      try {
        expect(() => pending.rollback()).toThrow();
      } finally {
        reentry.mockRestore();
      }
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'w', 'c']);
      pending.rollback();
      await flush();
      // Current successor/predecessor placement restores a/d after z;
      // the surviving callback-authored order z,w,c stays intact.
      expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'd', 'w', 'c']);
      expect(() => tree.undo()).toThrow(/ST1034/);
    } finally {
      tree.destroy();
    }
  });
  it('retires the whole compensation before a delivery error and permits history retry', async () => {
    const { tree, pending } = await setup();
    try {
      let thrown = false;
      tree.$.rows.tap({
        onAdd(_row, id) {
          if (id === 'a' && !thrown) {
            thrown = true;
            throw new Error('controlled delivery fault');
          }
        },
      });
      expect(() => pending.rollback()).toThrow();
      expect(thrown).toBe(true);
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(outer);
      expect(() => pending.rollback()).not.toThrow();
      expect(() => pending.confirm()).toThrow(
        'Cannot confirm a rolled back transaction'
      );
      expect(() => tree.undo()).not.toThrow();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(seed);
    } finally {
      tree.destroy();
    }
  });
});
