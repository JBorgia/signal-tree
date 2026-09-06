import { describe, expect, it } from 'vitest';
import { NEUTRAL_LOCATION_RUNTIME } from './location-runtime';
import { isTreeCell, markTreeCell } from './cell-identity';
import { isNodeAccessor } from './node-shape';

describe('CELL-IDENTITY-CARRIER-0 — neutral cell identity', () => {
  it('a runtime-created universal location carries nominal identity', () => {
    expect(isTreeCell(NEUTRAL_LOCATION_RUNTIME.createCell(1))).toBe(true);
  });

  it('classifies an externally supplied callable only after explicit adoption', () => {
    const external = () => 1;
    expect(isTreeCell(external)).toBe(false);
    expect(markTreeCell(external)).toBe(external);
    expect(isTreeCell(external)).toBe(true);
    expect(isTreeCell(NEUTRAL_LOCATION_RUNTIME.createDerived(() => 1))).toBe(true);
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
    const rt = NEUTRAL_LOCATION_RUNTIME;
    const cell = markTreeCell(rt.createCell(7));
    expect(cell()).toBe(7);
    cell(9);
    expect(cell()).toBe(9);
    // identity is preserved through classification
    expect(isTreeCell(cell)).toBe(true);
    expect(isNodeAccessor(cell)).toBe(false);
  });
});
