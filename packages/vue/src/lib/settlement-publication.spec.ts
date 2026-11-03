import { describe, expect, it } from 'vitest';
import {
  computed,
  effect,
  isReadonly,
  isRef,
  nextTick,
  stop,
  shallowRef,
  triggerRef,
  toValue,
  unref,
  watch,
  watchEffect,
  type ComputedRef,
} from 'vue';

import {
  entityMap,
  signalTree,
  transactions,
  type PendingTransaction,
} from '../index';
import { createVueObservationAdapter } from './vue-observation';

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) {
    throw new Error('Missing required test value');
  }
  return value;
}

type Row = { id: string; value: number };
const build = () => {
  const tree = signalTree(
    {
      scalar: 0,
      left: entityMap<Row, string>({ selectId: (row) => row.id }),
      right: entityMap<Row, string>({ selectId: (row) => row.id }),
    },
    { enhancers: [transactions()] }
  );
  tree.$.left.addOne({ id: 'A', value: 0 });
  tree.$.right.addOne({ id: 'A', value: 0 });
  return tree;
};

describe('Vue owned collection publication', () => {
  it('retains native readonly ref identity and watch/effect interoperability', async () => {
    const tree = build();
    const held = tree.$.left.all;
    const effects: number[] = [];
    const watched: number[] = [];
    const runner = effect(() => effects.push(required(held.value[0]).value));
    const stopWatch = watch(
      held,
      (rows) => watched.push(required(rows[0]).value),
      {
        flush: 'sync',
      }
    );
    try {
      expect(held).toBe(tree.$.left.all);
      expect(isRef(held)).toBe(true);
      expect(isReadonly(held)).toBe(true);
      expect(held.effect).toBeDefined();
      expect(unref(held)).toBe(held.value);
      expect(toValue(held)).toBe(held.value);
      tree.$.left.updateOne('A', { value: 1 });
      await nextTick();
      expect(effects).toContain(1);
      expect(watched).toContain(1);
      expect(required(held.value[0]).value).toBe(1);
    } finally {
      stop(runner);
      stopWatch();
      tree.destroy();
    }
  });

  it('publishes rollback with both owned collections coherent', async () => {
    const tree = build();
    let phase = 'setup';
    const seen: { phase: string; values: number[] }[] = [];
    const dispose = watchEffect(
      () => {
        seen.push({
          phase,
          values: [
            tree.$.scalar.value,
            required(tree.$.left.all.value[0]).value,
            required(tree.$.right.all.value[0]).value,
          ],
        });
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.left.updateOne('A', { value: 1 });
        tree.$.right.updateOne('A', { value: 1 });
      });
      await nextTick();
      expect(seen.at(-1)?.values).toEqual([1, 1, 1]);
      phase = 'rollback';
      pending.rollback();
      phase = 'delivered';
      await nextTick();
      const settlement = seen.filter(
        (entry) => entry.phase === 'rollback' || entry.phase === 'delivered'
      );
      expect(settlement.length).toBeGreaterThan(0);
      for (const entry of settlement) expect(entry.values).toEqual([0, 0, 0]);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('preserves held and native caches inside a reentrant authored group', async () => {
    const tree = build();
    const held = tree.$.left.all;
    const native = computed(() => held.value.map((row) => row.value));
    void native.value;
    let phase = 'setup';
    let reentered = false;
    let nested: PendingTransaction | undefined;
    const reads: {
      held: readonly Row[];
      before: readonly Row[];
      native: number[];
      nativeBefore: number[];
    }[] = [];
    const dispose = watchEffect(
      () => {
        const scalar = tree.$.scalar.value;
        void held.value;
        if (phase !== 'rollback' || scalar !== 0 || reentered) return;
        reentered = true;
        const before = held.value;
        const nativeBefore = native.value;
        nested = tree.transact(() => {
          tree.$.left.updateOne('A', { value: 9 });
          reads.push({
            held: held.value,
            before,
            native: native.value,
            nativeBefore,
          });
        });
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.left.updateOne('A', { value: 1 });
      });
      await nextTick();
      phase = 'rollback';
      pending.rollback();
      phase = 'after-rollback';
      expect(reentered).toBe(true);
      expect(reads).toHaveLength(1);
      expect(required(reads[0]).before).toEqual([{id:'A',value:0}]);
      expect(required(reads[0]).held).toEqual([{id:'A',value:9}]);
      expect(required(reads[0]).native).toBe(required(reads[0]).nativeBefore);
      expect(nested).toBeDefined();
      required(nested).confirm();
      await nextTick();
      expect(tree.$.left.byId('A')?.()?.value).toBe(9);
      expect(required(held.value[0]).value).toBe(9);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('tracks switched dependencies and stops observers without unrelated delivery', () => {
    const adapter = createVueObservationAdapter();
    const choice = adapter.createToken();
    const left = adapter.createToken();
    const right = adapter.createToken();
    const unrelated = adapter.createToken();
    let useLeft = true;
    let leftValue = 1;
    let rightValue = 2;
    const cell = required(adapter.createReadonlyCell).call(adapter, () => {
      choice.observe();
      if (useLeft) {
        left.observe();
        return leftValue;
      }
      right.observe();
      return rightValue;
    }) as unknown as ComputedRef<number>;
    const seen: number[] = [];
    const dispose = watchEffect(
      () => {
        seen.push(cell.value);
      },
      { flush: 'sync' }
    );
    try {
      expect(seen.at(-1)).toBe(1);
      adapter.runInvalidationGroup(() => {
        useLeft = false;
        choice.invalidate();
      });
      expect(seen.at(-1)).toBe(2);
      const switched = [...seen];
      adapter.runInvalidationGroup(() => {
        leftValue = 3;
        left.invalidate();
        unrelated.invalidate();
      });
      expect(seen).toEqual(switched);
      adapter.runInvalidationGroup(() => {
        rightValue = 4;
        right.invalidate();
      });
      expect(seen.at(-1)).toBe(4);
      dispose();
      const stopped = [...seen];
      adapter.runInvalidationGroup(() => {
        rightValue = 5;
        right.invalidate();
      });
      expect(seen).toEqual(stopped);
    } finally {
      dispose();
    }
  });

  it('does not evaluate an already refreshed native getter twice for the same read', () => {
    const adapter = createVueObservationAdapter();
    const token = adapter.createToken();
    let evaluations = 0;
    const cell = required(adapter.createReadonlyCell).call(adapter, () => {
      token.observe();
      return ++evaluations;
    }) as unknown as ComputedRef<number>;
    const seen: number[] = [];
    const dispose = watchEffect(
      () => {
        seen.push(cell.value);
      },
      { flush: 'sync' }
    );
    try {
      expect(evaluations).toBe(1);
      adapter.runInvalidationGroup(() => token.invalidate());
      expect(seen).toEqual([1, 2]);
      expect(evaluations).toBe(2);
    } finally {
      dispose();
    }
  });

  it.each([
    ['body Error', true, new Error('body first')],
    ['body undefined', true, undefined],
    ['observer Error', false, new Error('observer first')],
  ] as const)(
    'preserves the first %s while delivering sibling invalidations',
    (_, bodyFails, first) => {
      const adapter = createVueObservationAdapter();
      const failing = adapter.createToken();
      const sibling = adapter.createToken();
      let armed = false;
      let siblingDelivered = false;
      const failingEffect = effect(() => {
        failing.observe();
        if (armed) throw bodyFails ? new Error('later observer') : first;
      });
      const siblingEffect = effect(() => {
        sibling.observe();
        if (armed) siblingDelivered = true;
      });
      let caught = false;
      let failure: unknown;
      try {
        try {
          adapter.runInvalidationGroup(() => {
            armed = true;
            failing.invalidate();
            sibling.invalidate();
            if (bodyFails) throw first;
          });
        } catch (error) {
          caught = true;
          failure = error;
        }
        expect(caught).toBe(true);
        expect(failure).toBe(first);
        expect(siblingDelivered).toBe(true);
      } finally {
        stop(failingEffect);
        stop(siblingEffect);
      }
    }
  );

  it('retains native Vue handling of observer throw undefined', () => {
    // Vue's triggerRef swallows an effect's thrown undefined before the adapter
    // receives it. The first failed propagation assertion and the standalone
    // native control are preserved in the publication-boundary evidence packet.
    // This is native behavior, not a SignalTree error-propagation guarantee.
    const revision = shallowRef(0);
    let nativeArmed = false;
    let nativeRuns = 0;
    const nativeEffect = effect(() => {
      void revision.value;
      nativeRuns++;
      if (nativeArmed) throw undefined;
    });
    const adapter = createVueObservationAdapter();
    const token = adapter.createToken();
    const sibling = adapter.createToken();
    let armed = false;
    let runs = 0;
    let siblingDelivered = false;
    const failingEffect = effect(() => {
      token.observe();
      runs++;
      if (armed) throw undefined;
    });
    const siblingEffect = effect(() => {
      sibling.observe();
      if (armed) siblingDelivered = true;
    });
    try {
      nativeArmed = true;
      expect(() => triggerRef(revision)).not.toThrow();
      expect(nativeRuns).toBe(2);
      expect(() =>
        adapter.runInvalidationGroup(() => {
          armed = true;
          token.invalidate();
          sibling.invalidate();
        })
      ).not.toThrow();
      expect(runs).toBe(2);
      expect(siblingDelivered).toBe(true);
    } finally {
      stop(nativeEffect);
      stop(failingEffect);
      stop(siblingEffect);
    }
  });

  it('memoizes allocating readonly getters across unrelated publication', () => {
    const adapter = createVueObservationAdapter();
    const token = adapter.createToken();
    let computes = 0;
    const owned = required(adapter.createReadonlyCell).call(adapter, () => ({
      value: ++computes,
    }));
    const initial = owned();
    const rows: { same: boolean; sameInitial: boolean }[] = [];
    const dispose = watchEffect(
      () => {
        token.observe();
        const x = owned();
        const y = owned();
        rows.push({ same: x === y, sameInitial: x === initial });
      },
      { flush: 'sync' }
    );
    try {
      adapter.runInvalidationGroup(() => token.invalidate());
      expect(rows.length).toBeGreaterThan(1);
      expect(rows.every((row) => row.same)).toBe(true);
      expect(computes).toBe(1);
    } finally {
      dispose();
    }
  });
});
