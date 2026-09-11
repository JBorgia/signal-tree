/**
 * STATE-SHAPE-0 — does the state pane describe the STATE, or only the evidence?
 *
 * And, once bounded: does a limit announce itself, or does it quietly shorten
 * the tree? A branch cut by `maxDepth` that renders as a leaf claims the state
 * ends there. That is the same error class as presenting an absent path as
 * `undefined`.
 */
import { signalTree } from '@signal-tree/kernel';
import { describe, expect, it, vi } from 'vitest';
import * as kernelAdapter from '@signal-tree/kernel/adapter';

import { readStateShape, type StateNode } from './state-shape';

const find = (
  nodes: readonly StateNode[],
  path: string
): StateNode | undefined => {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = n.children && find(n.children, path);
    if (hit) return hit;
  }
  return undefined;
};

const shapeOf = (state: object, options = {}) => {
  const result = readStateShape(signalTree(state as never) as never, options);
  if (!result.ok) throw new Error(result.reason);
  return result.shape;
};

describe('STATE-SHAPE-0', () => {
  it('describes locations nothing has ever written to', () => {
    const shape = shapeOf({
      cart: { subtotal: 0, total: 0 },
      orders: { open: [] },
    });
    // `subtotal` appears in no transaction and no realization. An
    // evidence-derived pane could not show it at all.
    expect(find(shape.nodes, 'cart.subtotal')).toMatchObject({ kind: 'leaf' });
    expect(find(shape.nodes, 'orders')).toMatchObject({ kind: 'branch' });
  });

  it('carries paths `readCurrentValue` can resolve', () => {
    const shape = shapeOf({ cart: { total: 9800 } });
    expect(find(shape.nodes, 'cart.total')?.path).toBe('cart.total');
  });

  it('sends no values', () => {
    const shape = shapeOf({ cart: { total: 9800, secret: 'hunter2' } });
    expect(JSON.stringify(shape)).not.toContain('hunter2');
    expect(JSON.stringify(shape)).not.toContain('9800');
  });

  it('treats an array as a branch with index keys', () => {
    const shape = shapeOf({ rows: [{ id: 'A' }] });
    expect(find(shape.nodes, 'rows.0.id')).toMatchObject({ kind: 'leaf' });
  });

  it('does not descend into a Date as though it were a namespace', () => {
    const shape = shapeOf({ meta: { at: new Date(0) } });
    expect(find(shape.nodes, 'meta.at')).toMatchObject({ kind: 'leaf' });
  });

  /**
   * ⚠️ THE DISCRIMINATOR. A depth-cut branch and a real leaf must not render
   * the same, and `truncated` must be visible at the top level too.
   */
  it('marks a depth-cut branch as a branch, and says the read was bounded', () => {
    const shape = shapeOf({ a: { b: { c: { d: 1 } } } }, { maxDepth: 2 });
    const cut = find(shape.nodes, 'a.b');

    expect(cut).toMatchObject({ kind: 'branch', truncated: 'depth' });
    expect(cut?.children).toBeUndefined();
    expect(shape.truncated).toBe(true);
  });

  it('reports a breadth cut rather than silently dropping keys', () => {
    const wide = Object.fromEntries([...Array(10)].map((_, i) => [`k${i}`, i]));
    const shape = shapeOf({ wide }, { maxKeys: 3 });
    expect(shape.truncated).toBe(true);
  });

  it('an untruncated read says so', () => {
    expect(shapeOf({ a: { b: 1 } }).truncated).toBe(false);
  });

  /**
   * POSITIVE CONTROL — the prohibited implementation. It cuts at the same depth
   * but emits a leaf, which is what a naive bounded walk does. If the
   * assertions above could pass against this, they would prove nothing.
   */
  it('POSITIVE CONTROL — a depth cut that emits a leaf is indistinguishable', () => {
    const leafOnCut = (
      value: object,
      depth: number,
      max: number
    ): StateNode[] =>
      Object.keys(value).map((key) => {
        const child = (value as Record<string, unknown>)[key];
        const branch = child !== null && typeof child === 'object';
        return branch && depth + 1 < max
          ? {
              key,
              path: key,
              kind: 'branch',
              children: leafOnCut(child as object, depth + 1, max),
            }
          : { key, path: key, kind: 'leaf' };
      });

    const cut = leafOnCut({ a: { b: { c: 1 } } }, 0, 2);
    const real = leafOnCut({ a: { b: 1 } }, 0, 2);
    // Both say `a.b` is a leaf. The defect, reproduced.
    expect(cut[0].children).toEqual(real[0].children);
  });
});

describe('shape output budgets', () => {
  it('rejects invalid options before materializing state', () => {
    for (const options of [
      { maxKeys: 0 },
      { maxKeys: Infinity },
      { maxDepth: NaN },
      { maxDepth: 33 },
      { maxKeys: 1.5 },
    ]) {
      expect(
        readStateShape(
          {
            get $(): object {
              throw new Error('must not read');
            },
          },
          options
        )
      ).toMatchObject({
        ok: false,
        reason: expect.stringContaining('Shape limits'),
      });
    }
  });

  it('caps all returned nodes, not each level independently', () => {
    const state = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [
        `branch${i}`,
        Object.fromEntries(
          Array.from({ length: 50 }, (_, j) => [`leaf${j}`, j])
        ),
      ])
    );
    const shape = shapeOf(state);
    const count = (nodes: readonly StateNode[]): number =>
      nodes.reduce((sum, node) => sum + 1 + count(node.children ?? []), 0);
    expect(count(shape.nodes)).toBe(2000);
    expect(shape.truncated).toBe(true);
    expect(shape.nodes.at(-1)).toMatchObject({
      kind: 'branch',
      truncated: 'breadth',
    });
  });
});

describe('state shape address safety', () => {
  it('refuses a shape with colliding literal/nested dotted addresses', () => {
    const source = signalTree({ 'cart.total': 1, cart: { total: 2 } });
    try {
      expect(readStateShape(source)).toMatchObject({
        ok: false,
        reason: expect.stringContaining('dotted'),
      });
    } finally {
      source.destroy();
    }
  });
  it('refuses unsupported empty keys rather than emitting the root address twice', () => {
    const source = signalTree({ '': 1, other: 2 });
    try {
      expect(readStateShape(source)).toMatchObject({
        ok: false,
        reason: expect.stringContaining('empty'),
      });
    } finally {
      source.destroy();
    }
  });
  it('enumerates own prototype-named data and array indices with unique addresses', () => {
    const snapshot = JSON.parse(
      '{"constructor":7,"__proto__":{"n":8},"rows":[{"n":9}]}'
    );
    const spy = vi
      .spyOn(kernelAdapter, 'readCanonicalSnapshot')
      .mockReturnValue(snapshot);
    try {
      const result = readStateShape({ $: {} });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(find(result.shape.nodes, 'constructor')).toBeDefined();
      expect(find(result.shape.nodes, '__proto__.n')).toBeDefined();
      expect(find(result.shape.nodes, 'rows.0.n')).toBeDefined();
      expect(find(result.shape.nodes, 'toString')).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
