import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type ExperimentalScalar = ReturnType<typeof link> & {
  declare(input: { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 48; i++) await Promise.resolve();
};

// Public native calls + local typing of the existing experimental scalar method.
// Prerequisite only: these cases make NO claim about aggregate declarations.
describe('scalar prerequisites for public aggregate owner construction', () => {
  it.each(['confirm', 'rollback'] as const)(
    'returned owning handle can cover a fresh equal support setter before %s',
    async (outcome) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      const sends: number[] = [];
      const c = link(tree.$.x, { set: value => { sends.push(value); } }) as ExperimentalScalar;
      const p = tree.transact(() => tree.$.x(7));
      let off: () => void = () => undefined;
      try {
        await flush();
        expect(sends).toEqual([]);
        const before = p.inspect();
        expect(before.changes).toHaveLength(1);
        expect(before.changes[0]).toMatchObject({ path: 'x' });
        const valueEvents: unknown[] = [];
        off = getPathNotifier().subscribe('x', value => { valueEvents.push(value); });
        const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.x(7));
        await flush();
        expect(tree.$.x()).toBe(7);
        expect(valueEvents).toEqual([]);
        expect(p.inspect()).toEqual(before);
        expect(receipt.read()).toMatchObject({ state: 'held', reason: 'pending-dependency' });
        expect(sends).toEqual([]);
        tree.$.y(8);
        await flush();
        expect(tree.$.y()).toBe(8);
        expect(p.inspect()).toEqual(before);
        expect(valueEvents).toEqual([]);
        expect(sends).toEqual([]);
        if (outcome === 'confirm') {
          p.confirm(); await flush();
          expect(tree.$.x()).toBe(7); expect(tree.$.y()).toBe(8);
          expect(sends).toEqual([7]);
          expect(valueEvents).toEqual([]);
          expect(receipt.read()).toMatchObject({ state: 'started' });
        } else {
          p.rollback(); await flush();
          expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(8);
          expect(sends).toEqual([0]);
          expect(valueEvents).toEqual([0]);
          expect(receipt.read()).toMatchObject({ state: 'superseded' });
        }
        await c.settled();
      } finally {
        off(); c.dispose(); tree.destroy();
      }
    }
  );
});
