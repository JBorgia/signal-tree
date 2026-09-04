/**
 * TYPE-TEST HARNESS (F0) — compile-time only.
 *
 * Asserts that every marker resolves to its materialized signal type on the
 * public tree accessor (`tree.$`, i.e. `TreeNode<T>`). This is the regression
 * esbuild, which strips types without checking, so a wrong-but-valid marker
 * type ships silently. This file is checked by `tsc` (`npm run typecheck`) and
 * is EXCLUDED from vitest (filename matches the `*typing*.spec.ts` ignore).
 *
 * Add a row here for every new marker. A missing/incorrect resolution fails
 * `tsc`, not just review.
 *
 * NOTE: only `TreeNode` is part of the public barrel. The internal
 * `EntityAwareTreeNode` / `DeepEntityAwareTreeNode` variants (used by the
 * unexported `TypedSignalTree`) are not consumer-reachable, but they ARE asserted
 * here — including `.computed()` slice resolution. Leaving them unchecked is how
 * they drifted out of sync with `TreeNode` in the first place.
 */
// GREENFIELD-V15-SURFACE-0: the kernel is carrier-NEUTRAL, so its marker
// surfaces resolve to cells. The Angular-bound equivalents are asserted in
// `packages/angular`, where that carrier is registered.
import type { ReadonlyLocation } from '../internals/cell-runtime';

import type {
  WritableLeaf,
  EntitySignal,
} from '../../index';
import { entityMap, signalTree } from '../../index';
// Internal (not barrel-exported) tree-node variants — imported relatively so the
// harness can gate their marker resolution too.
import type {
  DeepEntityAwareTreeNode,
  EntityAwareTreeNode,
} from '../types';

// --- compile-time assertion helpers -----------------------------------------
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;

interface User {
  id: number;
  name: string;
}
const tree = signalTree({
  users: entityMap<User, number>(),
  selectedId: null as number | null, // union leaf
  count: 0, // plain leaf
  nested: {
    deep: 0, // a plain leaf at depth, so `nested` stays a branch
  },
});
type $ = typeof tree.$;

// Every marker resolves to its materialized signal type on `tree.$`.
export type _MarkerResolutionChecks = [
  Expect<Equal<$['users'], EntitySignal<User, number>>>,
  // marker nested at depth resolves too (the "any depth" differentiator)
  Expect<Equal<$['nested']['deep'], WritableLeaf<number>>>,
  // plain + union leaves stay callable writable signals
  Expect<Equal<$['count'], WritableLeaf<number>>>,
  Expect<Equal<$['selectedId'], WritableLeaf<number | null>>>
];

// --- `.computed()` slice names are typed on `tree.$` (no `as any`) -----------
// The runtime has always attached slices to the materialized entity signal;
// these rows gate that the TYPES survive materialization. Before
// `ApplyComputedSlices`, `$.plants.byUrl` did not exist on the static type and
// every read needed `(tree.$.plants as any).byUrl()`.
const sliceTree = signalTree({
  plants: entityMap<User, number>().computed('byId2', (all) =>
    Object.fromEntries(all.map((u) => [u.id, u]))
  ),
  chained: entityMap<User, number>()
    .computed('names', (all) => all.map((u) => u.name))
    .computed('total', (all) => all.length),
});
type Slice$ = typeof sliceTree.$;

export type _ComputedSliceChecks = [
  // a slice resolves to ReadonlyLocation<R> with R inferred from the compute fn
  Expect<
    Equal<Slice$['plants']['byId2'], ReadonlyLocation<{ [k: string]: User }>>
  >,
  // the base EntitySignal surface survives alongside the slice
  Expect<Equal<Slice$['plants']['all'], ReadonlyLocation<User[]>>>,
  // chained slices accumulate — both names present, independently typed
  Expect<Equal<Slice$['chained']['names'], ReadonlyLocation<string[]>>>,
  Expect<Equal<Slice$['chained']['total'], ReadonlyLocation<number>>>,
  // REGRESSION: a slice-free collection stays EXACTLY EntitySignal — the
  // `Record<string, never>` default must not graft an index signature on
  Expect<Equal<$['users'], EntitySignal<User, number>>>
];

// The two INTERNAL tree-node variants resolve slices as well. Previously only
// `TreeNode` did, so `TypedSignalTree` (which builds on these) would have silently
// dropped slice names — the same class of gap the 13.2 fix closed for `tree.$`.
type SliceState = {
  stock: ReturnType<typeof entityMap<User, number>> & {
    __sliceTypes?: { names: string[] };
  };
};
export type _InternalVariantSliceChecks = [
  Expect<Equal<EntityAwareTreeNode<SliceState>['stock']['names'], ReadonlyLocation<string[]>>>,
  Expect<
    Equal<DeepEntityAwareTreeNode<SliceState>['stock']['names'], ReadonlyLocation<string[]>>
  >
];

// Internal (unexported) variants — imported relatively so they're gated too.
// These were missing every non-entityMap marker; now covered.
type MarkerState = {
  users: ReturnType<typeof entityMap<User, number>>;
};
export type _InternalVariantChecks = [
  Expect<
    Equal<EntityAwareTreeNode<MarkerState>['users'], EntitySignal<User, number>>
  >
  // ⚠️ THE NON-ENTITY MARKER ROW IS RETIRED, AND ITS SUBJECT WENT WITH IT.
  //
  // This row migrated once already (asyncQuery → stored, ASYNC-QUERY-RETIRE-0)
  // on the reasoning that "resolves a NON-ENTITY marker" is independent of which
  // marker is used. STORED-RETIRE-0 ends that: `stored` was the LAST non-entity
  // marker in the resolvers. `TreeNode`, `DeepEntityAwareTreeNode` and
  // `EntityAwareTreeNode` now dispatch on `LoadingEntityMapMarker` and
  // `EntityMapMarker` only — every other row is a shape row (Primitive, array,
  // Date/RegExp/Map, object), not a marker row.
  //
  // So the row is not orphaned, it is VACUOUS: there is no third marker branch
  // left to assert. It is deliberately not re-pointed at `entityMap`, which the
  // row above already covers, and not re-created synthetically. If a future
  // marker earns a resolution row, this assertion must be rebuilt for it.
];
