import {
  DestroyRef,
  ErrorHandler,
  inject,
  ɵɵdefineInjectable,
  type Type,
} from '@angular/core';

import type {
  ISignalTreeOf,
  ReadonlyStoreOf,
} from '@signal-tree/kernel/adapter';

/**
 * Config for {@link defineStore}.
 */
export interface DefineStoreConfig {
  /**
   * `'root'` provides an application singleton. `'platform'` shares the store
   * across applications on that platform; do not use it for request-local state.
   * Omit/`null` to provide it locally via a component/route `providers` array.
   */
  providedIn?: 'root' | 'platform' | null;
  /**
   * `'readonly'` narrows the injected type to {@link ReadonlyStore} — sugar
   * over `asReadonly(tree)` (the primary readonly surface, from
   * `@signal-tree/kernel`): read-only `$` over the tree's **accumulated** type
   * (leaf `Signal` reads, derived computeds preserved, marker surfaces
   * narrowed to their reader allowlists) plus lifecycle
   * (`destroy()`/`destroyed`). This is a **type-only** narrowing:
   * `inject(MyStore)` resolves to the exact same tree object either way, so
   * it does not protect against a deliberate `as any` bypass — it protects
   * the common case where an AI agent or developer reaches for a
   * `.set()`/mutator that simply isn't offered on the injected type. Use it
   * when every consumer of this token should receive a readonly tree. An Ops
   * service injecting this same token is also readonly. For separate readers
   * and writers, own one writable tree and expose a non-owning readonly `$`
   * token; see the Angular package README's ownership example.
   *
   * Only accepted when the factory returns a real tree
   * (`signalTree(...)`-shaped); combining it with
   * a plain-object factory is a compile error rather than a silent no-op.
   */
  expose?: 'readonly';
}

/**
 * Wrap a `signalTree(...)` factory in an injectable Angular service class — the
 * idiomatic Angular DI pattern for a tree, comparable to NgRx SignalStore's
 * `signalStore()`.
 *
 * `inject(MyStore)` resolves to the **real tree** — with `$` and any
 * configured enhancer methods — not a wrapper. The tree's
 * `destroy()` is tied to the host injector's lifecycle via `DestroyRef`, so a
 * component-provided store tears down with the component and a root store with
 * the app.
 *
 * The factory runs inside Angular's injection context, so it may call `inject()`
 * (e.g. to read other services). Return a fresh owned object or function for
 * each providing injector, never a tree borrowed from another owner. The
 * factory selects the realization: import `signalTree` from this Angular
 * facade, not the neutral kernel. Use ordinary DI aliases for borrowed views;
 * another `defineStore` would register another destruction owner.
 *
 * Primitive factory results are rejected. If the returned object has a
 * `destroy()` method, failures are reported with Angular's default `ErrorHandler`,
 * not resolved from DI: an application handler may itself depend on this store,
 * and the owning injector is already destroyed when cleanup runs. Reporting
 * allows sibling cleanup to continue. SignalTree destruction is idempotent.
 *
 * @example
 * ```ts
 * import { signalTree, defineStore } from '@signal-tree/angular';
 *
 * export const CounterStore = defineStore(() =>
 *   signalTree({ count: 0 })
 * );
 *
 * // App-wide singleton:
 * export const SettingsStore = defineStore(
 *   () => signalTree({ theme: 'light' }),
 *   { providedIn: 'root' }
 * );
 *
 * @Component({ providers: [CounterStore] })
 * export class Counter {
 *   readonly store = inject(CounterStore);
 *   inc() { this.store.$.count((n) => n + 1); }
 * }
 * ```
 *
 * @example Read-only injection
 * ```ts
 * export const CounterStore = defineStore(
 *   () => signalTree({ count: 0 }),
 *   { expose: 'readonly' }
 * );
 *
 * @Component({ providers: [CounterStore] })
 * export class Display {
 *   readonly store = inject(CounterStore);
 *   read() { return this.store.$.count(); } // ✅ read-only
 *   // this.store.$.count(1);               // ❌ type error — not on ReadonlyStore
 * }
 * ```
 */
// Overload order matters, mirroring entityMap's config-driven overload
// precedent (entity-map.ts): the readonly-specific overload is declared
// first so `{ expose: 'readonly' }` resolves to it. Two deliberate choices
// here, both verified by the type-test harness (define-store.typing.spec.ts
// / readonly.typing.spec.ts):
//
// 1. Constrained on the accumulated Angular tree contract because an earlier
//    source-only constraint silently dropped configured derived state.
// 2. Parameterized over the tree's accumulated `A` (not just the source `T`)
//    so `ReadonlyStore<T, A>` preserves configured derived computeds
//    (RFC 0004 F1), and the generic fallback overload rejects
//    `expose: 'readonly'` (`expose?: undefined`) so a factory that does NOT
//    return a builder — e.g. a plain object — is a compile error instead of
//    a silently-unnarrowed store (RFC 0004 F2 / §5 rule 4: silent-inert is
//    the priority defect class).
export function defineStore<T, A>(
  factory: () => ISignalTreeOf<T, 'angular', A>,
  config: DefineStoreConfig & { expose: 'readonly' }
): Type<ReadonlyStoreOf<T, A, 'angular'>>;
/**
 * Fallback overload. `expose?: undefined` means a config variable WIDENED to
 * {@link DefineStoreConfig} matches neither overload — pass a config object
 * literal (or `as const`). Deliberate: this cliff is what makes
 * `expose: 'readonly'` misuse a compile error instead of a silent no-op.
 */
export function defineStore<R extends object>(
  factory: () => R,
  config?: DefineStoreConfig & { expose?: undefined }
): Type<R>;
export function defineStore<R extends object>(
  factory: () => R,
  config: DefineStoreConfig = {}
): Type<R> {
  class SignalTreeStore {
    // This class is created at runtime: a decorator would require Angular JIT.
    // Supply the DI definition directly so AOT consumers need no compiler.
    static readonly ɵprov = ɵɵdefineInjectable({
      token: SignalTreeStore,
      providedIn: config.providedIn ?? null,
      factory: () => new SignalTreeStore(),
    });
    constructor() {
      const tree = factory();
      if (
        tree === null ||
        // Constructor return identity is a JS/Angular contract, not kernel traversal.
        // eslint-disable-next-line no-restricted-syntax
        (typeof tree !== 'object' && typeof tree !== 'function')
      ) {
        throw new TypeError(
          '[SignalTree] defineStore factory must return an object or function.'
        );
      }

      // Tie the tree's teardown to the host injector — component-provided stores
      // dispose with the component, root stores with the app. (NgRx SignalStore
      // ties teardown to the injector's DestroyRef the same way.)
      inject(DestroyRef).onDestroy(() => {
        try {
          const destroy = (tree as { destroy?: unknown }).destroy;
          if (typeof destroy === 'function') destroy.call(tree);
        } catch (error) {
          // Throwing here aborts Angular's remaining injector cleanup callbacks.
          new ErrorHandler().handleError(error);
        }
      });

      // A constructor that returns an object makes `new SignalTreeStore()`
      // resolve to THAT object. Angular instantiates the token with `new`, so
      // `inject(MyStore)` yields the real tree (full tree API), not this
      // wrapper instance — no proxy, no property copying, no lost call signature.
      return tree as object;
    }
  }

  return SignalTreeStore as unknown as Type<R>;
}
