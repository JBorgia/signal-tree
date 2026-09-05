import { computed, shallowRef, triggerRef, type ShallowRef } from 'vue';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

interface VueReadonlyCell<T> {
  (): T;
  readonly value: T;
  readonly __v_isRef: true;
}

interface VueWritableCell<T> extends VueReadonlyCell<T> {
  value: T;
  set(value: T): void;
  update(update: (current: T) => T): void;
  asReadonly(): VueReadonlyCell<T>;
}

const createReadonlyCell = <T>(read: () => T): VueReadonlyCell<T> => {
  const cell = (() => read()) as VueReadonlyCell<T>;
  Object.defineProperties(cell, {
    __v_isRef: { value: true },
    __v_isReadonly: { value: true },
    value: { get: read },
  });
  return cell;
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

export const VUE_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken(): ObservationToken {
    const revision = shallowRef(0);
    return {
      observe: () => void revision.value,
      invalidate: () => {
        triggerRef(revision);
      },
    };
  },

  createWritableCell: <T>(read: () => T) => {
    let published = read();
    const state = shallowRef(published) as ShallowRef<T>;
    const publish = (value: T): void => {
      if (Object.is(published, value)) {
        triggerRef(state);
        return;
      }
      published = value;
      state.value = value;
    };
    return {
      cell: createWritableCell(() => state.value),
      peek: read,
      token: {
        observe: () => void state.value,
        invalidate: () => publish(read()),
      },
    };
  },

  createWritableProjection: <T>(computeValue: () => T) => {
    const source = computed(computeValue);
    return {
      cell: createWritableCell(() => source.value),
      peek: () => source.value,
    };
  },

  createReadonlyCell: <T>(computeValue: () => T) => {
    const source = computed(computeValue);
    return createReadonlyCell(() => source.value);
  },

  runInvalidationGroup(run): void {
    run();
  },
};
