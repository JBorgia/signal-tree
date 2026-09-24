import { watch } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { observeOwnerInvalidation } from '@signal-tree/kernel/adapter';
import { signalTree } from '../index';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('audited native observation lifecycle', () => {
  it('completes cleanup once even when a destruction watcher throws', () => {
    const tree = signalTree({ n: 0 });
    const cleanup = vi.fn();
    const laterCleanup = vi.fn();
    tree.registerCleanup(cleanup);
    tree.registerCleanup(() => {
      throw new Error('cleanup');
    });
    tree.registerCleanup(laterCleanup);
    const off = observeOwnerInvalidation(
      { $: tree.$, destroyed: () => tree.destroyed.value },
      () => undefined
    );
    const failure = new Error('watcher');
    const stop = watch(
      () => tree.destroyed.value,
      () => {
        throw failure;
      },
      { flush: 'sync' }
    );
    try {
      expect(() => tree.destroy()).toThrow(failure);
      expect(tree.destroyed.value).toBe(true);
      tree.destroy();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(laterCleanup).toHaveBeenCalledTimes(1);
    } finally {
      stop();
      off();
      tree.destroy();
    }
  });

  for (const next of [1, 2]) {
    it(`observes dormant ref reactivation to ${next}`, async () => {
      const tree = signalTree({ user: { age: 1 } as { age?: number } });
      const held = tree.$.user.age;
      if (!held) throw new Error('Missing age location');
      const notified = vi.fn();
      const off = observeOwnerInvalidation(
        { $: tree.$, destroyed: () => tree.destroyed.value },
        notified
      );
      try {
        held.value = 3;
        await settle();
        expect(notified).toHaveBeenCalledTimes(1);
        held.value = 1;
        tree.$.user({});
        await settle();
        notified.mockClear();
        held.value = next;
        await settle();
        expect(held.value).toBe(next);
        expect(notified).toHaveBeenCalledTimes(1);
      } finally {
        off();
        tree.destroy();
      }
    });
  }
});
