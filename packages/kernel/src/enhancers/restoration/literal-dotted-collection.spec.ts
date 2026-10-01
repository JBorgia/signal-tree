import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Promoted from the independent review. Realization resolved collections by
// splitting path labels, so a collection under the literal key 'a.b' was
// reversed into the nested collection at a -> b (reporting success), and with
// no nested collection every reversal was refused as structural drift.
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
type Rows = { all(): Row[]; addMany(rows: Row[]): void };
const ACTS: Record<string, (rows: any) => void> = {
  field: (rows) => rows.byId('a')!.n(50),
  update: (rows) => rows.updateOne('a', { n: 7 }),
  remove: (rows) => rows.removeOne('a'),
  add: (rows) => rows.addOne({ id: 'x', n: 5 }),
  rekey: (rows) => rows.changeId('a', 'z'),
};
const TOPOLOGIES = {
  'literal only': () => ({ 'a.b': { rows: entityMap<Row, string>() } }),
  'literal beside nested': () => ({
    'a.b': { rows: entityMap<Row, string>() },
    a: { b: { rows: entityMap<Row, string>() } },
  }),
};

describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)(
  'collections under literal dotted keys (%s)',
  (_order, enhancers) => {
    for (const [topology, state] of Object.entries(TOPOLOGIES))
      for (const [name, act] of Object.entries(ACTS))
        for (const via of ['undo', 'rollback'] as const) {
          it(`${via} of ${name}, ${topology}`, async () => {
            const error = vi
              .spyOn(console, 'error')
              .mockImplementation(() => undefined);
            const tree = signalTree(state() as Record<string, unknown>, {
              enhancers: enhancers() as never,
            }) as unknown as {
              $: Record<string, any>;
              transaction(fn: () => void): { rollback(): void };
              undo(): void;
              destroy(): void;
            };
            const literal = (): Rows => tree.$['a.b'].rows;
            const nested = (): Rows | undefined => tree.$.a?.b?.rows;
            const read = () => ({
              literal: literal().all(),
              nested: nested()?.all() ?? null,
            });
            try {
              literal().addMany([
                { id: 'a', n: 1 },
                { id: 'b', n: 2 },
              ]);
              nested()?.addMany([
                { id: 'a', n: 11 },
                { id: 'b', n: 12 },
              ]);
              await flush();
              const seeded = read();
              if (via === 'undo') {
                undoable(() => act(literal()));
                await flush();
                tree.undo();
              } else {
                tree.transaction(() => act(literal())).rollback();
              }
              expect(read()).toEqual(seeded);
            } finally {
              error.mockRestore();
              tree.destroy();
            }
          });
        }
  }
);
