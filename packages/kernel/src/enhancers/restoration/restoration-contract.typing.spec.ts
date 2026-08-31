/**
 * TYPE-TEST — compile-time only (`*typing*.spec.ts` is excluded from vitest).
 *
 * THE CONSUMER CONTRACT for `restoration()`, pinned so the
 * `Enhancer<RestorationMethods>` migration can be proven not to change it.
 * Written and proven GREEN BEFORE the signature change, re-run unchanged after.
 *
 * WHY THIS ONE IS NOT BATCHING-SHAPED. Two properties make a superficially
 * green conversion dangerous here, and both get their own rows:
 *
 *   1. `getRestorationHistory()` is RECEIVER-DERIVED:
 *
 *        getRestorationHistory(): RestorationHistoryEntry<
 *          this extends NodeAccessor<infer S> ? S : never
 *        >[]
 *
 *      The state is recovered from polymorphic `this`, not from a generic on
 *      the enhancer. `EnhancerHost` is NOT a `NodeAccessor`, so if `TAdded` ever
 *      resolved against the host rather than the caller's tree, `S` would
 *      silently collapse to `never` — method present, state gone. A row
 *      asserting only that `getRestorationHistory` EXISTS would not notice.
 *
 *   2. `RestorationMethods extends TransactionMethods`, so this enhancer adds a
 *      SECOND surface. Both must survive.
 *
 * `b266457d` removed `RestorationMethods<T>`'s state generic precisely because
 * it "forced enhancer signatures to name `ISignalTree<T>`" — this migration is
 * what that change was for. These rows are the check that it delivered.
 *
 * SCOPE: this slice asks whether the EXISTING capability can be expressed
 * through `Enhancer<RestorationMethods>`. It does not reopen restoration's public
 * contract — nothing here asserts a change to `RestorationMethods`' shape.
 *
 * v15: enhancers are DECLARED, so the call site is
 * `signalTree(state, { enhancers: [restoration(), transactions()] })` and the added surface arrives
 * through the return type. Note the state is a separate annotated `const`
 * rather than `signalTree<AppState>(...)` — an explicit type argument would
 * have to name the enhancer tuple parameter too, and naming it is exactly the
 * ceremony this file exists to forbid.
 */
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

import type {
  WritableLeaf,
  Enhancer,
  PendingTransaction,
  RestorationHistoryEntry,
} from '../../index';

// --- compile-time assertion helpers -----------------------------------------
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;
type ExpectFalse<T extends false> = T;

interface AppState {
  count: number;
  user: { name: string; age: number };
}

// The call site under test. No generics, no casts, no annotation.
const initial: AppState = { count: 0, user: { name: 'Ada', age: 36 } };
const tree = signalTree(initial);
const travelled = signalTree(initial, { enhancers: [restoration(), transactions()] });

// ============================================================================
// 1 — THE LOAD-BEARING ROW: history keeps the CONCRETE state type
// ============================================================================
// If the receiver stops being seen as a `NodeAccessor<AppState>`, `S` becomes
// `never` and this row fails. That is the whole risk of this migration.
const entries = travelled.getRestorationHistory();
export type _HistoryStateIsConcrete = [
  Expect<Equal<typeof entries, RestorationHistoryEntry<AppState>[]>>,
  Expect<Equal<(typeof entries)[number]['state'], AppState>>
];
export const _stateCount: number = entries[0].state.count;
export const _stateName: string = entries[0].state.user.name;

// Negative control — proves the row above is not vacuously true because
// `RestorationHistoryEntry<never>` happens to satisfy it.
export type _HistoryIsNotNever = ExpectFalse<
  Equal<(typeof entries)[number]['state'], never>
>;

