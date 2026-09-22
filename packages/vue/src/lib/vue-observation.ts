import {
  computed,
  shallowRef,
  triggerRef,
  type ComputedRef,
  type ShallowRef,
} from 'vue';

import type {
  EpochHandle,
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

/**
 * The ref lives on the handle itself rather than in a side table: a `WeakMap`
 * entry per subject is exactly the per-entity allocation this design exists to
 * avoid.
 */
const EPOCH_REF = Symbol('signaltree.vue.epoch');

interface VueReadonlyCell<T> {
  (): T;
  readonly value: T;
  readonly __v_isRef: true;
  readonly effect: ComputedRef<T>['effect'];
}

interface VueWritableCell<T> extends VueReadonlyCell<T> {
  value: T;
  set(value: T): void;
  update(update: (current: T) => T): void;
  asReadonly(): VueReadonlyCell<T>;
}

const wrapReadonlyCell = <T>(source: ComputedRef<T>): VueReadonlyCell<T> => {
  const cell = (() => source.value) as VueReadonlyCell<T>;
  Object.defineProperties(cell, {
    __v_isRef: { value: true },
    __v_isReadonly: { value: true },
    effect: { value: source.effect },
    value: { get: () => source.value },
  });
  return cell;
};

const createReadonlyCell = <T>(read: () => T): VueReadonlyCell<T> =>
  wrapReadonlyCell(computed(read));

const createWritableCell = <T>(read: () => T): VueWritableCell<T> => {
  const cell = (() => read()) as VueWritableCell<T>;
  Object.defineProperties(cell, {
    __v_isRef: { value: true },
    value: {
      get: read,
      set: (value: T) => cell.set(value),
    },
  });
  cell.set = () => undefined;
  cell.update = (update) => cell.set(update(read()));
  let readonly: VueReadonlyCell<T> | undefined;
  cell.asReadonly = () => (readonly ??= createReadonlyCell(read));
  return cell;
};

export const createVueObservationAdapter = (): ObservationAdapter => {
  let invalidationGroupDepth = 0;
  const pendingInvalidations = new Set<() => void>();

  const scheduleInvalidation = (invalidate: () => void): void => {
    if (invalidationGroupDepth > 0) {
      pendingInvalidations.add(invalidate);
      return;
    }
    invalidate();
  };

  const createObservationToken = (): ObservationToken => {
    const revision = shallowRef(0);
    const invalidate = () => triggerRef(revision);
    return {
      observe: () => void revision.value,
      invalidate: () => scheduleInvalidation(invalidate),
    };
  };

  return {
    createToken: createObservationToken,

    createWritableCell: <T>(read: () => T) => {
      let published = read();
      const revision = shallowRef(0);
      const invalidate = () => triggerRef(revision);
      return {
        cell: createWritableCell(() => {
          void revision.value;
          return published;
        }),
        peek: read,
        token: {
          observe: () => void revision.value,
          invalidate: () => {
            published = read();
            scheduleInvalidation(invalidate);
          },
        },
      };
    },

    /**
     * `VUE-NATIVE-EPOCH-0`. Vue's own realization of a per-subject
     * invalidation anchor.
     *
     * An epoch carries no value anyone reads — it exists to be depended on and
     * advanced — so this is a `shallowRef` and a reader, with no writable-cell
     * record and no observation-token wrapper around it.
     *
     * Supplied as a PAIR with `advanceEpoch`, which is the load-bearing part.
     * The kernel never writes this handle: Vue creates it and Vue advances it.
     * An earlier design had the kernel write the adapter's cell directly, and
     * because Vue ships `cell.set` as an inert placeholder for the kernel to
     * replace, Vue's entity invalidation was silently dead. The pair makes that
     * class of defect unexpressible.
     *
     * Advancement goes through `scheduleInvalidation`, so a Vue invalidation
     * group batches epoch advances exactly like every other publication.
     */
    createEpoch: () => {
      const revision = shallowRef(0);
      const epoch = (() => revision.value) as EpochHandle & {
        [EPOCH_REF]?: typeof revision;
      };
      epoch[EPOCH_REF] = revision;
      return epoch;
    },

    advanceEpoch: (epoch) => {
      const revision = (epoch as EpochHandle & {
        [EPOCH_REF]?: ShallowRef<number>;
      })[EPOCH_REF];
      if (revision) scheduleInvalidation(() => triggerRef(revision));
    },

    createWritableProjection: <T>(computeValue: () => T) => ({
      cell: createWritableCell(computeValue),
      peek: computeValue,
    }),

    createReadonlyCell: <T>(computeValue: () => T) => {
      const source = computed(computeValue);
      return wrapReadonlyCell(source);
    },

    runInvalidationGroup(run): void {
      let failure: unknown;
      let hasFailure = false;
      invalidationGroupDepth += 1;
      try {
        run();
      } catch (error) {
        failure = error;
        hasFailure = true;
      } finally {
        invalidationGroupDepth -= 1;
        if (invalidationGroupDepth === 0 && pendingInvalidations.size > 0) {
          const invalidations = [...pendingInvalidations];
          pendingInvalidations.clear();
          for (const invalidate of invalidations) {
            try {
              invalidate();
            } catch (error) {
              if (!hasFailure) {
                failure = error;
                hasFailure = true;
              }
            }
          }
        }
      }
      if (hasFailure) throw failure;
    },
  };
};
