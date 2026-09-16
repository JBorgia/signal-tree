import { computed, ref } from 'vue';
import { leaf, signalTree, restoration } from '../index';

const existing = ref(1);
// @ts-expect-error a prebuilt reactive primitive is not a state definition
signalTree({ count: existing });
// @ts-expect-error nested branches reject external primitives too
signalTree({ nested: { count: existing } });
// @ts-expect-error readonly/computed primitives also have external ownership
signalTree({ count: computed(() => 1) });
// @ts-expect-error the root cannot be a reactive primitive
signalTree(existing);
// @ts-expect-error enhancer overload must not bypass validation
signalTree({ count: existing }, { enhancers: [restoration()] });
// @ts-expect-error derived overload must not bypass validation
signalTree({ count: existing }, { derived: () => ({ result: () => 1 }) });
const optional = {} as { count?: typeof existing };
// @ts-expect-error optional primitive fields remain invalid
signalTree(optional);
const union = {} as { count: number | typeof existing };
// @ts-expect-error union primitive fields remain invalid
signalTree(union);
const valid = signalTree(
  { data: leaf(existing), items: [existing] as const, count: 1 },
  {
    enhancers: [restoration()],
    derived: ($) => ({ doubled: () => $.count.value * 2 }),
  }
);
const value: number = valid.$.doubled.value;
const same: typeof existing = valid.$.data.value;
const canUndo: boolean = valid.canUndo();
void [value, same, canUndo];
valid.destroy();

// A generic scalar is already known to be plain state.
export function genericScalar<T extends number>(value: T) {
  return signalTree({ value });
}

export function genericEnhancedScalar<T extends number>(value: T) {
  return signalTree({ value }, { enhancers: [restoration()] });
}
export function genericDerivedScalar<T extends number>(value: T) {
  return signalTree({ value }, { derived: () => ({ result: () => value }) });
}

export function genericArray<T extends readonly number[]>(value: T) {
  return signalTree({ value });
}
export function genericDate<T extends Date>(value: T) {
  return signalTree({ value });
}
