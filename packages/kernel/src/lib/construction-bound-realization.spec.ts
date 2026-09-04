import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import {
  type ObservationAdapter,
} from './internals/observation-adapter';
import { createSignalTreeFactory } from './signal-tree';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';

interface RealizationCalls {
  token: number;
  observe: number;
  invalidate: number;
  invalidationGroup: number;
}

const emptyCalls = (): RealizationCalls => ({
  token: 0,
  observe: 0,
  invalidate: 0,
  invalidationGroup: 0,
});

const realization = (
  calls?: RealizationCalls
): ObservationAdapter => {
  return {
    createToken: () => {
      if (calls) calls.token++;
      return {
        observe: () => {
          if (calls) calls.observe++;
        },
        invalidate: () => {
          if (calls) calls.invalidate++;
        },
      };
    },
    runInvalidationGroup: (run) => {
      if (calls) calls.invalidationGroup++;
      run();
    },
  };
};

describe('CONSTRUCTION-BOUND-REALIZATION-0', () => {
  it('snapshots and binds realization ports when the factory is created', () => {
    const adapter: ObservationAdapter & {
      tokenCalls: number;
      groupCalls: number;
    } = {
      tokenCalls: 0,
      groupCalls: 0,
      createToken() {
        this.tokenCalls += 1;
        return {
          observe: () => undefined,
          invalidate: () => undefined,
        };
      },
      runInvalidationGroup(run) {
        this.groupCalls += 1;
        run();
      },
    };
    const signalTreeBound = createSignalTreeFactory(adapter);
    let replacementCalls = 0;
    adapter.createToken = () => {
      replacementCalls += 1;
      return {
        observe: () => undefined,
        invalidate: () => undefined,
      };
    };
    adapter.runInvalidationGroup = (run) => {
      replacementCalls += 1;
      run();
    };

    const tree = signalTreeBound({ value: 0 });
    tree.$.value();
    tree.$.value.set(1);

    expect(adapter.tokenCalls).toBe(1);
    expect(adapter.groupCalls).toBeGreaterThan(0);
    expect(replacementCalls).toBe(0);
  });

  it('admits every retained port through kernel-owned framework-free work', () => {
    const calls = emptyCalls();
    const signalTreeFake = createSignalTreeFactory(realization(calls));
    const plainTree = signalTreeFake({ value: 1 });
    const tree = signalTreeFake(
      {
        count: 1,
        nested: { value: 1 },
        rows: entityMap<{ id: string; value: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      {
        capabilities: ['causal-runtime'],
        derived: ($) => ({ doubled: () => $.count() * 2 }),
      }
    );

    tree.$.count();
    plainTree.$({ value: 2 });
    tree.$.count.set(2);
    tree.$.doubled();
    tree.$.nested();
    tree.$.rows.addOne({ id: 'a', value: 1 });
    tree.$.rows.where((row) => row.value > 0)();
    tree.$();

    const scalarRuntime = getTreeScalarSlotRuntime(tree.$);
    const countPosition = getOwnedPositionIds(tree.$.count)?.[0];
    const countSlot =
      countPosition === undefined
        ? undefined
        : scalarRuntime?.resolveScalarSlot(countPosition);
    if (!scalarRuntime || countSlot === undefined) {
      throw new Error('Expected a scalar frame for the fake realization');
    }
    const frame = scalarRuntime.beginFrame();
    frame.set(countSlot, 3);
    frame.commit();

    expect(calls.token).toBeGreaterThan(0);
    expect(calls.observe).toBeGreaterThan(0);
    expect(calls.invalidate).toBeGreaterThan(0);
    expect(calls.invalidationGroup).toBeGreaterThan(0);
  });

  it('retains A/B/A observation isolation through interleaved lazy allocations', () => {
    const callsA = emptyCalls();
    const callsB = emptyCalls();
    const a = realization(callsA);
    const b = realization(callsB);
    const signalTreeA = createSignalTreeFactory(a);
    const signalTreeB = createSignalTreeFactory(b);

    const treeA1 = signalTreeA(
      {
        count: 1,
        rows: entityMap<{ id: string; value: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      {
        derived: ($) => {
          const doubled = () => $.count() * 2;
          return {
            doubled,
            quadrupled: () => doubled() * 2,
          };
        },
      }
    );
    const treeB = signalTreeB({
      count: 2,
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const treeA2 = signalTreeA({ count: 3 });

    treeA1.$.rows.addOne({ id: 'a', value: 1 });
    treeB.$.rows.addOne({ id: 'b', value: 2 });

    treeA1.$.count();
    treeB.$.count();
    treeA2.$.count();
    treeA1.$.rows.byIdOrFail('a').value();
    treeB.$.rows.byIdOrFail('b').value();
    treeA1.$.count.set(4);
    treeB.$.count.set(5);

    expect(callsA.token).toBeGreaterThan(0);
    expect(callsB.token).toBeGreaterThan(0);
    expect(callsA.invalidate).toBeGreaterThan(0);
    expect(callsB.invalidate).toBeGreaterThan(0);
    expect(treeA1.$.quadrupled()).toBe(16);
  });

  it('keeps neutral and bound trees independent in both construction orders', () => {
    const signalTreeA = createSignalTreeFactory(realization());
    const neutralBefore = createSignalTreeFactory()({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const angularLike = signalTreeA({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const neutralAfter = createSignalTreeFactory()({ count: 1 });

    neutralBefore.$.rows.addOne({ id: 'n', value: 1 });
    angularLike.$.rows.addOne({ id: 'a', value: 2 });

    expect(neutralBefore.$.rows.byIdOrFail('n').value()).toBe(1);
    expect(angularLike.$.rows.byIdOrFail('a').value()).toBe(2);
    expect(neutralAfter.$.count()).toBe(1);
  });
});
