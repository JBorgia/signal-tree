import { expect, it, vi } from 'vitest';
import { signalTree, entityMap } from '../index';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';
import {
  getEntityPublicationBinding,
  type EntityPublicationPacket,
} from './internals/entity-publication';
import { withWriteContext } from './write-context';
import { EntityPlacementStage } from './physical/entity-placement-stage';
import { StructuralStore } from './physical/structural-store';
const seed = [
  { id: 'a', n: 1 },
  { id: 'b', n: 2 },
  { id: 'c', n: 3 },
];
it('bulk diff owns mixed setAll reorder exactly once', () => {
  const t = signalTree({
    rows: entityMap<{ id: string; n: number }, string>(),
  });
  try {
    t.$.rows.setAll(seed);
    const reader = entityMembershipReader(t)!;
    const before = reader.snapshot().collections[0].members;
    const events: EntityMembershipEvent[] = [];
    reader.subscribe((e) => events.push(e));
    t.$.rows.setAll([seed[2], { id: 'z', n: 9 }, seed[0], seed[1]]);
    const after = reader.snapshot().collections[0].members;
    expect(events).toHaveLength(1);
    expect(events[0].changes.map((c) => c.kind)).toEqual(['add', 'reorder']);
    const order = events[0].changes.find((c) => c.kind === 'reorder')!;
    expect(order.before).toEqual(before.map((m) => m.lifetimeId));
    expect(order.after).toEqual(after.map((m) => m.lifetimeId));
    expect(after.map((m) => m.key)).toEqual(['c', 'z', 'a', 'b']);
  } finally {
    t.destroy();
  }
});
it('listener reentry cannot rewrite earlier prepared order endpoints', () => {
  const t = signalTree({
    rows: entityMap<{ id: string; n: number }, string>(),
  });
  try {
    t.$.rows.setAll(seed);
    const reader = entityMembershipReader(t)!;
    const before = reader.snapshot().collections[0].members;
    const events: EntityMembershipEvent[] = [];
    reader.subscribe((e) => {
      events.push(e);
      if (events.length === 1)
        t.$.rows.prependMany([{ id: 'b', n: 20 }], { mode: 'overwrite' });
    });
    t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
    expect(events.map((e) => e.sequence)).toEqual([1, 2]);
    const order = events[0].changes.find((c) => c.kind === 'reorder')!;
    expect(order.before).toEqual(before.map((m) => m.lifetimeId));
    expect(order.after).toEqual(
      [before[2], before[0], before[1]].map((m) => m.lifetimeId)
    );
    expect(t.$.rows.ids()).toEqual(['b', 'c', 'a']);
    t.$.rows.addOne({ id: 'z', n: 4 });
    expect(events).toHaveLength(3);
  } finally {
    t.destroy();
  }
});
it('inspection membership reports physical order without ordinary order adoption', () => {
  const t = signalTree({
    rows: entityMap<{ id: string; n: number }, string>(),
  });
  let off = () => {};
  try {
    t.$.rows.setAll(seed);
    const reader = entityMembershipReader(t)!;
    const before = reader.snapshot().collections[0].members;
    const source = getEntityPublicationBinding(
      t.$.rows.byIdOrFail('a')
    )!.source;
    const ordinary = before.map((m) =>
      source.evidence()!.placement(m.lifetimeId, 'ordinary')
    );
    const packets: EntityPublicationPacket[] = [];
    off = source.subscribe({
      prepare(p) {
        packets.push(p);
        return undefined;
      },
      complete() {},
    });
    const events: EntityMembershipEvent[] = [];
    reader.subscribe((e) => events.push(e));
    withWriteContext({ participation: 'inspection' }, () =>
      t.$.rows.prependMany([{ id: 'c', n: 99 }], { mode: 'overwrite' })
    );
    expect(t.$.rows.ids()).toEqual(['c', 'a', 'b']);
    expect(events).toHaveLength(1);
    expect(events[0].changes.some((c) => c.kind === 'reorder')).toBe(true);
    expect(packets.length).toBeGreaterThan(0);
    expect(
      packets.every(
        (p) => p.ordinary.length === 0 && p.ordinaryOrder === undefined
      )
    ).toBe(true);
    for (const [i, m] of before.entries())
      expect(source.evidence()!.placement(m.lifetimeId, 'ordinary')).toBe(
        ordinary[i]
      );
  } finally {
    off();
    t.destroy();
  }
});
for (const size of [32, 1024])
  for (const existing of [false, true])
    it(`membership order handoff adds no source snapshots N=${size} existing=${existing}`, () => {
      const runs: number[][] = [];
      for (const observed of [false, true]) {
        const t = signalTree({
          rows: entityMap<{ id: string; n: number }, string>(),
        });
        t.$.rows.setAll(
          Array.from({ length: size }, (_, n) => ({ id: String(n), n }))
        );
        const events: EntityMembershipEvent[] = [];
        if (observed)
          entityMembershipReader(t)!.subscribe((e) => events.push(e));
        let placement = 0,
          store = 0;
        const p = EntityPlacementStage.prototype.snapshot,
          s = StructuralStore.prototype.snapshotActiveOrder;
        const a = vi
          .spyOn(EntityPlacementStage.prototype, 'snapshot')
          .mockImplementation(function (this: EntityPlacementStage<string>) {
            const result = p.call(this);
            placement += result.length;
            return result;
          });
        const b = vi
          .spyOn(StructuralStore.prototype, 'snapshotActiveOrder')
          .mockImplementation(function (
            this: StructuralStore<string>,
            keys,
            ids
          ) {
            store++;
            return s.call(this, keys, ids);
          });
        try {
          t.$.rows.prependMany(
            [{ id: existing ? String(size - 1) : 'new', n: 42 }],
            { mode: 'overwrite' }
          );
          runs.push([placement, store]);
          expect(t.$.rows.ids()[0]).toBe(existing ? String(size - 1) : 'new');
          expect(
            t.$.rows.byIdOrFail(existing ? String(size - 1) : 'new').n()
          ).toBe(42);
          expect(events).toHaveLength(observed ? 1 : 0);
        } finally {
          a.mockRestore();
          b.mockRestore();
          t.destroy();
        }
      }
      expect(runs[1]).toEqual(runs[0]);
      if (!existing) expect(runs[0]).toEqual([0, 0]);
      else expect(runs[0][0]).toBeGreaterThan(0);
    });
