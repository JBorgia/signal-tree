import { describe, expect, it, vi } from 'vitest';
import { observeOwnerInvalidation } from '@signal-tree/kernel/adapter';
import { signalTree } from '../index';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('audited native observation lifecycle', () => {
  for (const next of [1, 2]) {
    it(`observes dormant updater reactivation to ${next}`, async () => {
      const tree = signalTree({ user: { age: 1 } as { age?: number } });
      const held = tree.$.user.age;
      if (!held) throw new Error('Missing age location');
      const notified = vi.fn();
      const off = observeOwnerInvalidation(tree, notified);
      try {
        held.set(3);
        await settle();
        expect(notified).toHaveBeenCalledTimes(1);
        held.set(1);
        tree.$.user({});
        await settle();
        notified.mockClear();
        const update = vi.fn(() => next);
        held.update(update);
        await settle();
        expect(update).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(held()).toBe(next);
        expect(notified).toHaveBeenCalledTimes(1);
      } finally {
        off();
        tree.destroy();
      }
    });
  }
});
