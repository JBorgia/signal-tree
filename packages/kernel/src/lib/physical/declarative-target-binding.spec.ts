import { describe, expect, it } from 'vitest';

import { entityMap } from '../markers/entity-map';
import { signalTree } from '../signal-tree';
import type { CollectionTransitionTarget } from '../internals/causal-runtime/target-transition';

type Row = { id: string; value: number };

type TargetBinding = {
  __positionIds: readonly number[];
  __acquireEntityHandleForTesting(
    id: string
  ): { subjectId: number } | undefined;
  __prepareTransitionTarget: {
    prepareTarget(target: CollectionTransitionTarget): {
      install(): void;
      publish(): void;
    };
  };
};

describe('declarative collection target binding', () => {
  it('installs a prepared reorder while preserving held SubjectId facades', () => {
    const tree = signalTree(
      {
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      { capabilities: ['causal-runtime'] }
    );
    tree.$.rows.setAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ]);

    const heldA = tree.$.rows.byIdOrFail('a');
    const heldB = tree.$.rows.byIdOrFail('b');
    const heldC = tree.$.rows.byIdOrFail('c');
    const binding = tree.$.rows as unknown as TargetBinding;
    const owner = binding.__positionIds[0];
    const subjectA = binding.__acquireEntityHandleForTesting('a')?.subjectId;
    const subjectB = binding.__acquireEntityHandleForTesting('b')?.subjectId;
    const subjectC = binding.__acquireEntityHandleForTesting('c')?.subjectId;
    if (
      subjectA === undefined ||
      subjectB === undefined ||
      subjectC === undefined
    ) {
      throw new Error('Expected seeded subjects');
    }

    const prepared = binding.__prepareTransitionTarget.prepareTarget({
      owner,
      subjects: [
        { subject: subjectA, key: 'a', value: { id: 'a', value: 1 } },
        { subject: subjectB, key: 'b', value: { id: 'b', value: 2 } },
        { subject: subjectC, key: 'c', value: { id: 'c', value: 3 } },
      ],
      order: [subjectC, subjectB, subjectA],
    });

    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
    prepared.install();
    prepared.publish();

    expect(tree.$.rows.ids()).toEqual(['c', 'b', 'a']);
    expect(heldA()).toEqual({ id: 'a', value: 1 });
    expect(heldB()).toEqual({ id: 'b', value: 2 });
    expect(heldC()).toEqual({ id: 'c', value: 3 });
    expect(binding.__acquireEntityHandleForTesting('a')?.subjectId).toBe(
      subjectA
    );
    expect(binding.__acquireEntityHandleForTesting('b')?.subjectId).toBe(
      subjectB
    );
    expect(binding.__acquireEntityHandleForTesting('c')?.subjectId).toBe(
      subjectC
    );
  });

  it('installs a key swap directly while held facades follow their subjects', () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { capabilities: ['causal-runtime'] }
    );
    tree.$.rows.setAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
    const heldA = tree.$.rows.byIdOrFail('a');
    const heldB = tree.$.rows.byIdOrFail('b');
    const binding = tree.$.rows as unknown as TargetBinding;
    const owner = binding.__positionIds[0];
    const subjectA = binding.__acquireEntityHandleForTesting('a')?.subjectId;
    const subjectB = binding.__acquireEntityHandleForTesting('b')?.subjectId;
    if (subjectA === undefined || subjectB === undefined) {
      throw new Error('Expected seeded subjects');
    }

    const prepared = binding.__prepareTransitionTarget.prepareTarget({
      owner,
      subjects: [
        { subject: subjectA, key: 'b', value: { id: 'a', value: 1 } },
        { subject: subjectB, key: 'a', value: { id: 'b', value: 2 } },
      ],
      order: [subjectA, subjectB],
    });
    prepared.install();
    prepared.publish();

    expect(tree.$.rows.ids()).toEqual(['b', 'a']);
    expect(tree.$.rows.byIdOrFail('b')).toBe(heldA);
    expect(tree.$.rows.byIdOrFail('a')).toBe(heldB);
    expect(heldA()).toEqual({ id: 'a', value: 1 });
    expect(heldB()).toEqual({ id: 'b', value: 2 });

    heldA({ id: 'a', value: 10 });
    expect(tree.$.rows.byIdOrFail('b')()).toEqual({ id: 'a', value: 10 });
    expect(tree.$.rows.byId('__tmp')).toBeUndefined();
  });

  it('detaches prepared values from caller-owned target objects', () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { capabilities: ['causal-runtime'] }
    );
    tree.$.rows.setAll([{ id: 'a', value: 1 }]);
    const binding = tree.$.rows as unknown as TargetBinding;
    const owner = binding.__positionIds[0];
    const subject = binding.__acquireEntityHandleForTesting('a')?.subjectId;
    if (subject === undefined) {
      throw new Error('Expected seeded subject');
    }
    const value = { id: 'a', value: 2 };
    const prepared = binding.__prepareTransitionTarget.prepareTarget({
      owner,
      subjects: [{ subject, key: 'a', value }],
      order: [subject],
    });

    value.value = 99;
    prepared.install();
    prepared.publish();

    expect(tree.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', value: 2 });
  });
});
