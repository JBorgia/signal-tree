import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../index';
import {
  createEntityMembershipInventory,
  defineEntityMembershipInventory,
  type EntityMembership,
  type EntityMembershipChange,
} from './internals/entity-membership-inventory';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';
import { defineOwnedPositionIds } from './internals/owned-mutation';
import { getPositionRegistry } from './internals/position-registry';
import { StudioTreeDestroyedError } from './internals/confirmed-turn-view';

// Carried from v15 012fd11d (v16 integration slice 6). Harness adaptation only:
// v15 lazily allocated a collection's position through an `entity-observation`
// activation hook, which this neutral source used. v16 owns positions
// differently (a real collection allocates and registers its own position when
// its `__positionIds` are first read), so that hook is not ported and the
// neutral source below owns a position directly. No assertion is changed.
//
// Tiny neutral source: the supplier is structural truth, independent of row payloads.
function fixture() {
  const tree = signalTree({ 'a.b': {}, a: { b: {} }, other: {} });
  const registry = getPositionRegistry(tree.$)!;
  const source = (node: object, initial: readonly EntityMembership[] = []) => {
    let members = initial;
    const read = vi.fn(() => members);
    const inventory = createEntityMembershipInventory(read);
    defineEntityMembershipInventory(node, inventory);
    defineOwnedPositionIds(node, [registry.allocate()]);
    return {
      inventory,
      read,
      install(next: readonly EntityMembership[]) {
        members = next;
      },
      commit(
        next: readonly EntityMembership[],
        changes: readonly EntityMembershipChange[]
      ) {
        const unit = inventory.begin();
        members = next;
        unit.commit(changes);
      },
    };
  };
  return { tree, source };
}
const member = (
  lifetimeId: number,
  key: string | number
): EntityMembership => ({ lifetimeId, key });
const add = (
  lifetimeId: number,
  key: string | number,
  beforeLifetimeId?: number
): EntityMembershipChange => ({
  kind: 'add',
  lifetimeId,
  key,
  ...(beforeLifetimeId === undefined ? {} : { beforeLifetimeId }),
});
const remove = (
  lifetimeId: number,
  key: string | number
): EntityMembershipChange => ({ kind: 'remove', lifetimeId, key });

