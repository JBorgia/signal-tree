import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { timeTravel } from '../../enhancers/time-travel/time-travel';
import { signalTree } from '../signal-tree';
import { toWritableSignal } from '../utils';
import { trackHistory } from './form-history';

/**
 * TH-0 — the decisive experiment.
 *
 * `trackHistory` survived FORM-DEL because it takes a plain `WritableSignal`
 * rather than a marker. The compositional forms story wants it over
 * `toWritableSignal(tree.$.branch)`. So: when it undoes, does that reversal go
 * back through SignalTree's canonical mutation path with the same semantics as
 * `timeTravel()`, or does it maintain an independent value history around the
 * signal?
 *
 * The answer decides ownership. If it is independent, then a tree with both
 * enhancers has TWO restoration systems representing the same user operation at
 * different layers, which is an argument against publishing both — not an
 * argument about implementation quality.
 *
 * These tests assert what the code DOES, including where that is undesirable.
 * They are evidence for the audit, not a specification.
 */

type Profile = { name: string; email: string };

/**
 * `trackHistory` records through an Angular `effect`, so a microtask is not
 * enough — it needs the framework scheduler to have run. The first version of
 * this suite awaited `Promise.resolve()` and saw every undo as a no-op, which
 * looked like a defect in `trackHistory` and was a defect in the test.
 */
const flush = async () => {
  TestBed.tick();
  await Promise.resolve();
  await Promise.resolve();
  TestBed.tick();
};

describe('TH-0: trackHistory over a SignalTree branch', () => {
  it('records its undo as a NEW forward turn, not a reversal', async () => {
    const injector = TestBed.inject(Injector);
    const tree = signalTree(
      { profile: { name: 'a', email: 'a@x' } as Profile },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );

    const model = toWritableSignal(tree.$.profile);
    const hist = runInInjectionContext(injector, () =>
      trackHistory<Profile>(model, { capacity: 20, injector })
    );

    model.set({ name: 'b', email: 'a@x' });
    await flush();
    const afterEdit = tree.getHistory().length;

    hist.undo();
    await flush();

    // The value did revert.
    expect(tree.$.profile.name()).toBe('a');

    // THE FINDING: time-travel saw the undo as another write. A reversal
    // routed through the canonical path would not have grown the history —
    // `tree.undo()` shortens the undo stack, it does not extend it.
    expect(tree.getHistory().length).toBeGreaterThan(afterEdit);
  });

  it('so tree.undo() after a trackHistory undo REDOES the edit', async () => {
    const injector = TestBed.inject(Injector);
    const tree = signalTree(
      { profile: { name: 'a', email: 'a@x' } as Profile },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );

    const model = toWritableSignal(tree.$.profile);
    const hist = runInInjectionContext(injector, () =>
      trackHistory<Profile>(model, { capacity: 20, injector })
    );

    model.set({ name: 'b', email: 'a@x' });
    await flush();

    hist.undo();
    await flush();
    expect(tree.$.profile.name()).toBe('a');

    // A user pressing the app's undo button now expects 'a' to stay, or to go
    // further back. Instead the tree reverses ITS last recorded turn — which
    // was the trackHistory undo — and the edit comes back.
    tree.undo();
    await flush();

    expect(tree.$.profile.name()).toBe('b');
  });

  it('two histories over one model disagree about the current position', async () => {
    const injector = TestBed.inject(Injector);
    const tree = signalTree(
      { profile: { name: 'a', email: 'a@x' } as Profile },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );

    const model = toWritableSignal(tree.$.profile);
    const hist = runInInjectionContext(injector, () =>
      trackHistory<Profile>(model, { capacity: 20, injector })
    );

    model.set({ name: 'b', email: 'a@x' });
    await flush();
    model.set({ name: 'c', email: 'a@x' });
    await flush();

    // Both systems believe they own the undo stack for the same edits.
    expect(hist.canUndo()).toBe(true);
    expect(tree.canUndo()).toBe(true);

    hist.undo();
    await flush();

    // trackHistory moved back one. time-travel recorded that as forward motion,
    // so it can still undo — and undoing would move the model FORWARD.
    expect(tree.$.profile.name()).toBe('b');
    expect(tree.canUndo()).toBe(true);
  });
});
