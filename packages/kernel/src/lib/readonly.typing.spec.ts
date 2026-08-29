/**
 * TYPE-TEST HARNESS — compile-time only (see marker-resolution.typing.spec.ts
 * for the harness convention: checked by `tsc` via `npm run typecheck`,
 * EXCLUDED from vitest by the `*typing*.spec.ts` ignore).
 *
 * PARITY FIXTURE for the readonly view (RFC 0004 §4 step 2). The
 * `ReadonlyView` dispatch is structural (the accumulated `$` type carries
 * materialized signal surfaces, not brandable markers), so a future marker
 * missing its dispatch row degrades SILENTLY — this fixture is the maintained
 * guard. Add a marker to the fixture tree + an Equal row below for every new
 * marker, mirroring marker-resolution.typing.spec.ts.
 *
 * Asserts, over `asReadonly(tree)`:
 *  (a) derived computeds SURVIVE readonly exposure (RFC 0004 F1) and
 *      `linkedSignal()` WritableSignals narrow to `Signal`;
 *  (b) leaf `.set`/`.update` and branch write call signatures are not
 *      reachable;
 *  (c) entity mutators (`upsertOne`, …) and loader triggers (`load`,
 *      `refresh`, `invalidate`) are not reachable; `byId` is re-signed to a
 *      read-only entity node;
 *  (e) marker reader members remain readable, with
 *      `WritableSignal` readers (e.g. `status.state`) demoted to plain
 *      `Signal`s.
 * ((d) — plain-object factory with `expose: 'readonly'` is a compile error —
 * lives in define-store.typing.spec.ts next to the overloads it gates.)
 */
import { linkedSignal, computed, type Signal } from '@angular/core';

import {
  entityMap,
  signalTree,
} from '../index';
import type {
  ReadonlyEntityNode,
  ReadonlyEntitySignal,
} from './readonly';
import { asReadonly } from './readonly';
import type { ISignalTree } from './types';

// --- compile-time assertion helpers -----------------------------------------
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;
/** True iff K is not a member of T — "this write is not offered". */
type NotOffered<T, K extends PropertyKey> = K extends keyof T ? false : true;

interface User {
  id: number;
  name: string;
  address: { city: string };
  tags: string[];
}
const tree = signalTree({
  count: 0,
  selectedId: null as number | null,
  branch: { leaf: 'x', deep: { n: 1 } },
  users: entityMap<User, number>(),
  // ⚠️ WAS A LOADING entityMap. The invariant below — a `.derived()` merged
  // INTO a marker node survives the readonly view — is about MERGED DERIVED
  // STATE, not about loading; the loading collection was only the specimen that
  // happened to be handy. FIXTURE DEPENDENCY IS NOT SEMANTIC DEPENDENCY.
  plants: entityMap<User, number>(),
}).derived(($) => ({
  doubled: computed(() => $.count() * 2),
  // ⚠️ WAS SignalTree's `linked()`. The invariant is that ANY WritableSignal
  // merged through `.derived()` narrows to `Signal` in the readonly view —
  // nothing about the deleted wrapper. Angular's own `linkedSignal` is now
  // the supported way to write this, so the specimen IS the successor.
  draft: linkedSignal(() => $.count()),
  group: { total: computed(() => $.count() + 1) },
  // Derived deep-merged INTO a marker node (the readonly×merged-derived gap):
  // the marker dispatch row must preserve this beyond its Pick allowlist.
  plants: { total: computed(() => $.plants.count()) },
}));

const ro = asReadonly(tree);
type RO = typeof ro;
type RO$ = RO['$'];

// Runtime-reachable member types used in assertions below.
type ROUsers = RO$['users'];
type ROPlants = RO$['plants'];
type ROEntityNode = NonNullable<ReturnType<ROUsers['byId']>>;

