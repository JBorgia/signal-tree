import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { signalTree } from '../../src/lib/signal-tree';
import { withComputed } from './computed-enhancer';

describe('withComputed Enhancer (moved)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should add computed method to tree', () => {
    const tree = signalTree({ count: 0 }).with(withComputed());

    expect(typeof tree.computed).toBe('function');
  });

  it('should create computed signals that track dependencies', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        firstName: 'John',
        lastName: 'Doe',
      }).with(withComputed());

      const fullName = tree.computed(
        () => `${tree.$.firstName()} ${tree.$.lastName()}`
      );

      expect(fullName()).toBe('John Doe');

      tree.$.firstName.set('Jane');
      expect(fullName()).toBe('Jane Doe');

      tree.$.lastName.set('Smith');
      expect(fullName()).toBe('Jane Smith');
    });
  });

  it('should memoize computed results', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({ value: 5 }).with(withComputed());

      let computeCount = 0;
      const doubled = tree.computed(() => {
        computeCount++;
        return tree.$.value() * 2;
      });

      // First access
      expect(doubled()).toBe(10);
      expect(computeCount).toBe(1);

      // Multiple accesses without changes
      doubled();
      doubled();
      doubled();
      expect(computeCount).toBe(1); // Still only computed once

      // Change dependency
      tree.$.value.set(10);
      expect(doubled()).toBe(20);
      expect(computeCount).toBe(2); // Computed again
    });
  });

  it('should support nested computed signals', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        items: [
          { price: 10, quantity: 2 },
          { price: 20, quantity: 1 },
        ],
        taxRate: 0.1,
        shipping: 5,
      }).with(withComputed());

      const subtotal = tree.computed(() =>
        tree.$.items().reduce(
          (sum: number, item: { price: number; quantity: number }) =>
            sum + item.price * item.quantity,
          0
        )
      );

      const tax = tree.computed(() => subtotal() * tree.$.taxRate());

      const total = tree.computed(() => subtotal() + tax() + tree.$.shipping());

      expect(subtotal()).toBe(40);
      expect(tax()).toBe(4);
      expect(total()).toBe(49);

      // Update items
      tree.$.items.set([{ price: 10, quantity: 3 }]);
      expect(subtotal()).toBe(30);
      expect(tax()).toBe(3);
      expect(total()).toBe(38);
    });
  });

  it('should support custom equality functions', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        data: { nested: { value: 1 } },
      }).with(withComputed());

      let computeCount = 0;
      const deepValue = tree.computed(
        () => {
          computeCount++;
          return tree.$.data();
        },
        {
          equal: (a: unknown, b: unknown) =>
            JSON.stringify(a) === JSON.stringify(b),
        }
      );

      deepValue();
      expect(computeCount).toBe(1);

      // Set to equivalent object
      tree.$.data({ nested: { value: 1 } });
      deepValue();
      expect(computeCount).toBe(1); // Should not recompute with custom equality

      // Set to different object
      tree.$.data({ nested: { value: 2 } });
      deepValue();
      expect(computeCount).toBe(2); // Should recompute
    });
  });

  it('should work with namedComputed', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
          { id: 3, name: 'Charlie', active: true },
        ],
      }).with(withComputed());

      const activeUsers = tree.namedComputed('activeUsers', () =>
        tree.$.users().filter(
          (u: { id: number; name: string; active: boolean }) => u.active
        )
      );

      expect(activeUsers().length).toBe(2);
      expect(activeUsers()[0].name).toBe('Alice');
      expect(activeUsers()[1].name).toBe('Charlie');
    });
  });

  it('should integrate with effects', async () => {
    await TestBed.runInInjectionContext(async () => {
      const tree = signalTree({ count: 0 }).with(withComputed());

      const doubled = tree.computed(() => tree.$.count() * 2);

      let effectValue = 0;
      effect(() => {
        effectValue = doubled();
      });

      // Effects run immediately on first creation
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(effectValue).toBe(0);

      tree.$.count.set(5);
      // Wait for effect to run after signal change
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(effectValue).toBe(10);

      tree.$.count.set(10);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(effectValue).toBe(20);
    });
  });

  it('should handle array transformations', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        numbers: [1, 2, 3, 4, 5],
      }).with(withComputed());

      const evenNumbers = tree.computed(() =>
        tree.$.numbers().filter((n: number) => n % 2 === 0)
      );

      const sum = tree.computed(() =>
        evenNumbers().reduce((acc: number, n: number) => acc + n, 0)
      );

      expect(evenNumbers()).toEqual([2, 4]);
      expect(sum()).toBe(6);

      tree.$.numbers.set([2, 4, 6, 8]);
      expect(evenNumbers()).toEqual([2, 4, 6, 8]);
      expect(sum()).toBe(20);
    });
  });

  it('should handle complex object computations', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        user: {
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            age: 30,
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      }).with(withComputed());

      const userSummary = tree.computed(() => ({
        fullName: `${tree.$.user.profile.firstName()} ${tree.$.user.profile.lastName()}`,
        age: tree.$.user.profile.age(),
        isDarkMode: tree.$.user.settings.theme() === 'dark',
      }));

      const summary = userSummary();
      expect(summary.fullName).toBe('John Doe');
      expect(summary.age).toBe(30);
      expect(summary.isDarkMode).toBe(true);

      tree.$.user.settings.theme.set('light');
      expect(userSummary().isDarkMode).toBe(false);
    });
  });

  it('should only recompute when dependencies change', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({
        a: 1,
        b: 2,
        c: 3,
      }).with(withComputed());

      let computeCount = 0;
      const sumAB = tree.computed(() => {
        computeCount++;
        return tree.$.a() + tree.$.b();
      });

      sumAB();
      expect(computeCount).toBe(1);

      // Change unrelated property
      tree.$.c.set(10);
      sumAB();
      expect(computeCount).toBe(1); // Should not recompute

      // Change dependent property
      tree.$.a.set(5);
      sumAB();
      expect(computeCount).toBe(2); // Should recompute
    });
  });

  it('should work with empty trees', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({}).with(withComputed());

      const constant = tree.computed(() => 42);

      expect(constant()).toBe(42);
    });
  });

  it('should handle errors in computed functions', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({ value: 5 }).with(withComputed());

      const failing = tree.computed(() => {
        if (tree.$.value() === 0) {
          throw new Error('Division by zero');
        }
        return 10 / tree.$.value();
      });

      expect(failing()).toBe(2);

      tree.$.value.set(0);
      expect(() => failing()).toThrow('Division by zero');
    });
  });

  it('should work with batched updates', () => {
    TestBed.runInInjectionContext(() => {
      const tree = signalTree({ a: 1, b: 2 }, { batchUpdates: true }).with(
        withComputed()
      );

      let computeCount = 0;
      const sum = tree.computed(() => {
        computeCount++;
        return tree.$.a() + tree.$.b();
      });

      sum();
      computeCount = 0;

      // Batch multiple updates
      tree.transaction(() => {
        tree.$.a.set(5);
        tree.$.b.set(10);
      });

      sum();
      expect(computeCount).toBe(1); // Only computed once despite 2 updates
      expect(sum()).toBe(15);
    });
  });
});
