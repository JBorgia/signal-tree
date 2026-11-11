import { describe, expect, it } from 'vitest';
import { entityMap, restoration, signalTree, transactions } from '../index';
import { undoable } from './undoable';
import { getEntityPublicationBinding } from './internals/entity-publication';
import type { PreparedEntitySubjectReclamation } from './entity-signal';

type Row = { id: number; value: number };
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};

// Discover the actual activation map only during first reads of already-created
// nodes. byId runs before the hook so its separate WeakRef node cache is excluded.
// Hold the map deliberately: these assertions concern entry cleanup, not GC.
function activationMap(read: () => void): Map<unknown, unknown> {
  const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, 'set');
  if (!descriptor) throw new Error('Map.set unavailable');
  const original = Map.prototype.set;
  const maps = new Set<Map<unknown, unknown>>();
  Object.defineProperty(Map.prototype, 'set', {
    ...descriptor,
    value: function (
      this: Map<unknown, unknown>,
      key: unknown,
      value: unknown
    ) {
      const result = Reflect.apply(original, this, [key, value]);
      if (typeof key === 'number' && value instanceof WeakRef) maps.add(this);
      return result;
    },
  });
  try {
    read();
  } finally {
    Object.defineProperty(Map.prototype, 'set', descriptor);
  }
  expect(maps.size).toBe(1);
  const map = [...maps][0];
  expect(map.size).toBeGreaterThan(0);
  return map;
}

describe('forgotten lifetime activation wrappers', () => {
  it('preserves activation routing if recipient preparation refuses forgetting', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [transactions()] }
    );
    let off: (() => void) | undefined;
    try {
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const held = tree.$.rows.byIdOrFail(1);
      const map = activationMap(() => {
        held();
      });
      const id = [...map.keys()][0] as number;
      const activation = map.get(id);
      tree.$.rows.removeOne(1);
      const internal = tree.$.rows as unknown as {
        __prepareSubjectReclamation(
          id: number,
          options: { causallyEligible: boolean; reclaimLifetimeRecord: boolean }
        ): PreparedEntitySubjectReclamation | undefined;
        __applyPreparedSubjectReclamation(
          plan: PreparedEntitySubjectReclamation
        ): void;
        __inspectSubjectResources(id: number): unknown;
      };
      const prepared = internal.__prepareSubjectReclamation(id, {
        causallyEligible: true,
        reclaimLifetimeRecord: true,
      });
      if (!prepared) throw new Error('Expected tombstoned reclamation plan');
      const source = getEntityPublicationBinding(tree.$.rows)?.source;
      if (!source) throw new Error('Expected publication source');
      const failure = new Error('refused retirement preparation');
      let attempts = 0;
      off = source.subscribe({
        prepare() {
          attempts++;
          throw failure;
        },
        complete() {
          /* A refused preparation has no completion. */
        },
      });
      expect(() =>
        internal.__applyPreparedSubjectReclamation(prepared)
      ).toThrow(failure);
      expect(attempts).toBe(1);
      expect(internal.__inspectSubjectResources(id)).toBeDefined();
      expect(map.has(id)).toBe(true);
      expect(map.get(id)).toBe(activation);
      off();
      off = undefined;
      internal.__applyPreparedSubjectReclamation(prepared);
      expect(internal.__inspectSubjectResources(id)).toBeUndefined();
      expect(map.has(id)).toBe(false);
      expect(held()).toBeUndefined();
      await flush();
    } finally {
      off?.();
      tree.destroy();
    }
  });

  it('removes wrappers created during pending population and keeps held nodes isolated', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [transactions()] }
    );
    try {
      const pending = tree.transact(() =>
        tree.$.rows.setAll([
          { id: 1, value: 10 },
          { id: 2, value: 20 },
        ])
      );
      const held = tree.$.rows.byIdOrFail(1);
      const late = tree.$.rows.byIdOrFail(2);
      const map = activationMap(() => {
        held();
      });
      await flush();
      expect(map.size).toBe(1);
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toEqual([]);
      expect(map.size).toBe(0);
      expect(held()).toBeUndefined();
      expect(late()).toBeUndefined();
      expect(late.value()).toBeUndefined();
      expect(map.size).toBe(0);
      tree.$.rows.addOne({ id: 1, value: 99 });
      expect(tree.$.rows.byIdOrFail(1)()).toEqual({ id: 1, value: 99 });
      expect(held()).toBeUndefined();
      expect(late()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });

  it('preserves pending removal carriers, then deletes them on confirmation', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const held = tree.$.rows.byIdOrFail(1);
      const map = activationMap(() => {
        held();
      });
      const pending = tree.transact(() => tree.$.rows.removeOne(1));
      await flush();
      expect(map.size).toBe(1);
      expect(held()).toBeUndefined();
      pending.confirm();
      await flush();
      expect(map.size).toBe(0);
      expect(held()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });

  it('forgets bare retirement wrappers and does not register a first late read', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    try {
      tree.$.rows.setAll([
        { id: 1, value: 10 },
        { id: 2, value: 20 },
      ]);
      const held = tree.$.rows.byIdOrFail(1);
      const late = tree.$.rows.byIdOrFail(2);
      const map = activationMap(() => {
        held();
      });
      tree.$.rows.clear();
      await flush();
      expect(map.size).toBe(0);
      expect(held()).toBeUndefined();
      expect(late()).toBeUndefined();
      expect(late.value()).toBeUndefined();
      expect(map.size).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('keeps claimed carriers through undo/redo and releases them only after history reset', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      {
        enhancers: [transactions(), restoration({ maxHistorySize: 2 })],
      }
    );
    try {
      tree.$.rows.addOne({ id: 1, value: 10 });
      await flush();
      const held = tree.$.rows.byIdOrFail(1);
      const map = activationMap(() => {
        held();
      });
      undoable(() => tree.$.rows.removeOne(1));
      await flush();
      expect(map.size).toBe(1);
      expect(held()).toBeUndefined();
      tree.undo();
      await flush();
      expect(held()).toEqual({ id: 1, value: 10 });
      expect(map.size).toBe(1);
      tree.redo();
      await flush();
      expect(held()).toBeUndefined();
      expect(map.size).toBe(1);
      tree.resetRestorationHistory();
      await flush();
      expect(map.size).toBe(0);
      expect(held()).toBeUndefined();
    } finally {
      tree.destroy();
    }
  });
});
