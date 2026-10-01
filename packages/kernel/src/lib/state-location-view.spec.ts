import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { confirmedTurnReader, observeWrites } from '../internals';
import { stateLocationReader } from './internals/state-location-view';
import { StudioTreeDestroyedError } from './internals/confirmed-turn-view';

// Tooling joins recorded evidence (a position, a subject lifetime, captured
// field keys) to a current location without parsing the `path` label: a
// literal 'a.b' key and nested a -> b share one label but are different
// locations, and an entity key keeps its number or string type.
type Row = { id: string | number; n: number; d?: { m: number } };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const make = () =>
  signalTree(
    {
      cart: { total: 1 },
      'a.b': { n: 0 },
      a: { b: { n: 0 } },
      rows: entityMap<Row, string | number>(),
    },
    { enhancers: [transactions({ history: { retain: 10 } }), restoration()] }
  );
const p = (key: string) => ({ kind: 'property' as const, key });
const e = (key: string | number) => ({ kind: 'entity' as const, key });

describe('state location reader', () => {
  it('locates confirmed effects by position, lifetime and captured field keys', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'r', n: 1, d: { m: 1 } });
      tree.$.rows.addOne({ id: 1, n: 1 });
      tree.$.rows.addOne({ id: '1', n: 1 });
      await flush();
      tree
        .transaction(() => {
          tree.$.cart.total(2);
          tree.$['a.b'].n(3);
          tree.$.a.b.n(4);
          tree.$.rows.updateOne('r', { d: { m: 2 } });
          tree.$.rows.updateOne(1, { n: 5 });
          tree.$.rows.updateOne('1', { n: 6 });
        })
        .confirm();
      const effects = confirmedTurnReader(tree)!
        .readConfirmedTurns()
        .turns.at(-1)!.effects;
      const located = stateLocationReader(tree)!.locate(
        effects.map((effect) => ({
          position: effect.position,
          lifetimeId:
            typeof effect.subjectId === 'number' ? effect.subjectId : undefined,
          fieldSegments: effect.fieldSegments,
        }))
      );
      expect(located).toEqual([
        [p('cart'), p('total')],
        [p('a.b'), p('n')],
        [p('a'), p('b'), p('n')],
        [p('rows'), e('r'), p('d'), p('m')],
        [p('rows'), e(1), p('n')],
        [p('rows'), e('1'), p('n')],
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('locates observed writes by their positions', async () => {
    const tree = make();
    const frames: { positionIds?: readonly number[] }[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    try {
      tree.$['a.b'].n(7);
      tree.$.cart.total(8);
      await flush();
      const located = stateLocationReader(tree)!.locate(
        frames.map((frame) => ({ position: frame.positionIds![0] }))
      );
      expect(located).toEqual([
        [p('a.b'), p('n')],
        [p('cart'), p('total')],
      ]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('reports the current key after a rekey and nothing for a removed entity', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'x', n: 1 });
      await flush();
      const reader = stateLocationReader(tree)!;
      const position = (tree.$.rows as unknown as { __positionIds?: number[] })
        .__positionIds?.[0];
      expect(position).toBeTypeOf('number');
      expect(reader.locate([{ position: position!, lifetimeId: 1 }])).toEqual([
        [p('rows'), e('x')],
      ]);
      tree.$.rows.changeId('x', 'y');
      expect(reader.locate([{ position: position!, lifetimeId: 1 }])).toEqual([
        [p('rows'), e('y')],
      ]);
      tree.$.rows.removeOne('y');
      expect(reader.locate([{ position: position!, lifetimeId: 1 }])).toEqual([
        undefined,
      ]);
      expect(reader.locate([{ position: 99_999 }])).toEqual([undefined]);
    } finally {
      tree.destroy();
    }
  });

  it('retains nothing, returns detached segments, and refuses after destruction', async () => {
    const tree = make();
    const reader = stateLocationReader(tree)!;
    const frames: { positionIds?: readonly number[] }[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    tree.$.cart.total(3);
    await flush();
    stop();
    const target = { position: frames[0].positionIds![0] };
    const first = reader.locate([target])[0] as unknown as { key: string }[];
    first[0].key = 'mutated';
    expect(reader.locate([target])).toEqual([[p('cart'), p('total')]]);
    expect(tree.$.cart.total()).toBe(3);
    tree.destroy();
    expect(() => reader.locate([target])).toThrow(StudioTreeDestroyedError);
    expect(() => stateLocationReader(tree)).toThrow(StudioTreeDestroyedError);
  });
});
