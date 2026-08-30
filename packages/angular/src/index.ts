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
import { ensureAngularRealization } from './lib/install-realization';
// Registers the Angular leaf carrier with the kernel's type registry (TA-B).
import './lib/carrier';

// A CALL, not a bare side-effect import: a bare import was tree-shaken out of
// the published bundle, shipping an Angular package that installed nothing.
ensureAngularRealization();
import type {
  EntityNodeOf,
  EntitySignalOf,
  EntitySignalWithSlicesOf,
  ReadonlyStoreOf,
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
// ⚠️ NO `export * from '@signal-tree/kernel'`.
//
// The star export republished the kernel's NEUTRAL carrier-sensitive types into
// this package, so `TreeNode<State>` and `WritableLeaf<T>` annotated from
// `@signal-tree/angular` resolved to `WritableCell` — a carrier lie, even though
// `signalTree()` INFERENCE was correct. Patching the two known names would leave
// the same trap for the next carrier-sensitive type, so the star is gone: every
// name below is re-exported deliberately.
//
//     ONE SEMANTIC TYPE AUTHORITY, PACKAGE-SPECIFIC CARRIER BINDING.

// --- carrier-INSENSITIVE: identical in both packages, re-exported as-is ---
export {
  entityMap,
  link,
  restoration,
  undoable,
  external,
  asReadonly,
  batching,
  devTools,
  transactions,
  onTreeError,
  SignalTreeRollbackError,
} from '@signal-tree/kernel';

export type {
  TreeConfig,
  NodeAccessor,
  AccessibleNode,
  Primitive,
  Enhancer,
  EnhancerCleanup,
  Link,
  LinkEndpoint,
  TreeId,
  TreeErrorEvent,
  EntityMapMarker,
  EntityMapBuilder,
  EntityMapComputedSlices,
  EntityMapMarkerWithSlices,
  ComputedSliceConfig,
  AddOptions,
  AddManyOptions,
  DefaultKey,
  RestorationMethods,
  RestorationHistoryEntry,
  BatchingConfig,
  BatchingMethods,
  DevToolsMethods,
  DevToolsLogEntry,
  TransactionMethods,
} from '@signal-tree/kernel';

// --- carrier-SENSITIVE: same semantic names, bound to Angular's carrier ---
// `AngularLeaf`, and the `TreeNodeOf`/`LeafOf` machinery, stay INTERNAL: they are
// implementation vocabulary. Users write the same names they would in the kernel.
export type TreeNode<T> = TreeNodeOf<T, 'angular'>;
export type WritableLeaf<T> = LeafOf<T, 'angular'>;

// A packed-consumer probe proved these three were NOT carrier-insensitive:
// re-exported from the kernel they resolved `destroyed`, `.empty`, `.all`,
// entity fields and `.asReadonly()` to neutral cells. Same semantic authority,
// bound to Angular's carrier — no duplicated type system, no star export.
export type EntitySignal<
  E,
  K extends string | number = string
> = EntitySignalOf<E, K, 'angular'>;
export type EntityNode<E> = EntityNodeOf<E, 'angular'>;
export type ReadonlyStore<
  TSource,
  TAccum = TreeNode<TSource>
> = ReadonlyStoreOf<TSource, TAccum, 'angular'>;
export type EntitySignalWithSlices<
  E,
  K extends string | number,
  Slices extends Record<string, unknown>
> = EntitySignalWithSlicesOf<E, K, Slices, 'angular'>;

/**
 * The Angular tree contract. Same one parameter users always wrote; the carrier
 * differs because THIS package installed the Angular realization.
 */
export type SignalTree<T> = ISignalTreeOf<T, 'angular'>;

// Angular-owned API, which the kernel deliberately does not export.
export { defineStore, type DefineStoreConfig } from './lib/define-store';
export { toWritableSignal } from './lib/to-writable-signal';
