import { describe, expect, it, vi } from 'vitest';
import { signalTree } from './signal-tree';
import { observeOwnerInvalidation } from '../adapter';
import { observationStateForTesting } from './internals/observation-substrate';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('audited observation lifecycle boundaries', () => {
  it('acquires retained dormant leaves after omission', async () => {
    const tree = signalTree({
      user: { age: 1 } as { age?: number },
      control: 0,
    });
    const held = tree.$.user.age!;
    tree.$.user({});
    await settle();
    const notified = vi.fn();
    const off = observeOwnerInvalidation(tree, notified);
    try {
      tree.$.control(1);
      await settle();
      expect(notified).toHaveBeenCalledTimes(1);
      notified.mockClear();
      held(2);
      await settle();
      expect(held()).toBe(2);
      expect(notified).toHaveBeenCalledTimes(1);
    } finally {
      off();
      tree.destroy();
    }
    expect(observationStateForTesting(held).claims).toBe(0);
  });
});
