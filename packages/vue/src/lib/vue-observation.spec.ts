import {
  computed,
  isRef,
  isReadonly,
  nextTick,
  toValue,
  unref,
  watch,
  watchEffect,
} from 'vue';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

describe('@signal-tree/vue observation', () => {
  it('tracks native ref reads while kernel snapshots remain canonical', () => {
    const tree = signalTree({ profile: { name: 'Ada' } });
    const name = computed(() => tree.$.profile.name.value);

    expect(isRef(tree.$.profile.name)).toBe(true);
    expect(name.value).toBe('Ada');

    tree.$.profile.name.value = 'Grace';

    expect(tree.$()).toEqual({ profile: { name: 'Grace' } });
    expect(name.value).toBe('Grace');
  });

  it('does not recompute a Vue consumer for an unrelated location', () => {
    const tree = signalTree({ selected: 1, unrelated: 1 });
    let runs = 0;
    const selected = computed(() => {
      runs += 1;
      return tree.$.selected.value;
    });

    expect(selected.value).toBe(1);
    tree.$.unrelated.value = 2;
    expect(selected.value).toBe(1);
    expect(runs).toBe(1);

    tree.$.selected.value = 2;
    expect(selected.value).toBe(2);
    expect(runs).toBe(2);
  });

  it('observes one kernel-owned derived location', () => {
    const tree = signalTree(
      { count: 2 },
      { derived: ($) => ({ doubled: () => $.count.value * 2 }) }
    );
    const doubled = computed(() => tree.$.doubled.value);

    expect(isRef(tree.$.doubled)).toBe(true);
    expect(isReadonly(tree.$.doubled)).toBe(true);
    expect(doubled.value).toBe(4);
    tree.$.count.value = 3;
    expect(doubled.value).toBe(6);
  });

  it('realizes EntityMap queries and fields as native refs', () => {
    const tree = signalTree({
      users: entityMap<{ id: number; name: string }, number>(),
    });
    tree.$.users.addOne({ id: 1, name: 'Ada' });

    const user = tree.$.users.byIdOrFail(1);
    expect(isRef(tree.$.users.all)).toBe(true);
    expect(isRef(user.name)).toBe(true);

    user.name.value = 'Grace';

    expect(tree.$.users.all.value).toEqual([{ id: 1, name: 'Grace' }]);
    tree.destroy();
  });

  it('interoperates with Vue ref consumers despite its internal callable bridge', async () => {
    const tree = signalTree({ count: 1 });
    const seen: Array<[number, number]> = [];
    const stop = watch(tree.$.count, (value, previous) => {
      seen.push([value, previous]);
    });

    expect(unref(tree.$.count)).toBe(1);
    expect(toValue(tree.$.count)).toBe(1);

    tree.$.count.value = 2;
    await nextTick();

    expect(seen).toEqual([[2, 1]]);
    stop();
    tree.destroy();
  });

  it('does not subscribe a watchEffect to a location it only writes', async () => {
    const tree = signalTree({ source: 0, target: 0 });
    const observedTarget = computed(() => tree.$.target.value);
    expect(observedTarget.value).toBe(0);
    let runs = 0;
    const stop = watchEffect(() => {
      void tree.$.source.value;
      runs += 1;
      tree.$.target.value = runs;
    });
    await nextTick();

    tree.$.target.value = 10;
    await nextTick();

    expect(runs).toBe(1);
    stop();
  });
});
