import { effectScope, onScopeDispose, watchEffect } from 'vue';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../index';

describe('Vue tree ownership', () => {
  it('destroys a scope-owned tree when its owning scope stops', () => {
    const scope = effectScope();
    const tree = scope.run(() => {
      const owned = signalTree({ count: 1 });
      onScopeDispose(() => owned.destroy());
      return owned;
    });
    if (!tree) throw new Error('Expected an active owning scope');
    try {
      expect(tree.destroyed.value).toBe(false);
      tree.$.count.value = 2;
      expect(tree.$.count.value).toBe(2);
      scope.stop();
      expect(tree.destroyed.value).toBe(true);
    } finally {
      scope.stop();
      tree.destroy();
    }
  });

  it('stops borrowed observation without destroying the shared owner', () => {
    const tree = signalTree({ count: 1 });
    const first = effectScope();
    const second = effectScope();
    let firstValue = 0;
    let secondValue = 0;
    first.run(() =>
      watchEffect(
        () => {
          firstValue = tree.$.count.value;
        },
        { flush: 'sync' }
      )
    );
    second.run(() =>
      watchEffect(
        () => {
          secondValue = tree.$.count.value;
        },
        { flush: 'sync' }
      )
    );
    try {
      first.stop();
      expect(tree.destroyed.value).toBe(false);
      tree.$.count.value = 2;
      expect(firstValue).toBe(1);
      expect(secondValue).toBe(2);
      second.stop();
      expect(tree.destroyed.value).toBe(false);
      tree.destroy();
      expect(tree.destroyed.value).toBe(true);
    } finally {
      first.stop();
      second.stop();
      tree.destroy();
    }
  });

  it('isolates explicitly owned request trees', () => {
    const first = signalTree({ count: 1 });
    const second = signalTree({ count: 10 });
    try {
      first.$.count.value = 2;
      expect(second.$.count.value).toBe(10);
      first.destroy();
      expect(second.destroyed.value).toBe(false);
      second.$.count.value = 11;
      expect(second.$.count.value).toBe(11);
    } finally {
      first.destroy();
      second.destroy();
    }
    expect(first.destroyed.value).toBe(true);
    expect(second.destroyed.value).toBe(true);
  });
});
