import { describe, expect, it } from 'vitest';
import { isSignal, signal, computed } from '@angular/core';
import '../signal-tree'; // installs the Angular realization
import { getCellRuntime } from './cell-runtime';
import { getDerivedRuntime } from './derived-runtime';
import { isTreeCell, markTreeCell } from './cell-identity';

/** S1 identity is sacred: registration must not wrap or replace the object. */
describe('cell identity under the Angular realization', () => {
  it('an Angular-realized TREE LEAF is both a signal and a tree cell', () => {
    const cell = markTreeCell(getCellRuntime().createCell(1));
    expect(isSignal(cell)).toBe(true);
    expect(isTreeCell(cell)).toBe(true);
  });

  it('an Angular-realized derived value is BOTH', () => {
    const d = getDerivedRuntime().createDerived(() => 2);
    expect(isSignal(d)).toBe(true);
    expect(isTreeCell(d)).toBe(true);
  });

  it('registration returns the SAME object — S1 identity is untouched', () => {
    const native = signal(1);
    const registered = markTreeCell(native);
    expect(registered).toBe(native); // no wrapping, no replacement
    expect(isSignal(registered)).toBe(true);
    expect(isTreeCell(registered)).toBe(true);
  });

  it('a FOREIGN reactive value is NOT a SignalTree cell', () => {
    // Law recorded by CELL-IDENTITY-ACQUISITION-0. An unadopted `signal()` the
    // CONSUMER made and put in a tree is still something SignalTree unwraps, so
    // it must classify as a cell. The kernel cannot recognise a foreign
    // framework object, so the installed adapter answers — which is sound
    // because such objects only exist when an adapter is present.
    const foreign = signal(1);
    const foreignComputed = computed(() => 1);
    // NOT a SignalTree cell: the consumer made it, SignalTree never acquired
    // it. Snapshot/apply still handle it correctly — that behaviour is carried
    // by the walker tests (symbol-held signal captured, derived skipped,
    // plain function reported ST2008), not by cell ownership.
    expect(isTreeCell(foreign)).toBe(false);
    expect(isTreeCell(foreignComputed)).toBe(false);
    expect(isSignal(foreign)).toBe(true);
    // and an ordinary function is still NOT a cell
    expect(isTreeCell(() => 42)).toBe(false);
  });
});
