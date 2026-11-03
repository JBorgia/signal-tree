import { expect, it, vi } from 'vitest';
import { EntityValueStore } from '../../physical/entity-value-store';
import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../../index';
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
it('restores ordinary membership with a foreign live-row field before the next transaction captures', async () => {
  const t = signalTree(
    {
      left: entityMap<{ id: string; n: number }, string>(),
      right: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [transactions(), restoration()] }
  );
  const seededLeft = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ],
    seededRight = [
      { id: 'a', n: 11 },
      { id: 'b', n: 12 },
    ];
  t.$.left.setAll(seededLeft);
  t.$.right.setAll(seededRight);
  await flush();
  const leftSent: unknown[] = [],
    rightSent: unknown[] = [];
  const lc = link(t.$.left, {
      set: (value) => {
        leftSent.push(value);
      },
    }),
    rc = link(t.$.right, {
      set: (value) => {
        rightSent.push(value);
      },
    });
  try {
    const held = t.$.left.byIdOrFail('a');
    const act = () => {
      t.$.left.removeOne('a');
      t.$.right.byIdOrFail('a').n(50);
    };
    undoable(act);
    await flush();
    await lc.settled();
    await rc.settled();
    expect(leftSent.at(-1)).toEqual([seededLeft[1]]);
    expect(rightSent.at(-1)).toEqual([{ id: 'a', n: 50 }, seededRight[1]]);
    for (const direction of ['undo', 'redo', 'undo'] as const) {
      t[direction]();
      await flush();
      await lc.settled();
      await rc.settled();
      const undone = direction === 'undo';
      expect(t.$.left.all()).toEqual(undone ? seededLeft : [seededLeft[1]]);
      expect(leftSent.at(-1)).toEqual(undone ? seededLeft : [seededLeft[1]]);
      expect(t.$.right.all()).toEqual(
        undone ? seededRight : [{ id: 'a', n: 50 }, seededRight[1]]
      );
      expect(rightSent.at(-1)).toEqual(
        undone ? seededRight : [{ id: 'a', n: 50 }, seededRight[1]]
      );
    }
    expect(t.$.left.byIdOrFail('a')).toBe(held);
    const pending = t.transact(act);
    expect(pending.inspect().changes.some((c) => c.path === 'left.a')).toBe(
      true
    );
    pending.rollback();
    await flush();
    await lc.settled();
    await rc.settled();
    expect(t.$.left.all()).toEqual(seededLeft);
    expect(t.$.right.all()).toEqual(seededRight);
    expect(leftSent.at(-1)).toEqual(seededLeft);
    expect(rightSent.at(-1)).toEqual(seededRight);
    expect(t.$.left.byIdOrFail('a')).toBe(held);
  } finally {
    lc.dispose();
    rc.dispose();
    t.destroy();
  }
});

it('contains a throwing row callback without dropping another live-row inverse publication', async () => {
  const t = signalTree(
    {
      left: entityMap<{ id: string; n: number }, string>(),
      right: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [restoration()] }
  );
  t.$.left.addOne({ id: 'a', n: 1 });
  t.$.right.setAll([
    { id: 'a', n: 11 },
    { id: 'b', n: 12 },
  ]);
  await flush();
  const sent: unknown[] = [];
  const c = link(t.$.right, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    undoable(() => {
      t.$.left.removeOne('a');
      t.$.right.byIdOrFail('a').n(50);
      t.$.right.byIdOrFail('b').n(60);
    });
    await flush();
    await c.settled();
    const sentinel = new Error('controlled row callback');
    let armed = true;
    t.$.right.tap({
      onUpdate() {
        if (armed) {
          armed = false;
          throw sentinel;
        }
      },
    });
    expect(() => t.undo()).toThrow(sentinel);
    await flush();
    await c.settled();
    expect(t.$.left.ids()).toEqual(['a']);
    expect(t.$.right.all()).toEqual([
      { id: 'a', n: 11 },
      { id: 'b', n: 12 },
    ]);
    expect(sent.at(-1)).toEqual([
      { id: 'a', n: 11 },
      { id: 'b', n: 12 },
    ]);
  } finally {
    c.dispose();
    t.destroy();
  }
});

for (const mode of ['throw', 'reentry'] as const)
  it(`keeps mixed inverse atomic after live-row preparation ${mode}`, async () => {
    const t = signalTree(
      {
        count: 0,
        left: entityMap<{ id: string; n: number }, string>(),
        right: entityMap<{ id: string; n: number }, string>(),
      },
      { enhancers: [restoration()] }
    );
    try {
      t.$.left.addOne({ id: 'a', n: 1 });
      t.$.right.addOne({ id: 'a', n: 11 });
      await flush();
      const held = t.$.left.byIdOrFail('a');
      undoable(() => {
        t.$.left.removeOne('a');
        t.$.right.byIdOrFail('a').n(50);
      });
      await flush();
      const original = EntityValueStore.prototype.prepareRealizationTransition;
      const sentinel = new Error('controlled live-row preparation');
      let entered = false;
      const spy = vi
        .spyOn(EntityValueStore.prototype, 'prepareRealizationTransition')
        .mockImplementation(function (
          this: EntityValueStore<Record<string, unknown>>,
          subject,
          value,
          edits
        ) {
          const result = original.call(this, subject, value, edits);
          if (!entered) {
            entered = true;
            if (mode === 'throw') throw sentinel;
            t.$.count(5);
          }
          return result;
        });
      try {
        // Reentry is rejected during joint preparation, before the install guard.
        expect(() => t.undo()).toThrow(
          mode === 'throw' ? sentinel : 'Joint preparation reentered installation'
        );
      } finally {
        spy.mockRestore();
      }
      expect(entered).toBe(true);
      expect(t.$.left.ids()).toEqual([]);
      expect(t.$.right.byIdOrFail('a').n()).toBe(50);
      expect(t.$.count()).toBe(mode === 'throw' ? 0 : 5);
      t.undo();
      expect(t.$.left.byIdOrFail('a')).toBe(held);
      expect(t.$.right.byIdOrFail('a').n()).toBe(11);
      expect(t.$.count()).toBe(mode === 'throw' ? 0 : 5);
      t.redo();
      expect(t.$.left.ids()).toEqual([]);
      expect(t.$.right.byIdOrFail('a').n()).toBe(50);
    } finally {
      t.destroy();
    }
  });
