import { describe, expect, it } from 'vitest';

import {
  applyCollectionOrderDelta,
  deriveDeclarativeTransitionTarget,
  deriveCollectionOrderDelta,
  prepareDeclarativeTransitionInstallation,
  type CollectionOrderDelta,
  type CollectionTransitionSource,
} from './target-transition';
import type { ReversalEffect } from './causal-types';

const delta = (
  owner: number,
  before: readonly number[],
  after: readonly number[]
): CollectionOrderDelta =>
  deriveCollectionOrderDelta(
    owner,
    before,
    after,
    `${owner}:before`,
    `${owner}:after`
  );

describe('declarative target transition: compact collection order', () => {
  it('retains only one participant for a one-subject move', () => {
    const transition = delta(7, [1, 2, 3, 4], [4, 1, 2, 3]);

    expect(transition.participants).toEqual([
      { subject: 4, beforeRank: 3, afterRank: 0 },
    ]);
    expect(
      applyCollectionOrderDelta([4, 1, 2, 3], transition, 'before', '7:after')
    ).toEqual([1, 2, 3, 4]);
    expect(
      applyCollectionOrderDelta([1, 2, 3, 4], transition, 'after', '7:before')
    ).toEqual([4, 1, 2, 3]);
  });

  it('represents a key permutation as order-independent SubjectId truth', () => {
    const transition = delta(7, [1, 2, 3], [2, 3, 1]);

    expect(
      applyCollectionOrderDelta([2, 3, 1], transition, 'before', '7:after')
    ).toEqual([1, 2, 3]);
    expect(
      applyCollectionOrderDelta([1, 2, 3], transition, 'after', '7:before')
    ).toEqual([2, 3, 1]);
  });

  it('composes membership and position without confusing a fresh same-key subject', () => {
    const transition = delta(7, [1, 2], [2, 3]);

    expect(transition.participants).toEqual([
      { subject: 1, beforeRank: 0 },
      { subject: 3, afterRank: 1 },
    ]);
    expect(
      applyCollectionOrderDelta([2, 3], transition, 'before', '7:after')
    ).toEqual([1, 2]);
    expect(
      applyCollectionOrderDelta([1, 2], transition, 'after', '7:before')
    ).toEqual([2, 3]);
  });

  it('keeps colliding numeric SubjectIds isolated by collection owner', () => {
    const left = delta(11, [1, 2], [2, 1]);
    const right = delta(12, [1, 2], [1, 2]);

    expect(left.owner).toBe(11);
    expect(right.owner).toBe(12);
    expect(left.participants).not.toEqual(right.participants);
  });

  it('refuses an endpoint whose omitted backbone was changed by later order work', () => {
    const transition = delta(7, [1, 2, 3], [2, 1, 3]);

    expect(() =>
      applyCollectionOrderDelta([3, 1, 2], transition, 'before', 'later-order')
    ).toThrow(
      'collection order frontier does not match the transition endpoint'
    );
  });

  it('refuses backbone drift even when every participant remains at its endpoint rank', () => {
    const transition = delta(7, [1, 2, 3, 4], [2, 1, 3, 4]);

    expect(() =>
      applyCollectionOrderDelta(
        [2, 1, 4, 3],
        transition,
        'before',
        'later-order'
      )
    ).toThrow(
      'collection order frontier does not match the transition endpoint'
    );
  });

  it('reconstructs every pair of partial permutations through four subjects', () => {
    const orders = partialPermutations([1, 2, 3, 4]);

    for (const before of orders) {
      for (const after of orders) {
        const transition = delta(7, before, after);
        expect(
          applyCollectionOrderDelta(after, transition, 'before', '7:after')
        ).toEqual(before);
        expect(
          applyCollectionOrderDelta(before, transition, 'after', '7:before')
        ).toEqual(after);
      }
    }
  });
});