// ============================================================================
// 2 — the restoration surface, exact signatures
// ============================================================================
export type _MethodTypes = [
  Expect<Equal<(typeof travelled)['undo'], () => void>>,
  Expect<Equal<(typeof travelled)['redo'], () => void>>,
  Expect<Equal<(typeof travelled)['canUndo'], () => boolean>>,
  Expect<Equal<(typeof travelled)['canRedo'], () => boolean>>,
  Expect<Equal<(typeof travelled)['resetRestorationHistory'], () => void>>,
  Expect<Equal<(typeof travelled)['jumpTo'], (index: number) => void>>,
  Expect<Equal<(typeof travelled)['getCurrentIndex'], () => number>>
];
travelled.undo();
travelled.redo();
export const _canUndo: boolean = travelled.canUndo();
export const _canRedo: boolean = travelled.canRedo();
export const _idx: number = travelled.getCurrentIndex();
travelled.jumpTo(0);
travelled.resetRestorationHistory();

// ============================================================================
// 3 — the INHERITED transaction surface survives too
// ============================================================================
// `RestorationMethods extends TransactionMethods`, so this enhancer adds two
// surfaces. A migration that kept only the restoration half would pass §2.
export type _TransactionSurvives = Expect<
  Equal<(typeof travelled)['transaction'], (fn: () => void) => PendingTransaction>
>;
export const _pending: PendingTransaction = travelled.transaction(() => undefined);

// ============================================================================
// 4 — the state surface is untouched by enhancement
// ============================================================================
export type _StateSurvives = [
  Expect<Equal<(typeof travelled)['$']['count'], WritableLeaf<number>>>,
  Expect<
    Equal<(typeof travelled)['$']['user']['name'], WritableLeaf<string>>
  >
];
export const _count: number = travelled.$.count();
export const _user: { name: string; age: number } = travelled.$.user();
travelled.$.user({ name: 'Ada', age: 37 });
export const _snapshot: AppState = travelled.$();
travelled.$({ count: 1, user: { name: 'Ada', age: 37 } });

// ============================================================================
// 5 — accumulation in BOTH orders, with history state still concrete
// ============================================================================
declare const labeller: Enhancer<{ label(): string }>;

const travelledThenLabelled = signalTree(initial, { enhancers: [restoration(), labeller] });
const labelledThenTravelled = signalTree(initial, { enhancers: [labeller, restoration()] });

export const _b1: string = travelledThenLabelled.label();
export const _b2: boolean = travelledThenLabelled.canUndo();
export const _b3: string = labelledThenTravelled.label();
export const _b4: boolean = labelledThenTravelled.canUndo();

// The receiver-derived state must survive the NEXT enhancer too — this is the
// row that would catch `S` collapsing only once another enhancer is chained.
export type _HistoryStateSurvivesChaining = [
  Expect<
    Equal<ReturnType<(typeof travelledThenLabelled)['getRestorationHistory']>, RestorationHistoryEntry<AppState>[]>
  >,
  Expect<
    Equal<ReturnType<(typeof labelledThenTravelled)['getRestorationHistory']>, RestorationHistoryEntry<AppState>[]>
  >
];

// ============================================================================
// 6 — config is optional and does not change the added surface
// ============================================================================
const disabled = signalTree(initial, { enhancers: [restoration({ enabled: false }), transactions()] });
export type _ConfigDoesNotChangeSurface = [
  Expect<Equal<(typeof disabled)['undo'], (typeof travelled)['undo']>>,
  Expect<
    Equal<ReturnType<(typeof disabled)['getRestorationHistory']>, RestorationHistoryEntry<AppState>[]>
  >
];
// @ts-expect-error config is checked, not `any`
signalTree(initial, { enhancers: [restoration({ nope: true }), transactions()] });

// ============================================================================
// 7 — negative controls
// ============================================================================
// @ts-expect-error `undo` requires restoration()
export type _NoUndoBefore = (typeof tree)['undo'];
// @ts-expect-error `getRestorationHistory` requires restoration()
export type _NoHistoryBefore = (typeof tree)['getRestorationHistory'];
export type _EnhancedDiffers = ExpectFalse<Equal<typeof travelled, typeof tree>>;
