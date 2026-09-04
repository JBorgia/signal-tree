import { describe, expect, it } from 'vitest';

import { signalTree } from '../signal-tree';

describe('auto-batching in signalTree callable', () => {
  it('should auto-batch partial object updates', () => {
    const tree = signalTree({
      user: { name: 'Alice', age: 30 },
    });

    // Partial update with object should be batched
    tree.$.user({ name: 'Bob', age: 30 });

    expect(tree.$.user()).toEqual({ name: 'Bob', age: 30 });
  });

  it('should auto-batch function updates on object nodes', () => {
    const tree = signalTree({
      user: { name: 'Alice', score: 0 },
    });

    // Function update should be batched (returns new object)
    tree.$.user((prev) => ({ ...prev, score: prev.score + 10 }));

    expect(tree.$.user()).toEqual({ name: 'Alice', score: 10 });
  });

  it('should use .set() for primitive leaf updates', () => {
    const tree = signalTree({
      count: 0,
    });

    // Primitives use .set() method, not callable
    tree.$.count.set(1);

    expect(tree.$.count()).toBe(1);
  });

  it('should use .set() for array replacement', () => {
    const tree = signalTree({
      items: ['a', 'b'],
    });

    // Arrays use .set() method for full replacement
    tree.$.items.set(['x', 'y', 'z']);
    expect(tree.$.items()).toEqual(['x', 'y', 'z']);
  });

  it('should handle nested partial updates', () => {
    const tree = signalTree({
      settings: {
        theme: 'dark',
        notifications: { email: true, push: false },
      },
    });

    // Partial update at nested level
    tree.$.settings.notifications({ email: false, push: false });

    expect(tree.$.settings.notifications()).toEqual({
      email: false,
      push: false,
    });
  });

  it('should handle function update that returns partial', () => {
    const tree = signalTree({
      user: { name: 'Alice', score: 0 },
    });

    // Function that returns modified object
    tree.$.user((prev) => ({ ...prev, score: prev.score + 10 }));

    expect(tree.$.user()).toEqual({ name: 'Alice', score: 10 });
  });

  // ⚠️ THESE THREE TESTS WERE FRAMED AROUND `batchScope`, WHICH WAS DELETED IN
  // 15.0 (BD-C: a counter with no production reader, wrapping a call it did not
  // change). Two of them were titled "verify batchScope is called" while
  // asserting only VALUES — a test proving traversal passed through a dead
  // wrapper is not a product contract.
  //
  // The value claims ARE independently surviving behaviour — several writes in
  // one statement all commit, for object and updater forms — so they are kept
  // and re-titled against what they actually verify.

  it('several writes across branches all commit', () => {
    const tree = signalTree({
      a: { value: 1 },
      b: { value: 2 },
      c: { value: 3 },
    });

    tree.$.a({ value: 10 });
    tree.$.b({ value: 20 });
    tree.$.c({ value: 30 });

    expect(tree.$.a.value()).toBe(10);
    expect(tree.$.b.value()).toBe(20);
    expect(tree.$.c.value()).toBe(30);
  });

  it('an object argument writes every named child', () => {
    const tree = signalTree({
      data: { x: 1, y: 2 },
    });

    tree.$.data({ x: 5, y: 2 });
    expect(tree.$.data.x()).toBe(5);
    expect(tree.$.data.y()).toBe(2);
  });

  it('location subscribers observe only the completed branch value', () => {
    const tree = signalTree({ pair: { left: 0, right: 0 } });
    const seen: Array<{ left: number; right: number }> = [];
    const unsubscribe = tree.$.pair.left.subscribe(() => {
      seen.push(tree.$.pair());
    });

    tree.$.pair({ left: 1, right: 1 });

    expect(seen).toEqual([{ left: 1, right: 1 }]);
    unsubscribe();
  });

  it('an updater argument writes the value it returns', () => {
    const tree = signalTree({
      data: { x: 1, y: 2 },
    });

    tree.$.data((prev) => ({ ...prev, y: 10 }));
    expect(tree.$.data.x()).toBe(1);
    expect(tree.$.data.y()).toBe(10);
  });
});
