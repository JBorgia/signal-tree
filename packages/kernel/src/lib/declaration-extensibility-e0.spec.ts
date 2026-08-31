import { describe, expect, it } from 'vitest';
import { bindSignalTreeRealization } from './signal-tree';
import { markTreeCell } from './internals/cell-identity';
import { NEUTRAL_TREE_REALIZATION } from './internals/tree-realization';

const FAKE_REACTIVE = Symbol('fake-reactive');

interface FakeWritable<T> {
  (): T;
  set(value: T): void;
  update(update: (value: T) => T): void;
  asReadonly(): () => T;
  readonly [FAKE_REACTIVE]: true;
}

const fakeWritable = <T,>(initial: T): FakeWritable<T> => {
  let value = initial;
  const cell = (() => value) as FakeWritable<T>;
  cell.set = (next) => {
    value = next;
  };
  cell.update = (update) => cell.set(update(value));
  cell.asReadonly = () => cell;
  Object.defineProperty(cell, FAKE_REACTIVE, { value: true });
  return markTreeCell(cell);
};

const signalTree = bindSignalTreeRealization({
  ...NEUTRAL_TREE_REALIZATION,
  cell: { createCell: fakeWritable },
  derived: { createDerived: (compute) => fakeWritable(compute()) },
  materialization: {
    isReactiveNode: (value) =>
      typeof value === 'function' &&
      (value as Partial<FakeWritable<unknown>>)[FAKE_REACTIVE] === true,
  },
});

/**
 * M1+M2-E0 — THIRD-PARTY DECLARATION EXTENSIBILITY.
 *
 * NULL: SignalTree 15 has a CLOSED set of compiler-recognised declaration forms.
 * FALSIFIER: produce a valuable third-party use case that cannot be correctly
 * implemented with already-earned primitives without participating in
 * compilation before exposure.
 *
 * Rule 0n: 14.x's public `registerMarkerProcessor` is historical evidence and
 * carries NO survival entitlement. This spec therefore tests FUNCTIONS, never
 * "do custom markers work".
 *
 * The only two custom declarations the demo defines are a counter (a signal plus
 * increment/decrement/reset/set) and a selection (a signal plus computeds and
 * mutators). Neither touches PositionId, SubjectId, the causal runtime, the
 * notifier, commit authority or persistence. This probe asks whether an author
 * can obtain the same thing by building it and handing it to the tree.
 */
interface Counter extends FakeWritable<number> {
  increment(): void;
  decrement(): void;
  reset(): void;
  doubled: () => number;
}

function makeCounter(initial: number, step = 1): Counter {
  const s = fakeWritable(initial) as Counter;
  s.increment = () => s.update((v) => v + step);
  s.decrement = () => s.update((v) => v - step);
  s.reset = () => s.set(initial);
  s.doubled = () => s() * 2;
  return s;
}

describe('E0 — custom declaration without a registration protocol', () => {
  it('a author-built signal-with-methods is preserved verbatim by the tree', () => {
    const tree = signalTree({
      counter: makeCounter(10, 5),
      plain: 1,
    });

    // The custom accessor survives construction intact.
    expect(tree.$.counter()).toBe(10);
    tree.$.counter.increment();
    expect(tree.$.counter()).toBe(15);
    tree.$.counter.decrement();
    expect(tree.$.counter()).toBe(10);

    // Its derived member works.
    expect(tree.$.counter.doubled()).toBe(20);

    // Ordinary state alongside it is unaffected.
    tree.$.plain.set(2);
    expect(tree.$.plain()).toBe(2);
  });

  it('the custom value participates in the tree snapshot', () => {
    const tree = signalTree({ counter: makeCounter(3), plain: 'x' });
    expect(tree()).toEqual({ counter: 3, plain: 'x' });
  });

  it('nesting works — no path/position protocol was needed', () => {
    const tree = signalTree({ a: { b: { counter: makeCounter(7) } } });
    expect(tree.$.a.b.counter()).toBe(7);
    tree.$.a.b.counter.increment();
    expect(tree.$.a.b.counter()).toBe(8);
  });
});
