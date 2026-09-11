/**
 * CURRENT-VALUE-0 — can Studio tell "absent" from "present and `undefined`"?
 *
 * The Why? panel's `currentValueExplained` warning is only meaningful if the
 * live read is truthful. A read that answers `undefined` for a path the tree
 * does not have makes absence indistinguishable from a real value, and
 * `undefined` is a legitimate SignalTree state value.
 */
import { entityMap, signalTree, transactions } from '@signal-tree/kernel';
import * as kernelAdapter from '@signal-tree/kernel/adapter';
import { describe, expect, it, vi } from 'vitest';

import { readCurrentValue, readCurrentValues } from './current-value';

const tree = () =>
  signalTree({
    cart: { total: 9800, note: undefined as string | undefined },
    rows: [{ id: 'A' }],
  }) as never as { $: object };

describe('CURRENT-VALUE-0', () => {
  it('reads a live scalar', () => {
    expect(readCurrentValue(tree(), 'cart.total')).toEqual({
      kind: 'value',
      value: 9800,
    });
  });

  it('reads a whole subtree', () => {
    expect(readCurrentValue(tree(), 'cart')).toEqual({
      kind: 'value',
      value: { total: 9800, note: undefined },
    });
  });

  /**
   * ⚠️ THE DISCRIMINATOR. These two must not produce the same answer, and the
   * pair is the test — either alone passes trivially.
   */
  it('distinguishes a present `undefined` from a missing path', () => {
    const present = readCurrentValue(tree(), 'cart.note');
    const missing = readCurrentValue(tree(), 'cart.nope');

    expect(present).toEqual({ kind: 'value', value: undefined });
    expect(missing).toEqual({
      kind: 'unserializable',
      valueType: 'unresolved-path',
      preview: 'cart.nope',
    });
    expect(present).not.toEqual(missing);
  });

  /**
   * POSITIVE CONTROL — the prohibited implementation, run against the same
   * inputs. It walks by reading each segment and guarding only the container's
   * shape, which is exactly what this module did until a browser run caught it.
   * If the assertion above could pass here, it would be proving nothing.
   */
  it('POSITIVE CONTROL — shape-only walking collapses the two cases', () => {
    const shapeOnlyWalk = (root: unknown, path: string) => {
      let node = root;
      for (const segment of path.split('.')) {
        if (node === null || typeof node !== 'object') {
          return { kind: 'unresolved' as const };
        }
        node = (node as Record<string, unknown>)[segment];
      }
      return { kind: 'value' as const, value: node };
    };

    const root = { cart: { total: 9800, note: undefined } };
    // Indistinguishable — the defect, reproduced.
    expect(shapeOnlyWalk(root, 'cart.note')).toEqual(
      shapeOnlyWalk(root, 'cart.nope')
    );
  });

  it('a broken intermediate segment is unresolved, not a crash', () => {
    expect(readCurrentValue(tree(), 'cart.total.deeper')).toMatchObject({
      valueType: 'unresolved-path',
    });
  });

  it('resolves through an array index', () => {
    expect(readCurrentValue(tree(), 'rows.0.id')).toEqual({
      kind: 'value',
      value: 'A',
    });
    expect(readCurrentValue(tree(), 'rows.7.id')).toMatchObject({
      valueType: 'unresolved-path',
    });
  });
});

describe('batched current values', () => {
  it('takes one canonical snapshot for multiple requested locations', () => {
    const snapshot = vi.spyOn(kernelAdapter, 'readCanonicalSnapshot');
    try {
      const result = readCurrentValues(tree(), [
        'cart.total',
        'cart.note',
        'cart.nope',
        'rows.0.id',
      ]);
      expect(snapshot).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { path: 'cart.total', value: { kind: 'value', value: 9800 } },
        { path: 'cart.note', value: { kind: 'value', value: undefined } },
        {
          path: 'cart.nope',
          value: {
            kind: 'unserializable',
            valueType: 'unresolved-path',
            preview: 'cart.nope',
          },
        },
        { path: 'rows.0.id', value: { kind: 'value', value: 'A' } },
      ]);
    } finally {
      snapshot.mockRestore();
    }
  });

  it('clones subtrees independently and leaves the live tree untouched', () => {
    const source = tree();
    const result = readCurrentValues(source, ['cart', 'cart']);
    if (result[0]!.value.kind !== 'value') throw new Error('expected value');
    (result[0]!.value.value as { total: number }).total = 1;
    expect(result[1]!.value).toMatchObject({ value: { total: 9800 } });
    expect(readCurrentValue(source, 'cart.total')).toEqual({
      kind: 'value',
      value: 9800,
    });
  });

  it('skips snapshots for empty reads and rejects oversized batches', () => {
    const snapshot = vi.spyOn(kernelAdapter, 'readCanonicalSnapshot');
    try {
      expect(readCurrentValues(tree(), [])).toEqual([]);
      expect(() =>
        readCurrentValues(tree(), Array(201).fill('cart.total'))
      ).toThrow(RangeError);
      expect(snapshot).not.toHaveBeenCalled();
    } finally {
      snapshot.mockRestore();
    }
  });

  it('reports a snapshot failure at each requested location', () => {
    const snapshot = vi
      .spyOn(kernelAdapter, 'readCanonicalSnapshot')
      .mockImplementation(() => {
        throw new Error('unavailable');
      });
    try {
      expect(readCurrentValues(tree(), ['cart', 'rows'])).toEqual(
        ['cart', 'rows'].map((path) => ({
          path,
          value: {
            kind: 'unserializable',
            valueType: 'snapshot-failed',
            preview: 'unavailable',
          },
        }))
      );
      expect(snapshot).toHaveBeenCalledTimes(1);
    } finally {
      snapshot.mockRestore();
    }
  });
});

