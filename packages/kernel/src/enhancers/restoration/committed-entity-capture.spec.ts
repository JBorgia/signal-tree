import { describe, expect, it, vi } from 'vitest';
import {
  createMutationCaptureRuntime,
  type CommittedEntityMutation,
} from '../../lib/internals/mutation-capture-runtime';
import { EntityMutationFrame } from '../../lib/physical/entity-mutation-frame';
import { EntityValueStore } from '../../lib/physical/entity-value-store';
import { StructuralStore } from '../../lib/physical/structural-store';

type Row = { id: string; n: number };
const setup = () => {
  const values = new EntityValueStore<Row>();
  const structure = new StructuralStore<string>();
  structure.createSubject(1, 'a');
  structure.createSubject(2, 'b');
  values.retainSubjectValue(1, { id: 'a', n: 0 });
  values.retainSubjectValue(2, { id: 'b', n: 0 });
  return {
    values,
    structure,
    frame: new EntityMutationFrame(values, structure),
  };
};

describe('committed entity admission evidence', () => {
  it('observes the complete committed frame and stable subjects before publication', () => {
    const { frame, values, structure } = setup();
    frame.stageValueReplacement({
      kind: 'replace-value',
      key: 'a',
      subjectId: 1,
      nextValue: { id: 'a', n: 1 },
    });
    frame.stageValueReplacement({
      kind: 'replace-value',
      key: 'b',
      subjectId: 2,
      nextValue: { id: 'b', n: 2 },
    });
    frame.stageKeyTransfer({
      kind: 'transfer-key',
      subjectId: 2,
      fromKey: 'b',
      toKey: 'b.with.dots',
    });
    let captured: readonly CommittedEntityMutation[] | undefined;
    frame.commit((changes) => {
      expect(values.backingForSubject(1)?.n).toBe(1);
      expect(values.backingForSubject(2)?.n).toBe(2);
      expect(structure.activeKeyForSubject(2)).toBe('b.with.dots');
      captured = changes;
    });
    expect(captured).toEqual([
      {
        subject: 1,
        before: { id: 'a', n: 0 },
        after: { id: 'a', n: 1 },
        structural: false,
      },
      {
        subject: 2,
        before: { id: 'b', n: 0 },
        after: { id: 'b', n: 2 },
        structural: true,
      },
    ]);
  });

  it('reports removal without exposing retained inactive backing as current truth', () => {
    const { frame, values } = setup();
    frame.stageSubjectTombstone({
      kind: 'tombstone-subject',
      key: 'a',
      subjectId: 1,
      restoreAllowed: true,
    });
    const capture = vi.fn();
    frame.commit(capture);
    expect(values.backingForSubject(1)).toEqual({ id: 'a', n: 0 });
    expect(capture).toHaveBeenCalledWith([
      {
        subject: 1,
        before: { id: 'a', n: 0 },
        after: undefined,
        structural: true,
      },
    ]);
  });

  it('does not publish uncommitted evidence on preparation failure', () => {
    const { frame, values } = setup();
    frame.stageValueReplacement({
      kind: 'replace-value',
      key: 'a',
      subjectId: 1,
      nextValue: { id: 'a', n: 1 },
    });
    frame.stageRetainedValueRetirement({
      kind: 'retire-retained-value',
      subjectId: 1,
      forgetLifetime: true,
    });
    const capture = vi.fn();
    expect(() => frame.commit(capture)).toThrow(/tombstoned/);
    expect(capture).not.toHaveBeenCalled();
    expect(values.backingForSubject(1)?.n).toBe(0);
  });

  it('contains observer failures and releases observation independently of capture activation', () => {
    const runtime = createMutationCaptureRuntime();
    const release = runtime.activateCapture();
    const first = runtime.subscribeCommittedEntity!(() => {
      throw new Error('observer');
    });
    const captured = vi.fn();
    const second = runtime.subscribeCommittedEntity!(captured);
    const event = { owner: 1, ownerPath: 'rows', changes: [] };
    expect(() => runtime.publishCommittedEntity!(event)).not.toThrow();
    expect(captured).toHaveBeenCalledWith(event);
    first();
    second();
    expect(runtime.hasCommittedEntityObservers!()).toBe(false);
    expect(runtime.isCaptureActive()).toBe(true);
    release();
    expect(runtime.isCaptureActive()).toBe(false);
  });
});
