// Preregistered public discriminator; unexecuted, separate from author candidate.
import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
type Declared = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): unknown;
};
const drain = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
for (const route of ['leaf', 'whole'] as const) {
  it(`terminal destination does not prevent unowned possible-only refresh: ${route}`, async () => {
    const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
    const foreign = signalTree({ z: 0 }, { enhancers: [transactions()] });
    const sent: { x: number; y: number }[] = [];
    const c = link(tree.$.pair, { set: value => { sent.push({ ...value }); } }) as Declared;
    let off = () => {};
    try {
      const q = foreign.transact(() => foreign.$.z(1));
      // No q read, declaration, updater input, or shared validation horizon.
      const p = tree.transact(() => tree.$.pair.x(7));
      await drain();
      expect(sent).toEqual([]);
      const qBefore = q.inspect();
      p.confirm();
      await drain();
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(sent).toEqual([]);
      expect(q.inspect()).toEqual(qBefore);
      let notices = 0;
      off = tree.$.pair.x.subscribe(() => { notices++; });
      let settled = false;
      const waiting = c.settled().then(() => { settled = true; });
      await drain();
      expect(settled).toBe(false);
      let calls = 0;
      c.declare({ kind: 'independent' }, () => {
        calls++;
        if (route === 'leaf') tree.$.pair.x(7);
        else tree.$.pair({ x: 7, y: 0 });
      });
      await drain();
      expect(calls).toBe(1);
      expect(notices).toBe(0);
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(q.inspect()).toEqual(qBefore);
      expect(foreign.$.z()).toBe(1);
      expect(sent).toEqual([{ x: 7, y: 0 }]);
      expect(settled).toBe(true);
      await waiting;
      // Foreign compensation must not change the independent destination.
      q.rollback();
      await drain();
      expect(foreign.$.z()).toBe(0);
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(sent).toEqual([{ x: 7, y: 0 }]);
      expect(notices).toBe(0);
      c.dispose();
      tree.$.pair.x(8);
      await drain();
      expect(sent).toEqual([{ x: 7, y: 0 }]);
    } finally { off(); c.dispose(); tree.destroy(); foreign.destroy(); }
  });
}
