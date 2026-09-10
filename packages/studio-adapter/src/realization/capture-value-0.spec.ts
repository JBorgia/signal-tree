/**
 * CAPTURE-VALUE-0 — is retained evidence STABLE, and can it cross the bridge?
 *
 * Two distinct questions, deliberately separated:
 *
 *   A. does a captured value change when application code later mutates the
 *      object it was captured from?
 *   B. can the captured value cross a structured-clone boundary?
 *
 * ⚠️ Serialization loss and observation loss are DIFFERENT epistemic facts and
 * must never collapse into "no realizations happened".
 */
import { describe, expect, it } from 'vitest';

import { createRealizationCapture, type ObservedFrame } from './capture';

const OWNER = 7;
const cap = (max?: number) =>
  createRealizationCapture({ treeId: 'tree-0001', ownerId: OWNER, maxEffects: max });

const frame = (before: unknown, after: unknown): ObservedFrame => ({
  path: 'row',
  ownerPath: 'rows',
  before,
  after,
  origin: 'external',
  participation: 'realized',
  ownerId: OWNER,
});

describe('CAPTURE-VALUE-0 · A — snapshot stability', () => {
  /**
   * THE LOAD-BEARING PROPERTY.
   *
   * A captured realization's historical representation must not silently change
   * because an application-owned reference later changes. Otherwise S2 is not
   * retaining evidence; it is retaining a pointer to current mutable data.
   */
  it('retained evidence does not mutate when the source object is mutated', () => {
    const live = { id: 'A', name: 'Alpha' };
    const c = cap();
    c.accept(frame(undefined, live));

    const capturedBefore = JSON.stringify(c.snapshot().effects[0]?.after);
    live.name = 'MUTATED-LATER';
    const capturedAfter = JSON.stringify(c.snapshot().effects[0]?.after);

    expect(capturedAfter).toBe(capturedBefore);
    expect(capturedAfter).not.toContain('MUTATED-LATER');
  });

  it('nested structures are stable too', () => {
    const live = { rows: [{ id: 'A', tags: ['x'] }] };
    const c = cap();
    c.accept(frame(undefined, live));

    const snap = JSON.stringify(c.snapshot().effects[0]?.after);
    live.rows[0]!.tags.push('MUTATED');
    expect(JSON.stringify(c.snapshot().effects[0]?.after)).toBe(snap);
  });

  /** R1 POSITIVE CONTROL — the test must be able to detect mutation. */
  it('control: the mutation the test guards against is actually observable', () => {
    const live = { name: 'Alpha' };
    const held = live; // a deliberate reference, the failure mode being guarded
    live.name = 'MUTATED-LATER';
    expect(JSON.stringify(held)).toContain('MUTATED-LATER');
  });
});

describe('CAPTURE-VALUE-0 · A — value shapes', () => {
  const shapes: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['string', 'x'],
    ['array', [1, 2, 3]],
    ['nested object', { a: { b: [1] } }],
    ['Date', new Date(0)],
    ['Map', new Map([['k', 1]])],
    ['Set', new Set([1])],
  ];

  for (const [name, value] of shapes) {
    it(`retains ${name} without throwing`, () => {
      const c = cap();
      expect(() => c.accept(frame(undefined, value))).not.toThrow();
      expect(() => c.snapshot()).not.toThrow();
    });
  }

  it('a cyclic object does not throw during capture or snapshot', () => {
    const cyclic: Record<string, unknown> = { name: 'A' };
    cyclic['self'] = cyclic;
    const c = cap();
    expect(() => c.accept(frame(undefined, cyclic))).not.toThrow();
    expect(() => c.snapshot()).not.toThrow();
  });

  it('a function-valued state does not throw during capture', () => {
    const c = cap();
    expect(() => c.accept(frame(undefined, () => 'hi'))).not.toThrow();
    expect(() => c.snapshot()).not.toThrow();
  });
});

describe('CAPTURE-VALUE-0 · B — transportability', () => {
  const transportable = (v: unknown) => {
    try {
      structuredClone(v);
      return true;
    } catch {
      return false;
    }
  };

  it('records which shapes survive structuredClone', () => {
    const c = cap();
    c.accept(frame(undefined, { ok: 1 }));
    c.accept(frame(undefined, () => 'nope'));
    c.accept(frame(undefined, Symbol('s')));

    const kinds = c.snapshot().effects.map((e) => e.after.kind);
    // A plain object survives; a function and a symbol are recorded as
    // unserializable rather than dropped.
    expect(kinds).toEqual(['value', 'unserializable', 'unserializable']);
    expect(c.snapshot().effects.every((e) => transportable(e.after))).toBe(true);
  });

  /**
   * The property that matters: a value that cannot cross the bridge must not
   * make the whole snapshot untransportable, because that would turn
   * serialization loss into apparent observation loss.
   */
  it('one untransportable value must not sink the entire snapshot', () => {
    const c = cap();
    c.accept(frame(undefined, { good: 1 }));
    c.accept(frame(undefined, () => 'bad'));

    const snapshot = c.snapshot();
    expect(snapshot.effects).toHaveLength(2);
    // The whole snapshot crosses the bridge, because the untransportable value
    // was converted at CAPTURE time rather than being allowed to sink transport.
    expect(transportable(snapshot)).toBe(true);
    expect(snapshot.effects[1]?.after).toMatchObject({
      kind: 'unserializable',
      valueType: 'function',
    });
  });
});
