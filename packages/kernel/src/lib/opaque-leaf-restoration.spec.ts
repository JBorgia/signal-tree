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
import type { LeafDefinition } from '../index';
import { transactionLifecycleReader } from '../internals';

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
            const pending = tree.transaction(() =>
              tree.$.rows.addOne({ id: 1, name: 'Ada' })
            );
            pending.confirm();
            await flush();
          }
          expect('min' in tree.$.bounds).toBe(false);
          expect(typeof tree.$.branch.min).toBe('function');
          undoable(() => tree.$.bounds({ min: 1, max: 9 }));
          await flush();
          tree.$.branch.max(20);
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
          expect(tree.$.branch()).toEqual({ min: 0, max: 20 });
          expect(tree.$.rows.ids()).toEqual(preceding ? [1] : []);
          tree.redo();
          await flush();
          expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
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
          tree.transaction(() => tree.$.bounds({ min: 1, max: 9 }))
        );
        pending.confirm();
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
        tree.redo();
        await flush();
        expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
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
      undoable(() => tree.$.bounds({ min: 1, max: 9 }));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
      tree.redo();
      await flush();
      expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
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
      undoable(() => tree.$.bounds.min(1));
      await flush();
      tree.$.bounds.max(20);
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

  it.each([null, { min: 0, max: 10 }])(
    'restores the entire terminal value across shape changes from %s',
    async (initial) => {
      const tree = signalTree(
        { bounds: leaf<{ min: number; max?: number } | null>(initial) },
        { enhancers: [restoration()] }
      );
      try {
        undoable(() => tree.$.bounds({ min: 2 }));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.bounds()).toEqual(initial);
        tree.redo();
        await flush();
        expect(tree.$.bounds()).toEqual({ min: 2 });
      } finally {
        tree.destroy();
      }
    }
  );

  it('rolls back an atomic object leaf without a restoration enhancer', () => {
    const tree = signalTree(
      { bounds: leaf({ min: 0, max: 10 }) },
      { enhancers: [transactions()] }
    );
    try {
      const pending = tree.transaction(() => tree.$.bounds({ min: 1, max: 9 }));
      pending.rollback();
      expect(tree.$.bounds()).toEqual({ min: 0, max: 10 });
    } finally {
      tree.destroy();
    }
  });

  it('still refuses to overwrite external truth, including a safe sibling', async () => {
    const tree = signalTree(
      { bounds: leaf({ min: 0, max: 10 }), count: 0 },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => {
        tree.$.bounds({ min: 1, max: 9 });
        tree.$.count(1);
      });
      await flush();
      external(() => tree.$.bounds({ min: 2, max: 8 }));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.bounds()).toEqual({ min: 2, max: 8 });
      expect(tree.$.count()).toBe(1);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('keeps pending overlap refusal atomic and retries after settlement', async () => {
    const tree = signalTree(
      { bounds: leaf({ min: 0, max: 10 }), count: 0 },
      { enhancers: [transactions(), restoration()] }
    );
    try {
      const pending = tree.transaction(() => tree.$.bounds({ min: 1, max: 9 }));
      undoable(() => {
        tree.$.bounds({ min: 2, max: 8 });
        tree.$.count(1);
      });
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034.*pending/);
      expect(tree.$.bounds()).toEqual({ min: 2, max: 8 });
      expect(tree.$.count()).toBe(1);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
      pending.confirm();
      tree.undo();
      expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
      expect(tree.$.count()).toBe(0);
      tree.redo();
      expect(tree.$.bounds()).toEqual({ min: 2, max: 8 });
      expect(tree.$.count()).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('still refuses structural drift before reversing an atomic leaf sibling', async () => {
    const tree = signalTree(
      {
        bounds: leaf({ min: 0, max: 10 }),
        rows: entityMap<{ id: number }, number>(),
      },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.addOne({ id: 1 });
      await flush();
      undoable(() => {
        tree.$.bounds({ min: 1, max: 9 });
        tree.$.rows.changeId(1, 2);
      });
      await flush();
      external(() => tree.$.rows.changeId(2, 3));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/structural-drift/);
      expect(tree.$.bounds()).toEqual({ min: 1, max: 9 });
      expect(tree.$.rows.ids()).toEqual([3]);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
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
        tree.$.bounds({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      external(() => tree.$.bounds(undefined));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.bounds()).toBeUndefined();
      expect(tree.$.count()).toBe(1);
      expect(Object.prototype.hasOwnProperty.call(tree.$(), 'bounds')).toBe(
        true
      );
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('refuses redo after external undefined without changing the history position', async () => {
    const tree = signalTree(
      { bounds: leaf<{ min: number } | undefined>({ min: 0 }), count: 0 },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => {
        tree.$.bounds({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.bounds()).toEqual({ min: 0 });
      expect(tree.$.count()).toBe(0);
      expect(tree.canRedo()).toBe(true);
      external(() => tree.$.bounds(undefined));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.redo()).toThrow(/ST1034/);
      expect(tree.$.bounds()).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(tree.$(), 'bounds')).toBe(
        true
      );
      expect(tree.$.count()).toBe(0);
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(true);
    } finally {
      tree.destroy();
    }
  });

  it.each(['transactions', 'transactions-first', 'restoration-first'])(
    'rollback preserves external undefined with complete reversal or atomic refusal: %s',
    async (order) => {
      const enhancers =
        order === 'transactions'
          ? [transactions()]
          : order === 'transactions-first'
          ? [transactions(), restoration()]
          : [restoration(), transactions()];
      const tree = signalTree(
        { bounds: leaf<{ min: number } | undefined>({ min: 0 }), count: 0 },
        { enhancers }
      );
      try {
        const lifecycle = transactionLifecycleReader(tree);
        expect(lifecycle).toBeDefined();
        const pending = tree.transaction(() => {
          tree.$.bounds({ min: 1 });
          tree.$.count(1);
        });
        expect(lifecycle!.snapshot().pending).toHaveLength(1);
        await flush();
        external(() => tree.$.bounds(undefined));
        await flush();
        let refused = false;
        try {
          pending.rollback();
        } catch (error) {
          refused = true;
          expect(String(error)).toMatch(/could not rollback/);
        }
        expect(tree.$.bounds()).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(tree.$(), 'bounds')).toBe(
          true
        );
        if (refused) {
          expect(tree.$.count()).toBe(1);
          expect(lifecycle!.snapshot().pending).toHaveLength(1);
          pending.confirm();
          expect(lifecycle!.snapshot().pending).toHaveLength(0);
          expect(tree.$.bounds()).toBeUndefined();
          expect(tree.$.count()).toBe(1);
        } else {
          expect(tree.$.count()).toBe(0);
          expect(lifecycle!.snapshot().pending).toHaveLength(0);
        }
      } finally {
        tree.destroy();
      }
    }
  );

  it('does not treat a retained slot as permission to restore an externally omitted terminal', async () => {
    const initial: { bounds?: LeafDefinition<{ min: number }>; count: number } =
      {
        bounds: leaf({ min: 0 }),
        count: 0,
      };
    const tree = signalTree(initial, { enhancers: [restoration()] });
    const bounds = tree.$.bounds!;
    try {
      undoable(() => {
        bounds({ min: 1 });
        tree.$.count(1);
      });
      await flush();
      external(() => tree.$({ count: 1 }));
      await flush();
      expect(Object.prototype.hasOwnProperty.call(tree.$(), 'bounds')).toBe(
        false
      );
      expect(bounds()).toBeUndefined();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$()).toEqual({ count: 1 });
      expect(bounds()).toBeUndefined();
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });
});