function partialPermutations(values: readonly number[]): number[][] {
  const result: number[][] = [[]];
  const visit = (prefix: number[], remaining: number[]): void => {
    if (prefix.length > 0) {
      result.push(prefix);
    }
    for (let index = 0; index < remaining.length; index += 1) {
      visit(
        [...prefix, remaining[index]],
        remaining.filter((_, candidate) => candidate !== index)
      );
    }
  };
  visit([], [...values]);
  return result;
}

const source = (
  owner: number,
  entries: ReadonlyArray<readonly [number, string, unknown]>,
  order = entries.map(([subject]) => subject)
): CollectionTransitionSource => ({
  owner,
  subjects: entries.map(([subject, key, value]) => ({ subject, key, value })),
  order,
  orderFrontier: `${owner}:before`,
});

const targetFor = (
  collections: readonly CollectionTransitionSource[],
  effects: readonly ReversalEffect[],
  orderDeltas: readonly CollectionOrderDelta[] = []
) =>
  deriveDeclarativeTransitionTarget({
    collections,
    effects,
    orderDeltas,
  });

describe('declarative target transition: whole-target compilation', () => {
  it('validates a key swap as one mapping without a temporary key', () => {
    const target = targetFor(
      [
        source(7, [
          [1, 'b', { value: 1 }],
          [2, 'a', { value: 2 }],
        ]),
      ],
      [
        {
          owner: 7,
          subjectId: 1,
          before: 'b',
          after: 'a',
          structural: 'rekey',
        },
        {
          owner: 7,
          subjectId: 2,
          before: 'a',
          after: 'b',
          structural: 'rekey',
        },
      ]
    );

    expect(target.collections.get(7)?.subjects).toEqual([
      { subject: 1, key: 'a', value: { value: 1 } },
      { subject: 2, key: 'b', value: { value: 2 } },
    ]);
  });

  it('restores an old subject while removing a fresh same-key occupant', () => {
    const order = delta(7, [2], [1]);
    const target = targetFor(
      [source(7, [[2, 'k', { value: 'fresh' }]])],
      [
        {
          owner: 7,
          subjectId: 2,
          before: 'k',
          after: undefined,
          structural: 'remove',
        },
        {
          owner: 7,
          subjectId: 1,
          before: undefined,
          after: 'k',
          structural: 'add',
          structuralContext: {
            kind: 'remove',
            subject: 1,
            key: 'k',
            value: { value: 'original' },
          },
        },
      ],
      [order]
    );

    expect(target.collections.get(7)).toEqual({
      ...source(7, [[1, 'k', { value: 'original' }]]),
      orderFrontier: '7:after',
    });
  });

  it('derives membership order from retained structural anchors', () => {
    const target = targetFor(
      [source(7, [[1, 'a', {}]])],
      [
        {
          owner: 7,
          subjectId: 2,
          before: undefined,
          after: 'b',
          structural: 'add',
          structuralContext: {
            kind: 'add',
            subject: 2,
            key: 'b',
            value: {},
            beforeSubject: 1,
          },
        },
      ]
    );

    expect(target.collections.get(7)?.order).toEqual([1, 2]);
  });

  it('applies a key-derived field value by SubjectId before changing its key', () => {
    const target = targetFor(
      [source(7, [[1, 'j', { id: 'k', value: 9 }]])],
      [
        {
          owner: 7,
          subjectId: 1,
          before: 9,
          after: 1,
          path: 'rows.j.value',
          ownerPath: 'rows',
        },
        {
          owner: 7,
          subjectId: 1,
          before: 'j',
          after: 'k',
          structural: 'rekey',
        },
      ]
    );

    expect(target.collections.get(7)?.subjects).toEqual([
      { subject: 1, key: 'k', value: { id: 'k', value: 1 } },
    ]);
  });

  it('derives all collection targets before rejecting a local key collision', () => {
    const left = source(7, [
      [1, 'a', {}],
      [2, 'b', {}],
    ]);
    const right = source(8, [[1, 'a', {}]]);

    expect(() =>
      targetFor(
        [left, right],
        [
          {
            owner: 7,
            subjectId: 1,
            before: 'a',
            after: 'b',
            structural: 'rekey',
          },
          {
            owner: 8,
            subjectId: 1,
            before: undefined,
            after: 2,
            path: 'right.a.value',
            ownerPath: 'right',
          },
        ]
      )
    ).toThrow('Collection transition target contains duplicate keys');
    expect(left.subjects[0].key).toBe('a');
    expect(right.subjects[0].value).toEqual({});
  });

  it('keeps same-numbered subjects independent across collection owners', () => {
    const target = targetFor(
      [source(7, [[1, 'a', {}]]), source(8, [[1, 'a', {}]])],
      [
        {
          owner: 7,
          subjectId: 1,
          before: 'a',
          after: 'left',
          structural: 'rekey',
        },
        {
          owner: 8,
          subjectId: 1,
          before: 'a',
          after: 'right',
          structural: 'rekey',
        },
      ]
    );

    expect(target.collections.get(7)?.subjects[0].key).toBe('left');
    expect(target.collections.get(8)?.subjects[0].key).toBe('right');
  });

  it('rejects duplicate source subjects before compiling a target', () => {
    expect(() =>
      targetFor(
        [
          {
            owner: 7,
            subjects: [
              { subject: 1, key: 'a', value: 1 },
              { subject: 1, key: 'b', value: 2 },
            ],
            order: [1],
            orderFrontier: '7:before',
          },
        ],
        []
      )
    ).toThrow('Collection order contains duplicate SubjectIds');
  });

  it('rejects a subject value address outside its collection owner', () => {
    expect(() =>
      targetFor(
        [source(7, [[1, 'a', { value: 1 }]])],
        [
          {
            owner: 7,
            subjectId: 1,
            before: 1,
            after: 2,
            path: 'other.a.value',
            ownerPath: 'rows',
          },
        ]
      )
    ).toThrow('Subject value effect has no collection-relative address');
  });

  it('prepares every owner before installing any collection target', () => {
    const installed: number[] = [];
    const target = targetFor(
      [source(7, [[1, 'a', {}]]), source(8, [[1, 'a', {}]])],
      []
    );
    const bindings = new Map([
      [
        7,
        {
          owner: 7,
          ownerPath: 'left',
          readSource: () => source(7, [[1, 'a', {}]]),
          prepareTarget: () => ({
            install: () => installed.push(7),
            publish: () => installed.push(70),
          }),
        },
      ],
      [
        8,
        {
          owner: 8,
          ownerPath: 'right',
          readSource: () => source(8, [[1, 'a', {}]]),
          prepareTarget: () => {
            throw new Error('second owner refused');
          },
        },
      ],
    ]);

    expect(() =>
      prepareDeclarativeTransitionInstallation(target, bindings)
    ).toThrow('second owner refused');
    expect(installed).toEqual([]);
  });

  it('installs every prepared owner before publishing any of them', () => {
    const events: string[] = [];
    const target = targetFor(
      [source(7, [[1, 'a', {}]]), source(8, [[1, 'a', {}]])],
      []
    );
    const bindings = new Map(
      [7, 8].map((owner) => [
        owner,
        {
          owner,
          ownerPath: `rows.${owner}`,
          readSource: () => source(owner, [[1, 'a', {}]]),
          prepareTarget: () => ({
            install: () => events.push(`install:${owner}`),
            publish: () => events.push(`publish:${owner}`),
          }),
        },
      ])
    );

    prepareDeclarativeTransitionInstallation(target, bindings).install();

    expect(events).toEqual([
      'install:7',
      'install:8',
      'publish:7',
      'publish:8',
    ]);
  });

  it('requires scalar preparation inside the same aggregate boundary', () => {
    const target = deriveDeclarativeTransitionTarget({
      collections: [],
      effects: [{ owner: 2, before: 0, after: 1 }],
    });

    expect(() =>
      prepareDeclarativeTransitionInstallation(target, new Map())
    ).toThrow('scalar targets but no scalar binding');
  });
});
