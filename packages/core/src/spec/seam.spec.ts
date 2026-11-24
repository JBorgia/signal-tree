/**
 * Spec tests for observation, turns, isolation, disposal and errors: BRIEF.md
 * 5.1 row X1 and 12.4–12.5 rows O1–O4, X3, D1, W5, V8, T13 and X6. Written
 * from the spec; each title carries the row it proves.
 */
import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, SignalTreeError, SignalTreeRefusal, entityMap, signalTree } from '@signal-tree/core';
import type { ObserveListener, Plugin, ScopeHandle, TreeErrorEvent, TreeOptions, TurnInfo, WriteEffect } from '@signal-tree/core';

interface Row {
  id: number;
  a: number;
  b: number;
}

/** A plugin that only hands its scope to the test. */
function scopeOf(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'scope-probe', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

const app = (options: TreeOptions<'plain', readonly Plugin<object>[]> = {}) =>
  signalTree(
    {
      form: { name: 'Ada', email: 'ada@x' },
      count: 0,
      rows: entityMap<Row, number>({ rows: [{ id: 1, a: 1, b: 1 }, { id: 2, a: 2, b: 2 }] }),
    },
    options,
  );

describe('fine-grained observation', () => {
  it('[O1] a reader re-runs only when a location it read changed', () => {
    const tree = app();
    const name = vi.fn();
    tree.$.form.name.subscribe(name);
    tree.$.form.email.set('a@y');
    tree.$.count.set(1);
    expect(name).not.toHaveBeenCalled();
    tree.$.form.name.set('Grace');
    expect(name).toHaveBeenCalledTimes(1);
  });

  it('[O1] a write the seam skips as unchanged re-runs nothing', () => {
    const tree = app();
    const name = vi.fn();
    const field = vi.fn();
    tree.$.form.name.subscribe(name);
    tree.$.rows.byId(1)!.a.subscribe(field);
    tree.$.form.name.set('Ada');
    tree.$.form.set({ name: 'Ada', email: 'ada@x' });
    tree.$.rows.updateOne(1, { a: 1 });
    tree.$.rows.byId(1)!.a.set(1);
    expect(name).not.toHaveBeenCalled();
    expect(field).not.toHaveBeenCalled();
  });

  it('[O1] a row or byId reader does not re-run for writes to other rows', () => {
    const tree = app();
    const rowOne = vi.fn();
    const row = tree.$.rows.byId(1)!;
    row.a.subscribe(rowOne);
    row.b.subscribe(rowOne);
    tree.$.rows.updateOne(2, { a: 20, b: 20 });
    tree.$.rows.byId(2)!.a.set(21);
    tree.$.rows.addOne({ id: 3, a: 3, b: 3 });
    tree.$.rows.removeOne(3);
    expect(rowOne).not.toHaveBeenCalled();
    tree.$.rows.updateOne(1, { a: 10 });
    expect(rowOne).toHaveBeenCalledTimes(1);
  });

  it('[O1] a turn whose writes net to no change re-runs no reader', () => {
    const tree = app();
    const count = vi.fn();
    tree.$.count.subscribe(count);
    tree.turn(() => {
      tree.$.count.set(5);
      tree.$.count.set(0);
    });
    expect(count).not.toHaveBeenCalled();
  });
});

describe('turn atomicity for observers', () => {
  it('[O2] every observer runs at most once per turn and never sees part of it applied', () => {
    const seen: string[] = [];
    const turns: TurnInfo[] = [];
    let scope!: ScopeHandle;
    const tree = app({ plugins: [scopeOf((s) => (scope = s))] });
    const read = () => `${tree.$.form.name.get()}|${tree.$.form.email.get()}|${tree.$.count.get()}`;
    tree.$.form.name.subscribe(() => seen.push(`name:${read()}`));
    tree.$.count.subscribe(() => seen.push(`count:${read()}`));
    scope.observe((_effects, turn) => {
      turns.push(turn);
      seen.push(`plugin:${read()}`);
    });
    tree.turn(() => {
      tree.$.form.name.set('Grace');
      tree.$.form.email.set('g@x');
      tree.$.count.set(1);
      tree.$.count.set(2);
    });
    expect(seen).toEqual(['name:Grace|g@x|2', 'count:Grace|g@x|2', 'plugin:Grace|g@x|2']);
    expect(turns).toHaveLength(1);
  });

  it('[O2] a whole-value branch write and each entity call are one change each', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = app({ plugins: [scopeOf((s) => s.observe(listener))] });
    const email = vi.fn();
    tree.$.form.email.subscribe(email);
    tree.$.form.set({ name: 'Grace', email: 'g@x' });
    tree.$.rows.updateMany([{ id: 1, changes: { a: 9 } }, { id: 2, changes: { a: 9 } }]);
    tree.$.rows.setAll([{ id: 2, a: 0, b: 0 }]);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('[O2] one chunk of an ingest is one change', async () => {
    const listener = vi.fn<ObserveListener>();
    const tree = app({ plugins: [scopeOf((s) => s.observe(listener))] });
    await tree.$.rows.setAll(Array.from({ length: 6 }, (_, i) => ({ id: i + 10, a: 0, b: 0 })), { chunk: 3 });
    const turnIds = listener.mock.calls.map(([, turn]) => turn.turn.id);
    expect(new Set(turnIds).size).toBe(turnIds.length);
    expect(listener.mock.calls.slice(-2).map(([effects]) => effects.length)).toEqual([3, 3]);
  });
});

describe('read-path consistency', () => {
  it('[O3] after every turn, leaf, row field, byId, all(), ids(), count() and snapshot agree', () => {
    const tree = app();
    let seed = 7;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const agree = () => {
      const snap = tree.$.get();
      expect(snap.count).toBe(tree.$.count.get());
      expect(snap.form).toEqual({ name: tree.$.form.name.get(), email: tree.$.form.email.get() });
      expect(snap.rows).toEqual(tree.$.rows.all());
      expect(tree.$.rows.ids()).toEqual(tree.$.rows.all().map((r) => r.id));
      expect(tree.$.rows.count()).toBe(tree.$.rows.all().length);
      for (const row of tree.$.rows.all()) {
        const handle = tree.$.rows.byId(row.id)!;
        expect(handle.get()).toEqual(row);
        expect(handle.a.get()).toBe(row.a);
        expect(handle.b.get()).toBe(row.b);
      }
    };
    for (let step = 0; step < 300; step++) {
      const id = random(6) + 1;
      tree.turn(() => {
        switch (random(7)) {
          case 0:
            tree.$.count.set(random(5));
            break;
          case 1:
            tree.$.form.set({ name: `n${random(3)}`, email: `e${random(3)}` });
            break;
          case 2:
            if (!tree.$.rows.byId(id)) tree.$.rows.addOne({ id, a: random(9), b: random(9) });
            break;
          case 3:
            if (tree.$.rows.byId(id)) tree.$.rows.removeOne(id);
            break;
          case 4:
            if (tree.$.rows.byId(id)) tree.$.rows.byId(id)!.a.set(random(9));
            break;
          case 5:
            tree.$.rows.upsertOne({ id, a: random(9), b: random(9) });
            break;
          default:
            tree.$.rows.setAll(tree.$.rows.all().slice().reverse());
        }
      });
      agree();
    }
  });
});

describe('reentrant writes', () => {
  it('[O4] a write an observer makes while a turn is published is applied after it, as its own turn, in the observer’s writer context', () => {
    const published: { turn: number; locations: string[]; writers: string[] }[] = [];
    let scope!: ScopeHandle;
    const tree = app({ plugins: [scopeOf((s) => (scope = s))] });
    scope.observe((effects, turn) => {
      published.push({ turn: turn.turn.id, locations: effects.map((e) => e.location.join('.')), writers: effects.map((e) => e.context.writer) });
      if (effects.some((e) => e.location[0] === 'form')) tree.as({ writer: 'observer:counter', origin: 'agent' }, () => tree.$.count.update((n) => n + 1));
    });
    tree.$.form.name.set('Grace');
    expect(published).toEqual([
      { turn: published[0]!.turn, locations: ['form.name'], writers: ['user'] },
      { turn: published[1]!.turn, locations: ['count'], writers: ['observer:counter'] },
    ]);
    expect(published[1]!.turn).not.toBe(published[0]!.turn);
    expect(tree.$.count.get()).toBe(1);
  });

  it('[O4] a write a subscriber makes during a turn’s notifications is never merged into that turn', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = app({ plugins: [scopeOf((s) => s.observe(listener))] });
    tree.$.form.name.subscribe(() => tree.$.count.set(tree.$.count.get() + 1));
    tree.turn(() => tree.$.form.name.set('Grace'));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]![0].map((e) => e.location.join('.'))).toEqual(['form.name']);
    expect(listener.mock.calls[1]![0].map((e) => e.location.join('.'))).toEqual(['count']);
    expect(tree.$.count.get()).toBe(1);
  });
});

