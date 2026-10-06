import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree } from '../index';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import { getEntityMembershipInventory } from './internals/entity-membership-inventory';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { restorationReader } from './internals/restoration-reader';
import { stateLocationReader } from './internals/state-location-view';
import { transactionLifecycleReader } from './internals/transaction-lifecycle-view';
import { EntityValueStore } from './physical/entity-value-store';
import { StructuralStore } from './physical/structural-store';

/**
 * v16 controls for the entity membership reader (v15 → v16 integration,
 * slice 6): observation installs only the membership producer, on demand;
 * the reader's collection identity is v16's own position for the collection;
 * an interrupted structural unit never leaves the inventory half-installed.
 */
type Row = { id: string; n: number };
type Member = { lifetimeId: number; key: string | number };
type Change = EntityMembershipEvent['changes'][number];

/**
 * Apply events to a copy of `start` as a consumer would: removals and rekeys
 * in place, additions after `beforeLifetimeId` (deferred until it exists, as
 * one event describes its end state), reorders verbatim.
 */
function replay(
  start: readonly Member[],
  events: readonly EntityMembershipEvent[]
): Member[] {
  const list = start.map((member) => ({ ...member }));
  const at = (id: number) => list.findIndex((m) => m.lifetimeId === id);
  for (const event of events) {
    const waiting: Extract<Change, { kind: 'add' }>[] = [];
    const place = () => {
      for (let placed = true; placed; ) {
        placed = false;
        for (let i = 0; i < waiting.length; i++) {
          const add = waiting[i];
          const before =
            add.beforeLifetimeId === undefined ? -1 : at(add.beforeLifetimeId);
          if (add.beforeLifetimeId !== undefined && before === -1) continue;
          expect(at(add.lifetimeId)).toBe(-1);
          list.splice(before + 1, 0, {
            lifetimeId: add.lifetimeId,
            key: add.key,
          });
          waiting.splice(i--, 1);
          placed = true;
        }
      }
    };
    for (const change of event.changes) {
      if (change.kind === 'add') {
        waiting.push(change);
        place();
        continue;
      }
      place();
      if (change.kind === 'reorder') {
        list.splice(0, list.length, ...change.after.map((id) => list[at(id)]));
        continue;
      }
      const index = at(change.lifetimeId);
      expect(index).not.toBe(-1);
      if (change.kind === 'remove') list.splice(index, 1);
      else list[index].key = change.afterKey;
    }
    place();
    expect(waiting).toEqual([]);
  }
  return list;
}

describe('membership observation installs nothing else', () => {
  it('a bare tree gains a membership producer on first observation and no transaction or restoration capability', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      expect(getEntityMembershipInventory(tree.$.rows)).toBeUndefined();
      const reader = entityMembershipReader(tree)!;
      expect(getEntityMembershipInventory(tree.$.rows)).toBeDefined();
      expect(peekInternalTransactionRuntime(tree)).toBeUndefined();
      expect(restorationReader(tree)).toBeUndefined();
      expect(transactionLifecycleReader(tree)).toBeUndefined();
      // No retrospective history: a later subscriber hears only later units.
      tree.$.rows.addOne({ id: 'b', n: 2 });
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      expect(events).toEqual([]);
      tree.$.rows.removeOne('a');
      expect(events.map((event) => event.changes.map((c) => c.kind))).toEqual([
        ['remove'],
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('the collection position is the collection’s own v16 position and locates to its address', () => {
    const tree = signalTree({ group: { rows: entityMap<Row, string>() } });
    try {
      const collection =
        entityMembershipReader(tree)!.snapshot().collections[0];
      expect(collection.collectionPosition).toBe(
        getOwnedPositionIds(tree.$.group.rows)![0]
      );
      expect(
        stateLocationReader(tree)!.locate([
          { position: collection.collectionPosition },
        ])
      ).toEqual([
        [
          { kind: 'property', key: 'group' },
          { kind: 'property', key: 'rows' },
        ],
      ]);
      expect(collection.location).toEqual([
        { kind: 'property', key: 'group' },
        { kind: 'property', key: 'rows' },
      ]);
    } finally {
      tree.destroy();
    }
  });
});

describe('compound operations publish one unit', () => {
  it('prependOne reports the row at the front once, never first at the end', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      const seen: string[][] = [];
      reader.subscribe((event) => {
        events.push(event);
        seen.push(
          reader
            .snapshot()
            .collections[0].members.map((member) => member.key as string)
        );
      });
      tree.$.rows.prependOne({ id: 'z', n: 0 });
      expect(events).toHaveLength(1);
      expect(events[0].changes.map((change) => change.kind)).toEqual([
        'add',
        'reorder',
      ]);
      expect(seen).toEqual([['z', 'a', 'b']]);
    } finally {
      tree.destroy();
    }
  });
});

describe('point deltas', () => {
  it('an added row reports its neighbours in the committed order', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      const reader = entityMembershipReader(tree)!;
      const [, b] = reader.snapshot().collections[0].members;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      tree.$.rows.addOne({ id: 'c', n: 3 });
      expect(events.map((event) => event.changes)).toEqual([
        [
          {
            kind: 'add',
            lifetimeId: expect.any(Number),
            key: 'c',
            beforeLifetimeId: b.lifetimeId,
            afterLifetimeId: undefined,
          },
        ],
      ]);
    } finally {
      tree.destroy();
    }
  });
});

