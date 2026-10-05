import { describe, expect, it } from 'vitest';
import type { ReversalEffect } from './causal-types';
import { placeFieldReversalsAfterReAdds } from './pending-rollback';

/**
 * Direct carriers for the ordering helper both rollback paths use.
 *
 * Neither caller produces two re-adds of one owner+lifetime today: capture
 * composes structural effects per lifetime, and the pending planner keeps one
 * structural effect per subject scope. The helper must not depend on that.
 * Before this file it registered the scope once per re-add and appended the
 * followers after EACH re-add, so a duplicate scope emitted every field
 * reversal twice.
 */
const reAdd = (owner: number, subjectId: number, tag: string) =>
  ({
    owner,
    subjectId,
    structural: 'add',
    before: undefined,
    after: tag,
  } as ReversalEffect);
const field = (owner: number, subjectId: number, tag: string) =>
  ({
    owner,
    subjectId,
    before: undefined,
    after: tag,
    fieldSegments: ['n'],
  } as ReversalEffect);
const scalar = (owner: number, tag: string) =>
  ({ owner, before: undefined, after: tag } as ReversalEffect);
const tags = (effects: readonly ReversalEffect[]) =>
  effects.map((effect) => effect.after);

describe('placeFieldReversalsAfterReAdds', () => {
  it('moves a re-added row’s field reversals to just after its re-add', () => {
    expect(
      tags(
        placeFieldReversalsAfterReAdds([
          field(2, 1, 'f1'),
          scalar(9, 's'),
          reAdd(2, 1, 'add'),
          field(2, 1, 'f2'),
        ])
      )
    ).toStrictEqual(['s', 'add', 'f1', 'f2']);
  });

  it('scopes by owner AND lifetime', () => {
    expect(
      tags(
        placeFieldReversalsAfterReAdds([
          field(3, 1, 'other-collection'),
          field(2, 1, 'f'),
          reAdd(2, 1, 'add'),
        ])
      )
    ).toStrictEqual(['other-collection', 'add', 'f']);
  });

  it('leaves the list alone when nothing is re-added', () => {
    const effects = [field(2, 1, 'f'), scalar(9, 's')];
    expect(placeFieldReversalsAfterReAdds(effects)).toBe(effects);
  });

  it('emits each follower ONCE, after the FIRST re-add of a duplicated scope', () => {
    expect(
      tags(
        placeFieldReversalsAfterReAdds([
          field(2, 1, 'f1'),
          reAdd(2, 1, 'first'),
          field(2, 1, 'f2'),
          reAdd(2, 1, 'second'),
          field(2, 1, 'f3'),
        ])
      )
    ).toStrictEqual(['first', 'f1', 'f2', 'f3', 'second']);
  });
});
