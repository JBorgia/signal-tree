import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import {
  getEntityPublicationBinding,
  type EntityPublicationSource,
} from './internals/entity-publication';
import { ExactSubjectRuns } from './internals/exact-subject-runs';
import { getPathNotifier } from './path-notifier';
const drain = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 160; i++) await Promise.resolve();
};
const sourceOf = (node: object) => {
  const value = getEntityPublicationBinding(node);
  if (!value) throw Error('missing source');
  return value.source;
};
const capture = (source: EntityPublicationSource) =>
  (source.captureInput() as { native: readonly lifecycle.NativeInput[] })
    .native;
function check(source: EntityPublicationSource) {
  const views = source.captureViews() as readonly {
    requirement: lifecycle.NativeRequirement;
  }[];
  const expected = [...new Set(views.map((view) => view.requirement))].map(
      lifecycle.captureNativeInput
    ),
    actual = capture(source);
  expect(actual.map((input) => input.requirement)).toEqual(
    expected.map((input) => input.requirement)
  );
  actual.forEach((input, i) => {
    expect(input.requirement).toBe(expected[i].requirement);
    expect(input.owners).toEqual(expected[i].owners);
    expect(input.terminalRejectedRoles).toBe(expected[i].terminalRejectedRoles);
  });
  return actual;
}
describe('whole input selection memo proposal', () => {
  it('returns fresh frozen inputs with changed owner outcomes without changing selected references', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.setAll([{ id: 'a', value: 0 }]);
      const source = sourceOf(tree.$.rows);
      const tx = tree.transact(() => tree.$.rows.updateOne('a', { value: 1 }));
      const first = check(source),
        second = check(source);
      expect(second).not.toBe(first);
      expect(Object.isFrozen(second)).toBe(true);
      second.forEach((input, i) => {
        expect(input).not.toBe(first[i]);
        expect(input.owners).not.toBe(first[i].owners);
        expect(Object.isFrozen(input)).toBe(true);
        expect(Object.isFrozen(input.owners)).toBe(true);
      });
      expect(
        first.some((input) =>
          input.owners.some((owner) => owner.outcome === 'pending')
        )
      ).toBe(true);
      tx.confirm();
      const after = check(source);
      expect(
        after.some((input) =>
          input.owners.some((owner) => owner.outcome === 'confirmed')
        )
      ).toBe(false);
      expect(
        first.some((input) =>
          input.owners.some((owner) => owner.outcome === 'confirmed')
        )
      ).toBe(true);
    } finally {
      tree.destroy();
    }
  });
  it('reads current installed facts from a later participant before the source revision advances', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>(),
    });
    const source = sourceOf(tree.$.rows);
    let calls = 0;
    tree.$.rows.setAll([{ id: 'a', value: 1 }]);
    check(source);
    const off = source.subscribe({
      prepare() {
        return {
          record: {
            writes: [
              {
                map: {
                  set() {
                    calls++;
                    check(source);
                  },
                },
                key: undefined,
                value: undefined,
              },
            ],
            adds: [],
          },
          completion: {},
        };
      },
      complete() {
        // The observer inspects installation in its terminal write above.
      },
    });
    try {
      check(source);
      tree.$.rows.updateOne('a', { value: 2 });
      expect(calls).toBe(1);
      expect(tree.$.rows.byIdOrFail('a').value()).toBe(2);
      check(source);
    } finally {
      off();
      tree.destroy();
    }
  });
  it('retains no prepared-only change after a throwing finalizer, then follows rekey and removal', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>(),
    });
    tree.$.rows.setAll([{ id: 'a', value: 1 }]);
    const source = sourceOf(tree.$.rows);
    const before = check(source);
    const off = source.subscribe({
      prepare() {
        return {
          record: { writes: [], adds: [] },
          completion: {},
          finalize() {
            throw undefined;
          },
        };
      },
      complete() {
        // Finalization fails before this observer can complete.
      },
    });
    let threw = false,
      caught: unknown;
    try {
      tree.$.rows.updateOne('a', { value: 2 });
    } catch (error) {
      threw = true;
      caught = error;
    }
    try {
      expect(threw).toBe(true);
      expect(caught).toBeUndefined();
      expect(tree.$.rows.byIdOrFail('a').value()).toBe(1);
      expect(check(source).map((input) => input.requirement)).toEqual(
        before.map((input) => input.requirement)
      );
      off();
      tree.$.rows.changeId('a', 'b');
      check(source);
      tree.$.rows.removeOne('b');
      check(source);
    } finally {
      off();
      tree.destroy();
    }
  });
  it('avoids actual repeated run traversal while representing every historical fact', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        const tx = tree.transact(() =>
          tree.$.rows.setAll(
            Array.from({ length: 20 }, (_, i) => ({
              id: String(i),
              value: cycle,
            }))
          )
        );
        await drain();
        tx.rollback();
        await drain();
      }
      const source = sourceOf(tree.$.rows),
        original = ExactSubjectRuns.prototype.runValues;
      let yielded = 0;
      const spy = vi
        .spyOn(ExactSubjectRuns.prototype, 'runValues')
        .mockImplementation(function* (this: ExactSubjectRuns<unknown>) {
          for (const value of original.call(this)) {
            yielded++;
            yield value;
          }
        });
      try {
        const first = capture(source);
        expect(yielded).toBe(3);
        yielded = 0;
        const before = source.inspect(),
          again = capture(source),
          after = source.inspect();
        expect(again).not.toBe(first);
        expect(again.map((input) => input.requirement)).toEqual(
          first.map((input) => input.requirement)
        );
        expect.soft(yielded).toBe(0);
        expect.soft(after.inputFactVisits - before.inputFactVisits).toBe(0);
        expect(
          after.wholeInputFactsRepresented - before.wholeInputFactsRepresented
        ).toBe(120);
      } finally {
        spy.mockRestore();
      }
    } finally {
      tree.destroy();
    }
  });
  it('clears selection after structural deletes before a later participant reads installed facts', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>(),
    });
    tree.$.rows.setAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
    const source = sourceOf(tree.$.rows);
    const frames: Array<{
      id: object;
      revision: object;
      writes: number;
      completions: number;
      before: readonly lifecycle.NativeInput[];
      installed?: readonly lifecycle.NativeInput[];
    }> = [];
    const off = source.subscribe({
      prepare(packet) {
        // Capture each unit's revision: removeOne also publishes a distinct,
        // synchronous retained-value retirement unit after the removal commits.
        // Demand selection after native preparation to cover late cache creation.
        const frame = {
          id: packet.id,
          revision: source.revision(),
          writes: 0,
          completions: 0,
          before: check(source),
          installed: undefined as readonly lifecycle.NativeInput[] | undefined,
        };
        frames.push(frame);
        return {
          record: {
            writes: [
              {
                map: {
                  set() {
                    expect(frame.writes).toBe(0);
                    frame.writes++;
                    expect(source.revision()).toBe(frame.revision);
                    frame.installed = check(source);
                  },
                },
                key: undefined,
                value: undefined,
              },
            ],
            adds: [],
          },
          completion: frame,
        };
      },
      complete(completion) {
        const frame = frames.find((value) => value === completion);
        if (!frame) throw Error('unexpected publication completion');
        expect(frame.writes).toBe(1);
        expect(frame.completions).toBe(0);
        frame.completions++;
        expect(source.revision()).not.toBe(frame.revision);
      },
    });
    try {
      check(source);
      const beforeRemoval = source.revision();
      tree.$.rows.removeOne('a');
      // Both actual units must execute exactly once. The first callback still
      // sees its pre-install revision, while checking the newly installed facts.
      expect(frames).toHaveLength(2);
      expect(frames[0].revision).toBe(beforeRemoval);
      expect(frames[1].revision).not.toBe(frames[0].revision);
      expect(frames[1].id).not.toBe(frames[0].id);
      for (const frame of frames) {
        expect(frame.writes).toBe(1);
        expect(frame.completions).toBe(1);
        expect(frame.installed).toBeDefined();
      }
      const initial = frames[0],
        installed = initial.installed;
      if (!installed)
        throw Error('initial mutation did not capture installed facts');
      expect(
        installed.length !== initial.before.length ||
          installed.some(
            (input, i) => input.requirement !== initial.before[i]?.requirement
          )
      ).toBe(true);
      expect(source.revision()).not.toBe(frames[1].revision);
      expect(tree.$.rows.all()).toEqual([{ id: 'b', value: 2 }]);
      check(source);
    } finally {
      off();
      tree.destroy();
    }
  });
});