describe('point deltas of a multi-row frame', () => {
  it('each add names its neighbours in the committed order', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      const reader = entityMembershipReader(tree)!;
      const start = reader.snapshot().collections[0].members;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      tree.$.rows.addMany([
        { id: 'm', n: 2 },
        { id: 'n', n: 3 },
      ]);
      const end = reader.snapshot().collections[0].members;
      const [a, m, n] = end.map((member) => member.lifetimeId);
      expect(events.map((event) => event.changes)).toEqual([
        [
          {
            kind: 'add',
            lifetimeId: m,
            key: 'm',
            beforeLifetimeId: a,
            afterLifetimeId: n,
          },
          {
            kind: 'add',
            lifetimeId: n,
            key: 'n',
            beforeLifetimeId: m,
            afterLifetimeId: undefined,
          },
        ],
      ]);
      expect(replay(start, events)).toEqual(end);
    } finally {
      tree.destroy();
    }
  });
});

describe('an interrupted structural unit', () => {
  it('a commit that throws mid-unit still closes it: later snapshots and events still work', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const original = StructuralStore.prototype.tombstoneSubject;
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      let armed = true;
      const spy = vi
        .spyOn(StructuralStore.prototype, 'tombstoneSubject')
        .mockImplementation(function (this: StructuralStore<string>, ...args) {
          if (armed) {
            armed = false;
            throw new Error('injected tombstone failure');
          }
          return original.apply(this, args);
        });
      expect(() => tree.$.rows.clear()).toThrow('injected tombstone failure');
      spy.mockRestore();
      expect(() => reader.snapshot()).not.toThrow();
      expect(events).toEqual([]);
      tree.$.rows.addOne({ id: 'c', n: 3 });
      expect(events.map((event) => event.changes[0].kind)).toEqual(['add']);
      expect(
        reader.snapshot().collections[0].members.map((member) => member.key)
      ).toEqual(['a', 'b', 'c']);
    } finally {
      StructuralStore.prototype.tombstoneSubject = original;
      tree.destroy();
    }
  });

  it('a unit that throws after a partial change announces exactly that change', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const original = StructuralStore.prototype.tombstoneSubject;
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      const reader = entityMembershipReader(tree)!;
      const lifetimeOfA =
        reader.snapshot().collections[0].members[0].lifetimeId;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      let calls = 0;
      const spy = vi
        .spyOn(StructuralStore.prototype, 'tombstoneSubject')
        .mockImplementation(function (this: StructuralStore<string>, ...args) {
          if (++calls === 2)
            throw new Error('injected second tombstone failure');
          return original.apply(this, args);
        });
      expect(() => tree.$.rows.clear()).toThrow(
        'injected second tombstone failure'
      );
      spy.mockRestore();
      // The first row's tombstone installed: events and snapshot agree on it.
      expect(events.map((event) => event.changes)).toEqual([
        [{ kind: 'remove', lifetimeId: lifetimeOfA, key: 'a' }],
      ]);
      expect(
        reader.snapshot().collections[0].members.map((member) => member.key)
      ).toEqual(['b']);
    } finally {
      StructuralStore.prototype.tombstoneSubject = original;
      tree.destroy();
    }
  });

  type Rows = {
    setAll(rows: Row[]): unknown;
    upsertMany(rows: Row[]): unknown;
  };
  it.each([
    [
      'setAll, throwing at the reorder',
      StructuralStore.prototype,
      'reorderActiveKeys',
      1,
      (rows: Rows) =>
        rows.setAll([
          { id: 'b', n: 2 },
          { id: 'c', n: 3 },
        ]),
    ],
    [
      'upsertMany, throwing at the second value',
      EntityValueStore.prototype,
      'retainSubjectValue',
      2,
      (rows: Rows) =>
        rows.upsertMany([
          { id: 'c', n: 3 },
          { id: 'd', n: 4 },
        ]),
    ],
  ] as const)(
    '%s: the events replay to the snapshot',
    (_name, prototype, method, failAt, operate) => {
      const target = prototype as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      const original = target[method];
      const tree = signalTree({ rows: entityMap<Row, string>() });
      try {
        tree.$.rows.setAll([
          { id: 'a', n: 1 },
          { id: 'b', n: 2 },
        ]);
        const reader = entityMembershipReader(tree)!;
        const start = reader.snapshot().collections[0].members;
        const events: EntityMembershipEvent[] = [];
        reader.subscribe((event) => events.push(event));
        let calls = 0;
        target[method] = function (this: unknown, ...args: unknown[]) {
          if (++calls === failAt) throw new Error('injected');
          return original.apply(this, args);
        };
        expect(() => operate(tree.$.rows as unknown as Rows)).toThrow(
          'injected'
        );
        target[method] = original;
        // Part of the unit installed before the throw; the event says so.
        const end = reader.snapshot().collections[0].members;
        expect(end).not.toEqual(start);
        expect(events).toHaveLength(1);
        expect(replay(start, events)).toEqual(end);
      } finally {
        target[method] = original;
        tree.destroy();
      }
    }
  );

  it('a frame committed inside a bulk unit is reported once, by the unit', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const original = StructuralStore.prototype.moveKeysToFront;
    try {
      tree.$.rows.setAll([{ id: 'a', n: 1 }]);
      const reader = entityMembershipReader(tree)!;
      const start = reader.snapshot().collections[0].members;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      let armed = true;
      vi.spyOn(StructuralStore.prototype, 'moveKeysToFront').mockImplementation(
        function (this: StructuralStore<string>, ...args) {
          original.apply(this, args);
          if (armed) {
            armed = false;
            // A reentrant write while the prepend's reorder unit is open.
            tree.$.rows.addOne({ id: 'z', n: 26 });
          }
        }
      );
      tree.$.rows.prependOne({ id: 'x', n: 24 });
      vi.restoreAllMocks();
      const added = events.flatMap((event) =>
        event.changes.flatMap((change) =>
          change.kind === 'add' ? [change.lifetimeId] : []
        )
      );
      expect(new Set(added).size).toBe(added.length);
      expect(replay(start, events)).toEqual(
        reader.snapshot().collections[0].members
      );
    } finally {
      vi.restoreAllMocks();
      StructuralStore.prototype.moveKeysToFront = original;
      tree.destroy();
    }
  });

  it('a throwing membership listener cannot fail the mutation or starve later listeners', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      const reader = entityMembershipReader(tree)!;
      reader.subscribe(() => {
        throw new Error('listener');
      });
      const seen: number[] = [];
      reader.subscribe((event) => seen.push(event.sequence));
      expect(() => tree.$.rows.addOne({ id: 'a', n: 1 })).not.toThrow();
      expect(() =>
        tree.$.rows.setAll([
          { id: 'b', n: 2 },
          { id: 'a', n: 1 },
        ])
      ).not.toThrow();
      expect(seen).toEqual([1, 2]);
      expect(tree.$.rows.ids()).toEqual(['b', 'a']);
    } finally {
      tree.destroy();
    }
  });
});
