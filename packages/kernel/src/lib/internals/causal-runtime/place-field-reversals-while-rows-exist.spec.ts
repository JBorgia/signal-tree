import { describe, expect, it } from 'vitest';
import type { ReversalEffect } from './causal-types';
import { placeFieldReversalsWhileRowsExist } from './pending-rollback';

/**
 * Direct carriers for the ordering helper every reversal path uses (both
 * transactions() rollback paths and restoration's undo/redo/history lists):
 * a field reversal lands while its row exists — after its re-add, before its
 * removal.
 *
 * Neither caller produces two adds or removals of one owner+lifetime today:
 * capture composes structural effects per lifetime, and the pending planner
 * keeps one structural effect per subject scope. The helper must not depend on
 * that; before c93e9be6 a duplicate scope emitted every field reversal twice.
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

describe('placeFieldReversalsWhileRowsExist', () => {
  it('moves a re-added row’s field reversals to just after its re-add', () => {
    expect(
      tags(
        placeFieldReversalsWhileRowsExist([
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
        placeFieldReversalsWhileRowsExist([
          field(3, 1, 'other-collection'),
          field(2, 1, 'f'),
          reAdd(2, 1, 'add'),
        ])
      )
    ).toStrictEqual(['other-collection', 'add', 'f']);
  });

  it('leaves the list alone when nothing is re-added', () => {
    const effects = [field(2, 1, 'f'), scalar(9, 's')];
    expect(placeFieldReversalsWhileRowsExist(effects)).toBe(effects);
  });

  it('emits each follower ONCE, after the FIRST re-add of a duplicated scope', () => {
    expect(
      tags(
        placeFieldReversalsWhileRowsExist([
          field(2, 1, 'f1'),
          reAdd(2, 1, 'first'),
          field(2, 1, 'f2'),
          reAdd(2, 1, 'second'),
          field(2, 1, 'f3'),
        ])
      )
    ).toStrictEqual(['first', 'f1', 'f2', 'f3', 'second']);
  });

  const removal = (owner: number, subjectId: number, tag: string) =>
    ({
      owner,
      subjectId,
      structural: 'remove',
      before: tag,
      after: undefined,
    } as ReversalEffect);
  const removed = (effects: readonly ReversalEffect[]) =>
    effects.map((effect) =>
      effect.structural === 'remove' ? effect.before : effect.after
    );

  it('moves a removed row’s field reversals to just BEFORE its removal', () => {
    expect(
      removed(
        placeFieldReversalsWhileRowsExist([
          scalar(9, 's'),
          removal(2, 4, 'remove'),
          field(2, 4, 'f1'),
          field(2, 4, 'f2'),
        ])
      )
    ).toStrictEqual(['s', 'f1', 'f2', 'remove']);
  });

  it('scopes the removal rule by owner AND lifetime too', () => {
    expect(
      removed(
        placeFieldReversalsWhileRowsExist([
          removal(2, 4, 'remove'),
          field(3, 4, 'other-collection'),
          field(2, 4, 'f'),
        ])
      )
    ).toStrictEqual(['f', 'remove', 'other-collection']);
  });

  it('handles a re-added row and a removed row in one list', () => {
    expect(
      removed(
        placeFieldReversalsWhileRowsExist([
          field(2, 1, 'r1'),
          removal(2, 4, 'remove'),
          field(2, 4, 'g1'),
          reAdd(2, 1, 'add'),
        ])
      )
    ).toStrictEqual(['g1', 'remove', 'add', 'r1']);
  });
});
