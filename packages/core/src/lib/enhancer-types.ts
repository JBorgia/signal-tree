import type { NodeAccessor } from './node-accessor';

/** Symbol key for enhancer metadata (stable public export). */
export const ENHANCER_META = Symbol('signaltree:enhancer:meta');

interface EnhancerHost {
  readonly $: unknown;
  bind(thisArg?: unknown): NodeAccessor<unknown>;
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
