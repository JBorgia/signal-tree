// Test-only C23 counterpart packet. Not executed; no shipping typing claim.
// The existing runtime method is reached through a local capability cast only.
// Public/native observations and authentic handles; no publication internals.
import { expect, it } from 'vitest';
import { computed, nextTick } from 'vue';
import { signalTree, transactions, link } from '../index';

type Shape = 'leaf' | 'whole';
type State = Readonly<{
  state: string;
  basis?: string;
  reason?: string;
}>;
type Receipt = Readonly<{ read: () => State }>;
type DeclarationLink = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => void): Receipt;
};
function declarationLink(connection: ReturnType<typeof link>): DeclarationLink {
  expect(typeof Reflect.get(connection, 'declare')).toBe('function');
  return connection as DeclarationLink;
}
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const step = async (work: () => void) => { work(); await drain(); await nextTick(); };
const cases = (['leaf', 'whole'] as const).flatMap((shape) =>
  ([true, false] as const).flatMap((owned) =>
    (['confirm', 'rollback'] as const).map((terminal) => ({ shape, owned, terminal }))
  )
);
const expected = (shape: Shape, x: number): number | { x: number; y: number } =>
  shape === 'leaf' ? x : { x, y: 0 };

it.each(cases)(
  'vue equal $shape / actual-owned=$owned / $terminal',
  async ({ shape, owned, terminal }) => {
    const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
    const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
    const sent: (number | { x: number; y: number })[] = [];
    const writeX = (value: number): void => { tree.$.pair.x.value = value; };
    const writeOwner = (value: number): void => { owner.$.z.value = value; };
    const readX = (): number => tree.$.pair.x.value;
    const readOwner = (): number => owner.$.z.value;
    const native = computed(() => tree.$.pair.x.value);
    const readNative = () => native.value;
    const stopNative = () => { /* Lazy computed; no watch/effect was installed. */ };
    // Separate calls preserve the actual facade source typing, avoiding a union cast.
    const c = declarationLink(shape === 'leaf'
      ? link(tree.$.pair.x, { set: (value) => { sent.push(value); } })
      : link(tree.$.pair, { set: (value) => { sent.push({ x: value.x, y: value.y }); } })
    );
    try {
      await step(() => { /* Settle construction/native observation before setup. */ });
      expect(readNative()).toBe(0);
      let pending!: ReturnType<typeof tree.transact>;
      await step(() => {
        pending = owned
          ? tree.transact(() => { writeX(7); })
          : owner.transact(() => { writeOwner(7); });
        if (!owned) writeX(7);
      });
      expect(readX()).toBe(7);
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(readNative()).toBe(7);
      expect(sent).toEqual([]); // Required predecessor hold, not a cleared log.
      const pendingBefore = pending.inspect();
      let receipt: Receipt | undefined;
      let calls = 0;
      await step(() => {
        receipt = c.declare({ kind: 'independent' }, () => {
          calls++;
          if (shape === 'leaf') writeX(7);
          else tree.$.pair({ x: 7, y: 0 }); // explicit whole literal, no updater read
        });
      });
      expect(calls).toBe(1);
      if (!receipt) throw new Error('Declaration did not return a receipt');
      expect(Object.isFrozen(receipt)).toBe(true);
      const admission = receipt.read();
      expect(Object.isFrozen(admission)).toBe(true);
      expect(pending.inspect()).toEqual(pendingBefore);
      expect(readX()).toBe(7);
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(readNative()).toBe(7);
      expect(readOwner()).toBe(owned ? 0 : 7);
      if (owned) {
        expect(sent).toEqual([]);
        // This invocation adopts no new support; older connection work is still held.
        expect(admission).toEqual({ state: 'no-write' });
      } else {
        expect(sent).toEqual([expected(shape, 7)]);
        expect(admission).toEqual({ state: 'started', basis: 'declared' });
      }
      const admissionCopy = { ...admission };
      let settled = false;
      const wait = c.settled().then(() => { settled = true; });
      await step(() => { /* Observe settlement without awaiting an intentionally held Link. */ });
      expect(settled).toBe(!owned);
      expect(pending.inspect()).toEqual(pendingBefore);
      await step(() => { pending[terminal](); });
      const final = owned && terminal === 'rollback' ? 0 : 7;
      expect(readX()).toBe(final);
      expect(tree.$.pair()).toEqual({ x: final, y: 0 });
      expect(readNative()).toBe(final);
      expect(readOwner()).toBe(!owned && terminal === 'confirm' ? 7 : 0);
      expect(sent).toEqual([expected(shape, final)]);
      expect(settled).toBe(true);
      await wait;
      const terminalState = receipt.read();
      if (owned) {
        // No-write is terminal even when the Link's older work later publishes.
        expect(terminalState).toEqual({ state: 'no-write' });
      } else {
        expect(terminalState.state).toBe('started');
      }
      if (!owned) expect(terminalState).toEqual(admissionCopy);
      expect(admission).toEqual(admissionCopy); // retained snapshot never mutated
      expect(Object.isFrozen(terminalState)).toBe(true);
      expect(Reflect.set(terminalState, 'state', 'forged')).toBe(false);
      await step(() => { /* No duplicate after terminal settlement. */ });
      expect(sent).toEqual([expected(shape, final)]);
      await step(() => { writeX(8); });
      await c.settled();
      expect(readNative()).toBe(8);
      expect(sent).toEqual([expected(shape, final), expected(shape, 8)]);
      expect(receipt.read()).toEqual(terminalState);
      c.dispose();
      await step(() => { writeX(9); });
      expect(readNative()).toBe(9);
      expect(sent).toEqual([expected(shape, final), expected(shape, 8)]);
      expect(receipt.read()).toEqual(terminalState);
    } finally {
      c.dispose();
      stopNative();
      tree.destroy();
      owner.destroy();
    }
  }
);
