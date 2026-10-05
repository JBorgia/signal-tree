import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { leaf } from '../index';
import { link } from './link';
import { transactions } from '../enhancers/transactions/transactions';
import { confirmedTurnReader, observeWrites } from '../internals';
import { stateLocationReader } from './internals/state-location-view';
import { getOwnedPositionIds } from './internals/owned-metadata';

/**
 * v16 controls for the state location reader and confirmed `fieldSegments`
 * (v15 → v16 integration, slice 6).
 *
 * v16 already owns typed position addresses (registered at allocation) and
 * producer-known entity field coordinates (`subjectFieldSegments`, slice 1).
 * The reader resolves through those, never through a path label, and the
 * confirmed view projects the captured coordinate as `fieldSegments`.
 */
type Row = { id: string | number; n: number; d?: { m: number } };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const p = (key: string) => ({ kind: 'property' as const, key });
const e = (key: string | number) => ({ kind: 'entity' as const, key });

describe('confirmed fieldSegments follow v16 field coordinates', () => {
  it('equal the row-relative tail of the inspected address, and locate the field', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string | number>() },
      { enhancers: [transactions({ history: { retain: 10 } })] }
    );
    try {
      tree.$.rows.addOne({ id: 'r', n: 1 });
      await flush();
      const pending = tree.transact(() => tree.$.rows.updateOne('r', { n: 2 }));
      const inspected = pending.inspect().changes[0];
      pending.confirm();
      const effect = confirmedTurnReader(tree)!
        .readConfirmedTurns()
        .turns.at(-1)!.effects[0];
      expect(effect.fieldSegments).toEqual(['n']);
      expect(inspected.address).toEqual(['rows', ...effect.fieldSegments!]);
      expect(
        stateLocationReader(tree)!.locate([
          {
            position: effect.position,
            lifetimeId: effect.subjectId as number,
            fieldSegments: effect.fieldSegments,
          },
        ])
      ).toEqual([[p('rows'), e('r'), p('n')]]);
    } finally {
      tree.destroy();
    }
  });

  it('are detached per read and absent from scalar effects', () => {
    const tree = signalTree(
      { x: 0, rows: entityMap<Row, string | number>() },
      { enhancers: [transactions({ history: { retain: 10 } })] }
    );
    try {
      tree.$.rows.addOne({ id: 1, n: 1 });
      tree
        .transact(() => {
          tree.$.x(1);
          tree.$.rows.updateOne(1, { n: 2 });
        })
        .confirm();
      const reader = confirmedTurnReader(tree)!;
      const [scalar, field] = reader.readConfirmedTurns().turns.at(-1)!.effects;
      expect(scalar).not.toHaveProperty('fieldSegments');
      (field.fieldSegments as string[]).push('mutated');
      expect(
        reader.readConfirmedTurns().turns.at(-1)!.effects[1].fieldSegments
      ).toEqual(['n']);
    } finally {
      tree.destroy();
    }
  });
});

describe('state location resolves v16 position ownership, currently', () => {
  it('an opaque leaf payload is one location; nothing inside it is', async () => {
    const tree = signalTree(
      { box: { bounds: leaf({ min: 0, max: 10 }) } },
      { enhancers: [transactions({ history: { retain: 10 } })] }
    );
    try {
      tree.transact(() => tree.$.box.bounds({ min: 1, max: 9 })).confirm();
      const effect = confirmedTurnReader(tree)!
        .readConfirmedTurns()
        .turns.at(-1)!.effects[0];
      expect(effect).not.toHaveProperty('fieldSegments');
      const reader = stateLocationReader(tree)!;
      expect(reader.locate([{ position: effect.position }])).toEqual([
        [p('box'), p('bounds')],
      ]);
      // A lifetime on a non-collection position never resolves.
      expect(
        reader.locate([
          { position: effect.position, lifetimeId: 1, fieldSegments: ['min'] },
        ])
      ).toEqual([undefined]);
    } finally {
      tree.destroy();
    }
  });

  it('a position allocated lazily on a bare tree resolves through its registered address', async () => {
    const tree = signalTree({ 'a.b': { n: 0 }, a: { b: { n: 0 } } });
    const frames: { positionIds?: readonly number[]; ownerId?: number }[] = [];
    const stop = observeWrites((frame) => frames.push(frame));
    // A relationship claims observation; that is what allocates leaf positions
    // on a tree built without position topology.
    const literal = link(tree.$['a.b'], { set: () => undefined });
    const nested = link(tree.$.a.b, { set: () => undefined });
    try {
      tree.$['a.b'].n(1);
      tree.$.a.b.n(2);
      await flush();
      const positions = frames.map((frame) => frame.positionIds?.[0]);
      expect(positions.every((position) => typeof position === 'number')).toBe(
        true
      );
      expect(
        stateLocationReader(tree)!.locate(
          positions.map((position) => ({ position: position! }))
        )
      ).toEqual([
        [p('a.b'), p('n')],
        [p('a'), p('b'), p('n')],
      ]);
    } finally {
      literal.dispose();
      nested.dispose();
      stop();
      tree.destroy();
    }
  });

  it('a collection position, a typed key and an omission all read the current tree', () => {
    const tree = signalTree({
      box: {
        keep: 1,
        opt: { rows: entityMap<Row, string | number>() },
      } as {
        keep: number;
        opt?: { rows: ReturnType<typeof entityMap<Row, string | number>> };
      },
    });
    try {
      const rows = (
        tree.$.box as never as { opt: { rows: { addOne(row: Row): void } } }
      ).opt.rows;
      rows.addOne({ id: 1, n: 1 });
      rows.addOne({ id: '1', n: 2 });
      const position = getOwnedPositionIds(rows)![0];
      const reader = stateLocationReader(tree)!;
      expect(
        reader.locate([
          { position },
          { position, lifetimeId: 1 },
          { position, lifetimeId: 2 },
        ])
      ).toEqual([
        [p('box'), p('opt'), p('rows')],
        [p('box'), p('opt'), p('rows'), e(1)],
        [p('box'), p('opt'), p('rows'), e('1')],
      ]);
      (tree.$.box as never as (value: { keep: number }) => void)({ keep: 2 });
      expect(
        reader.locate([{ position }, { position, lifetimeId: 1 }])
      ).toEqual([undefined, undefined]);
    } finally {
      tree.destroy();
    }
  });
});
