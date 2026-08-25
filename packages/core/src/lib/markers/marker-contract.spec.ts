import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerMarkerProcessor } from '../internals/materialize-markers';
import { signalTree } from '../signal-tree';
import { stored } from './stored';

/**
 * Every marker must say what of it is state.
 *
 * That sentence is the whole defect class. Four separate bugs came from nobody
 * ever having to answer it: `form()` and the three async markers vanishing from
 * every snapshot; `entityMap` emitting a `map` that JSON rendered as `{}` while
 * holding 10,000 entities; `status()` shipping six computeds and nine setter
 * METHODS into a payload that then threw on restore.
 *
 * ST2022 is the guard. Enforced at REGISTRATION rather than materialisation,
 * because `materializeMarkers` swallows `create()` throws (RFC 0005 §7) — a
 * materialiser-level guard fails open, which is the lesson `entityMap({ load })`
 * already learned with ST2004.
 */
/**
 * ⚠️ The asyncSource cases are gone with the primitive. `entityMap` and `stored`
 * remain as subjects for the generic marker-contract invariants — snapshot
 * participation, the transient declaration, and the ordinary leaf walk.
 */
describe('ST2022 — a marker registered without declaring its state', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const fired = () =>
    warn.mock.calls.map((c) => String(c[0])).some((m) => m.includes('ST2022'));

  it('warns when neither snapshot nor transient is declared', () => {
    const S = Symbol.for('signaltree:test-st2022-undeclared');
    registerMarkerProcessor(
      (v): v is object => v !== null && typeof v === 'object' && S in v,
      () => signal(1)
    );
    expect(fired()).toBe(true);
  });

  it('stays silent when a snapshot is declared', () => {
    const S = Symbol.for('signaltree:test-st2022-declared');
    registerMarkerProcessor(
      (v): v is object => v !== null && typeof v === 'object' && S in v,
      () => signal(1),
      { snapshot: (n) => n() }
    );
    expect(fired()).toBe(false);
  });

  it('stays silent when the marker declares itself transient', () => {
    const S = Symbol.for('signaltree:test-st2022-transient');
    registerMarkerProcessor(
      (v): v is object => v !== null && typeof v === 'object' && S in v,
      () => signal(1),
      { transient: true }
    );
    expect(fired()).toBe(false);
  });
});

describe('stored() declares transient — explicitly, not by omission', () => {
  it('still round-trips through the ordinary leaf walk', () => {
    // `transient` means "I need no snapshot hook", not "I have no state". A
    // materialised stored() IS a real WritableSignal, so the ordinary walk
    // reads it, writes it, and records it for undo — which is why declaring
    // transient costs it nothing.
    const tree = signalTree({ k: stored('mc-spec-1', 'a') });
    tree.$.k.set('b');
    expect(tree()).toEqual({ k: 'b' });
  });

  it('self-restores from its own source with no snapshot applied', () => {
    // The property that makes `transient` correct rather than lossy: a fresh
    // tree re-reads its own storage during construction, before any snapshot
    // arrives.
    const a = signalTree({ k: stored('mc-spec-2', 'light') });
    a.$.k.set('dark');
    a.$.k.flush?.();

    const b = signalTree({ k: stored('mc-spec-2', 'light') });
    expect(b.$.k()).toBe('dark');
  });
});
