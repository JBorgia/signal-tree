import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import {
  type TreeRealization,
} from './internals/tree-realization';
import { bindSignalTreeRealization } from './signal-tree';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';

const REALIZATION = Symbol('test-realization');

type TaggedCell<T> = {
  (): T;
  set(value: T): void;
  update(update: (value: T) => T): void;
  asReadonly(): TaggedCell<T>;
  readonly [REALIZATION]: string;
};

interface RealizationCalls {
  cell: number;
  derived: number;
  reactiveCheck: number;
  token: number;
  observe: number;
  invalidate: number;
  invalidationGroup: number;
  scalarLeaf: number;
  suppressTracking: number;
}

const emptyCalls = (): RealizationCalls => ({
  cell: 0,
  derived: 0,
  reactiveCheck: 0,
  token: 0,
  observe: 0,
  invalidate: 0,
  invalidationGroup: 0,
  scalarLeaf: 0,
  suppressTracking: 0,
});

const tag = <T extends object>(value: T, name: string): T => {
  Object.defineProperty(value, REALIZATION, { value: name });
  return value;
};

const realization = (
  name: string,
  calls?: RealizationCalls
): TreeRealization => {
  const cell = <T,>(initial: T, equal: (left: T, right: T) => boolean = Object.is) => {
    if (calls) calls.cell++;
    let value = initial;
    const result = tag((() => value) as TaggedCell<T>, name);
    result.set = (next) => {
      if (!equal(value, next)) value = next;
    };
    result.update = (update) => result.set(update(value));
    result.asReadonly = () => result;
    return result;
  };

  const derived = <T,>(compute: () => T) => {
    if (calls) calls.derived++;
    return tag((() => compute()) as TaggedCell<T>, name);
  };

  return {
    cell: { createCell: cell },
    derived: { createDerived: derived },
    materialization: {
      isReactiveNode: (value) => {
        if (calls) calls.reactiveCheck++;
        return typeof value === 'function' &&
          (value as Partial<TaggedCell<unknown>>)[REALIZATION] === name;
      },
    },
    scalarLeaf: {
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
      createLeaf: (compute) => {
        if (calls) calls.scalarLeaf++;
        const result = derived(compute);
        result.set = () => undefined;
        result.update = () => undefined;
        return result;
      },
      runInvalidationGroup: (run) => {
        if (calls) calls.invalidationGroup++;
        run();
      },
    },
    suppressTracking: (run) => {
      if (calls) calls.suppressTracking++;
      return run();
    },
  };
};

const identityOf = (value: unknown): string | undefined =>
  typeof value === 'function'
    ? (value as Partial<TaggedCell<unknown>>)[REALIZATION]
    : undefined;

