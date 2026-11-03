import { describe, expect, it, vi } from 'vitest';
import { SignalTreeRollbackError } from './types';
import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { undoable } from './undoable';
import { link } from './link';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { applyState } from './utils';

// Explicit fixture installation earns these local carriers; arbitrary public indices stay unknown.
type InstalledNumber = { (): number; (value: number): void };
type InstalledRow = { (): { n: number } | undefined; n: InstalledNumber };

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('owner-authorized whole-value new keys', () => {
  it('installs new scalar, undefined, array and nested keys after a primed snapshot', () => {
    const tree = signalTree({
      rows: { a: { n: 1 } } as Record<string, { n: number }>,
      values: {} as Record<string, unknown>,
    });
    try {
      expect(tree.$.rows()).toEqual({ a: { n: 1 } });
      tree.$.rows({ b: { n: 2 } });
      expect(tree.$.rows()).toEqual({ b: { n: 2 } });
      expect((tree.$.rows.b as InstalledRow).n()).toBe(2);
      tree.$.values({ scalar: 3, undef: undefined, array: [1, 2] });
      expect(tree.$.values()).toStrictEqual({
        scalar: 3,
        undef: undefined,
        array: [1, 2],
      });
      expect(Object.keys(tree.$.values)).toEqual(['scalar', 'undef', 'array']);
    } finally {
      tree.destroy();
    }
  });

  it('tracks new membership for transaction inspection and rollback', async () => {
    const tree = signalTree(
      { rows: {} as Record<string, { n: number }> },
      { enhancers: [transactions()] }
    );
    try {
      const pending = tree.transact(() => tree.$.rows({ b: { n: 2 } }));
      const held = tree.$.rows.b as InstalledRow;
      expect(pending.inspect().changes.length).toBeGreaterThan(0);
      pending.rollback();
      expect(tree.$.rows()).toEqual({});
      expect(held()).toBeUndefined();
      pending.rollback();
      tree.$.rows({ b: { n: 4 } });
      expect(tree.$.rows.b).toBe(held);
      expect(held.n()).toBe(4);
    } finally {
      tree.destroy();
    }
    await flush();
  });

  it('undoes and redoes creation with stable held identity', async () => {
    const tree = signalTree(
      { rows: {} as Record<string, { n: number }> },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.rows({ b: { n: 2 } }));
      const held = tree.$.rows.b as InstalledRow;
      await flush();
      tree.undo();
      expect(tree.$.rows()).toEqual({});
      await flush();
      tree.redo();
      expect(tree.$.rows()).toEqual({ b: { n: 2 } });
      expect(tree.$.rows.b).toBe(held);
    } finally {
      tree.destroy();
    }
  });

  it('keeps a pre-existing Link observing newly supplied descendants', async () => {
    const tree = signalTree({ rows: {} as Record<string, { n: number }> });
    const sent: unknown[] = [];
    const relationship = link(tree.$.rows, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      tree.$.rows({ b: { n: 2 } });
      await flush();
      await relationship.settled();
      expect(sent).toEqual([{ b: { n: 2 } }]);
      (tree.$.rows.b as InstalledRow).n(3);
      await flush();
      await relationship.settled();
      expect(sent).toEqual([{ b: { n: 2 } }, { b: { n: 3 } }]);
    } finally {
      relationship.dispose();
      tree.destroy();
    }
  });

  it('preserves internal applyState unknown-key ignore', () => {
    const tree = signalTree({ known: 1 } as Record<string, number>);
    try {
      applyState(tree.$, { other: 2 });
      expect(tree.$()).toEqual({ known: 1 });
      expect(Object.prototype.hasOwnProperty.call(tree.$, 'other')).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('preparation failure in a nested new child leaves the complete write untouched', () => {
    const tree = signalTree({
      count: 1,
      rows: {} as Record<string, { n: number }>,
    });
    const failure = new Error('construction failed');
    const bad = {
      get n(): number {
        throw failure;
      },
    };
    try {
      expect(() => tree.$({ count: 2, rows: { bad } })).toThrow(failure);
      expect(tree.$()).toEqual({ count: 1, rows: {} });
      expect(Object.prototype.hasOwnProperty.call(tree.$.rows, 'bad')).toBe(
        false
      );
    } finally {
      tree.destroy();
    }
  });

  it('retains newly installed membership responsibility after a failed rollback', () => {
    const tree = signalTree(
      { rows: {} as Record<string, { n: number }> },
      { enhancers: [transactions()] }
    );
    try {
      const first = tree.transact(() => tree.$.rows({ b: { n: 2 } }));
      const second = tree.transact(() => (tree.$.rows.b as InstalledRow).n(3));
      expect(() => first.rollback()).toThrow();
      expect(tree.$.rows()).toEqual({ b: { n: 3 } });
      second.rollback();
      first.rollback();
      expect(tree.$.rows()).toEqual({});
    } finally {
      tree.destroy();
    }
  });

  it('installs inherited-name keys as own state while rejecting prototype pollution', () => {
    const tree = signalTree({} as Record<string, number>);
    try {
      tree.$({ constructor: 1, toString: 2, name: 3, length: 4 });
      expect(tree.$()).toEqual({
        constructor: 1,
        toString: 2,
        name: 3,
        length: 4,
      });
      tree.$(JSON.parse('{"__proto__":{"polluted":true},"safe":5}'));
      expect(tree.$()).toEqual({ safe: 5 });
      expect(Object.getPrototypeOf(tree.$)).toBe(Function.prototype);
    } finally {
      tree.destroy();
    }
  });

  it.each(['name', 'length', 'constructor', 'toString'])(
    'captures creation of %s despite callable metadata',
    (key) => {
      const tree = signalTree({} as Record<string, number>, {
        enhancers: [transactions()],
      });
      try {
        const pending = tree.transact(() => tree.$({ [key]: 3 }));
        expect(tree.$()).toEqual({ [key]: 3 });
        expect(pending.inspect().changes.length).toBeGreaterThan(0);
        pending.rollback();
        expect(tree.$()).toEqual({});
      } finally {
        tree.destroy();
      }
    }
  );

  it('keeps the identity of a member created by a nested updater', () => {
    const tree = signalTree({ trigger: { x: 0 } } as {
      trigger: { x: number };
      fresh?: number;
    });
    let held: typeof tree.$.fresh;
    try {
      tree.$({
        trigger: (() => {
          tree.$({ trigger: { x: 0 }, fresh: 9 });
          held = tree.$.fresh;
          return { x: 1 };
        }) as unknown as { x: number },
        fresh: 1,
      });
      expect(tree.$.fresh).toBe(held!);
      // This is updater execution, not settlement delivery: the returned outer
      // whole value installs afterward, as it does for an initially seeded key.
      expect(tree.$().fresh).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('refuses removal of a created branch with a confirmed descendant dependency', async () => {
    const tree = signalTree(
      { rows: {} as Record<string, { n: number }> },
      { enhancers: [transactions()] }
    );
    try {
      const pending = tree.transact(() => tree.$.rows({ b: { n: 2 } }));
      const later = tree.transact(() => (tree.$.rows.b as InstalledRow).n(3));
      later.confirm();
      await flush();
      expect(() => pending.rollback()).toThrow();
      expect(tree.$.rows()).toEqual({ b: { n: 3 } });
      pending.confirm();
      expect(tree.$.rows()).toEqual({ b: { n: 3 } });
    } finally {
      tree.destroy();
    }
  });

  it('does useful rollback with unrelated later truth and exact callback error identity', () => {
    const tree = signalTree(
      { rows: {} as Record<string, { n: number }>, count: 0 },
      { enhancers: [transactions()] }
    );
    const failure = Object.freeze({ callback: 'failed' });
    try {
      const pending = tree.transact(() => tree.$.rows({ b: { n: 2 } }));
      tree.$.count(4);
      pending.rollback();
      expect(tree.$()).toEqual({ rows: {}, count: 4 });
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.rows({ c: { n: 3 } });
          throw failure;
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(failure);
      expect(tree.$()).toEqual({ rows: {}, count: 4 });
    } finally {
      tree.destroy();
    }
  });

  it('does not expose construction marker definitions from a new ordinary subtree', () => {
    const tree = signalTree({
      count: 1,
      values: {} as Record<string, unknown>,
    });
    try {
      expect(() =>
        tree.$({
          count: 2,
          values: {
            nested: {
              rows: entityMap<{ id: string }, string>({
                selectId: (row) => row.id,
              }),
            },
          },
        })
      ).toThrow(/marker definitions/);
      expect(tree.$()).toEqual({ count: 1, values: {} });
    } finally {
      tree.destroy();
    }
  });

  it('repeated preparation failures retain no unpublished scalar payloads', () => {
    const tree = signalTree({ rows: {} as Record<string, unknown> }, { enhancers: [transactions()] });
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const slots = runtime.slotCount();
    try {
      for (let i = 0; i < 5; i++) {
        expect(() => tree.$.rows({
          good: { payload: new Uint8Array(100_000) },
          bad: { get n() { throw new Error('bad'); } },
        })).toThrow('bad');
        expect(tree.$()).toEqual({ rows: {} });
        expect(runtime.slotCount()).toBe(slots);
      }
      tree.$.rows({ good: { payload: 3 } });
      expect(tree.$.rows()).toEqual({ good: { payload: 3 } });
      expect(runtime.slotCount()).toBe(slots + 1);
    } finally { tree.destroy(); }
  });

  it('application equality failure retains no uninstalled prepared payloads', () => {
    const initial: { trigger: { x: number }[]; fresh?: Uint8Array } = { trigger: [{ x: 0 }] };
    const tree = signalTree(initial, { enhancers: [transactions()] });
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const slots = runtime.slotCount();
    const counts: number[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        expect(() => tree.$({
          trigger: [{ get x(): number { throw new Error('equality failure'); } }],
          fresh: new Uint8Array(100_000),
        })).toThrow('equality failure');
        expect(tree.$()).toEqual({ trigger: [{ x: 0 }] });
        counts.push(runtime.slotCount());
      }
      expect(counts).toEqual(Array(5).fill(slots));
    } finally { tree.destroy(); }
  });

  it('validates opaque construction diagnostics before registering sibling slots', () => {
    const tree = signalTree({ rows: {} as Record<string, unknown> }, { enhancers: [transactions()] });
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const slots = runtime.slotCount();
    try {
      for (let i = 0; i < 5; i++) {
        const bad: unknown[] = [];
        Object.defineProperty(bad, '0', { get() { throw new Error('array diagnostic getter'); } });
        expect(() => tree.$.rows({ fresh: { good: new Uint8Array(100_000), bad } })).toThrow('array diagnostic getter');
        expect(tree.$.rows()).toEqual({});
        expect(runtime.slotCount()).toBe(slots);
      }
      const payload = new Uint8Array(8);
      tree.$.rows({ fresh: { good: payload, bad: [] } });
      expect(tree.$.rows()).toEqual({ fresh: { good: payload, bad: [] } });
      expect(runtime.slotCount()).toBe(slots + 2);
    } finally { tree.destroy(); }
  });

  it('preserves reentrant installed handles when outer private preparation throws', () => {
    const tree = signalTree({ rows: {} as Record<string, unknown>, kept: {} as Record<string, number> }, { enhancers: [transactions()] });
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const slots = runtime.slotCount();
    try {
      const held: Array<() => number> = [];
      for (let i = 0; i < 5; i++) {
        const bad: unknown[] = [];
        Object.defineProperty(bad, '0', { get() {
          tree.$.kept({ ...tree.$.kept(), ['saved' + i]: i });
          held.push(tree.$.kept['saved' + i] as InstalledNumber);
          throw new Error('reentrant diagnostic');
        } });
        expect(() => tree.$.rows({ fresh: { good: new Uint8Array(100_000), bad } })).toThrow('reentrant diagnostic');
        expect(tree.$.rows()).toEqual({});
        expect(runtime.slotCount()).toBe(slots + i + 1);
        expect(held.map(read => read())).toEqual(Array.from({ length: i + 1 }, (_, n) => n));
      }
      const pending = tree.transact(() => (tree.$.kept.saved0 as InstalledNumber)(100));
      expect(held[0]()).toBe(100);
      pending.rollback();
      expect(held[0]()).toBe(0);
      expect(tree.$.kept.saved0).toBe(held[0]);
    } finally { tree.destroy(); }
  });

  it('aborts installed new membership when a later existing value throws', () => {
    const failure = new Error('later equality failure');
    const initial: { trigger: { x: number }[]; fresh?: number } = { trigger: [{ x: 0 }] };
    const tree = signalTree(initial, { enhancers: [transactions()] });
    try {
      expect(() => tree.transact(() => tree.$({
        fresh: 123,
        trigger: [{ get x(): number { throw failure; } }],
      }))).toThrow(failure);
      expect(tree.$()).toEqual({ trigger: [{ x: 0 }] });
    } finally { tree.destroy(); }
  });

  it('aborts the seeded-key control when a later existing value throws', () => {
    const failure = new Error('later equality failure');
    const tree = signalTree(
      { trigger: [{ x: 0 }], fresh: 0 }, { enhancers: [transactions()] }
    );
    try {
      expect(() => tree.transact(() => tree.$({
        fresh: 123,
        trigger: [{ get x(): number { throw failure; } }],
      }))).toThrow(failure);
      expect(tree.$()).toEqual({ trigger: [{ x: 0 }], fresh: 0 });
    } finally { tree.destroy(); }
  });

  it('preserves entry order during equality and coherence after grouped delivery', () => {
    const initial: { trigger: { x: number }[]; fresh?: number } = { trigger: [{ x: 0 }] };
    const tree = signalTree(initial, { enhancers: [transactions()] });
    const seen: unknown[] = [];
    try {
      expect(tree.$()).toEqual(initial); // prime the snapshot
      const pending = tree.transact(() => tree.$({ fresh: 123, trigger: [{ get x() {
        seen.push([tree.$.fresh?.(), tree.$().fresh]);
        return 1;
      } }] }));
      expect(seen.length).toBeGreaterThan(0);
      // `fresh` is installed before the later equality getter executes.
      // SignalTree readers are current regardless of earlier acquisition;
      // this does not promise preinstallation visibility of `trigger`.
      expect(seen).toEqual(seen.map(() => [123, 123]));
      expect(tree.$().fresh).toBe(123);
      pending.rollback();
      expect(tree.$()).toEqual(initial);
    } finally { tree.destroy(); }
  });

  it('exposes usable recovery for an installed member when automatic abort refuses', () => {
    const tree = signalTree({ rows: {} as Record<string, number> }, { enhancers: [transactions()] });
    const port = getTreeRealizationPort(tree.$)!;
    const refuse = vi.spyOn(port, 'validateEffects').mockImplementation(() => ({ kind: 'structural-drift' }));
    const failure = Object.freeze(new Error('callback'));
    let thrown: unknown;
    try {
      try { tree.transact(() => { tree.$.rows({ fresh: 123 }); throw failure; }); }
      catch (error) { thrown = error; }
      finally { refuse.mockRestore(); }
      expect(thrown).toBeInstanceOf(SignalTreeRollbackError);
      if (!(thrown instanceof SignalTreeRollbackError)) throw new Error('missing rollback error');
      expect(thrown.recovery?.callbackError).toBe(failure);
      const recovery = thrown.recovery!.transaction;
      expect(recovery.inspect().changes.length).toBeGreaterThan(0);
      expect(tree.$.rows()).toEqual({ fresh: 123 });
      const held = tree.$.rows.fresh as (() => number | undefined);
      recovery.rollback();
      recovery.rollback();
      expect(tree.$.rows()).toEqual({});
      expect(held()).toBeUndefined();
    } finally { refuse.mockRestore(); tree.destroy(); }
  });

  it('delivers completed partial membership to Link when a later value throws', async () => {
    const initial: { trigger: { x: number }[]; fresh?: number } = { trigger: [{ x: 0 }] };
    const tree = signalTree(initial);
    const sent: unknown[] = [];
    const relationship = link(tree.$, { set: value => { sent.push(value); } });
    const failure = new Error('partial equality');
    try {
      expect(tree.$()).toEqual(initial);
      expect(() => tree.$({ fresh: 123, trigger: [{ get x(): number { throw failure; } }] })).toThrow(failure);
      await flush();
      await relationship.settled();
      expect(tree.$().fresh).toBe(123);
      expect(sent).toEqual([{ trigger: [{ x: 0 }], fresh: 123 }]);
    } finally { relationship.dispose(); tree.destroy(); }
  });

  it('does not acquire absent descendants through reads', () => {
    const tree = signalTree({ rows: {} as Record<string, { n: number }> });
    try {
      expect(tree.$.rows.never).toBeUndefined();
      expect(tree.$.rows()).toEqual({});
    } finally {
      tree.destroy();
    }
  });
});
