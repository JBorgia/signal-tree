import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { confirmedTurnReader, observeWrites } from '../internals';
import { stateLocationReader } from './internals/state-location-view';
import { StudioTreeDestroyedError } from './internals/confirmed-turn-view';
import { getOwnedPositionIds } from './internals/owned-metadata';

// Tooling joins recorded evidence (a position, a subject lifetime, captured
// field keys) to a current location without parsing the `path` label: a
// literal 'a.b' key and nested a -> b share one label but are different
// locations, and an entity key keeps its number or string type.
type Row = { id: string | number; n: number; d?: { m: number } };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
// Carried from v15 012fd11d (v16 integration slice 6): `.transaction(` ->
// `.transact(`. Two expectations adapted (class b), marked "v16": an
// `updateOne(id, { d: { m } })` effect carries v16's producer-known field
// coordinate ['d'] (the field updateOne wrote; destination contract 4 and
// slice 1), where v15's capture descended to ['d', 'm']. The reader reports
// the captured coordinate; it never re-derives one.
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
        .transact(() => {
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
        // v16: ['d'], not v15's ['d', 'm'] (see the header).
        [p('rows'), e('r'), p('d')],
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

// Promoted from the independent review of the first implementation.
describe('state location reader stays read-only and reports only current state', () => {
  it('never invokes a same-named member of a non-collection node (a leaf would write)', async () => {
    const tree = signalTree(
      { b: { __findKeyBySubjectId: 0 } },
      { enhancers: [transactions()] }
    );
    const frames: unknown[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    try {
      // The BRANCH owns the position; its same-named member is a leaf accessor.
      const position = getOwnedPositionIds(tree.$.b)![0];
      expect(
        stateLocationReader(tree)!.locate([{ position, lifetimeId: 42 }])
      ).toEqual([undefined]);
      await flush();
      expect(tree.$.b.__findKeyBySubjectId()).toBe(0);
      expect(frames).toEqual([]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('does not locate an omitted optional member or anything under it', async () => {
    const tree = signalTree(
      {
        box: { keep: 1, opt: { v: 1, rows: entityMap<Row, string>() } } as {
          keep: number;
          opt?: { v: number; rows: ReturnType<typeof entityMap<Row, string>> };
        },
      },
      { enhancers: [transactions()] }
    );
    const frames: { positionIds?: readonly number[] }[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    try {
      (tree.$.box as any).opt.rows.addOne({ id: 'k', n: 1 });
      (tree.$.box as any).opt.v(2);
      await flush();
      const targets = [
        { position: frames.at(-1)!.positionIds![0] },
        { position: frames[0].positionIds![0], lifetimeId: 1 },
      ];
      const reader = stateLocationReader(tree)!;
      expect(reader.locate(targets)).toEqual([
        [p('box'), p('opt'), p('v')],
        [p('box'), p('opt'), p('rows'), e('k')],
      ]);
      (tree.$.box as any)({ keep: 2 });
      expect(reader.locate(targets)).toEqual([undefined, undefined]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('does not locate an entity field that the current row no longer has', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'r', n: 1, d: { m: 1 } });
      await flush();
      tree
        .transact(() => tree.$.rows.updateOne('r', { d: { m: 2 } }))
        .confirm();
      const effect = confirmedTurnReader(tree)!
        .readConfirmedTurns()
        .turns.at(-1)!.effects[0];
      const target = {
        position: effect.position,
        lifetimeId: effect.subjectId as number,
        fieldSegments: effect.fieldSegments,
      };
      const reader = stateLocationReader(tree)!;
      // v16: ['d'], not v15's ['d', 'm'] (see the header).
      expect(reader.locate([target])).toEqual([[p('rows'), e('r'), p('d')]]);
      tree.$.rows.replaceOne('r', { id: 'r', n: 1 });
      expect(reader.locate([target])).toEqual([undefined]);
    } finally {
      tree.destroy();
    }
  });

  it('returns segments detached between results of one call', async () => {
    const tree = make();
    const frames: { positionIds?: readonly number[] }[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    try {
      tree.$.cart.total(5);
      await flush();
      const target = { position: frames[0].positionIds![0] };
      const [first, second] = stateLocationReader(tree)!.locate([
        target,
        target,
      ]) as unknown as { key: string }[][];
      first[0].key = 'mutated';
      expect(second).toEqual([p('cart'), p('total')]);
    } finally {
      stop();
      tree.destroy();
    }
  });
});
