import { describe, expect, it, vi } from 'vitest';
import { PlainCell, createPlainAdapter, isPlainCell } from '@signal-tree/core';
import type { Route } from '@signal-tree/core';
import { conformanceCases } from '@signal-tree/core/adapter';

const plainHarness = {
  write: (cell: unknown, value: unknown) => (cell as PlainCell<unknown>).set(value),
  observe: (cell: unknown, onChange: () => void) => (cell as PlainCell<unknown>).subscribe(onChange),
};

describe('plain adapter conformance', () => {
  for (const c of conformanceCases(createPlainAdapter(), plainHarness)) it(c.name, c.run);
});

describe('plain cell', () => {
  const routeTo = (adapter = createPlainAdapter()) => {
    const route: Route = (cell, next) => adapter.commit(cell as PlainCell<unknown>, next);
    return { adapter, route };
  };

  it('update passes the current value and routes the result', () => {
    const routed: unknown[] = [];
    const adapter = createPlainAdapter();
    const cell = adapter.createCell(2, (_cell, next) => routed.push(next));
    cell.update((n) => n * 10);
    expect(routed).toEqual([20]);
    expect(cell.get()).toBe(2);
  });

  it('notifies subscribers after a commit, and stops after unsubscribe', () => {
    const { adapter, route } = routeTo();
    const cell = adapter.createCell(1, route);
    const seen: number[] = [];
    const stop = cell.subscribe(() => seen.push(cell.get()));
    cell.set(2);
    stop();
    stop();
    cell.set(3);
    expect(seen).toEqual([2]);
  });

  it('defers notifications to the end of the outermost batch and notifies each cell once', () => {
    const { adapter, route } = routeTo();
    const a = adapter.createCell(0, route);
    const runs = vi.fn();
    a.subscribe(runs);
    adapter.batch(() => {
      a.set(1);
      adapter.batch(() => a.set(2));
      expect(runs).not.toHaveBeenCalled();
    });
    expect(runs).toHaveBeenCalledTimes(1);
    expect(a.get()).toBe(2);
  });

  it('notifies a write made by a subscriber during a flush in the same flush', () => {
    const { adapter, route } = routeTo();
    const a = adapter.createCell(0, route);
    const b = adapter.createCell(0, route);
    a.subscribe(() => b.set(a.get() + 1));
    const seen: number[] = [];
    b.subscribe(() => seen.push(b.get()));
    adapter.batch(() => a.set(5));
    expect(seen).toEqual([6]);
  });

  it('keeps notifying the other subscribers when one throws, and reports the error', () => {
    const errors: unknown[] = [];
    const { adapter, route } = routeTo(createPlainAdapter({ onListenerError: (e) => errors.push(e) }));
    const cell = adapter.createCell(0, route);
    const boom = new Error('boom');
    const after = vi.fn();
    cell.subscribe(() => {
      throw boom;
    });
    cell.subscribe(after);
    cell.set(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([boom]);
  });

  it('reports the error of a lone subscriber too, and can change where errors go', () => {
    const first: unknown[] = [];
    const second: unknown[] = [];
    const { adapter, route } = routeTo(createPlainAdapter({ onListenerError: (e) => first.push(e) }));
    const cell = adapter.createCell(0, route);
    cell.subscribe(() => {
      throw new Error('x');
    });
    cell.set(1);
    adapter.setListenerErrorHandler((e) => second.push(e));
    cell.set(2);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it('rethrows a subscriber error asynchronously by default', async () => {
    const { adapter, route } = routeTo();
    const cell = adapter.createCell(0, route);
    const boom = new Error('async boom');
    cell.subscribe(() => {
      throw boom;
    });
    const caught = new Promise((resolve) => {
      const original = globalThis.queueMicrotask;
      globalThis.queueMicrotask = (task) => {
        globalThis.queueMicrotask = original;
        try {
          task();
        } catch (error) {
          resolve(error);
        }
      };
    });
    cell.set(1);
    await expect(caught).resolves.toBe(boom);
  });

  it('isPlainCell recognises plain cells only', () => {
    const adapter = createPlainAdapter();
    expect(isPlainCell(adapter.createCell(1, () => {}))).toBe(true);
    expect(isPlainCell({ get() {}, set() {} })).toBe(false);
  });

  it('notifies after a batch whose body throws, then rethrows', () => {
    const { adapter, route } = routeTo();
    const cell = adapter.createCell(0, route);
    const runs = vi.fn();
    cell.subscribe(runs);
    expect(() =>
      adapter.batch(() => {
        cell.set(1);
        throw new Error('body');
      }),
    ).toThrow('body');
    expect(runs).toHaveBeenCalledTimes(1);
  });
});
