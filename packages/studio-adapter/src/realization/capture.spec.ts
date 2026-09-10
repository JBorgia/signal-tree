/**
 * S2 realization capture.
 *
 * ⚠️ RESEARCH-RULES R1: every invariant here is paired with a POSITIVE CONTROL
 * proving the assertion trips when its prohibited condition is deliberately
 * introduced. Four vacuous-test failures in this line earned that rule.
 */
import { describe, expect, it } from 'vitest';

import { createRealizationCapture, type ObservedFrame } from './capture';

const OWNER = 7;

const cap = (maxEffects?: number) =>
  createRealizationCapture({ treeId: 'tree-0001', ownerId: OWNER, maxEffects });

const realized = (over: Partial<ObservedFrame> = {}): ObservedFrame => ({
  path: 'cart.total',
  ownerPath: 'cart',
  before: 9800,
  after: 10200,
  origin: 'external',
  participation: 'realized',
  ownerId: OWNER,
  ...over,
});

describe('realization capture', () => {
  it('attributes an owned realized frame', () => {
    const c = cap();
    expect(c.accept(realized())).toBe(true);

    const s = c.snapshot();
    expect(s.effects).toHaveLength(1);
    expect(s.effects[0]).toMatchObject({
      path: 'cart.total',
      before: 9800,
      after: 10200,
      origin: 'external',
      participation: 'realized',
    });
    // SUPERSESSION-0 was WEAK: no transaction may be named.
    expect(s.effects[0]?.transactionId).toBeUndefined();
  });

  it('ignores authored writes — S1 owns those', () => {
    const c = cap();
    expect(c.accept(realized({ participation: undefined }))).toBe(false);
    expect(c.snapshot().effects).toHaveLength(0);
  });

  it('rejects another tree\'s realized write without degrading integrity', () => {
    const c = cap();
    expect(c.accept(realized({ ownerId: OWNER + 1 }))).toBe(false);

    const s = c.snapshot();
    expect(s.effects).toHaveLength(0);
    // Positively someone else's — not a gap in THIS tree's coverage.
    expect(s.coverage.scopeIntegrity).toBe('complete');
  });

  describe('scope integrity (OWNER-EVIDENCE-0)', () => {
    it('an unowned frame degrades integrity and is NOT attributed', () => {
      const c = cap();
      expect(c.accept(realized({ ownerId: undefined }))).toBe(false);

      const s = c.snapshot();
      expect(s.effects).toHaveLength(0);
      expect(s.coverage.scopeIntegrity).toBe('incomplete-unscoped-evidence');
    });

    /** R1 POSITIVE CONTROL — the assertion above must be able to fail. */
    it('control: integrity stays complete when no unowned frame is introduced', () => {
      const c = cap();
      c.accept(realized());
      c.accept(realized({ ownerId: OWNER + 1 }));
      expect(c.snapshot().coverage.scopeIntegrity).toBe('complete');
    });

    it('degradation is sticky — one gap is not erased by later good frames', () => {
      const c = cap();
      c.accept(realized({ ownerId: undefined }));
      c.accept(realized());
      expect(c.snapshot().coverage.scopeIntegrity).toBe('incomplete-unscoped-evidence');
    });

    /**
     * The honesty boundary this exists for:
     *   complete   + []  -> "no realizations since capture began"
     *   incomplete + []  -> "no ATTRIBUTABLE realizations were retained"
     */
    it('empty effects mean different things under different integrity', () => {
      const clean = cap();
      expect(clean.snapshot().effects).toHaveLength(0);
      expect(clean.snapshot().coverage.scopeIntegrity).toBe('complete');

      const gapped = cap();
      gapped.accept(realized({ ownerId: undefined }));
      expect(gapped.snapshot().effects).toHaveLength(0);
      expect(gapped.snapshot().coverage.scopeIntegrity).toBe('incomplete-unscoped-evidence');
    });
  });

  describe('retention', () => {
    it('evicts oldest past capacity and reports truncation', () => {
      const c = cap(3);
      for (let i = 0; i < 10; i++) {
        c.accept(realized({ after: i }));
      }

      const s = c.snapshot();
      expect(s.retention.capacity).toBe(3);
      expect(s.retention.retained).toBe(3);
      expect(s.retention.truncated).toBe(true);
      expect(s.effects.map((e) => e.after)).toEqual([7, 8, 9]);
      expect(s.retention.firstRetainedSequence).toBe(7);
      expect(s.retention.lastRetainedSequence).toBe(9);
    });

    /** R1 POSITIVE CONTROL — truncation must be able to read false. */
    it('control: truncated is false while under capacity', () => {
      const c = cap(3);
      c.accept(realized());
      c.accept(realized());
      const s = c.snapshot();
      expect(s.retention.truncated).toBe(false);
      expect(s.retention.retained).toBe(2);
    });

    /** Truncation and scope integrity are INDEPENDENT axes. */
    it('truncation does not imply a scope gap, and vice versa', () => {
      const c = cap(2);
      for (let i = 0; i < 5; i++) c.accept(realized({ after: i }));
      const s = c.snapshot();
      expect(s.retention.truncated).toBe(true);
      expect(s.coverage.scopeIntegrity).toBe('complete');
    });
  });

  describe('pre-capture coverage', () => {
    it('never claims completeness from tree start', () => {
      const c = cap();
      c.accept(realized());
      // Studio has no mechanism proving capture preceded all activity.
      expect(c.snapshot().coverage.completeFromTreeStart).toBe(false);
    });
  });

  describe('disposal', () => {
    it('stops accepting and releases retained effects', () => {
      const c = cap();
      c.accept(realized());
      expect(c.snapshot().effects).toHaveLength(1);

      c.dispose();
      expect(c.accept(realized())).toBe(false);
      expect(c.snapshot().effects).toHaveLength(0);
    });

    /** R1 POSITIVE CONTROL — acceptance must work before disposal. */
    it('control: frames are accepted before disposal', () => {
      const c = cap();
      expect(c.accept(realized())).toBe(true);
    });
  });
});
