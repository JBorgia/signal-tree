/**
 * Spec tests for cases the test generator found on the core (BRIEF.md
 * 12.1.4): each was a spec violation, fixed in the same change. Written from
 * the spec; each title carries the row it proves.
 */
import { describe, expect, it } from 'vitest';
import { entityMap, signalTree } from '@signal-tree/core';
import type { Plugin, ScopeHandle } from '@signal-tree/core';

interface Row {
  id: string;
  n: number;
}

function scopeOf(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'scope-probe', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

describe('found by the generator', () => {
  it('[O4] a write a subscriber makes while a turn is published is applied after every observer of that turn has run', () => {
    let scope!: ScopeHandle;
    const tree = signalTree({ a: 0, rows: entityMap<Row, string>({ rows: [{ id: 'r5', n: 0 }] }) }, { plugins: [scopeOf((s) => (scope = s))] });
    const sawDuringTurn: number[] = [];
    const turns: number[] = [];
    scope.observe((effects, turn) => {
      turns.push(turn.turn.id);
      if (effects.some((e) => e.location[0] === 'rows')) sawDuringTurn.push(tree.$.a.get());
    });
    const n = tree.$.rows.byId('r5')!.n;
    n.subscribe(() => tree.as({ writer: 'observer', origin: 'agent' }, () => tree.$.a.set(10)));
    tree.$.rows.removeOne('r5');
    expect(sawDuringTurn).toEqual([0]);
    expect(tree.$.a.get()).toBe(10);
    expect(turns).toHaveLength(2);
    expect(turns[1]).not.toBe(turns[0]);
  });

  it('[O4] a write a subscriber makes while a bare write is published runs after it, in the subscriber’s writer context', () => {
    const writers: string[] = [];
    const tree = signalTree({ a: 0, b: 0 }, { plugins: [scopeOf((s) => s.observe((effects) => writers.push(...effects.map((e) => `${e.location.join('.')}:${e.context.writer}`))))] });
    const order: string[] = [];
    tree.$.a.subscribe(() => {
      order.push(`a=${tree.$.a.get()} b=${tree.$.b.get()}`);
      tree.as({ writer: 'echo', origin: 'agent' }, () => tree.$.b.set(tree.$.a.get()));
      order.push(`after echo b=${tree.$.b.get()}`);
    });
    tree.$.a.set(3);
    expect(order).toEqual(['a=3 b=0', 'after echo b=0']);
    expect(tree.$.b.get()).toBe(3);
    expect(writers).toEqual(['a:user', 'b:echo']);
  });

  it('[V1] a whole-value write over a collection the tree has not read yet sets its rows, and it stays a collection', () => {
    const state = () => ({ a: 0, rows: entityMap<Row, string>({ rows: [{ id: 'r1', n: 1 }] }) });
    const tree = signalTree(state());
    tree.$.set({ a: 1, rows: [{ id: 'r2', n: 2 }] } as never);
    expect(tree.$.rows.ids()).toEqual(['r2']);
    expect(tree.$.get()).toEqual({ a: 1, rows: [{ id: 'r2', n: 2 }] });
    const nested = signalTree({ shop: { orders: entityMap<Row, string>() } });
    nested.$.set({ shop: { orders: [{ id: 'o1', n: 1 }] } } as never);
    expect(nested.$.shop.orders.count()).toBe(1);
  });

  it('[V1] a snapshot hydrated into a fresh tree by one whole-value write yields identical values', () => {
    const source = signalTree({ a: 0, cfg: { p: 0, q: 0 }, rows: entityMap<Row, string>() });
    source.$.a.set(4);
    source.$.rows.addMany([{ id: 'r2', n: 1 }, { id: 'r1', n: 2 }]);
    const fresh = signalTree({ a: 0, cfg: { p: 0, q: 0 }, rows: entityMap<Row, string>() });
    fresh.$.set(JSON.parse(JSON.stringify(source.$.get())));
    expect(fresh.$.get()).toEqual(source.$.get());
    expect(fresh.$.rows.ids()).toEqual(['r2', 'r1']);
  });
});
