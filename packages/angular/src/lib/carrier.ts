import type { Signal, WritableSignal } from '@angular/core';

export interface AngularLeaf<T> extends WritableSignal<T> {
  (): T;
  asReadonly(): Signal<T>;
}

declare module '@signal-tree/kernel/adapter' {
  interface LeafCarriers<T> {
    angular: AngularLeaf<T>;
  }

  interface ReadonlyLeafCarriers<T> {
    angular: Signal<T>;
  }
}
