import { computed, signal, untracked } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { entityMap, leaf, restoration, signalTree, undoable } from '../index';

// Simulate JS callers/type erasure: runtime diagnostics must stand on their own.
const construct = signalTree as (state: object, config?: object) => unknown;

describe('angular construction input ownership', () => {
  it.each([signal(1), signal(1).asReadonly(), computed(() => 1)])(
    'rejects existing reactive values before derived initialization',
    (existing) => {
      const derived = vi.fn(() => ({}));
      expect(() =>
        construct({ nested: { count: existing } }, { derived })
      ).toThrow(/SignalTree: .* at \$\["nested"\]\["count"\].*leaf/);
      expect(derived).not.toHaveBeenCalled();
      expect(() => construct(existing)).toThrow(/at \$\./);
    }
  );

  it('rejects native leaves produced by another tree', () => {
    const source = signalTree(
      { count: 1 },
      { derived: ($) => ({ doubled: () => $.count() * 2 }) }
    );
    try {
      expect(() => construct({ count: source.$.count })).toThrow(/leaf/);
      expect(() => construct({ count: source.$.doubled })).toThrow(/leaf/);
    } finally {
      source.destroy();
    }
  });

  it('preserves explicit reactive data and an independent snapshot', async () => {
    const existing = signal(1);
    const tree = signalTree(
      { data: leaf(existing), count: leaf(untracked(existing)) },
      { enhancers: [restoration()] }
    );
    try {
      expect(tree.$.data()).toBe(existing);
      existing.set(2);
      expect(tree.$.count()).toBe(1);
      expect(tree.canUndo()).toBe(false);
      undoable(() => tree.$.count.set(3));
      await new Promise((resolve) => setTimeout(resolve, 0));
      tree.undo();
      expect(tree.$.count()).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('keeps terminal contents opaque and ordinary callable data valid', () => {
    const existing = signal(1);
    const items = [existing];
    const index = new Map([['count', existing]]);
    const fn = () => 7;
    const opaque = { count: existing };
    const tree = signalTree({
      items,
      index,
      fn,
      opaque: leaf(opaque),
      rows: entityMap<{ id: number }, number>(),
    });
    try {
      expect(tree.$.items()).toBe(items);
      expect(tree.$.index()).toBe(index);
      expect(tree.$.fn()).toBe(fn);
      expect(tree.$.opaque()).toBe(opaque);
      tree.$.rows.addOne({ id: 1 });
      expect(tree.$.rows.all()).toEqual([{ id: 1 }]);
    } finally {
      tree.destroy();
    }
  });

  it('preserves the kernel diagnostic for unregistered symbol markers', () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const tree = signalTree({
      pending: { [Symbol('unregistered')]: true, count: 1 },
    });
    try {
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('registerMarkerProcessor()')
      );
    } finally {
      tree.destroy();
      warning.mockRestore();
    }
  });

  it('validates class branches and reads accessor-backed definitions once', () => {
    class Branch {
      count = signal(1);
    }
    expect(() => construct({ branch: new Branch() })).toThrow(/branch/);
    let reads = 0;
    const tree = signalTree({
      get count() {
        return ++reads === 1 ? 1 : signal(1);
      },
    } as { count: number });
    try {
      expect(reads).toBe(1);
      expect(tree.$.count()).toBe(1);
    } finally {
      tree.destroy();
    }
  });
});
