import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalTreeError, SignalTreeRefusal, signalTree } from '@signal-tree/core';
import type { Interceptor, ObserveListener, Plugin, ScopeHandle, TreeErrorEvent, TurnInfo, WriteEffect } from '@signal-tree/core';

/** A plugin that hands its scope to the test. */
function probe(onAttach: (scope: ScopeHandle) => void, api: object = {}): Plugin<object> & { detached: number } {
  const plugin = {
    name: 'probe',
    detached: 0,
    attach(scope: ScopeHandle) {
      onAttach(scope);
      return { api, detach: () => plugin.detached++ };
    },
  };
  return plugin;
}

describe('observers', () => {
  it('see each turn once, with every effect and its writer context', () => {
    const calls: { effects: readonly WriteEffect[]; turn: TurnInfo }[] = [];
    const tree = signalTree({ a: 1, b: { c: 1 } }, { plugins: [probe((s) => s.observe((effects, turn) => calls.push({ effects, turn })))] });
    tree.turn(() => {
      tree.$.a.set(2);
      tree.$.b.c.set(2);
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.effects.map((e) => [e.location, e.before, e.after, e.changed])).toEqual([
      [['a'], 1, 2, true],
      [['b', 'c'], 1, 2, true],
    ]);
    const context = calls[0]!.effects[0]!.context;
    expect(context.writer).toBe('user');
    expect(context.turn).toBe(calls[0]!.turn.turn);
    expect(calls[0]!.turn.context.writer).toBe('user');
  });

  it('see a bare write as its own turn, and nothing for a skipped write', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = signalTree({ a: 1 }, { plugins: [probe((s) => s.observe(listener))] });
    tree.$.a.set(1);
    expect(listener).not.toHaveBeenCalled();
    tree.$.a.set(2);
    tree.$.a.set(3);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]![1].turn.id).not.toBe(listener.mock.calls[1]![1].turn.id);
  });

  it('see a whole-value branch write as one effect at the branch', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = signalTree({ user: { name: 'Ada', age: 1 } }, { plugins: [probe((s) => s.observe(listener))] });
    tree.$.user.update((u) => ({ ...u, age: 2 }));
    const [effects] = listener.mock.calls[0]!;
    expect(effects).toHaveLength(1);
    expect(effects[0]!.location).toEqual(['user']);
    expect(effects[0]!.before).toEqual({ name: 'Ada', age: 1 });
    expect(effects[0]!.after).toEqual({ name: 'Ada', age: 2 });
    tree.$.user.set({ name: 'Ada', age: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('see nothing from a turn that throws', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = signalTree({ a: 1 }, { plugins: [probe((s) => s.observe(listener))] });
    expect(() =>
      tree.turn(() => {
        tree.$.a.set(2);
        throw new Error('no');
      }),
    ).toThrow('no');
    expect(listener).not.toHaveBeenCalled();
    expect(tree.$.a.get()).toBe(1);
  });

  it('publish a write an observer makes as its own turn, after the turn being published', () => {
    const order: string[] = [];
    let scope!: ScopeHandle;
    const tree = signalTree({ a: 0, echo: 0 }, { plugins: [probe((s) => (scope = s))] });
    scope.observe((effects, turn) => {
      order.push(`first:${turn.turn.id}:${effects.map((e) => e.location.join('.')).join(',')}`);
      if (effects.some((e) => e.location[0] === 'a')) tree.as({ writer: 'observer', origin: 'sync' }, () => tree.$.echo.set(tree.$.a.get()));
    });
    scope.observe((effects, turn) => order.push(`second:${turn.turn.id}:${effects[0]!.context.writer}`));
    tree.$.a.set(5);
    expect(tree.$.echo.get()).toBe(5);
    expect(order).toEqual(['first:1:a', 'second:1:user', 'first:2:echo', 'second:2:observer']);
  });

  it('keep running when one throws, and report it to onTreeError with ST2034, the tree id and the scope path', () => {
    const events: TreeErrorEvent[] = [];
    const after = vi.fn();
    let scope!: ScopeHandle;
    const tree = signalTree({ s: { a: 1 } }, { onTreeError: (e) => events.push(e) });
    tree.$.s.use(probe((s) => (scope = s)));
    scope.observe(() => {
      throw new Error('observer broke');
    });
    scope.observe(after);
    expect(() => tree.$.s.a.set(2)).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.code).toBe('ST2034');
    expect(events[0]!.treeId).toBe(tree.id);
    expect(events[0]!.path).toEqual(['s']);
    expect(events[0]!.error).toBeInstanceOf(SignalTreeError);
    expect((events[0]!.error.cause as Error).message).toBe('observer broke');
  });

  it('stop after unsubscribing', () => {
    const listener = vi.fn();
    let stop!: () => void;
    const tree = signalTree({ a: 1 }, { plugins: [probe((s) => (stop = s.observe(listener)))] });
    stop();
    stop();
    tree.$.a.set(2);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the error channel', () => {
  afterEach(() => vi.useRealTimers());

  it('reports at most 50 observer errors a second, then how many were suppressed', () => {
    vi.useFakeTimers();
    const events: TreeErrorEvent[] = [];
    const tree = signalTree({ a: 0 }, { onTreeError: (e) => events.push(e), plugins: [probe((s) => s.observe(() => {
      throw new Error('x');
    }))] });
    for (let i = 1; i <= 60; i++) tree.$.a.set(i);
    expect(events.filter((e) => e.code === 'ST2034')).toHaveLength(50);
    vi.advanceTimersByTime(1000);
    const summary = events.filter((e) => e.code === 'ST2035');
    expect(summary).toHaveLength(1);
    expect(summary[0]!.error.message).toContain('10 more');
    tree.$.a.set(100);
    expect(events.filter((e) => e.code === 'ST2034')).toHaveLength(51);
  });

  it('reports suppressed errors when the next window opens, and survives a throwing handler', () => {
    const now = vi.spyOn(Date, 'now');
    let t = 10_000;
    now.mockImplementation(() => t);
    const codes: string[] = [];
    const tree = signalTree({ a: 0 }, { onTreeError: (e) => {
      codes.push(e.code);
      throw new Error('handler broke');
    }, plugins: [probe((s) => s.observe(() => {
      throw new Error('x');
    }))] });
    for (let i = 1; i <= 51; i++) tree.$.a.set(i);
    t += 1500;
    tree.$.a.set(0);
    expect(codes.slice(-2)).toEqual(['ST2035', 'ST2034']);
    now.mockRestore();
  });

  it('reports subscriber errors of the tree’s own cells', () => {
    const events: TreeErrorEvent[] = [];
    const tree = signalTree({ a: 0 }, { onTreeError: (e) => events.push(e) });
    tree.$.a.subscribe(() => {
      throw new Error('sub');
    });
    tree.$.a.set(1);
    expect(events.map((e) => e.code)).toEqual(['ST2034']);
  });

  it('gives each live tree its own id', () => {
    expect(signalTree({}).id).not.toBe(signalTree({}).id);
  });

  it('logs to console.error by default', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tree = signalTree({ a: 0 }, { plugins: [probe((s) => s.observe(() => {
      throw new Error('x');
    }))] });
    tree.$.a.set(1);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

describe('interceptors', () => {
  const tap = (name: string, log: string[]): Interceptor => ({
    name,
    intercept(op, next) {
      log.push(`${name}:${op.location.join('.')}`);
      return next(op);
    },
  });

  it('run outermost first for writes in their scope only', () => {
    const log: string[] = [];
    const tree = signalTree({ outer: { inner: { x: 1 }, y: 1 }, z: 1 });
    tree.$.outer.use(probe((s) => s.intercept(tap('outer', log))));
    tree.$.outer.inner.use(probe((s) => s.intercept(tap('inner', log))));
    tree.$.outer.inner.x.set(2);
    tree.$.outer.y.set(2);
    tree.$.z.set(2);
    expect(log).toEqual(['outer:outer.inner.x', 'inner:outer.inner.x', 'outer:outer.y']);
  });

  it('cover branches read before the scope was attached', () => {
    const log: string[] = [];
    const tree = signalTree({ a: { b: { c: 1 } } });
    const c = tree.$.a.b.c;
    tree.$.a.use(probe((s) => s.intercept(tap('a', log))));
    c.set(2);
    expect(log).toEqual(['a:a.b.c']);
  });

  it('may refuse a write, which then changes nothing and reaches the writer', () => {
    const tree = signalTree({ a: 1, b: { c: 1 } });
    const refuse: Interceptor = {
      name: 'refuse',
      intercept() {
        throw new SignalTreeRefusal('ST1004', { detail: 'no' });
      },
    };
    tree.$.b.use(probe((s) => s.intercept(refuse)));
    expect(() => tree.$.b.c.set(2)).toThrow(SignalTreeRefusal);
    expect(() => tree.$.b.set({ c: 3 })).toThrow(SignalTreeRefusal);
    expect(tree.$.b.get()).toEqual({ c: 1 });
  });

  it('may transform a write; the transformed value is copied', () => {
    const tree = signalTree({ s: { v: 0 as unknown } });
    const shared = { n: 1 };
    tree.$.s.use(probe((s) => s.intercept({ name: 'double', intercept: (op, next) => next({ ...op, next: typeof op.next === 'number' ? op.next * 2 : shared }) })));
    tree.$.s.v.set(4);
    expect(tree.$.s.v.get()).toBe(8);
    tree.$.s.v.set('x');
    expect(tree.$.s.v.get()).toEqual({ n: 1 });
    expect(tree.$.s.v.get()).not.toBe(shared);
  });

  it('may call next() only once', () => {
    const tree = signalTree({ s: { v: 0 } });
    tree.$.s.use(probe((s) => s.intercept({ name: 'twice', intercept: (op, next) => {
      next(op);
      return next(op);
    } })));
    expect(() => tree.$.s.v.set(1)).toThrow(/ST1008.*twice/);
  });

  it('see the kind, the writer context and the turn', () => {
    const ops: unknown[] = [];
    const tree = signalTree({ s: { v: 0, w: { x: 1 } } });
    tree.$.s.use(probe((s) => s.intercept({ name: 'log', intercept: (op, next) => {
      ops.push([op.kind, op.context.writer, op.context.origin, typeof op.context.turn?.id]);
      return next(op);
    } })));
    tree.as({ writer: 'agent:planner', origin: 'agent' }, () => tree.$.s.v.set(1));
    tree.$.s.w.update(() => ({ x: 2 }));
    expect(ops).toEqual([
      ['set', 'agent:planner', 'agent', 'number'],
      ['update', 'user', 'user', 'number'],
    ]);
  });

  it('stop after removal', () => {
    const log: string[] = [];
    let remove!: () => void;
    const tree = signalTree({ a: 1 }, { plugins: [probe((s) => (remove = s.intercept(tap('t', log))))] });
    remove();
    remove();
    tree.$.a.set(2);
    expect(log).toEqual([]);
  });

  it('see a write to an absent member, whose effect is a change', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = signalTree({ s: { a: 1 } as Record<string, number> }, { plugins: [probe((s) => s.observe(listener))] });
    tree.$.s['b']!.set(undefined as unknown as number);
    expect(listener.mock.calls[0]![0][0]!.changed).toBe(true);
    expect(tree.$.s.get()).toEqual({ a: 1, b: undefined });
  });
});

describe('writer context', () => {
  it('as() attributes writes, restores the previous context, and returns the result', () => {
    const writers: string[] = [];
    const tree = signalTree({ a: 0 }, { plugins: [probe((s) => s.observe((effects) => writers.push(effects[0]!.context.writer)))] });
    const result = tree.as({ writer: 'agent:a', origin: 'agent', meta: { run: 1 } }, () => {
      tree.$.a.set(1);
      tree.as({ writer: 'sync:b', origin: 'sync' }, () => tree.$.a.set(2));
      tree.$.a.set(3);
      return 'ok';
    });
    tree.$.a.set(4);
    expect(result).toBe('ok');
    expect(writers).toEqual(['agent:a', 'sync:b', 'agent:a', 'user']);
  });

  it('restores the context when the callback throws', () => {
    const writers: string[] = [];
    const tree = signalTree({ a: 0 }, { plugins: [probe((s) => s.observe((effects) => writers.push(effects[0]!.context.writer)))] });
    expect(() => tree.as({ writer: 'agent:a', origin: 'agent' }, () => {
      throw new Error('x');
    })).toThrow('x');
    tree.$.a.set(1);
    expect(writers).toEqual(['user']);
  });

  it('refuses async callbacks and callbacks that return a promise', () => {
    const tree = signalTree({ a: 0 });
    expect(() => tree.as({ writer: 'w', origin: 'agent' }, async () => {})).toThrow(/ST1005/);
    expect(() => tree.as({ writer: 'w', origin: 'agent' }, () => Promise.resolve(1))).toThrow(/ST1005/);
    expect(() => tree.as({ writer: 'w', origin: 'agent' }, 1 as never)).toThrow(/ST1006/);
  });

  it('refuses a malformed context', () => {
    const tree = signalTree({ a: 0 });
    for (const bad of [null, {}, { writer: '', origin: 'x' }, { writer: 'w' }, { writer: 'w', origin: 3 }]) {
      expect(() => tree.as(bad as never, () => {})).toThrow(/ST1007/);
    }
  });
});

describe('plugins', () => {
  it('join the tree with their APIs and refuse a name clash', () => {
    const tree = signalTree({ a: 1 }, { plugins: [probe(() => {}, { hello: () => 'hi' })] });
    expect((tree as unknown as { hello(): string }).hello()).toBe('hi');
    expect(() => signalTree({ a: 1 }, { plugins: [probe(() => {}, { turn: 1 })] })).toThrow(/ST1009/);
    expect(() => signalTree({ a: 1 }, { plugins: [probe(() => {}, null as never)] })).not.toThrow();
  });

  it('use() returns the API, gives the scope its path and snapshot, and refuses a non-plugin', () => {
    let scope!: ScopeHandle;
    const tree = signalTree({ orders: { open: 2 } });
    const api = tree.$.orders.use(probe((s) => (scope = s), { size: 1 }));
    expect(api).toEqual({ size: 1 });
    expect(scope.path).toEqual(['orders']);
    expect(scope.snapshot()).toEqual({ open: 2 });
    expect(() => tree.$.orders.use({} as never)).toThrow(/ST1006/);
  });

  it('are detached and disposed on destroy; teardown errors reach onTreeError', () => {
    const events: TreeErrorEvent[] = [];
    const disposed = vi.fn();
    const listener = vi.fn();
    const good = probe((s) => {
      s.onDispose(disposed);
      s.observe(listener);
    });
    const bad = {
      name: 'bad',
      attach(s: ScopeHandle) {
        s.onDispose(() => {
          throw new Error('dispose');
        });
        return { api: {}, detach: () => {
          throw new Error('detach');
        } };
      },
    };
    const tree = signalTree({ a: 1 }, { plugins: [good, bad], onTreeError: (e) => events.push(e) });
    tree.destroy();
    expect(good.detached).toBe(1);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(events.map((e) => e.code)).toEqual(['ST2036', 'ST2036']);
    expect(() => tree.$.a.set(2)).toThrow(/ST1003/);
    expect(() => tree.as({ writer: 'w', origin: 'agent' }, () => {})).toThrow(/ST1003/);
  });

  it('a second plugin on the same branch shares its scope', () => {
    const log: string[] = [];
    const tree = signalTree({ s: { v: 0 } });
    tree.$.s.use(probe((s) => s.intercept({ name: 'one', intercept: (op, next) => (log.push('one'), next(op)) })));
    tree.$.s.use(probe((s) => s.intercept({ name: 'two', intercept: (op, next) => (log.push('two'), next(op)) })));
    tree.$.s.v.set(1);
    expect(log).toEqual(['one', 'two']);
  });
});

