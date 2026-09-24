import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, type SignalTree } from '../index';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getEntityLocationBinding } from './internals/entity-projection-seed';
import { createTreeRealizationAdapter } from './internals/causal-runtime/tree-realization-adapter';
import type { ReversalEffect } from './internals/causal-runtime/causal-types';
import { deriveDeclarativeTransitionTarget } from './internals/causal-runtime/target-transition';

type Row = { id: string; 'a.b': number; a: { b: number }; '': number };
const value = (): Row => ({ id: 'a.b', 'a.b': 7, a: { b: 9 }, '': 3 });

describe('structured realization requires no display-path decoding', () => {
  it('exact owner + lifetime + field segments resolve literal collection/ID/field keys', () => {
    const tree = signalTree({
      'rows.with.dot': entityMap<Row, string>(),
      rows: { with: { dot: entityMap<Row, string>() } },
    });
    try {
      const collection = tree.$['rows.with.dot'];
      collection.addOne(value());
      tree.$.rows.with.dot.addOne(value());
      const row = collection.byIdOrFail('a.b');
      const binding = getEntityLocationBinding(row);
      if (!binding) throw new Error('Missing binding');
      const port = createTreeRealizationAdapter({
        tree: tree as unknown as SignalTree<object>,
        descriptors: new Map(),
      });
      const effects: ReversalEffect[] = [
        {
          owner: binding.owner,
          subjectId: binding.subjectId,
          subjectFieldSegments: ['a.b'],
          before: 7,
          after: 0,
        },
        {
          owner: binding.owner,
          subjectId: binding.subjectId,
          subjectFieldSegments: ['a', 'b'],
          before: 9,
          after: 1,
        },
        {
          owner: binding.owner,
          subjectId: binding.subjectId,
          subjectFieldSegments: [''],
          before: 3,
          after: 2,
        },
      ];
      expect(port.validateEffects(effects)).toBeUndefined();
      port.applyAtomically(effects);
      expect(row()).toEqual({ id: 'a.b', 'a.b': 0, a: { b: 1 }, '': 2 });
      expect(tree.$.rows.with.dot.byIdOrFail('a.b')()).toEqual(value());
      expect(getOwnedPositionIds(collection)).toEqual([binding.owner]);
    } finally {
      tree.destroy();
    }
  });

  it('empty segments mean whole row, independent of diagnostic labels', () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.addOne(value());
      const row = tree.$.rows.byIdOrFail('a.b');
      const binding = getEntityLocationBinding(row);
      if (!binding) throw new Error('Missing binding');
      const port = createTreeRealizationAdapter({
        tree: tree as unknown as SignalTree<object>,
        descriptors: new Map(),
      });
      const next = { ...value(), 'a.b': 0 };
      const effect: ReversalEffect = {
        owner: binding.owner,
        subjectId: binding.subjectId,
        subjectFieldSegments: [],
        path: 'not.a.real.path',
        ownerPath: 'also.not.real',
        before: value(),
        after: next,
      };
      expect(port.validateEffects([effect])).toBeUndefined();
      port.applyAtomically([effect]);
      expect(row()).toEqual(next);
    } finally {
      tree.destroy();
    }
  });

  it('declarative target uses literal segment arrays, not conflicting display paths', () => {
    const target = deriveDeclarativeTransitionTarget({
      collections: [
        {
          owner: 7,
          order: [1],
          orderFrontier: {},
          subjects: [{ subject: 1, key: 'a.b', value: value() }],
        },
      ],
      effects: [
        {
          owner: 7,
          subjectId: 1,
          subjectFieldSegments: ['a.b'],
          path: 'rows.with.dot.a.b.a.b',
          ownerPath: 'rows.with.dot',
          before: 7,
          after: 0,
        },
      ],
    });
    expect(
      target.collections
        .get(7)
        ?.subjects.find((subject) => subject.subject === 1)?.value
    ).toEqual({ ...value(), 'a.b': 0 });
  });
});
