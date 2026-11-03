import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../../index';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { peekInternalTransactionRuntime } from './transactions';
import { withWriteContext } from '../../lib/write-context';

const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const realized = (work: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, work);
const make = () =>
  signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );

describe('native source admission segments', () => {
  it('keeps the latest own field inspectable while retaining an earlier foreign dependency', async () => {
    const tree = make();
    try {
      tree.$.rows.setAll([{ id: 'a', n: 7 }]);
      await tick();
      const a = tree.$.rows.byIdOrFail('a');
      const pending = tree.transact(() => {
        a.n(8);
        realized(() => a.n(123));
        a.n(99);
      });
      expect(pending.inspect().changes).toHaveLength(1);
      expect(pending.inspect().changes[0].status).toBe('current');
      // The callback's realized evidence remains a conservative dependency;
      // segmentation must not silently confer ownership of the ingress.
      expect(() => pending.rollback()).toThrow();
      expect(a.n()).toBe(99);
      expect(pending.inspect().changes[0].status).toBe('current');
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('does not install foreign segment boundaries or dependency evidence when preparation aborts', async () => {
    const tree = make();
    const runtime = getMutationCaptureRuntime(tree)!;
    const original = runtime.prepareEntityResponsibility;
    const failure = new Error('foreign preparation aborted');
    try {
      tree.$.rows.setAll([{ id: 'a', n: 7 }]);
      await tick();
      const a = tree.$.rows.byIdOrFail('a');
      const pending = tree.transact(() => {
        a.n(8);
        runtime.prepareEntityResponsibility = (capture) => {
          const prepared = original?.(capture);
          if (capture.meta?.participation === 'realized') throw failure;
          return prepared;
        };
        expect(() => realized(() => a.n(123))).toThrow(failure);
        runtime.prepareEntityResponsibility = original;
        a.n(99);
      });
      expect(a.n()).toBe(99);
      expect(pending.inspect().changes).toHaveLength(1);
      pending.rollback();
      expect(a.n()).toBe(7);
    } finally {
      runtime.prepareEntityResponsibility = original;
      tree.destroy();
    }
  });
  it('releases admission maps across repeated terminal cycles while handles remain retained', async () => {
    const tree = make();
    const retained = [];
    try {
      tree.$.rows.setAll([{ id: 'a', n: 7 }]);
      await tick();
      const a = tree.$.rows.byIdOrFail('a');
      const runtime = peekInternalTransactionRuntime(tree)!;
      for (let cycle = 0; cycle < 12; cycle++) {
        const pending = tree.transact(() => {
          a.n(cycle * 3 + 8);
          realized(() => a.n(cycle * 3 + 9));
          a.n(cycle * 3 + 10);
        });
        retained.push(pending);
        expect(runtime.getSourceAdmissionCountsForTesting()).toEqual({
          segments: 1,
          admissions: 1,
          dependencies: 1,
        });
        pending.confirm();
        expect(runtime.getSourceAdmissionCountsForTesting()).toEqual({
          segments: 0,
          admissions: 0,
          dependencies: 0,
        });
      }
      expect(retained).toHaveLength(12);
      tree.destroy();
      expect(runtime.getSourceAdmissionCountsForTesting()).toEqual({
        segments: 0,
        admissions: 0,
        dependencies: 0,
      });
    } finally {
      tree.destroy();
    }
  });
});
