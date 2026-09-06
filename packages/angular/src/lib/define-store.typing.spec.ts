/**
 * TYPE-TEST HARNESS — compile-time only (see marker-resolution.typing.spec.ts
 * for the harness convention this follows).
 *
 * Asserts `defineStore(factory, { expose: 'readonly' })` narrows the injected
 * type to `ReadonlyStore<T, A>` over the builder's ACCUMULATED type — derived
 * derived locations survive, no `.set`/`.update`/branch-write call signature is
 * reachable — while the default (no `expose`) overload keeps the factory's
 * real return type unchanged. This is a type-only narrowing (see
 * `ReadonlyStore`'s own docs); this file only checks the STATIC type, not
 * runtime behavior (runtime is covered by define-store.spec.ts /
 * readonly.spec.ts). The view mechanics themselves (marker reader allowlists,
 * `asReadonly`) are asserted in readonly.typing.spec.ts.
 *
 * This exact harness caught two real bugs during development:
 * 1. The readonly overload was first constrained on `factory: () =>
 *    a source-only tree shape, so accumulated configured derived state was not
 *    available to readonly projection.
 * 2. The overload then returned `Type<ReadonlyStore<T>>` computed over the
 *    SOURCE type, silently dropping every configured derived computed (RFC 0004
 *    F1). It is now parameterized over the builder's accumulated type.
 * Keep this file up to date if `signalTree()`'s return type ever changes.
 */
import type { Signal } from '@angular/core';
import { signalTree } from '../index';
import { defineStore } from '../index';
import type { ReadonlyStore } from '../index';
import type { WritableLeaf, TreeNode } from '../index';

// --- compile-time assertion helpers -----------------------------------------
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;

interface CounterState {
  count: number;
}
const counterState: CounterState = { count: 0 };

const DefaultStore = defineStore(() => signalTree(counterState));
const ReadonlyCounterStore = defineStore(() => signalTree(counterState), {
  expose: 'readonly',
});
// The F1 case: readonly exposure of a builder with accumulated derived state.
const ReadonlyDerivedStore = defineStore(
  () =>
    signalTree(counterState, {
      derived: ($) => ({
        doubled: () => $.count() * 2,
      }),
    }),
  { expose: 'readonly' }
);

type DefaultInjected = InstanceType<typeof DefaultStore>;
type ReadonlyInjected = InstanceType<typeof ReadonlyCounterStore>;
type ReadonlyDerivedInjected = InstanceType<typeof ReadonlyDerivedStore>;

// F2, structurally: a factory that does NOT return a builder cannot combine
// with `expose: 'readonly'` — compile error, not a silently-unnarrowed store.
// @ts-expect-error — plain-object factory has no accumulated tree type to narrow
defineStore(() => ({ count: 0 }), { expose: 'readonly' });

export type _DefineStoreTypeChecks = [
  // Default overload: unchanged — writes still reachable through `$.count.set(...)`.
  Expect<Equal<DefaultInjected['$']['count'], WritableLeaf<number>>>,

  // `expose: 'readonly'` overload: narrows to ReadonlyStore over the
  // accumulated type (TreeNode<T> when no derived layers exist).
  Expect<
    Equal<ReadonlyInjected, ReadonlyStore<CounterState, TreeNode<CounterState>>>
  >,
  // The readonly leaf is a plain Signal read, not a WritableLeaf —
  // `.set`/`.update` are not own members of its type.
  Expect<
    Equal<
      'set' extends keyof ReadonlyInjected['$']['count'] ? true : false,
      false
    >
  >,
  Expect<
    Equal<
      'update' extends keyof ReadonlyInjected['$']['count'] ? true : false,
      false
    >
  >,

  // F1: derived locations SURVIVE readonly exposure through defineStore.
  Expect<Equal<ReadonlyDerivedInjected['$']['doubled'], Signal<number>>>,
  Expect<
    Equal<
      'set' extends keyof ReadonlyDerivedInjected['$']['count'] ? true : false,
      false
    >
  >
];
