import { computed, effect } from '@angular/core';

import { signalTree } from '../../src/lib/signal-tree';

describe('Batching System (moved)', () => {
  it('should batch multiple updates by default', async () => {
    const tree = signalTree({
      user: {
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
      },
    });

    let computeCount = 0;
    const fullName = computed(() => {
      computeCount++;
      return `${tree.$.user.firstName()} ${tree.$.user.lastName()}`;
    });

    // Trigger initial computation
    fullName();
    computeCount = 0;

    // Multiple updates
    tree.$.user.firstName('Jane');
    tree.$.user.lastName('Smith');
    tree.$.user.age(25);

    // Updates are queued, computation hasn't run yet
    expect(computeCount).toBe(0);

    // Wait for microtask
    await Promise.resolve();

    // Should compute only once
    expect(computeCount).toBe(1);
    expect(fullName()).toBe('Jane Smith');
    expect(tree.$.user.age()).toBe(25);
  });

  it('should support transactions for explicit batching', () => {
    const tree = signalTree({
      balance: 100,
      transactionHistory: [] as number[],
    });

    let updateCount = 0;
    effect(() => {
      tree.$.balance();
      updateCount++;
    });

    // Reset counter after initial effect
    updateCount = 0;

    // Transaction with multiple updates
    tree.transaction(() => {
      tree.$.balance(tree.$.balance() - 50);
      tree.$.balance(tree.$.balance() + 20);
      tree.$.balance(tree.$.balance() - 10);
    });

    // All updates batched into one
    expect(updateCount).toBe(1);
    expect(tree.$.balance()).toBe(60);
  });

  it('should support sync updates when needed', () => {
    const tree = signalTree({ value: 1 });

    let effectValue = 0;
    effect(() => {
      effectValue = tree.$.value() * 2;
    });

    // Reset
    effectValue = 0;

    // Sync update - immediate effect
    tree.sync(() => {
      tree.$.value(5);
      expect(effectValue).toBe(10); // Already updated
    });
  });

  it('should handle nested transactions', () => {
    const tree = signalTree({
      a: 1,
      b: 2,
      c: 3,
    });

    let updateCount = 0;
    effect(() => {
      tree.$.a();
      tree.$.b();
      tree.$.c();
      updateCount++;
    });

    updateCount = 0;

    tree.transaction(() => {
      tree.$.a(10);

      tree.transaction(() => {
        tree.$.b(20);
        tree.$.c(30);
      });

      tree.$.a(tree.$.a() + 5);
    });

    // All updates batched together
    expect(updateCount).toBe(1);
    expect(tree.$.a()).toBe(15);
    expect(tree.$.b()).toBe(20);
    expect(tree.$.c()).toBe(30);
  });

  it('should clear pending updates on transaction error', () => {
    const tree = signalTree({ value: 10 });

    let effectCount = 0;
    effect(() => {
      tree.$.value();
      effectCount++;
    });

    effectCount = 0;

    expect(() => {
      tree.transaction(() => {
        tree.$.value(20);
        throw new Error('Transaction failed');
      });
    }).toThrow('Transaction failed');

    // Pending updates should be cleared, value unchanged
    expect(tree.$.value()).toBe(10);
    expect(effectCount).toBe(0);
  });

  it('should batch updates from recursive update', async () => {
    const tree = signalTree({
      user: {
        name: 'John',
        email: 'john@example.com',
      },
      settings: {
        theme: 'dark',
        notifications: true,
      },
    });

    let updateCount = 0;
    effect(() => {
      tree.$.user.name();
      tree.$.settings.theme();
      updateCount++;
    });

    updateCount = 0;

    // Update multiple nested properties using function syntax
    tree((current) => ({
      ...current,
      user: { ...current.user, name: 'Jane' },
      settings: { ...current.settings, theme: 'light' },
    }));

    // Updates are queued
    expect(updateCount).toBe(0);

    await Promise.resolve();

    // Single recomputation
    expect(updateCount).toBe(1);
    expect(tree.$.user.name()).toBe('Jane');
    expect(tree.$.settings.theme()).toBe('light');
  });

  it('should work with array roots', async () => {
    const tree = signalTree([1, 2, 3]);

    let updateCount = 0;
    effect(() => {
      tree();
      updateCount++;
    });

    updateCount = 0;

    tree([4, 5, 6]);

    // Queued
    expect(updateCount).toBe(0);

    await Promise.resolve();

    // Single update
    expect(updateCount).toBe(1);
    expect(tree()).toEqual([4, 5, 6]);
  });

  it('should provide batching stats', () => {
    const tree = signalTree({ value: 1 });

    // Queue some updates in a transaction
    tree.transaction(() => {
      tree.$.value(2);
      tree.$.value(3);

      // Check stats during transaction
      const stats = (tree as any).getBatchingStats?.();
      if (stats) {
        expect(stats.isInTransaction).toBe(true);
        expect(stats.pendingUpdates).toBeGreaterThan(0);
      }
    });
  });
});
