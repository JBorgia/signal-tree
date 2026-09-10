/**
 * CAPTURE-S2-0 — the bounded realization capture lease.
 *
 * Per RESEARCH-RULES R1, every critical predicate has a positive control.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCaptureActive,
  startRealizationCapture,
  StudioCaptureError,
  type CaptureTarget,
} from './lease';
import { type ObservedFrame } from './capture';

const OWNER = 7;
const leases: { dispose(): void }[] = [];
afterEach(() => { while (leases.length) leases.pop()?.dispose(); });

/** A controllable stand-in for a live tree. */
function target(over: Partial<CaptureTarget> = {}) {
  let emit: ((f: ObservedFrame) => void) | undefined;
  let destroy: (() => void) | undefined;
  const uninstall = vi.fn();
  const t: CaptureTarget = {
    treeId: 'tree-0001',
    ownerId: OWNER,
    structure: { capabilities: ['causal-runtime'] },
    observe: (onFrame) => { emit = onFrame; return uninstall; },
    onDestroy: (d) => { destroy = d; },
    ...over,
  };
  return {
    t,
    uninstall,
    emit: (f: ObservedFrame) => emit?.(f),
    destroy: () => destroy?.(),
    observed: () => emit !== undefined,
  };
}

const start = (t: CaptureTarget, max?: number) => {
  const l = startRealizationCapture(t, { maxEffects: max });
  leases.push(l);
  return l;
};

const realized = (over: Partial<ObservedFrame> = {}): ObservedFrame => ({
  path: 'cart.total', ownerPath: 'cart', before: 9800, after: 10200,
  origin: 'external', participation: 'realized', ownerId: OWNER, ...over,
});

describe('CAPTURE-S2-0', () => {
  it('1. an unsupported tree refuses and installs NOTHING', () => {
    const h = target({ structure: { capabilities: [] } });
    expect(() => startRealizationCapture(h.t)).toThrow(StudioCaptureError);
    expect(h.observed()).toBe(false);
    expect(isCaptureActive('tree-0001')).toBe(false);

    try { startRealizationCapture(h.t); } catch (e) {
      // The refusal names the CAPABILITY, not the mechanism. It used to carry
      // `reason: 'leaf-observation-unavailable'` and no capability at all,
      // which left the bridge free to fill one in — and it filled in the wrong
      // one. See CAPTURE-LIFECYCLE-0.
      expect((e as StudioCaptureError).error).toEqual({
        code: 'STUDIO_CAPABILITY_UNAVAILABLE',
        capability: 'realizations',
      });
    }
  });

  /** R1 control — refusal must be conditional, not constant. */
  it('control: a supported tree does start', () => {
    const h = target();
    start(h.t);
    expect(h.observed()).toBe(true);
    expect(isCaptureActive('tree-0001')).toBe(true);
  });

  it('2. an active capture with no frames is truthfully empty', () => {
    const l = start(target().t);
    const s = l.snapshot();
    expect(s.effects).toEqual([]);
    expect(s.coverage.scopeIntegrity).toBe('complete');
    expect(s.coverage.completeFromTreeStart).toBe(false);
  });

  it('4. external scalar realization is retained with its address', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized());

    const [e] = l.snapshot().effects;
    expect(e).toMatchObject({
      path: 'cart.total', ownerPath: 'cart',
      origin: 'external', participation: 'realized',
      before: { kind: 'value', value: 9800 },
      after: { kind: 'value', value: 10200 },
    });
  });

  it('5. restoration realization keeps origin restoration, not external', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized({ origin: 'restoration' }));
    expect(l.snapshot().effects[0]?.origin).toBe('restoration');
  });

  it('6. authored writes are excluded — S1 owns those', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized({ participation: undefined }));
    h.emit(realized({ participation: 'inspection' }));
    expect(l.snapshot().effects).toEqual([]);
  });

  it('8. a foreign tree\'s frame is ignored WITHOUT degrading integrity', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized({ ownerId: OWNER + 1 }));

    const s = l.snapshot();
    expect(s.effects).toEqual([]);
    expect(s.coverage.scopeIntegrity).toBe('complete');
  });

  it('7. an unowned frame degrades integrity and is not attributed', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized({ ownerId: undefined }));

    const s = l.snapshot();
    expect(s.effects).toEqual([]);
    expect(s.coverage.scopeIntegrity).toBe('incomplete-unscoped-evidence');
  });

  /**
   * Sequence stays CONTIGUOUS across an unowned frame. A gap would imply
   * "something happened in this tree between 1 and 3", which is exactly what
   * cannot be known. Uncertainty is carried by scopeIntegrity alone.
   */
  it('an unowned frame does not create a sequence gap', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized({ after: 1 }));
    h.emit(realized({ ownerId: undefined, after: 2 }));
    h.emit(realized({ after: 3 }));

    const s = l.snapshot();
    expect(s.effects.map((e) => e.sequence)).toEqual([0, 1]);
    expect(s.coverage.scopeIntegrity).toBe('incomplete-unscoped-evidence');
  });

  it('9. disposal uninstalls the observer and releases evidence', () => {
    const h = target();
    const l = start(h.t);
    h.emit(realized());
    expect(l.snapshot().effects).toHaveLength(1);

    l.dispose();
    expect(h.uninstall).toHaveBeenCalled();
    expect(l.snapshot().effects).toEqual([]);
    expect(isCaptureActive('tree-0001')).toBe(false);
    l.dispose(); // idempotent
  });

  it('10. tree destruction disposes the capture', () => {
    const h = target();
    start(h.t);
    expect(isCaptureActive('tree-0001')).toBe(true);

    h.destroy();
    expect(h.uninstall).toHaveBeenCalled();
    expect(isCaptureActive('tree-0001')).toBe(false);
  });

  it('11. capacity overflow evicts oldest and truncation is sticky', () => {
    const h = target();
    const l = start(h.t, 2);
    for (let i = 0; i < 5; i++) h.emit(realized({ after: i }));

    const s = l.snapshot();
    expect(s.retention.retained).toBe(2);
    expect(s.retention.truncated).toBe(true);
    expect(s.effects.map((e) => (e.after as { value: number }).value)).toEqual([3, 4]);
  });

  it('refuses a second concurrent capture for the same tree', () => {
    const h = target();
    start(h.t);
    expect(() => startRealizationCapture(h.t)).toThrow(StudioCaptureError);
    try { startRealizationCapture(h.t); } catch (e) {
      expect((e as StudioCaptureError).error.code).toBe('STUDIO_CAPTURE_ALREADY_ACTIVE');
    }
  });

  it('control: a new capture is allowed after disposal', () => {
    const h = target();
    start(h.t).dispose();
    expect(() => start(target().t)).not.toThrow();
  });
});
