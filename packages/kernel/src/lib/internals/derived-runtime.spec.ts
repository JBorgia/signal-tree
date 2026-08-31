import { describe, expect, it } from 'vitest';
import { NEUTRAL_DERIVED_RUNTIME } from './derived-runtime';
import { NEUTRAL_CELL_RUNTIME } from './cell-runtime';

/**
 * Why `DerivedRuntime` exists rather than `memoizeSnapshot`.
 *
 * C6-DERIVED-REALIZATION-FIT-0 = FIT-B. `memoizeSnapshot`'s declared law keys
 * identity on the NODE ("calling twice for the same node must return the same
 * accessor"), but one entity carries many distinct derivations. These rows are
 * the carrier for that distinction; a node-keyed or one-shot implementation
 * fails them.
 */
describe('DerivedRuntime — neutral derived realization', () => {
  it('two derivations from ONE source stay distinct and current', () => {
    const d = NEUTRAL_DERIVED_RUNTIME;
    const source = NEUTRAL_CELL_RUNTIME.createCell(2);

    const isEmpty = d.createDerived(() => source() === 0);
    const doubled = d.createDerived(() => source() * 2);

    // distinct derivations, not one shared accessor
    expect(isEmpty).not.toBe(doubled);
    expect(isEmpty()).toBe(false);
    expect(doubled()).toBe(4);

    // changing source truth changes BOTH on the next read. A one-shot cache
    // (`const v = compute(); return () => v;`) fails here.
    source.set(0);
    expect(isEmpty()).toBe(true);
    expect(doubled()).toBe(0);

    source.set(5);
    expect(isEmpty()).toBe(false);
    expect(doubled()).toBe(10);
  });

  it('neutral derived values need no framework', () => {
    // Nothing in this file imports @angular/core, and no realization is
    // installed by it: the default carrier must already be correct.
    const d = NEUTRAL_DERIVED_RUNTIME;
    const cell = NEUTRAL_CELL_RUNTIME.createCell('a');
    const upper = d.createDerived(() => cell().toUpperCase());
    expect(upper()).toBe('A');
    cell.set('b');
    expect(upper()).toBe('B');
  });
});
