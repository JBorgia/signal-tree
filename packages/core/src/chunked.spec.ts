import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree } from '@signal-tree/core';
import type { ObserveListener, Plugin, ScopeHandle } from '@signal-tree/core';

interface Row {
  id: number;
  v: number;
}

const range = (from: number, to: number, v = 0): Row[] => Array.from({ length: to - from }, (_, i) => ({ id: from + i, v }));

function probe(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'probe', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

describe('setAll in chunks', () => {
  it('ends where a single setAll ends: rows replaced, handles kept, input order', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 10) }) });
    const five = tree.$.rows.byId(5)!;
    const input = [...range(5, 15, 1)].reverse();
    await tree.$.rows.setAll(input, { chunk: 3 });
    const sync = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 10) }) });
    sync.$.rows.setAll(input);
    expect(tree.$.rows.all()).toEqual(sync.$.rows.all());
    expect(tree.$.rows.byId(5)).toBe(five);
    expect(five.v.get()).toBe(1);
  });

  it('publishes each chunk as its own turn, and yields between chunks', async () => {
    const listener = vi.fn<ObserveListener>();
    const tree = signalTree({ rows: entityMap<Row, number>() }, { plugins: [probe((s) => s.observe(listener))] });
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    await tree.$.rows.setAll(range(0, 10), { chunk: 4 });
    clearInterval(timer);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls.map(([effects]) => effects.length)).toEqual([4, 4, 2]);
    const turns = new Set(listener.mock.calls.map(([, turn]) => turn.turn.id));
    expect(turns.size).toBe(3);
    expect(ticks).toBeGreaterThan(0);
  });

  it('rejects on a bad row before changing anything', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 3) }) });
    const input = [...range(10, 20), { id: 10, v: 9 }];
    await expect(tree.$.rows.setAll(input, { chunk: 2 })).rejects.toMatchObject({ code: 'ST1010' });
    expect(tree.$.rows.ids()).toEqual([0, 1, 2]);
    await expect(tree.$.rows.setAll([{ id: null } as never], { chunk: 'auto' })).rejects.toMatchObject({ code: 'ST1012' });
    await expect(tree.$.rows.setAll(5 as never, { chunk: 'auto' })).rejects.toMatchObject({ code: 'ST1013' });
    await expect(tree.$.rows.setAll([], { chunk: 0 })).rejects.toMatchObject({ code: 'ST1006' });
    await expect(tree.$.rows.setAll([], { chunk: 1.5 })).rejects.toMatchObject({ code: 'ST1006' });
  });

  it('attributes every chunk to the writer context of the call, even after it ends', async () => {
    const writers = new Set<string>();
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 4) }) }, { plugins: [probe((s) => s.observe((effects) => effects.forEach((e) => writers.add(e.context.writer))))] });
    const ingest = tree.as({ writer: 'sync:feed', origin: 'sync' }, () => {
      const promise = tree.$.rows.setAll(range(2, 8, 1), { chunk: 2 });
      return { promise };
    }).promise;
    tree.$.rows.updateOne(0, { v: 5 });
    await ingest;
    expect([...writers].sort()).toEqual(['sync:feed', 'user']);
  });

  it('keeps rows another writer adds while it runs, after the input rows', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 2) }) });
    const ingest = tree.$.rows.setAll(range(10, 16), { chunk: 2 });
    tree.$.rows.addOne({ id: 99, v: 0 });
    await ingest;
    expect(tree.$.rows.ids()).toEqual([10, 11, 12, 13, 14, 15, 99]);
  });

  it('copes with a row another writer removes while it runs', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 6) }) });
    const ingest = tree.$.rows.setAll(range(0, 6, 1), { chunk: 2 });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (tree.$.rows.byId(5)) tree.$.rows.removeOne(5);
    await ingest;
    expect(tree.$.rows.count()).toBeGreaterThanOrEqual(5);
    expect(tree.$.rows.all().every((r) => r.v === 1)).toBe(true);
  });

  it('rejects when the tree is destroyed between chunks', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    const ingest = tree.$.rows.setAll(range(0, 10), { chunk: 2 });
    tree.destroy();
    await expect(ingest).rejects.toMatchObject({ code: 'ST1003' });
  });

  it("sizes 'auto' chunks by time, for a large ingest", async () => {
    const tree = signalTree({ rows: entityMap<Row, number>({ rows: range(0, 1000) }) });
    await tree.$.rows.setAll(range(500, 20_500, 2), { chunk: 'auto' });
    expect(tree.$.rows.count()).toBe(20_000);
    expect(tree.$.rows.ids()[0]).toBe(500);
    expect(tree.$.rows.byId(20_499)!.get()!.v).toBe(2);
  });

  it('uses scheduler.yield when the host has it', async () => {
    const g = globalThis as { scheduler?: unknown };
    const original = g.scheduler;
    const yieldFn = vi.fn(() => Promise.resolve());
    g.scheduler = { yield: yieldFn };
    try {
      const tree = signalTree({ rows: entityMap<Row, number>() });
      await tree.$.rows.setAll(range(0, 4), { chunk: 1 });
      expect(yieldFn).toHaveBeenCalled();
    } finally {
      g.scheduler = original;
    }
  });
});
