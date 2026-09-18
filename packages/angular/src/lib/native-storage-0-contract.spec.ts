import {
  effect,
  Injector,
  isSignal,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { restoration, signalTree, transactions, undoable } from '../index';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const tree = () =>
  signalTree(
    { theme: 'light', locale: 'en' },
    { enhancers: [restoration(), transactions()] }
  );

/**
 * THE CONTRACT `NATIVE-STORAGE-0` MUST NOT BREAK.
 *
 * `NATIVE-STORAGE-0` proposes making the framework-native carrier the sole
 * physical scalar value, deleting the kernel's parallel `values[slot]` copy.
 * Everything here is behaviour that survives that change unchanged, pinned
 * BEFORE the change so it can fail during it.
 *
 * ## Two laws that keep getting conflated
 *
 * ```text
 * TRANSACTION          optimistic — speculative writes ARE visible
 * LOGICAL COMMIT TURN  one causal operation publishes coherently
 * ```
 *
 * The first is the one at issue here. A design sketch for `NATIVE-STORAGE-0`
 * proposed staging transaction writes outside the carrier so "no consumer can
 * observe partially committed truth". That is not this product: a transaction
 * is an optimistic speculative turn, not a hidden staging buffer, and
 * `demarcation.spec.ts` has asserted so by name since before this file existed.
 * Staging outside the carrier would be a SEMANTIC REGRESSION wearing the
 * clothes of a safety measure.
 *
 * So the guarantees are: speculative writes are visible, rollback restores
 * through the SAME carrier, and rollback is not authorship.
 */
describe('NATIVE-STORAGE-0 contract', () => {
  it('a transaction write is visible immediately, before confirmation', async () => {
    const store = tree();
    await flush();
    const seen: string[] = [];
    runInInjectionContext(TestBed.inject(Injector), () => {
      effect(() => void seen.push(store.$.theme()));
    });
    TestBed.tick();

    const pending = store.transaction(() => store.$.theme.set('speculative'));
    TestBed.tick();
    await flush();

    // Read path and observation path must agree: both see the speculative value.
    expect(store.$.theme()).toBe('speculative');
    expect(seen).toContain('speculative');

    pending.rollback();
    store.destroy();
  });

  it('rollback restores prior truth through the SAME carrier object', async () => {
    const store = tree();
    await flush();
    const carrierBefore = store.$.theme;
    expect(isSignal(carrierBefore)).toBe(true);

    const pending = store.transaction(() => store.$.theme.set('speculative'));
    await flush();
    expect(store.$.theme).toBe(carrierBefore); // identity survives a speculative write

    pending.rollback();
    await flush();

    expect(store.$.theme()).toBe('light');
    // The carrier is not replaced by rollback — a held reference stays live.
    expect(store.$.theme).toBe(carrierBefore);
    expect(carrierBefore()).toBe('light');
    store.destroy();
  });

  it('undo works when no transaction intervened — the control', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme.set('dark'));
    await flush();
    expect(store.$.theme()).toBe('dark');
    expect(store.canUndo()).toBe(true);

    store.undo();
    await flush();
    expect(store.$.theme()).toBe('light');
    store.destroy();
  });

  /**
   * Rollback is not authorship, and it is not external truth either.
   *
   * This failed when first written: restoration's P0-C provenance index
   * recorded the rollback's restore half as external truth, so an abandoned
   * speculative turn refused the undo of an EARLIER authored turn with ST1034.
   * Fixed in the kernel by teaching the recorder to read the
   * `origin: 'transaction-rollback'` fact that `transactions.ts` was already
   * stamping. Controls live in
   * `packages/kernel/src/enhancers/restoration/compensation-provenance.spec.ts`,
   * including the one that matters most — genuine external truth must still
   * refuse.
   */
  it('an abandoned speculative turn leaves an earlier undo intact', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme.set('dark'));
    await flush();

    const pending = store.transaction(() => store.$.theme.set('speculative'));
    await flush();
    pending.rollback();
    await flush();

    // Rollback restores the authored value...
    expect(store.$.theme()).toBe('dark');

    // ...and the earlier authored turn is still reversible.
    store.undo();
    await flush();
    expect(store.$.theme()).toBe('light');
    store.destroy();
  });

  it('a confirmed transaction settles without disturbing an untouched position', async () => {
    const store = tree();
    await flush();
    const localeCarrier = store.$.locale;
    const seen: string[] = [];
    runInInjectionContext(TestBed.inject(Injector), () => {
      effect(() => void seen.push(store.$.locale()));
    });
    TestBed.tick();
    const beforeCount = seen.length;

    const pending = store.transaction(() => store.$.theme.set('dark'));
    await pending.commit?.();
    TestBed.tick();
    await flush();

    expect(store.$.theme()).toBe('dark');
    expect(store.$.locale()).toBe('en');
    expect(store.$.locale).toBe(localeCarrier);
    // An untouched position must not be republished by an unrelated turn.
    expect(seen.length).toBe(beforeCount);
    store.destroy();
  });

  it('leaves remain real Angular WritableSignals throughout', async () => {
    const store = tree();
    await flush();
    expect(isSignal(store.$.theme)).toBe(true);
    expect(typeof store.$.theme.set).toBe('function');

    const pending = store.transaction(() => store.$.theme.set('speculative'));
    expect(isSignal(store.$.theme)).toBe(true);
    pending.rollback();
    await flush();
    expect(isSignal(store.$.theme)).toBe(true);
    expect(typeof store.$.theme.set).toBe('function');
    store.destroy();
  });
});
