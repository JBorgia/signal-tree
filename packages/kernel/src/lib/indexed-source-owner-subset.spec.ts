import { describe, it, expect, vi } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
import { withWriteContext } from './write-context';
import { EntityOrdinaryTopology } from './physical/entity-ordinary-topology';
import { getOwnedSubjectIds } from './internals/owned-mutation';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
type Row = { id: string; n: number };
describe('indexed authored ordinary order domain', () => {
  it.each(['confirm', 'rollback'] as const)(
    'preserves omitted ordinary lifetime on %s',
    async (decision) => {
      const spy = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall');
      const t = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: [transactions()] }
      );
      let connection: ReturnType<typeof link> | undefined;
      let off: (() => void) | undefined;
      try {
        const r = t.$.rows;
        r.setAll([
          { id: 'a', n: 1 },
          { id: 'b', n: 2 },
          { id: 'c', n: 3 },
        ]);
        await tick();
        const a = r.byIdOrFail('a'),
          b = r.byIdOrFail('b'),
          c = r.byIdOrFail('c');
        const aid = getOwnedSubjectIds(a.n)?.[0],
          bid = getOwnedSubjectIds(b.n)?.[0],
          cid = getOwnedSubjectIds(c.n)?.[0];
        expect(aid).toBeDefined();
        expect(bid).toBeDefined();
        expect(cid).toBeDefined();
        const mutable: Row[][] = [];
        connection = link(r, {
          set: (value) => {
            mutable.push(structuredClone(value));
          },
        });
        const captures: Array<
          | {
              readonly before: readonly number[];
              readonly after: readonly number[];
            }
          | undefined
        > = [];
        off = getMutationCaptureRuntime(t)?.subscribeCollectionOrder?.(
          (capture) => {
            if (capture.meta?.transactionId !== undefined)
              captures.push(capture.ordinaryEndpoints);
          }
        );
        withWriteContext({ participation: 'inspection' }, () =>
          r.removeOne('b')
        );
        await tick();
        const pending = t.transact(() => r.setAll([c(), a()]));
        expect(() => pending.inspect()).not.toThrow();
        expect(captures[0]).toMatchObject({
          before: [aid, bid, cid],
          after: [cid, bid, aid],
        });
        const owner = spy.mock.contexts.at(-1);
        if (!(owner instanceof EntityOrdinaryTopology))
          throw new Error('Source owner context unavailable');
        expect(owner.read(bid!)).toMatchObject({
          present: true,
          key: 'b',
          beforeSubject: cid,
          afterSubject: aid,
        });
        pending[decision]();
        await tick();
        await connection.settled();
        const expected =
          decision === 'confirm' ? ['c', 'b', 'a'] : ['a', 'b', 'c'];
        expect(mutable.at(-1)?.map((row) => row.id)).toEqual(expected);
        r.updateOne('a', { n: 4 });
        await tick();
        await connection.settled();
        expect(mutable.at(-1)?.map((row) => row.id)).toEqual(expected);
        expect(mutable.at(-1)?.find((row) => row.id === 'b')?.n).toBe(2);
        expect(getOwnedSubjectIds(b.n)?.[0]).toBe(bid);
        expect(owner.atKey('b')).toBe(bid);
        expect(owner.read(bid!)).toMatchObject({
          present: true,
          key: 'b',
          beforeSubject: decision === 'confirm' ? cid : aid,
          afterSubject: decision === 'confirm' ? aid : cid,
        });
      } finally {
        off?.();
        connection?.dispose();
        t.destroy();
        spy.mockRestore();
      }
    }
  );
});
