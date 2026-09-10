/**
 * CURRENT-VALUE-0 — can Studio tell "absent" from "present and `undefined`"?
 *
 * The Why? panel's `currentValueExplained` warning is only meaningful if the
 * live read is truthful. A read that answers `undefined` for a path the tree
 * does not have makes absence indistinguishable from a real value, and
 * `undefined` is a legitimate SignalTree state value.
 */
import { signalTree } from '@signal-tree/kernel';
import { describe, expect, it } from 'vitest';

import { readCurrentValue } from './current-value';

const tree = () =>
  signalTree({
    cart: { total: 9800, note: undefined as string | undefined },
    rows: [{ id: 'A' }],
  }) as never as { $: object };

describe('CURRENT-VALUE-0', () => {
  it('reads a live scalar', () => {
    expect(readCurrentValue(tree(), 'cart.total')).toEqual({ kind: 'value', value: 9800 });
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
    expect(shapeOnlyWalk(root, 'cart.note')).toEqual(shapeOnlyWalk(root, 'cart.nope'));
  });

  it('a broken intermediate segment is unresolved, not a crash', () => {
    expect(readCurrentValue(tree(), 'cart.total.deeper')).toMatchObject({
      valueType: 'unresolved-path',
    });
  });

  it('resolves through an array index', () => {
    expect(readCurrentValue(tree(), 'rows.0.id')).toEqual({ kind: 'value', value: 'A' });
    expect(readCurrentValue(tree(), 'rows.7.id')).toMatchObject({ valueType: 'unresolved-path' });
  });
});
