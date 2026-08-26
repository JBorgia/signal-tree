import { describe, expect, it, vi } from 'vitest';

import { createTreeScalarSlotRuntime } from './tree-scalar-slot-runtime';
import {
  acquireScalarLocation,
  createScalarLocation,
  isFunctionValue,
  asValue,
  type Location,
  type LocationMutation,
} from './tree-location';

/**
 * THE FROZEN §B CONTRACTS, CARRIED ON THE REAL SUBJECT.
 *
 * These eight cases and two falsifiers were proven on a scratchpad prototype
 * during GREENFIELD-ROOT-ACCESSOR-SHAPE-0. They move here the moment the real
 * `Location<T>` exists, and the prototype is not kept — a permanent fake
 * implementation carrying a real invariant is exactly the prototype-retirement
 * problem ATOMIC-STATE-RETIREMENT cleaned up.
 */
function harness() {
  const runtime = createTreeScalarSlotRuntime();
  const seen: LocationMutation[] = [];
  const make = <T>(initial: T): Location<T> & { slot: number } => {
    const slot = runtime.createSlot<T>(initial, Object.is);
    const location = createScalarLocation<T>(runtime, slot, (m) => seen.push(m));
    return Object.assign(location, { slot });
  };
  const lastIntent = () => seen[seen.length - 1]?.intent;
  return { runtime, make, seen, lastIntent };
}

describe('the canonical location', () => {
  it('C1 — a value is a whole-value assignment', () => {
    const { make, lastIntent } = harness();
    const n = make(0);
    n(5);
    expect(n()).toBe(5);
    expect(lastIntent()).toBe('replace');
  });

  it('C2 — a naked callable is a DERIVE', () => {
    const { make, lastIntent } = harness();
    const n = make(1);
    n((current) => current + 1);
    expect(n()).toBe(2);
    expect(lastIntent()).toBe('derive');
  });

  it('C3 — null → a marked handler is assigned, never invoked', () => {
    const { make, lastIntent } = harness();
    const ran = vi.fn();
    const cb = make<null | (() => void)>(null);

    cb(asValue(ran));

    expect(ran).not.toHaveBeenCalled(); // assigning a handler must never RUN it
    expect(lastIntent()).toBe('replace');
    expect(cb()).toBe(ran);
  });

  it('C4 — function → a marked function replaces it, neither invoked', () => {
    const { make, lastIntent } = harness();
    const a = vi.fn();
    const b = vi.fn();
    const cb = make<() => void>(a);

    cb(asValue(b));

    expect(lastIntent()).toBe('replace');
    expect(cb()).toBe(b);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('C5 — a marked class constructor is stored, never instantiated', () => {
    const { make, lastIntent } = harness();
    let constructed = 0;
    class Thing {
      constructor() {
        constructed++;
      }
    }
    const ctor = make<typeof Thing | null>(null);

    ctor(asValue(Thing));

    // Invoking a class throws, which once escaped mid-loop leaving one key
    // written, another unwritten and nothing reported.
    expect(constructed).toBe(0);
    expect(lastIntent()).toBe('replace');
    expect(ctor()).toBe(Thing);
  });

  it('C6 — a function-valued location can still be DERIVED', () => {
    const { make, lastIntent } = harness();
    const a = () => 'a';
    const b = () => 'b';
    const cb = make<() => string>(a);
    let received: unknown;

    cb((current) => {
      received = current;
      return b;
    });

    expect(lastIntent()).toBe('derive');
    expect(received).toBe(a); // the updater receives the RAW stored function
    expect(cb()).toBe(b);
  });

  it('C7 — the marker is consumed and never reaches the kernel', () => {
    const { runtime, make } = harness();
    const next = () => 'y';
    const cb = make<() => string>(() => 'x');

    cb(asValue(next));

    const stored = runtime.readSlot(cb.slot);
    expect(stored).toBe(next);
    expect(typeof stored).toBe('function');
    expect(isFunctionValue(stored)).toBe(false);
    expect(Object.getOwnPropertySymbols(stored as object)).toEqual([]);
    expect(cb()).toBe(next);
  });

  it('C8 — non-authored ingress installs a raw function without invoking it', () => {
    const { runtime, make } = harness();
    const incoming = vi.fn(() => 'from-server');
    const cb = make<null | (() => string)>(null);

    // Realization already knows its causal class; it needs no marker and must
    // not re-enter through the authored callable.
    acquireScalarLocation(runtime, cb.slot, incoming);

    expect(incoming).not.toHaveBeenCalled();
    expect(runtime.readSlot(cb.slot)).toBe(incoming);
    expect(cb()).toBe(incoming);
  });

  it('classification never consults the stored value', () => {
    const { make, lastIntent } = harness();
    // Same argument SHAPE, opposite stored-value shapes -> same classification.
    const fromNull = make<null | ((n: number) => number)>(null);
    const fromFn = make<(n: number) => number>((n) => n);

    fromNull((current) => current);
    expect(lastIntent()).toBe('derive');
    fromFn((current) => current);
    expect(lastIntent()).toBe('derive');

    fromNull(asValue((n: number) => n * 2));
    expect(lastIntent()).toBe('replace');
    fromFn(asValue((n: number) => n * 3));
    expect(lastIntent()).toBe('replace');
  });
});
