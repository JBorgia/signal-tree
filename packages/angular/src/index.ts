/**
 * `@signal-tree/angular` — SignalTree realized with native Angular signals.
 *
 * INSTALLATION IS STRUCTURAL. The import below is evaluated before anything
 * runtime-bearing is re-exported, so the Angular realization is in force before
 * a consumer can allocate a tree or an entity. There is no initializer for
 * users to call and no second module to remember.
 *
 * That ordering is the fix for a MEASURED defect: entity APIs used without
 * first calling `signalTree()` silently received neutral kernel cells — no
 * `isSignal`, no `asReadonly`, no dependency tracking. The old monolith
 * installed Angular as a side effect of importing `signal-tree.ts`, so the
 * guarantee depended on which module a consumer happened to touch first.
 *
 *     REALIZATION IS SELECTED DURING PACKAGE INITIALIZATION, NOT MUTATED AS
 *     APPLICATION STATE.
 *
 * This is why the package must not claim `sideEffects: false`.
 */
import './lib/install-realization';
// Registers the Angular leaf carrier with the kernel's type registry (TA-B).
import './lib/carrier';
import type {
  ISignalTreeOf,
  LeafOf,
  SignalTreeFactoryOf,
  TreeNodeOf,
} from '@signal-tree/kernel/adapter';
import { signalTree as kernelSignalTree } from '@signal-tree/kernel';

/**
 * The kernel's `signalTree`, DECLARED with Angular's carrier.
 *
 * Same runtime function — not a re-implementation and not a cast asserting the
 * conclusion. This package installed the Angular realization (proven by the
 * root-initialization control) and registered `AngularLeaf` in the carrier
 * registry, so `SignalTreeFactoryOf<'angular'>` is what this function actually
 * returns here.
 */
// TypeScript cannot connect "this package installed the Angular realization"
// to "therefore these leaves carry Angular's brands" — the kernel's declaration
// is bound to 'cell', and a neutral cell is deliberately NOT assignable to
// WritableSignal. That gap is bridged once, HERE, at the package-binding point,
// and nowhere inside the recursive tree types.
//
// It is not asserting the conclusion: the two facts it depends on are proven
// independently — the root-initialization control (realization installed before
// allocation) and runtime S1 (the leaves ARE native Angular signals).
export const signalTree =
  kernelSignalTree as unknown as SignalTreeFactoryOf<'angular'>;

// The semantic API. Identical spelling to the kernel — the difference is which
// carrier realizes it, which is a packaging decision, never a consumer one.
// Carrier-INSENSITIVE semantic API comes straight from the kernel.
export * from '@signal-tree/kernel';

// Carrier-SENSITIVE public types, bound to Angular's carrier. Same runtime
// implementation as the kernel — only the declared carrier differs.
export type { AngularLeaf } from './lib/carrier';
export type SignalTreeNode<T> = TreeNodeOf<T, 'angular'>;
export type AngularCallableLeaf<T> = LeafOf<T, 'angular'>;

/**
 * The Angular tree contract. Same one parameter users always wrote; the carrier
 * differs because THIS package installed the Angular realization.
 */
export type ISignalTree<T> = ISignalTreeOf<T, 'angular'>;
export type SignalTree<T> = ISignalTreeOf<T, 'angular'>;

// Angular-owned API, which the kernel deliberately does not export.
export { defineStore, type DefineStoreConfig } from './lib/define-store';
export { toWritableSignal } from './lib/to-writable-signal';
