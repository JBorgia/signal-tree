import { expect, it } from 'vitest';
import { signalTree, link, transactions, entityMap } from '../index';
import { createTreeScalarLeafRuntime } from './internals/tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './internals/native-tree-scalar-leaf-runtime';
import { createPhysicalCommitClock } from './internals/physical-commit-clock';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
import { replaceLocation } from './internals/location-runtime';
import {
  scalarFrameMetadata,
  scalarPublicationCovers,
  withScalarPublicationCoverage,
} from './internals/scalar-publication-coverage';
import type { ObservationAdapter } from './internals/observation-adapter';
import { PathNotifier, getPathNotifier } from './path-notifier';
import type { WriteMetadata } from './mutation-types';

function fixture(native: boolean) {
  const invalidations: number[] = [];
  let throwInvalidation = false;
  const error = new Error('invalidate fixture');
  let id = 0;
  const token = () => {
    const n = id++;
    return {
      observe() { /* This adapter fixture does not schedule reactive work. */ },
      invalidate() {
        invalidations.push(n);
        if (throwInvalidation) throw error;
      },
    };
  };
  const adapter: ObservationAdapter = {
    createToken: token,
    runInvalidationGroup: (run) => run(),
    createWritableCell: <T>(read: () => T) => {
      const cell = Object.assign(() => read(), {
        set: (_v: T) => { /* Destination values are intentionally discarded in this protocol fixture. */ },
        update: (_f: (v: T) => T) => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },
        asReadonly: () => cell,
      });
      return { cell, peek: read, token: token() };
    },
  };
  const clock = createPhysicalCommitClock();
  const runtime = native
    ? createNativeTreeScalarLeafRuntime(clock, adapter)
    : createTreeScalarLeafRuntime(clock);
  const a = runtime.createLeaf<number>(0, Object.is),
    b = runtime.createLeaf<number>(0, Object.is);
  return {
    runtime,
    a,
    b,
    clock,
    invalidations,
    error,
    throwInvalidation: () => {
      throwInvalidation = true;
    },
  };
}
for (const native of [false, true]) {
  it(`frame prepare failure installs nothing (native=${native})`, () => {
    const { runtime, a, b, clock } = fixture(native),
      records = new Map(),
      error = new Error('prepare fixture');
    const events: string[] = [];
    const offA = preparePublicationMutations(
      a,
      () => ({
        record: { writes: [{ map: records, key: 'a', value: 1 }], adds: [] },
        completion: {},
      }),
      () => events.push('a')
    )!;
    const offB = preparePublicationMutations(
      b,
      () => {
        throw error;
      },
      () => events.push('b')
    )!;
    try {
      const f = runtime.beginFrame();
      f.set(0, 1);
      f.set(1, 2);
      expect(() => f.prepareCommit!({ publish: false })).toThrow(error);
      expect([a(), b(), clock.revision()]).toEqual([0, 0, 0]);
      expect(records.size).toBe(0);
      expect(events).toEqual([]);
    } finally {
      offA();
      offB();
    }
  });
  it(`frame reentry rejects outer installation (native=${native})`, () => {
    const { runtime, a, b } = fixture(native);
    let entered = false;
    const records = new Map();
    const off = preparePublicationMutations(
      b,
      () => {
        if (!entered) {
          entered = true;
          replaceLocation(a, 9);
        }
        return {
          record: {
            writes: [{ map: records, key: 'outer', value: 1 }],
            adds: [],
          },
          completion: {},
        };
      },
      () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }
    )!;
    try {
      const f = runtime.beginFrame();
      f.set(0, 1);
      f.set(1, 2);
      expect(() => f.prepareCommit!({ publish: false })).toThrow(
        'Reentrant scalar preparation'
      );
      expect([a(), b()]).toEqual([9, 0]);
      expect(records.size).toBe(0);
    } finally {
      off();
    }
  });
  it(`frame publish:false transfers obligations through reconstructed result (native=${native})`, () => {
    const { runtime, a, b } = fixture(native),
      channel = {},
      records = new Map(),
      events: unknown[] = [];
    const off = preparePublicationMutations(
      a,
      (m) => ({
        record: {
          writes: [{ map: records, key: 'a', value: m.after }],
          adds: [],
        },
        completion: {},
        coveredRecipients: [channel],
      }),
      () => events.push([a(), b()])
    )!;
    try {
      const f = runtime.beginFrame();
      f.set(0, 1);
      f.set(1, 2);
      const install = f.prepareCommit!({ publish: false });
      expect([a(), b()]).toEqual([0, 0]);
      expect(records.size).toBe(0);
      const result = install();
      expect([a(), b()]).toEqual([1, 2]);
      expect(records.get('a')).toBe(1);
      expect(events).toEqual([]);
      expect(
        scalarPublicationCovers(scalarFrameMetadata(result, 0, {}), channel)
      ).toBe(true);
      expect(
        scalarPublicationCovers(scalarFrameMetadata(result, 1, {}), channel)
      ).toBe(false);
      runtime.publishPrepared({ ...result, changedSlots: [0, 1] });
      runtime.publishPrepared({ ...result, changedSlots: [] });
      expect(events).toEqual([[1, 2]]);
    } finally {
      off();
    }
  });
  it(`completion throw drains all installed obligations and next frame recovers (native=${native})`, () => {
    const { runtime, a, b } = fixture(native),
      events: string[] = [],
      error = new Error('complete fixture');
    let throws = true;
    const unit = () => ({ record: { writes: [], adds: [] }, completion: {} });
    const offA = preparePublicationMutations(a, unit, () => {
      events.push('a');
      if (throws) throw error;
    })!;
    const offB = preparePublicationMutations(b, unit, () => events.push('b'))!;
    try {
      const f = runtime.beginFrame();
      f.set(0, 1);
      f.set(1, 2);
      expect(() => f.commit()).toThrow(error);
      expect([a(), b()]).toEqual([1, 2]);
      expect(events).toEqual(['a', 'b']);
      throws = false;
      const next = runtime.beginFrame();
      next.set(0, 3);
      next.set(1, 4);
      next.commit();
      expect(events).toEqual(['a', 'b', 'a', 'b']);
      expect([a(), b()]).toEqual([3, 4]);
    } finally {
      offA();
      offB();
    }
  });
  it(`equality failure before source record installation (native=${native})`, () => {
    const { runtime, a } = fixture(native),
      error = new Error('equality fixture'),
      records = new Map();
    const c = runtime.createLeaf(0, (x, y) => {
      if (x !== y) throw error;
      return true;
    });
    const off = preparePublicationMutations(
      a,
      () => ({
        record: { writes: [{ map: records, key: 0, value: 1 }], adds: [] },
        completion: {},
      }),
      () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }
    )!;
    try {
      const f = runtime.beginFrame();
      f.set(0, 1);
      f.set(2, 2);
      expect(() => f.prepareCommit!()).toThrow(error);
      expect([a(), c()]).toEqual([0, 0]);
      expect(records.size).toBe(0);
    } finally {
      off();
    }
  });
}
it('native invalidation throw preserves first error and drains both completions', () => {
  const x = fixture(true),
    events: string[] = [];
  const unit = () => ({ record: { writes: [], adds: [] }, completion: {} });
  const a = preparePublicationMutations(x.a, unit, () => events.push('a'))!,
    b = preparePublicationMutations(x.b, unit, () => events.push('b'))!;
  try {
    x.throwInvalidation();
    const f = x.runtime.beginFrame();
    f.set(0, 1);
    f.set(1, 2);
    expect(() => f.commit()).toThrow(x.error);
    expect(x.invalidations).toHaveLength(2);
    expect(events).toEqual(['a', 'b']);
    expect([x.a(), x.b()]).toEqual([1, 2]);
  } finally {
    a();
    b();
  }
});
for (const mixed of [false, true])
  it(`coalesced ABA coverage requires every contribution; mixed=${mixed}`, () => {
    const n = new PathNotifier(),
      channel = {},
      other = {};
    const seen: Array<{ value: unknown; meta: WriteMetadata | undefined }> = [];
    const off = n.subscribeProjection(
      (value, _prev, _path, _owner, _origin, _subjects, _positions, meta) => {
        seen.push({ value, meta });
      }
    );
    try {
      n.notify(
        'x',
        1,
        0,
        'x',
        undefined,
        [1],
        withScalarPublicationCoverage({}, [channel, other])
      );
      n.notify(
        'x',
        0,
        1,
        'x',
        undefined,
        [1],
        mixed ? {} : withScalarPublicationCoverage({}, [channel])
      );
      n.notify(
        'x',
        2,
        0,
        'x',
        undefined,
        [1],
        withScalarPublicationCoverage({}, [channel])
      );
      n.flushSync();
      // Ordinary notification coalescing remains one ABA result. The omitted
      // recipient on either contribution cannot borrow the other's receipt.
      expect(seen).toHaveLength(1);
      expect(seen[0].value).toBe(2);
      expect(scalarPublicationCovers(seen[0].meta, channel)).toBe(!mixed);
      expect(scalarPublicationCovers(seen[0].meta, other)).toBe(false);
    } finally {
      off();
      n.clear();
    }
  });
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
it('mixed scalar member row rollback exposes one fully compensated state; dispose before queued completion', async () => {
  const tree = signalTree(
    {
      profile: { x: 0, optional: 1 } as { x: number; optional?: number },
      rows: entityMap<{ id: string; x: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
  tree.$.rows.addOne({ id: 'a', x: 0 });
  await flush();
  const sent: unknown[] = [];
  const c = link(tree.$.profile, {
    set: (v) => {
      sent.push([v, tree.$.rows.byIdOrFail('a').x()]);
    },
  });
  try {
    const p = tree.transact(() => {
      tree.$.profile({ x: 7 });
      tree.$.rows.updateOne('a', { x: 7 });
    });
    await flush();
    expect(sent).toEqual([]);
    p.rollback();
    await flush();
    expect(tree.$.profile()).toEqual({ x: 0, optional: 1 });
    expect(tree.$.rows.byIdOrFail('a').x()).toBe(0);
    expect(
      sent.every(
        (v) => JSON.stringify(v) === JSON.stringify([{ x: 0, optional: 1 }, 0])
      )
    ).toBe(true);
    const q = tree.transact(() => tree.$.profile.x(8));
    q.rollback();
    c.dispose();
    const count = sent.length;
    await flush();
    expect(sent.length).toBe(count);
  } finally {
    c.dispose();
    tree.destroy();
  }
});
it('rollback to an earlier pending scalar retains that owner requirement', async () => {
  const tree = signalTree({ x: 0 }, { enhancers: [transactions()] }),
    sent: number[] = [];
  const c = link(tree.$.x, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    const q = tree.transact(() => tree.$.x(7));
    await flush();
    const p = tree.transact(() => tree.$.x(9));
    await flush();
    expect(sent).toEqual([]);
    p.rollback();
    await flush();
    expect(tree.$.x()).toBe(7);
    expect(sent).toEqual([]);
    q.confirm();
    await flush();
    expect(sent).toEqual([7]);
  } finally {
    c.dispose();
    tree.destroy();
  }
});
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';
import { getOwnedPositionIds } from './internals/owned-mutation';
it('sibling prepared records retain changed contribution when final sibling is equal', async () => {
  const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] }),
    sent: unknown[] = [];
  const c = link(tree.$, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const f = runtime.beginFrame();
    f.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.a)![0])!, 1);
    f.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.b)![0])!, 0);
    f.commit();
    await flush();
    expect(tree.$()).toEqual({ a: 1, b: 0 });
    expect(sent.at(-1)).toEqual({ a: 1, b: 0 });
  } finally {
    c.dispose();
    tree.destroy();
  }
});
it('unregister after install cannot lose captured completion; synthetic invalidation cannot steal it', () => {
  const { runtime, a } = fixture(false),
    events: string[] = [];
  const off = preparePublicationMutations(
    a,
    () => ({ record: { writes: [], adds: [] }, completion: {} }),
    () => events.push('complete')
  )!;
  const f = runtime.beginFrame();
  f.set(0, 1);
  const result = f.prepareCommit!({ publish: false })();
  off();
  runtime.publishPrepared({ revision: result.revision, changedSlots: [0] });
  expect(events).toEqual([]);
  runtime.publishPrepared({ ...result });
  expect(events).toEqual(['complete']);
});
import { getPositionRegistry } from './internals/position-registry';
// Internal notification protocol probes: synthetic uncovered contributions are
// not claims that a new public custom adapter/write route is admitted.
for (const order of ['uncovered-first', 'uncovered-last', 'sibling'] as const)
  it(`mixed contribution protocol does not replay covered payload or suppress unrelated uncovered work: ${order}`, async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] }),
      sent: unknown[] = [];
    const c = link(tree.$, {
      set: (v) => {
        sent.push(v);
      },
    });
    const uncovered = () =>
      getPathNotifier().notify(
        'x',
        9,
        0,
        'x',
        undefined,
        getOwnedPositionIds(tree.$.x),
        undefined,
        getPositionRegistry(tree.$)!.id
      );
    try {
      if (order === 'uncovered-first') {
        uncovered();
        tree.$.x(2);
      } else if (order === 'uncovered-last') {
        tree.$.x(2);
        uncovered();
      } else {
        uncovered();
        tree.$.y(2);
      }
      await flush();
      expect(sent.at(-1)).toEqual(
        order === 'uncovered-first'
          ? { x: 2, y: 0 }
          : order === 'uncovered-last'
          ? { x: 9, y: 0 }
          : { x: 9, y: 2 }
      );
    } finally {
      c.dispose();
      tree.destroy();
    }
  });
