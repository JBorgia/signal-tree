import { describe, expect, it } from 'vitest';

import {
  applyCollectionOrderDelta,
  type CollectionOrderDelta,
} from './target-transition';
import {
  drainTurnOrders,
  recordOrderTransition,
  turnOrderDeltas,
  type TurnOrderRecord,
} from './turn-order-record';

const OWNER = 3;
const F = [{ f: 0 }, { f: 1 }, { f: 2 }];
const record = (
  captures: Array<[number[], number[], object, object]>
): Map<number, TurnOrderRecord> => {
  const records = new Map<number, TurnOrderRecord>();
  for (const [beforeSubjects, afterSubjects, before, after] of captures) {
    recordOrderTransition(records, {
      owner: OWNER,
      ownerPath: 'rows',
      beforeSubjects,
      afterSubjects,
      beforeFrontier: before,
      afterFrontier: after,
    });
  }
  return records;
};

describe('drainTurnOrders', () => {
  it('reorders that cancel are a token transition, not an order change', () => {
    const { changes, frontiers } = drainTurnOrders(
      record([
        [[1, 2, 3], [3, 2, 1], F[0], F[1]],
        [[3, 2, 1], [1, 2, 3], F[1], F[2]],
      ]),
      [],
      {}
    );
    expect(changes).toStrictEqual([]);
    expect(frontiers).toStrictEqual([
      { owner: OWNER, before: F[0], after: F[2] },
    ]);
  });

  it('records it cannot compose are kept UNRECORDED, never thrown out of a drain', () => {
    // Two removed rows naming each other on both sides: an anchor cycle.
    const effects = [
      {
        kind: 'remove',
        position: OWNER,
        subject: 7,
        beforeSubject: 8,
        afterSubject: 8,
      },
      {
        kind: 'remove',
        position: OWNER,
        subject: 8,
        beforeSubject: 7,
        afterSubject: 7,
      },
    ];
    let drained: ReturnType<typeof drainTurnOrders> | undefined;
    expect(() => {
      drained = drainTurnOrders(
        record([[[1, 2], [2, 1], F[0], F[1]]]),
        effects,
        {}
      );
    }).not.toThrow();
    expect(drained?.changes).toStrictEqual([
      {
        owner: OWNER,
        ownerPath: 'rows',
        beforeSubjects: [],
        afterSubjects: [],
        beforeFrontier: F[0],
        afterFrontier: F[1],
        unrecorded: true,
      },
    ]);
    const [delta] = turnOrderDeltas(drained?.changes ?? []) as [
      CollectionOrderDelta
    ];
    expect(delta.unrecorded).toBe(true);
    expect(() =>
      applyCollectionOrderDelta([2, 1], delta, 'before', F[1])
    ).toThrow(
      'collection order change was not recorded, so it cannot be reversed'
    );
  });
});