describe('fault containment', () => {
  it('[X3] when an observer throws, every other observer still runs, state stays consistent, and the writer sees no error', () => {
    const events: TreeErrorEvent[] = [];
    const others = vi.fn();
    let scope!: ScopeHandle;
    const tree = app({ plugins: [scopeOf((s) => (scope = s))], onTreeError: (e) => events.push(e) });
    scope.observe(() => {
      throw new Error('plugin observer');
    });
    scope.observe(others);
    tree.$.count.subscribe(() => {
      throw new Error('subscriber');
    });
    tree.$.count.subscribe(others);
    expect(() =>
      tree.turn(() => {
        tree.$.count.set(1);
        tree.$.rows.updateOne(1, { a: 5 });
      }),
    ).not.toThrow();
    expect(others).toHaveBeenCalledTimes(2);
    expect(tree.$.count.get()).toBe(1);
    expect(tree.$.get().rows[0]!.a).toBe(5);
    expect(events.map((e) => e.code)).toEqual(['ST2034', 'ST2034']);
    expect(events.every((e) => e.error instanceof SignalTreeError)).toBe(true);
  });
});

describe('error attribution', () => {
  it('[X6] every onTreeError event carries the tree’s id, stable for its lifetime and distinct between live trees, and the location', () => {
    const events: TreeErrorEvent[] = [];
    const make = () => {
      let scope!: ScopeHandle;
      const tree = signalTree({ panel: { v: 0 }, other: 0 }, { onTreeError: (e) => events.push(e) });
      tree.$.panel.use(scopeOf((s) => (scope = s)));
      scope.observe(() => {
        throw new Error('x');
      });
      return tree;
    };
    const one = make();
    const two = make();
    one.$.panel.v.set(1);
    two.$.panel.v.set(1);
    one.$.panel.v.set(2);
    expect(events.map((e) => e.treeId)).toEqual([one.id, two.id, one.id]);
    expect(one.id).not.toBe(two.id);
    expect(events.every((e) => JSON.stringify(e.path) === '["panel"]')).toBe(true);
  });
});

