/**
 * TYPE-TEST — compile-time only (`*typing*.spec.ts` is excluded from vitest).
 *
 * Every enhancer's added surface accumulates across the declared tuple.
 * The regression originally lost earlier methods from a `.with()` chain;
 * declarative construction now carries that same composition contract.
 * The middle enhancer uses supported transactions, and the composite fixture
 * preserves the independent inference coverage from the retired serializer.
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
export const _confirm: void = chained.transaction(() => undefined).confirm();
// LAST link, which was the only one that used to survive.
export const _batch: void = chained.batch(() => undefined);

// Order must not matter.
const reordered = signalTree(
  { n: 0 },
  { enhancers: [batching(), restoration(), transactions()] }
);
export const _r1: void = reordered.batch(() => undefined);
export const _r2: boolean = reordered.canUndo();
export const _r3: void = reordered.transaction(() => undefined).rollback();

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
