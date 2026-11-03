import { expect, it } from 'vitest';
import { leaf, link, signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';

type Receipt = {
  read(): Readonly<{ state: string; reason?: string; basis?: string }>;
};
type DeclaringLink = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): Receipt;
};
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};

// One scenario, parameterized only over the physical return-to-ordinary route.
// Inspection is the sole private ingress; no proof or publication internals.
for (const route of ['direct', 'frame'] as const) {
  it(`saved inspection snapshot cannot borrow fresh ordinary support: ${route}`, async () => {
    const source = signalTree({ pair: { x: 0 } });
    const foreign = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const oldTarget = signalTree({ value: 0 });
    const freshTarget = signalTree({ value: 0 });
    const oldSent: number[] = [];
    const freshSent: number[] = [];
    const oldLink = link(oldTarget.$.value, {
      set: (value) => { oldSent.push(value); },
    }) as DeclaringLink;
    const freshLink = link(freshTarget.$.value, {
      set: (value) => { freshSent.push(value); },
    }) as DeclaringLink;
    const holders: { destroy(): void }[] = [];
    try {
      source.$.pair.x(7);
      withWriteContext({ participation: 'inspection' }, () => {
        source.$.pair.x(99);
      });
      const saved = source.$.pair();
      expect(saved).toEqual({ x: 99 });
      if (route === 'direct') source.$.pair.x(7);
      else source.$.pair({ x: 7 });
      const fresh = source.$.pair();
      expect(fresh).toEqual({ x: 7 });
      expect(fresh).not.toBe(saved);
      expect(saved).toEqual({ x: 99 });
      await drain();

      // Public opaque terminals preserve these exact snapshot objects. A real
      // updater receives them AFTER the source has returned to ordinary 7.
      const oldHolder = signalTree({ input: leaf(saved) });
      const freshHolder = signalTree({ input: leaf(fresh) });
      holders.push(oldHolder, freshHolder);
      const q = foreign.transact(() => foreign.$.x(1));
      const pendingQ = q.inspect();
      let oldCalls = 0;
      let freshCalls = 0;
      const oldReceipt = oldLink.declare({ kind: 'independent' }, () => {
        oldHolder.$((current) => {
          oldCalls++;
          expect(current.input).toBe(saved);
          expect(current.input.x).toBe(99);
          oldTarget.$.value(current.input.x);
          return current;
        });
      });
      const freshReceipt = freshLink.declare({ kind: 'independent' }, () => {
        freshHolder.$((current) => {
          freshCalls++;
          expect(current.input).toBe(fresh);
          expect(current.input.x).toBe(7);
          freshTarget.$.value(current.input.x);
          return current;
        });
      });
      expect([oldCalls, freshCalls]).toEqual([1, 1]);
      expect(oldTarget.$.value()).toBe(99);
      expect(freshTarget.$.value()).toBe(7);
      expect(oldReceipt.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
      await drain();
      expect(oldSent).toEqual([]);
      expect(freshSent).toEqual([7]);
      expect(freshReceipt.read()).toMatchObject({ state: 'started' });
      expect(q.inspect()).toEqual(pendingQ);
      expect(source.$.pair()).toEqual({ x: 7 });
      expect(saved).toEqual({ x: 99 });

      q.confirm();
      await drain();
      await Promise.all([oldLink.settled(), freshLink.settled()]);
      expect(oldSent).toEqual([99]);
      expect(freshSent).toEqual([7]);
      expect(oldReceipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
      expect(source.$.pair()).toEqual({ x: 7 });
      expect(saved).toEqual({ x: 99 });
      await drain();
      expect(oldSent).toEqual([99]);
      expect(freshSent).toEqual([7]);
    } finally {
      oldLink.dispose();
      freshLink.dispose();
      for (const holder of holders) holder.destroy();
      oldTarget.destroy();
      freshTarget.destroy();
      source.destroy();
      foreign.destroy();
    }
  });
}
