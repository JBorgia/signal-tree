// Key handoff detection in `requiresDeclarativeStructuralTarget`.
//
// v16 integration slice 5 (v15 7463f4eb's indexed handoff). A structural
// reversal needs a declarative whole-collection target when one effect vacates
// a key another effect of the SAME owner occupies. The pairwise scan this
// replaced compared every structural effect with every other. These cases pin
// the rule the index must keep: same owner only, never an effect with itself,
// and keys compared with Object.is (+0 and -0 differ, NaN matches NaN).
import { describe, expect, it } from 'vitest';

import type { ReversalEffect } from './causal-types';
import { requiresDeclarativeStructuralTarget } from './target-transition';

const remove = (owner: number, subjectId: number, key: unknown) =>
  ({
    owner,
    subjectId,
    before: key,
    after: undefined,
    structural: 'remove',
  } as ReversalEffect);
const add = (owner: number, subjectId: number, key: unknown) =>
  ({
    owner,
    subjectId,
    before: undefined,
    after: key,
    structural: 'add',
  } as ReversalEffect);
const rekey = (owner: number, subjectId: number, from: unknown, to: unknown) =>
  ({
    owner,
    subjectId,
    before: from,
    after: to,
    structural: 'rekey',
  } as ReversalEffect);

describe('structural key handoff', () => {
  it('detects a removed key occupied by an addition in the same owner', () => {
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, 'a'), add(1, 2, 'a')])
    ).toBe(true);
    expect(
      requiresDeclarativeStructuralTarget([add(1, 2, 'a'), remove(1, 1, 'a')])
    ).toBe(true);
  });

  it('detects rekey chains in either role', () => {
    expect(
      requiresDeclarativeStructuralTarget([
        rekey(1, 1, 'a', 'b'),
        rekey(1, 2, 'b', 'c'),
      ])
    ).toBe(true);
    expect(
      requiresDeclarativeStructuralTarget([
        remove(1, 1, 'a'),
        rekey(1, 2, 'b', 'a'),
      ])
    ).toBe(true);
  });

  it('ignores the same key in another owner', () => {
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, 'a'), add(2, 1, 'a')])
    ).toBe(false);
  });

  it('never pairs an effect with itself', () => {
    expect(requiresDeclarativeStructuralTarget([rekey(1, 1, 'a', 'a')])).toBe(
      false
    );
  });

  it('compares keys with Object.is', () => {
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, 0), add(1, 2, -0)])
    ).toBe(false);
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, -0), add(1, 2, -0)])
    ).toBe(true);
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, NaN), add(1, 2, NaN)])
    ).toBe(true);
    expect(
      requiresDeclarativeStructuralTarget([remove(1, 1, 1), add(1, 2, '1')])
    ).toBe(false);
  });

  it('checks each vacated key against its candidates, not every effect', () => {
    // Distinct keys: no handoff. Count predicate visits of Array#some; the
    // pairwise scan visited every structural effect once per vacating effect.
    const count = 1_024;
    const effects: ReversalEffect[] = [];
    for (let i = 0; i < count; i += 1) {
      effects.push(remove(1, i + 1, `old-${i}`));
      effects.push(add(1, count + i + 1, `new-${i}`));
    }
    const original = Array.prototype.some;
    let visits = 0;
    Array.prototype.some = function <T>(
      this: T[],
      predicate: (value: T, index: number, array: T[]) => unknown,
      thisArg?: unknown
    ): boolean {
      return original.call(this, (value: T, index: number, array: T[]) => {
        visits += 1;
        return predicate.call(thisArg, value, index, array);
      });
    } as typeof original;
    let result: boolean;
    try {
      result = requiresDeclarativeStructuralTarget(effects);
    } finally {
      Array.prototype.some = original;
    }
    expect(result).toBe(false);
    expect(visits, 'Array#some predicate visits').toBeLessThanOrEqual(
      4 * effects.length
    );
  });
});
