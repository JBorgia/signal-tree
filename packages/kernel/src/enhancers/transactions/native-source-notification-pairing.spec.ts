import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../../index';
import { preparePointRealization } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import {
  getOwnedPositionIds,
  getOwnedSubjectIds,
} from '../../lib/internals/owned-mutation';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { getEntityOrdinaryChanges } from '../../lib/internals/entity-value-transition';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { getPathNotifier } from '../../lib/path-notifier';
import { withWriteContext } from '../../lib/write-context';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const make = () =>
  signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );

describe('exact source-to-notification admission pairing', () => {
  it('retains an unprepared sibling point writer and pending authority after refusal', async () => {
    const tree = make();
    try {
      const rows = tree.$.rows;
      rows.addOne({ id: 'a', n: 7 });
      await tick();
      const a = rows.byIdOrFail('a');
      const pending = tree.transact(() => a.n(8));
      const owner = getOwnedPositionIds(rows)![0],
        subjectId = getOwnedSubjectIds(a.n)![0];
      const point = preparePointRealization(tree, [
        {
          owner,
          subjectId,
          subjectFieldSegments: ['n'],
          before: 8,
          after: 123,
        },
      ]);
      expect(point).toBeDefined();
      point!.install();
      point!.publish();
      expect(a.n()).toBe(123);
      expect(pending.inspect().changes[0].status).toBe('superseded');
      expect(() => pending.rollback()).toThrow();
      expect(a.n()).toBe(123);
      expect(() => pending.inspect()).not.toThrow();
      expect(() => pending.rollback()).toThrow();
      expect(a.n()).toBe(123);
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('hands the actual prepared ordinary fact objects to notifier enqueue', async () => {
    const tree = make();
    const runtime = getMutationCaptureRuntime(tree)!;
    const original = runtime.prepareEntityResponsibility;
    let unsubscribe: (() => void) | undefined;
    try {
      const rows = tree.$.rows;
      rows.addOne({ id: 'a', n: 7 });
      await tick();
      const a = rows.byIdOrFail('a'),
        prepared = new WeakSet<object>();
      let observedFacts = 0;
      runtime.prepareEntityResponsibility = (capture) => {
        for (const change of capture.changes) prepared.add(change);
        return original?.(capture);
      };
      unsubscribe = getPathNotifier()!.observeEnqueue(
        getPositionRegistry(tree.$)!.id,
        (entry) => {
          const changes = getEntityOrdinaryChanges(entry.meta);
          for (const change of changes ?? []) {
            expect(prepared.has(change)).toBe(true);
            observedFacts++;
          }
        }
      );
      const pending = tree.transact(() => {
        rows.changeId('a', 'b');
        withWriteContext({ intent: 'system', participation: 'realized' }, () =>
          a.n(123)
        );
        rows.changeId('b', 'c');
      });
      expect(observedFacts).toBeGreaterThanOrEqual(3);
      pending.rollback();
      expect(rows.byIdOrFail('a')).toBe(a);
      expect(a.n()).toBe(123);
    } finally {
      unsubscribe?.();
      runtime.prepareEntityResponsibility = original;
      tree.destroy();
    }
  });
});
