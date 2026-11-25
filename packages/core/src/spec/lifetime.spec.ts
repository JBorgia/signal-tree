/**
 * Spec tests for hydration and released memory: BRIEF.md 12.4 rows H1 and D2,
 * the parts the core alone shows (the framework's server-to-client transfer
 * comes with the adapters). Written from the spec; each title carries the row
 * it proves.
 */
import { describe, expect, it } from 'vitest';
import { entityMap, signalTree } from '@signal-tree/core';
import type { Plugin, ScopeHandle, TurnInfo, WriteEffect } from '@signal-tree/core';

interface Row {
  id: string;
  n: number;
  tags: string[];
}

const state = () => ({ a: 0, cfg: { p: 0, q: { deep: 'x' } }, rows: entityMap<Row, string>() });

function scopeOf(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'scope-probe', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

/** A full collection the test can trigger. Node builtins load by a computed specifier: the core's typecheck has no Node types. */
const builtin = (name: string) => import(`node:${name}`) as Promise<Record<string, (...args: unknown[]) => unknown>>;
const v8 = await builtin('v8');
const vm = await builtin('vm');
v8['setFlagsFromString']!('--expose-gc');
const gc = vm['runInNewContext']!('gc') as () => void;
const collect = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();
  }
};

describe('hydration', () => {
  it('[H1] state serialized on the server and hydrated on the client yields identical values', () => {
    const server = signalTree(state());
    server.$.a.set(7);
    server.$.cfg.q.set({ deep: 'y' });
    server.$.rows.addMany([{ id: 'r2', n: 2, tags: ['b'] }, { id: 'r1', n: 1, tags: [] }]);
    const payload = JSON.stringify(server.$.get());
    const client = signalTree(state());
    client.as({ writer: 'server', origin: 'server' }, () => client.$.set(JSON.parse(payload)));
    expect(client.$.get()).toEqual(server.$.get());
    expect(client.$.rows.ids()).toEqual(['r2', 'r1']);
    expect(client.$.rows.byId('r2')!.tags.get()).toEqual(['b']);
  });

  it('[H1] hydration is one turn with origin "server"', () => {
    const turns: { effects: readonly WriteEffect[]; turn: TurnInfo }[] = [];
    const client = signalTree(state(), { plugins: [scopeOf((s) => s.observe((effects, turn) => turns.push({ effects, turn })))] });
    let runs = 0;
    client.$.a.subscribe(() => runs++);
    client.$.cfg.p.subscribe(() => runs++);
    client.as({ writer: 'server', origin: 'server' }, () => client.$.set({ a: 1, cfg: { p: 2, q: { deep: 'x' } }, rows: [{ id: 'r1', n: 1, tags: [] }] } as never));
    expect(turns).toHaveLength(1);
    expect(turns[0]!.turn.context.origin).toBe('server');
    expect(turns[0]!.effects.every((e) => e.context.origin === 'server')).toBe(true);
    expect(runs).toBe(2);
  });
});

describe('released memory', () => {
  it('[D2] a removed row releases its memory once nothing references it', async () => {
    const tree = signalTree(state());
    tree.$.rows.addOne({ id: 'r1', n: 1, tags: ['t'] });
    let handle: object | undefined = tree.$.rows.byId('r1');
    let snapshot: object | undefined = tree.$.rows.all()[0] as object;
    const handleRef = new WeakRef(handle!);
    const snapshotRef = new WeakRef(snapshot);
    tree.$.rows.removeOne('r1');
    handle = undefined;
    snapshot = undefined;
    tree.$.rows.all();
    await collect();
    expect(handleRef.deref()).toBeUndefined();
    expect(snapshotRef.deref()).toBeUndefined();
  });

  it('[D2] a held handle keeps a removed row reachable, and releasing it releases the row', async () => {
    const tree = signalTree(state());
    tree.$.rows.addOne({ id: 'r1', n: 1, tags: [] });
    let held: object | undefined = tree.$.rows.byId('r1');
    const ref = new WeakRef(held!);
    tree.$.rows.removeOne('r1');
    await collect();
    expect(ref.deref()).toBe(held);
    held = undefined;
    await collect();
    expect(ref.deref()).toBeUndefined();
  });

  it('[D2] a removed field releases its memory', async () => {
    const tree = signalTree({ panel: { big: { payload: new Array(10_000).fill(0) } as unknown, keep: 1 } as Record<string, unknown> });
    let value: object | undefined = (tree.$.panel as unknown as { big: { get(): object } }).big.get();
    const ref = new WeakRef(value);
    tree.$.panel.set({ keep: 1 });
    value = undefined;
    tree.$.get();
    await collect();
    expect(ref.deref()).toBeUndefined();
  });
});
