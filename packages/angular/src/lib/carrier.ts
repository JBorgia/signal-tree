import type { WritableSignal } from '@angular/core';

/**
 * Angular's leaf carrier — the shape `@signal-tree/angular` promises consumers.
 *
 * This lived in the kernel until TYPE-A-PACKAGE-BINDING-0 (TA-B). It cannot: it
 * extends `WritableSignal`, whose private `[SIGNAL]` / `[ɵWRITABLE_SIGNAL]`
 * brands are precisely what make the Angular carrier truthful — and what make a
 * neutral cell correctly NOT assignable to it. Describing it structurally in the
 * kernel would be a lie, and importing Angular to describe it would keep
 * `@angular/core` in kernel declarations forever.
 */
export interface AngularLeaf<T> extends WritableSignal<T> {
  (): T;
}

/**
 * Register the carrier with the kernel's canonical registry.
 *
 * Declaration merging against the module that DECLARES `LeafCarriers`, so
 * `LeafOf<T,'angular'>` and `TreeNodeOf<T,'angular'>` resolve to `AngularLeaf`.
 * Augmenting a re-export would create a second, unused interface and silently
 * leave the real registry unchanged.
 */
declare module '@signal-tree/kernel/adapter' {
  interface LeafCarriers<T> {
    angular: AngularLeaf<T>;
  }
}
