import { expect, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { entityMap, signalTree } from '../index';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';
type Member = { lifetimeId: number; key: string | number };
function apply(list: Member[], event: EntityMembershipEvent): void {
  const initial = list.map((m) => m.lifetimeId);
  const adds: Extract<
    EntityMembershipEvent['changes'][number],
    { kind: 'add' }
  >[] = [];
  const at = (id: number) => list.findIndex((m) => m.lifetimeId === id);
  const flush = () => {
    while (adds.length) {
      let progress = false;
      for (let i = 0; i < adds.length; i++) {
        const a = adds[i];
        const before =
          a.beforeLifetimeId === undefined ? -1 : at(a.beforeLifetimeId);
        if (a.beforeLifetimeId !== undefined && before < 0) continue;
        expect(at(a.lifetimeId)).toBe(-1);
        list.splice(before + 1, 0, { lifetimeId: a.lifetimeId, key: a.key });
        adds.splice(i--, 1);
        progress = true;
      }
      expect(progress).toBe(true);
    }
  };
  for (const change of event.changes) {
    if (change.kind === 'add') {
      adds.push(change);
      continue;
    }
    flush();
    if (change.kind === 'remove') {
      const i = at(change.lifetimeId);
      expect(i).toBeGreaterThanOrEqual(0);
      list.splice(i, 1);
    } else if (change.kind === 'rekey') {
      const i = at(change.lifetimeId);
      expect(i).toBeGreaterThanOrEqual(0);
      list[i] = { lifetimeId: change.lifetimeId, key: change.afterKey };
    } else {
      expect(change.before).toEqual(initial);
      expect(new Set(change.after).size).toBe(list.length);
      expect([...change.after].sort()).toEqual(
        list.map((m) => m.lifetimeId).sort()
      );
      const ordered = change.after.map((id) => {
        const member = list[at(id)];
        expect(member).toBeDefined();
        return member;
      });
      list.splice(0, list.length, ...ordered);
    }
  }
  flush();
}
for (const mode of [
  'fresh-one',
  'fresh-many',
  'existing-many',
  'mixed-many',
  'existing-front-noop',
  'existing-one-refuses',
] as const)
  it(`consumer membership replica and one event unit: ${mode}`, () => {
    const t = signalTree({
      rows: entityMap<{ id: string; n: number }, string>(),
    });
    try {
      t.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]);
      const held = t.$.rows.byIdOrFail('c');
      const reader = entityMembershipReader(t)!;
      const initial = reader
        .snapshot()
        .collections[0].members.map((m) => ({ ...m }));
      const replica = initial.map((m) => ({ ...m }));
      const events: EntityMembershipEvent[] = [];
      const observed: Member[][] = [];
      reader.subscribe((e) => {
        events.push(e);
        observed.push(
          reader.snapshot().collections[0].members.map((m) => ({ ...m }))
        );
      });
      let expected: string[];
      let units = 1;
      if (mode === 'fresh-one') {
        t.$.rows.prependOne({ id: 'z', n: 9 });
        expected = ['z', 'a', 'b', 'c'];
      } else if (mode === 'fresh-many') {
        t.$.rows.prependMany([
          { id: 'x', n: 8 },
          { id: 'y', n: 9 },
        ]);
        expected = ['x', 'y', 'a', 'b', 'c'];
      } else if (mode === 'existing-many') {
        t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
        expected = ['c', 'a', 'b'];
        expect(held.n()).toBe(30);
      } else if (mode === 'mixed-many') {
        t.$.rows.prependMany(
          [
            { id: 'c', n: 30 },
            { id: 'z', n: 9 },
          ],
          { mode: 'overwrite' }
        );
        expected = ['c', 'z', 'a', 'b'];
        expect(held.n()).toBe(30);
      } else if (mode === 'existing-front-noop') {
        t.$.rows.prependMany([{ id: 'a', n: 10 }], { mode: 'overwrite' });
        expected = ['a', 'b', 'c'];
        units = 0;
        expect(t.$.rows.byIdOrFail('a').n()).toBe(10);
      } else {
        expect(() => t.$.rows.prependOne({ id: 'c', n: 30 })).toThrow(
          'already exists'
        );
        expected = ['a', 'b', 'c'];
        units = 0;
        expect(held.n()).toBe(3);
      }
      const after = reader.snapshot().collections[0].members;
      for (const event of events) apply(replica, event);
      const output = process.env.ST_MEMBERSHIP_REPLAY_OUTPUT;
      if (output)
        appendFileSync(
          output,
          JSON.stringify({
            mode,
            initial,
            events,
            observed,
            replica,
            after,
            physical: t.$.rows.ids(),
          }) + '\n'
        );
      expect(t.$.rows.ids()).toEqual(expected);
      expect(after.map((m) => m.key)).toEqual(expected);
      expect(after.find((m) => m.key === 'c')!.lifetimeId).toBe(
        initial.find((m) => m.key === 'c')!.lifetimeId
      );
      expect(replica).toEqual(after);
      expect(events).toHaveLength(units);
      expect(events.map((e) => e.sequence)).toEqual(units ? [1] : []);
      for (const snapshot of observed) expect(snapshot).toEqual(after);
    } finally {
      t.destroy();
    }
  });
