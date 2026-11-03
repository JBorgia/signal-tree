import { expect, it } from 'vitest';
import {
  entityMap,
  link,
  restoration,
  signalTree,
  undoable,
} from '../../../index';
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
it('preserves callback-authored rows in physical state and final outbound after mixed undo', async () => {
  const t = signalTree(
    {
      left: entityMap<{ id: string; n: number }, string>(),
      right: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [restoration()] }
  );
  try {
    t.$.left.addOne({ id: 'a', n: 1 });
    t.$.right.setAll([
      { id: 'a', n: 11 },
      { id: 'b', n: 12 },
    ]);
    await flush();
    const sent: unknown[] = [];
    const connection = link(t.$.right, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      undoable(() => {
        t.$.left.removeOne('a');
        t.$.right.byIdOrFail('a').n(50);
        t.$.right.byIdOrFail('b').n(60);
      });
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toEqual([
        { id: 'a', n: 50 },
        { id: 'b', n: 60 },
      ]);
      let armed = true;
      t.$.right.tap({
        onUpdate(key) {
          if (!armed) return;
          armed = false;
          t.$.right.byIdOrFail(key === 'a' ? 'b' : 'a').n(777);
        },
      });
      t.undo();
      await flush();
      await connection.settled();
      expect(armed).toBe(false);
      expect(t.$.right.all()).toEqual([
        { id: 'a', n: 777 },
        { id: 'b', n: 12 },
      ]);
      expect(sent.at(-1)).toEqual([
        { id: 'a', n: 777 },
        { id: 'b', n: 12 },
      ]);
    } finally {
      connection.dispose();
    }
  } finally {
    t.destroy();
  }
});
