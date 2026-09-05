import type { ComputedRef, Ref } from 'vue';

export type VueLeaf<T> = Ref<T>;

declare module '@signal-tree/kernel/adapter' {
  interface LeafCarriers<T> {
    vue: VueLeaf<T>;
  }

  interface ReadonlyLeafCarriers<T> {
    vue: ComputedRef<T>;
  }
}
