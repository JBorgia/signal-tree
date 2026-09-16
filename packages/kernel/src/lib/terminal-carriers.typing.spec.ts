import { leaf, signalTree, type LeafDefinition } from '../index';

class TerminalConstructor {
  constructor(readonly label: string) {}
}
const values = {
  weakMap: new WeakMap<object, string>(),
  weakSet: new WeakSet<object>(),
  bytes: new Uint8Array(2),
  buffer: new ArrayBuffer(2),
  view: new DataView(new ArrayBuffer(2)),
  promise: Promise.resolve(1),
  fn: (text: string) => text.length,
  ctor: TerminalConstructor,
};
const tree = signalTree(values);
const weakMap: WeakMap<object, string> = tree.$.weakMap();
const weakSet: WeakSet<object> = tree.$.weakSet();
const bytes: Uint8Array = tree.$.bytes();
const buffer: ArrayBuffer = tree.$.buffer();
const view: DataView = tree.$.view();
const promise: Promise<number> = tree.$.promise();
const fn: (text: string) => number = tree.$.fn();
const ctor: typeof TerminalConstructor = tree.$.ctor();
const snapshot: typeof values = tree.$();
// @ts-expect-error WeakMap is an opaque payload, not branch topology
void tree.$.weakMap.get;
// @ts-expect-error WeakSet is an opaque payload, not branch topology
void tree.$.weakSet.has;
// @ts-expect-error typed array elements are opaque payload, not branch topology
void tree.$.bytes[0];
// @ts-expect-error DataView methods are opaque payload, not branch topology
void tree.$.view.getUint8;
// @ts-expect-error Promise methods are opaque payload, not branch topology
void tree.$.promise.then;
void [weakMap, weakSet, bytes, buffer, view, promise, fn, ctor, snapshot];
tree.destroy();

const optionalDefinition: { data?: LeafDefinition<{ a: number }> } = {
  data: leaf({ a: 1 }),
};
const optional = signalTree(optionalDefinition);
const optionalPayload: { a: number } | undefined = optional.$.data?.();
const optionalSnapshot: { data?: { a: number } } = optional.$();
void [optionalPayload, optionalSnapshot];
optional.destroy();

const unionDefinition: { data: LeafDefinition<number> | string } = {
  data: leaf(1),
};
const union = signalTree(unionDefinition);
const unionPayload: number | string = union.$.data();
const unionSnapshot: { data: number | string } = union.$();
void [unionPayload, unionSnapshot];
union.destroy();
