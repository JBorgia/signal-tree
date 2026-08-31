import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { signalTree } from '../index';

/**
 * C6 / S3 — the kernel's ONE tracking-suppression requirement.
 *
 * Write bookkeeping reads a leaf's current value to short-circuit a
 * reference-identical write. That read is the kernel asking a question, not a
 * consumer subscribing. If it happens inside a tracking scope, the writer
 * becomes a dependent of the leaf it just wrote — and a reactive context that
 * writes through the merge path then re-triggers itself forever.
 *
 * ⚠️ THIS CARRIER IS BOUNDED ON PURPOSE. The failure mode is non-termination,
 * so it cannot be asserted by "did it finish". `RUN_CAP` turns an unbounded
 * self-trigger into a finite, reportable number.
 *
 * Mutation that must turn it RED: make the bound realization's suppression
 * call `fn()` in Angular's tracked context.
 */
const RUN_CAP = 50;

describe('C6/S3 — tracking suppression', () => {
  it('a merge write inside a reactive context does not enrol the writer as its own dependent', () => {
    TestBed.configureTestingModule({});
    const tree = signalTree({ a: 0, trigger: 0 });
    let runs = 0;

    TestBed.runInInjectionContext(() => {
      effect(() => {
        if (runs >= RUN_CAP) return; // hard stop: a runaway must not hang the suite
        runs++;
        tree.$.trigger();
        tree({ a: runs }); // merge path -> recursiveUpdate -> withoutTracking(() => sig())
      });
    });
    (TestBed as unknown as { flushEffects?: () => void }).flushEffects?.();

    const settled = runs;
    // An external write to the leaf the effect writes must NOT re-run it.
    tree({ a: 999 });
    (TestBed as unknown as { flushEffects?: () => void }).flushEffects?.();

    expect(runs).toBeLessThan(RUN_CAP);
    expect(runs).toBe(settled);
  });
});
