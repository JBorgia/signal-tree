import { computed, signal, type Signal } from '@angular/core';
import {
  defineStore,
  entityMap,
  leaf,
  signalTree,
  restoration,
  type EntityMapMarker,
  type LeafDefinition,
} from '../index';

const existing = signal(1);
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
    derived: ($) => ({ doubled: () => $.count() * 2 }),
  }
);
const value: number = valid.$.doubled();
const same: typeof existing = valid.$.data();
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

// Marker definitions are opaque construction terminals even when their config
// contains callbacks whose entity/key types remain generic.
export function genericEntities<
  K extends string | number,
  E extends { id: K }
>() {
  const marker = entityMap<E, K>({ selectId: (entity) => entity.id });
  const plain = signalTree({ rows: marker });
  const enhanced = signalTree({ rows: marker }, { enhancers: [restoration()] });
  const derived = signalTree(
    { rows: marker },
    { derived: ($) => ({ count: () => $.rows.all().length }) }
  );
  const rows: E[] = plain.$.rows.all();
  const count: number = derived.$.count();
  const canUndo: boolean = enhanced.canUndo();
  return { plain, enhanced, derived, rows, count, canUndo };
}

interface GenericFeatureState<E, K extends string | number, F extends object> {
  feature: {
    rows: EntityMapMarker<E, K>;
    filter: LeafDefinition<F>;
  };
}

export function genericFeatureStore<
  K extends string | number,
  E extends { id: K },
  F extends object
>(filter: F) {
  const state: GenericFeatureState<E, K, F> = {
    feature: {
      rows: entityMap<E, K>({ selectId: (entity) => entity.id }),
      filter: leaf(filter),
    },
  };
  const createTree = () =>
    signalTree(state, {
      enhancers: [restoration()],
      derived: ($) => ({ filterCopy: () => $.feature.filter() }),
    });
  const tree = createTree();
  const filterCopy: F = tree.$.filterCopy();
  const Store = defineStore(createTree, { expose: 'readonly' });
  type Reader = InstanceType<typeof Store>;
  const checkReader = (reader: Reader): F => {
    // @ts-expect-error the readonly generic filter must not regain a setter
    reader.$.feature.filter.set(filter);
    return reader.$.filterCopy();
  };
  return { tree, filterCopy, Store, checkReader };
}

export function genericEntitySlices<
  K extends string | number,
  E extends { id: K }
>() {
  const tree = signalTree({
    rows: entityMap<E, K>({ selectId: (entity) => entity.id }).computed(
      'rowKeys',
      (rows) => rows.map((row) => row.id)
    ),
  });
  const ids: K[] = tree.$.rows.rowKeys();
  return { tree, ids };
}

export function opaqueGenericSignal<T>(value: Signal<T>) {
  const tree = signalTree({ value: leaf(value) });
  const original: Signal<T> = tree.$.value();
  // @ts-expect-error generic external signals remain invalid without leaf()
  signalTree({ value });
  // @ts-expect-error optional generic signals do not establish tree ownership
  signalTree({} as { value?: Signal<T> });
  // @ts-expect-error a nullable external signal still has external ownership
  signalTree({} as { value: Signal<T> | null });
  // @ts-expect-error a union branch must reject the member with external signals
  signalTree({} as { nested: { value: Signal<T> } | { count: number } });
  return { tree, original };
}

// Ordinary functions are data, including functions that return native signals.
export function ordinarySignalFactory() {
  const factory = (count: number): Signal<number> => signal(count);
  const tree = signalTree({ factory });
  const original: typeof factory = tree.$.factory();
  return { tree, original };
}

// Inline enhancer tuples must retain the same inference as hoisted tuples.
export function inlineCustomEnhancerAndDerived() {
  const tag = <T extends object>(tree: T): T & { tag(): number } =>
    Object.assign(tree, { tag: () => 1 });
  const tree = signalTree(
    { count: 1 },
    { enhancers: [tag], derived: ($) => ({ doubled: () => $.count() * 2 }) }
  );
  const tagged: number = tree.tag();
  const doubled: number = tree.$.doubled();
  return { tree, tagged, doubled };
}

export function inlineGenericEnhancerAndDerived<Value>(value: Value) {
  const tag = <Tree>(tree: Tree): Tree & { tag(): Value } =>
    Object.assign(tree as Tree & object, { tag: () => value });
  const tree = signalTree(
    { value: leaf(value) },
    { enhancers: [tag], derived: ($) => ({ copy: () => $.value() }) }
  );
  const tagged: Value = tree.tag();
  const copied: Value = tree.$.copy();
  return { tree, tagged, copied };
}

// Explicit source/derived type arguments remain supported; the enhancer type
// parameter is optional for this existing two-argument generic spelling.
export function explicitSourceAndDerivedTypes() {
  const tree = signalTree<{ count: number }, { doubled: () => number }>(
    { count: 1 },
    { derived: ($) => ({ doubled: () => $.count() * 2 }) }
  );
  const doubled: Signal<number> = tree.$.doubled;
  tree.$.count.set(2);
  // @ts-expect-error explicit generics must not turn source leaves into any
  tree.$.count.set('invalid');
  // @ts-expect-error derived recipes still produce readonly native signals
  tree.$.doubled.set(2);
  return { tree, doubled };
}