export type _ReadonlyViewChecks = [
  // ---------------------------------------------------------------------------
  // (a) derived layers survive; a WritableSignal narrows
  // ---------------------------------------------------------------------------
  Expect<Equal<RO$['doubled'], Signal<number>>>,
  Expect<Equal<RO$['draft'], Signal<number>>>, // WritableSignal → Signal
  Expect<Equal<RO$['group']['total'], Signal<number>>>, // derived-only group recurses

  // ---------------------------------------------------------------------------
  // (b) leaves and branches: reads only
  // ---------------------------------------------------------------------------
  Expect<Equal<RO$['count'], Signal<number>>>,
  Expect<Equal<RO$['selectedId'], Signal<number | null>>>,
  Expect<NotOffered<RO$['count'], 'set'>>,
  Expect<NotOffered<RO$['count'], 'update'>>,
  // Branch accessor keeps only the zero-arg read call signature…
  Expect<Equal<Parameters<RO$['branch']>, []>>,
  Expect<
    Equal<ReturnType<RO$['branch']>, { leaf: string; deep: { n: number } }>
  >,
  // …and its children recurse into the readonly view.
  Expect<Equal<RO$['branch']['leaf'], Signal<string>>>,
  Expect<Equal<RO$['branch']['deep']['n'], Signal<number>>>,
  // Root snapshot read stays; write overloads are gone.
  Expect<Equal<Parameters<RO>, []>>,
  // No write-adjacent tree API on the readonly store.
  Expect<NotOffered<RO, 'with'>>,
  Expect<NotOffered<RO, 'bind'>>,
  Expect<NotOffered<RO, 'updateAndReport'>>,
  Expect<NotOffered<RO, 'registerCleanup'>>,
  Expect<Equal<RO['destroyed'], Signal<boolean>>>,

  // ---------------------------------------------------------------------------
  // (c) entityMap: queries readable, mutators not offered, byId re-signed
  // ---------------------------------------------------------------------------
  Expect<Equal<ROUsers, ReadonlyEntitySignal<User, number>>>,
  Expect<Equal<ROUsers['all'], Signal<User[]>>>,
  Expect<Equal<ROUsers['empty'], Signal<boolean>>>,
  Expect<NotOffered<ROUsers, 'addOne'>>,
  Expect<NotOffered<ROUsers, 'upsertOne'>>,
  Expect<NotOffered<ROUsers, 'updateWhere'>>,
  Expect<NotOffered<ROUsers, 'clear'>>,
  Expect<NotOffered<ROUsers, 'setAll'>>,
  Expect<NotOffered<ROUsers, 'clear'>>,
  Expect<NotOffered<ROUsers, 'tap'>>,
  Expect<NotOffered<ROUsers, 'intercept'>>,
  // byId: same node at runtime, re-signed without write reachability.
  Expect<
    Equal<ReturnType<ROUsers['byId']>, ReadonlyEntityNode<User> | undefined>
  >,
  Expect<Equal<ROEntityNode['name'], Signal<string>>>,
  Expect<Equal<ROEntityNode['tags'], Signal<string[]>>>, // arrays stay atomic
  Expect<Equal<ROEntityNode['address']['city'], Signal<string>>>,
  Expect<Equal<Parameters<ROEntityNode>, []>>, // write call overloads gone
  Expect<NotOffered<ROEntityNode['name'], 'set'>>,


  // derived merged INTO a marker node survives the readonly view
  // (readonly×merged-derived gap, M3): the extra key is kept as a Signal…
  Expect<Equal<ROPlants['total'], Signal<number>>>,
  // …the marker's own readers remain readable…
  Expect<Equal<ROPlants['all'], Signal<User[]>>>,
  // …and the mutators/triggers are still not offered.
  Expect<NotOffered<ROPlants, 'upsertOne'>>,
  Expect<NotOffered<ROPlants, 'setAll'>>,

  // ---------------------------------------------------------------------------
  // (e) the retired single-value marker rows
  // ---------------------------------------------------------------------------
  // ⚠️ THE ROSOURCE, ROQUERY AND ROSTORED ROWS ARE ALL GONE, IN THAT ORDER.
  //
  // ASYNC-SOURCE-RETIRE-1 folded the ROSource invariants into `ROStored`, then
  // STORED-RETIRE-0 deleted `ROStored` itself along with `ReadonlyStoredSignal`
  // — so there is no longer a resolver branch for "a marker surface that is
  // itself callable AND has its mutators stripped." That branch is not merely
  // unexercised: the type it dispatched to no longer exists.
  //
  // What those rows asserted generically still has carriers in this file:
  //   • allowlist REMOVES writes — 32 surviving `NotOffered` rows on
  //     `ROUsers` / `ROCached` / `ROPlants` / `ROEntityNode`.
  //   • callable read demoted to a read-only call — `RO$['branch']` (a) and
  //     `ROUsers['byId']` (c).
  //
  // What is genuinely unexercised, restated from ASYNC-QUERY-RETIRE-0: no
  // surviving marker has a WRITABLE member inside its reader allowlist, so the
  // picked-member demotion path has no fixture. `DemoteWritable` was itself
  // deleted as unreachable in the ERROR-SURFACE-2 consolidation, so the gap is
  // now a gap in `PickReaders`, not in a live conditional.
  //
  // Deliberately NOT substituted with a synthetic re-declaration: copying the
  // conditional into a spec asserts the copy, not the resolver. The next marker
  // that exposes a writable member must re-earn this row.
];

// `asReadonly` also accepts the minimal `ISignalTree`/`SignalTree` shape
// (second overload) so service code holding the wide type can narrow too.
declare const minimal: ISignalTree<{ n: number }>;
const roMinimal = asReadonly(minimal);
export type _ReadonlyMinimalChecks = [
  Expect<Equal<(typeof roMinimal)['$']['n'], Signal<number>>>,
  Expect<NotOffered<(typeof roMinimal)['$']['n'], 'set'>>
];

// --- readonly × `.computed()` slices -----------------------------------------
// Slice names are typed on `tree.$` (13.2). Two things must BOTH hold in the
// readonly view, and neither is implied by the writable-tree assertions in
// marker-resolution.typing.spec.ts:
//   1. slices survive the narrowing (they're reads — dropping them would make
//      `asReadonly` lossy for any collection that declares one), and
//   2. the narrowing still BLOCKS writes on a slice-bearing collection — i.e.
//      attaching a slice must not knock the entity surface off the
//      `ENTITY_READERS` allowlist dispatch and fall through to a permissive arm.
const sliceTree = signalTree({
  stock: entityMap<User, number>()
    .computed('names', (all) => all.map((u) => u.name))
    .computed('total', (all) => all.length),
});
const roSlice = asReadonly(sliceTree);
type ROStock = (typeof roSlice)['$']['stock'];

export type _ReadonlySliceChecks = [
  // 1. slices are present and correctly typed through the readonly view
  Expect<Equal<ROStock['names'], Signal<string[]>>>,
  Expect<Equal<ROStock['total'], Signal<number>>>,
  // the ordinary read surface still comes through
  Expect<Equal<ROStock['all'], Signal<User[]>>>,
  // 2. writes remain unreachable — the slice did not defeat the narrowing
  Expect<NotOffered<ROStock, 'addOne'>>,
  Expect<NotOffered<ROStock, 'upsertOne'>>,
  Expect<NotOffered<ROStock, 'removeOne'>>,
  Expect<NotOffered<ROStock, 'setAll'>>,
  Expect<NotOffered<ROStock, 'clear'>>
];
