// Carried from v15 2892b650 (identical at 4ceb24a2, 012fd11d and d63166c9) in
// v16 integration slice 8. Only change: `.transaction(` -> `.transact(`.
// On 269ef687 8 of 9 failed ("structural-drift"); the branch control passed.
import { describe, expect, it } from 'vitest';
import {
  entityMap,
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('opaque leaves retain terminal topology through restoration', () => {
  for (const first of [false, true]) {
    it.each([false, true])(
      `undo/redo whole object, restoration first=${first}, preceding entity transaction=%s`,
      async (preceding) => {
        const tree = signalTree(
          {
            bounds: leaf({ min: 0, max: 10 }),
            branch: { min: 0, max: 10 },
            rows: entityMap<{ id: number; name: string }, number>(),
          },
          {
            enhancers: first
              ? [restoration(), transactions()]
              : [transactions(), restoration()],
          }
        );
        try {
          if (preceding) {
            const pending = tree.transact(() =>
              tree.$.rows.addOne({ id: 1, name: 'Ada' })
            );
            pending.confirm();
            await flush();
          }
          expect('min' in tree.$.bounds).toBe(false);
          expect(tree.$.branch.min.value).toBe(0);
          undoable(() => (tree.$.bounds.value = { min: 1, max: 9 }));
          await flush();
          tree.$.branch.max.value = 20;
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.bounds.value).toEqual({ min: 0, max: 10 });
          expect(tree.$.branch()).toEqual({ min: 0, max: 20 });
          expect(tree.$.rows.ids.value).toEqual(preceding ? [1] : []);
          tree.redo();
          await flush();
          expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
          expect(tree.$.branch()).toEqual({ min: 0, max: 20 });
        } finally {
          tree.destroy();
        }
      }
    );

    it(`undoes a confirmed object-leaf transaction, restoration first=${first}`, async () => {
      const tree = signalTree(
        { bounds: leaf({ min: 0, max: 10 }) },
        {
          enhancers: first
            ? [restoration(), transactions()]
            : [transactions(), restoration()],
        }
      );
      try {
        const pending = undoable(() =>
          tree.transact(() => (tree.$.bounds.value = { min: 1, max: 9 }))
        );
        pending.confirm();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.bounds.value).toEqual({ min: 0, max: 10 });
        tree.redo();
        await flush();
        expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
      } finally {
        tree.destroy();
      }
    });
  }

  it('undoes an atomic replacement with restoration alone', async () => {
    const tree = signalTree(
      { bounds: leaf({ min: 0, max: 10 }) },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => (tree.$.bounds.value = { min: 1, max: 9 }));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.bounds.value).toEqual({ min: 0, max: 10 });
      tree.redo();
      await flush();
      expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
    } finally {
      tree.destroy();
    }
  });

  it('keeps ordinary branch children independently restorable', async () => {
    const tree = signalTree(
      { bounds: { min: 0, max: 10 } },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => (tree.$.bounds.min.value = 1));
      await flush();
      tree.$.bounds.max.value = 20;
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 20 });
      tree.redo();
      await flush();
      expect(tree.$.bounds()).toEqual({ min: 1, max: 20 });
    } finally {
      tree.destroy();
    }
  });
  it('retains external undefined as terminal truth and refuses the whole undo', async () => {
    const tree = signalTree(
      { bounds: leaf<{ min: number } | undefined>({ min: 0 }), count: 0 },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => {
        tree.$.bounds.value = { min: 1 };
        tree.$.count.value = 1;
      });
      await flush();
      external(() => (tree.$.bounds.value = undefined));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.bounds.value).toBeUndefined();
      expect(tree.$.count.value).toBe(1);
      expect(Object.prototype.hasOwnProperty.call(tree.$(), 'bounds')).toBe(true);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });
});
