import { expect, it, vi } from 'vitest';
import { signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { getPathNotifier } from './path-notifier';
import {
  OrdinaryMemberPresenceSource,
  readOrdinaryMemberPresence,
} from './internals/member-membership';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
const make = () =>
  signalTree(
    {
      a: { y: 7 as number | undefined, keep: 9 } as {
        y?: number;
        keep?: number;
      },
    },
    { enhancers: [transactions()] }
  );
const sourceFields = (source: OrdinaryMemberPresenceSource) => {
  const divergent: unknown = Reflect.get(source, 'divergent'),
    revision: unknown = Reflect.get(source, 'revision');
  if (!(divergent instanceof Map) || typeof revision !== 'number')
    throw new Error('Source instrumentation unavailable');
  return { size: divergent.size, revision };
};
it('P2 equal retained reactivation preserves existing ordinary presence on rejection', async () => {
  const t = make();
  try {
    const a = t.$.a,
      y = a.y!;
    withWriteContext({ participation: 'inspection' }, () => a({ keep: 9 }));
    await flush();
    expect(y()).toBeUndefined();
    expect(readOrdinaryMemberPresence(a, 'y')).toBe(true);
    const p = t.transact(() => y(7));
    expect(a()).toEqual({ y: 7, keep: 9 });
    expect(p.inspect().changes).toEqual([]);
    p.rollback();
    expect(a()).toEqual({ y: 7, keep: 9 });
    expect(readOrdinaryMemberPresence(a, 'y')).toBe(true);
    expect(a.y).toBe(y);
  } finally {
    t.destroy();
  }
});
it.each(['point', 'whole'] as const)(
  'present undefined adoption retains existence responsibility via %s',
  async (mode) => {
    const t = signalTree(
      {
        a: { y: undefined as number | undefined, keep: 9 } as {
          y?: number;
          keep?: number;
        },
      },
      { enhancers: [transactions()] }
    );
    try {
      const a = t.$.a,
        y = a.y!;
      a({ keep: 9 });
      withWriteContext({ participation: 'inspection' }, () => y(99));
      await flush();
      const p = t.transact(() =>
        mode === 'point' ? y(undefined) : a({ y: undefined, keep: 9 })
      );
      expect(Object.prototype.hasOwnProperty.call(a(), 'y')).toBe(true);
      expect(readOrdinaryMemberPresence(a, 'y')).toBe(true);
      expect(p.inspect().changes.some((c) => c.path === 'a.y')).toBe(true);
      p.rollback();
      expect(a()).toEqual({ keep: 9 });
      expect(readOrdinaryMemberPresence(a, 'y')).toBe(false);
      expect(a.y).toBe(y);
    } finally {
      t.destroy();
    }
  }
);
it('convergence removes exceptions without resetting retained source revision', async () => {
  const observed = vi.spyOn(OrdinaryMemberPresenceSource.prototype, 'prepare');
  const t = make();
  try {
    const a = t.$.a,
      y = a.y!;
    a({ keep: 9 });
    const source = observed.mock.contexts.at(-1);
    if (!(source instanceof OrdinaryMemberPresenceSource))
      throw new Error('No source owner');
    const initial = sourceFields(source);
    for (let i = 0; i < 4; i++) {
      withWriteContext({ participation: 'inspection' }, () => y(99));
      expect(sourceFields(source).size).toBe(1);
      const p = t.transact(() => y(7));
      expect(sourceFields(source).size).toBe(0);
      p.rollback();
      expect(a()).toEqual({ keep: 9 });
      expect(sourceFields(source).size).toBe(0);
    }
    expect(sourceFields(source).revision).toBeGreaterThan(initial.revision);
    expect(a.y).toBe(y);
  } finally {
    observed.mockRestore();
    t.destroy();
  }
});
for (const mode of ['throw', 'reentry'] as const)
  it(`post-plan membership ${mode} preserves actual prior scalar unit and useful recovery`, async () => {
    const t = make();
    try {
      const a = t.$.a,
        y = a.y!;
      a({ keep: 9 });
      withWriteContext({ participation: 'inspection' }, () => y(99));
      await flush();
      const original = OrdinaryMemberPresenceSource.prototype.prepare;
      const sentinel = new Error('controlled presence preparation');
      let entered = false;
      const spy = vi
        .spyOn(OrdinaryMemberPresenceSource.prototype, 'prepare')
        .mockImplementation(function (
          this: OrdinaryMemberPresenceSource,
          key,
          child,
          before,
          after,
          inspection
        ) {
          const edit = original.call(
            this,
            key,
            child,
            before,
            after,
            inspection
          );
          if (!entered && !inspection) {
            entered = true;
            if (mode === 'throw') throw sentinel;
            withWriteContext({ participation: 'realized' }, () => y(7));
          }
          return edit;
        });
      let failure: unknown;
      try {
        t.transact(() => y(7));
      } catch (error) {
        failure = error;
      } finally {
        spy.mockRestore();
      }
      expect(entered).toBe(true);
      if (mode === 'throw') expect(failure).toBe(sentinel);
      else expect(failure).toBeInstanceOf(Error);
      expect(y()).toBe(7);
      expect(readOrdinaryMemberPresence(a, 'y')).toBe(mode === 'reentry');
      expect(peekInternalTransactionRuntime(t)!.getPendingTurnCount()).toBe(0);
      const next = t.transact(() => y(8));
      expect(next.inspect().changes.length).toBeGreaterThan(0);
      next.rollback();
      expect(readOrdinaryMemberPresence(a, 'y')).toBe(mode === 'reentry');
      expect(a()).toEqual(mode === 'reentry' ? { y: 7, keep: 9 } : { keep: 9 });
    } finally {
      t.destroy();
    }
  });

it('unrelated parent ordinary-only adoption does not invalidate local preparation', async () => {
  const observed = vi.spyOn(OrdinaryMemberPresenceSource.prototype, 'prepare');
  const t = signalTree(
    {
      a: { y: 7, keep: 9 } as { y?: number; keep?: number },
      b: { y: 7, keep: 9 } as { y?: number; keep?: number },
    },
    { enhancers: [transactions()] }
  );
  try {
    const a = t.$.a,
      b = t.$.b,
      ay = a.y!,
      by = b.y!;
    a({ keep: 9 });
    const aSource = observed.mock.contexts.at(-1);
    b({ keep: 9 });
    withWriteContext({ participation: 'inspection' }, () => {
      ay(7);
      by(7);
    });
    observed.mockRestore();
    const original = OrdinaryMemberPresenceSource.prototype.prepare;
    let entered = false;
    const spy = vi
      .spyOn(OrdinaryMemberPresenceSource.prototype, 'prepare')
      .mockImplementation(function (
        this: OrdinaryMemberPresenceSource,
        ...args
      ) {
        const edit = original.apply(this, args);
        if (this === aSource && !entered && !args[4]) {
          entered = true;
          withWriteContext({ participation: 'realized' }, () => by(7));
        }
        return edit;
      });
    let p: ReturnType<typeof t.transact>;
    try {
      p = t.transact(() => ay(7));
    } finally {
      spy.mockRestore();
    }
    expect(entered).toBe(true);
    expect(readOrdinaryMemberPresence(a, 'y')).toBe(true);
    expect(readOrdinaryMemberPresence(b, 'y')).toBe(true);
    p.rollback();
    expect(a()).toEqual({ keep: 9 });
    expect(b()).toEqual({ y: 7, keep: 9 });
  } finally {
    observed.mockRestore();
    t.destroy();
  }
});
it('rich membership capture failure aborts through already-installed existence responsibility', async () => {
  const t = make();
  try {
    const a = t.$.a,
      y = a.y!;
    a({ keep: 9 });
    withWriteContext({ participation: 'inspection' }, () => y(99));
    await flush();
    const notifier = getPathNotifier(),
      original = notifier.notify;
    const sentinel = new Error('controlled rich membership capture');
    let entered = false;
    const spy = vi
      .spyOn(notifier, 'notify')
      .mockImplementation(function (this: typeof notifier, ...args) {
        if (
          !entered &&
          args[0] === 'a' &&
          args[1] === undefined &&
          args[2] === undefined
        ) {
          entered = true;
          throw sentinel;
        }
        return original.apply(this, args);
      });
    let failure: unknown;
    try {
      t.transact(() => y(7));
    } catch (error) {
      failure = error;
    } finally {
      spy.mockRestore();
    }
    expect(entered).toBe(true);
    expect(failure).toBe(sentinel);
    expect(a()).toEqual({ keep: 9 });
    expect(readOrdinaryMemberPresence(a, 'y')).toBe(false);
    expect(peekInternalTransactionRuntime(t)!.getPendingTurnCount()).toBe(0);
    const next = t.transact(() => y(8));
    expect(next.inspect().changes.some((c) => c.path === 'a.y')).toBe(true);
    next.rollback();
    expect(a()).toEqual({ keep: 9 });
  } finally {
    t.destroy();
  }
});
