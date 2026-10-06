import { describe, expect, it } from 'vitest';

import {
  deriveDeclarativeTransitionTarget,
  type CollectionTransitionSource,
} from './target-transition';
import type { ReversalEffect } from './causal-types';

/**
 * An addition whose recorded anchor is a row the SAME transition removes is
 * placed beside that anchor: a reversal inserts before it deletes
 * (`insertion-order.ts`), so the anchor is still there. On 15.4.3 this threw
 * "Collection structural target has no live placement anchor" — redo of
 * `addOne x; addOne y; removeMany(['a', 'c'])` anchors x to c. (c4c6cca9 placed
 * it at the anchor's last known position instead, which ordered two such rows
 * in one gap by processing order; the reversal-engine review, item 2.)
 */
const OWNER = 7;
const source = (subjects: readonly number[]): CollectionTransitionSource => ({
  owner: OWNER,
  subjects: subjects.map((subject) => ({
    subject,
    key: `k${subject}`,
    value: { id: `k${subject}` },
  })),
  order: subjects,
  orderFrontier: 'frontier',
});
const add = (
  subject: number,
  beforeSubject?: number,
  afterSubject?: number
): ReversalEffect => ({
  owner: OWNER,
  subjectId: subject,
  structural: 'add',
  before: undefined,
  after: `k${subject}`,
  structuralContext: {
    kind: 'add',
    subject,
    key: `k${subject}`,
    value: { id: `k${subject}` },
    beforeSubject,
    afterSubject,
  },
});
const remove = (subject: number): ReversalEffect => ({
  owner: OWNER,
  subjectId: subject,
  structural: 'remove',
  before: `k${subject}`,
  after: undefined,
});
const orderOf = (sourceOrder: number[], effects: ReversalEffect[]) =>
  deriveDeclarativeTransitionTarget({
    collections: [source(sourceOrder)],
    effects,
  }).collections.get(OWNER)?.order;

describe('declarative target: anchor removed by the same transition', () => {
  it('places after the removed anchor’s nearest surviving predecessor', () => {
    // [1, 2, 3] + x(after 3) + y(after x), removing 2 and 3.
    expect(
      orderOf([1, 2, 3], [add(4, 3), add(5, 4), remove(2), remove(3)])
    ).toStrictEqual([1, 4, 5]);
  });

  it('places at the FRONT when every predecessor is removed too', () => {
    expect(
      orderOf([1, 2], [add(3, 2), add(4, 3), remove(1), remove(2)])
    ).toStrictEqual([3, 4]);
  });

  it('places before a removed after-anchor’s nearest surviving successor', () => {
    // [1, 2, 3] + x(before 2) + y(before x), removing 2.
    expect(
      orderOf(
        [1, 2, 3],
        [add(4, undefined, 2), add(5, undefined, 4), remove(2)]
      )
    ).toStrictEqual([1, 5, 4, 3]);
  });

  it('places at the END when every successor of the after-anchor is removed', () => {
    expect(orderOf([1, 2], [add(3, undefined, 2), remove(2)])).toStrictEqual([
      1, 3,
    ]);
  });

  it('still refuses an anchor that is not in the source order at all', () => {
    expect(() => orderOf([1, 2], [add(3, 99), add(4, 3)])).toThrow(
      'Collection structural target has no live placement anchor'
    );
  });
});