describe('synchronous context', () => {
  it('[W5] a writer context never carries across an await', async () => {
    const writers: string[] = [];
    const tree = app({ plugins: [scopeOf((s) => s.observe((effects) => writers.push(effects[0]!.context.writer)))] });
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => (resume = resolve));
    const later = (async () => {
      await gate;
      tree.$.count.set(2);
    })();
    tree.as({ writer: 'agent:a', origin: 'agent' }, () => {
      tree.$.count.set(1);
      resume();
    });
    await later;
    expect(writers).toEqual(['agent:a', 'user']);
  });

  it('[W5] turn membership never carries across an await', async () => {
    const turns: number[] = [];
    const tree = app({ plugins: [scopeOf((s) => s.observe((_e, turn) => turns.push(turn.turn.id)))] });
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => (resume = resolve));
    const later = (async () => {
      await gate;
      tree.$.count.set(2);
    })();
    tree.turn(() => {
      tree.$.count.set(1);
      resume();
    });
    await later;
    expect(turns).toHaveLength(2);
    expect(turns[0]).not.toBe(turns[1]);
  });

  it('[W5] a context-setting scope refuses an async callback with a typed error', () => {
    const tree = app();
    expect(() => tree.as({ writer: 'agent:a', origin: 'agent' }, async () => tree.$.count.set(1))).toThrow(SignalTreeRefusal);
    expect(() => tree.as({ writer: 'agent:a', origin: 'agent' }, () => Promise.resolve())).toThrow(SignalTreeRefusal);
  });
});

