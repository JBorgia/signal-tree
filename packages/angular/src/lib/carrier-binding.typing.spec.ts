import { describe, expect, it } from 'vitest';
import type { Signal, WritableSignal } from '@angular/core';
import { entityMap, signalTree } from '../index';

/**
 * TYPE-A-PACKAGE-BINDING-0 (TA-B) — the DECLARATION truth, not the runtime one.
 * Runtime S1 (`isSignal`) proves the object is native; this proves the package
 * SAYS so. Both are required: a cast could satisfy one without the other.
 */
describe('Angular package declares Angular carriers', () => {
  it('an ordinary leaf is declared WritableSignal<T>', () => {
    const tree = signalTree({ count: 0 });
    const leaf: WritableSignal<number> = tree.$.count;
    const ro: Signal<number> = tree.$.count;
    expect([leaf, ro].length).toBe(2);
  });

  it('a nested leaf is declared WritableSignal<T>', () => {
    const tree = signalTree({ user: { name: 'a' } });
    const nested: WritableSignal<string> = tree.$.user.name;
    expect(nested()).toBe('a');
  });

  it('destroyed is declared Signal<boolean>', () => {
    const tree = signalTree({ count: 0 });
    const destroyed: Signal<boolean> = tree.destroyed;
    expect(destroyed()).toBe(false);
  });

  it('entity surfaces are declared Angular signals', () => {
    const tree = signalTree({
      users: entityMap<{ id: number; name: string }>(),
    });
    const rows = tree.$.users;
    rows.addOne({ id: 1, name: 'Ada' });

    const empty: Signal<boolean> = rows.empty;
    const row = rows.byIdOrFail(1);
    const field: Signal<string> = row.name;
    const ro: Signal<string> = row.name.asReadonly();

    expect(empty()).toBe(false);
    expect(field()).toBe('Ada');
    expect(ro()).toBe('Ada');
  });
});