it('synthetic uncovered contribution plus covered age write cannot resurrect a subsequently omitted member', async () => {
  const tree = signalTree(
      { profile: { name: 'Ada', age: 42 } as { name: string; age?: number } },
      { enhancers: [transactions()] }
    ),
    sent: unknown[] = [];
  const c = link(tree.$.profile, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    const age = tree.$.profile.age;
    if (!age) throw new Error('Expected initial age leaf');
    getPathNotifier().notify(
      'profile.age',
      99,
      42,
      'profile.age',
      undefined,
      getOwnedPositionIds(age),
      undefined,
      getPositionRegistry(tree.$)!.id
    );
    age(8);
    tree.$.profile({ name: 'Ada' });
    await flush();
    expect(tree.$.profile()).toEqual({ name: 'Ada' });
    expect(sent.at(-1)).toEqual({ name: 'Ada' });
  } finally {
    c.dispose();
    tree.destroy();
  }
});
it('uncovered observation queued behind publish:false survives until exact frame completion', async () => {
  const tree = signalTree({ x: 0 }, { enhancers: [transactions()] }),
    sent: number[] = [];
  const c = link(tree.$.x, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    const r = getTreeScalarSlotRuntime(tree.$)!,
      position = getOwnedPositionIds(tree.$.x)![0];
    const f = r.beginFrame();
    f.set(r.resolveScalarSlot(position)!, 2);
    const result = f.prepareCommit!({ publish: false })();
    getPathNotifier().notify(
      'x',
      9,
      2,
      'x',
      undefined,
      [position],
      undefined,
      getPositionRegistry(tree.$)!.id
    );
    await flush();
    expect(sent).toEqual([]);
    r.publishPrepared({ ...result });
    await flush();
    expect(sent).toEqual([9]);
  } finally {
    c.dispose();
    tree.destroy();
  }
});
it('two sources with identical local positions do not share contribution coverage', async () => {
  const a = signalTree({ x: 0 }, { enhancers: [transactions()] }),
    b = signalTree({ x: 0 }, { enhancers: [transactions()] }),
    av: number[] = [],
    bv: number[] = [];
  const ac = link(a.$.x, {
      set: (v) => {
        av.push(v);
      },
    }),
    bc = link(b.$.x, {
      set: (v) => {
        bv.push(v);
      },
    });
  try {
    expect(getOwnedPositionIds(a.$.x)).toEqual(getOwnedPositionIds(b.$.x));
    a.$.x(1);
    b.$.x(2);
    await flush();
    expect(av).toEqual([1]);
    expect(bv).toEqual([2]);
  } finally {
    ac.dispose();
    bc.dispose();
    a.destroy();
    b.destroy();
  }
});
import { restoration, undoable } from '../index';
it('declarative restoration scalar preparation fails before collection or scalar installation', async () => {
  const t = signalTree(
    { a: 0, b: 0, rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [restoration()] }
  );
  const records = new Map(),
    error = new Error('last restoration scalar preparation');
  let calls = 0;
  try {
    t.$.rows.addOne({ id: 'a', n: 0 });
    await flush();
    undoable(() => {
      t.$.a(1);
      t.$.b(1);
      t.$.rows.updateOne('a', { n: 1 });
    });
    await flush();
    undoable(() => {
      t.$.a(2);
      t.$.b(2);
      t.$.rows.clear();
    });
    await flush();
    const offA = preparePublicationMutations(
      t.$.a,
      () => ({
        record: { writes: [{ map: records, key: 'a', value: 1 }], adds: [] },
        completion: {},
      }),
      () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }
    )!;
    const offB = preparePublicationMutations(
      t.$.b,
      () => {
        calls++;
        throw error;
      },
      () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }
    )!;
    try {
      let caught: unknown;
      try {
        t.jumpTo(0);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      expect(calls).toBeGreaterThan(0);
      expect([t.$.a(), t.$.b()]).toEqual([2, 2]);
      expect(t.$.rows.all()).toEqual([]);
      expect(records.size).toBe(0);
    } finally {
      offA();
      offB();
    }
  } finally {
    t.destroy();
  }
});
it('completion reentry and install replay cannot duplicate installed work', () => {
  const { runtime, a } = fixture(false);
  let result:
    | ReturnType<ReturnType<typeof runtime.beginFrame>['commit']>
    | undefined;
  let calls = 0;
  const off = preparePublicationMutations(
    a,
    () => ({ record: { writes: [], adds: [] }, completion: {} }),
    () => {
      calls++;
      if (result) runtime.publishPrepared({ ...result, changedSlots: [] });
    }
  )!;
  try {
    const f = runtime.beginFrame();
    f.set(0, 1);
    const install = f.prepareCommit!({ publish: false });
    result = install();
    expect(() => install()).toThrow('already used');
    runtime.publishPrepared(result);
    expect(calls).toBe(1);
    expect(a()).toBe(1);
  } finally {
    off();
  }
});
import { withWriteContext } from './write-context';
it('inspection frame and equal physical adoption preserve ordinary baseline and support-only completion', async () => {
  const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
  const sent: number[] = [];
  const c = link(tree.$.x, {
    set: (value) => {
      sent.push(value);
    },
  });
  try {
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    const position = getOwnedPositionIds(tree.$.x)![0];
    withWriteContext({ participation: 'inspection' }, () => {
      const frame = runtime.beginFrame();
      frame.set(runtime.resolveScalarSlot(position)!, 99);
      frame.commit();
    });
    await flush();
    expect(tree.$.x()).toBe(99);
    expect(sent).toEqual([]);
    const p = tree.transact(() => tree.$.x(99));
    expect(p.inspect().changes.length).toBeGreaterThan(0);
    await flush();
    expect(sent).toEqual([]);
    p.rollback();
    await flush();
    expect(tree.$.x()).toBe(0);
    expect(sent.includes(99)).toBe(false);
    tree.$.x(3);
    await flush();
    expect(sent.at(-1)).toBe(3);
  } finally {
    c.dispose();
    tree.destroy();
  }
});