describe('tree isolation', () => {
  it('[V8] two trees of the same or different shape share nothing observable', () => {
    const effectsOne: WriteEffect[] = [];
    const effectsTwo: WriteEffect[] = [];
    const one = app({ plugins: [scopeOf((s) => s.observe((e) => effectsOne.push(...e)))] });
    const two = app({ plugins: [scopeOf((s) => s.observe((e) => effectsTwo.push(...e)))] });
    const three = signalTree({ count: 0, other: { x: 1 } });
    const twoCount = vi.fn();
    two.$.count.subscribe(twoCount);
    one.turn(() => {
      one.$.count.set(5);
      one.$.rows.removeOne(1);
    });
    three.$.count.set(7);
    expect(two.$.count.get()).toBe(0);
    expect(two.$.rows.count()).toBe(2);
    expect(twoCount).not.toHaveBeenCalled();
    expect(effectsTwo).toEqual([]);
    expect(effectsOne).toHaveLength(2);
    expect(() =>
      one.turn(() => {
        two.$.count.set(9);
        throw new Error('only one reverts');
      }),
    ).toThrow();
    expect(two.$.count.get()).toBe(9);
  });

  it('[V8] destroying one tree leaves another, created before or after, untouched', () => {
    const before = app();
    const doomed = app();
    const after = app();
    doomed.destroy();
    before.$.count.set(1);
    after.$.count.set(2);
    expect(before.$.count.get()).toBe(1);
    expect(after.$.count.get()).toBe(2);
  });
});

