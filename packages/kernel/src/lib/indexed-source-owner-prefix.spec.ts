import { describe, it, expect } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
import { withWriteContext } from './write-context';
const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
type Row = { id: string; n: number };
describe('common prepared prefix order intent', () => {
  for (const inspected of ['cba', 'bca'])
    for (const operation of ['fresh', 'existing', 'mixed'])
      for (const decision of ['confirm', 'rollback'] as const)
        it(`${inspected} ${operation} ${decision} preserves ordinary intent through a later inverse`, async () => {
          const t = signalTree(
            { rows: entityMap<Row, string>() },
            { enhancers: [transactions()] }
          );
          let connection: ReturnType<typeof link> | undefined;
          try {
            const r = t.$.rows;
            r.setAll([
              { id: 'a', n: 1 },
              { id: 'b', n: 2 },
              { id: 'c', n: 3 },
            ]);
            await tick();
            const sent: Row[][] = [];
            connection = link(r, {
              set: (value) => {
                sent.push(structuredClone(value));
              },
            });
            withWriteContext({ participation: 'inspection' }, () =>
              r.setAll([...inspected].map((id) => r.byIdOrFail(id)()))
            );
            await tick();
            const pending = t.transact(() => {
              if (operation === 'fresh') r.prependOne({ id: 'y', n: 9 });
              else
                r.prependMany(
                  operation === 'existing'
                    ? [r.byIdOrFail('c')()]
                    : [{ id: 'y', n: 9 }, r.byIdOrFail('c')()],
                  { mode: 'overwrite' }
                );
            });
            expect(() => pending.inspect()).not.toThrow();
            pending[decision]();
            await tick();
            await connection.settled();
            const expected =
              decision === 'rollback'
                ? 'abc'
                : operation === 'existing'
                ? inspected === 'cba'
                  ? 'abc'
                  : 'cba'
                : operation === 'mixed' && inspected === 'bca'
                ? 'ycba'
                : inspected === 'cba'
                ? 'abyc'
                : 'aybc';
            const later = t.transact(() => r.removeOne('c'));
            later.rollback();
            await tick();
            await connection.settled();
            r.updateOne('a', { n: 4 });
            await tick();
            await connection.settled();
            expect(
              sent
                .at(-1)
                ?.map((row) => row.id)
                .join('')
            ).toBe(expected);
            expect(sent.at(-1)?.find((row) => row.id === 'a')?.n).toBe(4);
          } finally {
            connection?.dispose();
            t.destroy();
          }
        });
});
