import type { CallableSyntax, LeafDefinition } from '../leaf';
import type { EntityMapMarker } from '../types';

/** Object terminals recognized by the runtime in every environment. */
export type BuiltInObjectValue =
  | Date
  | RegExp
  | Map<unknown, unknown>
  | Set<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | ArrayBufferView
  | Error
  | Promise<unknown>;

// Leaf definitions stop interpretation: their payload may itself contain markers.
export type SnapshotValue<
  T,
  Input extends boolean = false
> = T extends LeafDefinition<infer Value>
  ? Value
  : T extends EntityMapMarker<infer E, infer _Key>
  ? Input extends true
    ? { all: E[] } | E[]
    : { all: E[] }
  : T extends readonly unknown[] | BuiltInObjectValue | CallableSyntax
  ? T
  : T extends object
  ? { [K in keyof T]: SnapshotValue<T[K], Input> }
  : T;

// Type-only provenance: no runtime property or required public brand.
declare const NODE_CONSTRUCTION: unique symbol;

export type NodeConstruction<T> = {
  readonly [NODE_CONSTRUCTION]?: T;
};

export type ConstructionOf<S, Fallback> =
  typeof NODE_CONSTRUCTION extends keyof S
    ? S extends NodeConstruction<infer T>
      ? T
      : Fallback
    : Fallback;

export type ConstructionAccessor<Read, Input, Definition> = {
  (): Read;
  (value: Input): void;
  (updater: (current: Read) => Input): void;
} & NodeConstruction<Definition>;
