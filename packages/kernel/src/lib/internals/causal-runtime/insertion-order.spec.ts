import { describe, expect, it } from 'vitest';

import {
  orderInsertions,
  type InsertionAnchors,
  type InsertionPlacement,
} from './insertion-order';

/** Replays `orderInsertions` on a plain list: present rows, then filter. */
const replay = (
  present: number[],
  rows: Array<[number, InsertionAnchors | undefined, boolean?]>,
  keep: (subject: number) => boolean = () => true
): number[] => {
  const list = [...present];
  orderInsertions(
    rows.map(([subject, anchors, creation]) => ({
      item: subject,
      subject,
      anchors,
      creation: creation ?? false,
    })),
    (subject) => list.includes(subject),
    (input, placement: InsertionPlacement) => {
      const at =
        placement.kind === 'front'
          ? 0
          : placement.kind === 'after'
          ? list.indexOf(placement.subject) + 1
          : list.indexOf(placement.subject);
      list.splice(at, 0, input.subject);
    }
  );
  return list.filter(keep);
};

describe('orderInsertions', () => {
  it('one at a time: the later removal goes back first', () => {
    // [y=1, w=2, r=3, z=4]: removeOne(w) (anchors y, r), then removeOne(r)
    // (anchors y, z). Input in capture order: w first.
    expect(
      replay(
        [1, 4],
        [
          [2, { beforeSubject: 1, afterSubject: 3 }],
          [3, { beforeSubject: 1, afterSubject: 4 }],
        ]
      )
    ).toStrictEqual([1, 2, 3, 4]);
  });

  it('all at once: mutually anchored rows go back as one block', () => {
    // clear() of [1..4]: each row names its pre-batch neighbours.
    expect(
      replay(
        [],
        [
          [3, { beforeSubject: 2, afterSubject: 4 }],
          [1, { afterSubject: 2 }],
          [4, { beforeSubject: 3 }],
          [2, { beforeSubject: 1, afterSubject: 3 }],
        ]
      )
    ).toStrictEqual([1, 2, 3, 4]);
  });

  it('a block removed later goes back before an earlier one anchored into it', () => {
    // [1..5]: removeMany(3, 2) then clear() of [1, 4, 5].
    expect(
      replay(
        [],
        [
          [2, { beforeSubject: 1, afterSubject: 3 }],
          [3, { beforeSubject: 2, afterSubject: 4 }],
          [1, { afterSubject: 4 }],
          [4, { beforeSubject: 1, afterSubject: 5 }],
          [5, { beforeSubject: 4 }],
        ]
      )
    ).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it('creations go back in creation (subject) order, beside their creation neighbours', () => {
    expect(
      replay(
        [1, 2],
        [
          [11, { beforeSubject: 10 }, true],
          [10, { afterSubject: 1 }, true],
          [12, { beforeSubject: 2 }, true],
        ]
      )
    ).toStrictEqual([10, 11, 1, 2, 12]);
  });

  it('a row whose anchors are neither present nor waiting refuses', () => {
    expect(() =>
      replay([1], [[2, { beforeSubject: 99, afterSubject: 98 }]])
    ).toThrow('Collection structural target has no live placement anchor');
  });

  it('contradictory mutual anchors refuse as a cycle', () => {
    expect(() =>
      replay(
        [],
        [
          [1, { beforeSubject: 2, afterSubject: 2 }],
          [2, { beforeSubject: 1, afterSubject: 1 }],
        ]
      )
    ).toThrow('anchor cycle');
  });
});
