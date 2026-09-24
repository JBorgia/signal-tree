/**
 * TYPE-TEST — compile-time only (`*typing*.spec.ts` is excluded from vitest).
 *
 * `.with()` returns `this & TAdded`, so every enhancer's surface ACCUMULATES
 * across a chain.
 *
 * It used to return `SignalTreeBuilder<TSource, TAccum> & TAdded`, discarding
 * everything added before it — so a three-enhancer chain typed as
 * `SignalTreeBuilder<…> & BatchingMethods` and lost `canUndo` and `serialize`.
 * Runtime was always fine; only the type forgot, so the workaround was a cast,
 * and the demo's restoration page carried exactly that cast for exactly this
 * reason.
 *
 * `all-chains.spec.ts` did not catch it because it asserts on hand-written type
 * expressions (`BatchingMethods & RestorationMethods & …`) rather than on what
 * `.with().with()` actually RETURNS. The intersection was always associative;
 * the builder was what dropped it.
 */
import { batching } from '../enhancers/batching/batching';
import { transactions } from '../enhancers/transactions/transactions';
import { signalTree } from './signal-tree';
import { restoration } from '../enhancers/restoration/restoration';

const chained = signalTree(
  { n: 0 },
  { enhancers: [restoration(), transactions(), batching()] }
);

// FIRST link survives to the end of the chain.
export const _canUndo: boolean = chained.canUndo();
export const _undo: void = chained.undo() as unknown as void;
// MIDDLE link survives.
export const _confirm: void = chained.transact(() => undefined).confirm();
// LAST link, which was the only one that used to survive.
export const _batch: void = chained.batch(() => undefined);

// Order must not matter.
const reordered = signalTree(
  { n: 0 },
  { enhancers: [batching(), restoration(), transactions()] }
);
export const _r1: void = reordered.batch(() => undefined);
export const _r2: boolean = reordered.canUndo();
export const _r3: void = reordered.transact(() => undefined).rollback();

// A single enhancer still works, and the base surface is intact.
const single = signalTree({ n: 0 }, { enhancers: [batching()] });
export const _s1: void = single.batch(() => undefined);
export const _s2: number = single.$.n();

// Composite additions, state precision and both declaration orders survive
// independently of the retired persistence/serialization method names.
import type { Enhancer, WritableLeaf } from '../index';
declare const composite: Enhancer<{ first(): string } & { second(): number }>;
declare const labeller: Enhancer<{ label(): string }>;
const initial = { count: 0, user: { name: 'Ada', age: 36 } };
const left = signalTree(initial, { enhancers: [composite, labeller] });
const right = signalTree(initial, { enhancers: [labeller, composite] });
export const _leftFirst: string = left.first();
export const _leftSecond: number = left.second();
export const _leftLabel: string = left.label();
export const _rightFirst: string = right.first();
export const _rightSecond: number = right.second();
export const _rightLabel: string = right.label();
export const _countLeaf: WritableLeaf<number> = left.$.count;
export const _nameLeaf: WritableLeaf<string> = right.$.user.name;
export const _state: typeof initial = left.$();
left.$.user({ name: 'Ada', age: 37 });
right.$(initial);
const bare = signalTree(initial);
// @ts-expect-error additions require their enhancer
bare.first();
// @ts-expect-error the added return type remains precise
export const _wrong: number = left.first();
