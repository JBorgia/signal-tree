/**
 * TYPE-TEST — compile-time only (`*typing*.spec.ts` is excluded from vitest).
 *
 * THE CONSUMER CONTRACT for `serialization()`, pinned so the
 * `Enhancer<SerializationMethods>` migration can be proven not to change it.
 * Written and proven GREEN BEFORE the signature change, re-run unchanged after.
 *
 * FOURTH SHAPE, characterized rather than assumed:
 *
 *   - `serialization` MUTATES (`const enhanced = tree as …`); it does not
 *     replace tree identity, unlike the three enhancers migrated before it.
 *   - `SerializationMethods` has no `this`, no conditional types and no state
 *     generic — every payload is `SerializedState<unknown>`. So there is no
 *     receiver-derived precision to lose here, which is what made `restoration`
 *     risky. Recorded as a MEASURED fact, not an assumption carried over.
 *   - It is CONSUMED INTERNALLY by `persistence()`, which applies
 *     `serialization(config)(tree)` inside its own body. That coupling is why
 *     migrating this one touches `persistence`'s implementation while leaving
 *     `persistence`'s own public signature alone for its own slice.
 *
 * NOTE, not a change: `snapshot()` returns `SerializedState<unknown>`, so the
 * state type is already erased in the 14.x contract. This migration neither
 * improves nor worsens that; reopening it would be a different decision.
 *
 * v15: enhancers are DECLARED, so the call site is
 * `signalTree(state, { enhancers: [serialization()] })` and the added surface arrives
 * through the return type. Note the state is a separate annotated `const`
 * rather than `signalTree<AppState>(...)` — an explicit type argument would
 * have to name the enhancer tuple parameter too, and naming it is exactly the
 * ceremony this file exists to forbid.
 */
import { signalTree } from '../../lib/signal-tree';
import { serialization } from './serialization';

import type { WritableLeaf, Enhancer } from '../../index';
import type { SerializedState } from './serialization';

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
const serial = signalTree(initial, { enhancers: [serialization()] });

// ============================================================================
// 1 — the TWO surviving methods are inferred, with exact signatures
// ============================================================================
// ⚠️ FOUR SPELLINGS DELETED by PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0. This pinned
// six methods over two jobs. `toJSON()` measured EXACTLY EQUAL to `tree()`;
// `snapshot()`/`restore()` were its metadata-and-clone pair; `fromJSON()` is
// internalized as the external-truth acquisition point. What survives is the one
// job `tree()`/`tree(value)` cannot do — a type-preserving durable
// representation — so the rows now assert ABSENCE as well as presence.
export const _json: string = serial.serialize();
serial.deserialize('{}');

export type _MethodTypes = [
  Expect<Equal<ReturnType<(typeof serial)['serialize']>, string>>,
  // The deleted spellings must STAY deleted.
  Expect<Equal<'toJSON' extends keyof typeof serial ? true : false, false>>,
  Expect<Equal<'fromJSON' extends keyof typeof serial ? true : false, false>>,
  Expect<Equal<'snapshot' extends keyof typeof serial ? true : false, false>>,
  Expect<Equal<'restore' extends keyof typeof serial ? true : false, false>>
];

// ============================================================================
// 2 — the state surface is untouched by enhancement
// ============================================================================
export type _StateSurvives = [
  Expect<Equal<(typeof serial)['$']['count'], WritableLeaf<number>>>,
  Expect<
    Equal<(typeof serial)['$']['user']['name'], WritableLeaf<string>>
  >
];
export const _count: number = serial.$.count();
export const _user: { name: string; age: number } = serial.$.user();
serial.$.user({ name: 'Ada', age: 37 });
export const _snapshotState: AppState = serial();
serial({ count: 1 });

// ============================================================================
// 3 — accumulation in BOTH orders
// ============================================================================
declare const labeller: Enhancer<{ label(): string }>;

const serialThenLabelled = signalTree(initial, { enhancers: [serialization(), labeller] });
const labelledThenSerial = signalTree(initial, { enhancers: [labeller, serialization()] });

export const _d1: string = serialThenLabelled.label();
export const _d2: string = serialThenLabelled.serialize();
export const _d3: string = labelledThenSerial.label();
export const _d4: string = labelledThenSerial.serialize();
export const _d5: number = serialThenLabelled.$.count();

// ============================================================================
// 4 — config is optional and does not change the added surface
// ============================================================================
const configured = signalTree(initial, { enhancers: [serialization({ includeMetadata: false, maxDepth: 10 })] });
export type _ConfigDoesNotChangeSurface = Expect<
  Equal<(typeof configured)['serialize'], (typeof serial)['serialize']>
>;
// @ts-expect-error config is checked, not `any`
signalTree(initial, { enhancers: [serialization({ nope: true })] });

// ============================================================================
// 5 — negative controls
// ============================================================================
// @ts-expect-error `serialize` requires serialization()
export type _NoSerializeBefore = (typeof tree)['serialize'];
// @ts-expect-error `snapshot` requires serialization()
export type _NoSnapshotBefore = (typeof tree)['snapshot'];
export type _EnhancedDiffers = ExpectFalse<Equal<typeof serial, typeof tree>>;
