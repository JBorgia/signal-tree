import { describe, expect, it } from 'vitest';

import {
  applyCollectionOrderDelta,
  deriveCollectionOrderDelta,
  withoutDeltaSubjects,
} from './target-transition';
import type { PositionId } from './causal-types';

/**
 * Removing rows from a recorded order delta as if they had never existed
 * (groundwork for re-basing later order changes when a pending transaction
 * that created those rows is rejected). Oracle: deriving the delta afresh
 * from the two orders without those rows.
 */
const OWNER = 3 as PositionId;
const without = (order: number[], drop: Set<number>) =>
  order.filter((subject) => !drop.has(subject));
const apply = (
  delta: ReturnType<typeof deriveCollectionOrderDelta>,
  from: number[],
  endpoint: 'before' | 'after'
) =>
  applyCollectionOrderDelta(
    from,
    delta,
    endpoint,
    endpoint === 'before' ? delta.afterFrontier : delta.beforeFrontier
  );

describe('order delta rebase', () => {
  it('an explicit row is a participant at both ends even when it kept its place', () => {
    const delta = deriveCollectionOrderDelta(
      OWNER,
      [1, 2, 3, 4],
      [3, 2, 1, 4],
      'b',
      'a',
      new Set([4])
    );
    expect(
      delta.participants.find(({ subject }) => subject === 4)
    ).toStrictEqual({ subject: 4, beforeRank: 3, afterRank: 3 });
  });

  it.each([
    ['a row only the earlier end has', [1, 9, 2, 3], [3, 1, 2], new Set([9])],
    ['a row both ends have', [9, 1, 2, 3], [3, 9, 2, 1], new Set([9])],
    ['two rows', [8, 1, 9, 2, 3], [3, 2, 8, 1, 9], new Set([8, 9])],
    ['a row only the later end has', [1, 2, 3], [3, 9, 1, 2], new Set([9])],
  ] as const)('drops %s exactly', (_name, before, after, drop) => {
    const delta = deriveCollectionOrderDelta(
      OWNER,
      [...before],
      [...after],
      'b',
      'a',
      drop
    );
    const rebased = withoutDeltaSubjects(delta, (subject) => drop.has(subject));
    expect(rebased).toBeDefined();
    const start = without([...before], drop);
    const end = without([...after], drop);
    expect(apply(rebased!, end, 'before')).toStrictEqual(start);
    expect(apply(rebased!, start, 'after')).toStrictEqual(end);
  });

  it('a delta that only moved the dropped row becomes no change at all', () => {
    const delta = deriveCollectionOrderDelta(
      OWNER,
      [1, 9, 2],
      [9, 1, 2],
      'b',
      'a',
      new Set([9])
    );
    expect(withoutDeltaSubjects(delta, (subject) => subject === 9)).toBe(
      undefined
    );
  });

  it('a delta without the rows is returned unchanged', () => {
    const delta = deriveCollectionOrderDelta(OWNER, [1, 2], [2, 1], 'b', 'a');
    expect(withoutDeltaSubjects(delta, (subject) => subject === 9)).toBe(delta);
  });
});
