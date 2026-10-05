import { describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';

type Row = { id: string | number; n: number };
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('entity membership source integration', () => {
  it('arms an omitted optional collection before the first restore, without a subsequent snapshot', () => {
    const tree = signalTree({
      group: { rows: entityMap<Row, string | number>() },
    });
    try {
      tree.$.group({} as never);
      expect(Object.keys(tree.$.group)).not.toContain('rows');
      const reader = entityMembershipReader(tree);
      expect(reader).toBeDefined();
      const events: EntityMembershipEvent[] = [];
      reader!.subscribe((event) => events.push(event));
      tree.$.group({ rows: { all: [{ id: 'restored', n: 1 }] } } as never);
      expect(events).toHaveLength(1);
      expect(events[0].changes[0]).toMatchObject({
        kind: 'add',
        key: 'restored',
      });
    } finally {
      tree.destroy();
    }
  });

  it('inventories bare collections populated before attachment without conflating keys or paths', () => {
    const tree = signalTree({
      'a.b': entityMap<Row, string | number>(),
      a: { b: entityMap<Row, string | number>() },
    });
    try {
      tree.$['a.b'].addMany([
        { id: 1, n: 1 },
        { id: '1', n: 2 },
      ]);
      tree.$.a.b.addOne({ id: 'v1.2/::', n: 3 });
      const snapshot = entityMembershipReader(tree)!.snapshot();
      expect(snapshot.collections).toHaveLength(2);
      expect(
        snapshot.collections[0].members.map((member) => member.key)
      ).toEqual([1, '1']);
      expect(snapshot.collections[0].location).toEqual([
        { kind: 'property', key: 'a.b' },
      ]);
      expect(snapshot.collections[1].location).toEqual([
        { kind: 'property', key: 'a' },
        { kind: 'property', key: 'b' },
      ]);
      expect(snapshot.collections[0].members[0].lifetimeId).toBe(
        snapshot.collections[1].members[0].lifetimeId
      );
      expect(snapshot.collections[0].collectionPosition).not.toBe(
        snapshot.collections[1].collectionPosition
      );
    } finally {
      tree.destroy();
    }
  });

  it('reports rekey independently of row payload and distinguishes reincarnation', () => {
    const tree = signalTree({ rows: entityMap<Row, string | number>() });
    try {
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      tree.$.rows.addOne({ id: 1, n: 1 });
      expect(events).toHaveLength(1);
      const lifetimeId = reader.snapshot().collections[0].members[0].lifetimeId;
      tree.$.rows.changeId(1, '1');
      expect(events.at(-1)?.changes).toEqual([
        { kind: 'rekey', lifetimeId, beforeKey: 1, afterKey: '1' },
      ]);
      expect(tree.$.rows.byId('1')?.().id).toBe(1);
      tree.$.rows.removeOne('1');
      tree.$.rows.addOne({ id: '1', n: 2 });
      expect(reader.snapshot().collections[0].members[0].lifetimeId).not.toBe(
        lifetimeId
      );
      const count = events.length;
      tree.$.rows.changeId('1', '1');
      tree.$.rows.updateOne('1', { n: 3 });
      expect(events).toHaveLength(count);
    } finally {
      tree.destroy();
    }
  });

  it('frames mixed setAll, reorder-only setAll and clear as coherent units', () => {
    const tree = signalTree({ rows: entityMap<Row, string | number>() });
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      const observed: unknown[] = [];
      reader.subscribe((event) => {
        events.push(event);
        observed.push(reader.snapshot().collections[0].members);
      });
      tree.$.rows.setAll([
        { id: 'c', n: 3 },
        { id: 'b', n: 4 },
      ]);
      expect(events).toHaveLength(1);
      expect(events[0].changes.map((change) => change.kind)).toEqual([
        'remove',
        'add',
      ]);
      expect(
        reader.snapshot().collections[0].members.map((member) => member.key)
      ).toEqual(['c', 'b']);
      tree.$.rows.setAll([
        { id: 'b', n: 4 },
        { id: 'c', n: 3 },
      ]);
      expect(events).toHaveLength(2);
      expect(events[1].changes.map((change) => change.kind)).toEqual([
        'reorder',
      ]);
      tree.$.rows.clear();
      expect(events).toHaveLength(3);
      expect(events[2].changes.map((change) => change.kind)).toEqual([
        'remove',
        'remove',
      ]);
      expect(reader.snapshot().collections[0].members).toEqual([]);
      expect(observed).toEqual([
        expect.arrayContaining([
          expect.objectContaining({ key: 'c' }),
          expect.objectContaining({ key: 'b' }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({ key: 'b' }),
          expect.objectContaining({ key: 'c' }),
        ]),
        [],
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('frames prepend and bulk upsert once without exposing allocated-but-uninstalled members', () => {
    const tree = signalTree({ rows: entityMap<Row, string | number>() });
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      const reader = entityMembershipReader(tree)!;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      tree.$.rows.prependMany([
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]);
      expect(events).toHaveLength(1);
      expect(
        reader.snapshot().collections[0].members.map((member) => member.key)
      ).toEqual(['b', 'c', 'a']);
      tree.$.rows.upsertMany([
        { id: 'a', n: 9 },
        { id: 'd', n: 4 },
        { id: 'e', n: 5 },
      ]);
      expect(events).toHaveLength(2);
      expect(events[1].changes.map((change) => change.kind)).toEqual([
        'add',
        'add',
      ]);
      expect(
        reader.snapshot().collections[0].members.map((member) => member.key)
      ).toEqual(['b', 'c', 'a', 'd', 'e']);
    } finally {
      tree.destroy();
    }
  });

  it('observes rollback and undo/redo restoring actual lifetime identity', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string | number>() },
      { enhancers: [transactions(), restoration()] }
    );
    try {
      tree.$.rows.addOne({ id: 'email@host.test', n: 1 });
      await tick();
      const reader = entityMembershipReader(tree)!;
      expect(reader.snapshot().collections).toHaveLength(1);
      const original = reader.snapshot().collections[0].members;
      const events: EntityMembershipEvent[] = [];
      reader.subscribe((event) => events.push(event));
      const pending = tree.transact(() =>
        tree.$.rows.removeOne('email@host.test')
      );
      pending.rollback();
      expect(reader.snapshot().collections[0].members).toEqual(original);
      expect(events.at(-1)?.changes[0]).toMatchObject({
        kind: 'add',
        ...original[0],
      });
      undoable(() => tree.$.rows.removeOne('email@host.test'));
      await tick();
      tree.undo();
      expect(reader.snapshot().collections[0].members).toEqual(original);
      expect(events.at(-1)?.changes[0]).toMatchObject({
        kind: 'add',
        ...original[0],
      });
      tree.redo();
      expect(reader.snapshot().collections[0].members).toEqual([]);
      expect(events.at(-1)?.changes[0]).toMatchObject({
        kind: 'remove',
        ...original[0],
      });
    } finally {
      tree.destroy();
    }
  });
});