describe('live read safety budgets', () => {
  it('does not resolve inherited object properties as state locations', () => {
    for (const path of [
      'cart.toString',
      'cart.constructor',
      'cart.__proto__',
      'rows.map',
    ]) {
      expect(readCurrentValue(tree(), path)).toMatchObject({
        valueType: 'unresolved-path',
      });
    }
  });

  it('refuses an oversized value explicitly while preserving adjacent scalar truth', () => {
    const source = signalTree({ huge: 'x'.repeat(65536), count: 4 }) as never;
    expect(readCurrentValues(source, ['huge', 'count'])).toEqual([
      {
        path: 'huge',
        value: {
          kind: 'unserializable',
          valueType: 'capture-budget',
          preview: 'Value exceeds capture byte or traversal budget',
        },
      },
      { path: 'count', value: { kind: 'value', value: 4 } },
    ]);
  });

  it('bounds the complete returned batch, not only individual cells', () => {
    const source = signalTree({ payload: 'x'.repeat(30000) }) as never;
    const values = readCurrentValues(source, Array(200).fill('payload'));
    expect(
      values.filter((entry) => entry.value.kind === 'value').length
    ).toBeLessThan(40);
    expect(values.at(-1)?.value).toMatchObject({ valueType: 'capture-budget' });
  });
});

describe('unambiguous Studio address grammar', () => {
  it('refuses literal dotted keys instead of returning the nested namesake', () => {
    const source = signalTree({ 'cart.total': 1, cart: { total: 2 } });
    try {
      expect(readCurrentValue(source, 'cart.total')).toMatchObject({
        kind: 'unserializable',
        valueType: 'ambiguous-path',
      });
    } finally {
      source.destroy();
    }
  });
  it('refuses dotted intermediate aliases and empty-segment addresses', () => {
    const source = signalTree({ a: { 'b.c': { d: 1 }, b: { c: { d: 2 } } } });
    try {
      expect(readCurrentValue(source, 'a.b.c.d')).toMatchObject({
        valueType: 'ambiguous-path',
      });
      for (const path of ['', 'a..b', '.a', 'a.'])
        expect(readCurrentValue(source, path)).toMatchObject({
          valueType: 'unsupported-path',
        });
    } finally {
      source.destroy();
    }
  });
  it('allows own constructor/prototype-named data but never inherited properties', () => {
    const snapshot = JSON.parse(
      '{"constructor":7,"__proto__":{"n":8},"rows":[{"n":9}]}'
    );
    const spy = vi
      .spyOn(kernelAdapter, 'readCanonicalSnapshot')
      .mockReturnValue(snapshot);
    try {
      expect(readCurrentValue({ $: {} }, 'constructor')).toEqual({
        kind: 'value',
        value: 7,
      });
      expect(readCurrentValue({ $: {} }, '__proto__.n')).toEqual({
        kind: 'value',
        value: 8,
      });
      expect(readCurrentValue({ $: {} }, 'rows.0.n')).toEqual({
        kind: 'value',
        value: 9,
      });
      expect(readCurrentValue({ $: {} }, 'toString')).toMatchObject({
        valueType: 'unresolved-path',
      });
      expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    } finally {
      spy.mockRestore();
    }
  });
  it('does not invoke an accessor during path resolution', () => {
    let reads = 0;
    const spy = vi
      .spyOn(kernelAdapter, 'readCanonicalSnapshot')
      .mockReturnValue({
        get secret() {
          reads++;
          return 1;
        },
      });
    try {
      expect(readCurrentValue({ $: {} }, 'secret')).toMatchObject({
        valueType: 'unread-accessor',
      });
      expect(reads).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

it('reads reused entity keys as current locations without asserting lifetime identity', () => {
  const source = signalTree(
    {
      rows: entityMap<{ id: string; n: number }, string>({
        selectId: (row) => row.id,
      }),
    },
    { enhancers: [transactions()] }
  );
  try {
    source
      .transaction(() => source.$.rows.addOne({ id: 'same', n: 1 }))
      .confirm();
    expect(readCurrentValue(source, 'rows.all.0.n')).toEqual({
      kind: 'value',
      value: 1,
    });
    source.transaction(() => source.$.rows.removeOne('same')).confirm();
    expect(readCurrentValue(source, 'rows.all.0.n')).toMatchObject({
      valueType: 'unresolved-path',
    });
    source
      .transaction(() => source.$.rows.addOne({ id: 'same', n: 2 }))
      .confirm();
    expect(readCurrentValue(source, 'rows.all.0.n')).toEqual({
      kind: 'value',
      value: 2,
    });
  } finally {
    source.destroy();
  }
});
