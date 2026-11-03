import {
  computed,
  shallowRef,
  triggerRef,
  type ComputedRef,
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

const wrapReadonlyCell = <T>(
  source: ComputedRef<T>,
  read: () => T = () => source.value
): VueReadonlyCell<T> => {
  const cell = (() => read()) as VueReadonlyCell<T>;
  Object.defineProperties(cell, {
    __v_isRef: { value: true },
    __v_isReadonly: { value: true },
    effect: { value: source.effect },
    value: { get: read },
  });
  return cell;
};

const createReadonlyCell = <T>(read: () => T): VueReadonlyCell<T> =>
  wrapReadonlyCell(computed(read));

// The marker avoids double recipe execution on a native cache miss. Each
// invocation owns its frame so nested reads and exceptions restore the caller.
const createCurrentReadonlyCell = <T>(readCurrent: () => T): VueReadonlyCell<T> => {
  let active: { evaluated: boolean } | undefined;
  const source = computed(() => {
    if (active) active.evaluated = true;
    return readCurrent();
  });
  const read = (): T => {
    const previous = active;
    const frame = { evaluated: false };
    active = frame;
    try {
      // Vue may throw while polling a dependency before this recipe runs.
      // That is a fresh error, not evidence of a cached own-recipe failure.
      const value = source.value;
      return frame.evaluated ? value : readCurrent();
    } finally { active = previous; }
  };
  return wrapReadonlyCell(source, read);
};

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
  // One native publication dirties every participating dependency chain before
  // Vue starts synchronous effects. Per-token computed equality keeps unchanged
  // branches from recomputing their user-visible projections.
  const publication = shallowRef(0);
  let pendingInvalidation = false;

  const scheduleInvalidation = (): void => {
    if (invalidationGroupDepth > 0) {
      pendingInvalidation = true;
      return;
    }
    triggerRef(publication);
  };

  const createRevision = () => {
    let generation = 0;
    const revision = computed(() => {
      void publication.value;
      return generation;
    });
    return {
      read: () => revision.value,
      advance: () => {
        generation += 1;
        scheduleInvalidation();
      },
    };
  };

  const createObservationToken = (): ObservationToken => {
    const revision = createRevision();
    return {
      observe: () => void revision.read(),
      invalidate: revision.advance,
    };
  };

  return {
    createCurrentReadonlyCell,
    createToken: createObservationToken,

    createWritableCell: <T>(read: () => T) => {
      let published = read();
      const revision = createRevision();
      return {
        cell: createWritableCell(() => {
          void revision.read();
          return published;
        }),
        peek: read,
        token: {
          observe: () => void revision.read(),
          invalidate: () => {
            published = read();
            revision.advance();
          },
        },
      };
    },

    /** Subject identity remains kernel-owned; Vue owns its dependency nonce. */
    createEpoch: () => {
      const revision = createRevision();
      const epoch = revision.read as EpochHandle & {
        [EPOCH_REF]?: () => void;
      };
      epoch[EPOCH_REF] = revision.advance;
      return epoch;
    },

    advanceEpoch: (epoch) => {
      (epoch as EpochHandle & { [EPOCH_REF]?: () => void })[EPOCH_REF]?.();
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
        if (invalidationGroupDepth === 0 && pendingInvalidation) {
          pendingInvalidation = false;
          try {
            triggerRef(publication);
          } catch (error) {
            if (!hasFailure) {
              failure = error;
              hasFailure = true;
            }
          }
        }
      }
      if (hasFailure) throw failure;
    },
  };
};
