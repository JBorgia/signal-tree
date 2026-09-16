import { computed, ref } from 'vue';
import {
  entityMap,
  leaf,
  signalTree,
  restoration,
  type LeafDefinition,
} from '../index';

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

export function genericOpaqueLeaf<T>(value: T) {
  return signalTree({ value: leaf(value) });
}

export function genericEntityMarker<E extends { id: string }>() {
  return signalTree({
    rows: entityMap<E, string>({ selectId: (row) => row.id }),
  });
}

export function genericEnhancedEntityMarker<E extends { id: string }>() {
  return signalTree(
    { rows: entityMap<E, string>({ selectId: (row) => row.id }) },
    { enhancers: [restoration()] }
  );
}

export function genericDerivedEntityMarker<E extends { id: string }>() {
  return signalTree(
    { rows: entityMap<E, string>({ selectId: (row) => row.id }) },
    { derived: () => ({ label: () => 'rows' }) }
  );
}

class TerminalConstructor {
  constructor(readonly label: string) {}
}
const terminalValues = {
  weakMap: new WeakMap<object, string>(),
  weakSet: new WeakSet<object>(),
  bytes: new Uint8Array(2),
  buffer: new ArrayBuffer(2),
  view: new DataView(new ArrayBuffer(2)),
  promise: Promise.resolve(1),
  fn: (text: string) => text.length,
  ctor: TerminalConstructor,
};
const terminals = signalTree(terminalValues);
const weakMap: WeakMap<object, string> = terminals.$.weakMap.value;
const weakSet: WeakSet<object> = terminals.$.weakSet.value;
const bytes: Uint8Array = terminals.$.bytes.value;
const buffer: ArrayBuffer = terminals.$.buffer.value;
const view: DataView = terminals.$.view.value;
const promise: Promise<number> = terminals.$.promise.value;
const fn: (text: string) => number = terminals.$.fn.value;
const ctor: typeof TerminalConstructor = terminals.$.ctor.value;
const terminalSnapshot: typeof terminalValues = terminals.$();
// @ts-expect-error WeakMap methods belong to the payload, not child locations
void terminals.$.weakMap.get;
// @ts-expect-error WeakSet methods belong to the payload, not child locations
void terminals.$.weakSet.has;
// @ts-expect-error typed array elements are payload, not child locations
void terminals.$.bytes[0];
// @ts-expect-error DataView methods belong to the payload, not child locations
void terminals.$.view.getUint8;
// @ts-expect-error Promise methods belong to the payload, not child locations
void terminals.$.promise.then;
void [
  weakMap,
  weakSet,
  bytes,
  buffer,
  view,
  promise,
  fn,
  ctor,
  terminalSnapshot,
];
terminals.destroy();

const optionalDefinition: { data?: LeafDefinition<{ a: number }> } = {
  data: leaf({ a: 1 }),
};
const optionalTree = signalTree(optionalDefinition);
const optionalPayload: { a: number } | undefined = optionalTree.$.data?.value;
const optionalSnapshot: { data?: { a: number } } = optionalTree.$();
void [optionalPayload, optionalSnapshot];
optionalTree.destroy();

const unionDefinition: { data: LeafDefinition<number> | string } = {
  data: leaf(1),
};
const unionTree = signalTree(unionDefinition);
const unionPayload: number | string = unionTree.$.data.value;
const unionSnapshot: { data: number | string } = unionTree.$();
void [unionPayload, unionSnapshot];
unionTree.destroy();
