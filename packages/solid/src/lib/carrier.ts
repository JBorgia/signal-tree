import type { Accessor } from 'solid-js';

/**
 * Solid's leaf is an `Accessor` the kernel has made writable. The kernel owns
 * the value, equality and publication; Solid owns the dependency edge.
 */
export type SolidLeaf<T> = Accessor<T> & {
  set(value: T): void;
  update(update: (current: T) => T): void;
};

declare module '@signal-tree/kernel/adapter' {
  interface LeafCarriers<T> {
    solid: SolidLeaf<T>;
  }

  interface ReadonlyLeafCarriers<T> {
    solid: Accessor<T>;
  }

  interface ReadonlyViewLeafCarriers<T> {
    solid: Accessor<T>;
  }
}
