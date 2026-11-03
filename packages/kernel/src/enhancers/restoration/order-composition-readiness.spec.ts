import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import * as orderBoundary from './order-boundary-evidence';
import { withWriteContext } from '../../lib/write-context';
import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const initial = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
];
const make = () =>
  signalTree(
    {
      rows: entityMap<(typeof initial)[number], string>({
        selectId: (r) => r.id,
      }),
    },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof make>;
const operations: readonly [string, (tree: Tree) => void][] = [
  [
    'reorder then removal',
    (t) => {
      t.$.rows.setAll([initial[2], initial[0], initial[1]]);
      t.$.rows.removeOne('a');
    },
  ],
  [
    'addition then overwrite prepend',
    (t) => {
      t.$.rows.addOne({ id: 'w', n: 4 });
      t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
    },
  ],
  [
    'membership before between after orders',
    (t) => {
      t.$.rows.addOne({ id: 'w', n: 4 });
      t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
      t.$.rows.removeOne('a');
      t.$.rows.prependMany([{ id: 'w', n: 40 }], { mode: 'overwrite' });
      t.$.rows.removeOne('z');
    },
  ],
  [
    'enclosing prepend with fresh membership',
    (t) => {
      t.$.rows.prependMany(
        [
          { id: 'x', n: 9 },
          { id: 'c', n: 30 },
        ],
        { mode: 'overwrite' }
      );
      t.$.rows.removeOne('a');
    },
  ],
];
describe('complete order capture endpoints', () => {
  it.each(operations)(
    '%s supports repeated undo and redo with held references',
    async (_name, act) => {
      const tree = make();
      try {
        tree.$.rows.setAll(initial);
        await flush();
        const held = tree.$.rows.byIdOrFail('a');
        undoable(() => act(tree));
        await flush();
        const after = tree.$.rows.all();
        for (let i = 0; i < 2; i++) {
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toEqual(initial);
          expect(held()).toEqual(initial[1]);
          expect(tree.canRedo()).toBe(true);
          tree.redo();
          await flush();
          expect(tree.$.rows.all()).toEqual(after);
          expect(tree.canUndo()).toBe(true);
        }
      } finally {
        tree.destroy();
      }
    }
  );
  it.each(operations)(
    '%s cannot cross later independent topology',
    async (_name, act) => {
      const tree = make();
      try {
        tree.$.rows.setAll(initial);
        await flush();
        undoable(() => act(tree));
        await flush();
        tree.$.rows.addOne({ id: 'independent', n: 99 });
        await flush();
        const after = tree.$.rows.all();
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$.rows.all()).toEqual(after);
        expect(tree.canUndo()).toBe(true);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('order composition across earlier causal history', () => {
  it.each(operations)(
    '%s preserves prior order authority through two cycles',
    async (_name, act) => {
      const tree = make();
      try {
        tree.$.rows.setAll(initial);
        await flush();
        const previous = [initial[1], initial[0], initial[2]];
        undoable(() => tree.$.rows.setAll(previous));
        await flush();
        undoable(() => act(tree));
        await flush();
        const after = tree.$.rows.all();
        for (let i = 0; i < 2; i++) {
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toEqual(previous);
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toEqual(initial);
          tree.redo();
          await flush();
          expect(tree.$.rows.all()).toEqual(previous);
          tree.redo();
          await flush();
          expect(tree.$.rows.all()).toEqual(after);
        }
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('interleaved independent topology', () => {
  it('does not acquire external membership between two designated orders', async () => {
    const tree = make();
    try {
      tree.$.rows.setAll(initial);
      await flush();
      undoable(() => {
        tree.$.rows.setAll([initial[2], initial[0], initial[1]]);
        withWriteContext({ intent: 'system', participation: 'realized' }, () =>
          tree.$.rows.addOne({ id: 'external', n: 99 })
        );
        tree.$.rows.prependMany([initial[1]], { mode: 'overwrite' });
      });
      await flush();
      const before = tree.$.rows.all();
      let failure: unknown;
      try {
        tree.undo();
      } catch (error) {
        failure = error;
      }
      if (failure) {
        expect(String(failure)).toMatch(/ST1034/);
        expect(tree.$.rows.all()).toEqual(before);
        expect(tree.canUndo()).toBe(true);
      } else {
        expect(tree.$.rows.byIdOrFail('external')()).toEqual({
          id: 'external',
          n: 99,
        });
        expect(tree.$.rows.ids().filter((id) => id !== 'external')).toEqual([
          'z',
          'a',
          'c',
        ]);
      }
    } finally {
      tree.destroy();
    }
  });
});

it('retains both capture channels when endpoint preparation fails before draining', async () => {
  const tree = make();
  const other = signalTree({ tick: 0 }, { enhancers: [restoration()] });
  try {
    tree.$.rows.setAll(initial);
    await flush();
    undoable(() => tree.$.rows.setAll([initial[1], initial[0], initial[2]]));
    await flush();
    const previous = tree.$.rows.all();
    const actual = orderBoundary.completeOrderCapture;
    let calls = 0;
    const fault = vi
      .spyOn(orderBoundary, 'completeOrderCapture')
      .mockImplementation((...args) => {
        // Fail historical preparation after authored preparation has succeeded.
        if (++calls === 2)
          throw new Error('controlled endpoint preparation failure');
        return actual(...args);
      });
    try {
      undoable(() => operations[0][1](tree));
      await flush();
      expect(calls).toBe(2);
    } finally {
      fault.mockRestore();
    }
    expect(tree.$.rows.ids()).toEqual(['c', 'z']);
    // A later ordinary notification retries retained history preparation. This
    // injection tests capture retirement, not process-level allocation recovery.
    other.$.tick(1);
    await flush();
    tree.undo();
    await flush();
    expect(tree.$.rows.all()).toEqual(previous);
    tree.undo();
    await flush();
    expect(tree.$.rows.all()).toEqual(initial);
  } finally {
    other.destroy();
    tree.destroy();
  }
});

it('composes caller-ordered multi-removal dependencies before a survivor reorder', async () => {
  const tree = make();
  try {
    const rows = ['A', 'B', 'C', 'D', 'E'].map((id, n) => ({ id, n }));
    tree.$.rows.setAll(rows);
    await flush();
    const held = tree.$.rows.byIdOrFail('B');
    undoable(() => {
      tree.$.rows.removeMany(['A', 'C', 'B']);
      tree.$.rows.setAll([rows[4], rows[3]]);
    });
    await flush();
    for (let i = 0; i < 2; i++) {
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toEqual(rows);
      expect(held()).toEqual(rows[1]);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toEqual([rows[4], rows[3]]);
    }
  } finally {
    tree.destroy();
  }
});

it.each([
  ['A', 'B', 'C'],
  ['A', 'C', 'B'],
  ['B', 'A', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
  ['C', 'B', 'A'],
])(
  'restores multi-removal caller order %j independently of dependency order',
  async (...removed) => {
    const tree = make();
    try {
      const rows = ['A', 'B', 'C', 'D', 'E'].map((id, n) => ({ id, n }));
      tree.$.rows.setAll(rows);
      await flush();
      undoable(() => {
        tree.$.rows.removeMany(removed);
        tree.$.rows.setAll([rows[4], rows[3]]);
      });
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toEqual(rows);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toEqual([rows[4], rows[3]]);
    } finally {
      tree.destroy();
    }
  }
);

it('restores disconnected removed runs from one frame before order reversal', async () => {
  const tree = make();
  try {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((id, n) => ({
      id,
      n,
    }));
    tree.$.rows.setAll(rows);
    await flush();
    const held = tree.$.rows.byIdOrFail('E');
    undoable(() => {
      tree.$.rows.removeMany(['A', 'D', 'G', 'B', 'E']);
      tree.$.rows.setAll([rows[7], rows[5], rows[2]]);
    });
    await flush();
    for (let i = 0; i < 2; i++) {
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toEqual(rows);
      expect(held()).toEqual(rows[4]);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toEqual([rows[7], rows[5], rows[2]]);
    }
  } finally {
    tree.destroy();
  }
});

it('captures structural boundaries without enabling field observers and releases on destroy', async () => {
  const tree = make();
  tree.$.rows.setAll(initial);
  await flush();
  const runtime = getMutationCaptureRuntime(tree)!;
  expect(runtime.hasCommittedEntityObservers?.()).toBe(false);
  expect(runtime.hasStructuralBoundaryObservers?.()).toBe(true);
  const boundary = vi.fn();
  const release = runtime.subscribeStructuralBoundary!(boundary);
  const publication = vi.spyOn(runtime, 'publishCommittedEntity');
  try {
    tree.$.rows.updateOne('a', { n: 42 });
    await flush();
    expect(boundary).not.toHaveBeenCalled();
    expect(publication).not.toHaveBeenCalled();
    tree.$.rows.addOne({ id: 'x', n: 9 });
    await flush();
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(publication).toHaveBeenCalledTimes(1);
  } finally {
    release();
    publication.mockRestore();
    tree.destroy();
  }
  expect(runtime.hasStructuralBoundaryObservers?.()).toBe(false);
  expect(runtime.hasCommittedEntityObservers?.()).toBe(false);
});

it('keeps explicitly authored reentrant order capture during restoration delivery', async () => {
  const tree = make();
  try {
    tree.$.rows.setAll(initial);
    await flush();
    undoable(() => tree.$.rows.removeOne('a'));
    await flush();
    let entered = false;
    tree.$.rows.tap({
      onAdd() {
        if (entered) return;
        entered = true;
        withWriteContext({}, () =>
          undoable(() =>
            tree.$.rows.setAll([initial[2], initial[1], initial[0]])
          )
        );
      },
    });
    tree.undo();
    await flush();
    expect(entered).toBe(true);
    expect(tree.$.rows.all()).toEqual([initial[2], initial[1], initial[0]]);
    tree.undo();
    await flush();
    expect(tree.$.rows.all()).toEqual(initial);
  } finally {
    tree.destroy();
  }
});
