// Test-only public-kernel packet against C23. Unexecuted; not a shipping type gate.
import { expect, it } from 'vitest';
import { link, signalTree, transactions, type PendingTransaction } from '../index';

type State = Readonly<{ state: string; basis?: string; reason?: string }>;
type Receipt = Readonly<{ read: () => State }>;
type Declaration = { kind: 'independent' } | { kind: 'dependent'; owners: readonly PendingTransaction[] };
type DeclaredLink = ReturnType<typeof link> & {
  declare(input: Declaration, work: () => unknown): Receipt;
};
function declared(connection: ReturnType<typeof link>): DeclaredLink {
  expect(typeof Reflect.get(connection, 'declare')).toBe('function');
  return connection as DeclaredLink;
}
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const caught = (work: () => unknown): unknown => {
  try { work(); } catch (error) { return error; }
  return undefined;
};

it.each(['dependent'] as readonly ('independent' | 'dependent')[])(
  'pending native ancestor input is respected by a %s declaration',
  async (kind) => {
    const tree = signalTree({ x: 0, pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
    const sent: { x: number; y: number }[] = [];
    const c = declared(link(tree.$.pair, { set: (value) => { sent.push({ ...value }); } }));
    try {
      const p = tree.transact(() => tree.$.x(7));
      await drain();
      const ownership = p.inspect();
      expect(sent).toEqual([]);
      let calls = 0;
      let receipt: Receipt | undefined;
      const error = caught(() => {
        receipt = c.declare(kind === 'independent' ? { kind } : { kind, owners: [p] }, () => {
          tree.$((input) => {
            calls++;
            expect(input.x).toBe(7);
            return { ...input, pair: { x: input.x, y: input.pair.y } };
          });
        });
      });
      expect(calls).toBe(1);
      if (kind === 'independent') {
        expect(error).toMatchObject({
          code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',
          stage: 'after-callback', reason: 'contradiction',
        });
        expect(receipt).toBeUndefined();
      } else {
        expect(error).toBeUndefined();
        if (!receipt) throw new Error('Dependent declaration returned no receipt');
        // Aggregate projection may still be validating synchronously.
        expect(sent).toEqual([]);
      }
      // Contradiction is not rollback of the callback's installed writes.
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(tree.$.x()).toBe(7);
      expect(p.inspect()).toEqual(ownership);
      await drain();
      expect(sent).toEqual([]);
      if (kind === 'dependent') {
        console.log('RECEIPT-OBSERVATION', JSON.stringify({phase:'after-drain',state:receipt?.read(),sent}));
      }
      let settled = false;
      const wait = c.settled().then(() => { settled = true; });
      await drain();
      expect(settled).toBe(false);
      p.confirm();
      await drain();
      expect(sent).toEqual([{ x: 7, y: 0 }]);
      expect(settled).toBe(true);
      await wait;
      if (kind === 'dependent') console.log('RECEIPT-OBSERVATION', JSON.stringify({phase:'after-confirm',state:receipt?.read(),sent,settled}));
      await drain();
      expect(sent).toEqual([{ x: 7, y: 0 }]);
    } finally { c.dispose(); tree.destroy(); }
  }
);

