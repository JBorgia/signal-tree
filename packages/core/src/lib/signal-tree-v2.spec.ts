/**
 * SignalTree v2.0 Architecture Tests
 * Tests for the new simplified, non-proxy implementation
 */

import { signalTree } from './signal-tree';
import { unwrap } from './utils';
import type { SignalTree } from './types';

describe('SignalTree v2.0 Architecture', () => {
  describe('Basic Usage', () => {
    it('should create a signal tree with direct signal access', () => {
      const tree = signalTree({ count: 0, user: { name: 'John' } });

      expect(tree).toBeDefined();
      expect(tree.$).toBeDefined();
      expect(tree.state).toBeDefined();
      expect(tree.with).toBeDefined();

      // Verify state is an alias for $
      expect(tree.state).toBe(tree.$);
    });

    it('should access signals directly without proxies', () => {

  describe('Performance', () => {
    it('should have minimal overhead for direct signal access', () => {
      const tree = signalTree({
        level1: {
          level2: {
            level3: {
              value: 'test',
            },
          },
        },
      });

      const start = performance.now();

      // Direct access - no proxy overhead
      for (let i = 0; i < 1000; i++) {
        const value = tree.$.level1.level2.level3.value();
        if (value !== 'test') throw new Error('Unexpected value');
      }

      const end = performance.now();
      const time = end - start;

      console.log(
        `Direct access time: ${time.toFixed(3)}ms for 1000 operations`
      );

      // Should be very fast without proxy overhead
      expect(time).toBeLessThan(10);
    });

    it('should handle deep nesting efficiently', () => {
      const deepObject = {
        l1: { l2: { l3: { l4: { l5: { value: 'deep' } } } } },
      };

      const start = performance.now();
      const tree = signalTree(deepObject);
      const createTime = performance.now() - start;

      const accessStart = performance.now();
      const value = tree.$.l1.l2.l3.l4.l5.value();
      const accessTime = performance.now() - accessStart;

      console.log(`Deep tree creation: ${createTime.toFixed(3)}ms`);
      console.log(`Deep access time: ${accessTime.toFixed(3)}ms`);

      expect(value).toBe('deep');
      expect(createTime).toBeLessThan(5);
      expect(accessTime).toBeLessThan(1);
    });
  });

  describe('Enhancer Composition', () => {
    it('should support basic enhancer composition', () => {
      const tree = signalTree({ count: 0 });

      // Simple enhancer that adds a method
      const withIncrement = (tree: SignalTree<{ count: number }>) => ({
        ...tree,
        increment() {
          tree.$.count.update((c: number) => c + 1);
        },
      });

      const enhanced = tree.with(withIncrement);

      expect(typeof enhanced.increment).toBe('function');
      enhanced.increment();
      expect(enhanced.$.count()).toBe(1);
    });

    it('should support multiple enhancer composition', () => {
      const tree = signalTree({ count: 0 });

      const withIncrement = (tree: SignalTree<{ count: number }>) => ({
        ...tree,
        increment() {
          tree.$.count.update((c: number) => c + 1);
        },
      });

      const withDecrement = (tree: SignalTree<{ count: number }>) => ({
        ...tree,
        decrement() {
          tree.$.count.update((c: number) => c - 1);
        },
      });

      const enhanced = tree.with(withIncrement, withDecrement);

      expect(typeof enhanced.increment).toBe('function');
      expect(typeof enhanced.decrement).toBe('function');

      enhanced.increment();
      enhanced.increment();
      enhanced.decrement();

      expect(enhanced.$.count()).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for nested objects', () => {
      interface User {
        name: string;
        age: number;
        settings: {
          theme: 'light' | 'dark';
          notifications: boolean;
        };
      }

      const tree = signalTree<{ user: User }>({
        user: {
          name: 'John',
          age: 30,
          settings: {
            theme: 'light',
            notifications: true,
          },
        },
      });

      // These should be type-safe
      tree.$.user.name.set('Jane');
      tree.$.user.age.set(25);
      tree.$.user.settings.theme.set('dark');
      tree.$.user.settings.notifications.set(false);

      // Verify values
      expect(tree.$.user.name()).toBe('Jane');
      expect(tree.$.user.age()).toBe(25);
      expect(tree.$.user.settings.theme()).toBe('dark');
      expect(tree.$.user.settings.notifications()).toBe(false);
    });
  });

  describe('Arrays and Built-in Objects', () => {
    it('should handle arrays as signals', () => {
      const tree = signalTree({
        items: [1, 2, 3],
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      });

      expect(unwrap(tree.$.items)).toEqual([1, 2, 3]);
      expect(unwrap(tree.$.users)).toEqual([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]);

      // Update arrays
      tree.$.items.set([4, 5, 6]);
      tree.$.users.set([{ name: 'Bob', age: 35 }]);

      expect(unwrap(tree.$.items)).toEqual([4, 5, 6]);
      expect(unwrap(tree.$.users)).toEqual([{ name: 'Bob', age: 35 }]);
    });

    it('should handle Date objects as signals', () => {
      const now = new Date();
      const tree = signalTree({
        createdAt: now,
        updatedAt: new Date('2023-01-01'),
      });

      expect(tree.$.createdAt()).toBe(now);
      expect(tree.$.updatedAt()).toEqual(new Date('2023-01-01'));

      const newDate = new Date('2024-01-01');
      tree.$.createdAt.set(newDate);
      expect(tree.$.createdAt()).toBe(newDate);
    });
  });
});
