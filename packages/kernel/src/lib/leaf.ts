const LEAF_DEFINITION = Symbol.for('SignalTree:LeafDefinition');

declare const LEAF_DEFINITION_TYPE: unique symbol;

type RuntimeLeafDefinition<T> = LeafDefinition<T> & {
  readonly [LEAF_DEFINITION]: T;
};

/**
 * Construction definition for a terminal value in the dot-path tree.
 *
 * SignalTree consumes this wrapper during construction and stores the raw
 * value. On an existing terminal location, the same wrapper disambiguates a
 * callable value from an updater for that invocation only.
 */
export interface LeafDefinition<T> {
  readonly [LEAF_DEFINITION_TYPE]: T;
}

/**
 * Declare that `value` is terminal state rather than traversable topology.
 *
 * The wrapper never enters state, snapshots, persistence, restoration, or
 * links. Reads return the original value by identity.
 */
export function leaf<T>(value: T): LeafDefinition<T> {
  const definition = {} as RuntimeLeafDefinition<T>;
  Object.defineProperty(definition, LEAF_DEFINITION, { value });
  return definition;
}

/** @internal */
export function isLeafDefinition(
  value: unknown
): value is LeafDefinition<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, LEAF_DEFINITION) &&
    Object.getOwnPropertyDescriptor(value, LEAF_DEFINITION)?.enumerable === false
  );
}

/** @internal */
export function leafDefinitionValue<T>(definition: LeafDefinition<T>): T {
  return (definition as RuntimeLeafDefinition<T>)[LEAF_DEFINITION];
}

/** Runtime values that authored callable syntax would otherwise invoke. */
export type CallableSyntax =
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);

/** The non-callable members of `T`. */
export type NonCallableValue<T> = T extends CallableSyntax ? never : T;

/** The callable or constructable members of `T`. */
export type CallablePart<T> = Extract<T, CallableSyntax>;