describe('read-only entity membership reader', () => {
  it('distinguishes unavailable membership from an available empty collection', () => {
    const { tree, source } = fixture();
    try {
      expect(entityMembershipReader(tree)).toBeUndefined();
      source(tree.$.other);
      expect(
        entityMembershipReader(tree)!.snapshot().collections
      ).toMatchObject([{ members: [] }]);
    } finally {
      tree.destroy();
    }
  });

  it('subscribes retained non-enumerable collections before their first restoration', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other);
    Object.defineProperty(tree.$, 'other', { enumerable: false });
    try {
      expect(Object.keys(tree.$)).not.toContain('other');
      const reader = entityMembershipReader(tree)!;
      expect(reader).toBeDefined();
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      // No snapshot between attachment and restoration may be needed to arm it.
      rows.commit([member(1, 'restored')], [add(1, 'restored')]);
      expect(events).toHaveLength(1);
      expect(events[0].collection.location).toEqual([
        { kind: 'property', key: 'other' },
      ]);
      expect(reader.snapshot().collections[0].members).toEqual([
        member(1, 'restored'),
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('does not subscribe or close another tree through a foreign node or reused inventory marker', () => {
    const first = fixture(),
      second = fixture();
    const rows = first.source(first.tree.$.other);
    const reader = entityMembershipReader(first.tree)!;
    Object.defineProperty(second.tree.$, 'foreign', {
      value: first.tree.$.other,
      enumerable: true,
    });
    defineEntityMembershipInventory(second.tree.$.other, rows.inventory);
    const events: EntityMembershipEvent[] = [];
    reader.subscribe((event) => events.push(event));
    try {
      expect(entityMembershipReader(second.tree)).toBeUndefined();
      second.tree.destroy();
      second.tree.destroy();
      rows.commit([member(1, 'alive')], [add(1, 'alive')]);
      expect(events).toHaveLength(1);
      expect(reader.snapshot().collections[0].members).toEqual([
        member(1, 'alive'),
      ]);
    } finally {
      first.tree.destroy();
      second.tree.destroy();
    }
  });

  it.each([1000, 10000])(
    'single-add observation work is independent of %i existing members',
    (count) => {
      const { tree, source } = fixture();
      const initial = Array.from({ length: count }, (_, index) =>
        member(index + 1, index)
      );
      const rows = source(tree.$.other, initial);
      try {
        const reader = entityMembershipReader(tree)!;
        reader.snapshot();
        rows.read.mockClear();
        const events: EntityMembershipEvent[] = [];
        reader.subscribe((event) => events.push(event));
        reader.subscribe((event) => events.push(event));
        rows.commit(
          [...initial, member(count + 1, 'new')],
          [add(count + 1, 'new', count)]
        );
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.changes)).toEqual([
          [add(count + 1, 'new', count)],
          [add(count + 1, 'new', count)],
        ]);
        const inventoryRowsRead = rows.read.mock.results.reduce(
          (total, result) =>
            total + (result.type === 'return' ? result.value.length : 0),
          0
        );
        const inventoryRowsDelivered = events.reduce(
          (total, event) =>
            total +
            ('members' in event.collection
              ? (event.collection.members as readonly unknown[]).length
              : 0),
          0
        );
        expect({ inventoryRowsRead, inventoryRowsDelivered }).toEqual({
          inventoryRowsRead: 0,
          inventoryRowsDelivered: 0,
        });
      } finally {
        tree.destroy();
      }
    }
  );

  it('reads pre-attachment inventory, scopes lifetimes, and preserves typed keys and literal locations', () => {
    const { tree, source } = fixture();
    source(tree.$['a.b'], [
      member(1, 1),
      member(2, '1'),
      member(3, 'email@host.test'),
      member(4, 'v1.2/::'),
    ]);
    source(tree.$.a.b, [member(1, 'same-lifetime')]);
    const other = fixture();
    other.source(other.tree.$['a.b'], [member(1, 1)]);
    try {
      const snapshot = entityMembershipReader(tree)!.snapshot();
      const second = entityMembershipReader(other.tree)!.snapshot();
      expect(snapshot.sequence).toBe(0);
      expect(snapshot.treeId).not.toBe(second.treeId);
      expect(snapshot.collections).toHaveLength(2);
      expect(snapshot.collections[0].members.map((item) => item.key)).toEqual([
        1,
        '1',
        'email@host.test',
        'v1.2/::',
      ]);
      expect(snapshot.collections[0].location).toEqual([
        { kind: 'property', key: 'a.b' },
      ]);
      expect(snapshot.collections[1].location).toEqual([
        { kind: 'property', key: 'a' },
        { kind: 'property', key: 'b' },
      ]);
      expect(snapshot.collections[0].path).toBe(snapshot.collections[1].path);
      expect(snapshot.collections[0].collectionPosition).not.toBe(
        snapshot.collections[1].collectionPosition
      );
      expect(
        snapshot.collections.map(
          (collection) => collection.members[0].lifetimeId
        )
      ).toEqual([1, 1]);
    } finally {
      tree.destroy();
      other.tree.destroy();
    }
  });

  it('publishes one coherent frame for mixed changes and hides intermediate installation', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other, [member(1, 'a'), member(2, 'b')]);
    try {
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      const inventories: unknown[] = [];
      reader.subscribe((event) => {
        events.push(event);
        inventories.push(reader.snapshot().collections[0].members);
      });
      const unit = rows.inventory.begin();
      rows.install([member(2, 'b')]);
      expect(() => reader.snapshot()).toThrow('still being installed');
      expect(events).toEqual([]);
      rows.install([member(3, 'c'), member(2, 'new.b')]);
      unit.commit([
        remove(1, 'a'),
        add(3, 'c'),
        { kind: 'rekey', lifetimeId: 2, beforeKey: 'b', afterKey: 'new.b' },
        { kind: 'reorder', before: [2, 3], after: [3, 2] },
      ]);
      expect(events).toHaveLength(1);
      expect(events[0].changes).toHaveLength(4);
      expect(inventories).toEqual([[member(3, 'c'), member(2, 'new.b')]]);
      expect(reader.snapshot().sequence).toBe(1);
      unit.commit([]); // Idempotent unit completion.
      expect(events).toHaveLength(1);
    } finally {
      tree.destroy();
    }
  });

  it('detaches snapshots and publications, including changes and reorder arrays', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other, [member(1, 'a'), member(2, 'b')]);
    try {
      const reader = entityMembershipReader(tree)!;
      const snapshot = reader.snapshot();
      Reflect.set(snapshot.collections[0].members[0], 'key', 'corrupted');
      Reflect.set(snapshot.collections[0].location[0], 'key', 'wrong');
      expect(reader.snapshot().collections[0].members[0].key).toBe('a');
      expect(reader.snapshot().collections[0].location[0].key).toBe('other');
      reader.subscribe((event) => {
        Reflect.set(event.collection.location[0], 'key', 'corrupted');
        const change = event.changes[0];
        if (change.kind === 'reorder') (change.after as number[]).push(99);
      });
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      const order = [2, 1];
      rows.commit(
        [member(2, 'b'), member(1, 'a')],
        [{ kind: 'reorder', before: [1, 2], after: order }]
      );
      order.push(100);
      expect(events[0].changes).toEqual([
        { kind: 'reorder', before: [1, 2], after: [2, 1] },
      ]);
      expect(events[0].collection.location[0].key).toBe('other');
      expect(reader.snapshot().collections[0].members[0].key).toBe('b');
    } finally {
      tree.destroy();
    }
  });

  it('delivers reentrant units in sequence with audience fixed at publication', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other);
    try {
      const reader = entityMembershipReader(tree)!;
      const a: number[] = [],
        b: number[] = [],
        late: number[] = [];
      reader.subscribe((event) => {
        a.push(event.sequence);
        if (event.sequence === 1) {
          rows.commit([member(2, 'b')], [remove(1, 'a'), add(2, 'b')]);
          reader.subscribe((next) => late.push(next.sequence));
        }
      });
      reader.subscribe(() => {
        throw new Error('observer');
      });
      reader.subscribe((event) => b.push(event.sequence));
      rows.commit([member(1, 'a')], [add(1, 'a')]);
      expect(a).toEqual([1, 2]);
      expect(b).toEqual([1, 2]);
      expect(late).toEqual([]);
      rows.commit([], [remove(2, 'b')]);
      expect(late).toEqual([3]);
    } finally {
      tree.destroy();
    }
  });

  it('clears queued events and all suppliers on repeated destruction', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other);
    const reader = entityMembershipReader(tree)!;
    const events: number[] = [];
    reader.subscribe((event) => {
      if (event.sequence === 1) {
        rows.commit([member(2, 'b')], [remove(1, 'a'), add(2, 'b')]);
        tree.destroy();
      }
    });
    const stop = reader.subscribe((event) => events.push(event.sequence));
    rows.commit([member(1, 'a')], [add(1, 'a')]);
    expect(events).toEqual([]);
    stop();
    stop();
    tree.destroy();
    rows.commit([], [remove(2, 'b')]);
    expect(events).toEqual([]);
    expect(() => reader.snapshot()).toThrow(StudioTreeDestroyedError);
    expect(() => reader.subscribe(() => undefined)).toThrow(
      StudioTreeDestroyedError
    );
    expect(() => entityMembershipReader(tree)!).toThrow(
      StudioTreeDestroyedError
    );
    expect(() => rows.inventory.snapshot()).toThrow('closed');
  });

  it('keeps dormant units free of inventory reads/history and omits no-op and refused units', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other);
    rows.commit([member(1, 'pre-attachment')], [add(1, 'pre-attachment')]);
    expect(rows.read).not.toHaveBeenCalled();
    try {
      const reader = entityMembershipReader(tree)!;
      expect(reader.snapshot()).toMatchObject({
        sequence: 0,
        collections: [{ members: [member(1, 'pre-attachment')] }],
      });
      const events: EntityMembershipEvent[] = [];
      const stop = reader.subscribe((event) => events.push(event));
      rows.inventory.begin().cancel();
      rows.inventory.begin().commit([]);
      expect(events).toEqual([]);
      stop();
      rows.commit([], [remove(1, 'pre-attachment')]);
      reader.subscribe((event) => events.push(event));
      expect(events).toEqual([]);
      expect(reader.snapshot().sequence).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('refuses a first attachment mid-unit instead of asserting partial inventory', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other, [member(1, 'a')]);
    const unit = rows.inventory.begin();
    rows.install([]);
    expect(() => entityMembershipReader(tree)!).toThrow(
      'still being installed'
    );
    rows.install([member(2, 'b')]);
    unit.commit([remove(1, 'a'), add(2, 'b')]);
    try {
      expect(
        entityMembershipReader(tree)!.snapshot().collections[0].members
      ).toEqual([member(2, 'b')]);
    } finally {
      tree.destroy();
    }
  });

  it('coalesces nested producer units without exposing their intermediate inventories', () => {
    const { tree, source } = fixture();
    const rows = source(tree.$.other);
    try {
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      const outer = rows.inventory.begin();
      rows.commit([member(1, 'a')], [add(1, 'a')]);
      expect(() => reader.snapshot()).toThrow('still being installed');
      expect(events).toEqual([]);
      rows.install([member(1, 'a'), member(2, 'b')]);
      outer.commit([add(2, 'b', 1)]);
      expect(events).toHaveLength(1);
      expect(events[0].changes).toEqual([add(1, 'a'), add(2, 'b', 1)]);
    } finally {
      tree.destroy();
    }
  });

  it('orders reentrant changes across different collections in the same tree', () => {
    const { tree, source } = fixture();
    const first = source(tree.$['a.b']);
    const second = source(tree.$.other);
    try {
      const reader = entityMembershipReader(tree)!;
      const seen: EntityMembershipEvent[] = [];
      reader.subscribe((event) => {
        if (event.sequence === 1)
          second.commit([member(1, 'b')], [add(1, 'b')]);
      });
      reader.subscribe((event) => seen.push(event));
      first.commit([member(1, 'a')], [add(1, 'a')]);
      expect(seen.map((event) => event.sequence)).toEqual([1, 2]);
      expect(seen[0].collection.collectionPosition).not.toBe(
        seen[1].collection.collectionPosition
      );
    } finally {
      tree.destroy();
    }
  });
});