describe('explicit turns', () => {
  it('[T13] inside tree.turn(fn) each write applies immediately and later reads in fn see it', () => {
    const tree = app();
    tree.turn(() => {
      tree.$.count.set(1);
      expect(tree.$.count.get()).toBe(1);
      tree.$.rows.updateOne(1, { a: 7 });
      expect(tree.$.rows.byId(1)!.a.get()).toBe(7);
      expect(tree.$.get().count).toBe(1);
    });
  });

  it('[T13] observers run once after fn', () => {
    const listener = vi.fn<ObserveListener>();
    const tree = app({ plugins: [scopeOf((s) => s.observe(listener))] });
    tree.turn(() => {
      tree.$.count.set(1);
      tree.$.form.name.set('Grace');
      expect(listener).not.toHaveBeenCalled();
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('[T13] the values and writer contexts after the turn equal those from the same writes without it', () => {
    const run = (grouped: boolean) => {
      const effects: WriteEffect[] = [];
      const tree = app({ plugins: [scopeOf((s) => s.observe((e) => effects.push(...e)))] });
      const writes = () => {
        tree.$.count.set(1);
        tree.as({ writer: 'agent:a', origin: 'agent' }, () => tree.$.rows.updateOne(2, { b: 9 }));
        tree.$.form.email.set('z@x');
      };
      if (grouped) tree.turn(writes);
      else writes();
      return { state: tree.$.get(), writers: effects.map((e) => `${e.location.join('.')}:${e.context.writer}`) };
    };
    expect(run(true)).toEqual(run(false));
  });

  it('[T13] if fn throws, every write in the turn is reverted, nothing is published, and the error is rethrown', () => {
    const listener = vi.fn<ObserveListener>();
    const subscriber = vi.fn();
    const tree = app({ plugins: [scopeOf((s) => s.observe(listener))] });
    tree.$.count.subscribe(subscriber);
    const before = tree.$.get();
    const thrown = new Error('boom');
    let caught: unknown;
    try {
      tree.turn(() => {
        tree.$.count.set(1);
        tree.$.form.set({ name: 'Grace', email: 'g@x' });
        tree.$.rows.addOne({ id: 3, a: 3, b: 3 });
        tree.$.rows.changeId(1, 10);
        throw thrown;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(thrown);
    expect(tree.$.get()).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
  });
});

describe('disposal', () => {
  it('[D1] after destroy every read or write throws a typed error', () => {
    const tree = app();
    const name = tree.$.form.name;
    const form = tree.$.form;
    const rows = tree.$.rows;
    const field = rows.byId(1)!.a;
    tree.destroy();
    const attempts = [
      () => name.get(),
      () => name.set('x'),
      () => form.get(),
      () => form.set({ name: 'x', email: 'y' }),
      () => tree.$.count,
      () => rows.all(),
      () => rows.addOne({ id: 9, a: 0, b: 0 }),
      () => field.get(),
      () => field.set(1),
      () => tree.turn(() => {}),
      () => tree.as({ writer: 'w', origin: 'agent' }, () => {}),
    ];
    for (const attempt of attempts) expect(attempt).toThrow(SignalTreeError);
  });

  it('[D1] destroy releases every subscription and plugin; teardown errors reach onTreeError', () => {
    const events: TreeErrorEvent[] = [];
    const detached = vi.fn();
    const disposed = vi.fn();
    const listener = vi.fn();
    const good: Plugin<object> = { name: 'good', attach: (s) => (s.observe(listener), s.onDispose(disposed), { api: {}, detach: detached }) };
    const bad: Plugin<object> = {
      name: 'bad',
      attach: () => ({ api: {}, detach: () => {
        throw new Error('teardown');
      } }),
    };
    const tree = app({ plugins: [good, bad], onTreeError: (e) => events.push(e) });
    const subscriber = vi.fn();
    tree.$.count.subscribe(subscriber);
    tree.destroy();
    expect(detached).toHaveBeenCalledTimes(1);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.error).toBeInstanceOf(SignalTreeError);
    expect(events[0]!.treeId).toBe(tree.id);
    expect(subscriber).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('typed errors', () => {
  it('[X1] every refusal and error the core throws is a typed error carrying a published [ST####] code and naming its cause', () => {
    const tree = app();
    const failures: (() => unknown)[] = [
      () => signalTree(1 as never),
      () => tree.$.rows.addOne({ id: 1, a: 0, b: 0 }),
      () => tree.$.rows.removeOne(99),
      () => tree.$.rows.addOne({ id: null as never, a: 0, b: 0 }),
      () => tree.$.rows.addOne(new Date() as never),
      () => tree.as({ writer: '', origin: 'agent' }, () => {}),
      () => tree.as({ writer: 'w', origin: 'agent' }, async () => {}),
      () => tree.turn(1 as never),
      () => tree.$.form.set(JSON.parse('{"__proto__": {}}')),
      () => signalTree({ people: entityMap<{ k: string }, string>({ selectId: (p) => p.k }) }).$.people.changeId('a', 'b'),
    ];
    for (const failure of failures) {
      let error: unknown;
      try {
        failure();
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(SignalTreeError);
      const typed = error as SignalTreeError;
      expect(Object.keys(ERROR_CODES)).toContain(typed.code);
      expect(typed.message.startsWith(`[${typed.code}] ${ERROR_CODES[typed.code].message}`)).toBe(true);
      expect(typed.reason).toBe(ERROR_CODES[typed.code].cause);
    }
  });

  it('[X1] the published code table maps each code to one stable cause and message', () => {
    expect(ERROR_CODES).toMatchObject({
      ST1001: { cause: 'invalid-initial-state' },
      ST1002: { cause: 'prototype-key' },
      ST1003: { cause: 'tree-destroyed' },
      ST1010: { cause: 'duplicate-key' },
      ST1011: { cause: 'missing-key' },
      ST2034: { cause: 'observer-error' },
    });
    const causes = Object.values(ERROR_CODES).map((entry) => entry.cause);
    expect(new Set(causes).size).toBe(causes.length);
  });
});
