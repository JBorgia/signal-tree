import { computed, isRef, nextTick, watchEffect } from 'vue';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../index';

describe('@signal-tree/vue observation', () => {
  it('tracks direct dot-path reads without replacing kernel locations', () => {
    const tree = signalTree({ profile: { name: 'Ada' } });
    const name = computed(() => tree.$.profile.name());

    expect(isRef(tree.$.profile.name)).toBe(false);
    expect(name.value).toBe('Ada');

    tree.$.profile.name.set('Grace');

    expect(name.value).toBe('Grace');
  });

  it('does not recompute a Vue consumer for an unrelated location', () => {
    const tree = signalTree({ selected: 1, unrelated: 1 });
    let runs = 0;
    const selected = computed(() => {
      runs += 1;
      return tree.$.selected();
    });

    expect(selected.value).toBe(1);
    tree.$.unrelated.set(2);
    expect(selected.value).toBe(1);
    expect(runs).toBe(1);

    tree.$.selected.set(2);
    expect(selected.value).toBe(2);
    expect(runs).toBe(2);
  });

  it('observes one kernel-owned derived location', () => {
    const tree = signalTree(
      { count: 2 },
      { derived: ($) => ({ doubled: () => $.count() * 2 }) }
    );
    const doubled = computed(() => tree.$.doubled());

    expect(doubled.value).toBe(4);
    tree.$.count.set(3);
    expect(doubled.value).toBe(6);
  });

  it('does not subscribe a watchEffect to a location it only writes', async () => {
    const tree = signalTree({ source: 0, target: 0 });
    const observedTarget = computed(() => tree.$.target());
    expect(observedTarget.value).toBe(0);
    let runs = 0;
    const stop = watchEffect(() => {
      tree.$.source();
      runs += 1;
      tree.$.target.set(runs);
    });
    await nextTick();

    tree.$.target.set(10);
    await nextTick();

    expect(runs).toBe(1);
    stop();
  });
});
