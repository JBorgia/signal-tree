/** Symbol key for enhancer metadata (stable public export). */
export const ENHANCER_META = Symbol('signaltree:enhancer:meta');

interface EnhancerHost {
  readonly $: unknown;
  destroy(): void;
  registerCleanup(fn: EnhancerCleanup): void;
}

type EnhancerCleanup = () => void;

/** Enhancer function that adds methods to a tree. */
export type Enhancer<TAdded> = (tree: EnhancerHost) => EnhancerHost & TAdded;

/** Enhancer with optional metadata for ordering/debugging. */
export type EnhancerWithMeta<TAdded> = Enhancer<TAdded> & {
  metadata?: EnhancerMeta;
};

export type TreeCapability =
  | 'mutation-capture'
  | 'position-topology'
  | 'causal-runtime'
  | 'temporal-snapshots';

/** Metadata for enhancer ordering and debugging. */
export interface EnhancerMeta {
  name?: string;
  requires?: string[];
  provides?: string[];
  capabilities?: TreeCapability[];
  description?: string;
}

/**
 * What a declared enhancer array adds to the tree's public surface.
 *
 * The chained builder accumulated added types one `.with()` at a time. A
 * declarative array has to recover the same information from a tuple, which is
 * what these three helpers do: extract each enhancer's `TAdded`, union them
 * across the tuple, then collapse the union to an intersection.
 *
 * `const E extends readonly Enhancer<unknown>[]` on the call site is what
 * preserves the tuple; without `const` the argument widens to
 * `Enhancer<unknown>[]` and every added method is lost.
 *
 * ⚠️ AN ENHANCER THAT ADDS NOTHING MAPS TO `never`, NOT `unknown`. Probes,
 * loggers and identity enhancers infer `TAdded = unknown`, and `unknown` in a
 * union ABSORBS it — `BatchingMethods | unknown` is `unknown`, so a single
 * pass-through enhancer anywhere in the array would erase every real addition
 * beside it. `never` is the identity element for unions, so it simply drops
 * out. When every enhancer adds nothing the union is `never`,
 * `UnionToIntersection<never>` is `unknown`, and `Builder & unknown` is
 * `Builder` — which is the right answer.
 */
type EnhancerAdditions<E> = E extends Enhancer<infer TAdded>
  ? unknown extends TAdded
    ? never
    : TAdded
  : never;

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type AccumulatedEnhancerAdditions<E extends readonly unknown[]> =
  UnionToIntersection<EnhancerAdditions<E[number]>>;