describe('CONSTRUCTION-BOUND-REALIZATION-0', () => {
  it('admits every retained port through kernel-owned framework-free work', () => {
    const calls = emptyCalls();
    const signalTreeFake = bindSignalTreeRealization(realization('fake', calls));
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
    plainTree({ value: 2 });
    tree.$.count.set(2);
    tree.$.doubled();
    tree.$.nested();
    tree.$.rows.addOne({ id: 'a', value: 1 });
    tree.$.rows.where((row) => row.value > 0)();
    tree();

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

    expect(calls.cell).toBeGreaterThan(0);
    expect(calls.derived).toBeGreaterThan(0);
    expect(calls.reactiveCheck).toBeGreaterThan(0);
    expect(calls.token).toBeGreaterThan(0);
    expect(calls.observe).toBeGreaterThan(0);
    expect(calls.invalidate).toBeGreaterThan(0);
    expect(calls.invalidationGroup).toBeGreaterThan(0);
    expect(calls.scalarLeaf).toBeGreaterThan(0);
    expect(calls.suppressTracking).toBeGreaterThan(0);
  });

  it('retains A/B/A realization identity through interleaved lazy allocations', () => {
    const a = realization('A');
    const b = realization('B');
    const signalTreeA = bindSignalTreeRealization(a);
    const signalTreeB = bindSignalTreeRealization(b);

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

    expect(identityOf(treeA1.$.count)).toBe('A');
    expect(identityOf(treeB.$.count)).toBe('B');
    expect(identityOf(treeA2.$.count)).toBe('A');
    expect(identityOf(treeA1.$.doubled)).toBe('A');
    expect(identityOf(treeA1.$.quadrupled)).toBe('A');

    expect(identityOf(treeA1.$.rows.byIdOrFail('a').value)).toBe('A');
    expect(identityOf(treeB.$.rows.byIdOrFail('b').value)).toBe('B');
    expect(identityOf(treeA1.$.rows.where((row) => row.value > 0))).toBe('A');
    expect(identityOf(treeB.$.rows.find((row) => row.value > 0))).toBe('B');
  });

  it('snapshots factory capabilities and keeps write/snapshot work tree-bound', () => {
    const a = realization('A');
    const b = realization('B');
    let suppressA = 0;
    let suppressB = 0;
    let derivedA = 0;
    let derivedB = 0;
    const createDerivedA = a.derived.createDerived;
    const createDerivedB = b.derived.createDerived;
    const mutableA = a as {
      derived: TreeRealization['derived'];
      cell: TreeRealization['cell'];
      suppressTracking: TreeRealization['suppressTracking'];
    };
    const mutableB = b as {
      derived: TreeRealization['derived'];
      suppressTracking: TreeRealization['suppressTracking'];
    };
    mutableA.derived = {
      createDerived: <T,>(compute: () => T) => {
        derivedA++;
        return createDerivedA(compute);
      },
    };
    mutableB.derived = {
      createDerived: <T,>(compute: () => T) => {
        derivedB++;
        return createDerivedB(compute);
      },
    };
    mutableA.suppressTracking = <T,>(run: () => T) => {
      suppressA++;
      return run();
    };
    mutableB.suppressTracking = <T,>(run: () => T) => {
      suppressB++;
      return run();
    };

    const signalTreeA = bindSignalTreeRealization(a);
    const signalTreeB = bindSignalTreeRealization(b);
    const foreignA = a.cell.createCell(1);
    const treeA = signalTreeA({ nested: { value: 1 }, foreign: foreignA });
    const treeB = signalTreeB({ nested: { value: 2 }, foreign: foreignA });

    // Mutating the packet after factory binding cannot alter either factory.
    mutableA.cell = b.cell;

    treeA({ nested: { value: 3 } });
    treeB({ nested: { value: 4 } });
    const beforeA = derivedA;
    const beforeB = derivedB;
    treeA.$.nested();
    treeA();

    expect(identityOf(treeA.$.nested.value)).toBe('A');
    expect(identityOf(treeB.$.nested.value)).toBe('B');
    expect(treeA.$.foreign).toBe(foreignA);
    expect(treeB.$.foreign).not.toBe(foreignA);
    expect(suppressA).toBeGreaterThan(0);
    expect(suppressB).toBeGreaterThan(0);
    expect(derivedA).toBeGreaterThan(beforeA);
    expect(derivedB).toBe(beforeB);
  });

  it('keeps neutral and bound trees independent in both construction orders', () => {
    const signalTreeA = bindSignalTreeRealization(realization('A'));
    const neutralBefore = bindSignalTreeRealization()({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const angularLike = signalTreeA({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const neutralAfter = bindSignalTreeRealization()({ count: 1 });

    neutralBefore.$.rows.addOne({ id: 'n', value: 1 });
    angularLike.$.rows.addOne({ id: 'a', value: 2 });

    expect(identityOf(neutralBefore.$.rows.byIdOrFail('n').value)).toBeUndefined();
    expect(identityOf(angularLike.$.rows.byIdOrFail('a').value)).toBe('A');
    expect(identityOf(neutralAfter.$.count)).toBeUndefined();
  });
});
