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

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
  asReadonly,
} from '../index';
import { createVueObservationAdapter } from './vue-observation';

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
    expect(tree.$.doubled.effect).toBeDefined();
    expect(tree.destroyed.effect).toBeDefined();
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

  it('keeps writable ref identity in a type-only readonly view', () => {
    const tree = signalTree({ count: 1 });
    const reader = asReadonly(tree);

    expect(reader.$.count).toBe(tree.$.count);
    expect(isReadonly(reader.$.count)).toBe(false);
    expect('effect' in reader.$.count).toBe(false);

    tree.destroy();
  });

  it('publishes one coherent root replacement to synchronous watchers', () => {
    const tree = signalTree({ left: 0, right: 0 });
    const seen: Array<[number, number]> = [];
    const stop = watch(
      [tree.$.left, tree.$.right],
      ([left, right]) => seen.push([left, right]),
      { flush: 'sync' }
    );

    tree.$({ left: 1, right: 1 });

    expect(seen).toEqual([[1, 1]]);
    stop();
    tree.destroy();
  });

  it('publishes one coherent transaction to synchronous watchers', () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [transactions()] }
    );
    const seen: Array<[number, number]> = [];
    const stop = watch(
      [tree.$.left, tree.$.right],
      ([left, right]) => seen.push([left, right]),
      { flush: 'sync' }
    );

    const pending = tree.transaction(() => tree.$({ left: 1, right: 1 }));

    expect(seen).toEqual([[1, 1]]);
    pending.confirm();
    stop();
    tree.destroy();
  });

  it('does not invalidate unrelated derived carriers for a grouped write', () => {
    const names = Array.from({ length: 100 }, (_, index) => `derived${index}`);
    let computations = 0;
    const tree = signalTree(
      { left: 0, right: 0, untouched: 1 },
      {
        enhancers: [transactions()],
        derived: ($) =>
          Object.fromEntries(
            names.map((name, index) => [
              name,
              () => {
                computations += 1;
                return $.untouched.value + index;
              },
            ])
          ) as Record<string, () => number>,
      }
    );
    const stops = names.map((name) =>
        watchEffect(
          () => {
            void (
              tree.$ as unknown as Record<string, { readonly value: number }>
            )[name].value;
          },
          { flush: 'sync' }
        )
      );
    const before = computations;

    tree.transaction(() => tree.$({ left: 1, right: 1, untouched: 1 })).confirm();

    expect(computations).toBe(before);
    for (const stop of stops) stop();
    tree.destroy();
  });

  it('publishes one coherent EntityMap replacement to synchronous watchers', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>(),
    });
    tree.$.rows.setAll([
      { id: 'left', value: 0 },
      { id: 'right', value: 0 },
    ]);
    const left = tree.$.rows.byIdOrFail('left').value;
    const right = tree.$.rows.byIdOrFail('right').value;
    const seen: Array<[number, number]> = [];
    const stop = watch(
      [left, right],
      ([leftValue, rightValue]) => seen.push([leftValue, rightValue]),
      { flush: 'sync' }
    );

    tree.$.rows.setAll([
      { id: 'left', value: 1 },
      { id: 'right', value: 1 },
    ]);

    expect(seen).toEqual([[1, 1]]);
    stop();
    tree.destroy();
  });

  it('publishes one coherent undo to synchronous watchers', async () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [restoration()] }
    );
    const seen: Array<[number, number]> = [];
    const stop = watch(
      [tree.$.left, tree.$.right],
      ([left, right]) => seen.push([left, right]),
      { flush: 'sync' }
    );

    undoable(() => tree.$({ left: 1, right: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    seen.length = 0;
    tree.undo();

    expect(seen).toEqual([[0, 0]]);
    stop();
    tree.destroy();
  });

  it('flushes nested invalidations while preserving the mutation error', () => {
    const adapter = createVueObservationAdapter();
    const first = adapter.createToken();
    const second = adapter.createToken();
    const runs = [0, 0];
    const stopFirst = watchEffect(
      () => {
        first.observe();
        runs[0] += 1;
      },
      { flush: 'sync' }
    );
    const stopSecond = watchEffect(
      () => {
        second.observe();
        runs[1] += 1;
      },
      { flush: 'sync' }
    );
    const failure = new Error('mutation failed');

    expect(() =>
      adapter.runInvalidationGroup(() => {
        adapter.runInvalidationGroup(() => {
          first.invalidate();
          second.invalidate();
          throw failure;
        });
      })
    ).toThrow(failure);
    expect(runs).toEqual([2, 2]);

    stopFirst();
    stopSecond();
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
