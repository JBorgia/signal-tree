import { describe, expect, it } from 'vitest';
import { NEUTRAL_CELL_RUNTIME } from './cell-runtime';
import { NEUTRAL_DERIVED_RUNTIME } from './derived-runtime';
import { isTreeCell, markTreeCell } from './cell-identity';
import { isNodeAccessor } from './node-shape';

describe('CELL-IDENTITY-CARRIER-0 — neutral cell identity', () => {
  it('an UNADOPTED runtime cell is not yet a tree cell', () => {
    // CELL-IDENTITY-SPARSE-0. Realization creates an object; adoption makes it
    // a tree state cell. The same runtime mints membership revisions, history
    // counters and diagnostic carriers — none are tree cells, and they must not
    // acquire identity merely by being reactive.
    expect(isTreeCell(NEUTRAL_CELL_RUNTIME.createCell(1))).toBe(false);
  });

  it('classifies what a semantic authority adopted', () => {
    expect(isTreeCell(markTreeCell(NEUTRAL_CELL_RUNTIME.createCell(1)))).toBe(true);
    // DerivedRuntime's contract IS "realize a readonly derived value", so it
    // adopts at its own boundary.
    expect(isTreeCell(NEUTRAL_DERIVED_RUNTIME.createDerived(() => 1))).toBe(true);
  });

  it('a real tree leaf carries identity', async () => {
    const { signalTree } = await import('../signal-tree');
    const tree = signalTree({ count: 0 });
    expect(isTreeCell(tree.$.count)).toBe(true);
  });

  it('an ordinary function stored as state is NOT a cell', () => {
    const ordinary = () => 42;
    expect(isTreeCell(ordinary)).toBe(false);
  });

  it('a function wearing a fake .set is NOT a cell', () => {
    // The adversarial case. A structural predicate (callable + .set) would
    // classify this as a leaf and silently eat a function-as-state value.
    const impostor = () => 42;
    (impostor as unknown as { set: unknown }).set = () => undefined;
    (impostor as unknown as { update: unknown }).update = () => undefined;
    expect(typeof impostor).toBe('function');
    expect(typeof (impostor as unknown as { set: unknown }).set).toBe('function');
    expect(isTreeCell(impostor)).toBe(false);
  });

  it('non-callables and plain objects are not cells', () => {
    for (const v of [null, undefined, 0, 'a', {}, [], new Date()]) {
      expect(isTreeCell(v)).toBe(false);
    }
  });

  it('registration returns the SAME object — no wrapping', () => {
    const rt = NEUTRAL_CELL_RUNTIME;
    const cell = markTreeCell(rt.createCell(7));
    expect(cell()).toBe(7);
    cell.set(9);
    expect(cell()).toBe(9);
    // identity is preserved through classification
    expect(isTreeCell(cell)).toBe(true);
    expect(isNodeAccessor(cell)).toBe(false);
  });
});
