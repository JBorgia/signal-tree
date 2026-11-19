import { expect, it, vi } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { RecipientOccurrences } from './experimental-publication/recipient-occurrence';
import * as life from './experimental-publication/lifecycle';
import { diagnostics } from './experimental-publication/private';
type C = ReturnType<typeof link> & {
  declare(input: unknown, work: () => unknown): unknown;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
function setup() {
  const tree = signalTree(
    { pair: { x: 0, y: 0 } },
    { enhancers: [transactions()] }
  );
  const foreign = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const parent = link(tree.$.pair, { set: () => {/* Intentionally discard destination values in this proof fixture. */} }) as C;
  const sent: unknown[] = [];
  const q = foreign.transact(() => foreign.$.z(7));
  let child: C | undefined;
  return {
    tree,
    foreign,
    parent,
    sent,
    q,
    get child() {
      return child!;
    },
    fail(cause: 'throw' | 'contradiction') {
      expect(() =>
        parent.declare({ kind: 'independent' }, () => {
          tree.$.pair.x(7);
          child = link(tree.$.pair, {
            set: (v) => {
              sent.push(v);
            },
          }) as C;
          if (cause === 'throw') throw Error('parent invalid');
          parent.declare({ kind: 'dependent', owners: [q] }, () =>
            tree.$.pair.y(1)
          );
        })
      ).toThrow(cause === 'throw' ? 'parent invalid' : 'contradiction');
    },
    destroy() {
      child?.dispose();
      parent.dispose();
      q.confirm();
      tree.destroy();
      foreign.destroy();
    },
  };
}
for (const cause of ['throw', 'contradiction'] as const)
  it(`late enrollment preserves ${cause} and useful settlement`, async () => {
    const s = setup();
    try {
      s.fail(cause);
      s.child.declare({ kind: 'independent' }, () => s.tree.$.pair.y(8));
      await flush();
      expect(s.tree.$.pair()).toEqual({ x: 7, y: 8 });
      expect(s.sent).toEqual([]);
      s.q.confirm();
      await flush();
      expect(s.sent).toEqual([{ x: 7, y: 8 }]);
      await s.child.settled();
    } finally {
      s.destroy();
    }
  });
for (const equal of [false, true])
  it(`fresh literal replaces failed scalar support equal=${equal}`, async () => {
    const s = setup();
    try {
      s.fail('throw');
      s.child.declare({ kind: 'independent' }, () => s.tree.$.pair.y(8));
      await flush();
      expect(s.sent).toEqual([]);
      s.child.declare({ kind: 'independent' }, () =>
        s.tree.$.pair.x(equal ? 7 : 9)
      );
      await flush();
      expect(s.sent).toEqual([{ x: equal ? 7 : 9, y: 8 }]);
      expect(s.foreign.$.z()).toBe(7);
    } finally {
      s.destroy();
    }
  });
it('derived write cannot cleanse failed shared validation', async () => {
  const s = setup();
  try {
    s.fail('contradiction');
    s.child.declare({ kind: 'independent' }, () => s.tree.$.pair.y(8));
    expect(() =>
      s.child.declare({ kind: 'independent' }, () =>
        s.tree.$.pair.x((x) => x + 1)
      )
    ).toThrow('contradiction');
    await flush();
    expect(s.tree.$.pair()).toEqual({ x: 8, y: 8 });
    expect(s.sent).toEqual([]);
    s.q.confirm();
    await flush();
    expect(s.sent).toEqual([{ x: 8, y: 8 }]);
  } finally {
    s.destroy();
  }
});
it('late native-only possible window survives uncovered notification', async () => {
  const tree = signalTree({ x: 0 }),
    foreign = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const q = foreign.transact(() => foreign.$.z(7));
  const sent: unknown[] = [];
  const anchor = link(tree.$, { set: () => {/* Intentionally discard destination values in this proof fixture. */} });
  tree.$.x(7);
  const c = link(tree.$, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    await flush();
    expect(sent).toEqual([]);
    q.confirm();
    await flush();
    expect(sent).toEqual([{ x: 7 }]);
  } finally {
    c.dispose();
    anchor.dispose();
    q.confirm();
    tree.destroy();
    foreign.destroy();
  }
});
it('newer authored scalar and sibling suppress only stale contribution', async () => {
  const s = setup();
  try {
    s.fail('throw');
    s.child.declare({ kind: 'independent' }, () => {
      s.tree.$.pair.x(9);
      s.tree.$.pair.y(8);
    });
    await flush();
    expect(s.tree.$.pair()).toEqual({ x: 9, y: 8 });
    expect(s.sent).toEqual([{ x: 9, y: 8 }]);
  } finally {
    s.destroy();
  }
});
it('private repeated uncovered observations retain one wrapper and release subscriptions', async () => {
  await flush();
  const before = diagnostics();
  const original = RecipientOccurrences.prototype.replace;
  const indices = new Set<RecipientOccurrences>();
  const selected: life.NativeRequirement[] = [];
  const spy = vi
    .spyOn(RecipientOccurrences.prototype, 'replace')
    .mockImplementation(function (this: RecipientOccurrences, ...args) {
      indices.add(this);
      if (
        [...indices].indexOf(this) === 1 &&
        args[2]?.components?.some((r) => life.nativeProof(r).invalid)
      )
        selected.push(args[2]);
      return original.apply(this, args);
    });
  const s = setup();
  try {
    s.fail('throw');
    s.child.declare({ kind: 'independent' }, () => s.tree.$.pair.y(8));
    await flush();
    for (let i = 0; i < 4; i++) {
      getPathNotifier().notify(
        'pair.x',
        8 + i,
        7,
        'pair.x',
        undefined,
        getOwnedPositionIds(s.tree.$.pair.x),
        undefined,
        getPositionRegistry(s.tree.$)!.id
      );
      await flush();
      expect(s.sent).toEqual([]);
    }
    const wrappers = selected.filter((r) =>
      r.components?.some(
        (c) => life.nativeProof(c).unknown && !life.nativeProof(c).invalid
      )
    );
    expect(wrappers.length).toBeGreaterThan(1);
    expect(new Set(wrappers).size).toBe(1);
  } finally {
    s.destroy();
    spy.mockRestore();
  }
  await flush();
  for (const index of indices) expect(index.inspect().subscriptions).toBe(0);
  expect(diagnostics()).toEqual(before);
});

// Private completion protocol trigger; the writes and Link are real runtime routes.
import { preparePublicationMutations } from './internals/intrinsic-mutation';
it('newer author completion reentry cannot replay outer scalar payload', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } }),
    sent: unknown[] = [];
  const parent = link(tree.$.pair, { set: () => {/* Intentionally discard destination values in this proof fixture. */} }) as C;
  let child: C | undefined,
    entered = false;
  const off = preparePublicationMutations(
    tree.$.pair.x,
    () => ({ record: { writes: [], adds: [] }, completion: {} }),
    () => {
      if (entered) return;
      entered = true;
      child = link(tree.$.pair, {
        set: (v) => {
          sent.push(v);
        },
      }) as C;
      child.declare({ kind: 'independent' }, () => {
        tree.$.pair.x(9);
        tree.$.pair.y(8);
      });
    }
  )!;
  try {
    parent.declare({ kind: 'independent' }, () => tree.$.pair.x(7));
    await flush();
    expect(entered).toBe(true);
    expect(tree.$.pair()).toEqual({ x: 9, y: 8 });
    expect(sent).toEqual([{ x: 9, y: 8 }]);
  } finally {
    off();
    child?.dispose();
    parent.dispose();
    tree.destroy();
  }
});
it('private repeated fallback retains unfinished native validation until close', async () => {
  await flush();
  const before = diagnostics();
  const tree = signalTree({ x: 0 }),
    foreign = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const parent = link(tree.$, { set: () => {/* Intentionally discard destination values in this proof fixture. */} }) as C;
  const sent: unknown[] = [];
  const q = foreign.transact(() => foreign.$.z(7));
  let child: C | undefined;
  try {
    expect(() =>
      parent.declare({ kind: 'independent' }, () => {
        tree.$.x(7);
        child = link(tree.$, {
          set: (v) => {
            sent.push(v);
          },
        }) as C;
        for (let i = 0; i < 3; i++) {
          getPathNotifier().notify(
            'x',
            8 + i,
            7,
            'x',
            undefined,
            getOwnedPositionIds(tree.$.x),
            undefined,
            getPositionRegistry(tree.$)!.id
          );
          getPathNotifier().flushSync();
          expect(sent).toEqual([]);
        }
        throw Error('close invalid');
      })
    ).toThrow('close invalid');
    await flush();
    expect(sent).toEqual([]);
    q.confirm();
    await flush();
    expect(sent).toEqual([{ x: 10 }]);
  } finally {
    child?.dispose();
    parent.dispose();
    q.confirm();
    tree.destroy();
    foreign.destroy();
  }
  await flush();
  expect(diagnostics()).toEqual(before);
});
