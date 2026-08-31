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
