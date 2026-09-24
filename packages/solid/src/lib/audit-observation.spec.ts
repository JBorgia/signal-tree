import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { observeOwnerInvalidation } from '@signal-tree/kernel/adapter';
import { signalTree } from '../index';
import { createSolidObservationAdapter } from './solid-observation';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('audited Solid observation boundaries', () => {
  it('disposes a lazy derived memo with its creation owner', () => {
    const [source, set] = createSignal(1);
    const recipe = vi.fn(source);
    const { tree, dispose } = createRoot((dispose) => ({
      tree: signalTree({ n: 0 }, { derived: () => ({ value: recipe }) }),
      dispose,
    }));
    try {
      // First read outside the construction root must not change ownership.
      expect(tree.$.value()).toBe(1);
      set(2);
      expect(tree.$.value()).toBe(2);
      expect(recipe).toHaveBeenCalledTimes(2);
      dispose();
      tree.destroy();
      set(3);
      expect(recipe).toHaveBeenCalledTimes(2);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('disposes external derived dependencies on tree destruction alone', () => {
    const [source, set] = createSignal(1);
    const recipe = vi.fn(source);
    const tree = signalTree({ n: 0 }, { derived: () => ({ value: recipe }) });
    try {
      expect(tree.$.value()).toBe(1);
      set(2);
      expect(tree.$.value()).toBe(2);
      tree.destroy();
      tree.destroy();
      set(3);
      expect(recipe).toHaveBeenCalledTimes(2);
    } finally {
      tree.destroy();
    }
  });

  it('releases external dependencies when the adapter is disposed without a Solid owner', () => {
    const adapter = createSolidObservationAdapter();
    const [source, set] = createSignal(1);
    const recipe = vi.fn(source);
    const cell = adapter.createReadonlyCell?.(recipe);
    if (!cell) throw new Error('Solid readonly realization missing');
    expect(cell()).toBe(1);
    set(2);
    expect(cell()).toBe(2);
    expect(recipe).toHaveBeenCalledTimes(2);
    adapter.dispose();
    adapter.dispose();
    set(3);
    expect(recipe).toHaveBeenCalledTimes(2);
  });

  it('does not acquire a persistent dependency after disposal before first read', () => {
    const adapter = createSolidObservationAdapter();
    const [source, set] = createSignal(1);
    const recipe = vi.fn(source);
    const cell = adapter.createReadonlyCell?.(recipe);
    if (!cell) throw new Error('Solid readonly realization missing');
    adapter.dispose();
    expect(cell()).toBe(1);
    set(2);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('preserves signed zero in derived values', () => {
    const tree = signalTree(
      { n: 1 },
      { derived: ($) => ({ copy: () => ($.n() === 1 ? -0 : 0) }) }
    );
    try {
      expect(tree.$.copy()).toBe(-0);
      tree.$.n.set(2);
      expect(tree.$.copy()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  for (const acquireAfterOmission of [false, true]) {
    for (const next of [1, 2]) {
      it(`observes reactivation to ${next}, observation after omission=${acquireAfterOmission}`, async () => {
        const tree = signalTree({ user: { age: 1 } as { age?: number } });
        const held = tree.$.user.age;
        if (!held) throw new Error('Missing age location');
        const notified = vi.fn();
        let off = () => undefined as void;
        try {
          if (!acquireAfterOmission)
            off = observeOwnerInvalidation(tree, notified);
          tree.$.user({});
          await settle();
          if (acquireAfterOmission)
            off = observeOwnerInvalidation(tree, notified);
          notified.mockClear();
          held.update(() => next);
          await settle();
          expect(held()).toBe(next);
          expect(notified).toHaveBeenCalledTimes(1);
        } finally {
          off();
          tree.destroy();
        }
      });
    }
  }
});
