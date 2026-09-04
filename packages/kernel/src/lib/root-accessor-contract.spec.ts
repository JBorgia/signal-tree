import { describe, expect, it } from 'vitest';

import { batching } from '../enhancers/batching/batching';
import { signalTree } from './signal-tree';

describe('GREENFIELD-ROOT-ACCESSOR-SHAPE-0', () => {
  it('uses the ordinary callable node grammar at position zero', () => {
    const tree = signalTree({ count: 1, user: { name: 'Ada' } });

    expect(tree.$()).toEqual({ count: 1, user: { name: 'Ada' } });

    tree.$({ count: 2, user: { name: 'Grace' } });
    expect(tree.$()).toEqual({ count: 2, user: { name: 'Grace' } });

    tree.$((current) => ({
      ...current,
      count: current.count + 1,
    }));
    expect(tree.$()).toEqual({ count: 3, user: { name: 'Grace' } });
  });

  it('keeps the controller non-callable and root methods minimal', () => {
    const tree = signalTree({ count: 1 });
    const callController = tree as unknown as (
      value?: unknown
    ) => unknown;

    expect(typeof tree).toBe('object');
    expect(typeof tree.$).toBe('function');
    expect(() => callController()).toThrow(TypeError);
    expect(() => callController({ count: 2 })).toThrow(TypeError);
    expect(() => callController((current: { count: number }) => current)).toThrow(
      TypeError
    );
    expect('set' in tree.$).toBe(false);
    expect('update' in tree.$).toBe(false);
  });

  it('reserves no location-method names from dot-path state', () => {
    const tree = signalTree({
      set: 1,
      update: 2,
      peek: 3,
      subscribe: 4,
      asReadonly: 5,
      nested: {
        set: 'set',
        update: 'update',
        peek: 'peek',
        subscribe: 'subscribe',
        asReadonly: 'asReadonly',
      },
    });

    expect(tree.$.set()).toBe(1);
    expect(tree.$.update()).toBe(2);
    expect(tree.$.peek()).toBe(3);
    expect(tree.$.subscribe()).toBe(4);
    expect(tree.$.asReadonly()).toBe(5);
    expect(tree.$.nested()).toEqual({
      set: 'set',
      update: 'update',
      peek: 'peek',
      subscribe: 'subscribe',
      asReadonly: 'asReadonly',
    });

    tree.$({
      set: 6,
      update: 7,
      peek: 8,
      subscribe: 9,
      asReadonly: 10,
      nested: {
        set: 'next-set',
        update: 'next-update',
        peek: 'next-peek',
        subscribe: 'next-subscribe',
        asReadonly: 'next-asReadonly',
      },
    });

    expect(tree.$.nested()).toEqual({
      set: 'next-set',
      update: 'next-update',
      peek: 'next-peek',
      subscribe: 'next-subscribe',
      asReadonly: 'next-asReadonly',
    });
  });

  it('preserves the same controller and root grammar through enhancement', () => {
    const tree = signalTree(
      { count: 1 },
      { enhancers: [batching()] }
    );

    expect(typeof tree).toBe('object');
    expect(typeof tree.$).toBe('function');
    expect(() => (tree as unknown as () => unknown)()).toThrow(TypeError);

    tree.$({ count: 2 });
    tree.$((current) => ({ count: current.count + 1 }));

    expect(tree.$()).toEqual({ count: 3 });
    expect('set' in tree.$).toBe(false);
    expect('update' in tree.$).toBe(false);
  });
});
