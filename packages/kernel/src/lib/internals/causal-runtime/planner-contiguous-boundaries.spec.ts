import { describe, expect, it } from 'vitest';
import type { ReversalEffect } from './causal-types';
import { placeFieldReversalsWhileRowsExist } from './pending-rollback';

type Effect = ReversalEffect & { readonly id: string };

// Raw internal planner identities only; this does not expand public lifetime keys.
function effect(
  id: string,
  structural?: Effect['structural'],
  turn?: number,
  owner = 1,
  subjectId: unknown = 1
): Effect {
  return {
    id,
    structural,
    turn,
    owner: owner as ReversalEffect['owner'],
    subjectId,
    before: undefined,
    after: undefined,
  };
}

function check(input: Effect[], ids: string[]) {
  const before = input.map((item) => ({ ...item }));
  const output = placeFieldReversalsWhileRowsExist(input);
  expect(output.map((item) => item.id)).toEqual(ids);
  expect(input).toEqual(before);
  expect(output).toHaveLength(input.length);
  for (const item of input) {
    expect(output.filter((other) => other === item)).toHaveLength(1);
  }
  return output;
}

// Constructed internal facts; public reachability is tested separately.
describe('planner typed scopes and contiguous turns', () => {
  it('restores before fields and places fields before removal in the same turn', () => {
    check([effect('f', undefined, 4), effect('add', 'add', 4)], ['add', 'f']);
    check([effect('rm', 'remove', 4), effect('f', undefined, 4)], ['f', 'rm']);
  });

  it('does not turn final n3 into n2 across separate turns', () => {
    const input = [
      { ...effect('add0', 'add', 0), after: 0 },
      effect('remove', 'remove', 1),
      { ...effect('add2', 'add', 2), after: 2 },
      { ...effect('field3', undefined, 2), after: 3 },
    ];
    const output = placeFieldReversalsWhileRowsExist(input);
    let live = false;
    let n: unknown;
    for (const item of output) {
      if (item.structural === 'remove') live = false;
      else if (item.structural === 'add') {
        live = true;
        n = item.after;
      } else {
        expect(live).toBe(true);
        n = item.after;
      }
    }
    expect(n).toBe(3);
    check(input, ['add0', 'remove', 'add2', 'field3']);
  });

  it('keeps a later-turn field after an intervening rekey', () => {
    check(
      [
        effect('add', 'add', 0),
        effect('key', 'rekey', 1),
        effect('f', undefined, 2),
      ],
      ['add', 'key', 'f']
    );
  });

  it('treats the same ordinal appearing later as a different contiguous slice', () => {
    check(
      [
        effect('add', 'add', 0),
        effect('key', 'rekey', 1),
        effect('f', undefined, 0),
      ],
      ['add', 'key', 'f']
    );
  });

  it('does not absorb an unnumbered slice into an explicit turn', () => {
    check(
      [effect('add', 'add', 0), effect('key', 'rekey'), effect('f')],
      ['add', 'key', 'f']
    );
  });

  it('separates owners with the same lifetime', () => {
    check(
      [
        effect('a', undefined, 0, 1),
        effect('b', undefined, 0, 2),
        effect('add', 'add', 0, 1),
      ],
      ['b', 'add', 'a']
    );
  });

  it('preserves typed lifetime keys without implying a public string-lifetime API', () => {
    check(
      [
        effect('number', undefined, 0, 1, 1),
        effect('string', undefined, 0, 1, '1'),
        effect('add', 'add', 0, 1, 1),
      ],
      ['string', 'add', 'number']
    );
  });

  it('preserves reference lifetime keys without string coercion', () => {
    const a = {};
    const b = {};
    check(
      [
        effect('a', undefined, 0, 1, a),
        effect('b', undefined, 0, 1, b),
        effect('add', 'add', 0, 1, a),
      ],
      ['b', 'add', 'a']
    );
  });

  it('retains own undefined presence and exact segmented address by identity', () => {
    const field = {
      ...effect('f', undefined, 4),
      before: undefined,
      after: undefined,
      fieldPresence: { before: false, after: true },
      subjectFieldSegments: ['literal.dot'],
    };
    check([field, effect('add', 'add', 4)], ['add', 'f']);
    expect(Object.prototype.hasOwnProperty.call(field, 'after')).toBe(true);
  });
});
