import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { external } from '../../lib/external';
import { undoable } from '../../lib/undoable';
import { interceptLocationWrites, isWritableLocation } from '../../lib/internals/location-runtime';
import { deferredWriteScopeIdentity } from '../../lib/internals/deferred-write-scope';
import type { Enhancer } from '../../lib/types';
import { batching } from './batching';
import { transactions } from '../transactions/transactions';
import { restoration } from '../restoration/restoration';

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const create = () =>
  signalTree(
    { x: 0, y: 0 },
    { enhancers: [batching(), transactions(), restoration()] }
  );

describe('deferred writes preserve semantic scopes', () => {
  it.each([false, true])(
    'releases all queued obligations after an apply failure (destroy=%s)',
    (destroyInside) => {
      let rejecting = true;
      const failure = new Error('first queued apply failed');
      const hits = { x: 0, y: 0 };
      const probe: Enhancer<unknown> = (tree) => {
        const root = tree.$ as unknown as Record<string, unknown>;
        for (const key of ['x', 'y'] as const) {
          const location = root[key];
          if (!isWritableLocation(location)) throw new Error('Probe requires a writable location');
          tree.registerCleanup(
            interceptLocationWrites(location, (_operation, proceed) => {
              hits[key]++;
              if (key === 'x' && rejecting) throw failure;
              proceed();
            })
          );
        }
        return tree;
      };
      const tree = signalTree(
        { x: 0, y: 0 },
        { enhancers: [probe, batching()] }
      );
      try {
        undoable(() => {
          const obligations =
            deferredWriteScopeIdentity() as ReadonlySet<unknown>;
          for (let index = 0; index < 100; index++) {
            expect(() =>
              tree.coalesce(() => {
                tree.$.x(1);
                tree.$.y(2);
              })
            ).toThrow(failure);
          }
          expect(hits).toEqual({ x: 100, y: 0 });
          expect(obligations.size).toBe(0);
          rejecting = false;
          tree.coalesce(() => {
            tree.$.x(3);
            tree.$.y(4);
          });
          if (destroyInside) tree.destroy();
          expect(obligations.size).toBe(0);
        });
        expect(hits).toEqual({ x: 101, y: 1 });
      } finally {
        tree.destroy();
      }
    }
  );

  it('opening one tree transaction does not drain another tree coalesce', () => {
    const first = create();
    const second = create();
    try {
      second.coalesce(() => {
        second.$.x(9);
        first.transaction(() => first.$.x(1)).confirm();
        expect(second.$.x()).toBe(0);
      });
      expect(second.$.x()).toBe(9);
    } finally {
      first.destroy();
      second.destroy();
    }
  });

  it.each([
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ])('preserves callback authority in enhancer order %s/%s/%s', (a, b, c) => {
    const enhancers = [batching(), transactions(), restoration()] as const;
    const tree = signalTree(
      { x: 0 },
      { enhancers: [enhancers[a], enhancers[b], enhancers[c]] }
    );
    try {
      let pending!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        pending = tree.transaction(() => tree.$.x(1));
      });
      expect(tree.$.x()).toBe(1);
      pending.rollback();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('a scoped replacement does not erase an earlier queued ordinary contribution', () => {
    const tree = create();
    try {
      let pending!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        tree.$.x(1);
        pending = tree.transaction(() => tree.$.x(2));
      });
      expect(tree.$.x()).toBe(2);
      pending.rollback();
      expect(tree.$.x()).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('outer coalesce preserves transaction authority through later rollback', async () => {
    const tree = create();
    try {
      let pending!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        pending = tree.transaction(() => tree.$.x(1));
      });
      expect(tree.$.x()).toBe(1);
      pending.rollback();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('settling inside coalesce cannot precede the writes it owns', () => {
    const tree = create();
    try {
      tree.coalesce(() => {
        const pending = tree.transaction(() => tree.$.x(1));
        pending.rollback();
      });
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('failed transaction cannot enqueue writes which land after compensation', () => {
    const tree = create();
    try {
      const failure = new Error('callback failed');
      expect(() =>
        tree.coalesce(() =>
          tree.transaction(() => {
            tree.$.x(1);
            throw failure;
          })
        )
      ).toThrow(failure);
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('transaction around coalesce still compensates every write', () => {
    const tree = create();
    try {
      const pending = tree.transaction(() =>
        tree.coalesce(() => {
          tree.$.x(1);
          tree.$.y(2);
        })
      );
      pending.rollback();
      expect([tree.$.x(), tree.$.y()]).toEqual([0, 0]);
    } finally {
      tree.destroy();
    }
  });
  it('undo designation survives an outer coalesce', async () => {
    const tree = create();
    try {
      tree.coalesce(() => undoable(() => tree.$.x(1)));
      await tick();
      expect(tree.canUndo()).toBe(true);
      tree.undo();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('external updates stay external inside coalesce and undo designation', async () => {
    const tree = create();
    try {
      tree.coalesce(() => undoable(() => external(() => tree.$.x(2))));
      await tick();
      expect(tree.$.x()).toBe(2);
      expect(tree.canUndo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });
  it('external update inside an outer coalesce survives an earlier transaction rollback', async () => {
    const tree = create();
    try {
      const pending = tree.transaction(() => tree.$.x(1));
      tree.coalesce(() => external(() => tree.$.x(2)));
      await tick();
      pending.rollback();
      expect(tree.$.x()).toBe(2);
    } finally {
      tree.destroy();
    }
  });
  it('independent semantic scopes in one coalesce do not exchange writes', () => {
    const tree = create();
    try {
      let first!: ReturnType<typeof tree.transaction>;
      let second!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        first = tree.transaction(() => tree.$.x(1));
        second = tree.transaction(() => tree.$.y(2));
      });
      first.rollback();
      second.confirm();
      expect([tree.$.x(), tree.$.y()]).toEqual([0, 2]);
    } finally {
      tree.destroy();
    }
  });
  it('keeps each overlapping transaction independently settleable after coalescing', () => {
    const tree = create();
    try {
      let first!: ReturnType<typeof tree.transaction>;
      let second!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        first = tree.transaction(() => {
          tree.$.x(1);
          tree.$.x(2);
        });
        second = tree.transaction(() => tree.$.x(3));
      });
      expect(tree.$.x()).toBe(3);
      second.rollback();
      expect(tree.$.x()).toBe(2);
      first.rollback();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('keeps the context of an earlier replacement when an updater drains it', async () => {
    const tree = create();
    try {
      let pending!: ReturnType<typeof tree.transaction>;
      tree.coalesce(() => {
        tree.$.x(5);
        pending = tree.transaction(() => tree.$.x((value) => value + 1));
      });
      expect(tree.$.x()).toBe(6);
      pending.rollback();
      expect(tree.$.x()).toBe(5);
    } finally {
      tree.destroy();
    }
  });
  it('does not confuse a literal dotted key with a nested location', () => {
    const tree = signalTree(
      { 'a.b': 0, a: { b: 0 } },
      { enhancers: [batching()] }
    );
    try {
      tree.coalesce(() => {
        tree.$['a.b'](1);
        tree.$.a.b(2);
      });
      expect([tree.$['a.b'](), tree.$.a.b()]).toEqual([1, 2]);
    } finally {
      tree.destroy();
    }
  });
});
