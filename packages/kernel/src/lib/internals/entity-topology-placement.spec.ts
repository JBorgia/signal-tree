import { describe, expect, it } from 'vitest';

import { createEntityEgressProjection } from './entity-egress-projection';
import type { StructuralEffect } from './source-mutation';

/**
 * Placement of added subjects from final-order neighbours (15.4.4).
 *
 * Every add names the neighbours its subject has in the FINAL order of its
 * operation, and a reversal publishes added subjects in lifetime-id order. So
 * the topology must reach the final order whatever order the adds arrive in.
 * This checks that exhaustively for small collections: every subset of a final
 * order restored onto the rest, in every arrival order.
 *
 * Subjects are their own rows here, so `value()` reads back the order.
 */
const seedOf = (subjects: readonly number[]) =>
  subjects.map((subject) => ({
    subjectId: subject,
    key: subject,
    row: subject,
  }));

const add = (final: readonly number[], subject: number): StructuralEffect => {
  const at = final.indexOf(subject);
  return {
    kind: 'add',
    subject,
    key: subject,
    value: subject,
    beforeSubject: final[at - 1],
    afterSubject: final[at + 1],
  };
};
const remove = (
  subject: number,
  beforeSubject?: number,
  afterSubject?: number
): StructuralEffect => ({
  kind: 'remove',
  subject,
  key: subject,
  value: subject,
  beforeSubject,
  afterSubject,
});

function* permutations<T>(items: readonly T[]): Generator<T[]> {
  if (items.length <= 1) return yield [...items];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i], ...tail];
  }
}

describe('added subjects reach their final order in any arrival order', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'every subset and arrival order of %i subjects',
    (n) => {
      const final = Array.from({ length: n }, (_, i) => i + 1);
      let cases = 0;
      const failures: string[] = [];
      for (let mask = 1; mask < 1 << n; mask++) {
        const restored = final.filter((_, i) => mask & (1 << i));
        const survivors = final.filter((_, i) => !(mask & (1 << i)));
        for (const arrival of permutations(restored)) {
          const projection = createEntityEgressProjection(seedOf(survivors));
          for (const subject of arrival)
            projection.apply(subject, subject, add(final, subject), false);
          projection.settle();
          cases++;
          const got = projection.value().join('');
          if (got !== final.join(''))
            failures.push(
              `${survivors.join('')} + ${arrival.join('')} -> ${got}`
            );
        }
      }
      expect(failures).toEqual([]);
      expect(cases).toBeGreaterThan(0);
    }
  );

  it('places every held subject without waiting for settle once its chain lands', () => {
    // Final 1 2 3 4 5; 2..4 arrive middle-first, so 3 waits for both sides.
    const final = [1, 2, 3, 4, 5];
    const projection = createEntityEgressProjection(seedOf([1, 5]));
    projection.apply(3, 3, add(final, 3), false);
    expect(projection.value()).toEqual([1, 5]);
    projection.apply(2, 2, add(final, 2), false);
    expect(projection.value()).toEqual([1, 2, 3, 5]);
    projection.apply(4, 4, add(final, 4), false);
    expect(projection.value()).toEqual([1, 2, 3, 4, 5]);
    expect(projection.settle()).toBe(false);
  });
});

describe('neighbours that never arrive', () => {
  it('a removal of a neighbour that never landed bridges across it', () => {
    // Final 1 2 3 4 5 with 2,3,4 restored; 2 and 4 are removed again in the
    // same delivery, so only their removals arrive.
    const projection = createEntityEgressProjection(seedOf([1, 5]));
    projection.apply(3, 3, add([1, 2, 3, 4, 5], 3), false);
    projection.apply(2, undefined, remove(2, 1, 3), false);
    expect(projection.value()).toEqual([1, 3, 5]);
    projection.apply(4, undefined, remove(4, 3, 5), false);
    expect(projection.value()).toEqual([1, 3, 5]);
  });

  it('a bridged anchor that is itself held keeps the subject held', () => {
    const projection = createEntityEgressProjection(seedOf([1, 6]));
    // Final 1 2 3 4 5 6; 4 holds on 3 and 5, then 3 is removed naming 2.
    projection.apply(4, 4, add([1, 2, 3, 4, 5, 6], 4), false);
    projection.apply(3, undefined, remove(3, 2, 4), false);
    expect(projection.value()).toEqual([1, 6]);
    projection.apply(2, 2, add([1, 2, 4, 5, 6], 2), false);
    expect(projection.value()).toEqual([1, 2, 4, 6]);
  });

  it('a subject with no predecessor is the head even if its successor never lands', () => {
    const projection = createEntityEgressProjection(seedOf([5]));
    projection.apply(1, 1, add([1, 2, 5], 1), false);
    projection.settle();
    expect(projection.value()).toEqual([1, 5]);
  });

  it('a subject with no successor is the tail even if its predecessor never lands', () => {
    const projection = createEntityEgressProjection(seedOf([1]));
    projection.apply(5, 5, add([1, 4, 5], 5), false);
    projection.settle();
    expect(projection.value()).toEqual([1, 5]);
  });

  it('settle appends what is still held, and its chain after it', () => {
    const projection = createEntityEgressProjection(seedOf([1, 9]));
    projection.apply(4, 4, add([1, 3, 4, 5, 9], 4), false);
    projection.apply(6, 6, add([1, 4, 6, 7, 9], 6), false);
    expect(projection.value()).toEqual([1, 9]);
    expect(projection.settle()).toBe(true);
    expect(projection.value()).toEqual([1, 9, 4, 6]);
    expect(projection.settle()).toBe(false);
  });

  it('a held subject removed before it lands is dropped', () => {
    const projection = createEntityEgressProjection(seedOf([1, 5]));
    projection.apply(3, 3, add([1, 2, 3, 4, 5], 3), false);
    expect(projection.apply(3, undefined, remove(3, 2, 4), false)).toBe(true);
    projection.settle();
    expect(projection.value()).toEqual([1, 5]);
  });
});

describe('inspection and held placement', () => {
  it('an inspection neighbour completes an authored placement without being published', () => {
    const projection = createEntityEgressProjection(seedOf([1, 5]));
    // Authored 3 holds on 2 and 4.
    expect(projection.apply(3, 3, add([1, 2, 3, 4, 5], 3), false)).toBe(true);
    // Inspection adds 2: local order places 3 after it, eligible order
    // traverses over 2 to 1. The authored placement completes.
    expect(projection.apply(2, 2, add([1, 2, 3, 4, 5], 2), true)).toBe(true);
    expect(projection.value()).toEqual([1, 3, 5]);
  });

  it('an inspection add with nothing held still advances nothing', () => {
    const projection = createEntityEgressProjection(seedOf([1, 5]));
    expect(projection.apply(2, 2, add([1, 2, 5], 2), true)).toBe(false);
    expect(projection.value()).toEqual([1, 5]);
  });
});
